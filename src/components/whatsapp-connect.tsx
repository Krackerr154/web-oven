"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Loader2, CheckCircle2, AlertCircle, ExternalLink, Link2 } from "lucide-react";
import type { WhatsappLinkInfo } from "@/lib/whatsapp";
import { CODE_REQUEST_COOLDOWN_MINUTES, CODE_TTL_MINUTES } from "@/lib/whatsapp";

/**
 * "Connect WhatsApp" card for /profile.
 *
 * The member never types a number. Tapping the button opens WhatsApp with
 * "link" prefilled; LUMA replies with a tappable confirm link; the confirm page
 * binds that phone to this signed-in account. Four taps, zero typing.
 *
 * The host provisioner approves the code on a 30 s timer, so the outcome is
 * never in a response — it is polled back, same as the Telegram card.
 */
export function WhatsappConnect({
    initial,
    deepLink,
}: {
    initial: WhatsappLinkInfo;
    deepLink: string | null;
}) {
    const [link, setLink] = useState<WhatsappLinkInfo>(initial);
    const [status, setStatus] = useState<"idle" | "unlinking">("idle");
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            const res = await fetch("/api/whatsapp/link", { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json().catch(() => null);
            if (data?.link) setLink(data.link as WhatsappLinkInfo);
        } catch {
            // Transient — the next poll retries.
        }
    }, []);

    // Only poll while the provisioner still has work to do.
    useEffect(() => {
        if (link.state !== "verifying") return;
        const id = setInterval(() => void refresh(), 5000);
        return () => clearInterval(id);
    }, [link.state, refresh]);

    const unlink = useCallback(async () => {
        setStatus("unlinking");
        setError(null);
        try {
            const res = await fetch("/api/whatsapp/link", { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error || "Could not unlink.");
                return;
            }
            if (data?.link) setLink(data.link as WhatsappLinkInfo);
        } catch {
            setError("Could not reach the server.");
        } finally {
            setStatus("idle");
        }
    }, []);

    const tone =
        link.state === "ready"
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            : link.state === "verifying"
              ? "bg-sky-500/10 border-sky-500/30 text-sky-300"
              : link.state === "failed" || link.state === "expired"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                : "bg-slate-700/30 border-slate-600/50 text-slate-300";

    const linked = link.state === "ready";

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">LUMA on WhatsApp</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
                Link your WhatsApp so LUMA can recognise you there — with your own
                memory, not anyone else&apos;s.
            </p>

            {linked ? (
                <div className="space-y-3">
                    <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-slate-200">
                                {link.phone ?? "WhatsApp"}
                                <span className="text-slate-500"> linked</span>
                            </p>
                            <p className="text-[11px] text-slate-500">
                                Message LUMA on WhatsApp and it will know who you are.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={unlink}
                        disabled={status !== "idle"}
                        className="text-xs text-slate-400 hover:text-rose-400 underline underline-offset-2 disabled:opacity-50"
                    >
                        {status === "unlinking" ? "Unlinking…" : "Unlink"}
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${tone}`}>
                        {link.state === "verifying" ? (
                            <Loader2 className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin" />
                        ) : link.state === "failed" || link.state === "expired" ? (
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        ) : (
                            <Link2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                            <p className="text-[11px] font-medium">{link.label}</p>
                            <p className="text-[11px] text-slate-400 break-words">{link.detail}</p>
                        </div>
                    </div>

                    {deepLink && link.state !== "verifying" ? (
                        <a
                            href={deepLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                        >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Open WhatsApp
                            <ExternalLink className="w-3 h-3 opacity-70" />
                        </a>
                    ) : null}

                    <ol className="text-[11px] text-slate-500 space-y-1 list-decimal list-inside">
                        <li>Tap Open WhatsApp and press Send — the message is already written.</li>
                        <li>LUMA replies with a link. Tap it.</li>
                        <li>Confirm on the page it opens. Done.</li>
                    </ol>
                    <p className="text-[11px] text-slate-600">
                        The code is valid for {CODE_TTL_MINUTES} minutes and a new one can be
                        requested every {CODE_REQUEST_COOLDOWN_MINUTES}. Nothing is linked
                        until you press Confirm.
                    </p>
                </div>
            )}

            {error && (
                <p className="mt-3 flex items-start gap-1.5 text-[11px] text-rose-400">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{error}</span>
                </p>
            )}
        </div>
    );
}
