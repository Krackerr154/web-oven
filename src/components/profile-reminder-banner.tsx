"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, X } from "lucide-react";

interface ProfileReminderBannerProps {
    hasImage: boolean;
    hasNickname: boolean;
}

export function ProfileReminderBanner({ hasImage, hasNickname }: ProfileReminderBannerProps) {
    const [dismissed, setDismissed] = useState(false);

    // If both exist, no need for the banner
    if ((hasImage && hasNickname) || dismissed) return null;

    return (
        <div className="relative overflow-hidden rounded-xl bg-orange-500/10 border border-orange-500/20 mb-8 animate-fade-in group">
            {/* Decorative gradient blur */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                    <div className="p-2.5 bg-orange-500/20 rounded-lg shrink-0">
                        <AlertCircle className="h-6 w-6 text-orange-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-orange-100 flex items-center gap-2">
                            Complete Your Profile
                        </h3>
                        <p className="text-sm text-orange-200/80 mt-1 max-w-xl">
                            Your profile is missing {(!hasImage && !hasNickname) ? "an avatar and a nickname" : (!hasImage ? "an avatar" : "a nickname")}.
                            Personalize your account to make your bookings easy to identify on the calendar.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto shrink-0 w-full sm:w-auto">
                    <Link
                        href="/profile"
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium rounded-lg transition-all shadow-[0_0_15px_rgba(249,115,22,0.3)] hover:shadow-[0_0_20px_rgba(249,115,22,0.5)]"
                    >
                        Update Profile
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                    <button
                        onClick={() => setDismissed(true)}
                        className="p-2.5 text-orange-300 hover:bg-orange-500/10 hover:text-orange-200 rounded-lg transition-colors border border-transparent hover:border-orange-500/20"
                        title="Dismiss for now"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
