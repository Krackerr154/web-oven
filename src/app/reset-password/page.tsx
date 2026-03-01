'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setError('Invalid or missing reset token. Please request a new password reset link.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to reset password');
            }

            setIsSuccess(true);
            // Optional: Automatically redirect to login after a few seconds
            setTimeout(() => {
                router.push('/login');
            }, 3000);
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
                <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-md text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Invalid Link</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        This password reset link is invalid or has expired.
                    </p>
                    <div className="mt-6">
                        <Link href="/forgot-password" className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            Request New Link
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
            {/* Decorative background element for desktop */}
            <div className="hidden sm:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white">
                        Reset Password
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Please enter your new password below.
                    </p>
                </div>

                {isSuccess ? (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                        <div className="flex flex-col items-center text-center">
                            <div className="inline-flex items-center justify-center p-3 rounded-full bg-green-500/20 mb-4">
                                <CheckCircle2 className="h-6 w-6 text-green-400" aria-hidden="true" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Password reset successful</h3>
                            <p className="text-sm text-slate-400 mb-6">
                                Your password has been changed successfully.
                            </p>
                            <Link
                                href="/login"
                                className="w-full py-2.5 mb-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900 inline-flex items-center justify-center"
                            >
                                Click here to login
                            </Link>
                            <p className="text-xs text-slate-500">Redirecting in 3 seconds...</p>
                        </div>
                    </div>
                ) : (
                    <form className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="new-password" className="block text-sm font-medium text-slate-300 mb-1.5">
                                    New Password
                                </label>
                                <input
                                    id="new-password"
                                    name="password"
                                    type="password"
                                    required
                                    className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                                    placeholder="At least 8 characters"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>

                            <div>
                                <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Confirm New Password
                                </label>
                                <input
                                    id="confirm-password"
                                    name="confirmPassword"
                                    type="password"
                                    required
                                    className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                                    placeholder="Retype password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-2.5 mt-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Resetting...
                                </>
                            ) : (
                                'Reset Password'
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

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}
