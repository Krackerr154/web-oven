"use client";

import { useState, useMemo } from "react";
import { Search, Beaker, MapPin, Database, Loader2, MessageCircle, ShoppingCart, Plus, Minus, X } from "lucide-react";
import { GlasswareItem, borrowMultipleGlassware } from "@/app/actions/glassware";
import Link from "next/link";
import Fuse from "fuse.js";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

// --- Types ---
type CartItem = {
    glassware: GlasswareItem;
    quantity: number;
    purpose: string;
};

// --- Main Client ---
export default function UserGlasswareClient({ initialData }: { initialData: GlasswareItem[] }) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");

    // Cart State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    // Cart Handlers
    const addToCart = (item: GlasswareItem) => {
        if (item.availableQuantity <= 0) return;

        setCart(prev => {
            const existing = prev.find(p => p.glassware.id === item.id);
            if (existing) {
                if (existing.quantity >= item.availableQuantity) return prev;
                return prev.map(p => p.glassware.id === item.id ? { ...p, quantity: p.quantity + 1 } : p);
            }
            return [...prev, { glassware: item, quantity: 1, purpose: "" }];
        });
        toast.success(`Added ${item.name} to list`, { icon: '🛒', duration: 1500 });
    };

    const updateCartQty = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.glassware.id === id) {
                const newQty = Math.max(0, Math.min(item.quantity + delta, item.glassware.availableQuantity));
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const updateCartPurpose = (id: string, purpose: string) => {
        setCart(prev => prev.map(item =>
            item.glassware.id === id ? { ...item, purpose } : item
        ));
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.glassware.id !== id));
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setIsSubmitting(true);

        try {
            const payload = cart.map(item => ({
                id: item.glassware.id,
                quantity: item.quantity,
                purpose: item.purpose.trim() || `Borrowing ${item.quantity}x ${item.glassware.name}`
            }));

            const res = await borrowMultipleGlassware(payload);

            if (res.success) {
                toast.success(`Successfully checked out ${cart.length} items!`);
                setCart([]);
                setIsCartOpen(false);
                router.refresh();
            } else {
                toast.error(res.message || "Failed to process checkout.");
            }
        } catch (error) {
            toast.error("An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 relative pb-24">
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

            {/* Empty State / Grid Container */}
            {filteredData.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                    <Database className="mx-auto h-12 w-12 text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-300">No Glassware Found</h3>
                    <p className="text-slate-500 mt-2">Try adjusting your search terms.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredData.map((item) => {
                        const isLabOwned = !item.ownerId;
                        const inCartQty = cart.find(c => c.glassware.id === item.id)?.quantity || 0;
                        const actualAvailable = item.availableQuantity - inCartQty;

                        // Visual Scarcity Logic
                        const isLowStock = actualAvailable > 0 && actualAvailable <= 2;
                        const isOutOfStock = actualAvailable <= 0;

                        const stockColor = isOutOfStock
                            ? "text-rose-400"
                            : isLowStock
                                ? "text-amber-400"
                                : "text-emerald-400";

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

                                    {/* Stock Metrics */}
                                    {isLabOwned && (
                                        <div className="flex items-center justify-between py-2 border-y border-slate-800/60 my-3">
                                            <div>
                                                <div className="text-xs text-slate-500 font-medium mb-0.5">Available</div>
                                                <div className={`text-xl font-bold ${stockColor}`}>{actualAvailable}</div>
                                            </div>
                                            {inCartQty > 0 && (
                                                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1 text-center animate-fade-in">
                                                    <div className="text-[10px] text-orange-400 uppercase font-bold tracking-wider">In Cart</div>
                                                    <div className="text-lg font-bold text-orange-400">{inCartQty}</div>
                                                </div>
                                            )}
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
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-slate-700/50 flex flex-col gap-3">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span className="max-w-full truncate">{item.location || "Unassigned"}</span>
                                    </div>

                                    {/* Contextual Action Button */}
                                    {isLabOwned ? (
                                        <button
                                            type="button"
                                            onClick={() => addToCart(item)}
                                            disabled={isOutOfStock}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-all text-sm font-medium border border-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                                        >
                                            {isOutOfStock ? "Out of Stock" : "Add to List"}
                                            {!isOutOfStock && <Plus className="h-4 w-4" />}
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

            {/* Floating Cart Summary Bar */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 sm:left-64 bg-slate-900 border-t border-slate-700/50 p-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] z-40 transition-transform animate-slide-up">
                    <div className="max-w-7xl mx-auto flex items-center justify-between px-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-orange-500/20 text-orange-400 p-3 rounded-xl border border-orange-500/30">
                                <ShoppingCart className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-lg">{cart.length} Item{cart.length !== 1 && 's'} Selected</h4>
                                <p className="text-slate-400 text-sm hidden sm:block">Ready to borrow for your experiment</p>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsCartOpen(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg transition-colors flex items-center gap-2"
                        >
                            Review & Checkout
                        </button>
                    </div>
                </div>
            )}

            {/* Cart Modal / Drawer */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-slate-700/50 flex justify-between items-center gap-4">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold text-white mb-1">Borrowing List</h2>
                                <p className="text-slate-400 text-sm">Please verify quantities and add specific purposes if needed.</p>
                            </div>
                            <button onClick={() => setIsCartOpen(false)} className="p-2 shrink-0 text-slate-400 hover:text-white bg-slate-800 rounded-lg">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4 flex-1">
                            {cart.map((cartItem) => (
                                <div key={cartItem.glassware.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                    <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 mb-3">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-white text-lg break-words">{cartItem.glassware.name}</h4>
                                            <p className="text-slate-400 text-sm break-words">{cartItem.glassware.size} {cartItem.glassware.unit} • {cartItem.glassware.type}</p>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <button
                                                onClick={() => updateCartQty(cartItem.glassware.id, -1)}
                                                className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                                            >
                                                <Minus className="h-4 w-4" />
                                            </button>
                                            <span className="w-8 text-center font-bold text-lg text-orange-400">{cartItem.quantity}</span>
                                            <button
                                                onClick={() => updateCartQty(cartItem.glassware.id, 1)}
                                                disabled={cartItem.quantity >= cartItem.glassware.availableQuantity}
                                                className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </button>

                                            <div className="w-px h-8 bg-slate-700 mx-2 hidden sm:block"></div>

                                            <button
                                                onClick={() => removeFromCart(cartItem.glassware.id)}
                                                className="mt-1 sm:mt-0 p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                title="Remove from list"
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <input
                                        type="text"
                                        value={cartItem.purpose}
                                        onChange={(e) => updateCartPurpose(cartItem.glassware.id, e.target.value)}
                                        placeholder="Purpose (Optional, e.g., Synthesis Lab Section A)"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="p-6 border-t border-slate-700/50 bg-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                            <p className="text-slate-400 text-sm text-center sm:text-left flex-1 min-w-0">
                                Items must be returned in the same condition. Report any breakage.
                            </p>
                            <div className="flex gap-3 w-full sm:w-auto shrink-0 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setCart([])}
                                    className="px-4 py-2 text-rose-400 hover:bg-rose-500/10 text-sm font-medium rounded-lg transition-colors shrink-0"
                                >
                                    Clear All
                                </button>
                                <button
                                    onClick={handleCheckout}
                                    disabled={isSubmitting || cart.length === 0}
                                    className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-50 shrink-0"
                                >
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    Confirm Borrowing
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
