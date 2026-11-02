"""Simulated PXRD reference patterns from a CIF file.

Runs as an internal sidecar: the Next.js app posts CIF text here and gets back
the computed reflection list. Nothing is persisted.

The physics is pymatgen's XRDCalculator: Cu K-alpha by default, structure
factors and Lorentz-polarisation applied, intensities scaled to 100.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from pymatgen.analysis.diffraction.xrd import XRDCalculator
from pymatgen.core import Structure

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("xrd-sim")

app = FastAPI(title="AP-Lab XRD simulator", version="1.0.0")

_CACHE: dict[str, dict[str, Any]] = {}
_CACHE_MAX = 32


class SimulateRequest(BaseModel):
    cif: str = Field(min_length=20, max_length=2_000_000)
    wavelength: float = Field(default=1.5406, gt=0.1, lt=5.0)
    two_theta_min: float = Field(default=5.0, ge=0.0, le=90.0)
    two_theta_max: float = Field(default=80.0, ge=1.0, le=160.0)


def _cache_key(req: SimulateRequest) -> str:
    h = hashlib.sha256()
    h.update(req.cif.encode("utf-8", "ignore"))
    h.update(f"|{req.wavelength}|{req.two_theta_min}|{req.two_theta_max}".encode())
    return h.hexdigest()


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "cached": len(_CACHE)}


@app.post("/simulate")
def simulate(req: SimulateRequest) -> dict[str, Any]:
    if req.two_theta_max <= req.two_theta_min:
        raise HTTPException(status_code=422, detail="two_theta_max must exceed two_theta_min")

    key = _cache_key(req)
    if key in _CACHE:
        log.info("cache hit")
        return _CACHE[key]

    try:
        structure = Structure.from_str(req.cif, fmt="cif")
    except Exception as exc:  # pymatgen raises a wide variety of parser errors
        log.warning("CIF parse failed: %s", exc)
        raise HTTPException(status_code=422, detail=f"CIF could not be parsed: {exc}") from exc

    if not structure.sites:
        raise HTTPException(status_code=422, detail="CIF contains no atoms")

    try:
        pattern = XRDCalculator(wavelength=req.wavelength).get_pattern(
            structure, scaled=True,
            two_theta_range=(req.two_theta_min, req.two_theta_max),
        )
    except Exception as exc:
        log.exception("pattern calculation failed")
        raise HTTPException(status_code=422, detail=f"Pattern could not be calculated: {exc}") from exc

    peaks: list[dict[str, Any]] = []
    for two_theta, intensity, hkls in zip(pattern.x, pattern.y, pattern.hkls):
        strongest = hkls[0] if hkls else None
        peaks.append({
            "two_theta": round(float(two_theta), 4),
            "intensity": round(float(intensity), 3),
            "hkl": list(strongest["hkl"]) if strongest else [0, 0, 0],
            "multiplicity": int(strongest.get("multiplicity", 1)) if strongest else 1,
        })

    if not peaks:
        raise HTTPException(
            status_code=422,
            detail="No reflections fall inside that 2-theta window",
        )

    try:
        sg_symbol, sg_number = structure.get_space_group_info()
    except Exception:
        sg_symbol, sg_number = "unknown", 0

    try:
        formula = structure.composition.reduced_formula
    except Exception:
        formula = structure.formula

    body = {
        "formula": formula,
        "spacegroup": sg_symbol,
        "spacegroup_number": sg_number,
        "volume": round(float(structure.volume), 3),
        "wavelength": req.wavelength,
        "peaks": peaks,
    }

    if len(_CACHE) >= _CACHE_MAX:
        _CACHE.pop(next(iter(_CACHE)))
    _CACHE[key] = body

    log.info("simulated %s: %d reflections", formula, len(peaks))
    return body
