"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyOtp, resendOtp } from "@/app/actions/auth";
import { Mail, Loader2, KeyRound } from "lucide-react";

function VerifyEmailForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const emailParam = searchParams.get("email") || "";

    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!emailParam) {
            router.push("/register");
        }
    }, [emailParam, router]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setMessage("");
        setLoading(true);

        const result = await verifyOtp(emailParam, otp);

        setLoading(false);

        if (result.success) {
            router.push("/pending");
        } else {
            setError(result.message);
        }
    }

    async function handleResend() {
        setError("");
        setMessage("");
        setResendLoading(true);

        const result = await resendOtp(emailParam);

        setResendLoading(false);

        if (result.success) {
            setMessage("A new verification code has been sent to your email.");
        } else {
            setError(result.message);
        }
    }

    if (!emailParam) return null;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
            {/* Decorative background element for desktop */}
            <div className="hidden sm:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center p-3 rounded-xl bg-orange-500/20 mb-4">
                        <Mail className="h-8 w-8 text-orange-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Verify Your Email</h1>
                    <p className="text-slate-400 mt-2">
                        We've sent a 6-digit code to <strong className="text-white">{emailParam}</strong>
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4"
                >
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-300">
                            {message}
                        </div>
                    )}

                    <div>
                        <label htmlFor="otp" className="block text-sm font-medium text-slate-300 mb-1.5 flex justify-between">
                            Verification Code
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <KeyRound className="h-5 w-5 text-slate-500" />
                            </div>
                            <input
                                id="otp"
                                name="otp"
                                type="text"
                                required
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                className="w-full pl-10 px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-center text-lg tracking-widest font-mono"
                                placeholder="000000"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || otp.length < 6}
                        className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            "Verify Email"
                        )}
                    </button>

                    <div className="mt-6 pt-4 border-t border-slate-700 text-center">
                        <p className="text-sm text-slate-400 mb-2">Didn't receive the code?</p>
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={resendLoading}
                            className="text-orange-400 hover:text-orange-300 text-sm font-medium disabled:opacity-50 flex items-center gap-2 mx-auto"
                        >
                            {resendLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                "Resend Code"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        }>
            <VerifyEmailForm />
        </Suspense>
    );
}
