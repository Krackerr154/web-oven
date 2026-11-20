// Shared plotting primitives, layout and exporters.
// Extracted verbatim from xrd-plotter.tsx (Phase A). No logic changes.

export type Prim =
    | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; w: number; opacity?: number; dash?: number[] }
    | {
        t: "rect"; x: number; y: number; w: number; h: number; stroke: string; sw: number; fill?: string;
        opacity?: number; rx?: number;
        /** Set on the legend backing panel so the drag/drop hit test can find it. */
        data?: { legendPanel?: { x: number; y: number; w: number; h: number } };
    }
    | { t: "poly"; pts: Array<[number, number]>; stroke: string; w: number; dash?: number[] }
    | {
        t: "text"; x: number; y: number; s: string; size: number; weight?: number;
        anchor?: "start" | "middle" | "end"; baseline?: "top" | "middle" | "bottom" | "alphabetic";
        fill: string; rotate?: number; opacity?: number;
        data?: {
            traceId?: string;
            legendIndex?: number;
            /**
             * The full clickable rectangle for this legend row, in canvas
             * coordinates. The painter is the only thing that knows where a row
             * actually landed (corner choice, column, row height), so it records
             * the rect here and the hit test reads it back. Recomputing legend
             * geometry in the click handler is how the two drift apart.
             */
            hitRect?: { x: number; y: number; w: number; h: number };
        };
    };

/**
 * Advance width of a label in the plotting font.
 *
 * Factors are Helvetica AFM advance widths per 1000 em, rounded up where the
 * stack substitute (DejaVu/Liberation) is wider. They are deliberately biased
 * wide: this sizes the legend panel, so an over-estimate leaves a little margin
 * while an under-estimate clips the label. Verified against the AFM table — the
 * only characters that were under-counted were W (0.944) and ° (0.400), both
 * corrected here.
 *
 * `measureText` cannot be used directly: buildFigure also runs for SVG export,
 * where there is no canvas to measure with.
 */
export function textWidth(s: string, size: number): number {
    let w = 0;
    for (const ch of s) {
        if (ch === " ") w += 0.28;
        else if (ch === "W") w += 0.95;
        else if (ch === "°") w += 0.42;
        else if ("iljI.,:;'|!".includes(ch)) w += 0.26;
        else if ("ftr()[]-".includes(ch)) w += 0.36;
        else if ("mwM".includes(ch)) w += 0.86;
        else if (ch >= "0" && ch <= "9") w += 0.556;
        else if (ch >= "A" && ch <= "Z") w += 0.70;
        else if (ch === "·") w += 0.35;
        else w += 0.56;
    }
    return w * size;
}

export const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/**
 * Snap a legend fraction to whichever corner is within `tol` of it.
 *
 * Distance is measured in context px, not fraction units, because the reachable
 * range differs per axis: 6 % of a 790 px-wide range is 47 px but 6 % of a
 * 451 px-tall one is 27 px, so a single fractional tolerance would snap eagerly
 * on one axis and never on the other.
 */
export function snapLegendPos(
    pos: { fx: number; fy: number },
    spanX: number,
    spanY: number,
    tol = 26,
): { fx: number; fy: number } {
    const corners: Array<{ fx: number; fy: number }> = [
        { fx: 0, fy: 0 }, { fx: 1, fy: 0 },
        { fx: 0, fy: 1 }, { fx: 1, fy: 1 },
    ];
    let best = pos;
    let bestD = Infinity;
    for (const c of corners) {
        const dx = (pos.fx - c.fx) * spanX;
        const dy = (pos.fy - c.fy) * spanY;
        const d = Math.hypot(dx, dy);
        if (d < tol && d < bestD) {
            bestD = d;
            best = c;
        }
    }
    return best;
}

export const PALETTE = [
    // Slot 1 used to be #0F172A, which is 2/1/3 RGB away from the axis frame
    // (#111827) — the trace read as part of the border. No entry may sit within
    // ~60 RGB units of the frame colour.
    "#1D4ED8", "#C2410C", "#0E7490", "#4D7C0F",
    "#7C3AED", "#BE123C", "#A21CAF", "#B45309",
];

/**
 * Drawing geometry. The screen never scales a fixed canvas: it re-lays out at
 * the measured container width so type stays at a readable CSS size
 * (ONS guidance: 14px minimum for chart text, 12px at the very smallest).
 * The print layout stays fixed so exports are identical from any screen.
 */
export type Layout = {
    W: number;
    H: number;
    M: { l: number; r: number; t: number; b: number };
    tickFont: number;
    titleFont: number;
    legendFont: number;
    hklFont: number;
    legendInPlot: boolean;
    showHkl: boolean;
};

/**
 * Major tick step for a 2θ span, on a 1-2-5 progression.
 *
 * A fixed 10° step is only correct on a full 5–80° pattern. Once the plot can
 * be zoomed, a 15° window holding one labelled tick reads as an unlabelled
 * axis. The step is chosen so roughly `target` majors land on the axis,
 * whatever the span.
 */
export function niceStep(span: number, target = 8): number {
    if (!Number.isFinite(span) || span <= 0) return 10;
    const raw = span / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return mult * mag;
}

export const PRINT_LAYOUT: Layout = {
    W: 1210,
    H: 760,
    M: { l: 86, r: 30, t: 34, b: 88 },
    tickFont: 13,
    titleFont: 15,
    legendFont: 12,
    hklFont: 9.5,
    legendInPlot: true,
    showHkl: true,
};

