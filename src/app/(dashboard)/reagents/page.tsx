import { Metadata } from "next";
import { SearchIcon, FlaskConical, Plus } from "lucide-react";
import Link from "next/link";
import ReagentSearchClient from "./reagent-search-client";

export const metadata: Metadata = {
    title: "Chemical Inventory | AP-Lab",
    description: "Search the laboratory chemical inventory",
};

export default function ReagentsPage() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 shrink-0 shadow-inner">
                        <FlaskConical className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Chemical Inventory</h1>
                        <p className="text-slate-400 mt-0.5 text-sm">Search the inventory for available chemicals, solvents, and materials</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/reagents/add"
                        className="px-4 py-2.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                        <Plus className="h-4 w-4" /> Add Personal Chemical
                    </Link>
                </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-800 rounded-2xl p-6">
                <ReagentSearchClient />
            </div>
        </div>
    );
}
