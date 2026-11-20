"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import {
    Upload, X, Download, FileText, Image as ImageIcon, Eye, EyeOff,
    FlaskConical, Loader2, RotateCcw, Info, AlertTriangle, MousePointerClick,
} from "lucide-react";
import { PALETTE, PRINT_LAYOUT, paintCanvas, screenLayout, toSVG } from "@/lib/plot/core";
import { buildFtirFigure, legendGeometry, plotFrame, yExtent, zoomWindow, type FigureTrace } from "@/lib/ftir/figure";
import { FtirParseError, parseFtir, type AxisUnit } from "@/lib/ftir/parse";
import { convert, toTransmittance } from "@/lib/ftir/model";
import {
    baselineFor, corrected, nearestIndex, rubberbandCaution,
    type Anchor, type BaselineSpec,
} from "@/lib/ftir/baseline";
import { detectPeaks } from "@/lib/ftir/peaks";
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

export function FtirPlotter({ userId }: { userId: string }) {
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
    const [peaksOn, setPeaksOn] = useState(false);
    const [prominence, setProminence] = useState(4);
    const [minSep, setMinSep] = useState(20);
    const [labelEdits, setLabelEdits] = useState<Record<string, string>>({});
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [hover, setHover] = useState<{ w: number; v: number; px: number; py: number; label: string } | null>(null);
    const [dragBox, setDragBox] = useState<{ x1: number; x2: number } | null>(null);
    const gesture = useRef<{ mode: "zoom" | "pan"; startX: number; lo: number; hi: number } | null>(null);
    const overlayRef = useRef<HTMLCanvasElement | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [cursorIdx, setCursorIdx] = useState<number | null>(null);
    const [liveMsg, setLiveMsg] = useState("");
    const [restored, setRestored] = useState(false);
    const storeKey = `ftir:workspace:${userId}`;

    const wrapRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [width, setWidth] = useState(860);
    const [vh, setVh] = useState(900);

    // A spectrum is read left-to-right, not as a square: the plot keeps a wide
    // aspect and a height cap so it never swallows the screen on a large monitor.
    const layout = useMemo(() => {
        const base = screenLayout(width);
        // Height follows the viewport so the plot and the three control cards
        // share one screen on a laptop, instead of the cards starting below it.
        const h = Math.round(Math.min(470, Math.max(250, Math.min(width * 0.36, vh - 646 - (peaksOn ? 74 : 0)))));
        return { ...base, H: h };
    }, [width, vh, peaksOn]);
    const active = traces.find((t) => t.id === activeId) ?? traces[0] ?? null;
    const residualOn = showResidual && unit === "absorbance";

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

    const activePeaks = useMemo(() => {
        if (!peaksOn || !active) return [];
        const p = proc.get(active.id);
        if (!p) return [];
        const found = detectPeaks(active.x, p.corrA, {
            minProminencePct: prominence,
            minSeparation: minSep,
            maxCount: 12,
        });
        const vis = traces.filter((x) => x.visible);
        const slot = Math.max(0, vis.findIndex((x) => x.id === active.id));
        const shift = slot * (stacked ? gap : 0);
        return found.map((f) => {
            const key = `${active.id}:${Math.round(f.x)}`;
            const yDisp = (unit === "absorbance" ? f.y : toTransmittance([f.y])[0]) + shift;
            return { key, x: f.x, y: yDisp, text: labelEdits[key] ?? String(Math.round(f.x)) };
        });
    }, [peaksOn, active, proc, prominence, minSep, unit, labelEdits, traces, stacked, gap]);

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
                    peaks: t.id === active?.id && peaksOn ? activePeaks : null,
                    visible: t.visible,
                };
            }),
        [traces, proc, unit, activeId, editingRaw, peaksOn, activePeaks, active],
    );

    const cursorPoint = useMemo(() => {
        if (cursorIdx === null || !active) return null;
        const p = proc.get(active.id);
        if (!p) return null;
        const w = active.x[cursorIdx];
        if (w === undefined) return null;
        const value = unit === "absorbance" ? p.corrA[cursorIdx] : toTransmittance([p.corrA[cursorIdx]])[0];
        const { PW, mainH } = plotFrame(layout, residualOn);
        const [yLo, yHi] = yExtent(figureTraces.filter((t) => t.visible), stacked ? gap : 0);
        return {
            px: layout.M.l + ((hi - w) / (hi - lo)) * PW,
            py: layout.M.t + ((yHi - value) / (yHi - yLo)) * mainH,
            w,
            v: value,
            label: active.label,
        };
    }, [cursorIdx, active, proc, unit, layout, residualOn, figureTraces, stacked, gap, hi, lo]);

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
        const onResize = () => setVh(window.innerHeight);
        onResize();
        window.addEventListener("resize", onResize);
        return () => {
            ro.disconnect();
            window.removeEventListener("resize", onResize);
        };
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

    // Crosshair and zoom band live on a second canvas: repainting the figure on
    // every pointer move would rebuild ~50 primitives per frame.
    useEffect(() => {
        const cv = overlayRef.current;
        if (!cv) return;
        const dpr = Math.min(2.5, window.devicePixelRatio || 1);
        cv.width = Math.round(layout.W * dpr);
        cv.height = Math.round(layout.H * dpr);
        const ctx = cv.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, layout.W, layout.H);
        const { mainH } = plotFrame(layout, residualOn);

        if (dragBox) {
            const x = Math.min(dragBox.x1, dragBox.x2);
            const w = Math.abs(dragBox.x2 - dragBox.x1);
            ctx.fillStyle = "rgba(234,88,12,0.12)";
            ctx.fillRect(x, layout.M.t, w, mainH);
            ctx.strokeStyle = "rgba(234,88,12,0.85)";
            ctx.lineWidth = 1;
            ctx.strokeRect(x, layout.M.t, w, mainH);
        } else if (hover || cursorPoint) {
            const pt = cursorPoint ?? hover!;
            ctx.strokeStyle = "rgba(148,163,184,0.6)";
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(pt.px, layout.M.t);
            ctx.lineTo(pt.px, layout.M.t + mainH);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "#EA580C";
            ctx.beginPath();
            ctx.arc(pt.px, pt.py, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }, [hover, cursorPoint, dragBox, layout, residualOn]);

    // Workspace persistence, scoped per user. sessionStorage (not localStorage)
    // because a lab bench PC is shared and a half-finished plot should not
    // greet the next person who signs in.
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(storeKey);
            if (raw) {
                const d = JSON.parse(raw) as Record<string, unknown>;
                if (d && d.v === 1 && Array.isArray(d.traces)) {
                    setTraces(d.traces as Trace[]);
                    if (typeof d.unit === "string") setUnit(d.unit as AxisUnit);
                    if (typeof d.lo === "number") setLo(d.lo);
                    if (typeof d.hi === "number") setHi(d.hi);
                    if (typeof d.stacked === "boolean") setStacked(d.stacked);
                    if (typeof d.gap === "number") setGap(d.gap);
                    if (typeof d.peaksOn === "boolean") setPeaksOn(d.peaksOn);
                    if (typeof d.prominence === "number") setProminence(d.prominence);
                    if (typeof d.minSep === "number") setMinSep(d.minSep);
                    if (d.labelEdits && typeof d.labelEdits === "object") {
                        setLabelEdits(d.labelEdits as Record<string, string>);
                    }
                    if (typeof d.activeId === "string") setActiveId(d.activeId);
                }
            }
        } catch {
            // A corrupt workspace must never block the tool.
        }
        setRestored(true);
    }, [storeKey]);

    useEffect(() => {
        if (!restored) return;
        try {
            sessionStorage.setItem(
                storeKey,
                JSON.stringify({
                    v: 1,
                    traces,
                    unit,
                    lo,
                    hi,
                    stacked,
                    gap,
                    peaksOn,
                    prominence,
                    minSep,
                    labelEdits,
                    activeId,
                }),
            );
        } catch {
            // Quota or private mode: the workspace is a convenience, not the data.
        }
    }, [restored, storeKey, traces, unit, lo, hi, stacked, gap, peaksOn, prominence, minSep, labelEdits, activeId]);

    useEffect(() => {
        if (!toast) return;
        const id = setTimeout(() => setToast(null), 3200);
        return () => clearTimeout(id);
    }, [toast]);

    /* ── pointer → wavenumber ─────────────────────────────────────────────── */

    const plotXY = useCallback(
        (clientX: number, clientY: number) => {
            const cv = canvasRef.current;
            if (!cv) return null;
            const r = cv.getBoundingClientRect();
            if (r.width === 0) return null;
            const scale = r.width / layout.W;
            const { PW, mainH } = plotFrame(layout, residualOn);
            const vx = (clientX - r.left) / scale;
            const vy = (clientY - r.top) / scale;
            if (vx < layout.M.l || vx > layout.M.l + PW) return null;
            if (vy < layout.M.t || vy > layout.M.t + mainH) return null;
            return { vx, vy, w: hi - ((vx - layout.M.l) / PW) * (hi - lo) };
        },
        [layout, hi, lo, residualOn],
    );

    /** X only — a gesture may leave the plot vertically without ending. */
    const dataX = useCallback(
        (clientX: number) => {
            const cv = canvasRef.current;
            if (!cv) return null;
            const r = cv.getBoundingClientRect();
            if (r.width === 0) return null;
            const scale = r.width / layout.W;
            const vx = (clientX - r.left) / scale;
            const { PW } = plotFrame(layout, residualOn);
            return hi - ((vx - layout.M.l) / PW) * (hi - lo);
        },
        [layout, hi, lo, residualOn],
    );

    /** Nearest data point under the cursor, for the readout. */
    const readoutAt = useCallback(
        (clientX: number, clientY: number) => {
            const hit = plotXY(clientX, clientY);
            if (!hit || !active) return null;
            const idx = nearestIndex(active.x, hit.w);
            const p = proc.get(active.id);
            if (!p) return null;
            const value = unit === "absorbance" ? p.corrA[idx] : toTransmittance([p.corrA[idx]])[0];
            const { mainH } = plotFrame(layout, residualOn);
            const [yLo, yHi] = yExtent(figureTraces.filter((t) => t.visible), stacked ? gap : 0);
            const py = layout.M.t + ((yHi - value) / (yHi - yLo)) * mainH;
            return { w: active.x[idx], v: value, px: hit.vx, py, label: active.label };
        },
        [plotXY, active, proc, unit, layout, residualOn, figureTraces, stacked, gap],
    );

    const placeAnchor = useCallback(
        (clientX: number, clientY: number, remove = false) => {
            if (!active || active.baseline.kind !== "manual") return;
            const hit = plotXY(clientX, clientY);
            if (!hit) return;
            const idx = nearestIndex(active.x, hit.w);
            const anchorX = active.x[idx];
            const yA = proc.get(active.id)?.yA ?? [];
            const anchors = active.baseline.anchors;
            const existing = anchors.findIndex((a) => Math.abs(a.x - anchorX) < 1e-9);
            if (remove && existing < 0) return;

            setTraces((prev) =>
                prev.map((t) => {
                    if (t.id !== active.id || t.baseline.kind !== "manual") return t;
                    const next = remove
                        ? anchors.filter((_, i) => i !== existing)
                        : [...anchors, { x: anchorX, y: yA[idx] }].sort((a, b) => b.x - a.x);
                    return { ...t, baseline: { ...t.baseline, anchors: next } };
                }),
            );
        },
        [active, plotXY, proc],
    );

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);

            // A click on the legend toggles that trace, the same gesture the
            // trace list offers. Geometry comes from the builder itself.
            const lg = legendGeometry(figureTraces, { layout, legendPos: null, showResidual: residualOn });
            const cvEl = canvasRef.current;
            if (lg && cvEl) {
                const r = cvEl.getBoundingClientRect();
                if (r.width > 0) {
                    const scale = r.width / layout.W;
                    const lx = (e.clientX - r.left) / scale;
                    const ly = (e.clientY - r.top) / scale;
                    const row = lg.rows.find(
                        (row) => lx >= row.x && lx <= row.x + row.w && ly >= row.y && ly <= row.y + row.h,
                    );
                    if (row) {
                        setTraces((prev) =>
                            prev.map((x) => (x.id === row.id ? { ...x, visible: !x.visible } : x)),
                        );
                        return;
                    }
                }
            }

            // Grabbing an existing anchor always wins: it is the finest target.
            if (active && active.baseline.kind === "manual") {
                const hit = plotXY(e.clientX, e.clientY);
                if (hit) {
                    const idx = nearestIndex(active.x, hit.w);
                    const existing = active.baseline.anchors.findIndex(
                        (a) => Math.abs(a.x - active.x[idx]) < 1e-9,
                    );
                    if (existing >= 0) {
                        if (e.shiftKey) {
                            placeAnchor(e.clientX, e.clientY, true);
                            return;
                        }
                        setDragIndex(
                            active.baseline.anchors.filter(
                                (a) => a.x > (active.baseline as { anchors: { x: number }[] }).anchors[existing].x,
                            ).length,
                        );
                        return;
                    }
                }
            }

            // Otherwise the drag is a view gesture: zoom, or pan with shift held.
            gesture.current = {
                mode: e.shiftKey ? "pan" : "zoom",
                startX: e.clientX,
                lo,
                hi,
            };
            setDragBox(null);
        },
        [active, plotXY, placeAnchor, lo, hi],
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const g = gesture.current;

            if (dragIndex !== null && active && active.baseline.kind === "manual") {
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
                setDragIndex(
                    active.baseline.anchors.filter((a, i) => i !== dragIndex && a.x > moved.x).length,
                );
                return;
            }

            if (g) {
                const dx = e.clientX - g.startX;
                if (Math.abs(dx) > 4) {
                    if (g.mode === "pan") {
                        const cv = canvasRef.current;
                        const r = cv?.getBoundingClientRect();
                        const { PW } = plotFrame(layout, residualOn);
                        const perPx = r && r.width > 0 ? (g.hi - g.lo) / (PW * (r.width / layout.W)) : 0;
                        const shift = dx * perPx;
                        const span = g.hi - g.lo;
                        let nl = g.lo + shift;
                        let nh = g.hi + shift;
                        if (nl < 400) { nl = 400; nh = 400 + span; }
                        if (nh > 4000) { nh = 4000; nl = 4000 - span; }
                        setLo(Math.round(nl));
                        setHi(Math.round(nh));
                    } else {
                        const hit = plotXY(g.startX, e.clientY);
                        const cur = (() => {
                            const cv = canvasRef.current;
                            const r = cv?.getBoundingClientRect();
                            if (!r || r.width === 0) return null;
                            return (e.clientX - r.left) / (r.width / layout.W);
                        })();
                        if (hit && cur !== null) setDragBox({ x1: hit.vx, x2: cur });
                    }
                }
                return;
            }

            setHover(readoutAt(e.clientX, e.clientY));
        },
        [dragIndex, active, dataX, proc, layout, residualOn, plotXY, readoutAt, lo, hi],
    );

    const addAnchorAtIndex = useCallback(
        (idx: number) => {
            if (!active || active.baseline.kind !== "manual") return null;
            const p = proc.get(active.id);
            if (!p) return null;
            const x = active.x[idx];
            if (x === undefined) return null;
            setTraces((prev) =>
                prev.map((t) => {
                    if (t.id !== active.id || t.baseline.kind !== "manual") return t;
                    if (t.baseline.anchors.some((a) => Math.abs(a.x - x) < 1e-9)) return t;
                    const next = [...t.baseline.anchors, { x, y: p.yA[idx] }].sort((a, b) => b.x - a.x);
                    return { ...t, baseline: { ...t.baseline, anchors: next } };
                }),
            );
            return x;
        },
        [active, proc],
    );

    const removeAnchorAtIndex = useCallback(
        (idx: number) => {
            if (!active || active.baseline.kind !== "manual") return null;
            const x = active.x[idx];
            if (x === undefined) return null;
            setTraces((prev) =>
                prev.map((t) => {
                    if (t.id !== active.id || t.baseline.kind !== "manual") return t;
                    const next = t.baseline.anchors.filter((a) => Math.abs(a.x - x) >= 1e-9);
                    return { ...t, baseline: { ...t.baseline, anchors: next } };
                }),
            );
            return x;
        },
        [active],
    );

    const onCanvasKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLCanvasElement>) => {
            if (!active) return;
            const stride = Math.max(1, Math.round(active.x.length / 400));
            const current = cursorIdx ?? nearestIndex(active.x, (lo + hi) / 2);

            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                const dir = e.key === "ArrowRight" ? 1 : -1;
                const next = Math.max(0, Math.min(active.x.length - 1, current + dir * stride));
                setCursorIdx(next);
                setLiveMsg(`${Math.round(active.x[next])} cm⁻¹`);
            } else if (e.key === "Home" || e.key === "End") {
                e.preventDefault();
                const next = e.key === "Home" ? 0 : active.x.length - 1;
                setCursorIdx(next);
                setLiveMsg(`${Math.round(active.x[next])} cm⁻¹`);
            } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (active.baseline.kind !== "manual") {
                    setLiveMsg("Switch the baseline to Manual to place anchors.");
                    return;
                }
                setCursorIdx(current);
                const at = addAnchorAtIndex(current);
                if (at !== null) {
                    const n = (active.baseline.kind === "manual" ? active.baseline.anchors.length : 0) + 1;
                    setLiveMsg(`Anchor at ${Math.round(at)} cm⁻¹. ${n} anchor${n === 1 ? "" : "s"}.`);
                }
            } else if (e.key === "Delete" || e.key === "Backspace") {
                e.preventDefault();
                if (active.baseline.kind !== "manual") return;
                const at = removeAnchorAtIndex(current);
                if (at !== null) setLiveMsg(`Anchor at ${Math.round(at)} cm⁻¹ removed.`);
            } else if (e.key === "Escape") {
                setCursorIdx(null);
                setLiveMsg("Cursor cleared.");
            }
        },
        [active, cursorIdx, lo, hi, addAnchorAtIndex, removeAnchorAtIndex],
    );

    const onPointerUp = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (dragIndex !== null) {
                setDragIndex(null);
                return;
            }
            const g = gesture.current;
            gesture.current = null;
            if (!g) return;

            const dx = e.clientX - g.startX;
            if (g.mode === "zoom") {
                if (Math.abs(dx) > 10) {
                    const a = dataX(g.startX);
                    const b = dataX(e.clientX);
                    if (a !== null && b !== null) {
                        const [nl, nh] = zoomWindow(a, b);
                        setLo(nl);
                        setHi(nh);
                    }
                } else if (active?.baseline.kind === "manual") {
                    // A click without movement places an anchor.
                    placeAnchor(e.clientX, e.clientY);
                }
                setDragBox(null);
            }
        },
        [dragIndex, dataX, active, placeAnchor],
    );

    const onDoubleClick = useCallback(() => {
        if (!traces.length) return;
        const xs = traces.flatMap((t) => [Math.min(...t.x), Math.max(...t.x)]);
        setLo(Math.max(400, Math.round(Math.min(...xs))));
        setHi(Math.min(4000, Math.round(Math.max(...xs))));
        setHover(null);
    }, [traces]);

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
        const captionMM = 7;
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [widthMM, heightMM + captionMM] });
        pdf.addImage(cv.toDataURL("image/png"), "PNG", 0, 0, widthMM, heightMM);

        // Provenance: a corrected spectrum with no stated method is not reproducible.
        const describe = (t: Trace) =>
            t.baseline.kind === "none"
                ? `${t.label}: raw`
                : t.baseline.kind === "rubberband"
                  ? `${t.label}: rubberband baseline`
                  : `${t.label}: baseline deg ${t.baseline.degree}, ${t.baseline.anchors.length} anchors`;
        const parts = traces.map(describe);
        if (peaksOn) parts.push(`${activePeaks.length} peaks`);
        parts.push(new Date().toISOString().slice(0, 10));
        pdf.setFontSize(6);
        pdf.setTextColor(90);
        pdf.text(parts.join(" · ").slice(0, 118), 1.5, heightMM + 3);
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
            const peakLine =
                peaksOn && t.id === active?.id && activePeaks.length
                    ? `# peaks: ${activePeaks.map((pk) => (pk.text === String(Math.round(pk.x)) ? String(Math.round(pk.x)) : `${Math.round(pk.x)} ${pk.text}`)).join("; ")}\n`
                    : "";
            return `# trace: ${t.label}\n# file: ${t.fileName}\n# baseline: ${method(t)}\n${peakLine}wavenumber,value\n${rows}`;
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
        <div className="space-y-4 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                    Parsing runs in this tab. The spectrum is never uploaded.
                </p>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-lg bg-orange-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
                    >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
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
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError(null)} aria-label="Dismiss">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {caution && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="flex-1">{caution}</span>
                </div>
            )}

            {/* Plot — the screen's question, given the full width */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800 p-3">
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
                        <div className="relative">
                            <canvas
                                ref={canvasRef}
                                onPointerDown={onPointerDown}
                                onPointerMove={onPointerMove}
                                onPointerUp={onPointerUp}
                                onPointerCancel={onPointerUp}
                                onPointerLeave={() => setHover(null)}
                                onDoubleClick={onDoubleClick}
                                onKeyDown={onCanvasKeyDown}
                                tabIndex={0}
                                role="application"
                                aria-label="FTIR spectrum plot. Arrow keys move a cursor along the trace, Enter places a baseline anchor, Delete removes it. Drag to zoom, shift-drag to pan, double-click to reset."
                                className={`block h-auto w-full rounded outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 ${manual ? "cursor-crosshair" : "cursor-default"}`}
                            />
                            <canvas
                                ref={overlayRef}
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 h-full w-full"
                            />
                        </div>
                    ) : (
                        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-600/70 px-6 py-10 text-center lg:min-h-[360px]">
                            <FlaskConical className="h-7 w-7 text-slate-400" />
                            <p className="font-medium text-slate-200">No spectra loaded</p>
                            <p className="max-w-md text-sm text-slate-400">
                                Drop a CSV, TXT or JCAMP-DX export here, or load a demo to see a finished
                                figure. Two-column text and JCAMP-DX are read; vendor binaries need a CSV
                                export first.
                            </p>
                            <div className="flex flex-wrap justify-center gap-2 pt-1">
                                <button
                                    onClick={() => loadDemo("ni-bdc")}
                                    className="rounded-md bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600"
                                >
                                    Ni-BDC demo
                                </button>
                                <button
                                    onClick={() => loadDemo("cu-bdc")}
                                    className="rounded-md bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600"
                                >
                                    Cu-BDC demo
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
                    <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        {hover ? (
                            <span className="tabular-nums text-slate-300">
                                {Math.round(hover.w)} cm⁻¹ ·{" "}
                                {hover.v.toFixed(unit === "absorbance" ? 3 : 1)}{" "}
                                {unit === "absorbance" ? "A" : "%T"}
                                <span className="ml-1.5 text-slate-400">{hover.label}</span>
                            </span>
                        ) : manual ? (
                            <>
                                <MousePointerClick className="h-3.5 w-3.5" />
                                Click to place an anchor, drag it sideways to slide, shift-click to remove.
                                Drag empty space to zoom.
                            </>
                        ) : peaksOn ? (
                            activePeaks.length
                                ? `${activePeaks.length} band${activePeaks.length === 1 ? "" : "s"} above the threshold`
                                : "No bands above the threshold. Lower the prominence to find weaker ones."
                        ) : (
                            "Turn on Peaks to label the bands on the corrected trace."
                        )}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {(lo > 400 || hi < 4000) && (
                            <button
                                onClick={onDoubleClick}
                                className="inline-flex items-center gap-1 rounded border border-slate-600/70 px-1.5 py-0.5 text-[11px] text-slate-300 hover:border-slate-500 hover:text-white"
                                title="Zoom back to the full spectrum"
                            >
                                <RotateCcw className="h-3 w-3" /> Reset view
                            </button>
                        )}
                        <label className="flex items-center gap-1.5">
                            <input
                                type="checkbox"
                                checked={peaksOn}
                                onChange={(e) => setPeaksOn(e.target.checked)}
                                className="h-4 w-4 accent-orange-500"
                            />
                            Peaks
                        </label>
                        {peaksOn && (
                            <>
                                <label className="flex items-center gap-1">
                                    ≥
                                    <input
                                        type="number"
                                        min={0.5}
                                        max={30}
                                        step={0.5}
                                        value={prominence}
                                        onChange={(e) => setProminence(Number(e.target.value))}
                                        className="w-12 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[11px] text-slate-100"
                                        aria-label="Minimum prominence percent"
                                    />
                                    %
                                </label>
                                <label className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min={2}
                                        max={200}
                                        step={2}
                                        value={minSep}
                                        onChange={(e) => setMinSep(Number(e.target.value))}
                                        className="w-12 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[11px] text-slate-100"
                                        aria-label="Minimum separation in wavenumbers"
                                    />
                                    cm⁻¹
                                </label>
                            </>
                        )}
                    </div>
                </div>
                {peaksOn && activePeaks.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 px-1">
                        {activePeaks.map((pk) =>
                            editingKey === pk.key ? (
                                <input
                                    key={pk.key}
                                    autoFocus
                                    value={labelEdits[pk.key] ?? pk.text}
                                    onChange={(e) =>
                                        setLabelEdits((prev) => ({ ...prev, [pk.key]: e.target.value }))
                                    }
                                    onBlur={() => setEditingKey(null)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === "Escape") setEditingKey(null);
                                    }}
                                    className="w-28 rounded border border-orange-500/60 bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-100"
                                    aria-label="Peak label"
                                />
                            ) : (
                                <button
                                    key={pk.key}
                                    onClick={() => {
                                        setLabelEdits((prev) => ({
                                            ...prev,
                                            [pk.key]: prev[pk.key] ?? pk.text,
                                        }));
                                        setEditingKey(pk.key);
                                    }}
                                    title="Click to rename this label"
                                    className="rounded border border-slate-600/60 bg-slate-900/60 px-1.5 py-0.5 text-[11px] text-slate-300 hover:border-slate-500 hover:text-slate-100"
                                >
                                    {labelEdits[pk.key] ?? pk.text}
                                </button>
                            ),
                        )}
                    </div>
                )}
            </div>

            {/* Controls — three columns that end level, no rail */}
            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
                <section className="flex h-full flex-col rounded-xl border border-slate-700/50 bg-slate-800 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-200">Traces</h2>
                        <span className="text-[11px] text-slate-400">{traces.length} loaded</span>
                    </div>
                    <div className="space-y-1">
                        {!hasTraces && (
                            <p className="text-sm text-slate-400">Nothing loaded yet.</p>
                        )}
                        {traces.map((t) => (
                            <div
                                key={t.id}
                                className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-sm ${
                                    t.id === active?.id ? "bg-slate-700/70" : ""
                                }`}
                            >
                                <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ background: t.color }}
                                />
                                {renamingId === t.id ? (
                                    <input
                                        autoFocus
                                        defaultValue={t.label}
                                        onBlur={(e) => {
                                            const v = e.target.value.trim();
                                            if (v) {
                                                setTraces((prev) =>
                                                    prev.map((x) => (x.id === t.id ? { ...x, label: v } : x)),
                                                );
                                            }
                                            setRenamingId(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") e.currentTarget.blur();
                                            if (e.key === "Escape") setRenamingId(null);
                                        }}
                                        aria-label="Trace name"
                                        className="min-w-0 flex-1 rounded border border-orange-500/60 bg-slate-900 px-1.5 py-0.5 text-sm text-slate-100"
                                    />
                                ) : (
                                    <button
                                        onClick={() => {
                                            setActiveId(t.id);
                                            setRenamingId(t.id);
                                        }}
                                        className="flex-1 truncate text-left text-slate-200 hover:text-white"
                                        title={`${t.fileName} — click to rename`}
                                    >
                                        {t.label}
                                    </button>
                                )}
                                <span className="shrink-0 text-[11px] text-slate-400">
                                    {t.baseline.kind === "none" ? "raw" : t.baseline.kind === "manual" ? "manual" : "auto"}
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
                                    {t.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                </button>
                                <button
                                    onClick={() => setTraces((p) => p.filter((x) => x.id !== t.id))}
                                    aria-label="Remove trace"
                                    className="text-slate-400 hover:text-red-400"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="mt-auto pt-3">
                        <button
                            onClick={() => loadDemo("cu-bdc")}
                            className="text-xs text-slate-400 hover:text-slate-200"
                        >
                            + add demo spectrum
                        </button>
                        {notes.length > 0 && (
                            <ul className="mt-2 space-y-1 border-t border-slate-700/60 pt-2 text-[11px] text-slate-400">
                                {notes.slice(-2).map((n, i) => (
                                    <li key={i}>{n}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>

                <section className="flex h-full flex-col rounded-xl border border-slate-700/50 bg-slate-800 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-200">Baseline</h2>
                        <span className="max-w-[9rem] truncate text-[11px] text-slate-400">
                            {active ? active.label : "no trace"}
                        </span>
                    </div>
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
                                className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                                    active?.baseline.kind === kind
                                        ? "bg-orange-700 text-white"
                                        : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {manual && (
                        <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-slate-400">Fit degree</span>
                                <div className="flex gap-1">
                                    {([1, 2, 3] as const).map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setActiveDegree(d)}
                                            className={`rounded px-2 py-0.5 text-xs ${
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
                            <p className="text-[11px] text-slate-400">
                                {anchorCount} anchor{anchorCount === 1 ? "" : "s"} · degree {activeDegree} needs{" "}
                                {activeDegree + 1}
                            </p>
                            <label className="flex items-center gap-2 text-[11px] text-slate-400">
                                <input
                                    type="checkbox"
                                    checked={editingRaw}
                                    onChange={(e) => setEditingRaw(e.target.checked)}
                                    className="h-4 w-4 accent-orange-500"
                                />
                                Show raw while placing anchors
                            </label>
                        </div>
                    )}

                    {active?.baseline.kind === "rubberband" && (
                        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                            Lower convex hull in absorbance, parameter-free, same as instrument software.
                            Check the residual before trusting it.
                        </p>
                    )}

                    {active?.baseline.kind === "none" && (
                        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                            No baseline applied. Exports carry the raw spectrum.
                        </p>
                    )}

                    <div className="mt-auto flex gap-2 pt-3">
                        <button
                            onClick={clearAnchors}
                            disabled={!manual}
                            title={manual ? "Remove every anchor on this trace" : "Only available in Manual mode"}
                            className="flex-1 rounded-md bg-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-600 disabled:opacity-40"
                        >
                            Clear
                        </button>
                        <button
                            onClick={applyToAll}
                            disabled={!active || traces.length < 2}
                            title={traces.length < 2 ? "Load a second spectrum to copy the method onto" : "Copy this baseline method to every trace"}
                            className="flex-1 rounded-md bg-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-600 disabled:opacity-40"
                        >
                            Apply to all
                        </button>
                    </div>
                </section>

                <section className="flex h-full flex-col rounded-xl border border-slate-700/50 bg-slate-800 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-200">View</h2>
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <input
                                type="checkbox"
                                checked={showResidual}
                                onChange={(e) => setShowResidual(e.target.checked)}
                                className="h-4 w-4 accent-orange-500"
                            />
                            Residual
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                        {(["transmittance", "absorbance"] as AxisUnit[]).map((u) => (
                            <button
                                key={u}
                                onClick={() => setUnit(u)}
                                className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                                    unit === u
                                        ? "bg-orange-700 text-white"
                                        : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                }`}
                            >
                                {u === "transmittance" ? "%T" : "Absorbance"}
                            </button>
                        ))}
                    </div>

                    {showResidual && unit !== "absorbance" && (
                        <p className="mt-2 text-[11px] text-amber-300/80">
                            The residual is an absorbance quantity. Switch to Absorbance to see it.
                        </p>
                    )}

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <label className="text-[11px] text-slate-400">
                            High cm⁻¹
                            <input
                                type="number"
                                value={hi}
                                onChange={(e) => setHi(Number(e.target.value))}
                                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                            />
                        </label>
                        <label className="text-[11px] text-slate-400">
                            Low cm⁻¹
                            <input
                                type="number"
                                value={lo}
                                onChange={(e) => setLo(Number(e.target.value))}
                                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                            />
                        </label>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-[11px] text-slate-300">
                            <input
                                type="checkbox"
                                checked={stacked}
                                onChange={(e) => setStacked(e.target.checked)}
                                className="h-4 w-4 accent-orange-500"
                            />
                            Waterfall
                        </label>
                        <input
                            type="number"
                            value={gap}
                            onChange={(e) => setGap(Number(e.target.value))}
                            disabled={!stacked}
                            className="w-16 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 disabled:opacity-40"
                            aria-label="Waterfall gap"
                        />
                        <button
                            onClick={() => {
                                if (!traces.length) return;
                                const xs = traces.flatMap((t) => [Math.min(...t.x), Math.max(...t.x)]);
                                setLo(Math.max(400, Math.min(...xs)));
                                setHi(Math.min(4000, Math.round(Math.max(...xs))));
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                        >
                            <RotateCcw className="h-3 w-3" /> Fit
                        </button>
                    </div>
                    {stacked && (
                        <p className="mt-1 text-[11px] text-slate-400">
                            Each visible trace sits {gap} {unit === "absorbance" ? "A" : "%T"} above the one
                            under it.
                        </p>
                    )}

                    <div className="mt-auto grid grid-cols-2 gap-1.5 pt-3">
                        <button
                            onClick={exportPNG}
                            disabled={!hasTraces}
                            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-700 px-2 py-2 text-xs text-slate-100 hover:bg-slate-600 disabled:opacity-40"
                        >
                            <ImageIcon className="h-3.5 w-3.5" /> PNG
                        </button>
                        <button
                            onClick={exportSVG}
                            disabled={!hasTraces}
                            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-700 px-2 py-2 text-xs text-slate-100 hover:bg-slate-600 disabled:opacity-40"
                        >
                            <FileText className="h-3.5 w-3.5" /> SVG
                        </button>
                        <button
                            onClick={exportPDF}
                            disabled={!hasTraces}
                            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-700 px-2 py-2 text-xs text-slate-100 hover:bg-slate-600 disabled:opacity-40"
                        >
                            <Download className="h-3.5 w-3.5" /> PDF 85 mm
                        </button>
                        <button
                            onClick={exportCSV}
                            disabled={!hasTraces}
                            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-700 px-2 py-2 text-xs text-slate-100 hover:bg-slate-600 disabled:opacity-40"
                        >
                            <FileText className="h-3.5 w-3.5" /> CSV
                        </button>
                    </div>
                </section>
            </div>

            <details className="group rounded-xl border border-slate-700/50 bg-slate-800/60 px-4 py-3">
                <summary className="cursor-pointer text-xs font-medium text-slate-300 marker:text-slate-400">
                    How the processing works
                </summary>
                <dl className="mt-3 grid gap-3 text-[11px] leading-relaxed text-slate-400 sm:grid-cols-2">
                    <div>
                        <dt className="font-medium text-slate-300">Formats</dt>
                        <dd>
                            Two-column text (CSV, TXT, DAT, ASC, PRN, DPT, XY) and JCAMP-DX. Vendor binaries
                            such as Bruker OPUS or PerkinElmer .sp need exporting to CSV from the instrument
                            software first.
                        </dd>
                    </div>
                    <div>
                        <dt className="font-medium text-slate-300">Why the baseline runs in absorbance</dt>
                        <dd>
                            Beer-Lambert is additive in absorbance and multiplicative in %T, so subtracting a
                            baseline from transmittance is not the same operation. The maths always uses
                            absorbance; switching the axis only changes what you see.
                        </dd>
                    </div>
                    <div>
                        <dt className="font-medium text-slate-300">Automatic baseline</dt>
                        <dd>
                            A lower convex hull over the trimmed interior of the scan, with no parameters to
                            tune. It can climb into a broad band, which is what the residual strip and the
                            warning are for. Manual anchors exist because you know where the quiet regions are.
                        </dd>
                    </div>
                    <div>
                        <dt className="font-medium text-slate-300">Peaks and provenance</dt>
                        <dd>
                            Peaks are found on the corrected trace, never on the raw one. Labels are yours to
                            edit and are never assigned automatically. Where two labels would overlap, one is
                            dropped rather than printed on top of the other; every detected position stays in
                            the chips under the plot. Exports record the method and the peak list.
                        </dd>
                    </div>
                </dl>
            </details>

            <p aria-live="polite" className="sr-only">
                {liveMsg}
            </p>

            {toast && (
                <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 shadow-xl">
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
