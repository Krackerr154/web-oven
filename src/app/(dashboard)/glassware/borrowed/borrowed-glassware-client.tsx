"use client";

import { useState } from "react";
import { Beaker, Calendar, Clock, RotateCcw, Loader2, ArrowLeft } from "lucide-react";
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

    const handleReturn = async (loanId: string, name: string) => {
        if (!window.confirm(`Are you sure you want to return ${name}?`)) return;

        setReturningId(loanId);
        try {
            const res = await returnGlassware(loanId);
            if (res.success) {
                toast.success(`Successfully returned ${name}!`);
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
        <div className="space-y-6">
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
                        className="inline-block mt-6 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
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
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                                Active Loan
                                            </span>
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
                                            Borrowed
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

                            <div className="mt-6 pt-4 border-t border-slate-700/50">
                                <button
                                    type="button"
                                    onClick={() => handleReturn(loan.id, loan.glassware.name)}
                                    disabled={returningId === loan.id}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl transition-all font-medium border border-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                                >
                                    {returningId === loan.id ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <RotateCcw className="h-5 w-5 transition-transform group-hover/btn:-rotate-90" />
                                    )}
                                    <span>Return Glassware</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
