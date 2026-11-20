"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import {
    Upload, X, Download, FileText, Image as ImageIcon, Eye, EyeOff,
    FlaskConical, Loader2, RotateCcw, Info,
} from "lucide-react";
import { PALETTE, PRINT_LAYOUT, paintCanvas, screenLayout, toSVG } from "@/lib/plot/core";
import { buildFtirFigure, type FigureTrace } from "@/lib/ftir/figure";
import { FtirParseError, parseFtir, type AxisUnit } from "@/lib/ftir/parse";
import { convert } from "@/lib/ftir/model";
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

    const wrapRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [width, setWidth] = useState(860);

    const layout = useMemo(() => screenLayout(width), [width]);

    // Display-unit conversion happens here, once, so the figure never has to
    // know which unit a trace arrived in.
    const figureTraces: FigureTrace[] = useMemo(
        () =>
            traces.map((t) => ({
                id: t.id,
                label: t.label,
                color: t.color,
                x: t.x,
                y: convert(t.y, t.unit, unit),
                visible: t.visible,
            })),
        [traces, unit],
    );

    const prims = useMemo(
        () => buildFtirFigure(figureTraces, { lo, hi, gap, stacked, unit, layout }),
        [figureTraces, lo, hi, gap, stacked, unit, layout],
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
            };
            const out = [...prev, next];
            if (prev.length === 0) {
                setLo(Math.max(400, Math.min(...parsed.x)));
                setHi(Math.min(4000, Math.max(...parsed.x)));
                setUnit(parsed.unit);
            }
            return out;
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

    function exportPNG() {
        const cv = document.createElement("canvas");
        paintCanvas(
            cv,
            buildFtirFigure(figureTraces, { lo, hi, gap, stacked, unit, layout: PRINT_LAYOUT }),
            PRINT_LAYOUT.W,
            PRINT_LAYOUT.H,
            3.8,
        );
        const a = document.createElement("a");
        const fname = `AP-Lab_FTIR_${stamp()}.png`;
        a.href = cv.toDataURL("image/png");
        a.download = fname;
        a.click();
        setToast({ msg: `Downloaded ${fname}`, t: Date.now() });
    }

    function exportSVG() {
        const svg = toSVG(
            buildFtirFigure(figureTraces, { lo, hi, gap, stacked, unit, layout: PRINT_LAYOUT }),
            PRINT_LAYOUT.W,
            PRINT_LAYOUT.H,
        );
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
        paintCanvas(
            cv,
            buildFtirFigure(figureTraces, { lo, hi, gap, stacked, unit, layout: PRINT_LAYOUT }),
            PRINT_LAYOUT.W,
            PRINT_LAYOUT.H,
            3.8,
        );
        const widthMM = 85;
        const heightMM = (widthMM * PRINT_LAYOUT.H) / PRINT_LAYOUT.W;
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [widthMM, heightMM] });
        pdf.addImage(cv.toDataURL("image/png"), "PNG", 0, 0, widthMM, heightMM);
        const fname = `AP-Lab_FTIR_${stamp()}.pdf`;
        pdf.save(fname);
        setToast({ msg: `Downloaded ${fname}`, t: Date.now() });
    }

    function exportCSV() {
        const header = `# AP-Lab FTIR export — ${new Date().toISOString()}\n# y-axis: ${unit === "transmittance" ? "%T" : "absorbance"}\n`;
        const blocks = traces.map((t) => {
            const yv = convert(t.y, t.unit, unit);
            const rows = t.x
                .map((xv, i) => (xv >= lo && xv <= hi ? `${xv},${yv[i]}` : null))
                .filter(Boolean)
                .join("\n");
            return `# trace: ${t.label}\n# file: ${t.fileName}\nwavenumber,value\n${rows}`;
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

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-slate-500 text-xs">
                    Nothing you load here leaves this browser tab.
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

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
                {/* Canvas */}
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
                            <canvas ref={canvasRef} className="block w-full h-auto rounded" />
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
                </div>

                {/* Settings */}
                <div className="space-y-4">
                    <section className="bg-slate-800 rounded-xl border border-slate-700/50 p-4 space-y-3">
                        <h2 className="text-sm font-semibold text-slate-200">Traces</h2>
                        {!hasTraces && <p className="text-slate-500 text-sm">Nothing loaded yet.</p>}
                        {traces.map((t) => (
                            <div key={t.id} className="flex items-center gap-2 text-sm">
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ background: t.color }}
                                />
                                <span className="flex-1 truncate text-slate-200" title={t.fileName}>
                                    {t.label}
                                </span>
                                <span className="text-[11px] uppercase tracking-wide text-slate-500">
                                    {t.unit === "transmittance" ? "%T" : "A"}
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
                        <h2 className="text-sm font-semibold text-slate-200">Y axis</h2>
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
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            Conversion happens on the displayed values only; the loaded data is untouched.
                        </p>
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
                            <button
                                onClick={exportPNG}
                                disabled={!hasTraces}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm disabled:opacity-40"
                            >
                                <ImageIcon className="w-4 h-4" /> PNG
                            </button>
                            <button
                                onClick={exportSVG}
                                disabled={!hasTraces}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm disabled:opacity-40"
                            >
                                <FileText className="w-4 h-4" /> SVG
                            </button>
                            <button
                                onClick={exportPDF}
                                disabled={!hasTraces}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm disabled:opacity-40"
                            >
                                <Download className="w-4 h-4" /> PDF 85 mm
                            </button>
                            <button
                                onClick={exportCSV}
                                disabled={!hasTraces}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm disabled:opacity-40"
                            >
                                <FileText className="w-4 h-4" /> CSV
                            </button>
                        </div>
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
