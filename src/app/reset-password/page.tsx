'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ResetPasswordPage() {
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
        <div className="flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
            <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-md">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Reset Password
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Please enter your new password below.
                    </p>
                </div>

                {isSuccess ? (
                    <div className="rounded-md bg-green-50 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <CheckCircle2 className="h-5 w-5 text-green-400" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-green-800">Password reset successful</h3>
                                <div className="mt-2 text-sm text-green-700">
                                    <p>Your password has been changed successfully.</p>
                                </div>
                                <div className="mt-4">
                                    <div className="-mx-2 -my-1.5 flex flex-col gap-2">
                                        <Link
                                            href="/login"
                                            className="rounded-md bg-green-50 px-2 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 focus:ring-offset-green-50"
                                        >
                                            Click here to login
                                        </Link>
                                        <p className="text-xs text-gray-500">Redirecting in 3 seconds...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="rounded-md bg-red-50 p-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">Error</h3>
                                        <div className="mt-2 text-sm text-red-700">
                                            <p>{error}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">New Password</label>
                                <input
                                    id="new-password"
                                    name="password"
                                    type="password"
                                    required
                                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="At least 8 characters"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>

                            <div>
                                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                                <input
                                    id="confirm-password"
                                    name="confirmPassword"
                                    type="password"
                                    required
                                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="Retype password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        </div>

                        <div className="flex items-center justify-center mt-4">
                            <Link href="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 flex items-center gap-1 group">
                                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
