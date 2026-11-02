"use client";

import { AlertTriangle, CheckCircle2, CircleHelp, CircleSlash, Loader2 } from "lucide-react";
import type { MatchResult, Verdict } from "@/lib/xrd/phase-match";
import { classifyMatch } from "@/lib/xrd/phase-match";

export type ScanMatch = {
    traceId: string;
    label: string;
    color: string;
    result: MatchResult;
};

const VERDICT_STYLE: Record<Verdict, { text: string; cls: string; Icon: typeof CheckCircle2 }> = {
    supported: {
        text: "supported",
        cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
        Icon: CheckCircle2,
    },
    partial: {
        text: "partial",
        cls: "text-amber-300 bg-amber-500/10 border-amber-500/30",
        Icon: AlertTriangle,
    },
    unsupported: {
        text: "not supported",
        cls: "text-rose-300 bg-rose-500/10 border-rose-500/30",
        Icon: CircleSlash,
    },
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
    const s = VERDICT_STYLE[verdict];
    return (
        <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.cls}`}>
            <s.Icon className="h-2.5 w-2.5" />
            {s.text}
        </span>
    );
}

function Bar({ value, label, hint }: { value: number; label: string; hint: string }) {
    const pct = Math.max(0, Math.min(100, value * 100));
    return (
        <div title={hint}>
            <div className="flex items-baseline justify-between text-[10px] text-slate-400 mb-0.5">
                <span>{label}</span>
                <span className="font-mono text-slate-300">{pct.toFixed(0)}%</span>
            </div>
            <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                <div
                    className="h-full rounded-full bg-slate-400"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

export function PhaseMatchPanel({
    results,
    selectedId,
    onSelect,
    onRun,
    busy,
    error,
    canRun,
    referenceLabel,
}: {
    results: ScanMatch[] | null;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onRun: () => void;
    busy: boolean;
    error: string | null;
    canRun: boolean;
    referenceLabel: string | null;
}) {
    const ranked = results ? [...results].sort((a, b) => b.result.score - a.result.score) : null;
    const selected = ranked?.find((r) => r.traceId === selectedId) ?? ranked?.[0] ?? null;

    return (
        <section className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-bold text-white">Phase agreement</h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                        {referenceLabel
                            ? `Compared against ${referenceLabel} · peak-list search–match`
                            : "Load a CIF reference first"}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onRun}
                    disabled={!canRun || busy}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-900 hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CircleHelp className="h-3 w-3" />}
                    {busy ? "Scoring…" : results ? "Re-score" : "Score scans"}
                </button>
            </div>

            {error && (
                <p className="text-[10px] leading-relaxed text-amber-300">{error}</p>
            )}

            {!results && !busy && (
                <p className="text-[10px] leading-relaxed text-slate-500">
                    Scores every loaded scan against the reference and lists which reflections were
                    found, which are missing, and which peaks the reference cannot explain.
                </p>
            )}

            {ranked && ranked.length > 0 && (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                            <thead>
                                <tr className="text-slate-500 text-[10px] uppercase tracking-wider">
                                    <th className="text-left font-semibold pb-1">Scan</th>
                                    <th className="text-right font-semibold pb-1">H</th>
                                    <th className="text-right font-semibold pb-1 hidden sm:table-cell">P</th>
                                    <th className="text-right font-semibold pb-1 hidden sm:table-cell">R</th>
                                    <th className="text-right font-semibold pb-1 hidden md:table-cell">CE</th>
                                    <th className="text-right font-semibold pb-1 hidden lg:table-cell">Q</th>
                                    <th className="text-right font-semibold pb-1 hidden md:table-cell">δ</th>
                                    <th className="text-left font-semibold pb-1 pl-3">Verdict</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ranked.map((r) => {
                                    const isSel = selected?.traceId === r.traceId;
                                    return (
                                        <tr
                                            key={r.traceId}
                                            onClick={() => onSelect(r.traceId)}
                                            className={`cursor-pointer border-t border-slate-800 ${isSel ? "bg-slate-800/70" : "hover:bg-slate-800/40"}`}
                                        >
                                            <td className="py-1.5 pr-2">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className="h-[3px] w-3 rounded-full ring-1 ring-white/25" style={{ background: r.color }} />
                                                    <span className={`truncate ${isSel ? "text-white" : "text-slate-300"}`}>{r.label}</span>
                                                </span>
                                            </td>
                                            <td className="text-right font-mono text-white tabular-nums">{r.result.score.toFixed(1)}</td>
                                            <td className="text-right font-mono text-slate-400 tabular-nums hidden sm:table-cell">
                                                {(r.result.precision * 100).toFixed(0)}
                                            </td>
                                            <td className="text-right font-mono text-slate-400 tabular-nums hidden sm:table-cell">
                                                {(r.result.recall * 100).toFixed(0)}
                                            </td>
                                            <td className="text-right font-mono text-slate-400 tabular-nums hidden md:table-cell">
                                                {(r.result.coverageExp * 100).toFixed(0)}
                                            </td>
                                            <td className="text-right font-mono text-slate-400 tabular-nums hidden lg:table-cell">
                                                {r.result.quality.toFixed(0)}
                                            </td>
                                            <td className="text-right font-mono text-slate-400 tabular-nums hidden md:table-cell">
                                                {r.result.shift >= 0 ? "+" : ""}{r.result.shift.toFixed(2)}
                                            </td>
                                            <td className="pl-3">
                                                <VerdictBadge verdict={classifyMatch(r.result).verdict} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {selected && <MatchDetail m={selected} />}
                </>
            )}
        </section>
    );
}

function MatchDetail({ m }: { m: ScanMatch }) {
    const r = m.result;
    const matched = r.pairs.length;

    return (
        <div className="rounded-lg border border-slate-700/50 bg-slate-950/40 p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
                <span className="text-slate-300 font-semibold">{m.label}</span>
                <span className="font-mono">
                    δ = {r.shift >= 0 ? "+" : ""}{r.shift.toFixed(3)}°
                </span>
                <span className="font-mono">
                    Q = {r.quality.toFixed(0)}
                </span>
                <span className="font-mono">
                    {matched} pairs · {r.expCount} measured → {r.refCount} expected
                </span>
                <span className="font-mono">
                    window {r.window[0].toFixed(0)}–{r.window[1].toFixed(0)}°
                </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Bar value={r.precision} label="P · measured explained" hint="Fraction of detected measured peaks that received a theoretical match" />
                <Bar value={r.recall} label="R · expected found" hint="Fraction of the retained theoretical reflections that were observed" />
                <Bar value={r.coverageExp} label="CE · intensity explained" hint="Intensity-weighted fraction of the measured signal explained by the reference" />
                <Bar value={r.coverageRef} label="CT · reference covered" hint="Intensity-weighted fraction of expected intensity accounted for" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                <div>
                    <p className="text-slate-500 mb-1">
                        Missing reflections <span className="text-slate-400">({r.missingRef.length})</span> —
                        expected but not observed
                    </p>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {r.missingRef.length === 0 && <span className="text-slate-600">none</span>}
                        {[...r.missingRef]
                            .sort((a, b) => b.i - a.i)
                            .slice(0, 14)
                            .map((p, i) => (
                                <span key={i} className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-400">
                                    {p.x.toFixed(1)}°{p.hkl ? ` (${p.hkl.join(" ")})` : ""}
                                </span>
                            ))}
                    </div>
                </div>
                <div>
                    <p className="text-slate-500 mb-1">
                        Unexplained peaks <span className="text-slate-400">({r.unexplainedExp.length})</span> —
                        present but unassigned
                    </p>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {r.unexplainedExp.length === 0 && <span className="text-slate-600">none</span>}
                        {[...r.unexplainedExp]
                            .sort((a, b) => b.i - a.i)
                            .slice(0, 14)
                            .map((p, i) => (
                                <span key={i} className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-amber-300/80">
                                    {p.x.toFixed(1)}° · {p.i.toFixed(0)}
                                </span>
                            ))}
                    </div>
                </div>
            </div>

            <p className="text-[10px] leading-relaxed text-slate-600 border-t border-slate-800 pt-2">
                H ranks this phase against alternatives; it does not certify identity. Compare the
                components and the two evidence lists before reporting an assignment.
            </p>
        </div>
    );
}
