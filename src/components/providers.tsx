"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/toast";
import { CSPostHogProvider } from "@/providers/PostHogProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CSPostHogProvider>
      <SessionProvider>
        <ToastProvider>{children}</ToastProvider>
      </SessionProvider>
    </CSPostHogProvider>
  );
}
