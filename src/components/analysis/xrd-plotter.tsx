"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
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
    "#0F172A", "#C2410C", "#0E7490", "#4D7C0F",
    "#7C3AED", "#BE123C", "#B45309", "#155E75",
];

const W = 1210;
const H = 760;
const M = { l: 86, r: 30, t: 34, b: 88 };

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

function buildFigure(
    traces: Trace[],
    lo: number,
    hi: number,
    gap: number,
    stacked: boolean,
    reference: Reference | null,
): Prim[] {
    const out: Prim[] = [];
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
    const PAD_PX = 62;
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
    const majorX = 10;
    const minorX = 2;
    for (let v = Math.ceil(lo / minorX) * minorX; v <= hi + 1e-6; v += minorX) {
        const isMajor = Math.abs(v % majorX) < 1e-6;
        const px = X(v);
        const len = isMajor ? 7 : 4;
        out.push({ t: "line", x1: px, y1: M.t + PH, x2: px, y2: M.t + PH - len, stroke: "#111827", w: 1 });
        if (isMajor) {
            out.push({
                t: "text", x: px, y: M.t + PH + 9, s: v.toFixed(0), size: 12,
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
        t: "text", x: M.l + PW / 2, y: H - 26, s: "2\u03B8 (\u00B0)", size: 14,
        weight: 600, anchor: "middle", baseline: "alphabetic", fill: "#111827",
    });
    out.push({
        t: "text", x: 26, y: M.t + PH / 2, s: "Intensity (a.u.)", size: 14,
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

        for (const p of inWindow) {
            const h = (p.intensity / maxI) * REF_H;
            if (h < 0.002) continue;
            const px = X(p.two_theta);
            out.push({
                t: "line", x1: px, y1: Y(REF_BASE), x2: px, y2: Y(REF_BASE + h),
                stroke: "#334155", w: 1.1,
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
        for (const p of strong) {
            const px = X(p.two_theta);
            if (px - lastX < 13) continue;
            lastX = px;
            out.push({
                t: "text", x: px, y: Y(REF_TOP + 0.03),
                s: `(${p.hkl.join(" ")})`, size: 9,
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

    // In-plot legend — same order as the list and the stack
    const lx = M.l + PW - 244;
    traces.forEach((t, i) => {
        const ly = M.t + 18 + i * 17;
        out.push({ t: "line", x1: lx, y1: ly, x2: lx + 18, y2: ly, stroke: t.color, w: 2 });
        out.push({
            t: "text", x: lx + 24, y: ly + 0.5, s: t.label, size: 11.5,
            anchor: "start", baseline: "middle", fill: "#1F2937",
        });
    });

    // Legend entry for the simulated reference
    if (hasRef && reference) {
        const ly = M.t + 18 + traces.length * 17;
        out.push({ t: "line", x1: lx + 6, y1: ly - 5, x2: lx + 6, y2: ly + 5, stroke: "#334155", w: 1.2 });
        out.push({
            t: "text", x: lx + 24, y: ly + 0.5, s: `Simulated · ${reference.formula}`, size: 11.5,
            anchor: "start", baseline: "middle", fill: "#1F2937",
        });
    }

    return out;
}

/* ────────────────────────────────────────────────────────────────────────────
   Renderers
   ──────────────────────────────────────────────────────────────────────────── */

function paintCanvas(canvas: HTMLCanvasElement, prims: Prim[], scale: number) {
    canvas.width = W * scale;
    canvas.height = H * scale;
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

function toSVG(prims: Prim[]) {
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
    const [gap, setGap] = useState(1.15);
    const [stacked, setStacked] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);
    const [reference, setReference] = useState<Reference | null>(null);
    const [refBusy, setRefBusy] = useState(false);
    const [refError, setRefError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const cifRef = useRef<HTMLInputElement | null>(null);

    const prims = useMemo(
        () => (traces.length || reference
            ? buildFigure(traces, lo, hi, gap, stacked, reference)
            : []),
        [traces, lo, hi, gap, stacked, reference],
    );

    // Repaint whenever the figure changes
    const paint = useCallback(() => {
        if (canvasRef.current && prims.length) paintCanvas(canvasRef.current, prims, 2);
    }, [prims]);

    useEffect(() => {
        paint();
    }, [paint]);

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
        paintCanvas(cv, prims, 2.6);           // ~3150 px wide → >900 dpi at 85 mm
        const a = document.createElement("a");
        a.href = cv.toDataURL("image/png");
        a.download = `AP-Lab_XRD_${stamp()}.png`;
        a.click();
    }

    function exportSVG() {
        const blob = new Blob([toSVG(prims)], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `AP-Lab_XRD_${stamp()}.svg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    function exportPDF() {
        const cv = document.createElement("canvas");
        paintCanvas(cv, prims, 2.6);
        const img = cv.toDataURL("image/png");
        const widthMM = 85;
        const heightMM = (widthMM * H) / W;
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [widthMM, heightMM] });
        pdf.addImage(img, "PNG", 0, 0, widthMM, heightMM);
        pdf.save(`AP-Lab_XRD_${stamp()}.pdf`);
    }

    function exportCSV() {
        const blocks = traces.map((t) => {
            const rows = t.x
                .map((xv, i) => (xv >= lo && xv <= hi ? `${xv},${t.y[i]}` : null))
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
                            <span className="text-xs">
                                Rigaku / Bruker / PANalytical two-column exports · up to 8 traces
                            </span>
                        </button>
                    ) : (
                        <canvas
                            ref={canvasRef}
                            className="w-full h-auto block"
                            style={{ aspectRatio: `${W} / ${H}` }}
                        />
                    )}
                </div>

                {/* ── Settings ───────────────────────────────────────── */}
                <aside className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-4">
                    <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-3">
                            Data
                        </h3>
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
                            className={`flex items-center gap-2 text-[11px] rounded-md px-1 -mx-1 py-1 transition-colors ${
                                dragId === t.id
                                    ? "bg-orange-500/15 text-white"
                                    : "text-slate-300 hover:bg-slate-800/60"
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
                                className="touch-none cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-300 shrink-0 -ml-0.5"
                            >
                                <GripVertical className="h-3.5 w-3.5" />
                            </button>
                            <span
                                className="h-[3px] w-4 rounded-full shrink-0 ring-1 ring-white/25"
                                style={{ background: t.color }}
                            />
                            <span className="truncate flex-1" title={t.label}>{t.label}</span>
                            <button
                                type="button"
                                aria-label={`Remove ${t.label}`}
                                onClick={() => setTraces((p) => p.filter((x) => x.id !== t.id))}
                                className="text-slate-500 hover:text-red-400 shrink-0"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                    {traces.length > 1 && (
                        <p className="text-[10px] text-slate-500 leading-relaxed -mt-1">
                            Drag the handle to reorder. Top of the list plots on top.
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
                                        type="number" value={lo} step={1} min={0} max={hi - 1}
                                        onChange={(e) => setLo(Number(e.target.value))}
                                        className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-white"
                                    />
                                    <span className="text-slate-600 text-xs">–</span>
                                    <input
                                        type="number" value={hi} step={1} min={lo + 1} max={160}
                                        onChange={(e) => setHi(Number(e.target.value))}
                                        className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-white"
                                    />
                                </div>

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

                            <div className="h-px bg-slate-700/60" />

                            <div className="space-y-2">
                                <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                                    Export
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" onClick={exportPNG}
                                        className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors">
                                        <ImageIcon className="h-3.5 w-3.5" /> PNG
                                    </button>
                                    <button type="button" onClick={exportSVG}
                                        className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors">
                                        <FileText className="h-3.5 w-3.5" /> SVG
                                    </button>
                                    <button type="button" onClick={exportPDF}
                                        className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors">
                                        <Download className="h-3.5 w-3.5" /> PDF 85 mm
                                    </button>
                                    <button type="button" onClick={exportCSV}
                                        className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors">
                                        <Download className="h-3.5 w-3.5" /> CSV
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="h-px bg-slate-700/60" />

                    <div className="space-y-2">
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
                    </div>
                </aside>
            </div>

            {traces.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {traces.map((t) => (
                        <div key={`${t.id}-meta`} className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">
                            <p className="text-[10px] text-slate-500 truncate" title={t.fileName}>{t.fileName}</p>
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
