"use client";

import { useState, useMemo } from "react";
import { Search, Beaker, MapPin, Database, Loader2, MessageCircle, ShoppingCart, Plus, Minus, X, LayoutGrid, List as ListIcon, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { GlasswareItem, borrowMultipleGlassware, deleteUserGlassware } from "@/app/actions/glassware";
import Link from "next/link";
import Fuse from "fuse.js";
import { useToast } from "@/components/toast";
import { useRouter } from "next/navigation";

// --- Types ---
type CartItem = {
    glassware: GlasswareItem;
    quantity: number;
    purpose: string;
};

// --- Main Client ---
export default function UserGlasswareClient({ initialData, currentUserId }: { initialData: GlasswareItem[], currentUserId?: string }) {
    const router = useRouter();
    const toast = useToast();
    const [searchTerm, setSearchTerm] = useState("");

    // Cart State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    // View & Pagination & Sorting State
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    const itemsPerPage = viewMode === 'grid' ? 12 : 20;

    // Filter Logic
    const fuse = useMemo(() => new Fuse(initialData, {
        keys: ["name", "customId", "type", "brand", "location", "size"],
        threshold: 0.3,
        ignoreLocation: true,
    }), [initialData]);

    const processedData = useMemo(() => {
        // 1. Filter
        let data = initialData;
        if (searchTerm.trim()) {
            data = fuse.search(searchTerm).map(res => res.item);
        }

        // 2. Sort
        data = [...data].sort((a, b) => {
            const getSortValue = (item: GlasswareItem, key: string) => {
                switch (key) {
                    case 'name': return item.name.toLowerCase();
                    case 'type': return item.type.toLowerCase();
                    case 'size': return parseInt(item.size) || 0; // Simple num sort for brevity
                    case 'location': return (item.location || "").toLowerCase();
                    case 'available': return item.availableQuantity;
                    case 'source': return item.ownerId ? 1 : 0; // Lab owned first
                    default: return '';
                }
            };

            const aVal = getSortValue(a, sortConfig.key);
            const bVal = getSortValue(b, sortConfig.key);

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return data;
    }, [searchTerm, initialData, fuse, sortConfig]);

    // 3. Paginate
    const totalPages = Math.ceil(processedData.length / itemsPerPage);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return processedData.slice(start, start + itemsPerPage);
    }, [processedData, currentPage, itemsPerPage]);

    // Reset to page 1 when search or sort changes
    useMemo(() => setCurrentPage(1), [searchTerm, sortConfig, viewMode]);

    // Sorting Handlers
    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig.key !== columnKey) return <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-30 transition-opacity" />;
        return sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 text-orange-400" /> : <ChevronDown className="h-4 w-4 text-orange-400" />;
    };

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
        toast.success(`Added ${item.name} to list`);
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

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to permanently delete your item "${name}"? This action cannot be undone.`)) {
            return;
        }

        setIsDeleting(id);
        try {
            const res = await deleteUserGlassware(id);
            if (res.success) {
                toast.success("Item deleted successfully.");
                router.refresh();
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
        <>
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

                </div>

                {/* View Toggle */}
                <div className="flex bg-slate-800/80 border border-slate-700/50 rounded-xl p-1 shrink-0">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                        title="Grid View"
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                        title="Table View"
                    >
                        <ListIcon className="h-4 w-4" />
                    </button>
                </div>

                {/* Mobile Sort Dropdown (Visible mainly in Grid) */}
                {viewMode === 'grid' && (
                    <select
                        value={`${sortConfig.key}-${sortConfig.direction}`}
                        onChange={(e) => {
                            const [key, dir] = e.target.value.split('-');
                            setSortConfig({ key, direction: dir as 'asc' | 'desc' });
                        }}
                        className="bg-slate-800/80 border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-slate-300 focus:ring-2 focus:ring-orange-500/50 outline-none shrink-0"
                    >
                        <option value="name-asc">Name (A-Z)</option>
                        <option value="name-desc">Name (Z-A)</option>
                        <option value="available-desc">Most Available</option>
                        <option value="size-asc">Size (Smallest)</option>
                        <option value="source-asc">Source (Lab First)</option>
                    </select>
                )}

                <div className="flex gap-2 w-full sm:w-auto shrink-0">
                    <Link
                        href="/glassware/borrowed"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg active:scale-[0.98]"
                    >
                        Active Loans
                    </Link>
                    <Link
                        href="/glassware/add"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg active:scale-[0.98]"
                    >
                        <Beaker className="h-4 w-4 hidden sm:block" />
                        Add My Glassware
                    </Link>
                </div>
            </div>
            {/* Empty State / Content Container */}
            {
                processedData.length === 0 ? (
                    <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                        <Database className="mx-auto h-12 w-12 text-slate-600 mb-4" />
                        <h3 className="text-lg font-medium text-slate-300">No Glassware Found</h3>
                        <p className="text-slate-500 mt-2">Try adjusting your search terms.</p>
                    </div>
                ) : (
                    <>
                        {/* View Modes */}
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {paginatedData.map((item) => {
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
                                        <div key={item.id} className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 flex flex-col justify-between group">
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
                                                        <h3 className="font-semibold text-lg text-white mb-1 line-clamp-2" title={item.name}>
                                                            {item.name}
                                                        </h3>
                                                    </div>
                                                    {!isLabOwned && item.ownerId === currentUserId && (
                                                        <div className="flex gap-1.5 shrink-0">
                                                            <Link
                                                                href={`/glassware/${item.id}/edit`}
                                                                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 hover:border-slate-600"
                                                                title="Edit Private Item"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Link>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(item.id, item.name)}
                                                                disabled={isDeleting === item.id}
                                                                className="p-2 text-rose-400 hover:text-white hover:bg-rose-500/20 bg-slate-800 rounded-lg transition-colors border border-slate-700/50 hover:border-rose-500/50"
                                                                title="Delete Item"
                                                            >
                                                                {isDeleting === item.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Stock Metrics */}
                                                {isLabOwned ? (
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
                                                ) : (
                                                    <div className="flex items-center justify-between py-2 border-y border-slate-800/60 my-3">
                                                        <div>
                                                            <div className="text-xs text-slate-500 font-medium mb-0.5">Quantity Owned</div>
                                                            <div className="text-xl font-bold text-slate-300">{item.quantity}</div>
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
                                                </div>
                                            </div>

                                            <div className="mt-6 pt-4 border-t border-slate-700/50 flex flex-col gap-3">
                                                <div className="flex flex-col gap-2 w-full min-w-0">
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
                                                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="truncate flex-1" title={item.location || "Unassigned"}>{item.location || "Unassigned"}</span>
                                                    </div>
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
                                                ) : item.ownerId === currentUserId ? (
                                                    <div className="flex gap-2 w-full">
                                                        <Link
                                                            href={`/glassware/${item.id}/edit`}
                                                            className="flex-1 flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-all border border-amber-500/20"
                                                        >
                                                            Manage Item
                                                            <Pencil className="h-4 w-4" />
                                                        </Link>
                                                    </div>
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
                        ) : (
                            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider select-none">
                                            <tr>
                                                <th className="px-4 py-3 font-medium border-b border-slate-700/50 cursor-pointer group hover:text-white transition-colors" onClick={() => handleSort('name')}>
                                                    <div className="flex items-center gap-1">Name <SortIcon columnKey="name" /></div>
                                                </th>
                                                <th className="px-4 py-3 font-medium border-b border-slate-700/50 cursor-pointer group hover:text-white transition-colors hidden sm:table-cell" onClick={() => handleSort('type')}>
                                                    <div className="flex items-center gap-1">Type <SortIcon columnKey="type" /></div>
                                                </th>
                                                <th className="px-4 py-3 font-medium border-b border-slate-700/50 cursor-pointer group hover:text-white transition-colors" onClick={() => handleSort('size')}>
                                                    <div className="flex items-center gap-1">Size <SortIcon columnKey="size" /></div>
                                                </th>
                                                <th className="px-4 py-3 font-medium border-b border-slate-700/50 cursor-pointer group hover:text-white transition-colors hidden md:table-cell" onClick={() => handleSort('source')}>
                                                    <div className="flex items-center gap-1">Source <SortIcon columnKey="source" /></div>
                                                </th>
                                                <th className="px-4 py-3 font-medium border-b border-slate-700/50 cursor-pointer group hover:text-white transition-colors hidden lg:table-cell" onClick={() => handleSort('location')}>
                                                    <div className="flex items-center gap-1">Location <SortIcon columnKey="location" /></div>
                                                </th>
                                                <th className="px-4 py-3 font-medium border-b border-slate-700/50 text-right cursor-pointer group hover:text-white transition-colors" onClick={() => handleSort('available')}>
                                                    <div className="flex items-center justify-end gap-1"><SortIcon columnKey="available" /> Stock</div>
                                                </th>
                                                <th className="px-4 py-3 font-medium border-b border-slate-700/50 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50 text-slate-300">
                                            {paginatedData.map((item) => {
                                                const isLabOwned = !item.ownerId;
                                                const inCartQty = cart.find(c => c.glassware.id === item.id)?.quantity || 0;
                                                const actualAvailable = item.availableQuantity - inCartQty;
                                                const isOutOfStock = actualAvailable <= 0;

                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                                                        <td className="px-4 py-3 font-medium text-slate-200 max-w-[150px] sm:max-w-[250px]">
                                                            <div className="truncate" title={item.name}>
                                                                {item.name}
                                                            </div>
                                                            {item.customId && <span className="mt-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono hidden md:inline-block">{item.customId}</span>}
                                                        </td>
                                                        <td className="px-4 py-3 hidden sm:table-cell">{item.type}</td>
                                                        <td className="px-4 py-3 text-slate-400">{item.size} {item.unit}</td>
                                                        <td className="px-4 py-3 hidden md:table-cell">
                                                            {isLabOwned ? (
                                                                <span className="text-blue-400 text-xs font-medium">Lab</span>
                                                            ) : (
                                                                <span className="text-amber-400 text-xs font-medium">User</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 hidden lg:table-cell text-slate-400 truncate max-w-[150px]" title={item.location || ""}>{item.location || "-"}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            {isLabOwned ? (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <span className={`font-bold ${isOutOfStock ? 'text-rose-400' : 'text-emerald-400'}`}>{actualAvailable}</span>
                                                                    {inCartQty > 0 && <span className="text-xs bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/20">+{inCartQty}</span>}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-500">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {isLabOwned ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => addToCart(item)}
                                                                    disabled={isOutOfStock}
                                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg text-sm font-medium transition-colors border border-blue-500/20 disabled:opacity-50 whitespace-nowrap"
                                                                >
                                                                    {isOutOfStock ? "Empty" : "Add"} <Plus className="h-3 w-3 hidden sm:block" />
                                                                </button>
                                                            ) : (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {item.ownerId === currentUserId ? (
                                                                        <>
                                                                            <Link
                                                                                href={`/glassware/${item.id}/edit`}
                                                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg text-sm font-medium transition-colors border border-amber-500/20 whitespace-nowrap"
                                                                                title="Edit Item"
                                                                            >
                                                                                Edit <Pencil className="h-3 w-3 hidden sm:block" />
                                                                            </Link>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDelete(item.id, item.name)}
                                                                                disabled={isDeleting === item.id}
                                                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 rounded-lg text-sm font-medium transition-colors border border-rose-500/20 whitespace-nowrap"
                                                                                title="Delete Item"
                                                                            >
                                                                                {isDeleting === item.id ? (
                                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                                ) : (
                                                                                    <>Delete <Trash2 className="h-3 w-3 hidden sm:block" /></>
                                                                                )}
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <a
                                                                            href={`https://wa.me/${item.owner?.phone?.replace(/\D/g, "")}?text=Hi%20${encodeURIComponent(item.owner?.name || "")},%20are%20you%20still%20using%20the%20${encodeURIComponent(item.name)}?`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 rounded-lg text-sm font-medium transition-colors border border-[#25D366]/20 whitespace-nowrap"
                                                                        >
                                                                            Contact <MessageCircle className="h-3 w-3 hidden sm:block" />
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-4 border-t border-slate-700/50 mt-6">
                                <span className="text-sm text-slate-400 hidden sm:block">
                                    Showing <span className="font-medium text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-white">{Math.min(currentPage * itemsPerPage, processedData.length)}</span> of <span className="font-medium text-white">{processedData.length}</span> results
                                </span>

                                <div className="flex gap-2 w-full sm:w-auto justify-center">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 border border-slate-700/50 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </button>
                                    <div className="flex items-center px-4 font-medium text-sm text-white">
                                        Page {currentPage} of {totalPages}
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 border border-slate-700/50 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )
            }

            {/* Floating Cart Summary Bar */}
            {
                cart.length > 0 && (
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
                )
            }

            {/* Cart Modal / Drawer */}
            {
                isCartOpen && (
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
                )
            }
        </>
    );
}
