'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to send reset email');
            }

            setIsSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
            {/* Decorative background element for desktop */}
            <div className="hidden sm:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white">
                        Forgot your password?
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Enter your email address and we'll send you a link to reset your password.
                    </p>
                </div>

                {isSuccess ? (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                        <div className="flex flex-col items-center text-center">
                            <div className="inline-flex items-center justify-center p-3 rounded-full bg-green-500/20 mb-4">
                                <Mail className="h-6 w-6 text-green-400" aria-hidden="true" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Check your email</h3>
                            <p className="text-sm text-slate-400 mb-6">
                                If an account exists for <strong className="text-slate-200">{email}</strong>, we have sent a password reset link.
                            </p>
                            <Link
                                href="/login"
                                className="w-full py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900 inline-flex items-center justify-center"
                            >
                                Return to login
                            </Link>
                        </div>
                    </div>
                ) : (
                    <form className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-2.5 mt-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending link...
                                </>
                            ) : (
                                'Send Reset Link'
                            )}
                        </button>

                        <div className="flex items-center justify-center mt-6 pt-4 border-t border-slate-700">
                            <Link href="/login" className="text-sm font-medium text-orange-400 hover:text-orange-300 flex items-center gap-1 group">
                                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
