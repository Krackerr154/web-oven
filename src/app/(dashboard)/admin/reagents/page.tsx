import { Metadata } from "next";
import { getAllReagents } from "@/app/actions/reagents";
import { FlaskConical, AlertCircle, RefreshCw, Plus, Package, MapPin, Hash, Database } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Manage Chemical Inventory | Admin",
    description: "View and manage the comprehensive laboratory chemical inventory",
};

export const dynamic = "force-dynamic"; // Ensure fresh list roughly every time

export default async function AdminReagentsPage() {
    const result = await getAllReagents();

    if (!result.success) {
        return (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-300 flex items-start gap-3">
                <AlertCircle className="h-6 w-6 shrink-0 mt-0.5" />
                <div>
                    <h2 className="text-lg font-bold text-red-400">Failed to load chemical inventory</h2>
                    <p className="text-sm mt-1">{result.message}</p>
                </div>
            </div>
        );
    }

    const reagents = result.data || [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 shrink-0 shadow-inner">
                        <FlaskConical className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Manage Chemical Inventory</h1>
                        <p className="text-slate-400 mt-0.5 text-sm">
                            View the complete lab catalog synced directly from Google Sheets and the Local Database.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/reagents/add"
                        className="px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
                    >
                        <Plus className="h-4 w-4" /> Add Chemical
                    </Link>
                </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/20">
                    <h2 className="text-sm font-semibold text-slate-300">Total Catalog Items: <span className="text-white">{reagents.length}</span></h2>
                    <div className="flex items-center text-xs text-slate-500 gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                        <RefreshCw className="h-3 w-3" /> Auto-syncs roughly every 5 minutes
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-800/40 text-slate-400 border-b border-slate-700 text-xs uppercase tracking-wider">
                            <tr>
                                <th scope="col" className="px-6 py-4 font-medium">Identifier</th>
                                <th scope="col" className="px-6 py-4 font-medium">Name</th>
                                <th scope="col" className="px-6 py-4 font-medium">Brand</th>
                                <th scope="col" className="px-6 py-4 font-medium">Unit Size</th>
                                <th scope="col" className="px-6 py-4 font-medium">Location</th>
                                <th scope="col" className="px-6 py-4 font-medium">Arrival</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50 text-slate-300">
                            {reagents.map((r) => (
                                <tr key={`${r.id}-${r.name}`} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-3 font-mono text-xs">
                                        <span className="bg-purple-500/10 text-purple-300 px-2 py-1 rounded border border-purple-500/20">
                                            {r.id || "-"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 font-medium text-white max-w-[300px] truncate" title={r.name}>
                                        {r.name}
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-1.5">
                                            <Package className="h-3.5 w-3.5 text-slate-500" />
                                            {r.brand || "-"}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3">
                                        {r.size} {r.unit}
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="h-3.5 w-3.5 text-slate-500" />
                                            {r.location || "Unassigned"}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-slate-400">
                                        {r.arrivalDate || "-"}
                                    </td>
                                </tr>
                            ))}
                            {reagents.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <FlaskConical className="h-8 w-8 opacity-50" />
                                            <p>No chemicals found in the integration sheet.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
