"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import {
    Upload, X, Download, FileText, Image as ImageIcon, Eye, EyeOff,
    FlaskConical, Loader2, RotateCcw, Info, AlertTriangle, MousePointerClick,
} from "lucide-react";
import { PALETTE, PRINT_LAYOUT, paintCanvas, screenLayout, toSVG } from "@/lib/plot/core";
import { buildFtirFigure, plotFrame, yExtent, type FigureTrace } from "@/lib/ftir/figure";
import { FtirParseError, parseFtir, type AxisUnit } from "@/lib/ftir/parse";
import { convert, toTransmittance } from "@/lib/ftir/model";
import {
    baselineFor, corrected, nearestIndex, rubberbandCaution,
    type Anchor, type BaselineSpec,
} from "@/lib/ftir/baseline";
import { demoCsv, type DemoSample } from "@/lib/ftir/demo";

type Trace = {
    id: string;
    label: string;
    fileName: string;
    color: string;
    x: number[];
    y: number[];
    unit: AxisUnit;
    visible: boolean;
    baseline: BaselineSpec;
};

const ACCEPT = ".csv,.txt,.tsv,.dat,.asc,.prn,.dpt,.xy,.jws,.jdx,.dx";

function stamp() {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function FtirPlotter() {
    const [traces, setTraces] = useState<Trace[]>([]);
    const [unit, setUnit] = useState<AxisUnit>("transmittance");
    const [stacked, setStacked] = useState(false);
    const [gap, setGap] = useState(8);
    const [lo, setLo] = useState(400);
    const [hi, setHi] = useState(4000);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState<string[]>([]);
    const [toast, setToast] = useState<{ msg: string; t: number } | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [degree, setDegree] = useState<1 | 2 | 3>(2);
    const [editingRaw, setEditingRaw] = useState(true);
    const [showResidual, setShowResidual] = useState(false);
    const [dragIndex, setDragIndex] = useState<number | null>(null);

    const wrapRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [width, setWidth] = useState(860);

    const layout = useMemo(() => screenLayout(width), [width]);
    const active = traces.find((t) => t.id === activeId) ?? traces[0] ?? null;

    // Baseline maths always runs in absorbance, whatever unit is on screen.
    const proc = useMemo(() => {
        const map = new Map<string, { yA: number[]; baseA: number[]; corrA: number[] }>();
        for (const t of traces) {
            const yA = convert(t.y, t.unit, "absorbance");
            let baseA: number[];
            try {
                baseA = baselineFor(t.x, yA, t.baseline);
            } catch {
                baseA = new Array(yA.length).fill(0);
            }
            map.set(t.id, { yA, baseA, corrA: corrected(yA, baseA) });
        }
        return map;
    }, [traces]);

    const figureTraces: FigureTrace[] = useMemo(
        () =>
            traces.map((t) => {
                const p = proc.get(t.id)!;
                const editing = t.id === activeId && editingRaw && t.baseline.kind === "manual";
                const yA = editing ? p.yA : p.corrA;
                const hasBase = t.baseline.kind !== "none";
                return {
                    id: t.id,
                    label: t.label,
                    color: t.color,
                    x: t.x,
                    y: unit === "absorbance" ? yA : toTransmittance(yA),
                    baseline: hasBase
                        ? unit === "absorbance"
                            ? p.baseA
                            : toTransmittance(p.baseA)
                        : null,
                    visible: t.visible,
                };
            }),
        [traces, proc, unit, activeId, editingRaw],
    );

    const caution = useMemo(() => {
        if (!active || active.baseline.kind !== "rubberband") return null;
        const p = proc.get(active.id);
        return p ? rubberbandCaution(p.yA, p.baseA) : null;
    }, [active, proc]);

    const prims = useMemo(
        () =>
            buildFtirFigure(figureTraces, {
                lo, hi, gap, stacked, unit, layout,
                showResidual: showResidual && unit === "absorbance",
                residualId: active?.id,
            }),
        [figureTraces, lo, hi, gap, stacked, unit, layout, showResidual, active],
    );

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width ?? 860;
            setWidth(Math.max(280, Math.round(w)));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const cv = canvasRef.current;
        if (!cv) return;
        const dpr = Math.min(2.5, window.devicePixelRatio || 1);
        paintCanvas(cv, prims, layout.W, layout.H, dpr);
        cv.style.width = "100%";
        cv.style.height = "auto";
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prims, layout.W, layout.H]);

    useEffect(() => {
        if (!toast) return;
        const id = setTimeout(() => setToast(null), 3200);
        return () => clearTimeout(id);
    }, [toast]);

    /* ── pointer → wavenumber ─────────────────────────────────────────────── */

    const dataAt = useCallback(
        (clientX: number, clientY: number) => {
            const cv = canvasRef.current;
            if (!cv) return null;
            const r = cv.getBoundingClientRect();
            if (r.width === 0) return null;
            const scale = r.width / layout.W;
            const vx = (clientX - r.left) / scale;
            const vy = (clientY - r.top) / scale;
            const { PW, mainH } = plotFrame(layout, showResidual && unit === "absorbance");
            if (vx < layout.M.l || vx > layout.M.l + PW) return null;
            if (vy < layout.M.t || vy > layout.M.t + mainH) return null;
            return { w: hi - ((vx - layout.M.l) / PW) * (hi - lo) };
        },
        [layout, hi, lo, showResidual, unit],
    );

    /** X only — a drag may leave the plot vertically without ending. */
    const dataX = useCallback(
        (clientX: number) => {
            const cv = canvasRef.current;
            if (!cv) return null;
            const r = cv.getBoundingClientRect();
            if (r.width === 0) return null;
            const scale = r.width / layout.W;
            const vx = (clientX - r.left) / scale;
            const { PW } = plotFrame(layout, showResidual && unit === "absorbance");
            return hi - ((vx - layout.M.l) / PW) * (hi - lo);
        },
        [layout, hi, lo, showResidual, unit],
    );

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (!active || active.baseline.kind !== "manual" || e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const hit = dataAt(e.clientX, e.clientY);
            if (!hit) return;
            const idx = nearestIndex(active.x, hit.w);
            const anchorX = active.x[idx];
            const yA = proc.get(active.id)?.yA ?? [];
            const anchors = active.baseline.anchors;
            const existing = anchors.findIndex((a) => Math.abs(a.x - anchorX) < 1e-9);

            if (e.shiftKey) {
                if (existing < 0) return;
                setTraces((prev) =>
                    prev.map((t) =>
                        t.id === active.id && t.baseline.kind === "manual"
                            ? { ...t, baseline: { ...t.baseline, anchors: anchors.filter((_, i) => i !== existing) } }
                            : t,
                    ),
                );
                setDragIndex(null);
                return;
            }

            if (existing >= 0) {
                // Grab an existing anchor: dragging moves it, it does not duplicate.
                setDragIndex(anchors.filter((a) => a.x > anchors[existing].x).length);
                return;
            }

            const next = [...anchors, { x: anchorX, y: yA[idx] }].sort((a, b) => b.x - a.x);
            setTraces((prev) =>
                prev.map((t) =>
                    t.id === active.id && t.baseline.kind === "manual"
                        ? { ...t, baseline: { ...t.baseline, anchors: next } }
                        : t,
                ),
            );
            setDragIndex(null);
        },
        [active, dataAt, proc],
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (dragIndex === null || !active || active.baseline.kind !== "manual") return;
            const w = dataX(e.clientX);
            if (w === null) return;
            const idx = nearestIndex(active.x, w);
            const yA = proc.get(active.id)?.yA ?? [];
            const moved = { x: active.x[idx], y: yA[idx] };

            setTraces((prev) =>
                prev.map((t) => {
                    if (t.id !== active.id || t.baseline.kind !== "manual") return t;
                    if (dragIndex >= t.baseline.anchors.length) return t;
                    const next = t.baseline.anchors.slice();
                    next[dragIndex] = moved;
                    next.sort((a, b) => b.x - a.x);
                    return { ...t, baseline: { ...t.baseline, anchors: next } };
                }),
            );
            // Sorting can reorder the array; keep grabbing the same anchor.
            setDragIndex(
                active.baseline.anchors.filter((a, i) => i !== dragIndex && a.x > moved.x).length,
            );
        },
        [dragIndex, active, dataX, proc],
    );

    const onPointerUp = useCallback(() => setDragIndex(null), []);

    /* ── files ────────────────────────────────────────────────────────────── */

    const addParsed = useCallback((text: string, fileName: string) => {
        const parsed = parseFtir(text, fileName);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setTraces((prev) => {
            const next: Trace = {
                id,
                label: parsed.sample || fileName.replace(/\.[^.]+$/, ""),
                fileName,
                color: PALETTE[prev.length % PALETTE.length],
                x: parsed.x,
                y: parsed.y,
                unit: parsed.unit,
                visible: true,
                baseline: { kind: "none" },
            };
            if (prev.length === 0) {
                setLo(Math.max(400, Math.min(...parsed.x)));
                setHi(Math.min(4000, Math.max(...parsed.x)));
                setUnit(parsed.unit);
                setActiveId(id);
            }
            return [...prev, next];
        });
        if (parsed.warnings.length) setNotes((n) => [...n, `${fileName}: ${parsed.warnings.join(", ")}`]);
    }, []);

    const handleFiles = useCallback(
        async (files: FileList | null) => {
            if (!files?.length) return;
            setBusy(true);
            setError(null);
            try {
                for (const file of Array.from(files)) {
                    const text = await file.text();
                    addParsed(text, file.name);
                }
            } catch (e) {
                setError(e instanceof FtirParseError ? e.message : "Could not read that file.");
            } finally {
                setBusy(false);
                if (fileRef.current) fileRef.current.value = "";
            }
        },
        [addParsed],
    );

    const loadDemo = useCallback(
        (sample: DemoSample) => {
            const d = demoCsv(sample);
            try {
                addParsed(d.text, d.fileName);
                setToast({ msg: `Loaded ${d.fileName}`, t: Date.now() });
            } catch {
                setError("Demo data failed to parse — that is a bug, please report it.");
            }
        },
        [addParsed],
    );

    /* ── baseline actions ─────────────────────────────────────────────────── */

    /** Seed anchors as the quietest point in each third of the window. */
    function autoAnchors(t: Trace, yA: number[]): Anchor[] {
        if (!yA.length) return [];
        const bands = [lo, lo + (hi - lo) / 3, lo + (2 * (hi - lo)) / 3, hi];
        const picks: Anchor[] = [];
        for (let b = 0; b < 3; b++) {
            let best: Anchor | null = null;
            for (let i = 0; i < t.x.length; i++) {
                const x = t.x[i];
                if (x < bands[b] || x > bands[b + 1]) continue;
                if (!Number.isFinite(yA[i])) continue;
                if (!best || yA[i] < best.y) best = { x, y: yA[i] };
            }
            if (best) picks.push(best);
        }
        return picks.sort((a, b) => b.x - a.x);
    }

    const setMode = (kind: BaselineSpec["kind"]) => {
        if (!active) return;
        setTraces((prev) =>
            prev.map((t) => {
                if (t.id !== active.id) return t;
                if (kind === "none") return { ...t, baseline: { kind: "none" } };
                if (kind === "rubberband") return { ...t, baseline: { kind: "rubberband" } };
                const anchors =
                    t.baseline.kind === "manual"
                        ? t.baseline.anchors
                        : autoAnchors(t, proc.get(t.id)?.yA ?? []);
                return { ...t, baseline: { kind: "manual", anchors, degree } };
            }),
        );
        if (kind === "manual") setEditingRaw(true);
    };

    const setActiveDegree = (d: 1 | 2 | 3) => {
        setDegree(d);
        if (!active) return;
        setTraces((prev) =>
            prev.map((t) =>
                t.id === active.id && t.baseline.kind === "manual"
                    ? { ...t, baseline: { ...t.baseline, degree: d } }
                    : t,
            ),
        );
    };

    const applyToAll = () => {
        if (!active) return;
        const spec = active.baseline;
        setTraces((prev) =>
            prev.map((t) => {
                if (t.id === active.id) return t;
                if (spec.kind !== "manual") return { ...t, baseline: spec };
                // Same method, but anchors recomputed on that trace's own values.
                return { ...t, baseline: { ...spec, anchors: autoAnchors(t, proc.get(t.id)?.yA ?? []) } };
            }),
        );
        setToast({ msg: "Baseline method applied to all traces", t: Date.now() });
    };

    const clearAnchors = () => {
        if (!active) return;
        setTraces((prev) =>
            prev.map((t) =>
                t.id === active.id && t.baseline.kind === "manual"
                    ? { ...t, baseline: { ...t.baseline, anchors: [] } }
                    : t,
            ),
        );
    };

    /* ── exports ──────────────────────────────────────────────────────────── */

    const figureOpts = () => ({
        lo, hi, gap, stacked, unit, layout: PRINT_LAYOUT,
        showResidual: showResidual && unit === "absorbance",
        residualId: active?.id,
    });

    function exportPNG() {
        const cv = document.createElement("canvas");
        paintCanvas(cv, buildFtirFigure(figureTraces, figureOpts()), PRINT_LAYOUT.W, PRINT_LAYOUT.H, 3.8);
        const a = document.createElement("a");
        const fname = `AP-Lab_FTIR_${stamp()}.png`;
        a.href = cv.toDataURL("image/png");
        a.download = fname;
        a.click();
        setToast({ msg: `Downloaded ${fname}`, t: Date.now() });
    }

    function exportSVG() {
        const svg = toSVG(buildFtirFigure(figureTraces, figureOpts()), PRINT_LAYOUT.W, PRINT_LAYOUT.H);
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const fname = `AP-Lab_FTIR_${stamp()}.svg`;
        a.href = url;
        a.download = fname;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setToast({ msg: `Downloaded ${fname}`, t: Date.now() });
    }

    function exportPDF() {
        const cv = document.createElement("canvas");
        paintCanvas(cv, buildFtirFigure(figureTraces, figureOpts()), PRINT_LAYOUT.W, PRINT_LAYOUT.H, 3.8);
        const widthMM = 85;
        const heightMM = (widthMM * PRINT_LAYOUT.H) / PRINT_LAYOUT.W;
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [widthMM, heightMM] });
        pdf.addImage(cv.toDataURL("image/png"), "PNG", 0, 0, widthMM, heightMM);
        const fname = `AP-Lab_FTIR_${stamp()}.pdf`;
        pdf.save(fname);
        setToast({ msg: `Downloaded ${fname}`, t: Date.now() });
    }

    function exportCSV() {
        const method = (t: Trace) =>
            t.baseline.kind === "none"
                ? "none"
                : t.baseline.kind === "rubberband"
                  ? "rubberband"
                  : `manual degree ${t.baseline.degree}, ${t.baseline.anchors.length} anchors`;
        const header =
            `# AP-Lab FTIR export — ${new Date().toISOString()}\n` +
            `# y-axis: ${unit === "transmittance" ? "%T" : "absorbance"}\n` +
            `# baseline maths: absorbance\n`;
        const blocks = traces.map((t) => {
            const p = proc.get(t.id)!;
            const yv = unit === "absorbance" ? p.corrA : toTransmittance(p.corrA);
            const rows = t.x
                .map((xv, i) => (xv >= lo && xv <= hi ? `${xv},${yv[i]}` : null))
                .filter(Boolean)
                .join("\n");
            return `# trace: ${t.label}\n# file: ${t.fileName}\n# baseline: ${method(t)}\nwavenumber,value\n${rows}`;
        });
        const blob = new Blob([header + blocks.join("\n\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const fname = `AP-Lab_FTIR_${stamp()}.csv`;
        a.href = url;
        a.download = fname;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setToast({ msg: `Downloaded ${fname}`, t: Date.now() });
    }

    const hasTraces = traces.length > 0;
    const manual = active?.baseline.kind === "manual";
    const anchorCount = active?.baseline.kind === "manual" ? active.baseline.anchors.length : 0;
    const activeDegree = active?.baseline.kind === "manual" ? active.baseline.degree : degree;

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-slate-500 text-xs">
                    Nothing you load here leaves this browser tab. Baseline maths runs in absorbance.
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Load spectra
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        multiple
                        accept={ACCEPT}
                        className="hidden"
                        onChange={(e) => handleFiles(e.target.files)}
                    />
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError(null)} aria-label="Dismiss">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {caution && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="flex-1">{caution}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
                <div className="bg-slate-800 rounded-xl border border-slate-700/50 p-3">
                    <div
                        ref={wrapRef}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            handleFiles(e.dataTransfer.files);
                        }}
                        className="w-full"
                    >
                        {hasTraces ? (
                            <canvas
                                ref={canvasRef}
                                onPointerDown={onPointerDown}
                                onPointerMove={onPointerMove}
                                onPointerUp={onPointerUp}
                                onPointerCancel={onPointerUp}
                                className={`block w-full h-auto rounded ${manual ? "cursor-crosshair" : ""}`}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                                <FlaskConical className="w-8 h-8 text-slate-500" />
                                <p className="text-slate-300 font-medium">No spectra loaded</p>
                                <p className="text-slate-500 text-sm max-w-sm">
                                    Drop a CSV, TXT or JCAMP-DX export here, or load a demo spectrum to see
                                    how a figure comes out.
                                </p>
                                <div className="flex flex-wrap justify-center gap-2 pt-1">
                                    <button
                                        onClick={() => loadDemo("ni-bdc")}
                                        className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm"
                                    >
                                        Ni-BDC demo
                                    </button>
                                    <button
                                        onClick={() => loadDemo("cu-bdc")}
                                        className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm"
                                    >
                                        Cu-BDC demo
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    {manual && (
                        <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                            <MousePointerClick className="w-3.5 h-3.5" />
                            Click to place an anchor, drag it sideways to slide along the curve, shift-click to remove.
                        </p>
                    )}
                </div>

                <div className="space-y-4">
                    <section className="bg-slate-800 rounded-xl border border-slate-700/50 p-4 space-y-3">
                        <h2 className="text-sm font-semibold text-slate-200">Traces</h2>
                        {!hasTraces && <p className="text-slate-500 text-sm">Nothing loaded yet.</p>}
                        {traces.map((t) => (
                            <div
                                key={t.id}
                                className={`flex items-center gap-2 text-sm rounded-md px-1 py-0.5 ${
                                    t.id === active?.id ? "bg-slate-700/60" : ""
                                }`}
                            >
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                                <button
                                    onClick={() => setActiveId(t.id)}
                                    className="flex-1 truncate text-left text-slate-200 hover:text-white"
                                    title={`${t.fileName} — click to make active`}
                                >
                                    {t.label}
                                </button>
                                <span className="text-[11px] uppercase tracking-wide text-slate-500">
                                    {t.baseline.kind === "none" ? "—" : t.baseline.kind === "manual" ? "manual" : "auto"}
                                </span>
                                <button
                                    onClick={() =>
                                        setTraces((p) =>
                                            p.map((x) => (x.id === t.id ? { ...x, visible: !x.visible } : x)),
                                        )
                                    }
                                    aria-label={t.visible ? "Hide trace" : "Show trace"}
                                    className="text-slate-400 hover:text-slate-200"
                                >
                                    {t.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => setTraces((p) => p.filter((x) => x.id !== t.id))}
                                    aria-label="Remove trace"
                                    className="text-slate-400 hover:text-red-400"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {hasTraces && (
                            <button
                                onClick={() => loadDemo("cu-bdc")}
                                className="text-xs text-slate-400 hover:text-slate-200"
                            >
                                + add demo spectrum
                            </button>
                        )}
                    </section>

                    <section className="bg-slate-800 rounded-xl border border-slate-700/50 p-4 space-y-3">
                        <h2 className="text-sm font-semibold text-slate-200">
                            Baseline
                            {active && (
                                <span className="block text-[11px] font-normal text-slate-500 truncate">
                                    on {active.label}
                                </span>
                            )}
                        </h2>
                        <div className="grid grid-cols-3 gap-1.5">
                            {([
                                ["none", "None"],
                                ["manual", "Manual"],
                                ["rubberband", "Auto"],
                            ] as const).map(([kind, label]) => (
                                <button
                                    key={kind}
                                    onClick={() => setMode(kind)}
                                    disabled={!active}
                                    className={`px-2 py-1.5 rounded-md text-xs transition-colors ${
                                        active?.baseline.kind === kind
                                            ? "bg-orange-600 text-white"
                                            : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {manual && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-slate-400">Fit degree</span>
                                    <div className="flex gap-1">
                                        {([1, 2, 3] as const).map((d) => (
                                            <button
                                                key={d}
                                                onClick={() => setActiveDegree(d)}
                                                className={`px-2 py-0.5 rounded text-xs ${
                                                    activeDegree === d
                                                        ? "bg-slate-600 text-white"
                                                        : "bg-slate-700/60 text-slate-300"
                                                }`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    {anchorCount} anchor{anchorCount === 1 ? "" : "s"}; degree {activeDegree}{" "}
                                    needs {activeDegree + 1}.
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={clearAnchors}
                                        className="flex-1 px-2 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        onClick={applyToAll}
                                        disabled={traces.length < 2}
                                        className="flex-1 px-2 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs disabled:opacity-40"
                                    >
                                        Apply to all
                                    </button>
                                </div>
                                <label className="flex items-center gap-2 text-[11px] text-slate-400">
                                    <input
                                        type="checkbox"
                                        checked={editingRaw}
                                        onChange={(e) => setEditingRaw(e.target.checked)}
                                        className="accent-orange-500"
                                    />
                                    Show raw trace while placing anchors
                                </label>
                            </div>
                        )}

                        {active?.baseline.kind === "rubberband" && (
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                Lower convex hull in absorbance — parameter-free, matches instrument
                                software. Check the residual before trusting it.
                            </p>
                        )}
                    </section>

                    <section className="bg-slate-800 rounded-xl border border-slate-700/50 p-4 space-y-3">
                        <h2 className="text-sm font-semibold text-slate-200">Display</h2>
                        <div className="grid grid-cols-2 gap-2">
                            {(["transmittance", "absorbance"] as AxisUnit[]).map((u) => (
                                <button
                                    key={u}
                                    onClick={() => setUnit(u)}
                                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                                        unit === u
                                            ? "bg-orange-600 text-white"
                                            : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                    }`}
                                >
                                    {u === "transmittance" ? "%T" : "Absorbance"}
                                </button>
                            ))}
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                                type="checkbox"
                                checked={showResidual}
                                onChange={(e) => setShowResidual(e.target.checked)}
                                className="accent-orange-500"
                            />
                            Residual strip
                        </label>
                        {showResidual && unit !== "absorbance" && (
                            <p className="text-[11px] text-amber-300/80">
                                Residual is an absorbance quantity — switch to Absorbance to see it.
                            </p>
                        )}
                    </section>

                    <section className="bg-slate-800 rounded-xl border border-slate-700/50 p-4 space-y-3">
                        <h2 className="text-sm font-semibold text-slate-200">Range</h2>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs text-slate-400">
                                High (cm⁻¹)
                                <input
                                    type="number"
                                    value={hi}
                                    onChange={(e) => setHi(Number(e.target.value))}
                                    className="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
                                />
                            </label>
                            <label className="text-xs text-slate-400">
                                Low (cm⁻¹)
                                <input
                                    type="number"
                                    value={lo}
                                    onChange={(e) => setLo(Number(e.target.value))}
                                    className="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
                                />
                            </label>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 text-xs text-slate-300 flex-1">
                                <input
                                    type="checkbox"
                                    checked={stacked}
                                    onChange={(e) => setStacked(e.target.checked)}
                                    className="accent-orange-500"
                                />
                                Waterfall offset
                            </label>
                            <input
                                type="number"
                                value={gap}
                                onChange={(e) => setGap(Number(e.target.value))}
                                disabled={!stacked}
                                className="w-20 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-slate-100 disabled:opacity-40"
                                aria-label="Waterfall gap"
                            />
                        </div>
                        <button
                            onClick={() => {
                                if (!traces.length) return;
                                const xs = traces.flatMap((t) => [Math.min(...t.x), Math.max(...t.x)]);
                                setLo(Math.max(400, Math.min(...xs)));
                                setHi(Math.min(4000, Math.max(...xs)));
                            }}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> Fit to data
                        </button>
                    </section>

                    <section className="bg-slate-800 rounded-xl border border-slate-700/50 p-4 space-y-2">
                        <h2 className="text-sm font-semibold text-slate-200">Export</h2>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={exportPNG} disabled={!hasTraces}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm disabled:opacity-40">
                                <ImageIcon className="w-4 h-4" /> PNG
                            </button>
                            <button onClick={exportSVG} disabled={!hasTraces}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm disabled:opacity-40">
                                <FileText className="w-4 h-4" /> SVG
                            </button>
                            <button onClick={exportPDF} disabled={!hasTraces}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm disabled:opacity-40">
                                <Download className="w-4 h-4" /> PDF 85 mm
                            </button>
                            <button onClick={exportCSV} disabled={!hasTraces}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm disabled:opacity-40">
                                <FileText className="w-4 h-4" /> CSV
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-500">CSV records the baseline method per trace.</p>
                    </section>

                    {notes.length > 0 && (
                        <section className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-3">
                            <h2 className="text-xs font-semibold text-slate-300 mb-1">Parser notes</h2>
                            <ul className="text-[11px] text-slate-400 space-y-1">
                                {notes.slice(-4).map((n, i) => (
                                    <li key={i}>{n}</li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            </div>

            {toast && (
                <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-900 border border-slate-700 px-4 py-2 text-sm text-slate-100 shadow-xl">
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
