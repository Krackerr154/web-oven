"""Publication-style figure rendering for LUMA.

The Next.js app posts *data* here — never code. That boundary is deliberate:
this service is reachable from the chat route, and a renderer that accepted
Python would be remote code execution with extra steps.

Output is a PNG returned as base64 so the caller can stream it inline without
touching a filesystem or a volume.
"""

from __future__ import annotations

import base64
import io
import logging
from typing import Literal

import matplotlib

matplotlib.use("Agg")  # no display in a container

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import AutoMinorLocator, MaxNLocator
from pydantic import BaseModel, Field, field_validator

log = logging.getLogger("xrd-sim.plot")

# Okabe-Ito: colourblind-safe, the palette PlotSmith uses.
PALETTE = ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9"]

MM_PER_INCH = 25.4
MAX_POINTS = 4000  # beyond this a line plot is visually identical, just slower


class Series(BaseModel):
    label: str = ""
    x: list[float] = Field(min_length=2, max_length=200_000)
    y: list[float] = Field(min_length=2, max_length=200_000)

    @field_validator("y")
    @classmethod
    def same_length(cls, v: list[float], info):
        x = info.data.get("x")
        if x is not None and len(v) != len(x):
            raise ValueError("x and y must be the same length")
        return v


class PlotRequest(BaseModel):
    kind: Literal["xy", "xrd", "cv", "tauc", "bar", "scatter"] = "xy"
    series: list[Series] = Field(min_length=1, max_length=6)
    xlabel: str = Field(default="", max_length=120)
    ylabel: str = Field(default="", max_length=120)
    title: str = Field(default="", max_length=160)
    width_mm: float = Field(default=85.0, ge=40.0, le=180.0)
    dpi: int = Field(default=200, ge=72, le=600)
    reverse_x: bool = False
    reverse_y: bool = False


def _decimate(x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Stride-decimate long traces. Keeps the endpoints so the curve still
    starts and ends where the data does."""
    n = len(x)
    if n <= MAX_POINTS:
        return x, y
    idx = np.linspace(0, n - 1, MAX_POINTS).astype(int)
    return x[idx], y[idx]


def _style(ax, kind: str) -> None:
    ax.tick_params(which="major", direction="in", length=4.0, width=0.8,
                   top=True, right=True, labelsize=8)
    ax.tick_params(which="minor", direction="in", length=2.0, width=0.6,
                   top=True, right=True)
    ax.xaxis.set_minor_locator(AutoMinorLocator(2))
    ax.yaxis.set_minor_locator(AutoMinorLocator(2))
    ax.yaxis.set_major_locator(MaxNLocator(nbins=6))
    for spine in ax.spines.values():
        spine.set_linewidth(0.8)
    ax.grid(False)
    if kind == "xrd":
        ax.set_ylim(bottom=0)


def render(req: PlotRequest) -> dict:
    width_in = req.width_mm / MM_PER_INCH
    height_in = width_in * 0.72  # 4:3-ish, the ratio PlotSmith locks to

    fig, ax = plt.subplots(figsize=(width_in, height_in), dpi=req.dpi)
    fig.patch.set_facecolor("white")

    for i, s in enumerate(req.series):
        x = np.asarray(s.x, dtype=float)
        y = np.asarray(s.y, dtype=float)
        x, y = _decimate(x, y)
        colour = PALETTE[i % len(PALETTE)]
        label = s.label or None

        if req.kind == "bar":
            ax.bar(x, y, width=(x[1] - x[0]) * 0.8 if len(x) > 1 else 0.8,
                   color=colour, label=label, edgecolor="none")
        elif req.kind == "scatter":
            ax.scatter(x, y, s=8, color=colour, label=label, linewidths=0)
        else:
            ax.plot(x, y, color=colour, linewidth=1.0, label=label,
                    solid_joinstyle="round")

    _style(ax, req.kind)

    if req.xlabel:
        ax.set_xlabel(req.xlabel, fontsize=9)
    if req.ylabel:
        ax.set_ylabel(req.ylabel, fontsize=9)
    if req.title:
        ax.set_title(req.title, fontsize=9, pad=6)
    if req.reverse_x:
        ax.invert_xaxis()
    if req.reverse_y:
        ax.invert_yaxis()

    # A diffraction peak that touches the frame reads as clipped data. Give the
    # tallest peak 6% of headroom.
    if req.kind == "xrd":
        top = max((max(s.y) for s in req.series if s.y), default=0.0)
        if top > 0:
            ax.set_ylim(0, top * 1.06)

    # A one-series legend just repeats the caption. Only label when comparing.
    if len(req.series) > 1:
        ax.legend(frameon=False, fontsize=7, loc="best")

    fig.tight_layout(pad=0.4)

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=req.dpi, facecolor="white",
                bbox_inches="tight", pad_inches=0.02)
    plt.close(fig)

    raw = buf.getvalue()
    log.info("rendered %s: %d series, %d bytes", req.kind, len(req.series), len(raw))
    return {
        "png_base64": base64.b64encode(raw).decode("ascii"),
        "bytes": len(raw),
        "width_mm": req.width_mm,
        "dpi": req.dpi,
    }
