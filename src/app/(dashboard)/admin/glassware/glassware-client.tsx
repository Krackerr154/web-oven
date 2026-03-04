"use client";

import { useState, useMemo } from "react";
import { Search, Beaker, MapPin, Database, Loader2, Trash2 } from "lucide-react";
import { GlasswareItem, deleteGlassware } from "@/app/actions/glassware";
import Link from "next/link";
import Fuse from "fuse.js";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function AdminGlasswareClient({ initialData }: { initialData: GlasswareItem[] }) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [viewingLoansFor, setViewingLoansFor] = useState<GlasswareItem | null>(null);

    // Setup Fuse.js for client-side quick filtering
    const fuse = useMemo(() => new Fuse(initialData, {
        keys: ["name", "customId", "type", "brand", "location", "size"],
        threshold: 0.3,
        ignoreLocation: true,
    }), [initialData]);

    const filteredData = useMemo(() => {
        if (!searchTerm.trim()) return initialData;
        return fuse.search(searchTerm).map(res => res.item);
    }, [searchTerm, initialData, fuse]);

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
            return;
        }

        setIsDeleting(id);
        try {
            const res = await deleteGlassware(id);
            if (res.success) {
                toast.success("Glassware deleted successfully.");
                router.refresh(); // Refresh the page to get the updated DB state
            } else {
                toast.error(res.message || "Failed to delete item.");
            }
        } catch (error) {
            toast.error("An unexpected error occurred.");
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Search and Action Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 bg-slate-800/80 border border-slate-700/50 rounded-xl text-sm 
                        text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 
                        transition-all shadow-inner hover:bg-slate-800"
                        placeholder="Search by name, type, size, brand..."
                    />
                </div>

                <Link
                    href="/admin/glassware/add"
                    className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 
                    hover:to-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg 
                    shadow-orange-500/20 active:scale-[0.98] w-full sm:w-auto justify-center"
                >
                    <Beaker className="h-4 w-4" />
                    Add Glassware
                </Link>
            </div>

            {/* Results Grid / Table */}
            {filteredData.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                    <Database className="mx-auto h-12 w-12 text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-300">No Glassware Found</h3>
                    <p className="text-slate-500 mt-2">Try adjusting your search terms or add a new item.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredData.map((item) => (
                        <div key={item.id} className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 hover:border-orange-500/30 transition-all flex flex-col justify-between group">
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-semibold text-lg text-white mb-1 group-hover:text-orange-400 transition-colors">
                                            {item.name}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            {!item.ownerId ? (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                    Lab Owned
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                    User Owned
                                                </span>
                                            )}
                                            {item.customId && (
                                                <span className="text-xs font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                                                    ID: {item.customId}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Stock view for Admin: Available / Total */}
                                <div className="flex items-center gap-4 py-2 border-y border-slate-800/60 my-3">
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium">Available</div>
                                        <div className="text-xl font-bold text-orange-400">{item.availableQuantity}</div>
                                    </div>
                                    <div className="h-6 w-px bg-slate-700"></div>
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium">Total In Stock</div>
                                        <div className="text-lg font-bold text-slate-300">{item.quantity}</div>
                                    </div>
                                </div>

                                <div className="space-y-2 mt-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Type</span>
                                        <span className="text-slate-200 font-medium">{item.type}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Size</span>
                                        <span className="text-slate-200 font-medium">{item.size} {item.unit}</span>
                                    </div>
                                    {item.brand && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Brand</span>
                                            <span className="text-slate-200 font-medium">{item.brand}</span>
                                        </div>
                                    )}
                                    {item.condition && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Condition</span>
                                            <span className="text-slate-200 font-medium">{item.condition}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-700/50 flex flex-col sm:flex-row justify-between items-center gap-3">
                                <div className="flex flex-col gap-2 w-full">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{item.location || "Unassigned"}</span>
                                    </div>
                                    {item.ownerId && (
                                        <div className="text-xs text-slate-400 truncate">
                                            <span className="font-medium text-amber-400">Owner:</span> {item.owner?.name}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 w-full sm:w-auto mt-3 sm:mt-0">
                                    <button
                                        type="button"
                                        onClick={() => setViewingLoansFor(item)}
                                        disabled={item.activeLoans.length === 0}
                                        className="px-3 text-xs py-2 bg-blue-600/10 text-blue-400 hover:text-white hover:bg-blue-600 rounded-lg transition-colors flex-1 sm:flex-none border border-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="View active borrowers"
                                    >
                                        Borrowers ({item.activeLoans.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(item.id, item.name)}
                                        disabled={isDeleting === item.id}
                                        className="p-2 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg transition-colors flex items-center justify-center shrink-0 border border-slate-700/50"
                                        title="Delete Item"
                                    >
                                        {isDeleting === item.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {/* Active Borrowers Modal */}
            {viewingLoansFor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-slate-700/50">
                            <h2 className="text-xl font-bold text-white mb-1">Active Borrowers</h2>
                            <p className="text-slate-400 text-sm">Users currently holding {viewingLoansFor.name}</p>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4">
                            {viewingLoansFor.activeLoans.map((loan) => (
                                <div key={loan.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex justify-between items-start gap-4">
                                    <div>
                                        <div className="font-medium text-white">{loan.user.name || "Unknown User"}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">{loan.user.email}</div>
                                        {loan.purpose && (
                                            <div className="text-sm text-slate-300 mt-2 italic">"{loan.purpose}"</div>
                                        )}
                                        <div className="text-xs text-slate-500 mt-2">
                                            Borrowed on {new Date(loan.borrowedAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-lg flex flex-col items-center">
                                        <span className="text-orange-400 font-bold text-lg leading-none">{loan.quantity}</span>
                                        <span className="text-[10px] text-orange-400/80 uppercase font-medium mt-1">Qty</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-6 border-t border-slate-700/50 flex justify-end">
                            <button
                                onClick={() => setViewingLoansFor(null)}
                                className="px-5 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
