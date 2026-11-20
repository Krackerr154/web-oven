/**
 * FTIR figure geometry → drawing primitives.
 *
 * Same primitive vocabulary as the XRD plotter (lib/plot/core), so canvas, SVG
 * and PDF all come from one geometry pass and cannot drift apart.
 *
 * Two things differ from XRD and are the whole point of a separate builder:
 *   - the wavenumber axis is DESCENDING (4000 cm⁻¹ at the left, 400 at the right)
 *   - %T spectra put 100 % at the top, so absorption bands point down
 */

import {
    PRINT_LAYOUT,
    niceStep,
    textWidth,
    type Layout,
    type Prim,
} from "@/lib/plot/core";
import type { AxisUnit } from "./parse";

export type FigureTrace = {
    id: string;
    label: string;
    color: string;
    /** Wavenumber, descending. */
    x: number[];
    /** Values already converted to the display unit. */
    y: number[];
    visible: boolean;
};

export type FtirFigureOptions = {
    lo: number;
    hi: number;
    gap: number;
    stacked: boolean;
    unit: AxisUnit;
    layout?: Layout;
    legendPos?: { fx: number; fy: number } | null;
    /** Manual Y window; omitted means "fit the data". */
    yMin?: number;
    yMax?: number;
};

const AXIS = "#111827";
const GRID = "#E2E8F0";
const MUTED = "#475569";

/** Wavenumber tick step on the IR ladder — 500 cm⁻¹ is the conventional default. */
export function wavenumberStep(span: number, target = 8): number {
    const ladder = [2000, 1000, 500, 250, 100, 50, 20, 10];
    const raw = span / target;
    // Pick the ladder rung closest in ratio, not the next one below: a 3600 cm⁻¹
    // window wants 500 cm⁻¹ ticks (8 labels), and the "below" rule gave 250 (15).
    let best = ladder[0];
    let bestErr = Infinity;
    for (const step of ladder) {
        const err = Math.abs(Math.log(step / raw));
        if (err < bestErr) {
            bestErr = err;
            best = step;
        }
    }
    return best;
}

function decimate(n: number, cap = 1800): number {
    return Math.max(1, Math.ceil(n / cap));
}

