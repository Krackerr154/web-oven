import { Metadata } from "next";
import { getGlasswareStats, getOvenUtilization, getReagentStats } from "@/app/actions/analytics";
import AnalyticsClient from "./analytics-client";

export const metadata: Metadata = {
    title: "Lab Analytics | AP Lab",
    description: "Advanced laboratory usage analytics and reports",
};

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
    const [reagentStats, glasswareStats, ovenStats] = await Promise.all([
        getReagentStats(),
        getGlasswareStats(),
        getOvenUtilization()
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Advanced Analytics</h1>
                <p className="text-sm text-slate-400 mt-1">
                    Visualize laboratory resource usage and inventory depletion.
                </p>
            </div>

            <AnalyticsClient
                reagentStats={reagentStats || []}
                glasswareStats={glasswareStats || []}
                ovenStats={ovenStats || []}
            />
        </div>
    );
}
