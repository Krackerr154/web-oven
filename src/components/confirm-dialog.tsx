"use client";

import { useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import {
  confirmDialogTheme,
  notificationTheme,
  type ConfirmDialogVariant,
} from "@/config/notification-theme";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: ConfirmDialogVariant;
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
  const theme = notificationTheme.dialog;
  const variantConfig = confirmDialogTheme[variant];

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

  const Icon = variantConfig.icon;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 ${theme.backdropBg} ${theme.backdropBlur}`}
        onClick={() => !loading && onCancel()}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        className={`relative ${theme.bg} border ${theme.border} ${theme.rounded} ${theme.padding} w-full max-w-sm ${theme.shadow} ${notificationTheme.animation.enter}`}
      >
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-lg ${variantConfig.iconBg}`}>
            <Icon className={`h-5 w-5 ${variantConfig.iconText}`} />
          </div>
          <div className="flex-1">
            <h3 id="confirm-title" className={`text-base font-semibold ${theme.titleColor}`}>
              {title}
            </h3>
            <p id="confirm-desc" className={`text-sm ${theme.descColor} mt-1`}>
              {description}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={`flex-1 py-2.5 ${theme.rounded} border ${theme.cancelButtonBg} ${theme.cancelButtonText} ${theme.cancelButtonHover} font-medium text-sm transition-colors disabled:opacity-50`}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 ${theme.rounded} font-medium text-sm text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${variantConfig.buttonBg} ${variantConfig.buttonHover}`}
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
