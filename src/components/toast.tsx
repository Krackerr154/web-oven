"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import {
  toastTheme,
  notificationTheme,
  type ToastVariant,
} from "@/config/notification-theme";

// ─── Types ───────────────────────────────────────────────────────────

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
};

// ─── Context ─────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => removeToast(id), notificationTheme.toast.duration);
    },
    [removeToast]
  );

  const value: ToastContextValue = {
    toast: addToast,
    success: useCallback((m: string) => addToast(m, "success"), [addToast]),
    error: useCallback((m: string) => addToast(m, "error"), [addToast]),
    warning: useCallback((m: string) => addToast(m, "warning"), [addToast]),
    info: useCallback((m: string) => addToast(m, "info"), [addToast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast container */}
      <div
        className={`fixed ${notificationTheme.toast.position === "top-right" ? "top-4 right-4" : ""} z-[100] flex flex-col gap-2 ${notificationTheme.toast.maxWidth} w-full pointer-events-none`}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Toast Item ──────────────────────────────────────────────────────

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const config = toastTheme[toast.variant];
  const Icon = config.icon;
  const theme = notificationTheme.toast;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 ${theme.padding} ${theme.rounded} border ${config.bg} ${config.border} ${theme.shadow} ${theme.backdrop} ${notificationTheme.animation.enter}`}
      role="alert"
    >
      <Icon className={`h-5 w-5 ${config.text} shrink-0 mt-0.5`} />
      <p className={`text-sm ${config.text} flex-1`}>{toast.message}</p>
      <button
        onClick={onDismiss}
        className={`${theme.closeButtonColor} ${theme.closeButtonHoverColor} shrink-0`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
