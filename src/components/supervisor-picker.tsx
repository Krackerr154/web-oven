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

type CommonProps = {
    label?: string;
    /** "dark" matches the dashboard forms, "auth" the registration page. */
    variant?: "dark" | "auth";
    /** Show the explanatory footnote under the control. */
    hint?: boolean;
    placeholder?: string;
};

type SingleProps = CommonProps & {
    multiple?: false;
    /** Currently selected NIP. */
    value: string | null;
    onChange: (name: string | null, nip: string) => void;
};

type MultiProps = CommonProps & {
    multiple: true;
    /** Currently selected names. */
    value: string[];
    onChange: (names: string[]) => void;
};

export type SupervisorPickerProps = SingleProps | MultiProps;

/**
 * Pick a supervisor from the chemistry department directory.
 *
 * The point is that a supervisor is an identity, not a typed string. Before
 * this existed, the name came from one free-text box and the NIP from another,
 * so a signed PDF could assert a supervisor that belonged to nobody, and
 * ap_users.supervisors filled with spellings that never matched the registry.
 *
 * Only lecturers with a published 18-digit NIP are offered — the directory has
 * rows without one, and inventing a number for them would be worse than
 * omitting them.
 */
export function SupervisorPicker(props: SupervisorPickerProps) {
    const {
        label = "Main Supervisor",
        variant = "dark",
        hint = true,
        placeholder = "Select a supervisor…",
    } = props;

    // Narrow explicitly rather than destructuring `multiple` with a default:
    // a defaulted destructure widens the union and the branch types stop
    // discriminating, which turns every onChange into an arity error.
    const isMulti = props.multiple === true;
    const selectedNames = isMulti ? (props as MultiProps).value : [];
    const singleNip = isMulti ? null : (props as SingleProps).value;

    const [rows, setRows] = useState<Row[]>([]);
    const [source, setSource] = useState<"db" | "bundled" | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const boxRef = useRef<HTMLDivElement | null>(null);

    // Names carried in multi mode that the directory does not know about. Shown
    // as a warning rather than silently dropped, because registration is
    // exactly where unrecognised names used to enter the database.
    const unknownNames = isMulti
        ? selectedNames.filter((n) => rows.length > 0 && !rows.some((r) => r.name === n))
        : [];

    const selectedRows = isMulti
        ? rows.filter((r) => selectedNames.includes(r.name))
        : singleNip
            ? rows.filter((r) => r.nip === singleNip)
            : [];
    const selectedNips = selectedRows.map((r) => r.nip);

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
        // is true for every row, which silently disables the whole filter.
        const digits = q.replace(/\D/g, "");
        return rows.filter(
            (r) =>
                r.name.toLowerCase().includes(q) ||
                (digits.length > 0 && r.nip.includes(digits)) ||
                (r.researchGroup ?? "").toLowerCase().includes(q),
        );
    }, [rows, query]);

    const auth = variant === "auth";
    const borderCls = auth ? "border-slate-600 bg-slate-900" : "border-slate-700 bg-slate-950";

    function choose(r: Row) {
        if (isMulti) {
            const next = selectedNames.includes(r.name)
                ? selectedNames.filter((n: string) => n !== r.name)
                : [...selectedNames, r.name];
            (props as MultiProps).onChange(next);
            // Multi-select stays open: picking two supervisors should not
            // require reopening the list.
            setQuery("");
        } else {
            (props as SingleProps).onChange(r.name, r.nip);
            setOpen(false);
            setQuery("");
        }
    }

    function unselect(name: string) {
        if (isMulti) (props as MultiProps).onChange(selectedNames.filter((n: string) => n !== name));
    }

    return (
        <div className="space-y-2" ref={boxRef}>
            <label className={`block font-medium ${auth ? "text-sm text-slate-300" : "text-xs text-slate-400"}`}>
                {label}
            </label>

            {/* Chips for multi-select, so the chosen set is visible without opening the list */}
            {isMulti && selectedRows.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selectedRows.map((r, i) => (
                        <span
                            key={r.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[11px] text-orange-200"
                        >
                            {i === 0 && (
                                <span className="text-[9px] font-bold uppercase tracking-wide text-orange-400">
                                    Main
                                </span>
                            )}
                            {r.name}
                            <button
                                type="button"
                                onClick={() => unselect(r.name)}
                                aria-label={`Remove ${r.name}`}
                                className="text-orange-400 hover:text-orange-200"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* A chosen name the directory does not carry must not pass silently. */}
            {unknownNames.map((n: string) => (
                <div
                    key={n}
                    className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200"
                >
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="flex-1">
                        “{n}” is not in the directory. Pick from the list so the name matches the
                        registry.
                    </span>
                    <button
                        type="button"
                        onClick={() => unselect(n)}
                        className="shrink-0 text-amber-400 hover:text-amber-200"
                        aria-label={`Remove ${n}`}
                    >
                        ×
                    </button>
                </div>
            ))}

            {loading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading directory…
                </div>
            ) : error ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{error}. The directory is required — try reloading the page.</span>
                </div>
            ) : (
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setOpen((o) => !o)}
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs text-white transition-colors hover:border-slate-500 ${borderCls}`}
                    >
                        <span className="min-w-0">
                            {selectedRows.length > 0 ? (
                                <span className="block truncate">
                                    {isMulti ? `${selectedRows.length} selected` : selectedRows[0].name}
                                </span>
                            ) : (
                                <span className="text-slate-500">{placeholder}</span>
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
                                    const isSel = selectedNips.includes(r.nip);
                                    return (
                                        <li key={r.id}>
                                            <button
                                                type="button"
                                                role="option"
                                                aria-selected={isSel}
                                                onClick={() => choose(r)}
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

            {hint && (
                <p className="text-[10px] leading-relaxed text-slate-500">
                    Chosen from the chemistry department directory
                    {source === "bundled"
                        ? " (bundled copy — run Load directory in admin to activate the table)"
                        : ""}
                    . Lecturers without a published NIP are not listed.
                </p>
            )}
        </div>
    );
}
