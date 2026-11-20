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
    /** Fitted baseline in display units, drawn dashed when present. */
    baseline?: number[] | null;
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
    /** Draw the active trace's residual strip under the main plot. */
    showResidual?: boolean;
    /** Trace whose residual is shown; defaults to the first visible one. */
    residualId?: string;
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


/**
 * Padded Y window that fits every visible trace, including its waterfall slot.
 * Exported so the component can invert pointer coordinates with the same numbers
 * the figure used — two copies of this arithmetic would drift apart.
 */
export function yExtent(traces: FigureTrace[], step: number): [number, number] {
    let lo = Infinity;
    let hi = -Infinity;
    traces.forEach((t, i) => {
        const shift = i * step;
        for (let k = 0; k < t.y.length; k++) {
            const v = t.y[k] + shift;
            if (!Number.isFinite(v)) continue;
            if (v < lo) lo = v;
            if (v > hi) hi = v;
        }
    });
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
    if (hi - lo < 1e-9) return [lo - 0.5, hi + 0.5];
    const pad = (hi - lo) * 0.06;
    return [lo - pad, hi + pad];
}

/** Plot-area geometry. Shared by the builder and by pointer hit-testing. */
export function plotFrame(L: Layout, showResidual: boolean) {
    const PW = L.W - L.M.l - L.M.r;
    const PH = L.H - L.M.t - L.M.b;
    const resH = showResidual ? Math.round(PH * 0.24) : 0;
    const resGap = showResidual ? 26 : 0;
    return { PW, PH, resH, resGap, mainH: PH - resH - resGap };
}

export function buildFtirFigure(
    traces: FigureTrace[],
    opts: FtirFigureOptions,
): Prim[] {
    const L = opts.layout ?? PRINT_LAYOUT;
    const { W, H, M } = L;
    const { PW, PH, resH, resGap, mainH } = plotFrame(L, !!opts.showResidual);
    const out: Prim[] = [];

    const shown = traces.filter((t) => t.visible && t.x.length > 1);
    const lo = Math.min(opts.lo, opts.hi);
    const hi = Math.max(opts.lo, opts.hi);
    const step = opts.stacked ? opts.gap : 0;

    // ── Y extent across every visible trace, including its waterfall offset ──
    const [fitLo, fitHi] = yExtent(shown, step);
    let yLo = opts.yMin ?? fitLo;
    let yHi = opts.yMax ?? fitHi;
    if (yHi - yLo < 1e-9) {
        yHi += 1;
        yLo -= 1;
    }

    // The residual strip takes height from the main panel rather than growing the
    // figure, so an exported PNG keeps its declared size.

    const px = (w: number) => M.l + ((hi - w) / (hi - lo)) * PW;
    const py = (v: number) => M.t + ((yHi - v) / (yHi - yLo)) * mainH;

    // ── Plot frame ──
    out.push({
        t: "rect",
        x: M.l,
        y: M.t,
        w: PW,
        h: mainH,
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
        y: M.t + mainH / 2,
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
        out.push({ t: "line", x1: X, y1: M.t, x2: X, y2: M.t + mainH, stroke: GRID, w: 1 });
        out.push({ t: "line", x1: X, y1: M.t + mainH, x2: X, y2: M.t + mainH + 5, stroke: AXIS, w: 1 });
        out.push({
            t: "text",
            x: X,
            y: M.t + mainH + 8,
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

        // Fitted baseline underneath the trace: dashed so it never reads as data.
        if (t.baseline && t.baseline.length === t.x.length) {
            const bpts: Array<[number, number]> = [];
            for (let k = 0; k < t.x.length; k += skip) {
                const w = t.x[k];
                if (w < lo - 1e-9 || w > hi + 1e-9) continue;
                bpts.push([px(w), py(t.baseline[k] + shift)]);
            }
            if (bpts.length > 1) {
                out.push({ t: "poly", pts: bpts, stroke: t.color, w: 1.1, dash: [6, 4] });
            }
        }

        out.push({ t: "poly", pts, stroke: t.color, w: 1.6 });
    });

    // ── Residual strip ──
    if (opts.showResidual && resH > 0) {
        const active =
            shown.find((t) => t.id === opts.residualId && t.baseline) ??
            shown.find((t) => t.baseline);
        if (active?.baseline) {
            const top = M.t + mainH + resGap;
            const res = active.y.map((v, i) => v - (active.baseline as number[])[i]);
            let maxAbs = 0;
            for (const v of res) if (Number.isFinite(v)) maxAbs = Math.max(maxAbs, Math.abs(v));
            if (maxAbs < 1e-9) maxAbs = 1;
            const rpad = maxAbs * 1.15;
            const ry = (v: number) => top + ((rpad - v) / (2 * rpad)) * resH;

            out.push({
                t: "rect",
                x: M.l,
                y: top,
                w: PW,
                h: resH,
                stroke: "#94A3B8",
                sw: 1,
                fill: "#FAFAFA",
            });
            out.push({
                t: "line",
                x1: M.l,
                y1: ry(0),
                x2: M.l + PW,
                y2: ry(0),
                stroke: "#94A3B8",
                w: 1,
                dash: [4, 4],
            });

            const skip = decimate(active.x.length);
            const rpts: Array<[number, number]> = [];
            for (let k = 0; k < active.x.length; k += skip) {
                const w = active.x[k];
                if (w < lo - 1e-9 || w > hi + 1e-9) continue;
                rpts.push([px(w), ry(res[k])]);
            }
            if (rpts.length > 1) {
                out.push({ t: "poly", pts: rpts, stroke: active.color, w: 1 });
            }
            out.push({
                t: "text",
                x: M.l + 6,
                y: top + 4,
                s: "residual (raw − corrected)",
                size: Math.max(9, L.tickFont - 2),
                fill: MUTED,
                baseline: "top",
            });
        }
    }

    // ── Legend (top-right, white backing so traces never run through it) ──
    const entries = shown.map((t) => t.label);
    if (entries.length) {
        const rowH = L.legendFont + 6;
        const widest = Math.max(...entries.map((s) => textWidth(s, L.legendFont)));
        const boxW = Math.min(PW * 0.55, widest + 46);
        const boxH = entries.length * rowH + 12;
        const pos = opts.legendPos ?? { fx: 1, fy: 0 };
        const bx = M.l + 8 + pos.fx * Math.max(0, PW - boxW - 16);
        const by = M.t + 8 + pos.fy * Math.max(0, mainH - boxH - 16);

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
