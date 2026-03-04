"use client";

import { useState, useTransition, useEffect } from "react";
import { Search, Loader2, FlaskConical, MapPin, Package, Hash, Zap } from "lucide-react";
import { searchReagents } from "@/app/actions/reagents";
import { useDebounce } from "use-debounce";
import type { Reagent } from "@/lib/sheets";

export default function ReagentSearchClient() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Reagent[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [isPending, startTransition] = useTransition();

    const [debouncedQuery] = useDebounce(query, 300);

    // Auto-search when the debounced query changes
    useEffect(() => {
        if (!debouncedQuery.trim()) {
            setResults([]);
            setHasSearched(false);
            return;
        }

        startTransition(async () => {
            const res = await searchReagents(debouncedQuery);
            if (res.success && res.data) {
                setResults(res.data);
                setHasSearched(true);
            }
        });
    }, [debouncedQuery]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // The useEffect handles the actual search, this just prevents page reload
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSearch} className="relative">
                <div className="relative flex items-center">
                    <Search className="absolute left-4 h-5 w-5 text-slate-500" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by name, brand, or identifier..."
                        className="w-full pl-12 pr-24 py-4 bg-slate-900/80 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-lg shadow-inner"
                    />
                    <button
                        type="button"
                        className="absolute right-4 text-slate-400 flex items-center gap-1.5"
                    >
                        {isPending ? <Loader2 className="h-5 w-5 animate-spin text-purple-500" /> : <Zap className="h-5 w-5 text-purple-400/70" />}
                    </button>
                </div>
                <p className="text-xs text-slate-500 mt-2 px-1 flex items-center gap-1">
                    <Zap className="h-3 w-3 text-purple-400" />
                    Typo-tolerant smart search is active (e.g., searches for "etoh", "dmf", or misspelled words work too)
                </p>
            </form>

            {/* Results State */}
            <div className="min-h-[300px]">
                {isPending ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400 space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                        <p>Searching catalog...</p>
                    </div>
                ) : hasSearched ? (
                    results.length > 0 ? (
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-slate-400">
                                Found {results.length} result(s) for "{debouncedQuery}"
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {results.map((reagent) => (
                                    <div key={reagent.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 hover:border-purple-500/30 transition-colors group">
                                        <div className="flex items-start justify-between mb-3">
                                            <h4 className="font-bold text-white text-lg leading-tight group-hover:text-purple-300 transition-colors">
                                                {reagent.name}
                                            </h4>
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <Package className="h-4 w-4 text-slate-500 shrink-0" />
                                                <span>{reagent.brand || "Unknown Brand"}</span>
                                            </div>

                                            <div className="flex items-center gap-2 text-slate-300">
                                                <Hash className="h-4 w-4 text-slate-500 shrink-0" />
                                                <span className="font-mono text-xs bg-slate-900 px-1.5 py-0.5 rounded text-slate-300 border border-slate-700">
                                                    {reagent.id}
                                                </span>
                                            </div>

                                            {(reagent.size || reagent.unit) && (
                                                <div className="flex items-center gap-2 text-slate-300">
                                                    <FlaskConical className="h-4 w-4 text-slate-500 shrink-0" />
                                                    <span>{reagent.size} {reagent.unit}</span>
                                                </div>
                                            )}

                                            {reagent.location && (
                                                <div className="flex items-start gap-2 text-slate-300 mt-3 pt-3 border-t border-slate-700/50">
                                                    <MapPin className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                                                    <span className="text-slate-400">{reagent.location}</span>
                                                </div>
                                            )}

                                            {reagent.notes && (
                                                <div className="mt-2 text-xs italic text-slate-500 bg-slate-900/50 p-2 rounded border border-slate-800">
                                                    Note: {reagent.notes}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-slate-800/20 border border-slate-700/30 rounded-xl border-dashed">
                            <FlaskConical className="h-12 w-12 text-slate-600 mb-4" />
                            <p className="text-lg font-medium text-slate-300 mb-1">No reagents found</p>
                            <p className="text-sm">We couldn't find anything matching "{debouncedQuery}"</p>
                        </div>
                    )
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                        <Search className="h-12 w-12 text-slate-600 mb-4 opacity-50" />
                        <p>Enter a chemical name, brand, or synonym to instantly search the inventory</p>
                    </div>
                )}
            </div>
        </div>
    );
}
