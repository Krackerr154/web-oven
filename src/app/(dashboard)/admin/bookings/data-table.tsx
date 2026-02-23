"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateTimeWib, formatDuration } from "@/lib/utils";
import { BookingActionButtons } from "./action-buttons";
import { Search, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type BookingItem = {
    id: string;
    startDate: Date;
    endDate: Date;
    purpose: string;
    usageTemp: number;
    flap: number;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED" | "AUTO_CANCELLED";
    user: { name: string | null; email: string };
    oven: { name: string; type: string };
};

type SortField = "startDate" | "duration" | "usageTemp" | "flap";
type SortDirection = "asc" | "desc";

export function AdminBookingTable({ bookings }: { bookings: BookingItem[] }) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [sortField, setSortField] = useState<SortField>("startDate");
    const [sortDir, setSortDir] = useState<SortDirection>("desc");
    const router = useRouter();

    const statusStyles: Record<string, string> = {
        ACTIVE: "bg-blue-500/20 text-blue-300",
        COMPLETED: "bg-emerald-500/20 text-emerald-300",
        CANCELLED: "bg-slate-500/20 text-slate-300",
        AUTO_CANCELLED: "bg-amber-500/20 text-amber-300",
    };

    const filteredAndSorted = useMemo(() => {
        let result = bookings;

        // Filter Status
        if (statusFilter !== "ALL") {
            result = result.filter(b => b.status === statusFilter);
        }

        // Filter Search
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                b =>
                    (b.user.name?.toLowerCase() || "").includes(q) ||
                    b.user.email.toLowerCase().includes(q) ||
                    b.oven.name.toLowerCase().includes(q) ||
                    b.purpose.toLowerCase().includes(q)
            );
        }

        // Sort
        result = [...result].sort((a, b) => {
            let aVal: number;
            let bVal: number;

            switch (sortField) {
                case "startDate":
                    aVal = new Date(a.startDate).getTime();
                    bVal = new Date(b.startDate).getTime();
                    break;
                case "duration":
                    aVal = new Date(a.endDate).getTime() - new Date(a.startDate).getTime();
                    bVal = new Date(b.endDate).getTime() - new Date(b.startDate).getTime();
                    break;
                case "usageTemp":
                    aVal = a.usageTemp;
                    bVal = b.usageTemp;
                    break;
                case "flap":
                    aVal = a.flap;
                    bVal = b.flap;
                    break;
                default:
                    aVal = 0;
                    bVal = 0;
            }

            return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        });

        return result;
    }, [bookings, search, statusFilter, sortField, sortDir]);

    function handleSort(field: SortField) {
        if (sortField === field) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDir("desc");
        }
    }

    function SortIcon({ field }: { field: SortField }) {
        if (sortField !== field) return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-50" />;
        return sortDir === "asc" ? <ArrowUp className="h-3 w-3 inline ml-1 text-orange-400" /> : <ArrowDown className="h-3 w-3 inline ml-1 text-orange-400" />;
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search users, ovens, or purpose..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                </div>
                <div className="relative shrink-0 flex items-center gap-2 w-full sm:w-auto">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="appearance-none w-full sm:w-auto bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    >
                        <option value="ALL">All Status</option>
                        <option value="ACTIVE">Active</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                        <option value="AUTO_CANCELLED">Auto Cancelled</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-[10px]">
                        ▼
                    </div>
                </div>
            </div>

            <div className="text-sm font-medium text-slate-400 mb-2">
                Showing {filteredAndSorted.length} {filteredAndSorted.length === 1 ? "booking" : "bookings"}
            </div>

            {/* Mobile: Card layout */}
            <div className="lg:hidden space-y-4">
                {filteredAndSorted.map((booking) => (
                    <div
                        key={booking.id}
                        onClick={() => router.push(`/admin/bookings/${booking.id}`)}
                        className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3 cursor-pointer hover:bg-slate-800/80 transition-colors"
                    >
                        <div className="flex items-start justify-between gap-2 overflow-hidden">
                            <div className="block hover:opacity-90 min-w-0">
                                <p className="font-medium text-white underline decoration-slate-600 underline-offset-2 truncate">{booking.user.name}</p>
                                <p className="text-xs text-slate-400 truncate">{booking.user.email}</p>
                            </div>
                            <span className={`shrink-0 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium whitespace-nowrap ${statusStyles[booking.status] || ""}`}>
                                {booking.status.replace("_", " ")}
                            </span>
                        </div>
                        <div className="text-sm">
                            <p className="text-xs text-slate-500">Oven</p>
                            <p className="text-slate-300">
                                {booking.oven.name}{" "}
                                <span className="text-xs text-slate-500">
                                    ({booking.oven.type === "NON_AQUEOUS" ? "Non-Aqueous" : "Aqueous"})
                                </span>
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <p className="text-xs text-slate-500">Start</p>
                                <p className="text-slate-300">{formatDateTimeWib(booking.startDate)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">End</p>
                                <p className="text-slate-300">{formatDateTimeWib(booking.endDate)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Duration</p>
                                <p className="text-slate-300">{formatDuration(booking.startDate, booking.endDate)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Temp / Flap</p>
                                <p className="text-slate-300">{booking.usageTemp}°C / {booking.flap}%</p>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Purpose</p>
                            <p className="text-sm text-slate-300 break-words line-clamp-2">{booking.purpose}</p>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                            <BookingActionButtons bookingId={booking.id} status={booking.status} />
                        </div>
                    </div>
                ))}
                {filteredAndSorted.length === 0 && (
                    <div className="text-center py-8 text-slate-500 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">No results match your filters</div>
                )}
            </div>

            {/* Desktop: Table layout */}
            <div className="hidden lg:block bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-700 bg-slate-800/80">
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">User</th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Oven</th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase cursor-pointer hover:text-white transition-colors whitespace-nowrap" onClick={() => handleSort("startDate")}>
                                    Start <SortIcon field="startDate" />
                                </th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase whitespace-nowrap">End</th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase cursor-pointer hover:text-white transition-colors whitespace-nowrap" onClick={() => handleSort("duration")}>
                                    Duration <SortIcon field="duration" />
                                </th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase cursor-pointer hover:text-white transition-colors whitespace-nowrap" onClick={() => handleSort("usageTemp")}>
                                    Temp <SortIcon field="usageTemp" />
                                </th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase cursor-pointer hover:text-white transition-colors whitespace-nowrap" onClick={() => handleSort("flap")}>
                                    Flap <SortIcon field="flap" />
                                </th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Purpose</th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {filteredAndSorted.map((booking) => (
                                <tr key={booking.id} onClick={() => router.push(`/admin/bookings/${booking.id}`)} className="hover:bg-slate-700/20 group cursor-pointer transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="block group-hover:opacity-90">
                                            <p className="text-sm font-medium text-white group-hover:underline decoration-slate-500 underline-offset-2 transition-all">{booking.user.name}</p>
                                            <p className="text-xs text-slate-400">{booking.user.email}</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-sm text-white">{booking.oven.name}</p>
                                        <p className="text-xs text-slate-400">
                                            {booking.oven.type === "NON_AQUEOUS" ? "Non-Aqueous" : "Aqueous"}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-300">{formatDateTimeWib(booking.startDate)}</td>
                                    <td className="px-4 py-3 text-sm text-slate-300">{formatDateTimeWib(booking.endDate)}</td>
                                    <td className="px-4 py-3 text-sm text-slate-300">{formatDuration(booking.startDate, booking.endDate)}</td>
                                    <td className="px-4 py-3 text-sm text-slate-300">{booking.usageTemp}°C</td>
                                    <td className="px-4 py-3 text-sm text-slate-300">{booking.flap}%</td>
                                    <td className="px-4 py-3 text-sm text-slate-300 max-w-[200px] truncate" title={booking.purpose}>
                                        {booking.purpose}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusStyles[booking.status] || ""}`}>
                                            {booking.status.replace("_", " ")}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                        <BookingActionButtons bookingId={booking.id} status={booking.status} />
                                    </td>
                                </tr>
                            ))}
                            {filteredAndSorted.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="text-center py-8 text-slate-500">No results match your filters</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
