"use client";

import { useState, useMemo } from "react";
import { Search, Beaker, MapPin, Database, Loader2, ArrowRight, MessageCircle } from "lucide-react";
import { GlasswareItem, borrowGlassware } from "@/app/actions/glassware";
import Link from "next/link";
import Fuse from "fuse.js";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

// --- Dialog Component ---
function BorrowDialog({ item, isOpen, onClose }: { item: GlasswareItem | null, isOpen: boolean, onClose: () => void }) {
    const router = useRouter();
    const [quantity, setQuantity] = useState("1");
    const [purpose, setPurpose] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !item) return null;

    const handleBorrow = async (e: React.FormEvent) => {
        e.preventDefault();

        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty <= 0) {
            toast.error("Please enter a valid amount.");
            return;
        }
        if (qty > item.availableQuantity) {
            toast.error(`Only ${item.availableQuantity} available to borrow.`);
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await borrowGlassware(item.id, qty, purpose);
            if (res.success) {
                toast.success(`Successfully borrowed ${qty} ${item.name}!`);
                router.refresh(); // Refresh DB state
                onClose();
            } else {
                toast.error(res.message || "Failed to borrow item.");
            }
        } catch (error) {
            toast.error("An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-700/50">
                    <h2 className="text-xl font-bold text-white mb-1">Borrow Glassware</h2>
                    <p className="text-slate-400 text-sm">You are requesting to borrow {item.name}.</p>
                </div>

                <form onSubmit={handleBorrow} className="p-6 space-y-5">
                    <div className="flex justify-between items-center text-sm bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                        <span className="text-slate-400">Available to Borrow:</span>
                        <span className="font-bold text-orange-400 text-lg">{item.availableQuantity}</span>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Quantity Needed</label>
                        <input
                            type="number"
                            min="1"
                            max={item.availableQuantity}
                            required
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Purpose (Optional)</label>
                        <textarea
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            rows={2}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all resize-none text-sm"
                            placeholder="e.g. Synthesis experiment tomorrow"
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || item.availableQuantity <= 0}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-all shadow-lg flex items-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Confirm Borrow
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// --- Main Client ---
export default function UserGlasswareClient({ initialData }: { initialData: GlasswareItem[] }) {
    const [searchTerm, setSearchTerm] = useState("");

    // Borrow Modal State
    const [borrowItem, setBorrowItem] = useState<GlasswareItem | null>(null);

    // Filter Logic
    const fuse = useMemo(() => new Fuse(initialData, {
        keys: ["name", "customId", "type", "brand", "location", "size"],
        threshold: 0.3,
        ignoreLocation: true,
    }), [initialData]);

    const filteredData = useMemo(() => {
        if (!searchTerm.trim()) return initialData;
        return fuse.search(searchTerm).map(res => res.item);
    }, [searchTerm, initialData, fuse]);

    return (
        <div className="space-y-6">
            {/* Search and Action Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full max-w-md flex-1">
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
                        placeholder="Search glassware by name, type, size..."
                    />
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                    <Link
                        href="/glassware/borrowed"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg active:scale-[0.98]"
                    >
                        Active Loans
                    </Link>
                    <Link
                        href="/glassware/add"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg active:scale-[0.98]"
                    >
                        <Beaker className="h-4 w-4" />
                        Add Private
                    </Link>
                </div>
            </div>

            {/* Empty State */}
            {filteredData.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                    <Database className="mx-auto h-12 w-12 text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-300">No Glassware Found</h3>
                    <p className="text-slate-500 mt-2">Try adjusting your search terms.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredData.map((item) => {
                        const isLabOwned = !item.ownerId;

                        return (
                            <div key={item.id} className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 hover:border-orange-500/30 transition-all flex flex-col justify-between group">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                {isLabOwned ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                        Lab Owned
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                        User Owned
                                                    </span>
                                                )}
                                                {isLabOwned && item.customId && (
                                                    <span className="text-xs font-mono text-slate-500">
                                                        {item.customId}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-semibold text-lg text-white mb-1 group-hover:text-orange-400 transition-colors">
                                                {item.name}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Stock Metrics (Only for Lab Owned, User owned is just 'Contact to ask') */}
                                    {isLabOwned && (
                                        <div className="flex items-center gap-4 py-2 border-y border-slate-800/60 my-3">
                                            <div>
                                                <div className="text-xs text-slate-500 font-medium">Available</div>
                                                <div className="text-xl font-bold text-orange-400">{item.availableQuantity}</div>
                                            </div>
                                            <div className="h-6 w-px bg-slate-700"></div>
                                            <div>
                                                <div className="text-xs text-slate-500 font-medium">Total</div>
                                                <div className="text-lg font-bold text-slate-300">{item.quantity}</div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2 mt-4">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Type</span>
                                            <span className="text-slate-200 font-medium">{item.type}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Size</span>
                                            <span className="text-slate-200 font-medium">{item.size} {item.unit}</span>
                                        </div>
                                        {item.condition && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Condition</span>
                                                <span className="text-slate-200 font-medium">{item.condition}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-slate-700/50 flex flex-col gap-3">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span className="max-w-full truncate">{item.location || "Unassigned"}</span>
                                    </div>

                                    {/* Contextual Action Button based on Ownership */}
                                    {isLabOwned ? (
                                        <button
                                            type="button"
                                            onClick={() => setBorrowItem(item)}
                                            disabled={item.availableQuantity <= 0}
                                            className="w-full flex items-center justify-between px-4 py-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-all text-sm font-medium border border-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                                        >
                                            <span>{item.availableQuantity > 0 ? "Borrow Item" : "Out of Stock"}</span>
                                            {item.availableQuantity > 0 && <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />}
                                        </button>
                                    ) : (
                                        <a
                                            href={`https://wa.me/${item.owner?.phone?.replace(/\D/g, "")}?text=Hi%20${encodeURIComponent(item.owner?.name || "")},%20are%20you%20still%20using%20the%20${encodeURIComponent(item.name)}?`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full flex justify-between items-center px-4 py-2 text-sm font-medium rounded-lg text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-all border border-[#25D366]/20"
                                        >
                                            Contact {item.owner?.name?.split(' ')[0] || "Owner"}
                                            <MessageCircle className="h-4 w-4" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Borrow Request Dialog */}
            <BorrowDialog
                isOpen={!!borrowItem}
                item={borrowItem}
                onClose={() => setBorrowItem(null)}
            />
        </div>
    );
}
