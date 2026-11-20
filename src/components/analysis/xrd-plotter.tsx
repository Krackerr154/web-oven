"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import { detectPeaks, matchPhase, type Peak } from "@/lib/xrd/phase-match";
import { PhaseMatchPanel, type ScanMatch } from "@/components/analysis/phase-match-panel";
import {
    Upload, X, Download, FileText, Image as ImageIcon, Loader2, GripVertical, Eye, EyeOff, FlaskConical,
    Save, FolderOpen, Trash2, History,
} from "lucide-react";
import {
    saveCurrent, loadCurrent, clearCurrent, saveNamed, listNamed, loadByKey, deleteByKey,
    requestPersistentStorage, storageEstimate,
    type StoredSession, type StoredTrace,
} from "@/lib/xrd-session";
import {
    PALETTE, PRINT_LAYOUT, clamp01, screenLayout, snapLegendPos, paintCanvas, toSVG,
    type Layout, type Prim,
} from "@/lib/plot/core";
import { buildFigure, type Overlay, type Reference, type Trace } from "@/lib/xrd/figure";
import { parseScan } from "@/lib/xrd/parse";

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
    const currentPrimsRef = useRef<Prim[]>([]);
    const currentLayoutRef = useRef<Layout | null>(null);
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
    const [showHelp, setShowHelp] = useState(false);
    const [exportToast, setExportToast] = useState<{ msg: string; t: number } | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    // ---- draggable legend ---------------------------------------------------
    // legendPos is the committed placement (null = automatic corner choice).
    // legendDrag is the live gesture; it suppresses the click-to-toggle once the
    // pointer has travelled far enough to count as a drag.
    const [legendPos, setLegendPos] = useState<{ fx: number; fy: number } | null>(null);
    const [legendDrag, setLegendDrag] = useState<{
        /** Pointer offset inside the panel when the drag started, in canvas px. */
        grabDX: number;
        grabDY: number;
        /** Pointer position at grab time, for the click-vs-drag threshold. */
        startPx: number;
        startPy: number;
        curX: number;
        curY: number;
        moved: boolean;
    } | null>(null);
    const legendDragRef = useRef<typeof legendDrag>(null);
    // ---- local persistence -------------------------------------------------
    // The working session is autosaved; named saves are explicit user actions.
    // `restored` gates the autosave effect so an empty first render cannot
    // overwrite a saved session before it has been read back.
    const [restored, setRestored] = useState(false);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [savedList, setSavedList] = useState<StoredSession[]>([]);
    const [showSaved, setShowSaved] = useState(false);
    const [saveName, setSaveName] = useState("");
    const [persisted, setPersisted] = useState<boolean | null>(null);
    const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
    const [persistError, setPersistError] = useState<string | null>(null);
    // Drag-to-zoom / shift-drag pan. The live rectangle is mirrored into a ref
    // so the pointer handlers can read the current gesture without waiting for
    // a re-render; state drives the repaint.
    const [zoomDrag, setZoomDrag] = useState<{
        startX: number;
        startY: number;
        curX: number;
        curY: number;
        pan: boolean;
        moved: boolean;
    } | null>(null);
    const zoomDragRef = useRef<typeof zoomDrag>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const cifRef = useRef<HTMLInputElement | null>(null);
    const saveNameRef = useRef<HTMLInputElement | null>(null);

    // Everything downstream of the figure works on active traces only.
    const visibleTraces = useMemo(() => traces.filter((t) => t.visible), [traces]);

    // ---- restore on mount --------------------------------------------------
    // Read back the autosaved session once. IndexedDB keeps Float64Arrays as
    // arrays of doubles, so the trace is rebuilt with its original numeric
    // precision — no CSV round-trip, no loss of the 5th decimal.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const session = await loadCurrent();
                if (cancelled) return;
                if (session) {
                    const restoredTraces: Trace[] = session.traces.map((t) => ({
                        id: t.id,
                        label: t.label,
                        fileName: t.fileName,
                        color: t.color,
                        visible: t.visible,
                        peak2Theta: t.peak2Theta,
                        peakIntensity: t.peakIntensity,
                        x: Array.from(t.x),
                        y: Array.from(t.y),
                    }));
                    setTraces(restoredTraces);
                    setLo(session.settings.lo);
                    setHi(session.settings.hi);
                    setGap(session.settings.gap);
                    setStacked(session.settings.stacked);
            setLegendPos(session.settings.legendPos ?? null);
                    setReference(session.reference ?? null);
                    setSavedAt(session.savedAt);
                }
                const list = await listNamed();
                if (!cancelled) setSavedList(list);
                const est = await storageEstimate();
                if (!cancelled) setStorage(est);
                const ok = await requestPersistentStorage();
                if (!cancelled) setPersisted(ok);
            } catch (e) {
                // Private mode, disabled storage, or a blocked upgrade. The
                // plotter must still work; it just will not remember.
                if (!cancelled) {
                    setPersistError(
                        e instanceof Error ? e.message : "Local saving is unavailable in this browser",
                    );
                }
            } finally {
                if (!cancelled) setRestored(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // ---- autosave ----------------------------------------------------------
    // Debounced: a session write copies up to 8 × 7,500 doubles, so it must not
    // run on every pointer move while the user drags the offset slider.
    useEffect(() => {
        if (!restored) return;
        if (traces.length === 0 && !reference) {
            // Everything was removed on purpose: clear the autosave so the
            // deleted scans do not come back on the next reload.
            clearCurrent().catch(() => {});
            setSavedAt(null);
            setSaveState("idle");
            return;
        }
        setSaveState("saving");
        const timer = setTimeout(async () => {
            try {
                const payload = {
                    savedAt: Date.now(),
                    traces: traces.map<StoredTrace>((t) => ({
                        id: t.id,
                        label: t.label,
                        fileName: t.fileName,
                        color: t.color,
                        visible: t.visible,
                        peak2Theta: t.peak2Theta,
                        peakIntensity: t.peakIntensity,
                        x: Float64Array.from(t.x),
                        y: Float64Array.from(t.y),
                    })),
                    settings: { lo, hi, gap, stacked, legendPos },
                    reference,
                };
                await saveCurrent(payload);
                setSaveState("saved");
                setSavedAt(payload.savedAt);
            } catch (e) {
                setSaveState("error");
                setPersistError(
                    e instanceof Error ? e.message : "Could not save this session locally",
                );
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [restored, traces, lo, hi, gap, stacked, reference, legendPos]);

    // Auto-dismiss export toast after 3s
    useEffect(() => {
        if (!exportToast) return;
        const timer = setTimeout(() => setExportToast(null), 3000);
        return () => clearTimeout(timer);
    }, [exportToast]);

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
    const [vh, setVh] = useState(900);
    useEffect(() => {
        const onResize = () => setVh(window.innerHeight);
        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // Same height rule as the FTIR plotter: wide, but never so tall that the
    // controls below the figure fall off the first screen.
    const layout = useMemo(() => {
        const base = screenLayout(canvasW || 860);
        const w = canvasW || 860;
                const budget = w < 900 ? vh - 824 : vh - 566;
        const h = Math.round(Math.min(470, Math.max(200, Math.min(w * 0.36, budget))));
        return { ...base, H: h };
    }, [canvasW, vh]);

    const prims = useMemo(
        () => (traces.length || reference
            ? buildFigure(
                visibleTraces, viewLo, viewHi, gap, stacked, reference, overlay, layout, traces,
                // While dragging, follow the pointer; otherwise use the committed
                // fraction so the panel lands back where the user left it.
                legendDragRef.current?.moved
                    ? {
                        fx: clamp01((legendDragRef.current.curX - (layout.M.l + 2)) / Math.max(1, layout.W - layout.M.l - layout.M.r - 4)),
                        fy: clamp01((legendDragRef.current.curY - (layout.M.t + 2)) / Math.max(1, layout.H - layout.M.t - layout.M.b - 4)),
                    }
                    : legendPos,
            )
            : []),
        [visibleTraces, viewLo, viewHi, gap, stacked, reference, overlay, layout, traces, legendPos, legendDrag],
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
        // Store for click handling
        currentPrimsRef.current = prims;
        currentLayoutRef.current = layout;
    }, [prims, layout]);

    useEffect(() => {
        paint();
    }, [paint]);

    // ---- legend hit test --------------------------------------------------
    // The legend is drawn INSIDE the plot rectangle, so it overlaps the
    // drag-to-zoom area. Both handlers must agree on where it is or clicking a
    // legend entry would also start a zoom band.
    //
    // The geometry is NOT recomputed here. The painter records a hitRect on
    // every legend row, and this reads it. Recomputing would have to duplicate
    // the corner choice, column count and row height — three things that now
    // vary — and the first divergence would toggle the wrong series.
    const legendSlotAt = useCallback(
        (cx: number, cy: number): Trace | null => {
            const L = currentLayoutRef.current;
            const prims = currentPrimsRef.current;
            if (!L || !L.legendInPlot || !prims.length) return null;
            for (const p of prims) {
                if (p.t !== "text" || !p.data?.traceId || !p.data.hitRect) continue;
                const r = p.data.hitRect;
                if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
                    return traces.find((t) => t.id === p.data!.traceId) ?? null;
                }
            }
            return null;
        },
        [traces],
    );

    // ---- legend panel hit test ---------------------------------------------
    // Returns the panel rect if the pointer is anywhere on it, including the
    // padding. Before this, a press on the panel's inner margin fell through to
    // the zoom handler and started a rubber band.
    const legendPanelAt = useCallback((cx: number, cy: number) => {
        const prims = currentPrimsRef.current;
        for (const p of prims) {
            if (p.t !== "rect" || !p.data?.legendPanel) continue;
            const r = p.data.legendPanel;
            if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) return r;
        }
        return null;
    }, []);

    // ---- legend drag --------------------------------------------------------
    const onLegendDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>): boolean => {
            const c = canvasRef.current;
            const L = currentLayoutRef.current;
            if (!c || !L) return false;
            const rect = c.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const panel = legendPanelAt(cx, cy);
            if (!panel) return false;

            const start = {
                grabDX: cx - panel.x,
                grabDY: cy - panel.y,
                startPx: cx,
                startPy: cy,
                curX: panel.x,
                curY: panel.y,
                moved: false,
            };
            setLegendDrag(start);
            legendDragRef.current = start;
            setHover(null);
            c.setPointerCapture?.(e.pointerId);
            return true;
        },
        [legendPanelAt],
    );

    const onLegendMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const cur = legendDragRef.current;
        if (!cur) return;
        const c = canvasRef.current;
        if (!c) return;
        const rect = c.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const next = {
            ...cur,
            curX: cx - cur.grabDX,
            curY: cy - cur.grabDY,
            // Distance from the ORIGINAL grab point, not the last frame: a slow
            // drag accumulating 2 px per frame would otherwise never register.
            moved: cur.moved || Math.hypot(cx - cur.startPx, cy - cur.startPy) > 4,
        };
        legendDragRef.current = next;
        setLegendDrag(next);
    }, []);

    const onLegendUp = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const cur = legendDragRef.current;
            legendDragRef.current = null;
            setLegendDrag(null);
            if (!cur) return false;
            canvasRef.current?.releasePointerCapture?.(e.pointerId);

            if (!cur.moved) {
                // A press on the panel that never travelled is a click on a
                // legend row: toggle that series. This is applied here rather
                // than on pointerdown because the panel claims the press before
                // the toggle can run, and a drag must not toggle anything.
                const c = canvasRef.current;
                if (c) {
                    const r = c.getBoundingClientRect();
                    const hit = legendSlotAt(e.clientX - r.left, e.clientY - r.top);
                    if (hit) {
                        setTraces((prev) =>
                            prev.map((t) => (t.id === hit.id ? { ...t, visible: !t.visible } : t)),
                        );
                    }
                }
                return true; // panel press is always handled; never a zoom click
            }

            const L = currentLayoutRef.current;
            if (!L) return true;
            const { M, W, H } = L;
            const PW = W - M.l - M.r;
            const PH = H - M.t - M.b;
            // Reachable span differs per axis, so the fraction is computed
            // against each axis separately rather than assuming a square.
            const spanX = PW - 4;
            const spanY = PH - 4;
            const fx = clamp01((cur.curX - (M.l + 2)) / Math.max(1, spanX));
            const fy = clamp01((cur.curY - (M.t + 2)) / Math.max(1, spanY));
            setLegendPos(snapLegendPos({ fx, fy }, spanX, spanY));
            return true;
        },
        [legendSlotAt],
    );

    // ---- drag-to-zoom / shift-drag pan / double-click reset ----------------
    // Mapping helpers. The plot area is M.l..M.l+PW horizontally, and 2θ runs
    // viewLo..viewHi across it, so pixel↔angle is a straight lerp.
    const pxToTwoTheta = useCallback(
        (px: number) => {
            const { M, W } = layout;
            const PW = W - M.l - M.r;
            const f = (px - M.l) / PW;
            return viewLo + f * (viewHi - viewLo);
        },
        [layout, viewLo, viewHi],
    );

    // Clamp to the measured extent so a zoom can never strand the user in an
    // empty angle range with no data and no way to see what happened.
    const clampRange = useCallback(
        (a: number, b: number) => {
            const { min, max } = dataExtent;
            let next = Math.min(a, b);
            let hiNext = Math.max(a, b);
            if (hiNext - next < 0.05) return null; // degenerate: a click, not a drag
            next = Math.max(min, next);
            hiNext = Math.min(max, hiNext);
            if (hiNext - next < 0.05) return null;
            return [next, hiNext] as const;
        },
        [dataExtent],
    );

    const resetZoom = useCallback(() => {
        setLo(dataExtent.min);
        setHi(dataExtent.max);
        setLoDraft(null);
        setHiDraft(null);
    }, [dataExtent]);

    const onZoomDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const c = canvasRef.current;
            const L = currentLayoutRef.current;
            if (!c || !L || !traces.length) return;
            const rect = c.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const { M, W, H } = L;
            const PW = W - M.l - M.r;
            const PH = H - M.t - M.b;
            // Only inside the plot area — the legend and margins stay inert.
            if (cx < M.l || cx > M.l + PW || cy < M.t || cy > M.t + PH) return;
            // A press on the legend is a visibility toggle, not a zoom start.
            if (legendSlotAt(cx, cy)) return;

            const drag = {
                startX: cx,
                startY: cy,
                curX: cx,
                curY: cy,
                pan: e.shiftKey,
                moved: false,
            };
            setHover(null); // the readout would sit under the rubber band
            setZoomDrag(drag);
            zoomDragRef.current = drag;
            // Capture so a drag that leaves the canvas still completes.
            c.setPointerCapture?.(e.pointerId);
        },
        [traces.length, legendSlotAt],
    );

    const onZoomMove = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const cur = zoomDragRef.current;
            if (!cur) return;
            const c = canvasRef.current;
            if (!c) return;
            const rect = c.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const next = {
                ...cur,
                curX: cx,
                curY: cy,
                moved: cur.moved || Math.abs(cx - cur.startX) > 2,
            };
            zoomDragRef.current = next;
            setZoomDrag(next);
        },
        [],
    );

    const onZoomUp = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const cur = zoomDragRef.current;
            zoomDragRef.current = null;
            setZoomDrag(null);
            if (!cur) return;
            canvasRef.current?.releasePointerCapture?.(e.pointerId);
            if (!cur.moved) return; // a plain click: leave the view alone

            if (cur.pan) {
                // Shift-drag pans: shift the window by the dragged pixel span,
                // keeping its width. Clamped to the measured extent.
                const { M, W } = layout;
                const PW = W - M.l - M.r;
                const span = viewHi - viewLo;
                const delta = ((cur.startX - cur.curX) / PW) * span;
                const { min, max } = dataExtent;
                let nextLo = viewLo + delta;
                if (nextLo < min) nextLo = min;
                if (nextLo + span > max) nextLo = max - span;
                if (nextLo < min) nextLo = min;
                // Same 0.01° rounding as zoom: the fields are read by humans.
                const round2 = (v: number) => Math.round(v * 100) / 100;
                setLo(round2(nextLo));
                setHi(round2(Math.min(nextLo + span, max)));
                setLoDraft(null);
                setHiDraft(null);
                return;
            }

            const a = pxToTwoTheta(cur.startX);
            const b = pxToTwoTheta(cur.curX);
            const range = clampRange(a, b);
            if (!range) return;
            // Round to 0.01° so the side-panel fields read cleanly instead of
            // showing 9.27318462.
            const [nextLo, nextHi] = [
                Math.round(range[0] * 100) / 100,
                Math.round(range[1] * 100) / 100,
            ];
            setLo(nextLo);
            setHi(nextHi);
            setLoDraft(null);
            setHiDraft(null);
        },
        [layout, viewLo, viewHi, dataExtent, pxToTwoTheta, clampRange],
    );

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

        // ---- zoom / pan rectangle -----------------------------------------
        // Drawn before the early return so the rubber band is visible even
        // though no hover readout is active during a drag.
        if (zoomDrag && zoomDrag.moved) {
            const { M } = layout;
            const PW = layout.W - M.l - M.r;
            const PH = layout.H - M.t - M.b;
            const x0 = Math.max(M.l, Math.min(zoomDrag.startX, zoomDrag.curX));
            const x1 = Math.min(M.l + PW, Math.max(zoomDrag.startX, zoomDrag.curX));

            if (zoomDrag.pan) {
                // Pan: a vertical cursor plus the px→degrees shift, so the user
                // can see how far the window is travelling before releasing.
                ctx.strokeStyle = "rgba(249,115,22,0.9)";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 3]);
                ctx.beginPath();
                ctx.moveTo(zoomDrag.curX, M.t);
                ctx.lineTo(zoomDrag.curX, M.t + PH);
                ctx.stroke();
                ctx.setLineDash([]);

                const span = viewHi - viewLo;
                const delta = ((zoomDrag.startX - zoomDrag.curX) / PW) * span;
                const label = `pan ${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(2)}°`;
                ctx.font = "600 11px system-ui, -apple-system, sans-serif";
                const tw = ctx.measureText(label).width;
                const lx = Math.min(Math.max(zoomDrag.curX + 8, M.l + 2), M.l + PW - tw - 10);
                ctx.fillStyle = "rgba(249,115,22,0.95)";
                ctx.beginPath();
                ctx.roundRect(lx - 4, M.t + 4, tw + 8, 17, 3);
                ctx.fill();
                ctx.fillStyle = "#FFFFFF";
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.fillText(label, lx, M.t + 13);
            } else {
                // Zoom: shaded band plus the resulting angle range.
                ctx.fillStyle = "rgba(249,115,22,0.14)";
                ctx.fillRect(x0, M.t, x1 - x0, PH);
                ctx.strokeStyle = "rgba(249,115,22,0.95)";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 3]);
                ctx.strokeRect(x0, M.t, x1 - x0, PH);
                ctx.setLineDash([]);

                const from = pxToTwoTheta(x0);
                const to = pxToTwoTheta(x1);
                const label = `${from.toFixed(2)}° – ${to.toFixed(2)}°`;
                ctx.font = "600 11px system-ui, -apple-system, sans-serif";
                const tw = ctx.measureText(label).width;
                const lx = Math.min(Math.max((x0 + x1) / 2 - tw / 2, M.l + 2), M.l + PW - tw - 10);
                ctx.fillStyle = "rgba(249,115,22,0.95)";
                ctx.beginPath();
                ctx.roundRect(lx - 5, M.t + 4, tw + 10, 17, 3);
                ctx.fill();
                ctx.fillStyle = "#FFFFFF";
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.fillText(label, lx, M.t + 13);
            }
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";
        }

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

        // value box — sized to the widest label so two traces that share a long
        // prefix stay distinguishable instead of collapsing to the same text.
        const rowH = 15;
        const numW = 62;
        ctx.font = "400 11px system-ui, -apple-system, sans-serif";
        let widest = 0;
        for (const r of hover.rows) {
            const w = ctx.measureText(r.label).width;
            if (w > widest) widest = w;
        }
        const boxW = Math.min(
            Math.max(170, widest + 22 + 8 + numW + 10),
            Math.min(300, layout.W - 24),
        );
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
        const labelMax = boxW - 22 - 8 - numW;
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
    }, [hover, layout, visibleTraces.length, zoomDrag, pxToTwoTheta, viewLo, viewHi]);

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
            
            // Update hover state for visual feedback
            setDragOverId(overId && overId !== dragId ? overId : null);
            
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

        const end = () => {
            setDragId(null);
            setDragOverId(null);
        };

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
        paintCanvas(cv, buildFigure(visibleTraces, viewLo, viewHi, gap, stacked, reference, overlay, PRINT_LAYOUT, undefined, legendPos),
            PRINT_LAYOUT.W, PRINT_LAYOUT.H, 2.6);
        const a = document.createElement("a");
        const fname = `AP-Lab_XRD_${stamp()}.png`;
        a.href = cv.toDataURL("image/png");
        a.download = fname;
        a.click();
        setExportToast({ msg: `Downloaded ${fname}`, t: Date.now() });
    }

    function exportSVG() {
        const svg = toSVG(
            buildFigure(visibleTraces, viewLo, viewHi, gap, stacked, reference, overlay, PRINT_LAYOUT, undefined, legendPos),
            PRINT_LAYOUT.W,
            PRINT_LAYOUT.H,
        );
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const fname = `AP-Lab_XRD_${stamp()}.svg`;
        a.href = url;
        a.download = fname;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setExportToast({ msg: `Downloaded ${fname}`, t: Date.now() });
    }

    function exportPDF() {
        const cv = document.createElement("canvas");
        paintCanvas(cv, buildFigure(visibleTraces, viewLo, viewHi, gap, stacked, reference, overlay, PRINT_LAYOUT, undefined, legendPos),
            PRINT_LAYOUT.W, PRINT_LAYOUT.H, 2.6);
        const img = cv.toDataURL("image/png");
        const widthMM = 85;
        const heightMM = (widthMM * PRINT_LAYOUT.H) / PRINT_LAYOUT.W;
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [widthMM, heightMM] });
        pdf.addImage(img, "PNG", 0, 0, widthMM, heightMM);
        const fname = `AP-Lab_XRD_${stamp()}.pdf`;
        pdf.save(fname);
        setExportToast({ msg: `Downloaded ${fname}`, t: Date.now() });
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
        const fname = `AP-Lab_XRD_${stamp()}.csv`;
        a.href = url;
        a.download = fname;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setExportToast({ msg: `Downloaded ${fname}`, t: Date.now() });
    }

    const empty = traces.length === 0 && !reference;

    // ---- named saves -------------------------------------------------------
    async function handleSaveNamed() {
        const name = saveName.trim() || defaultSaveName();
        try {
            const payload = {
                savedAt: Date.now(),
                traces: traces.map<StoredTrace>((t) => ({
                    id: t.id,
                    label: t.label,
                    fileName: t.fileName,
                    color: t.color,
                    visible: t.visible,
                    peak2Theta: t.peak2Theta,
                    peakIntensity: t.peakIntensity,
                    x: Float64Array.from(t.x),
                    y: Float64Array.from(t.y),
                })),
                settings: { lo, hi, gap, stacked, legendPos },
                reference,
            };
            await saveNamed(name, payload);
            const list = await listNamed();
            setSavedList(list);
            const est = await storageEstimate();
            setStorage(est);
            setSaveName("");
            setPersisted(await requestPersistentStorage());
            setExportToast({ msg: `Saved “${name}” in this browser`, t: Date.now() });
        } catch (e) {
            setPersistError(e instanceof Error ? e.message : "Could not save this session");
        }
    }

    /** Names a save after the loaded traces, so the default is not just a date. */
    function defaultSaveName() {
        const labels = traces.map((t) => t.label).filter(Boolean);
        if (labels.length === 0) return `Session ${new Date().toLocaleDateString()}`;
        if (labels.length === 1) return labels[0].slice(0, 60);
        return `${labels[0].slice(0, 40)} +${labels.length - 1}`;
    }

    async function handleLoadSaved(key: string) {
        try {
            const session = await loadByKey(key);
            if (!session) return;
            setTraces(
                session.traces.map((t) => ({
                    id: t.id,
                    label: t.label,
                    fileName: t.fileName,
                    color: t.color,
                    visible: t.visible,
                    peak2Theta: t.peak2Theta,
                    peakIntensity: t.peakIntensity,
                    x: Array.from(t.x),
                    y: Array.from(t.y),
                })),
            );
            setLo(session.settings.lo);
            setHi(session.settings.hi);
            setGap(session.settings.gap);
            setStacked(session.settings.stacked);
            setLegendPos(session.settings.legendPos ?? null);
            setReference(session.reference ?? null);
            // A restored session invalidates any phase scores computed against
            // the previous traces, so clear them rather than show stale numbers.
            setMatchResults(null);
            setSelectedMatchId(null);
            setShowSaved(false);
            setExportToast({ msg: `Loaded “${session.name ?? "session"}”`, t: Date.now() });
        } catch (e) {
            setPersistError(e instanceof Error ? e.message : "Could not load that session");
        }
    }

    async function handleDeleteSaved(key: string, name?: string) {
        const label = name ?? "this session";
        if (!window.confirm(`Delete “${label}” from this browser? This cannot be undone.`)) return;
        try {
            await deleteByKey(key);
            setSavedList(await listNamed());
            setStorage(await storageEstimate());
        } catch (e) {
            setPersistError(e instanceof Error ? e.message : "Could not delete that session");
        }
    }

    function bytesLabel(n: number) {
        if (n < 1024) return `${n} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
        return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    }
    // Nothing on the figure: every scan hidden and no reference to show either.
    const nothingVisible = visibleTraces.length === 0 && !reference?.visible;

    return (
        <div className="space-y-3">
            {error && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    {error}
                </div>
            )}

            {/* Top actions bar */}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                    className="flex items-center gap-2 rounded-lg bg-orange-700 hover:bg-orange-500 disabled:opacity-40 px-3 py-2 text-xs font-bold text-white transition-colors"
                >
                    <Upload className="h-3.5 w-3.5" /> Load scan from file
                </button>
                <button
                    type="button"
                    onClick={() => setShowHelp(!showHelp)}
                    title="Keyboard shortcuts and tips"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-2 text-xs text-slate-400 hover:text-white hover:border-orange-500/60 transition-colors"
                >
                    <span className="text-[13px] font-semibold">?</span> Help
                </button>

                {/* Session controls. Autosave means the working state survives a
                    reload without any action; the buttons exist for naming a
                    session, coming back to it later, and clearing it. */}
                {!empty && (
                    <button
                        type="button"
                        onClick={() => {
                            // Open the panel rather than save silently: a save
                            // the user cannot name is one they cannot find again.
                            setShowSaved(true);
                            requestAnimationFrame(() => saveNameRef.current?.focus());
                        }}
                        title="Save this session under a name in this browser"
                        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-2 text-xs text-slate-300 hover:text-white hover:border-orange-500/60 transition-colors"
                    >
                        <Save className="h-3.5 w-3.5" /> Save
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => setShowSaved((v) => !v)}
                    title="Saved sessions in this browser"
                    aria-expanded={showSaved}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-2 text-xs text-slate-400 hover:text-white hover:border-orange-500/60 transition-colors"
                >
                    <History className="h-3.5 w-3.5" /> Sessions
                    {savedList.length > 0 && (
                        <span className="rounded-full bg-slate-700 px-1.5 text-[11px] font-bold text-slate-300">
                            {savedList.length}
                        </span>
                    )}
                </button>

                {/* Autosave indicator. Shows the real state, not a decoration:
                    "saving" while the debounce is in flight, "error" in red. */}
                {savedAt && (
                    <span
                        className={`ml-auto text-[11px] ${
                            saveState === "error"
                                ? "text-red-400"
                                : saveState === "saving"
                                    ? "text-slate-400"
                                    : "text-slate-400"
                        }`}
                        title="The loaded scans and plot settings are kept in this browser only"
                    >
                        {saveState === "saving"
                            ? "Saving…"
                            : saveState === "error"
                                ? "Not saved"
                                : `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                    </span>
                )}
            </div>

            {/* Browser-storage warning: shown only when it actually fails. */}
            {persistError && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                    <span>
                        {persistError}. The plotter still works, but this session will not be
                        remembered after a reload — IndexedDB is blocked in private windows and
                        some locked-down browsers.
                    </span>
                    <button
                        type="button"
                        onClick={() => setPersistError(null)}
                        className="ml-auto shrink-0 text-amber-400 hover:text-amber-200"
                        aria-label="Dismiss"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* Saved sessions panel */}
            {showSaved && (
                <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xs font-bold text-slate-300">Sessions in this browser</h3>
                        <span className="text-[11px] text-slate-400">
                            {persisted === false
                                ? "Storage not pinned — the browser may clear this under pressure"
                                : persisted
                                    ? "Storage pinned — safer against eviction"
                                    : ""}
                            {storage && storage.quota > 0
                                ? ` · ${bytesLabel(storage.usage)} of ${bytesLabel(storage.quota)} used`
                                : ""}
                        </span>
                    </div>

                    {!empty && (
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                ref={saveNameRef}
                                value={saveName}
                                onChange={(e) => setSaveName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleSaveNamed();
                                    }
                                }}
                                placeholder={defaultSaveName()}
                                maxLength={80}
                                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white placeholder:text-slate-400 outline-none"
                            />
                            <button
                                type="button"
                                onClick={handleSaveNamed}
                                className="flex items-center gap-1.5 rounded-md bg-orange-700 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-orange-500 transition-colors"
                            >
                                <Save className="h-3.5 w-3.5" /> Save as
                            </button>
                        </div>
                    )}

                    {savedList.length === 0 ? (
                        <p className="text-[11px] text-slate-400">
                            No named sessions yet. The working session is saved automatically, so a
                            reload brings back whatever is on the plot right now.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-800/70">
                            {savedList.map((s) => (
                                <li key={s.key} className="flex items-center gap-2 py-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-xs text-slate-200">
                                            {s.name ?? "Untitled"}
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                            {s.traces.length} trace{s.traces.length === 1 ? "" : "s"} ·{" "}
                                            {new Date(s.savedAt).toLocaleString([], {
                                                day: "2-digit",
                                                month: "short",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleLoadSaved(s.key)}
                                        title={`Load ${s.name ?? "this session"}`}
                                        className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:border-orange-500/60 hover:text-white transition-colors"
                                    >
                                        <FolderOpen className="h-3 w-3" /> Load
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteSaved(s.key, s.name)}
                                        title={`Delete ${s.name ?? "this session"}`}
                                        className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="text-[11px] leading-relaxed text-slate-400">
                        Nothing here is uploaded. Scans stay in this browser profile, on this device.
                    </p>
                </div>
            )}

            {/* Help card */}
            {showHelp && (
                <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-4 space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-300">Keyboard shortcuts & tips</h3>
                    <ul className="space-y-1.5 text-[11px] text-slate-400 leading-relaxed">
                        <li>
                            <strong className="text-slate-200">Zoom:</strong> Drag a box on the plot to
                            look at that 2θ window
                        </li>
                        <li>
                            <strong className="text-slate-200">Pan:</strong> Hold Shift and drag to
                            slide the window sideways
                        </li>
                        <li>
                            <strong className="text-slate-200">Reset zoom:</strong> Double-click the
                            plot, or press Reset beside the range fields
                        </li>
                        <li>
                            <strong className="text-slate-200">Legend:</strong> Click an entry to hide
                            or show that trace. Drag the legend box to move it; it snaps to a
                            corner. Double-click it to return to auto placement.
                        </li>
                        <li>
                            <strong className="text-slate-200">Saving:</strong> Your scans and plot
                            settings are autosaved in this browser — a reload brings them back. Use
                            Save to keep a named copy.
                        </li>
                        <li>
                            <strong className="text-slate-200">Rename:</strong> Double-click a label or press Enter when focused
                        </li>
                        <li>
                            <strong className="text-slate-200">Readout:</strong> Hover the plot to see 2θ and counts at your cursor
                        </li>
                        <li>
                            <strong className="text-slate-200">Reorder:</strong> Drag the grip handle left of each trace
                        </li>
                    </ul>
                </div>
            )}

            {/* Export toast */}
            {exportToast && (
                <div className="fixed bottom-4 right-4 rounded-lg border border-green-500/40 bg-green-950/90 backdrop-blur-sm px-4 py-3 text-sm text-green-200 shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {exportToast.msg}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 items-start md:gap-4 md:grid-cols-2 xl:grid-cols-3">
                {/* ── Plot stage ─────────────────────────────────────── */}
                <div
                    className="relative rounded-xl border border-slate-700/50 bg-slate-800 p-3 md:col-span-2 xl:col-span-3"
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
                                className="w-full h-[380px] rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-orange-400 hover:text-orange-500 transition-colors"
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
                                    className="block max-w-full rounded bg-white cursor-crosshair touch-pan-y"
                                    title="Drag to zoom · Shift-drag to pan · Double-click to reset · Drag the legend to move it"
                                    onPointerMove={(e) => {
                                        if (legendDragRef.current) {
                                            onLegendMove(e);
                                            return;
                                        }
                                        if (!zoomDragRef.current) handleHover(e);
                                        onZoomMove(e);
                                    }}
                                    onPointerDown={(e) => {
                                        // The legend sits inside the plot rect, so it
                                        // must claim the press before the zoom handler
                                        // or a press on the panel starts a rubber band.
                                        // The toggle for a click is applied on
                                        // pointerup, once we know it was not a drag.
                                        if (onLegendDown(e)) return;
                                        handleHover(e);
                                        onZoomDown(e);
                                    }}
                                    onPointerUp={(e) => {
                                        if (onLegendUp(e)) return;
                                        onZoomUp(e);
                                    }}
                                    onPointerCancel={(e) => {
                                        if (onLegendUp(e)) return;
                                        onZoomUp(e);
                                    }}
                                    onDoubleClick={(e) => {
                                        // Double-clicking the legend restores automatic
                                        // placement; double-clicking the plot resets the
                                        // zoom. Two different resets on one surface.
                                        const c = canvasRef.current;
                                        if (c) {
                                            const r = c.getBoundingClientRect();
                                            if (legendPanelAt(e.clientX - r.left, e.clientY - r.top)) {
                                                setLegendPos(null);
                                                return;
                                            }
                                        }
                                        resetZoom();
                                    }}
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
                        <p className="mt-3 text-[11px] text-slate-400">
                            All scans are hidden. Click an eye in the list to bring one back — nothing
                            was unloaded.
                        </p>
                    )}
                </div>

                {/* ── Settings ───────────────────────────────────────── */}
                <section className="rounded-xl border border-slate-700/50 bg-slate-800 p-3 space-y-3 md:p-4 lg:h-[240px] lg:overflow-y-auto lg:flex lg:flex-col">
                    <div>
                        <div className="flex items-baseline justify-between mb-3">
                            <h3 className="text-xs font-semibold text-slate-300">
                                Data
                            </h3>
                            {traces.length > 0 && (
                                <span className="text-[11px] font-mono text-slate-400">
                                    {visibleTraces.length} of {traces.length} active
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-700 hover:bg-orange-500 px-3 py-2 text-xs font-bold text-white transition-colors"
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

                    {traces.map((t) => {
                        const isDragging = dragId === t.id;
                        const isDropTarget = dragOverId === t.id;
                        
                        // Compute direction if this is the drop target
                        let direction: "up" | "down" | null = null;
                        if (isDragging === false && isDropTarget && dragId) {
                            const dragIdx = traces.findIndex((x) => x.id === dragId);
                            const overIdx = traces.findIndex((x) => x.id === t.id);
                            direction = dragIdx < overIdx ? "down" : "up";
                        }
                        
                        return (
                        <div key={t.id} className="relative">
                            {/* Drop indicator bar */}
                            {isDropTarget && direction && (
                                <div
                                    className={`absolute left-0 right-0 h-0.5 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] ${
                                        direction === "up" ? "-top-1" : "-bottom-1"
                                    }`}
                                    aria-hidden="true"
                                />
                            )}
                            
                        <div
                            data-trace-row={t.id}
                            className={`flex items-center gap-1.5 text-[11px] rounded-md px-1 -mx-1 py-0.5 transition-colors ${
                                isDragging
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
                                className={`touch-none cursor-grab active:cursor-grabbing shrink-0 grid place-items-center h-6 w-6 -ml-1 rounded hover:bg-slate-700/50 transition-all ${
                                    isDragging 
                                        ? "text-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.5)]" 
                                        : "text-slate-600 hover:text-slate-300"
                                }`}
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
                                className="shrink-0 grid place-items-center h-6 w-6 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700/50"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                            
                            {/* Directional indicator when dragging */}
                            {isDragging && (
                                <span className="absolute -right-6 text-[11px] text-orange-400 font-mono animate-pulse">
                                    ↕
                                </span>
                            )}
                        </div>
                        </div>
                        );
                    })}
                    {traces.length > 1 && (
                        <p className="text-[11px] text-slate-400 leading-relaxed -mt-1">
                            Drag the handle to reorder. Top of the list plots on top. The eye takes a
                            scan out of the figure, the export and the scoring without unloading it.
                        </p>
                    )}

                    <p className="mt-auto pt-2 text-[11px] leading-relaxed text-slate-500">
                        Nothing is uploaded. Scans stay in this browser, on this device.
                    </p>
                </section>

                {!empty && (
                    <section className="rounded-xl border border-slate-700/50 bg-slate-800 p-3 space-y-3 md:p-4 lg:h-[240px] lg:overflow-y-auto lg:flex lg:flex-col">
                            <div className="space-y-3">
                                <h3 className="text-xs font-semibold text-slate-300">
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
                                <div className="flex items-center justify-between -mt-1">
                                    <p className="text-[11px] text-slate-400">
                                        Drag on the plot to zoom, shift-drag to pan, double-click to
                                        reset.
                                    </p>
                                    <div className="flex shrink-0 items-center gap-1">
                                        {legendPos && (
                                            <button
                                                type="button"
                                                onClick={() => setLegendPos(null)}
                                                title="Return the legend to automatic corner placement"
                                                className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:border-orange-500/60 hover:text-white transition-colors"
                                            >
                                                Legend auto
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={resetZoom}
                                            title="Show the full measured range again"
                                            className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:text-white hover:border-orange-500/60 transition-colors"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                                {rangeInvalid && (
                                    <p className="text-[11px] leading-relaxed text-amber-300">
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

                            </div>

                    </section>
                )}

                <section className="rounded-xl border border-slate-700/50 bg-slate-800 p-4 space-y-3 md:col-span-2 xl:col-span-1 lg:h-[240px] lg:overflow-y-auto lg:flex lg:flex-col">
                    <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-slate-300">
                        Export
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button type="button" onClick={exportPNG} disabled={nothingVisible}
                            title="Raster 2.6× — 940 dpi at 85 mm"
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors disabled:opacity-40">
                            <ImageIcon className="h-3.5 w-3.5" /> PNG
                        </button>
                        <button type="button" onClick={exportSVG} disabled={nothingVisible}
                            title="Vector 1210×760 — editable curves"
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors disabled:opacity-40">
                            <FileText className="h-3.5 w-3.5" /> SVG
                        </button>
                        <button type="button" onClick={exportPDF} disabled={nothingVisible}
                            title="Print layout — 85 mm width"
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors disabled:opacity-40">
                            <Download className="h-3.5 w-3.5" /> PDF 85 mm
                        </button>
                        <button type="button" onClick={exportCSV} disabled={nothingVisible}
                            title="Two-column 2θ, intensity — all traces"
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors disabled:opacity-40">
                            <Download className="h-3.5 w-3.5" /> CSV
                        </button>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400">
                        Always print geometry — an 85 mm figure regardless of window size.
                    </p>
                    </div>
                    <div className="space-y-2 border-t border-slate-700/60 pt-3">
                    <h3 className="text-xs font-semibold text-slate-300">
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
                            <p className="text-[11px] leading-relaxed text-amber-300">{refError}</p>
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
                                        className="shrink-0 text-slate-400 hover:text-slate-200"
                                    >
                                        {reference.visible
                                            ? <Eye className="h-3.5 w-3.5" />
                                            : <EyeOff className="h-3.5 w-3.5" />}
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Remove reference pattern"
                                        onClick={() => setReference(null)}
                                        className="shrink-0 text-slate-400 hover:text-red-400"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                                    {reference.spacegroup} · {reference.peaks.length} refl · λ {reference.wavelength.toFixed(4)} Å
                                </p>
                            </div>
                        )}

                    </div>
                </section>
            </div>

            {reference || matchResults ? (
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
            ) : null}

            {traces.length > 0 && (
                <p className="px-1 text-center text-[11px] leading-relaxed text-slate-400 sm:truncate">
                    {traces.map((t, i) => (
                        <span key={`sum-${t.id}`}>
                            {i > 0 && <span className="text-slate-600"> · </span>}
                            {t.fileName} — {t.x.length.toLocaleString()} pts, max{" "}
                            {Math.round(t.peakIntensity).toLocaleString()} @ {t.peak2Theta.toFixed(2)}°
                            {t.visible ? "" : " (hidden)"}
                        </span>
                    ))}
                </p>
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
