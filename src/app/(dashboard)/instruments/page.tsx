import { Beaker, Flame, Thermometer, Box, ArrowRight, Activity, CalendarPlus, Wind } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function InstrumentsPage() {
    // Fetch instrument status from DB as it's the only one currently modeled
    const instruments = await prisma.instrument.findMany({
        where: { status: "AVAILABLE", category: { in: ["AQUEOUS", "NON_AQUEOUS"] } }, // filter down to ovens if needed, or get all
    });

    const activeOvensCount = instruments.length;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Instruments</h1>
                <p className="text-slate-400 mt-2 text-lg">
                    Select an instrument to book a time slot or manage your current reservations.
                </p>
            </div>

            {/* Instruments Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Oven Card */}
                <div id="tour-oven-card" className="group flex flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/50 transition-all hover:bg-slate-800 hover:shadow-lg hover:shadow-orange-500/10">
                    <div className="p-6 flex-1">
                        <div className="flex items-center justify-between mb-4">
                            <div className="rounded-xl bg-orange-500/20 p-3 text-orange-400">
                                <Flame className="h-6 w-6" />
                            </div>
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${activeOvensCount > 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                                {activeOvensCount > 0 ? `${activeOvensCount} Available` : "Maintenance"}
                            </span>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Lab Ovens</h3>
                        <p className="text-sm text-slate-400">
                            High-temperature ovens for sample drying, curing, and thermal treatment. Both aqueous and non-aqueous modes available.
                        </p>

                        <div className="mt-6 space-y-3">
                            <div className="flex items-center gap-3 text-sm text-slate-300">
                                <Thermometer className="h-4 w-4 text-slate-500" />
                                <span>Up to 250°C</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-300">
                                <Activity className="h-4 w-4 text-slate-500" />
                                <span>Smart damper control</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-700/50 bg-slate-900/30">
                        <Link
                            href="/book"
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-500 shadow-lg shadow-orange-500/20"
                        >
                            <CalendarPlus className="h-4 w-4" />
                            Book Instrument
                        </Link>
                    </div>
                </div>

                {/* Ultrasonic Bath Card */}
                <div id="tour-ultrasonic-card" className="group flex flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/50 transition-all hover:bg-slate-800 hover:shadow-lg hover:shadow-cyan-500/10">
                    <div className="p-6 flex-1">
                        <div className="flex items-center justify-between mb-4">
                            <div className="rounded-xl bg-cyan-500/20 p-3 text-cyan-400">
                                <Activity className="h-6 w-6" />
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-slate-500/10 text-slate-400 border-slate-500/20">
                                Integration Pending
                            </span>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Ultrasonic Bath</h3>
                        <p className="text-sm text-slate-400">
                            High-frequency sonication for cleaning glassware, dissolving samples, and degassing liquids.
                        </p>

                        <div className="mt-6 space-y-3">
                            <div className="flex items-center gap-3 text-sm text-slate-300">
                                <Thermometer className="h-4 w-4 text-slate-500" />
                                <span>Heated up to 60°C</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-300">
                                <Activity className="h-4 w-4 text-slate-500" />
                                <span>Adjustable timer</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-700/50 bg-slate-900/30">
                        <Link
                            href="/book/ultrasonic"
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500 shadow-lg shadow-cyan-500/20"
                        >
                            <CalendarPlus className="h-4 w-4" />
                            Book Ultrasonic Bath
                        </Link>
                    </div>
                </div>

                {/* Glovebox Card */}
                <div id="tour-glovebox-card" className="group flex flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/50 transition-all hover:bg-slate-800 hover:shadow-lg hover:shadow-emerald-500/10">
                    <div className="p-6 flex-1">
                        <div className="flex items-center justify-between mb-4">
                            <div className="rounded-xl bg-emerald-500/20 p-3 text-emerald-400">
                                <Box className="h-6 w-6" />
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1.5 shadow-[0_0_10px_rgba(52,211,153,0.2)]">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                Available
                            </span>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Glovebox</h3>
                        <p className="text-sm text-slate-400">
                            Inert atmosphere workspace for handling air and moisture-sensitive materials safely.
                        </p>

                        <div className="mt-6 space-y-3">
                            <div className="flex items-center gap-3 text-sm text-slate-300">
                                <Wind className="h-4 w-4 text-emerald-500" />
                                <span>Nitrogen Flow Logging</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-300">
                                <Activity className="h-4 w-4 text-emerald-500" />
                                <span>Digital Logbook Only</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-700/50 bg-slate-900/30">
                        <Link
                            href="/book/glovebox"
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition-all hover:shadow-[0_0_15px_rgba(52,211,153,0.3)] shadow-[0_0_10px_rgba(52,211,153,0.1)] active:scale-[0.98]"
                        >
                            <CalendarPlus className="h-4 w-4" />
                            Book Glovebox
                        </Link>
                    </div>
                </div>

            </div>
        </div>
    );
}
