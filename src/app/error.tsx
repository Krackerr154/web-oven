"use client";

import { useEffect } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error("Global Error Caught:", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-sm text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
                    <AlertTriangle className="h-8 w-8 text-rose-500" />
                </div>

                <h1 className="mb-2 text-2xl font-bold text-white tracking-tight">
                    Oops! Something went wrong
                </h1>

                <p className="mb-8 text-slate-400">
                    We're experiencing technical difficulties loading this page. Our team has been notified.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={() => reset()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 border border-slate-700"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Try Again
                    </button>

                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 shadow-lg shadow-blue-500/20"
                    >
                        <Home className="h-4 w-4" />
                        Return Home
                    </Link>
                </div>

                {process.env.NODE_ENV !== "production" && (
                    <div className="mt-8 text-left bg-black/40 p-4 rounded-lg overflow-x-auto">
                        <p className="text-xs text-rose-400 font-mono mb-1">Developer Details:</p>
                        <p className="text-xs text-slate-500 font-mono whitespace-pre-wrap">{error.message}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