/** Screen geometry for a container of cssW pixels. Type never drops below 11px. */
export function screenLayout(cssW: number): Layout {
    const w = Math.max(280, Math.round(cssW));
    if (w >= 840) {
        return {
            W: w, H: Math.round(w * 0.62),
            M: { l: 78, r: 24, t: 26, b: 76 },
            tickFont: 14, titleFont: 15, legendFont: 12.5, hklFont: 10,
            legendInPlot: true, showHkl: true,
        };
    }
    if (w >= 560) {
        return {
            W: w, H: Math.round(w * 0.66),
            M: { l: 62, r: 16, t: 22, b: 70 },
            tickFont: 12, titleFont: 13, legendFont: 11.5, hklFont: 9,
            legendInPlot: true, showHkl: true,
        };
    }
    return {
        W: w, H: Math.round(w * 0.92),
        M: { l: 46, r: 12, t: 16, b: 58 },
        tickFont: 11.5, titleFont: 12, legendFont: 11, hklFont: 0,
        legendInPlot: false, showHkl: false,
    };
}

export function paintCanvas(
    canvas: HTMLCanvasElement,
    prims: Prim[],
    W: number,
    H: number,
    scale: number,
) {
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, W, H);

    for (const p of prims) {
        if (p.t === "rect") {
            ctx.globalAlpha = p.opacity ?? 1;
            ctx.fillStyle = p.fill ?? "transparent";
            ctx.strokeStyle = p.stroke;
            ctx.lineWidth = p.sw;
            if (p.fill) {
                ctx.beginPath();
                // roundRect keeps the legend panel from reading as a plot frame
                if (p.rx) ctx.roundRect(p.x, p.y, p.w, p.h, p.rx);
                else ctx.rect(p.x, p.y, p.w, p.h);
                ctx.fill();
            }
            if (p.stroke !== "none" && p.sw > 0) {
                ctx.beginPath();
                if (p.rx) ctx.roundRect(p.x, p.y, p.w, p.h, p.rx);
                else ctx.rect(p.x, p.y, p.w, p.h);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        } else if (p.t === "line") {
            ctx.globalAlpha = p.opacity ?? 1;
            ctx.beginPath();
            ctx.strokeStyle = p.stroke;
            ctx.lineWidth = p.w;
            if (p.dash) ctx.setLineDash(p.dash);
            ctx.moveTo(p.x1, p.y1);
            ctx.lineTo(p.x2, p.y2);
            ctx.stroke();
            if (p.dash) ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        } else if (p.t === "poly") {
            ctx.beginPath();
            ctx.strokeStyle = p.stroke;
            ctx.lineWidth = p.w;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            if (p.dash) ctx.setLineDash(p.dash);
            p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
            if (p.dash) ctx.setLineDash([]);
        } else {
            ctx.save();
            ctx.globalAlpha = p.opacity ?? 1;
            ctx.fillStyle = p.fill;
            ctx.font = `${p.weight ?? 400} ${p.size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
            ctx.textAlign = p.anchor === "middle" ? "center" : p.anchor === "end" ? "right" : "left";
            ctx.textBaseline =
                p.baseline === "top" ? "top" : p.baseline === "middle" ? "middle"
                    : p.baseline === "bottom" ? "alphabetic" : "alphabetic";
            if (p.rotate) {
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotate * Math.PI) / 180);
                ctx.fillText(p.s, 0, 0);
            } else {
                ctx.fillText(p.s, p.x, p.y);
            }
            ctx.restore();
        }
    }
}

export function toSVG(prims: Prim[], W: number, H: number) {
    const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const body = prims.map((p) => {
        if (p.t === "rect") {
            const op = p.opacity !== undefined && p.opacity < 1 ? ` fill-opacity="${p.opacity}"` : "";
            const rx = p.rx ? ` rx="${p.rx}"` : "";
            return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.fill ?? "none"}" stroke="${p.stroke}" stroke-width="${p.sw}"${op}${rx} />`;
        }
        if (p.t === "line") {
            const dash = "dash" in p && p.dash ? ` stroke-dasharray="${p.dash.join(" ")}"` : "";
            return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${p.stroke}" stroke-width="${p.w}"${dash} />`;
        }
        if (p.t === "poly") {
            const d = p.pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
            const dash = "dash" in p && p.dash ? ` stroke-dasharray="${p.dash.join(" ")}"` : "";
            return `<path d="${d}" fill="none" stroke="${p.stroke}" stroke-width="${p.w}" stroke-linejoin="round" stroke-linecap="round"${dash} />`;
        }
        const anchor = p.anchor === "middle" ? "middle" : p.anchor === "end" ? "end" : "start";
        const base =
            p.baseline === "top" ? "hanging" : p.baseline === "middle" ? "central" : "auto";
        const transform = p.rotate
            ? ` transform="rotate(${p.rotate} ${p.x} ${p.y})"`
            : "";
        return `<text x="${p.x}" y="${p.y}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="${p.size}" font-weight="${p.weight ?? 400}" fill="${p.fill}" text-anchor="${anchor}" dominant-baseline="${base}"${transform}>${esc(p.s)}</text>`;
    }).join("\n  ");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${body}
</svg>`;
}
