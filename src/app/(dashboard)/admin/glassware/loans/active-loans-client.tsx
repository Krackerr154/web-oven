"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Search, ShieldAlert, RotateCcw, Loader2, AlertCircle, ArrowLeft, CheckSquare, Square, CheckCircle } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { approveBorrow, rejectBorrow, confirmReturnGlassware, approveMultipleBorrow, confirmMultipleReturnGlassware } from "@/app/actions/glassware";
import { formatDateWib } from "@/lib/utils";

type ActiveLoan = {
    id: string;
    quantity: number;
    purpose: string | null;
    borrowedAt: Date;
    status: string;
    user: {
        name: string | null;
        email: string;
    };
    glassware: {
        id: string;
        name: string;
        type: string;
        size: string;
        unit: string;
        customId: string | null;
    };
};

export default function ActiveLoansClient({ loans }: { loans: ActiveLoan[] }) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [returningId, setReturningId] = useState<string | null>(null);

    // Modal state for Returns (Force Return or Confirm Inspection)
    const [returnModal, setReturnModal] = useState<{ isOpen: boolean; loan: ActiveLoan | null; isForce?: boolean }>({
        isOpen: false,
        loan: null,
        isForce: false,
    });
    const [returnedQty, setReturnedQty] = useState(0);
    const [brokenQty, setBrokenQty] = useState(0);

    const openReturnModal = (loan: ActiveLoan, isForce: boolean = false) => {
        setReturnModal({ isOpen: true, loan, isForce });
        setReturnedQty(loan.quantity);
        setBrokenQty(0);
    };

    // --- Batch Action State ---
    const [selectedLoans, setSelectedLoans] = useState<Set<string>>(new Set());
    const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

    const toggleLoanSelection = (id: string) => {
        const newSet = new Set(selectedLoans);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedLoans(newSet);
    };

    const toggleSelectAll = (statusFilter?: string[]) => {
        // If statusFilter provided, only select those that match, or ALL if already selected
        let targetLoans = loans;
        if (statusFilter) {
            targetLoans = loans.filter(l => statusFilter.includes(l.status));
        }

        const currentSelectedOfTarget = targetLoans.filter(l => selectedLoans.has(l.id));
        const newSet = new Set(selectedLoans);

        if (currentSelectedOfTarget.length === targetLoans.length && targetLoans.length > 0) {
            // Deselect all targets
            targetLoans.forEach(l => newSet.delete(l.id));
        } else {
            // Select all targets
            targetLoans.forEach(l => newSet.add(l.id));
        }
        setSelectedLoans(newSet);
    };

    const handleBatchAction = async (actionType: 'approve' | 'return') => {
        if (selectedLoans.size === 0) return;
        setIsSubmittingBatch(true);
        const ids = Array.from(selectedLoans);

        try {
            if (actionType === 'approve') {
                const res = await approveMultipleBorrow(ids);
                if (res.success) {
                    toast.success(`Successfully approved ${selectedLoans.size} requests!`);
                    setSelectedLoans(new Set());
                    router.refresh();
                } else {
                    toast.error(res.message || "Failed to approve.");
                }
            } else if (actionType === 'return') {
                if (!window.confirm(`You are confirming the complete return of ${selectedLoans.size} items. Proceed? (0 broken/lost assumed)`)) {
                    setIsSubmittingBatch(false);
                    return;
                }
                const res = await confirmMultipleReturnGlassware(ids);
                if (res.success) {
                    toast.success(`Successfully returned ${selectedLoans.size} records!`);
                    setSelectedLoans(new Set());
                    router.refresh();
                } else {
                    toast.error(res.message || "Failed to confirm returns.");
                }
            }
        } catch (error) {
            toast.error("An unexpected error occurred.");
        } finally {
            setIsSubmittingBatch(false);
        }
    };

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

        if (returnModal.isForce && !window.confirm(`FORCE RETURN WARNING: You are about to forcefully return this item on behalf of ${returnModal.loan.user.name || returnModal.loan.user.email}. Are you sure?`)) {
            return;
        }

        setReturningId(returnModal.loan.id);
        try {
            const res = await confirmReturnGlassware(returnModal.loan.id, returnedQty, brokenQty);
            if (res.success) {
                toast.success(`Successfully processed return for ${returnModal.loan.glassware.name}!`);
                setReturnModal({ isOpen: false, loan: null, isForce: false });
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

    const handleApprove = async (id: string) => {
        if (!window.confirm("Approve this borrow request and mark item as actively borrowed?")) return;
        setReturningId(id);
        const res = await approveBorrow(id);
        if (res.success) {
            toast.success("Borrow request approved!");
            router.refresh();
        } else {
            toast.error(res.message || "Failed to approve.");
        }
        setReturningId(null);
    };

    const handleReject = async (id: string, currentPurpose: string | null) => {
        const reason = window.prompt("Reason for rejection (optional):");
        if (reason === null) return; // User cancelled
        setReturningId(id);
        const res = await rejectBorrow(id, reason);
        if (res.success) {
            toast.success("Borrow request rejected.");
            router.refresh();
        } else {
            toast.error(res.message || "Failed to reject.");
        }
        setReturningId(null);
    };

    // Filter loans by user name, email, or glassware name
    const filteredLoans = loans.filter((loan) => {
        const query = searchQuery.toLowerCase();
        return (
            loan.user.name?.toLowerCase().includes(query) ||
            loan.user.email.toLowerCase().includes(query) ||
            loan.glassware.name.toLowerCase().includes(query) ||
            (loan.glassware.customId && loan.glassware.customId.toLowerCase().includes(query)) ||
            (loan.purpose && loan.purpose.toLowerCase().includes(query))
        );
    });

    return (
        <div className="space-y-6">
            {/* Return/Inspection Modal */}
            {returnModal.isOpen && returnModal.loan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg ${returnModal.isForce ? 'bg-orange-500/10 text-orange-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                <ShieldAlert className="h-6 w-6" />
                            </div>
                            <h2 className="text-xl font-bold text-white">
                                {returnModal.isForce ? "Force Return" : "Inspect Return"}
                            </h2>
                        </div>

                        <p className="text-slate-400 mb-6 text-sm">
                            You are processing <strong className="text-white">{returnModal.loan.quantity}x {returnModal.loan.glassware.name}</strong> returned by <span className="text-white">{returnModal.loan.user.name || returnModal.loan.user.email}</span>. Specify physical condition to update inventory correctly.
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
                                className={`px-5 py-2.5 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors font-medium text-sm ${returnModal.isForce ? 'bg-orange-600 hover:bg-orange-500' : 'bg-purple-600 hover:bg-purple-500'}`}
                            >
                                {returningId !== null ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    returnModal.isForce ? "Force Return" : "Confirm Return"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Bar Actions */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link
                        href="/admin/glassware"
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search borrower, glassware, or purpose..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all placeholder:text-slate-500"
                        />
                    </div>
                </div>
                {/* Batch Selection Controls */}
                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar shrink-0">
                    <button
                        onClick={() => toggleSelectAll(["PENDING_BORROW"])}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                    >
                        <Square className="h-4 w-4" /> Select Pendings
                    </button>
                    <button
                        onClick={() => toggleSelectAll(["BORROWED", "PENDING_RETURN"])}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                    >
                        <Square className="h-4 w-4" /> Select Returns
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 font-medium border-b border-slate-700/50 w-12">
                                    <button onClick={() => toggleSelectAll()} className="text-slate-500 hover:text-white transition-colors">
                                        {selectedLoans.size === loans.length && loans.length > 0 ? <CheckSquare className="h-5 w-5 text-orange-400" /> : <Square className="h-5 w-5" />}
                                    </button>
                                </th>
                                <th className="px-6 py-4 font-medium border-b border-slate-700/50">Date Borrowed</th>
                                <th className="px-6 py-4 font-medium border-b border-slate-700/50">User</th>
                                <th className="px-6 py-4 font-medium border-b border-slate-700/50">Glassware</th>
                                <th className="px-6 py-4 font-medium border-b border-slate-700/50">Purpose</th>
                                <th className="px-6 py-4 font-medium border-b border-slate-700/50 text-center">Qty</th>
                                <th className="px-6 py-4 font-medium border-b border-slate-700/50 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50 text-slate-300">
                            {filteredLoans.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <div className="max-w-md mx-auto space-y-4">
                                            <div className="h-16 w-16 mx-auto bg-slate-800/50 rounded-2xl flex items-center justify-center">
                                                <Search className="h-8 w-8 text-slate-600" />
                                            </div>
                                            <p>No active loans found matching your search.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLoans.map((loan) => (
                                    <tr key={loan.id} className={`transition-colors ${selectedLoans.has(loan.id) ? 'bg-slate-800/60' : 'hover:bg-slate-800/30'}`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button onClick={() => toggleLoanSelection(loan.id)} className="text-slate-500 hover:text-white transition-colors">
                                                {selectedLoans.has(loan.id) ? <CheckSquare className="h-5 w-5 text-orange-400" /> : <Square className="h-5 w-5" />}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-slate-200">{formatDateWib(loan.borrowedAt).split(" ")[0]}</div>
                                            <div className="text-xs text-slate-500 mt-1">{format(new Date(loan.borrowedAt), "HH:mm")}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-200">{loan.user.name || "Unknown User"}</div>
                                            <div className="text-xs text-slate-500 mt-1">{loan.user.email}</div>
                                            <div className="mt-2">
                                                {loan.status === "PENDING_BORROW" && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending Approval</span>
                                                )}
                                                {loan.status === "BORROWED" && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">Active</span>
                                                )}
                                                {loan.status === "PENDING_RETURN" && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">Ready for Inspection</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-[150px] sm:max-w-[250px] min-w-[140px]">
                                            <div className="font-medium text-slate-200 flex flex-wrap items-center gap-2 min-w-0">
                                                <span className="truncate flex-1" title={loan.glassware.name}>{loan.glassware.name}</span>
                                                {loan.glassware.customId && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-slate-400 font-mono shrink-0">
                                                        {loan.glassware.customId}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1 truncate" title={`${loan.glassware.size} ${loan.glassware.unit} • ${loan.glassware.type}`}>
                                                {loan.glassware.size} {loan.glassware.unit} • {loan.glassware.type}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-[200px] truncate text-slate-400" title={loan.purpose || ""}>
                                            {loan.purpose || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold">
                                                {loan.quantity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {loan.status === "PENDING_BORROW" && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApprove(loan.id)}
                                                            disabled={returningId !== null}
                                                            className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg text-sm font-medium transition-colors border border-emerald-500/20 disabled:opacity-50"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReject(loan.id, loan.purpose)}
                                                            disabled={returningId !== null}
                                                            className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg text-sm font-medium transition-colors border border-rose-500/20 disabled:opacity-50"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                {loan.status === "BORROWED" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openReturnModal(loan, true)}
                                                        disabled={returningId === loan.id}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 text-orange-400 hover:bg-orange-600 hover:text-white rounded-lg text-sm font-medium transition-all group border border-orange-500/20 disabled:opacity-50"
                                                    >
                                                        {returningId === loan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                                                        Force Return
                                                    </button>
                                                )}
                                                {loan.status === "PENDING_RETURN" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openReturnModal(loan, false)}
                                                        disabled={returningId === loan.id}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-600 hover:text-white rounded-lg text-sm font-medium transition-all group border border-purple-500/20 disabled:opacity-50 animate-pulse"
                                                    >
                                                        {returningId === loan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                                        Inspect Return
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Floating Batch Action Bar */}
            {selectedLoans.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 sm:left-64 bg-slate-900 border-t border-slate-700/50 p-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] z-40 transition-transform animate-slide-up">
                    <div className="max-w-7xl mx-auto flex items-center justify-between px-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-orange-500/20 text-orange-400 p-3 rounded-xl border border-orange-500/30 hidden sm:block">
                                <ShieldAlert className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm sm:text-lg">{selectedLoans.size} Selected</h4>
                                <p className="text-slate-400 text-xs sm:text-sm hidden sm:block">Select batch action to apply</p>
                            </div>
                        </div>

                        <div className="flex gap-2 sm:gap-3">
                            {/* Show approve if any pending borrow selected */}
                            {Array.from(selectedLoans).some(id => loans.find(l => l.id === id)?.status === "PENDING_BORROW") && (
                                <button
                                    onClick={() => handleBatchAction('approve')}
                                    disabled={isSubmittingBatch}
                                    className="bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white text-emerald-400 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSubmittingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                    <span className="hidden sm:inline">Approve Borrows</span>
                                    <span className="sm:hidden">Approve</span>
                                </button>
                            )}

                            {/* Show return if any borrowed/pending_return selected */}
                            {Array.from(selectedLoans).some(id => ["BORROWED", "PENDING_RETURN"].includes(loans.find(l => l.id === id)?.status || "")) && (
                                <button
                                    onClick={() => handleBatchAction('return')}
                                    disabled={isSubmittingBatch}
                                    className="bg-orange-600 hover:bg-orange-500 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-sm font-medium shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSubmittingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                                    <span className="hidden sm:inline">Confirm Returns</span>
                                    <span className="sm:hidden">Return</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
