"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { CURRENT_VERSION } from "@/lib/changelog";

const STORAGE_KEY = "ap-lab:changelog-seen";

/**
 * Version label and an "unseen release" dot in the sidebar.
 *
 * The dot exists to answer one question: "did something change since I last
 * looked?" So it is stored per browser rather than per account — a shared lab
 * machine showing a dot to a student who already read the notes on their phone
 * is a false alarm, and this is a courtesy signal, not a record.
 *
 * The seen-marker is written when this link is clicked *and* when the changelog
 * route is the current page, because a user can reach it by history navigation
 * or a direct URL without ever clicking this link.
 *
 * Read in an effect, never during render: localStorage does not exist on the
 * server, and reading it during render would produce a hydration mismatch.
 */
export function ChangelogLink({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();
    const [unseen, setUnseen] = useState(false);

    useEffect(() => {
        let seen: string | null = null;
        try {
            seen = window.localStorage.getItem(STORAGE_KEY);
        } catch {
            // Private mode or storage disabled: show no dot rather than nag.
            return;
        }
        setUnseen(seen !== CURRENT_VERSION);
    }, []);

    useEffect(() => {
        if (pathname !== "/changelog") return;
        try {
            window.localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
        } catch {
            /* nothing to do — the dot simply stays */
        }
        setUnseen(false);
    }, [pathname]);

    return (
        <Link
            href="/changelog"
            onClick={() => {
                try {
                    window.localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
                } catch {
                    /* ignore */
                }
                setUnseen(false);
                // On mobile the sidebar is an overlay over the page, so it has
                // to close itself or the new route stays hidden behind it.
                onNavigate?.();
            }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] transition-colors ${
                pathname === "/changelog"
                    ? "bg-slate-700/60 text-slate-200"
                    : "text-slate-500 hover:bg-slate-700/40 hover:text-slate-300"
            }`}
        >
            <span className="relative flex items-center">
                <Sparkles className="h-3.5 w-3.5" />
                {unseen && (
                    <span
                        className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-orange-400 ring-2 ring-slate-800"
                        aria-hidden="true"
                    />
                )}
            </span>
            <span className="flex-1">
                Changelog
                {unseen && <span className="sr-only"> (new release)</span>}
            </span>
            <span className="font-mono text-[10px] text-slate-600">v{CURRENT_VERSION}</span>
        </Link>
    );
}
