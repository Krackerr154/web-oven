// XRD figure geometry → drawing primitives.
// Extracted verbatim from xrd-plotter.tsx (Phase A). No logic changes.

import { PRINT_LAYOUT, clamp01, niceStep, textWidth, type Layout, type Prim } from "@/lib/plot/core";

export type Trace = {
    id: string;
    label: string;
    fileName: string;
    color: string;
    x: number[];
    y: number[];
    peak2Theta: number;
    peakIntensity: number;
    /**
     * Inactive traces stay loaded but are excluded from the figure, the legend,
     * exports and phase scoring. Off means off everywhere — a scan that is not
     * on the plot must not silently reappear in the agreement table.
     */
    visible: boolean;
};

export type Reference = {
    id: string;
    fileName: string;
    formula: string;
    spacegroup: string;
    volume: number;
    wavelength: number;
    peaks: { two_theta: number; intensity: number; hkl: number[] }[];
    visible: boolean;
};

export type Overlay = {
    matchedRefX: number[];
    /** Peaks the reference could not explain, with their relative intensity */
    unexplained: { x: number; i: number }[];
    traceIndex: number;
} | null;

export function buildFigure(
    traces: Trace[],
    lo: number,
    hi: number,
    gap: number,
    stacked: boolean,
    reference: Reference | null,
    overlay: Overlay = null,
    L: Layout = PRINT_LAYOUT,
    /**
     * Legend membership. The on-screen legend must list EVERY trace at a stable
     * vertical slot, otherwise hiding a trace collapses its row and every entry
     * below it walks up — the next click then toggles the wrong series.
     * Exports pass nothing and keep the tighter "only what is plotted" legend.
     */
    legendTraces?: Trace[],
    /**
     * Manual legend placement, as a fraction of the reachable area. Null means
     * automatic corner selection. Exports receive the same value, so a figure
     * you dragged the legend on comes out with the legend where you left it.
     */
    legendPos: { fx: number; fy: number } | null = null,
): Prim[] {
    const out: Prim[] = [];
    const { W, H, M } = L;
    const PW = W - M.l - M.r;
    const PH = H - M.t - M.b;

    // Intensity scaling
    const globalMax = Math.max(...traces.map((t) => Math.max(...t.y)), 1);

    const n = traces.length;
    const step = stacked ? gap : 0;
    const hasRef = !!reference && reference.visible && reference.peaks.length > 0;

    // A reference stick panel takes the bottom strip, so the traces have to sit
    // higher. Solve for the baseline that guarantees a fixed pixel gap between
    // the stick labels and the lowest trace, whatever the trace count.
    const A = Math.max(0, n - 1) * step + 1.18;
    const PAD_PX = L.showHkl ? 62 : 34;
    const base0 = hasRef
        ? (0.40 + (PAD_PX * A) / PH) / (1 - PAD_PX / PH)
        : 0.52;
    const top = base0 + A;

    const Y = (v: number) => M.t + PH - (v / top) * PH;
    const X = (v: number) => M.l + ((v - lo) / (hi - lo)) * PW;

    // Background + frame
    out.push({ t: "rect", x: 0, y: 0, w: W, h: H, stroke: "none", sw: 0, fill: "#ffffff" });
    out.push({ t: "rect", x: M.l, y: M.t, w: PW, h: PH, stroke: "#111827", sw: 1.1 });

    // X ticks — step follows the visible span so a zoomed window stays labelled.
    // Labels get decimals once the step drops below 1°, otherwise a 0.5° step
    // would print 20, 20, 21, 21 and read as broken.
    const span = hi - lo;
    const majorX = niceStep(span);
    const minorX = majorX / 5;
    const decimals = majorX >= 1 ? 0 : majorX >= 0.1 ? 1 : 2;
    // Offset traces on a zoomed window can carry 3+ digit labels; skip a label
    // rather than let two of them collide.
    let lastLabelX = -1e9;
    for (let v = Math.ceil(lo / minorX) * minorX; v <= hi + 1e-6; v += minorX) {
        const px = X(v);
        // Floating point drift on repeated addition: snap the multiple test.
        const isMajor = Math.abs(v / majorX - Math.round(v / majorX)) < 1e-6;
        const len = isMajor ? 7 : 4;
        out.push({ t: "line", x1: px, y1: M.t + PH, x2: px, y2: M.t + PH - len, stroke: "#111827", w: 1 });
        if (isMajor) {
            const label = v.toFixed(decimals);
            const approxW = label.length * L.tickFont * 0.58 + 6;
            if (px - approxW / 2 < lastLabelX) continue;
            lastLabelX = px + approxW / 2;
            out.push({
                t: "text", x: px, y: M.t + PH + 9, s: label, size: L.tickFont,
                anchor: "middle", baseline: "top", fill: "#111827",
            });
        }
    }

    // Y ticks (unlabelled — offset traces have arbitrary intensity)
    for (let g = 0; g <= 6; g++) {
        const py = M.t + PH - (g / 6) * PH;
        out.push({ t: "line", x1: M.l, y1: py, x2: M.l + 7, y2: py, stroke: "#111827", w: 1 });
        out.push({ t: "line", x1: M.l + PW, y1: py, x2: M.l + PW - 7, y2: py, stroke: "#111827", w: 1 });
    }

    // Axis titles
    out.push({
        t: "text", x: M.l + PW / 2, y: H - 24, s: "2\u03B8 (\u00B0)", size: L.titleFont,
        weight: 600, anchor: "middle", baseline: "alphabetic", fill: "#111827",
    });
    out.push({
        t: "text", x: 24, y: M.t + PH / 2, s: "Intensity (a.u.)", size: L.titleFont,
        weight: 600, anchor: "middle", baseline: "alphabetic", fill: "#111827", rotate: -90,
    });

    // Reference pattern (simulated from the CIF) — sticks along the bottom strip
    if (hasRef && reference) {
        const REF_BASE = 0.06;
        const REF_H = 0.30;
        const REF_TOP = REF_BASE + REF_H;
        const maxI = Math.max(...reference.peaks.map((p) => p.intensity), 1);

        out.push({
            t: "line", x1: M.l, y1: Y(REF_BASE), x2: M.l + PW, y2: Y(REF_BASE),
            stroke: "#9CA3AF", w: 0.9,
        });

        const inWindow = reference.peaks.filter(
            (p) => p.two_theta >= lo && p.two_theta <= hi,
        );

        const matchedKeys = overlay
            ? new Set(overlay.matchedRefX.map((x) => x.toFixed(3)))
            : null;

        for (const p of inWindow) {
            const h = (p.intensity / maxI) * REF_H;
            if (h < 0.002) continue;
            const px = X(p.two_theta);
            const hit = matchedKeys?.has(p.two_theta.toFixed(3)) ?? false;
            out.push({
                t: "line", x1: px, y1: Y(REF_BASE), x2: px, y2: Y(REF_BASE + h),
                stroke: hit ? "#059669" : "#334155",
                w: hit ? 2.0 : 1.1,
            });
        }

        // Label the strongest reflections. A ratio floor is wrong for MOFs:
        // the (100) reflection can hold 100% while the next sits at 20%, so
        // take the top N by intensity and drop any that would collide.
        const strong = [...inWindow]
            .sort((a, b) => b.intensity - a.intensity)
            .slice(0, 10)
            .sort((a, b) => a.two_theta - b.two_theta);

        let lastX = -1e9;
        for (const p of L.showHkl ? strong : []) {
            const px = X(p.two_theta);
            if (px - lastX < 13) continue;
            lastX = px;
            out.push({
                t: "text", x: px, y: Y(REF_TOP + 0.03),
                s: `(${p.hkl.join(" ")})`, size: L.hklFont,
                anchor: "start", baseline: "alphabetic",
                fill: "#475569", rotate: -90,
            });
        }
    }

    // Traces — index 0 plots at the TOP, so list order == visual order everywhere
    traces.forEach((t, i) => {
        const base = base0 + (stacked ? (n - 1 - i) * step : 0);
        const scale = stacked ? (Math.max(...t.y) || 1) : globalMax;
        const pts: Array<[number, number]> = [];
        for (let k = 0; k < t.x.length; k++) {
            const xv = t.x[k];
            if (xv < lo || xv > hi) continue;
            pts.push([X(xv), Y(base + t.y[k] / scale)]);
        }
        if (pts.length > 1) out.push({ t: "poly", pts, stroke: t.color, w: 1.15 });
    });

    // Markers under the selected trace for peaks the reference cannot explain
    if (overlay && overlay.traceIndex >= 0 && overlay.traceIndex < n) {
        const base = base0 + (stacked ? (n - 1 - overlay.traceIndex) * step : 0);
        for (const u of overlay.unexplained) {
            if (u.x < lo || u.x > hi) continue;
            const px = X(u.x);
            // Float the marker just above the offending peak's own tip
            const my = Y(base + u.i / 100) - 13;
            out.push({ t: "line", x1: px - 3, y1: my - 3, x2: px + 3, y2: my + 3, stroke: "#DC2626", w: 1.3 });
            out.push({ t: "line", x1: px - 3, y1: my + 3, x2: px + 3, y2: my - 3, stroke: "#DC2626", w: 1.3 });
        }
    }

    // ── In-plot legend ──────────────────────────────────────────────────
    // Three problems this has to solve at once:
    //   1. No backing panel, so curves show straight through the text.
    //   2. Fixed top-right anchor, so with enough traces it lands on data.
    //   3. One column only, so 8 traces occupy 31 % of the plot height.
    // The layout is computed first (entries, columns, rect), then the panel is
    // painted, then the rows. Every row records its own hit rect so the click
    // handler never has to re-derive this geometry.
    const legendList = legendTraces ?? traces;
    const legendEntries = [
        ...legendList.map((t, i) => ({
            id: t.id,
            label: t.label,
            color: t.color,
            opacity: t.visible ? 1 : 0.35,
            index: i,
            isRef: false,
        })),
        ...(hasRef && reference
            ? [{
                id: "__reference__",
                label: `Simulated · ${reference.formula}`,
                color: "#334155",
                opacity: 1,
                index: legendList.length,
                isRef: true,
            }]
            : []),
    ];

    if (L.legendInPlot && legendEntries.length > 0) {
        const SWATCH = 18;          // line length before the text
        const GAP = 6;              // swatch → text
        const PAD_X = 7;            // panel inner padding, left and right
        const PAD_Y = 5;
        const ROW_H = Math.round(L.legendFont + 4.5); // 17 px at 12.5 pt
        const COL_GAP = 14;

        const textW = legendEntries.map((e) => textWidth(e.label, L.legendFont));
        const rowW = textW.map((w) => SWATCH + GAP + w);

        // Two columns once a single column would eat more than a quarter of the
        // plot height. Below that, one column reads better.
        const singleColH = legendEntries.length * ROW_H + PAD_Y * 2;
        const budgetH = PH * 0.25;
        const cols = singleColH > budgetH && legendEntries.length > 4 ? 2 : 1;
        const rowsPerCol = Math.ceil(legendEntries.length / cols);

        // Per-column width, so a long label does not force the short column wide.
        const colW: number[] = [];
        for (let c = 0; c < cols; c++) {
            let w = 0;
            for (let i = c * rowsPerCol; i < Math.min((c + 1) * rowsPerCol, legendEntries.length); i++) {
                if (rowW[i] > w) w = rowW[i];
            }
            colW.push(w);
        }
        const panelW = colW.reduce((a, b) => a + b, 0) + COL_GAP * (cols - 1) + PAD_X * 2;
        const panelH = rowsPerCol * ROW_H + PAD_Y * 2;

        // Never let the panel exceed the plot box; clamp is a last resort that
        // only triggers on pathological label lengths.
        const maxPanelW = PW - 8;
        const panelWClamped = Math.min(panelW, maxPanelW);

        // ── Placement ──
        // Reachable range for the panel origin: the plot inset by 2 px on each
        // side, minus the panel's own size.
        const minX = M.l + 2, maxX = M.l + PW - panelWClamped - 2;
        const minY = M.t + 2, maxY = M.t + PH - panelH - 2;

        let panelX: number;
        let panelY: number;

        if (legendPos) {
            // Manual placement. The fraction is mapped onto the reachable range
            // for THIS layout, so a position chosen on a wide canvas still lands
            // inside a narrow one, and the same fraction reproduces the position
            // in the print geometry.
            panelX = minX + clamp01(legendPos.fx) * (maxX - minX);
            panelY = minY + clamp01(legendPos.fy) * (maxY - minY);
        } else {
            // Automatic: sample the four corners and take the emptiest. Ties go
            // top-right, which is where the legend has always been.
            const candidates: { x: number; y: number }[] = [
                { x: maxX, y: minY }, // top-right
                { x: minX, y: minY }, // top-left
                { x: maxX, y: maxY }, // bottom-right
                { x: minX, y: maxY }, // bottom-left
            ];
            // A cheap occupancy test: for each trace, count how many of its
            // points fall inside the candidate box. The curve occupies the box
            // only where its own x/y lands there, so this asks the same question
            // the eye asks. Sampling every 12th point keeps it to a few thousand
            // compares.
            const occupancy = candidates.map((c) => {
                let hits = 0;
                traces.forEach((t, i) => {
                    const scale = stacked ? (Math.max(...t.y) || 1) : globalMax;
                    const base = base0 + (stacked ? (n - 1 - i) * step : 0);
                    for (let k = 0; k < t.x.length; k += 12) {
                        const xv = t.x[k];
                        if (xv < lo || xv > hi) continue;
                        const px = X(xv);
                        if (px < c.x || px > c.x + panelWClamped) continue;
                        const py = Y(base + t.y[k] / scale);
                        if (py < c.y || py > c.y + panelH) continue;
                        hits++;
                    }
                });
                return hits;
            });
            let best = 0;
            for (let i = 1; i < candidates.length; i++) {
                if (occupancy[i] < occupancy[best]) best = i;
            }
            panelX = candidates[best].x;
            panelY = candidates[best].y;
        }

        // Final guard: never paint outside the plot, whatever the fraction says.
        panelX = Math.max(minX, Math.min(panelX, maxX));
        panelY = Math.max(minY, Math.min(panelY, maxY));

        // ── Backing panel ──
        // Opaque enough that curves behind it read as a faint ghost rather than
        // striking through the labels, translucent enough that the reader can
        // see there is data underneath and the legend is not a plot area.
        out.push({
            t: "rect", x: panelX, y: panelY, w: panelWClamped, h: panelH,
            stroke: "#CBD5E1", sw: 0.8, fill: "#FFFFFF", opacity: 0.93, rx: 3,
            data: { legendPanel: { x: panelX, y: panelY, w: panelWClamped, h: panelH } },
        });

        // ── Rows ──
        let colX = panelX + PAD_X;
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rowsPerCol; r++) {
                const idx = c * rowsPerCol + r;
                const e = legendEntries[idx];
                if (!e) continue;
                const rowY = panelY + PAD_Y + r * ROW_H;
                const cy = rowY + ROW_H / 2;

                if (e.isRef) {
                    // Vertical tick, matching the stick pattern's mark
                    out.push({
                        t: "line", x1: colX + 6, y1: cy - 5, x2: colX + 6, y2: cy + 5,
                        stroke: e.color, w: 1.2, opacity: e.opacity,
                    });
                } else {
                    out.push({
                        t: "line", x1: colX, y1: cy, x2: colX + SWATCH, y2: cy,
                        stroke: e.color, w: 2, opacity: e.opacity,
                    });
                }
                out.push({
                    t: "text",
                    x: colX + SWATCH + GAP,
                    y: cy + 0.5,
                    s: e.label,
                    size: L.legendFont,
                    anchor: "start",
                    baseline: "middle",
                    fill: "#1F2937",
                    opacity: e.opacity,
                    data: e.isRef
                        ? undefined
                        : {
                            traceId: e.id,
                            legendIndex: e.index,
                            // The whole row is the target, full panel width of
                            // its column: a 12 px-tall text line is a poor tap
                            // target on a phone.
                            hitRect: { x: colX, y: rowY, w: colW[c], h: ROW_H },
                        },
                });
            }
            colX += colW[c] + COL_GAP;
        }
    }

    return out;
}
