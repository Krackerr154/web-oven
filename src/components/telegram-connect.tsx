"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link2, Loader2, CheckCircle2, Send, AlertCircle } from "lucide-react";
import type { ProvisioningInfo } from "@/lib/telegram-provisioning";

/**
 * "Connect Telegram" card for /profile.
 *
 * Uses the Telegram Login Widget in callback mode (`data-onauth`) rather than
 * the redirect mode: the payload is POSTed to /api/telegram/link from an
 * authenticated same-site fetch, so there is no shareable callback URL an
 * attacker could hand to a logged-in victim.
 *
 * The widget injects an iframe, so it cannot be a React element — the script
 * tag is appended imperatively after `window.onTelegramAuth` exists. React
 * will happily render the tag before the handler is defined, and the widget
 * calls the handler by name.
 */

type LinkedState = {
    telegramUserId: string | null;
    telegramUsername: string | null;
    telegramLinkedAt: string | null;
};

type WidgetUser = {
    id: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: string;
    hash: string;
};

declare global {
    interface Window {
        onTelegramAuth?: (user: WidgetUser) => void;
    }
}

export function TelegramConnect({ initial }: { initial: LinkedState }) {
    const [state, setState] = useState<LinkedState>(initial);
    const [status, setStatus] = useState<"idle" | "linking" | "unlinking">("idle");
    const [error, setError] = useState<string | null>(null);
    const [provisioning, setProvisioning] = useState<ProvisioningInfo | null>(null);
    const widgetRef = useRef<HTMLDivElement | null>(null);
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "LUMA154_bot";

    // The host provisioner runs on a timer, so the outcome is never in the POST
    // response — it has to be read back. Poll while it is still working.
    const refreshProvisioning = useCallback(async () => {
        try {
            const res = await fetch("/api/telegram/link", { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json().catch(() => null);
            if (data?.provisioning) setProvisioning(data.provisioning as ProvisioningInfo);
        } catch {
            // Transient network failure — the next poll retries.
        }
    }, []);

    useEffect(() => {
        void refreshProvisioning();
    }, [refreshProvisioning, state.telegramUserId]);

    useEffect(() => {
        if (provisioning?.state !== "provisioning") return;
        const id = setInterval(() => void refreshProvisioning(), 5000);
        return () => clearInterval(id);
    }, [provisioning?.state, refreshProvisioning]);

    const submit = useCallback(async (user: WidgetUser) => {
        setStatus("linking");
        setError(null);
        try {
            const res = await fetch("/api/telegram/link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(user),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error || "Could not link this Telegram account.");
                return;
            }
            setState({
                telegramUserId: data.telegramUserId ?? null,
                telegramUsername: data.telegramUsername ?? null,
                telegramLinkedAt: data.telegramLinkedAt ?? null,
            });
            void refreshProvisioning();
        } catch {
            setError("Network error while linking. Please try again.");
        } finally {
            setStatus("idle");
        }
    }, [refreshProvisioning]);

    // The widget calls a global function by name. Define it, then mount the
    // script; tear both down on unmount so a re-render cannot stack widgets.
    useEffect(() => {
        if (state.telegramUserId) return;
        const host = widgetRef.current;
        if (!host) return;

        window.onTelegramAuth = (user: WidgetUser) => {
            void submit(user);
        };

        host.innerHTML = "";
        const script = document.createElement("script");
        script.async = true;
        script.src = "https://telegram.org/js/telegram-widget.js?22";
        script.setAttribute("data-telegram-login", botUsername);
        script.setAttribute("data-size", "medium");
        script.setAttribute("data-radius", "6");
        script.setAttribute("data-userpic", "false");
        script.setAttribute("data-request-access", "write");
        script.setAttribute("data-onauth", "onTelegramAuth(user)");
        host.appendChild(script);

        return () => {
            delete window.onTelegramAuth;
            host.innerHTML = "";
        };
    }, [botUsername, state.telegramUserId, submit]);

    const unlink = async () => {
        setStatus("unlinking");
        setError(null);
        try {
            const res = await fetch("/api/telegram/link", { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data?.error || "Could not unlink.");
                return;
            }
            setState({ telegramUserId: null, telegramUsername: null, telegramLinkedAt: null });
            setProvisioning(null);
        } catch {
            setError("Network error while unlinking.");
        } finally {
            setStatus("idle");
        }
    };

    const linked = Boolean(state.telegramUserId);
    const tone =
        provisioning?.state === "ready"
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
            : provisioning?.state === "failed" || provisioning?.state === "suspended"
              ? "border-rose-500/30 bg-rose-500/5 text-rose-300"
              : "border-amber-500/30 bg-amber-500/5 text-amber-300";

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
                <Send className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-semibold text-white">LUMA on Telegram</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
                Link your Telegram account so LUMA can recognise you in chat
                without asking who you are.
            </p>

            {linked ? (
                <div className="space-y-3">
                    <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-slate-200">
                                {state.telegramUsername ? `@${state.telegramUsername}` : "Telegram account"}
                                <span className="text-slate-500"> linked</span>
                            </p>
                            <p className="font-mono text-[11px] text-slate-500 break-all">
                                id {state.telegramUserId}
                            </p>
                        </div>
                    </div>
                    {provisioning && provisioning.state !== "not_linked" && (
                        <div className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${tone}`}>
                            {provisioning.state === "provisioning" ? (
                                <Loader2 className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin" />
                            ) : provisioning.state === "ready" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            ) : (
                                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            )}
                            <div className="min-w-0">
                                <p className="text-[11px] font-medium">{provisioning.label}</p>
                                <p className="text-[11px] text-slate-400 break-words">{provisioning.detail}</p>
                                {provisioning.state === "ready" && (
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        Message <span className="font-mono">@{botUsername}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
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
                    <div className="flex items-center gap-2">
                        {status === "linking" ? (
                            <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Verifying with Telegram…
                            </span>
                        ) : (
                            <div ref={widgetRef} className="min-h-[40px]" />
                        )}
                    </div>
                    <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
                        <Link2 className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>
                            Telegram confirms the account to us — we never see your
                            phone number or password.
                        </span>
                    </p>
                </div>
            )}

            {error && (
                <p className="mt-3 flex items-start gap-1.5 text-[11px] text-rose-400">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    {error}
                </p>
            )}
        </div>
    );
}
