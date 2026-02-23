"use client";

import { useState } from "react";
import { Flame, Clock, User, AlertTriangle, Info, X, Zap, Wind } from "lucide-react";
import { formatDateTimeWib } from "@/lib/utils";

type BookingData = {
    id: string;
    startDate: Date;
    endDate: Date;
    purpose: string;
    usageTemp: number;
    flap: number;
    user: { name: string | null };
};

type OvenData = {
    id: number;
    name: string;
    type: string;
    status: string;
    maxTemp: number;
    bookings: BookingData[];
};

export function OvenStatusCard({ oven }: { oven: OvenData }) {
    const [showDetails, setShowDetails] = useState(false);

    const currentBooking = oven.bookings[0];
    const isMaintenance = oven.status === "MAINTENANCE";
    const isInUse = !!currentBooking;

    let statusColor = "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]";
    let statusText = "Available";
    let statusDot = "bg-emerald-400";

    if (isMaintenance) {
        statusColor = "bg-amber-500/10 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.05)]";
        statusText = "Maintenance";
        statusDot = "bg-amber-400";
    } else if (isInUse) {
        statusColor = "bg-red-500/10 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)]";
        statusText = "In Use";
        statusDot = "bg-red-400";
    }

    // Handle click to toggle details on mobile/desktop
    const toggleDetails = () => {
        if (isInUse) {
            setShowDetails(!showDetails);
        }
    };

    return (
        <div
            onClick={toggleDetails}
            onMouseEnter={() => isInUse && setShowDetails(true)}
            onMouseLeave={() => isInUse && setShowDetails(false)}
            className={`relative rounded-2xl border p-5 sm:p-6 hover-lift bg-slate-900/40 backdrop-blur-md overflow-hidden flex flex-col ${isInUse ? "min-h-[240px]" : "h-full"} ${statusColor} ${isInUse ? "cursor-pointer" : ""}`}
        >
            {/* Front Face */}
            <div className={`flex flex-col h-full flex-1 transition-opacity duration-300 ${showDetails ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-slate-800/80 ring-1 ring-white/5 shadow-inner">
                            {isMaintenance ? (
                                <AlertTriangle className="h-6 w-6 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                            ) : (
                                <Flame className={`h-6 w-6 drop-shadow-[0_0_8px_currentColor] ${oven.type === "NON_AQUEOUS" ? "text-orange-400" : "text-blue-400"}`} />
                            )}
                        </div>
                        <div>
                            <h2 className={`text-xl font-bold bg-clip-text text-transparent ${oven.type === "NON_AQUEOUS" ? "bg-gradient-to-r from-orange-300 to-orange-500" : "bg-gradient-to-r from-blue-300 to-blue-500"}`}>
                                {oven.name}
                            </h2>
                            <p className="text-sm text-slate-400">
                                {oven.type === "NON_AQUEOUS" ? "Non-Aqueous" : "Aqueous"}
                                {" \u00b7 Max "}{oven.maxTemp}{"\u00b0C"}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                            <div className={`h-2.5 w-2.5 rounded-full ${statusDot} animate-pulse`} role="status" aria-label={`Status: ${statusText}`} />
                            <span className="text-sm font-medium text-slate-200">
                                {statusText}
                            </span>
                        </div>
                        {isInUse && (
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 opacity-70">
                                <Info className="h-3 w-3" /> Tap for details
                            </span>
                        )}
                    </div>
                </div>

                {currentBooking && (
                    <div className="mt-auto pt-4 border-t border-slate-700/50 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <User className="h-4 w-4 shrink-0" />
                            <span className="truncate">{currentBooking.user.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <Clock className="h-4 w-4 shrink-0" />
                            <span className="truncate">
                                Until {formatDateTimeWib(currentBooking.endDate)}
                            </span>
                        </div>
                    </div>
                )}

                {!currentBooking && !isMaintenance && (
                    <div className="mt-auto pt-4 border-t border-slate-700/50">
                        <p className="text-sm text-emerald-300">
                            Ready for booking
                        </p>
                    </div>
                )}

                {isMaintenance && (
                    <div className="mt-auto pt-4 border-t border-slate-700/50">
                        <p className="text-sm text-amber-300">
                            Temporarily unavailable
                        </p>
                    </div>
                )}
            </div>

            {/* Back Face (Details Overlay) */}
            {isInUse && currentBooking && (
                <div className={`absolute inset-0 bg-slate-900/95 p-4 sm:p-5 flex flex-col transition-all duration-300 z-10 ${showDetails ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
                    <div className="flex justify-between items-start mb-3 shrink-0">
                        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                            <Info className="h-4 w-4 text-blue-400" />
                            Active Details
                        </h3>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowDetails(false); }}
                            className="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            title="Close Details"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <div className="space-y-2 flex-1 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-800/50 rounded-lg p-2">
                                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold block mb-0.5">Temp</span>
                                <div className="flex items-center gap-1.5 text-xs text-slate-200">
                                    <Zap className="h-3 w-3 text-orange-400" />
                                    {currentBooking.usageTemp}°C
                                </div>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-2">
                                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold block mb-0.5">Flap</span>
                                <div className="flex items-center gap-1.5 text-xs text-slate-200">
                                    <Wind className="h-3 w-3 text-blue-400" />
                                    {currentBooking.flap}%
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-800/50 rounded-lg p-2">
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold block mb-0.5">Time</span>
                            <p className="text-[11px] text-slate-300 line-clamp-1">{formatDateTimeWib(currentBooking.startDate)} - {formatDateTimeWib(currentBooking.endDate)}</p>
                        </div>

                        <div className="bg-slate-800/50 rounded-lg p-2">
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold block mb-0.5">Purpose</span>
                            <p className="text-[11px] text-slate-300 line-clamp-2">{currentBooking.purpose}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
