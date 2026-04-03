import { getDetailedAnalytics } from "@/app/actions/detailed-analytics";
import { GranularAnalyticsDashboard } from "@/components/analytics/GranularAnalyticsDashboard";
import Link from "next/link";
import { ArrowLeft, BrainCircuit } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DetailedAnalyticsPage() {
    const data = await getDetailedAnalytics();

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <Link href="/admin/bookings" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-2">
                <ArrowLeft className="w-4 h-4" /> Back to Bookings
            </Link>

            <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl border border-indigo-500/20 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)]">
                    <BrainCircuit className="w-8 h-8 text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Detailed Analytics</h1>
                    <p className="text-slate-400 text-sm mt-1.5 font-medium">Detailed statistics for users and instruments</p>
                </div>
            </div>

            <GranularAnalyticsDashboard data={data} />
        </div>
    );
}