export function buildFtirFigure(
    traces: FigureTrace[],
    opts: FtirFigureOptions,
): Prim[] {
    const L = opts.layout ?? PRINT_LAYOUT;
    const { W, H, M } = L;
    const PW = W - M.l - M.r;
    const PH = H - M.t - M.b;
    const out: Prim[] = [];

    const shown = traces.filter((t) => t.visible && t.x.length > 1);
    const lo = Math.min(opts.lo, opts.hi);
    const hi = Math.max(opts.lo, opts.hi);
    const step = opts.stacked ? opts.gap : 0;

    // ── Y extent across every visible trace, including its waterfall offset ──
    let yLo = Infinity;
    let yHi = -Infinity;
    shown.forEach((t, i) => {
        const shift = i * step;
        for (let k = 0; k < t.y.length; k++) {
            const v = t.y[k] + shift;
            if (!Number.isFinite(v)) continue;
            if (v < yLo) yLo = v;
            if (v > yHi) yHi = v;
        }
    });
    if (!Number.isFinite(yLo) || !Number.isFinite(yHi)) {
        yLo = 0;
        yHi = 1;
    }
    if (opts.yMin !== undefined) yLo = opts.yMin;
    if (opts.yMax !== undefined) yHi = opts.yMax;
    if (yHi - yLo < 1e-9) {
        yHi += 1;
        yLo -= 1;
    }
    const pad = (yHi - yLo) * 0.06;
    if (opts.yMin === undefined) yLo -= pad;
    if (opts.yMax === undefined) yHi += pad;

    const px = (w: number) => M.l + ((hi - w) / (hi - lo)) * PW;
    const py = (v: number) => M.t + ((yHi - v) / (yHi - yLo)) * PH;

    // ── Plot frame ──
    out.push({
        t: "rect",
        x: M.l,
        y: M.t,
        w: PW,
        h: PH,
        stroke: AXIS,
        sw: 1,
        fill: "#FFFFFF",
    });

    // ── Axis titles ──
    out.push({
        t: "text",
        x: M.l + PW / 2,
        y: H - 22,
        s: "Wavenumber (cm⁻¹)",
        size: L.titleFont,
        fill: AXIS,
        weight: 600,
        anchor: "middle",
    });
    out.push({
        t: "text",
        x: M.l - 14,
        y: M.t + PH / 2,
        s: opts.unit === "transmittance" ? "Transmittance (%)" : "Absorbance (a.u.)",
        size: L.titleFont,
        fill: AXIS,
        weight: 600,
        anchor: "middle",
        rotate: -90,
    });

    // ── X ticks (descending) ──
    const xStep = wavenumberStep(hi - lo);
    const firstX = Math.ceil(lo / xStep) * xStep;
    for (let w = firstX; w <= hi + 1e-9; w += xStep) {
        const X = px(w);
        out.push({ t: "line", x1: X, y1: M.t, x2: X, y2: M.t + PH, stroke: GRID, w: 1 });
        out.push({ t: "line", x1: X, y1: M.t + PH, x2: X, y2: M.t + PH + 5, stroke: AXIS, w: 1 });
        out.push({
            t: "text",
            x: X,
            y: M.t + PH + 8,
            s: String(Math.round(w)),
            size: L.tickFont,
            fill: MUTED,
            anchor: "middle",
            baseline: "top",
        });
    }

    // ── Y ticks ──
    const yStep = niceStep(yHi - yLo, 7);
    const firstY = Math.ceil(yLo / yStep) * yStep;
    for (let v = firstY; v <= yHi + 1e-9; v += yStep) {
        const Y = py(v);
        out.push({ t: "line", x1: M.l, y1: Y, x2: M.l + PW, y2: Y, stroke: GRID, w: 1 });
        out.push({ t: "line", x1: M.l - 5, y1: Y, x2: M.l, y2: Y, stroke: AXIS, w: 1 });
        out.push({
            t: "text",
            x: M.l - 9,
            y: Y,
            s: yStep < 1 ? v.toFixed(2) : String(Math.round(v)),
            size: L.tickFont,
            fill: MUTED,
            anchor: "end",
            baseline: "middle",
        });
    }

    // ── Traces ──
    shown.forEach((t, i) => {
        const shift = i * step;
        const skip = decimate(t.x.length);
        const pts: Array<[number, number]> = [];
        for (let k = 0; k < t.x.length; k += skip) {
            const w = t.x[k];
            if (w < lo - 1e-9 || w > hi + 1e-9) continue;
            pts.push([px(w), py(t.y[k] + shift)]);
        }
        if (pts.length < 2) return;
        out.push({ t: "poly", pts, stroke: t.color, w: 1.6 });
    });

    // ── Legend (top-right, white backing so traces never run through it) ──
    const entries = shown.map((t) => t.label);
    if (entries.length) {
        const rowH = L.legendFont + 6;
        const widest = Math.max(...entries.map((s) => textWidth(s, L.legendFont)));
        const boxW = Math.min(PW * 0.55, widest + 46);
        const boxH = entries.length * rowH + 12;
        const pos = opts.legendPos ?? { fx: 1, fy: 0 };
        const bx = M.l + 8 + pos.fx * Math.max(0, PW - boxW - 16);
        const by = M.t + 8 + pos.fy * Math.max(0, PH - boxH - 16);

        out.push({
            t: "rect",
            x: bx,
            y: by,
            w: boxW,
            h: boxH,
            stroke: "#CBD5E1",
            sw: 1,
            fill: "#FFFFFF",
            opacity: 0.93,
            rx: 4,
        });
        shown.forEach((t, i) => {
            const cy = by + 6 + i * rowH + rowH / 2;
            out.push({
                t: "line",
                x1: bx + 8,
                y1: cy,
                x2: bx + 26,
                y2: cy,
                stroke: t.color,
                w: 2.4,
            });
            out.push({
                t: "text",
                x: bx + 32,
                y: cy,
                s: t.label,
                size: L.legendFont,
                fill: AXIS,
                baseline: "middle",
            });
        });
    }

    return out;
}
