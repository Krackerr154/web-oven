# Notification Theme Configuration

This directory contains the centralized theme configuration for all notification components in the application.

## Overview

The `notification-theme.ts` file provides a single source of truth for all notification, toast, and confirmation dialog styling. This makes it easy to customize the appearance of notifications to match your web application's design system.

## Files

- **notification-theme.ts** - Central theme configuration for notifications

## Components Using This Theme

1. **Toast Component** (`/src/components/toast.tsx`)
   - Success, error, warning, and info toast notifications
   - Auto-dismiss after configurable duration
   - Customizable colors, positioning, and styling

2. **Confirm Dialog Component** (`/src/components/confirm-dialog.tsx`)
   - Danger and warning confirmation dialogs
   - Customizable colors and styling

## Customization

To customize the notification theme, edit the `notification-theme.ts` file:

### Toast Theme

```typescript
export const toastTheme: Record<ToastVariant, ToastVariantConfig> = {
  success: {
    icon: CheckCircle,
    bg: "bg-emerald-500/10",      // Background color
    border: "border-emerald-500/30", // Border color
    text: "text-emerald-300",      // Text color
  },
  // ... other variants
};
```

### Confirm Dialog Theme

```typescript
export const confirmDialogTheme: Record<ConfirmDialogVariant, ConfirmDialogVariantConfig> = {
  danger: {
    icon: AlertTriangle,
    iconBg: "bg-red-500/15",      // Icon background
    iconText: "text-red-400",      // Icon color
    buttonBg: "bg-red-600",        // Button background
    buttonHover: "hover:bg-red-500", // Button hover state
  },
  // ... other variants
};
```

### Common Settings

```typescript
export const notificationTheme = {
  toast: {
    duration: 4000,              // Auto-dismiss duration in ms
    position: "top-right",       // Toast container position
    maxWidth: "max-w-sm",        // Maximum width
    rounded: "rounded-xl",       // Border radius
    padding: "px-4 py-3",        // Internal padding
    shadow: "shadow-lg",         // Shadow depth
    backdrop: "backdrop-blur-md", // Backdrop blur effect
    // ... more settings
  },
  dialog: {
    bg: "bg-slate-800",          // Dialog background
    border: "border-slate-700",  // Dialog border
    backdropBg: "bg-black/60",   // Backdrop background
    // ... more settings
  },
  animation: {
    enter: "animate-toast-in",   // Enter animation class
    enterDuration: "0.2s",       // Animation duration
  },
};
```

## Example Usage

### Toast Notifications

```typescript
import { useToast } from "@/components/toast";

function MyComponent() {
  const toast = useToast();

  // Show success toast
  toast.success("Operation completed successfully!");

  // Show error toast
  toast.error("Something went wrong!");

  // Show warning toast
  toast.warning("Please check your input!");

  // Show info toast
  toast.info("Here's some information");
}
```

### Confirm Dialogs

```typescript
import { ConfirmDialog } from "@/components/confirm-dialog";

function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <ConfirmDialog
      open={open}
      title="Delete Item"
      description="Are you sure you want to delete this item?"
      variant="danger"
      confirmLabel="Delete"
      onConfirm={handleDelete}
      onCancel={() => setOpen(false)}
    />
  );
}
```

## Benefits

1. **Centralized Configuration** - All notification styling in one place
2. **Easy Customization** - Change colors and styles without modifying component code
3. **Consistent Design** - Ensures all notifications follow the same design system
4. **Type Safety** - Full TypeScript support with proper types
5. **Maintainable** - Easy to update and extend

## Tailwind CSS Classes

All theme values use Tailwind CSS utility classes. Make sure any custom classes you add are available in your Tailwind configuration.
