"use client";

import { useEffect, useRef, useCallback } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

type ConfirmDialogProps = {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: "danger" | "warning";
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = "Confirm",
    variant = "danger",
    loading = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const confirmRef = useRef<HTMLButtonElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    // Auto-focus confirm button on open
    useEffect(() => {
        if (open) {
            confirmRef.current?.focus();
        }
    }, [open]);

    // Close on Escape
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape" && !loading) {
                onCancel();
            }
        },
        [onCancel, loading]
    );

    useEffect(() => {
        if (open) {
            document.addEventListener("keydown", handleKeyDown);
            return () => document.removeEventListener("keydown", handleKeyDown);
        }
    }, [open, handleKeyDown]);

    if (!open) return null;

    const isDanger = variant === "danger";

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => !loading && onCancel()}
            />

            {/* Dialog */}
            <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                aria-describedby="confirm-desc"
                className="relative bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl animate-toast-in"
            >
                <div className="flex items-start gap-4">
                    <div
                        className={`p-2 rounded-lg ${isDanger ? "bg-red-500/15" : "bg-amber-500/15"
                            }`}
                    >
                        <AlertTriangle
                            className={`h-5 w-5 ${isDanger ? "text-red-400" : "text-amber-400"
                                }`}
                        />
                    </div>
                    <div className="flex-1">
                        <h3
                            id="confirm-title"
                            className="text-base font-semibold text-white"
                        >
                            {title}
                        </h3>
                        <p id="confirm-desc" className="text-sm text-slate-400 mt-1">
                            {description}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 font-medium text-sm transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        ref={confirmRef}
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 py-2.5 rounded-lg font-medium text-sm text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${isDanger
                                ? "bg-red-600 hover:bg-red-500"
                                : "bg-amber-600 hover:bg-amber-500"
                            }`}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            confirmLabel
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
