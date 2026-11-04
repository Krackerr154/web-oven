"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Check, AlertTriangle, Loader2, ChevronDown } from "lucide-react";

type Row = {
    id: string;
    name: string;
    nip: string;
    researchGroup: string | null;
    researchTopic: string | null;
};

type Props = {
    /** Currently selected NIP, so the picker can restore its own state. */
    value: string;
    onChange: (name: string | null, nip: string) => void;
};

/**
 * Pick a supervisor as a name+NIP pair.
 *
 * The pair is the point: before this, the name came from one free-text field
 * and the NIP from another, so a signed PDF could assert a supervisor identity
 * that belonged to nobody. Selecting here writes both at once.
 *
 * Only lecturers with a published 18-digit NIP are offered. A row in the
 * directory without a NIP is not silently given a made-up one.
 */
export function SupervisorPicker({ value, onChange }: Props) {
    const [rows, setRows] = useState<Row[]>([]);
    const [source, setSource] = useState<"db" | "bundled" | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const boxRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/supervisors", { cache: "no-store" });
                if (!res.ok) throw new Error(`Directory unavailable (${res.status})`);
                const json = await res.json();
                if (cancelled) return;
                setRows(json.supervisors ?? []);
                setSource(json.source ?? null);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : "Could not load supervisors");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Close on outside click so the list cannot trap the page.
    useEffect(() => {
        if (!open) return;
        function onDown(e: MouseEvent) {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return rows;
        // Only test the NIP when the query actually contains digits: stripping
        // the non-digits from a text query yields "", and String.includes("")
        // is true for every row, which silently disabled the whole filter.
        const digits = q.replace(/\D/g, "");
        return rows.filter(
            (r) =>
                r.name.toLowerCase().includes(q) ||
                (digits.length > 0 && r.nip.includes(digits)) ||
                (r.researchGroup ?? "").toLowerCase().includes(q),
        );
    }, [rows, query]);

    const selected = rows.find((r) => r.nip === value) ?? null;

    return (
        <div className="space-y-2 max-w-md" ref={boxRef}>
            <label className="text-xs font-medium text-slate-400">Main Supervisor</label>

            {loading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading directory…
                </div>
            ) : error ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{error}</span>
                </div>
            ) : (
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setOpen((o) => !o)}
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-left text-xs text-white transition-colors hover:border-slate-600"
                    >
                        <span className="min-w-0">
                            {selected ? (
                                <>
                                    <span className="block truncate">{selected.name}</span>
                                    <span className="block font-mono text-[10px] text-slate-400">
                                        NIP. {selected.nip}
                                    </span>
                                </>
                            ) : value ? (
                                // A NIP carried in from an older session that is not
                                // in the directory: show it, do not pretend it matched.
                                <span className="font-mono text-[11px] text-amber-300">
                                    NIP. {value} — not in directory
                                </span>
                            ) : (
                                <span className="text-slate-500">Select a supervisor…</span>
                            )}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    </button>

                    {open && (
                        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
                            <div className="flex items-center gap-2 border-b border-slate-700/70 px-2.5 py-2">
                                <Search className="h-3.5 w-3.5 text-slate-500" />
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search name, NIP or research group"
                                    className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 outline-none"
                                />
                            </div>
                            <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
                                {filtered.length === 0 && (
                                    <li className="px-3 py-2 text-[11px] text-slate-500">
                                        No supervisor matches “{query}”.
                                    </li>
                                )}
                                {filtered.map((r) => {
                                    const isSel = r.nip === value;
                                    return (
                                        <li key={r.id}>
                                            <button
                                                type="button"
                                                role="option"
                                                aria-selected={isSel}
                                                onClick={() => {
                                                    onChange(r.name, r.nip);
                                                    setOpen(false);
                                                    setQuery("");
                                                }}
                                                className={`flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-slate-800 ${
                                                    isSel ? "bg-orange-500/10" : ""
                                                }`}
                                            >
                                                <span className="mt-0.5 w-3.5 shrink-0">
                                                    {isSel && <Check className="h-3.5 w-3.5 text-orange-400" />}
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block truncate text-xs text-slate-200">
                                                        {r.name}
                                                    </span>
                                                    <span className="block font-mono text-[10px] text-slate-500">
                                                        {r.nip}
                                                        {r.researchGroup ? ` · ${r.researchGroup}` : ""}
                                                    </span>
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <p className="text-[10px] leading-relaxed text-slate-500">
                Name and NIP are written together from the chemistry department directory
                {source === "bundled" ? " (bundled copy — run Load directory in admin to activate the table)" : ""}.
                Lecturers without a published NIP are not listed, so no number is ever invented.
            </p>
        </div>
    );
}
