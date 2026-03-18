/**
 * Centralized theme configuration for notifications, toasts, and confirmation dialogs.
 * Customize these values to match your web application's design system.
 */

import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";

// ─── Toast Theme Configuration ─────────────────────────────────────────

export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastVariantConfig = {
  icon: typeof CheckCircle;
  bg: string;
  border: string;
  text: string;
};

/**
 * Theme configuration for toast notifications.
 * Each variant (success, error, warning, info) has its own color scheme.
 */
export const toastTheme: Record<ToastVariant, ToastVariantConfig> = {
  success: {
    icon: CheckCircle,
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-300",
  },
  error: {
    icon: XCircle,
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-300",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-300",
  },
  info: {
    icon: Info,
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-300",
  },
};

// ─── Confirm Dialog Theme Configuration ────────────────────────────────

export type ConfirmDialogVariant = "danger" | "warning";

export type ConfirmDialogVariantConfig = {
  icon: typeof AlertTriangle;
  iconBg: string;
  iconText: string;
  buttonBg: string;
  buttonHover: string;
};

/**
 * Theme configuration for confirmation dialogs.
 * Each variant (danger, warning) has its own color scheme.
 */
export const confirmDialogTheme: Record<
  ConfirmDialogVariant,
  ConfirmDialogVariantConfig
> = {
  danger: {
    icon: AlertTriangle,
    iconBg: "bg-red-500/15",
    iconText: "text-red-400",
    buttonBg: "bg-red-600",
    buttonHover: "hover:bg-red-500",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-500/15",
    iconText: "text-amber-400",
    buttonBg: "bg-amber-600",
    buttonHover: "hover:bg-amber-500",
  },
};

// ─── Common Theme Values ────────────────────────────────────────────────

/**
 * Common theme values used across notification components.
 * Modify these to change the overall look and feel of notifications.
 */
export const notificationTheme = {
  // Toast specific
  toast: {
    duration: 4000, // Auto-dismiss duration in milliseconds
    position: "top-right", // Position of toast container
    maxWidth: "max-w-sm", // Maximum width of toast
    rounded: "rounded-xl", // Border radius
    padding: "px-4 py-3", // Internal padding
    shadow: "shadow-lg", // Shadow depth
    backdrop: "backdrop-blur-md", // Backdrop blur effect
    closeButtonColor: "text-slate-500",
    closeButtonHoverColor: "hover:text-slate-300",
  },

  // Confirm dialog specific
  dialog: {
    bg: "bg-slate-800", // Dialog background
    border: "border-slate-700", // Dialog border
    backdropBg: "bg-black/60", // Backdrop background
    backdropBlur: "backdrop-blur-sm", // Backdrop blur
    rounded: "rounded-xl", // Border radius
    padding: "p-6", // Internal padding
    shadow: "shadow-2xl", // Shadow depth
    titleColor: "text-white", // Title text color
    descColor: "text-slate-400", // Description text color
    cancelButtonBg: "border-slate-600", // Cancel button border
    cancelButtonText: "text-slate-300", // Cancel button text
    cancelButtonHover: "hover:bg-slate-700", // Cancel button hover
  },

  // Animation
  animation: {
    enter: "animate-toast-in", // Enter animation class
    enterDuration: "0.2s", // Animation duration
  },
} as const;
