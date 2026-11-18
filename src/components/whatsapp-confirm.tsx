"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import type { WhatsappLinkInfo } from "@/lib/whatsapp";

/**
 * The Confirm step. The code arrives in the URL because LUMA put it there; the
 * identity comes from the session cookie. Pressing Confirm is what joins the
 * two, so nothing is linked until this button is pressed.
 */
export function WhatsappConfirm({
    code,
    initial,
}: {
    code: string;
    initial: WhatsappLinkInfo;
}) {
    const [link, setLink] = useState<WhatsappLinkInfo>(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            const res = await fetch("/api/whatsapp/link", { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json().catch(() => null);
            if (data?.link) setLink(data.link as WhatsappLinkInfo);
        } catch {
            // Retried by the next poll.
        }
    }, []);

    useEffect(() => {
        if (link.state !== "verifying") return;
        const id = setInterval(() => void refresh(), 5000);
        return () => clearInterval(id);
    }, [link.state, refresh]);

    const confirm = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch("/api/whatsapp/link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error || "Could not confirm this code.");
                return;
            }
            if (data?.link) setLink(data.link as WhatsappLinkInfo);
        } catch {
            setError("Could not reach the server.");
        } finally {
            setBusy(false);
        }
    }, [code]);

    return (
        <div className="max-w-lg">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h1 className="text-lg font-semibold text-white">Link this WhatsApp to your account?</h1>
                </div>

                <p className="text-sm text-slate-400">
                    LUMA received a message from a WhatsApp account and gave it this code:
                </p>

                <p className="font-mono text-2xl tracking-[0.2em] text-emerald-300 bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-3 text-center">
                    {code}
                </p>

                <p className="text-xs text-slate-500">
                    Confirming binds that number to <span className="text-slate-300">your</span> AP-Lab
                    account. You never type a number, and no number can be claimed by
                    anyone who did not receive this code.
                </p>

                {link.state === "ready" ? (
                    <div className="flex items-start gap-2 rounded-lg border px-3 py-2.5 bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-xs font-medium">Linked{link.phone ? ` — ${link.phone}` : ""}</p>
                            <p className="text-[11px] text-slate-400">
                                Message LUMA on WhatsApp and it will know who you are.
                            </p>
                        </div>
                    </div>
                ) : link.state === "verifying" ? (
                    <div className="flex items-start gap-2 rounded-lg border px-3 py-2.5 bg-sky-500/10 border-sky-500/30 text-sky-300">
                        <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin" />
                        <div className="min-w-0">
                            <p className="text-xs font-medium">{link.label}</p>
                            <p className="text-[11px] text-slate-400">{link.detail}</p>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={confirm}
                        disabled={busy}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        {busy ? "Confirming…" : "Confirm and link"}
                    </button>
                )}

                {error && (
                    <p className="flex items-start gap-1.5 text-xs text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </p>
                )}

                <p className="text-[11px] text-slate-600">
                    <Link href="/profile" className="underline underline-offset-2 hover:text-slate-400">
                        Back to profile
                    </Link>
                </p>
            </div>
        </div>
    );
}
