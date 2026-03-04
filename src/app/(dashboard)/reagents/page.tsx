import { Metadata } from "next";
import { SearchIcon, FlaskConical } from "lucide-react";
import ReagentSearchClient from "./reagent-search-client";

export const metadata: Metadata = {
    title: "Reagents | AP Lab",
    description: "Search the laboratory reagent catalog",
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
                        <h1 className="text-2xl font-bold text-white">Reagent Catalog</h1>
                        <p className="text-slate-400 mt-0.5 text-sm">Search the inventory for available chemicals and reagents</p>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-800 rounded-2xl p-6">
                <ReagentSearchClient />
            </div>
        </div>
    );
}
