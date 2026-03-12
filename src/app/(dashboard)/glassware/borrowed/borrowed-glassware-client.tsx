"use client";

import { useState, useEffect } from "react";
import { Beaker, Calendar, Clock, RotateCcw, Loader2, ArrowLeft, AlertCircle, CheckSquare, Square } from "lucide-react";
import { requestReturnGlassware, requestMultipleReturnGlassware } from "@/app/actions/glassware";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { formatDateWib } from "@/lib/utils";

type LoanItem = {
    id: string;
    quantity: number;
    purpose: string | null;
    borrowedAt: Date;
    status: string;
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

    // --- Batch Return State ---
    const [selectedLoans, setSelectedLoans] = useState<Set<string>>(new Set());
    const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

    const toggleLoanSelection = (id: string, currentStatus: string) => {
        if (currentStatus !== "BORROWED") return; // Only allow returning active loans

        const newSet = new Set(selectedLoans);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedLoans(newSet);
    };

    const toggleSelectAll = () => {
        const returnableLoans = loans.filter(l => l.status === "BORROWED");
        if (selectedLoans.size === returnableLoans.length) {
            setSelectedLoans(new Set());
        } else {
            setSelectedLoans(new Set(returnableLoans.map(l => l.id)));
        }
    };

    const handleBatchReturn = async () => {
        if (selectedLoans.size === 0) return;
        setIsSubmittingBatch(true);
        try {
            const res = await requestMultipleReturnGlassware(Array.from(selectedLoans));
            if (res.success) {
                toast.success(`Successfully requested return for ${selectedLoans.size} items!`);
                setSelectedLoans(new Set());
                router.refresh();
            } else {
                toast.error(res.message || "Failed to request return.");
            }
        } catch (error) {
            toast.error("An unexpected error occurred.");
        } finally {
            setIsSubmittingBatch(false);
        }
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

        setReturningId(returnModal.loan.id);
        try {
            const res = await requestReturnGlassware(returnModal.loan.id);
            if (res.success) {
                toast.success(`Successfully requested return for ${returnModal.loan.glassware.name}!`);
                setReturnModal({ isOpen: false, loan: null });
                router.refresh();
            } else {
                toast.error(res.message || "Failed to request return.");
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
                        <h2 className="text-xl font-bold text-white mb-2">Request Return</h2>
                        <p className="text-slate-400 mb-6 text-sm">
                            You are requesting to return <strong className="text-white">{returnModal.loan.quantity}x {returnModal.loan.glassware.name}</strong>. Please bring the items to the lab admin for inspection.
                        </p>

                        <div className="flex gap-3 justify-end pt-2 border-t border-slate-700/50">
                            <button
                                onClick={() => setReturnModal({ isOpen: false, loan: null })}
                                className="px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitReturn}
                                disabled={returningId !== null}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors font-medium text-sm"
                            >
                                {returningId !== null ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Requesting...
                                    </>
                                ) : (
                                    "Confirm Return Request"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Back Header & Select All */}
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
                <div className="flex items-center gap-4">
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

                {loans.filter(l => l.status === "BORROWED").length > 0 && (
                    <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                    >
                        {selectedLoans.size === loans.filter(l => l.status === "BORROWED").length ? (
                            <><CheckSquare className="h-4 w-4 text-emerald-400" /> Deselect All</>
                        ) : (
                            <><Square className="h-4 w-4" /> Select All Returnable</>
                        )}
                    </button>
                )}
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
                                            {loan.status === "PENDING_BORROW" && (
                                                <span className="w-fit px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                    Pending Approval
                                                </span>
                                            )}
                                            {loan.status === "BORROWED" && (
                                                <span className="w-fit px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                    Active Loan
                                                </span>
                                            )}
                                            {loan.status === "PENDING_RETURN" && (
                                                <span className="w-fit px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                    Pending Inspection
                                                </span>
                                            )}
                                            {loan.status === "REJECTED" && (
                                                <span className="w-fit px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                    Rejected
                                                </span>
                                            )}
                                            {loan.glassware.customId && (
                                                <span className="text-xs font-mono text-slate-500">ID: {loan.glassware.customId}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {loan.status === "BORROWED" && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleLoanSelection(loan.id, loan.status); }}
                                                    className="shrink-0 transition-colors"
                                                >
                                                    {selectedLoans.has(loan.id) ? (
                                                        <CheckSquare className="h-6 w-6 text-emerald-400" />
                                                    ) : (
                                                        <Square className="h-6 w-6 text-slate-500 hover:text-slate-400 transition-colors" />
                                                    )}
                                                </button>
                                            )}
                                            <h3 className="font-semibold text-lg text-white group-hover:text-emerald-400 transition-colors line-clamp-2" title={loan.glassware.name}>
                                                {loan.glassware.name}
                                            </h3>
                                        </div>
                                        <p className="text-sm text-slate-400 mt-1 pl-9 truncate" title={`${loan.glassware.size} ${loan.glassware.unit} • ${loan.glassware.type}`}>
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

                            {loan.status === "BORROWED" && (
                                <button
                                    type="button"
                                    onClick={() => openReturnModal(loan)}
                                    disabled={returningId === loan.id}
                                    className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg transition-all font-medium border border-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                                >
                                    <RotateCcw className="h-5 w-5 transition-transform group-hover/btn:-rotate-90" />
                                    <span>Request Return</span>
                                </button>
                            )}
                            {loan.status === "PENDING_BORROW" && (
                                <div className="mt-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm flex items-start justify-center gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <span>Waiting for admin to issue equipment.</span>
                                </div>
                            )}
                            {loan.status === "PENDING_RETURN" && (
                                <div className="mt-6 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400 text-sm flex items-start justify-center gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <span>Waiting for admin inspection.</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Floating Batch Action Bar */}
            {selectedLoans.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 sm:left-64 bg-slate-900 border-t border-slate-700/50 p-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] z-40 transition-transform animate-slide-up">
                    <div className="max-w-7xl mx-auto flex items-center justify-between px-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-emerald-500/20 text-emerald-400 p-3 rounded-xl border border-emerald-500/30">
                                <RotateCcw className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-lg">{selectedLoans.size} Item{selectedLoans.size !== 1 && 's'} Selected</h4>
                                <p className="text-slate-400 text-sm hidden sm:block">Ready to be requested for return.</p>
                            </div>
                        </div>

                        <button
                            onClick={handleBatchReturn}
                            disabled={isSubmittingBatch}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSubmittingBatch ? <Loader2 className="h-5 w-5 animate-spin" /> : <RotateCcw className="h-5 w-5" />}
                            Request Return ({selectedLoans.size})
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
