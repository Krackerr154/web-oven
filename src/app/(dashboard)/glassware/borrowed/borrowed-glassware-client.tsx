"use client";

import { useState, useEffect } from "react";
import { Beaker, Calendar, Clock, RotateCcw, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { returnGlassware } from "@/app/actions/glassware";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { formatDateWib } from "@/lib/utils";

type LoanItem = {
    id: string;
    quantity: number;
    purpose: string | null;
    borrowedAt: Date;
    glassware: {
        name: string;
        type: string;
        size: string;
        unit: string;
        customId: string | null;
    }
};

export default function BorrowedGlasswareClient({ loans }: { loans: LoanItem[] }) {
    const router = useRouter();
    const [returningId, setReturningId] = useState<string | null>(null);

    // Modal state
    const [returnModal, setReturnModal] = useState<{ isOpen: boolean; loan: LoanItem | null }>({
        isOpen: false,
        loan: null,
    });
    const [returnedQty, setReturnedQty] = useState(0);
    const [brokenQty, setBrokenQty] = useState(0);

    const openReturnModal = (loan: LoanItem) => {
        setReturnModal({ isOpen: true, loan });
        setReturnedQty(loan.quantity);
        setBrokenQty(0);
    };

    // Auto-calculate logic (optional, but requested by some for convenience, 
    // here we just let them input manually to be safe)

    // Add escape key listener to close modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && returnModal.isOpen) {
                setReturnModal({ isOpen: false, loan: null });
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [returnModal.isOpen]);

    const submitReturn = async () => {
        if (!returnModal.loan) return;

        if (returnedQty + brokenQty !== returnModal.loan.quantity) {
            toast.error(`Total returned must equal exactly ${returnModal.loan.quantity}`);
            return;
        }

        setReturningId(returnModal.loan.id);
        try {
            const res = await returnGlassware(returnModal.loan.id, returnedQty, brokenQty);
            if (res.success) {
                toast.success(`Successfully returned ${returnModal.loan.glassware.name}!`);
                setReturnModal({ isOpen: false, loan: null });
                router.refresh();
            } else {
                toast.error(res.message || "Failed to return item.");
            }
        } catch (error) {
            toast.error("An unexpected error occurred.");
        } finally {
            setReturningId(null);
        }
    };

    return (
        <div className="space-y-6 relative">
            {/* Modal */}
            {returnModal.isOpen && returnModal.loan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-2">Return Glassware</h2>
                        <p className="text-slate-400 mb-6 text-sm">
                            Returning <strong className="text-white">{returnModal.loan.quantity}x {returnModal.loan.glassware.name}</strong>. Please specify the condition of the items you are returning.
                        </p>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-emerald-400 mb-1">
                                    Intact & Clean Quantity
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max={returnModal.loan.quantity}
                                    value={returnedQty}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setReturnedQty(val);
                                    }}
                                    className="w-full bg-slate-950 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-red-400 mb-1 gap-2 flex items-center">
                                    Broken / Lost Quantity
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max={returnModal.loan.quantity}
                                    value={brokenQty}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setBrokenQty(val);
                                    }}
                                    className="w-full bg-slate-950 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                                />
                                {brokenQty > 0 && (
                                    <p className="text-xs text-red-400 mt-2 flex items-start gap-1.5">
                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                        These items will be permanently deducted from the lab's inventory.
                                    </p>
                                )}
                            </div>

                            {returnedQty + brokenQty !== returnModal.loan.quantity && (
                                <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400 text-sm flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <span>Quantities must add up to exactly {returnModal.loan.quantity}. Currently: {returnedQty + brokenQty}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 justify-end pt-2 border-t border-slate-700/50">
                            <button
                                onClick={() => setReturnModal({ isOpen: false, loan: null })}
                                className="px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitReturn}
                                disabled={returningId !== null || returnedQty + brokenQty !== returnModal.loan.quantity}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors font-medium text-sm"
                            >
                                {returningId !== null ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    "Confirm Return"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Back Header */}
            <div className="flex items-center gap-4 border-b border-slate-700/50 pb-4">
                <Link
                    href="/glassware"
                    className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="text-sm font-medium text-slate-400">
                    Back to Inventory
                </div>
            </div>

            {/* Grid */}
            {loans.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                    <div className="mx-auto h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20">
                        <Beaker className="h-8 w-8 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-medium text-white">All Clear!</h3>
                    <p className="text-slate-400 mt-2 max-w-sm mx-auto">
                        You don't have any active glassware loans. Thank you for keeping the lab tidy!
                    </p>
                    <Link
                        href="/glassware"
                        className="inline-block mt-6 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Browse Inventory
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loans.map((loan) => (
                        <div key={loan.id} className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 hover:border-emerald-500/30 transition-all flex flex-col justify-between group">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex flex-col mb-1 gap-1">
                                            <span className="w-fit px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                                Active Loan
                                            </span>
                                            {loan.glassware.customId && (
                                                <span className="text-xs font-mono text-slate-500">ID: {loan.glassware.customId}</span>
                                            )}
                                        </div>
                                        <h3 className="font-semibold text-lg text-white group-hover:text-emerald-400 transition-colors">
                                            {loan.glassware.name}
                                        </h3>
                                        <p className="text-sm text-slate-400 mt-1">
                                            {loan.glassware.size} {loan.glassware.unit} • {loan.glassware.type}
                                        </p>
                                    </div>
                                    <div className="text-right bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/50">
                                        <div className="text-xl font-bold text-white leading-none">
                                            {loan.quantity}
                                        </div>
                                        <div className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">
                                            Qty
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 mt-5 bg-slate-800/30 p-3 rounded-xl border border-slate-700/30">
                                    <div className="flex items-center gap-2.5 text-sm">
                                        <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
                                        <div className="flex flex-col">
                                            <span className="text-slate-500 text-xs font-medium">Date Borrowed</span>
                                            <span className="text-slate-200">{formatDateWib(loan.borrowedAt)}</span>
                                        </div>
                                    </div>
                                    {loan.purpose && (
                                        <div className="flex items-start gap-2.5 text-sm pt-2 border-t border-slate-700/30 mt-2">
                                            <Clock className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                                            <div className="flex flex-col">
                                                <span className="text-slate-500 text-xs font-medium">Purpose</span>
                                                <span className="text-slate-300 italic">"{loan.purpose}"</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => openReturnModal(loan)}
                                disabled={returningId === loan.id}
                                className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg transition-all font-medium border border-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                            >
                                <RotateCcw className="h-5 w-5 transition-transform group-hover/btn:-rotate-90" />
                                <span>Return Glassware</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
