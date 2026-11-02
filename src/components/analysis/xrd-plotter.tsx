"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import { detectPeaks, matchPhase, type Peak } from "@/lib/xrd/phase-match";
import { PhaseMatchPanel, type ScanMatch } from "@/components/analysis/phase-match-panel";
import {
    Upload, X, Download, FileText, Image as ImageIcon, Loader2, GripVertical, Eye, EyeOff, FlaskConical,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */

type Trace = {
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

type Prim =
    | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; w: number }
    | { t: "rect"; x: number; y: number; w: number; h: number; stroke: string; sw: number; fill?: string }
    | { t: "poly"; pts: Array<[number, number]>; stroke: string; w: number }
    | {
        t: "text"; x: number; y: number; s: string; size: number; weight?: number;
        anchor?: "start" | "middle" | "end"; baseline?: "top" | "middle" | "bottom" | "alphabetic";
        fill: string; rotate?: number;
    };

const PALETTE = [
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
type Layout = {
    W: number;
    H: number;
    M: { l: number; r: number; t: number; b: number };
    xMajor: number;
    xMinor: number;
    tickFont: number;
    titleFont: number;
    legendFont: number;
    hklFont: number;
    legendInPlot: boolean;
    showHkl: boolean;
};

const PRINT_LAYOUT: Layout = {
    W: 1210,
    H: 760,
    M: { l: 86, r: 30, t: 34, b: 88 },
    xMajor: 10,
    xMinor: 2,
    tickFont: 13,
    titleFont: 15,
    legendFont: 12,
    hklFont: 9.5,
    legendInPlot: true,
    showHkl: true,
};

/** Screen geometry for a container of cssW pixels. Type never drops below 11px. */
function screenLayout(cssW: number): Layout {
    const w = Math.max(280, Math.round(cssW));
    if (w >= 840) {
        return {
            W: w, H: Math.round(w * 0.62),
            M: { l: 78, r: 24, t: 26, b: 76 },
            xMajor: 10, xMinor: 2,
            tickFont: 14, titleFont: 15, legendFont: 12.5, hklFont: 10,
            legendInPlot: true, showHkl: true,
        };
    }
    if (w >= 560) {
        return {
            W: w, H: Math.round(w * 0.66),
            M: { l: 62, r: 16, t: 22, b: 70 },
            xMajor: 10, xMinor: 2,
            tickFont: 12, titleFont: 13, legendFont: 11.5, hklFont: 9,
            legendInPlot: true, showHkl: true,
        };
    }
    return {
        W: w, H: Math.round(w * 0.92),
        M: { l: 46, r: 12, t: 16, b: 58 },
        xMajor: 10, xMinor: 5,
        tickFont: 11.5, titleFont: 12, legendFont: 11, hklFont: 0,
        legendInPlot: false, showHkl: false,
    };
}

/* ────────────────────────────────────────────────────────────────────────────
   Parsing — Rigaku .xy / generic two-column text
   ──────────────────────────────────────────────────────────────────────────── */

function parseScan(text: string) {
    const x: number[] = [];
    const y: number[] = [];
    let sample = "";

    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;

        if (line.startsWith("*")) {
            const m = line.match(/^\*FILE_SAMPLE\s+"(.*)"/);
            if (m && m[1].trim()) sample = m[1].trim();
            continue;
        }
        if (line[0] === "#" || line[0] === ";" || line[0] === "!") continue;

        const parts = line.split(/[\s,;\t]+/).filter(Boolean);
        if (parts.length < 2) continue;

        const a = Number(parts[0]);
        const b = Number(parts[1]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;

        x.push(a);
        y.push(b);
    }

    return { x, y, sample };
}

/* ────────────────────────────────────────────────────────────────────────────
   Geometry → drawing primitives (shared by canvas, SVG and PDF)
   ──────────────────────────────────────────────────────────────────────────── */

type Reference = {
    id: string;
    fileName: string;
    formula: string;
    spacegroup: string;
    volume: number;
    wavelength: number;
    peaks: { two_theta: number; intensity: number; hkl: number[] }[];
    visible: boolean;
};

type Overlay = {
    matchedRefX: number[];
    /** Peaks the reference could not explain, with their relative intensity */
    unexplained: { x: number; i: number }[];
    traceIndex: number;
} | null;

function buildFigure(
    traces: Trace[],
    lo: number,
    hi: number,
    gap: number,
    stacked: boolean,
    reference: Reference | null,
    overlay: Overlay = null,
    L: Layout = PRINT_LAYOUT,
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

    // X ticks
    const majorX = L.xMajor;
    const minorX = L.xMinor;
    for (let v = Math.ceil(lo / minorX) * minorX; v <= hi + 1e-6; v += minorX) {
        const isMajor = Math.abs(v % majorX) < 1e-6;
        const px = X(v);
        const len = isMajor ? 7 : 4;
        out.push({ t: "line", x1: px, y1: M.t + PH, x2: px, y2: M.t + PH - len, stroke: "#111827", w: 1 });
        if (isMajor) {
            out.push({
                t: "text", x: px, y: M.t + PH + 9, s: v.toFixed(0), size: L.tickFont,
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

    // In-plot legend — same order as the list and the stack
    const lx = M.l + PW - 244;
    if (L.legendInPlot) traces.forEach((t, i) => {
        const ly = M.t + 18 + i * 17;
        out.push({ t: "line", x1: lx, y1: ly, x2: lx + 18, y2: ly, stroke: t.color, w: 2 });
        out.push({
            t: "text", x: lx + 24, y: ly + 0.5, s: t.label, size: L.legendFont,
            anchor: "start", baseline: "middle", fill: "#1F2937",
        });
    });

    // Legend entry for the simulated reference
    if (L.legendInPlot && hasRef && reference) {
        const ly = M.t + 18 + traces.length * 17;
        out.push({ t: "line", x1: lx + 6, y1: ly - 5, x2: lx + 6, y2: ly + 5, stroke: "#334155", w: 1.2 });
        out.push({
            t: "text", x: lx + 24, y: ly + 0.5, s: `Simulated · ${reference.formula}`, size: L.legendFont,
            anchor: "start", baseline: "middle", fill: "#1F2937",
        });
    }

    return out;
}

/* ────────────────────────────────────────────────────────────────────────────
   Renderers
   ──────────────────────────────────────────────────────────────────────────── */

function paintCanvas(
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
            ctx.fillStyle = p.fill ?? "transparent";
            ctx.strokeStyle = p.stroke;
            ctx.lineWidth = p.sw;
            if (p.fill) ctx.fillRect(p.x, p.y, p.w, p.h);
            if (p.stroke !== "none" && p.sw > 0) ctx.strokeRect(p.x, p.y, p.w, p.h);
        } else if (p.t === "line") {
            ctx.beginPath();
            ctx.strokeStyle = p.stroke;
            ctx.lineWidth = p.w;
            ctx.moveTo(p.x1, p.y1);
            ctx.lineTo(p.x2, p.y2);
            ctx.stroke();
        } else if (p.t === "poly") {
            ctx.beginPath();
            ctx.strokeStyle = p.stroke;
            ctx.lineWidth = p.w;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
        } else {
            ctx.save();
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

function toSVG(prims: Prim[], W: number, H: number) {
    const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const body = prims.map((p) => {
        if (p.t === "rect") {
            return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.fill ?? "none"}" stroke="${p.stroke}" stroke-width="${p.sw}" />`;
        }
        if (p.t === "line") {
            return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${p.stroke}" stroke-width="${p.w}" />`;
        }
        if (p.t === "poly") {
            const d = p.pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
            return `<path d="${d}" fill="none" stroke="${p.stroke}" stroke-width="${p.w}" stroke-linejoin="round" stroke-linecap="round" />`;
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

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export function XrdPlotter() {
    const [traces, setTraces] = useState<Trace[]>([]);
    const [lo, setLo] = useState(5);
    const [hi, setHi] = useState(50);
    // Drafts let a field be empty while typing; committing "" straight to
    // Number() made it 0, which silently inverted the range.
    const [loDraft, setLoDraft] = useState<string | null>(null);
    const [hiDraft, setHiDraft] = useState<string | null>(null);
    const [gap, setGap] = useState(1.15);
    const [stacked, setStacked] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);
    const [reference, setReference] = useState<Reference | null>(null);
    const [refBusy, setRefBusy] = useState(false);
    const [refError, setRefError] = useState<string | null>(null);
    const [matchResults, setMatchResults] = useState<ScanMatch[] | null>(null);
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
    const [matchBusy, setMatchBusy] = useState(false);
    const [matchError, setMatchError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const overlayRef = useRef<HTMLCanvasElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const [hover, setHover] = useState<{
        px: number;
        py: number;
        twoTheta: number;
        rows: { label: string; color: string; counts: number }[];
    } | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [canvasW, setCanvasW] = useState(0);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const cifRef = useRef<HTMLInputElement | null>(null);

    // Everything downstream of the figure works on active traces only.
    const visibleTraces = useMemo(() => traces.filter((t) => t.visible), [traces]);

    // ---- 2θ range guard ---------------------------------------------------
    // An inverted or half-typed range used to render a blank white figure with
    // no explanation. Now the typed value is held in a draft, the figure falls
    // back to the measured extent while the range is unusable, and the panel
    // says so.
    const loParsed = Number(loDraft ?? lo);
    const hiParsed = Number(hiDraft ?? hi);
    const rangeInvalid =
        !Number.isFinite(loParsed) ||
        !Number.isFinite(hiParsed) ||
        hiParsed <= loParsed;

    const dataExtent = useMemo(() => {
        const src = visibleTraces.length ? visibleTraces : traces;
        if (src.length === 0) return { min: 5, max: 80 };
        let min = Infinity;
        let max = -Infinity;
        for (const t of src) {
            if (t.x[0] < min) min = t.x[0];
            const last = t.x[t.x.length - 1];
            if (last > max) max = last;
        }
        return { min, max };
    }, [visibleTraces, traces]);

    const viewLo = rangeInvalid ? dataExtent.min : loParsed;
    const viewHi = rangeInvalid ? dataExtent.max : hiParsed;

    const overlay = useMemo<Overlay>(() => {
        if (!matchResults || !selectedMatchId) return null;
        const idx = visibleTraces.findIndex((t) => t.id === selectedMatchId);
        const sel = matchResults.find((m) => m.traceId === selectedMatchId);
        if (!sel || idx < 0) return null;
        return {
            matchedRefX: sel.result.pairs.map((p) => p.refX),
            unexplained: sel.result.unexplainedExp.map((p) => ({ x: p.x, i: p.i })),
            traceIndex: idx,
        };
    }, [matchResults, selectedMatchId, visibleTraces]);

    // Re-layout at the measured container width: type must not scale with the box.
    const layout = useMemo(() => screenLayout(canvasW || 860), [canvasW]);

    const prims = useMemo(
        () => (visibleTraces.length || reference
            ? buildFigure(visibleTraces, viewLo, viewHi, gap, stacked, reference, overlay, layout)
            : []),
        [visibleTraces, viewLo, viewHi, gap, stacked, reference, overlay, layout],
    );

    // Repaint whenever the figure changes
    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const measure = () => {
            const w = el.getBoundingClientRect().width;
            if (w > 0) setCanvasW(Math.round(w));
        };
        measure();
        // ResizeObserver catches container changes; the window listener is the
        // fallback for environments where RO delivery is deferred or throttled
        // (it rides the rendering tick, which some browsers stall in background
        // tabs). Either firing is enough.
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        window.addEventListener("resize", measure);
        window.addEventListener("orientationchange", measure);
        return () => {
            ro.disconnect();
            window.removeEventListener("resize", measure);
            window.removeEventListener("orientationchange", measure);
        };
    }, [traces.length, reference]);

    const paint = useCallback(() => {
        const c = canvasRef.current;
        if (!c || !prims.length) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        paintCanvas(c, prims, layout.W, layout.H, dpr);
    }, [prims, layout]);

    useEffect(() => {
        paint();
    }, [paint]);

    // ---- cursor readout ---------------------------------------------------
    // Drawn on its own overlay canvas so a pointer move never rebuilds the
    // figure. Only a crosshair and a value box, so this cannot drift out of
    // sync with the stacking maths inside buildFigure.
    const handleHover = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const c = canvasRef.current;
            if (!c || visibleTraces.length === 0) return;
            const rect = c.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const { M, W, H } = layout;
            const PW = W - M.l - M.r;
            const PH = H - M.t - M.b;

            if (cx < M.l || cx > M.l + PW || cy < M.t || cy > M.t + PH) {
                setHover(null);
                return;
            }

            const twoTheta = viewLo + ((cx - M.l) / PW) * (viewHi - viewLo);
            const rows = visibleTraces.map((t) => {
                const idx = nearestIndex(t.x, twoTheta);
                return {
                    label: t.label,
                    color: t.color,
                    counts: idx >= 0 ? t.y[idx] : 0,
                };
            });
            setHover({ px: cx, py: cy, twoTheta, rows });
        },
        [layout, viewLo, viewHi, visibleTraces],
    );

    useEffect(() => {
        const oc = overlayRef.current;
        if (!oc) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        oc.width = Math.round(layout.W * dpr);
        oc.height = Math.round(layout.H * dpr);
        oc.style.width = `${layout.W}px`;
        oc.style.height = `${layout.H}px`;
        const ctx = oc.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, layout.W, layout.H);
        if (!hover) return;

        const { M } = layout;
        const PW = layout.W - M.l - M.r;
        const PH = layout.H - M.t - M.b;

        // crosshair
        ctx.strokeStyle = "rgba(17,24,39,0.35)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hover.px, M.t);
        ctx.lineTo(hover.px, M.t + PH);
        ctx.moveTo(M.l, hover.py);
        ctx.lineTo(M.l + PW, hover.py);
        ctx.stroke();
        ctx.setLineDash([]);

        // value box
        const rowH = 15;
        const boxW = Math.min(214, layout.W - 24);
        const boxH = 24 + hover.rows.length * rowH + 8;
        let bx = hover.px + 14;
        let by = hover.py + 14;
        if (bx + boxW > layout.W - 4) bx = hover.px - boxW - 14;
        if (by + boxH > layout.H - 4) by = layout.H - boxH - 4;
        if (bx < 4) bx = 4;
        if (by < 4) by = 4;

        ctx.fillStyle = "rgba(255,255,255,0.97)";
        ctx.strokeStyle = "#94A3B8";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#111827";
        ctx.font = "600 12px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(`2θ = ${hover.twoTheta.toFixed(2)}°`, bx + 8, by + 16);

        ctx.font = "400 11px system-ui, -apple-system, sans-serif";
        // Ellipsise by measured width, not by character count: renamed traces
        // often share a long prefix and a fixed cut would make them identical.
        const labelMax = boxW - 22 - 76;
        hover.rows.forEach((r, i) => {
            const y = by + 30 + i * rowH;
            ctx.fillStyle = r.color;
            ctx.fillRect(bx + 8, y - 6, 10, 3);
            ctx.fillStyle = "#1F2937";
            let label = r.label;
            if (ctx.measureText(label).width > labelMax) {
                let cut = label.length;
                while (cut > 4 && ctx.measureText(`${label.slice(0, cut)}…`).width > labelMax) {
                    cut--;
                }
                label = `${label.slice(0, cut).trimEnd()}…`;
            }
            ctx.fillText(label, bx + 22, y);
            ctx.textAlign = "right";
            ctx.fillText(Math.round(r.counts).toLocaleString(), bx + boxW - 8, y);
            ctx.textAlign = "left";
        });
    }, [hover, layout, visibleTraces.length]);

    // A readout holds label text copied at hover time; clear it when the traces
    // change so it can never show a name that has since been edited or removed.
    useEffect(() => {
        setHover(null);
    }, [traces]);

    // ---- rename -----------------------------------------------------------
    function startRename(t: Trace) {
        setEditingId(t.id);
        setEditValue(t.label);
    }

    function commitRename() {
        const id = editingId;
        const next = editValue.trim();
        setEditingId(null);
        if (!id || !next) return;
        setTraces((prev) => prev.map((x) => (x.id === id ? { ...x, label: next } : x)));
        // Keep the agreement table in step with the figure.
        setMatchResults((prev) =>
            prev ? prev.map((m) => (m.traceId === id ? { ...m, label: next } : m)) : prev,
        );
    }

    // Reorder by dragging the handle. Window-level listeners so the gesture
    // survives React moving the row's DOM node mid-drag.
    useEffect(() => {
        if (!dragId) return;

        const onMove = (e: PointerEvent) => {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const row = el?.closest("[data-trace-row]") as HTMLElement | null;
            const overId = row?.dataset.traceRow;
            if (!overId || overId === dragId) return;

            setTraces((prev) => {
                const from = prev.findIndex((t) => t.id === dragId);
                const to = prev.findIndex((t) => t.id === overId);
                if (from < 0 || to < 0 || from === to) return prev;
                const next = [...prev];
                const [moved] = next.splice(from, 1);
                next.splice(to, 0, moved);
                return next;
            });
        };

        const end = () => setDragId(null);

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", end);
            window.removeEventListener("pointercancel", end);
        };
    }, [dragId]);

    async function handleFiles(files: FileList | null) {
        if (!files || !files.length) return;
        setError(null);
        setBusy(true);
        const added: Trace[] = [];

        for (const file of Array.from(files).slice(0, 8)) {
            try {
                const text = await file.text();
                const { x, y, sample } = parseScan(text);
                if (x.length < 10) {
                    setError(`${file.name}: only ${x.length} numeric rows found — is this a two-column scan?`);
                    continue;
                }
                let peakIdx = 0;
                for (let i = 1; i < y.length; i++) if (y[i] > y[peakIdx]) peakIdx = i;

                added.push({
                    id: `${file.name}-${Date.now()}-${added.length}`,
                    label: sample || file.name.replace(/\.[^.]+$/, ""),
                    fileName: file.name,
                    color: PALETTE[added.length % PALETTE.length],
                    x, y,
                    peak2Theta: x[peakIdx],
                    peakIntensity: y[peakIdx],
                    visible: true,
                });
            } catch {
                setError(`${file.name}: could not be read`);
            }
        }

        if (added.length) {
            setTraces((prev) => {
                const next = [...prev, ...added].slice(0, 8);
                const min = Math.min(...next.map((t) => t.x[0]));
                const max = Math.max(...next.map((t) => t.x[t.x.length - 1]));
                setLo(Math.max(0, Math.floor(min / 5) * 5));
                setHi(Math.ceil(max / 5) * 5);
                return next;
            });
        }
        setBusy(false);
        if (fileRef.current) fileRef.current.value = "";
    }

    function runMatch() {
        if (!reference || traces.length === 0) return;
        setMatchError(null);
        setMatchBusy(true);
        try {
            const refPeaks: Peak[] = reference.peaks.map((p) => ({
                x: p.two_theta,
                y: p.intensity,
                i: p.intensity,
                hkl: p.hkl,
            }));

            const out: ScanMatch[] = [];
            for (const t of visibleTraces) {
                const peaks = detectPeaks(t.x, t.y);
                if (peaks.length < 3) continue;
                // Compare only where this scan actually has data AND is visible.
                const from = Math.max(viewLo, t.x[0]);
                const to = Math.min(viewHi, t.x[t.x.length - 1]);
                if (to - from < 5) continue;
                const res = matchPhase(peaks, refPeaks, { range: [from, to] });
                if (res) {
                    out.push({ traceId: t.id, label: t.label, color: t.color, result: res });
                }
            }

            if (out.length === 0) {
                setMatchError("No scan produced enough detected peaks to score.");
                return;
            }
            setMatchResults(out);
            setSelectedMatchId((prev) =>
                prev && out.some((o) => o.traceId === prev)
                    ? prev
                    : [...out].sort((a, b) => b.result.score - a.result.score)[0].traceId,
            );
        } catch {
            setMatchError("Scoring failed unexpectedly.");
        } finally {
            setMatchBusy(false);
        }
    }

    async function handleCif(files: FileList | null) {
        const file = files?.[0];
        if (!file) return;
        setRefError(null);
        setRefBusy(true);
        try {
            const text = await file.text();
            if (!/data_/i.test(text)) {
                setRefError(`${file.name}: this does not look like a CIF file`);
                return;
            }

            // Always simulate the full 5-80 window so widening the 2-theta
            // range later does not need another round trip.
            const res = await fetch("/api/xrd/simulate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cif: text, twoThetaMin: 5, twoThetaMax: 80 }),
            });
            const payload = await res.json().catch(() => null);

            if (!res.ok) {
                setRefError(payload?.error ?? `Simulating failed (${res.status})`);
                return;
            }
            if (!payload?.peaks?.length) {
                setRefError("No reflections came back for this structure");
                return;
            }

            setReference({
                id: `${file.name}-${Date.now()}`,
                fileName: file.name,
                formula: payload.formula ?? "unknown",
                spacegroup: payload.spacegroup ?? "unknown",
                volume: payload.volume ?? 0,
                wavelength: payload.wavelength ?? 1.5406,
                peaks: payload.peaks,
                visible: true,
            });

            if (traces.length === 0) {
                const first = payload.peaks[0].two_theta as number;
                const last = payload.peaks[payload.peaks.length - 1].two_theta as number;
                setLo(Math.max(0, Math.floor(first / 5) * 5));
                setHi(Math.ceil(last / 5) * 5);
            }
        } catch {
            setRefError("Could not reach the simulator");
        } finally {
            setRefBusy(false);
            if (cifRef.current) cifRef.current.value = "";
        }
    }

    function exportPNG() {
        const cv = document.createElement("canvas");
        // Print geometry, never the on-screen one — a phone window must not
        // produce a phone-sized figure.
        paintCanvas(cv, buildFigure(visibleTraces, viewLo, viewHi, gap, stacked, reference, overlay, PRINT_LAYOUT),
            PRINT_LAYOUT.W, PRINT_LAYOUT.H, 2.6);
        const a = document.createElement("a");
        a.href = cv.toDataURL("image/png");
        a.download = `AP-Lab_XRD_${stamp()}.png`;
        a.click();
    }

    function exportSVG() {
        const svg = toSVG(
            buildFigure(visibleTraces, viewLo, viewHi, gap, stacked, reference, overlay, PRINT_LAYOUT),
            PRINT_LAYOUT.W,
            PRINT_LAYOUT.H,
        );
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `AP-Lab_XRD_${stamp()}.svg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    function exportPDF() {
        const cv = document.createElement("canvas");
        paintCanvas(cv, buildFigure(visibleTraces, viewLo, viewHi, gap, stacked, reference, overlay, PRINT_LAYOUT),
            PRINT_LAYOUT.W, PRINT_LAYOUT.H, 2.6);
        const img = cv.toDataURL("image/png");
        const widthMM = 85;
        const heightMM = (widthMM * PRINT_LAYOUT.H) / PRINT_LAYOUT.W;
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [widthMM, heightMM] });
        pdf.addImage(img, "PNG", 0, 0, widthMM, heightMM);
        pdf.save(`AP-Lab_XRD_${stamp()}.pdf`);
    }

    function exportCSV() {
        const blocks = traces.map((t) => {
            const rows = t.x
                .map((xv, i) => (xv >= viewLo && xv <= viewHi ? `${xv},${t.y[i]}` : null))
                .filter(Boolean)
                .join("\n");
            return `# trace: ${t.label}\n# file: ${t.fileName}\n2theta,intensity\n${rows}`;
        });
        const blob = new Blob([blocks.join("\n\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `AP-Lab_XRD_${stamp()}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    const empty = traces.length === 0 && !reference;
    // Nothing on the figure: every scan hidden and no reference to show either.
    const nothingVisible = visibleTraces.length === 0 && !reference?.visible;

    return (
        <div className="space-y-5">
            {error && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] gap-5 items-start">
                {/* ── Plot stage ─────────────────────────────────────── */}
                <div
                    className="rounded-xl bg-white p-4 shadow-xl shadow-black/40 relative"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        handleFiles(e.dataTransfer.files);
                    }}
                >
                    <div ref={wrapRef} className="w-full relative">
                        {empty ? (
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="w-full h-[380px] rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-3 text-slate-500 hover:border-orange-400 hover:text-orange-500 transition-colors"
                            >
                                {busy ? (
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                ) : (
                                    <Upload className="h-8 w-8" />
                                )}
                                <span className="text-sm font-semibold">Drop .xy scans here</span>
                                <span className="text-xs text-center px-4">
                                    Rigaku / Bruker / PANalytical two-column exports · up to 8 traces
                                </span>
                            </button>
                        ) : (
                            <>
                                <canvas
                                    ref={canvasRef}
                                    className="block max-w-full cursor-crosshair"
                                    onPointerMove={handleHover}
                                    onPointerDown={handleHover}
                                    onPointerLeave={() => setHover(null)}
                                />
                                <canvas
                                    ref={overlayRef}
                                    aria-hidden="true"
                                    className="absolute left-0 top-0 pointer-events-none"
                                />
                            </>
                        )}
                    </div>

                    {/* On narrow screens the legend leaves the figure and becomes
                        real DOM text, which stays crisp at any pixel density. */}
                    {!empty && !layout.legendInPlot && (
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                            {visibleTraces.map((t) => (
                                <button
                                    key={`leg-${t.id}`}
                                    type="button"
                                    onClick={() =>
                                        setTraces((p) =>
                                            p.map((x) => (x.id === t.id ? { ...x, visible: !x.visible } : x)),
                                        )
                                    }
                                    title={`Hide ${t.label}`}
                                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 hover:text-slate-900"
                                >
                                    <span className="h-[3px] w-4 rounded-full shrink-0" style={{ background: t.color }} />
                                    <span className="truncate max-w-[190px]">{t.label}</span>
                                </button>
                            ))}
                            {reference?.visible && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-700">
                                    <span className="h-3 w-[2px] rounded bg-slate-500 shrink-0" />
                                    <span className="truncate max-w-[190px]">Simulated · {reference.formula}</span>
                                </span>
                            )}
                        </div>
                    )}

                    {!empty && visibleTraces.length === 0 && !reference?.visible && (
                        <p className="mt-3 text-[11px] text-slate-500">
                            All scans are hidden. Click an eye in the list to bring one back — nothing
                            was unloaded.
                        </p>
                    )}
                </div>

                {/* ── Settings ───────────────────────────────────────── */}
                <aside
                    className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-4 xl:max-h-[var(--plot-h)] xl:overflow-y-auto xl:sticky xl:top-4"
                    style={{ "--plot-h": `${layout.H + 32}px` } as React.CSSProperties}
                >
                    <div>
                        <div className="flex items-baseline justify-between mb-3">
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                                Data
                            </h3>
                            {traces.length > 0 && (
                                <span className="text-[10px] font-mono text-slate-500">
                                    {visibleTraces.length} of {traces.length} active
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-500 px-3 py-2 text-xs font-bold text-white transition-colors"
                        >
                            <Upload className="h-3.5 w-3.5" /> Add scan
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".xy,.xye,.dat,.txt,.csv"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />
                        {traces.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setTraces([])}
                                className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
                            >
                                <X className="h-3.5 w-3.5" /> Clear all
                            </button>
                        )}
                    </div>

                    {traces.map((t) => (
                        <div
                            key={t.id}
                            data-trace-row={t.id}
                            className={`flex items-center gap-1.5 text-[11px] rounded-md px-1 -mx-1 py-0.5 transition-colors ${
                                dragId === t.id
                                    ? "bg-orange-500/15 text-white"
                                    : t.visible
                                        ? "text-slate-300 hover:bg-slate-800/60"
                                        : "text-slate-600 hover:bg-slate-800/40"
                            }`}
                        >
                            <button
                                type="button"
                                aria-label={`Drag to reorder ${t.label}`}
                                title="Drag to reorder"
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    setDragId(t.id);
                                }}
                                className="touch-none cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-300 shrink-0 grid place-items-center h-6 w-6 -ml-1 rounded hover:bg-slate-700/50"
                            >
                                <GripVertical className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                aria-pressed={t.visible}
                                aria-label={t.visible ? `Hide ${t.label}` : `Show ${t.label}`}
                                title={t.visible ? "Hide from plot, export and scoring" : "Show again"}
                                onClick={() =>
                                    setTraces((p) =>
                                        p.map((x) => (x.id === t.id ? { ...x, visible: !x.visible } : x)),
                                    )
                                }
                                className={`shrink-0 grid place-items-center h-6 w-6 rounded hover:bg-slate-700/50 ${
                                    t.visible ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-300"
                                }`}
                            >
                                {t.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            </button>
                            <span
                                className="h-[3px] w-4 rounded-full shrink-0 ring-1 ring-white/25"
                                style={{ background: t.color, opacity: t.visible ? 1 : 0.35 }}
                            />
                            {editingId === t.id ? (
                                <input
                                    autoFocus
                                    value={editValue}
                                    maxLength={80}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={commitRename}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            commitRename();
                                        } else if (e.key === "Escape") {
                                            e.preventDefault();
                                            setEditingId(null);
                                        }
                                    }}
                                    className="min-w-0 flex-1 rounded border border-orange-500/70 bg-slate-950 px-1 py-0.5 text-[11px] text-white outline-none"
                                />
                            ) : (
                                <button
                                    type="button"
                                    title={`${t.label} — double-click to rename`}
                                    aria-label={`${t.label}. Activate to rename.`}
                                    onClick={(e) => {
                                        // detail === 0 means it was activated by keyboard
                                        if (e.detail === 0) startRename(t);
                                    }}
                                    onDoubleClick={() => startRename(t)}
                                    className="min-w-0 flex-1 truncate text-left"
                                >
                                    {t.label}
                                </button>
                            )}
                            <button
                                type="button"
                                aria-label={`Remove ${t.label}`}
                                onClick={() => setTraces((p) => p.filter((x) => x.id !== t.id))}
                                className="shrink-0 grid place-items-center h-6 w-6 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700/50"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                    {traces.length > 1 && (
                        <p className="text-[10px] text-slate-500 leading-relaxed -mt-1">
                            Drag the handle to reorder. Top of the list plots on top. The eye takes a
                            scan out of the figure, the export and the scoring without unloading it.
                        </p>
                    )}

                    {!empty && (
                        <>
                            <div className="h-px bg-slate-700/60" />
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                                    Plot
                                </h3>

                                <div className="flex items-center gap-2">
                                    <label className="text-[11px] text-slate-400 w-16">2&theta; range</label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={loDraft ?? String(lo)}
                                        step={1}
                                        aria-invalid={rangeInvalid}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            setLoDraft(raw);
                                            const v = Number(raw);
                                            // Never commit an empty field: Number("") is 0.
                                            if (raw.trim() !== "" && Number.isFinite(v)) setLo(v);
                                        }}
                                        onBlur={() => setLoDraft(null)}
                                        className={`w-full rounded-md bg-slate-950 border px-2 py-1 text-xs text-white ${rangeInvalid ? "border-amber-500/70" : "border-slate-700"}`}
                                    />
                                    <span className="text-slate-600 text-xs">–</span>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={hiDraft ?? String(hi)}
                                        step={1}
                                        aria-invalid={rangeInvalid}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            setHiDraft(raw);
                                            const v = Number(raw);
                                            if (raw.trim() !== "" && Number.isFinite(v)) setHi(v);
                                        }}
                                        onBlur={() => setHiDraft(null)}
                                        className={`w-full rounded-md bg-slate-950 border px-2 py-1 text-xs text-white ${rangeInvalid ? "border-amber-500/70" : "border-slate-700"}`}
                                    />
                                </div>
                                {rangeInvalid && (
                                    <p className="text-[10px] leading-relaxed text-amber-300">
                                        The lower bound must be below the upper bound. Until that is
                                        fixed the figure shows the full measured range,{" "}
                                        {dataExtent.min.toFixed(1)}–{dataExtent.max.toFixed(1)}°.
                                    </p>
                                )}

                                <div>
                                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                                        <span>Offset gap</span>
                                        <span className="font-mono text-slate-200">{gap.toFixed(2)}</span>
                                    </div>
                                    <input
                                        type="range" min={0.55} max={2} step={0.05} value={gap}
                                        onChange={(e) => setGap(Number(e.target.value))}
                                        className="w-full accent-orange-500"
                                    />
                                </div>

                                <label className="flex items-center justify-between text-[11px] text-slate-400">
                                    Waterfall stack
                                    <input
                                        type="checkbox" checked={stacked}
                                        onChange={(e) => setStacked(e.target.checked)}
                                        className="accent-orange-500 h-3.5 w-3.5"
                                    />
                                </label>

                                <p className="text-[10px] leading-relaxed text-slate-500">
                                    Stacked traces are normalised individually. Unstacking scales all
                                    traces to a common maximum, preserving relative intensity.
                                </p>
                            </div>

                        </>
                    )}
                </aside>
            </div>

            {/* Export and Reference are actions, not plot settings. Below the
                plot they stop the side column from stretching the grid row and
                stranding dead space under the figure. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <section className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                        Export
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button type="button" onClick={exportPNG} disabled={nothingVisible}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors disabled:opacity-40">
                            <ImageIcon className="h-3.5 w-3.5" /> PNG
                        </button>
                        <button type="button" onClick={exportSVG} disabled={nothingVisible}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors disabled:opacity-40">
                            <FileText className="h-3.5 w-3.5" /> SVG
                        </button>
                        <button type="button" onClick={exportPDF} disabled={nothingVisible}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors disabled:opacity-40">
                            <Download className="h-3.5 w-3.5" /> PDF 85 mm
                        </button>
                        <button type="button" onClick={exportCSV} disabled={nothingVisible}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors disabled:opacity-40">
                            <Download className="h-3.5 w-3.5" /> CSV
                        </button>
                    </div>
                    <p className="text-[10px] leading-relaxed text-slate-500">
                        Always print geometry — an 85 mm figure regardless of window size.
                    </p>
                </section>

                <section className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                        Reference
                    </h3>
                        <button
                            type="button"
                            onClick={() => cifRef.current?.click()}
                            disabled={refBusy}
                            className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors disabled:opacity-60"
                        >
                            {refBusy
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <FlaskConical className="h-3.5 w-3.5" />}
                            {refBusy ? "Simulating…" : reference ? "Replace CIF" : "Add CIF pattern"}
                        </button>
                        <input
                            ref={cifRef}
                            type="file"
                            accept=".cif,.txt"
                            className="hidden"
                            onChange={(e) => handleCif(e.target.files)}
                        />

                        {refError && (
                            <p className="text-[10px] leading-relaxed text-amber-300">{refError}</p>
                        )}

                        {reference && (
                            <div className="rounded-md border border-slate-700/60 bg-slate-950/40 px-2 py-2 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="h-3 w-[2px] rounded bg-slate-300 shrink-0" />
                                    <span
                                        className="truncate flex-1 text-[11px] font-semibold text-slate-200"
                                        title={reference.fileName}
                                    >
                                        {reference.formula}
                                    </span>
                                    <button
                                        type="button"
                                        aria-label={reference.visible ? "Hide reference pattern" : "Show reference pattern"}
                                        onClick={() => setReference((r) => (r ? { ...r, visible: !r.visible } : r))}
                                        className="shrink-0 text-slate-500 hover:text-slate-200"
                                    >
                                        {reference.visible
                                            ? <Eye className="h-3.5 w-3.5" />
                                            : <EyeOff className="h-3.5 w-3.5" />}
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Remove reference pattern"
                                        onClick={() => setReference(null)}
                                        className="shrink-0 text-slate-500 hover:text-red-400"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
                                    {reference.spacegroup} · {reference.peaks.length} refl · λ {reference.wavelength.toFixed(4)} Å
                                </p>
                            </div>
                        )}

                        <p className="text-[10px] leading-relaxed text-slate-500">
                            Computed from the CIF with Cu Kα, structure factors and Lorentz-polarisation applied.
                        </p>
                </section>
            </div>

            <PhaseMatchPanel
                results={matchResults?.filter((m) => visibleTraces.some((t) => t.id === m.traceId)) ?? null}
                selectedId={selectedMatchId}
                onSelect={setSelectedMatchId}
                onRun={runMatch}
                busy={matchBusy}
                error={matchError}
                canRun={!!reference && visibleTraces.length > 0}
                referenceLabel={reference ? `${reference.formula} (${reference.spacegroup})` : null}
            />

            {traces.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {traces.map((t) => (
                        <div
                            key={`${t.id}-meta`}
                            className={`rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 ${t.visible ? "" : "opacity-45"}`}
                        >
                            <p className="text-[10px] text-slate-500 truncate" title={t.fileName}>
                                {t.fileName}{t.visible ? "" : " · hidden"}
                            </p>
                            <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                                {t.x.length.toLocaleString()} pts · max {Math.round(t.peakIntensity).toLocaleString()} @ {t.peak2Theta.toFixed(2)}°
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function stamp() {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Binary search for the sample nearest a target 2θ. */
function nearestIndex(xs: number[], target: number): number {
    const n = xs.length;
    if (n === 0) return -1;
    if (target <= xs[0]) return 0;
    if (target >= xs[n - 1]) return n - 1;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (xs[mid] <= target) lo = mid;
        else hi = mid;
    }
    return Math.abs(xs[lo] - target) <= Math.abs(xs[hi] - target) ? lo : hi;
}
