import { Users, ClipboardList, CheckCircle, XCircle } from "lucide-react";
import { type LucideIcon } from "lucide-react";

interface MetricCardProps {
    title: string;
    value: number;
    description: string;
    icon: LucideIcon;
    trend?: "up" | "down" | "neutral";
}

function MetricCard({ title, value, description, icon: Icon, trend = "neutral" }: MetricCardProps) {
    return (
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/60 rounded-2xl p-6 flex items-start gap-4 shadow-xl flex-1 min-w-[240px] transition-all hover:border-slate-700/80 hover:shadow-2xl">
            <div className={`p-3.5 rounded-xl transition-colors ${trend === "up" ? "bg-emerald-500/10 text-emerald-400 shadow-[inset_0_0_12px_rgba(16,185,129,0.1)]" :
                    trend === "down" ? "bg-rose-500/10 text-rose-400 shadow-[inset_0_0_12px_rgba(244,63,94,0.1)]" :
                        "bg-blue-500/10 text-blue-400 shadow-[inset_0_0_12px_rgba(59,130,246,0.1)]"
                }`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{title}</h3>
                <div className="text-4xl font-bold font-mono text-white tracking-tight">{value.toLocaleString()}</div>
                <p className="text-xs text-slate-500 mt-2.5 font-medium">{description}</p>
            </div>
        </div>
    );
}

export function MetricsCards({ data }: { data: any }) {
    const { usersOverview, bookingsOverview } = data;

    return (
        <div className="flex flex-wrap gap-5">
            <MetricCard
                title="Total Active Users"
                value={usersOverview.approved}
                description={`${usersOverview.pending} pend. accounts`}
                icon={Users}
                trend="up"
            />
            <MetricCard
                title="Total Bookings"
                value={bookingsOverview.total}
                description={`${bookingsOverview.pending} require approval`}
                icon={ClipboardList}
                trend="neutral"
            />
            <MetricCard
                title="Completed Sessions"
                value={bookingsOverview.completed}
                description="Successful experiments"
                icon={CheckCircle}
                trend="up"
            />
            <MetricCard
                title="Cancelled Bookings"
                value={bookingsOverview.cancelled}
                description="Abandonment indicator"
                icon={XCircle}
                trend="down"
            />
        </div>
    );
}
