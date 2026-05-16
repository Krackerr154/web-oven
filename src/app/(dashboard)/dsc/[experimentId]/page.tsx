"use client";

import { useParams } from "next/navigation";
import { Activity, Upload, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function DscExperimentPage() {
  const params = useParams();
  const experimentId = params.experimentId as string;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dsc"
          className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0 shadow-inner">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">DSC Experiment</h1>
            <p className="text-slate-500 text-xs font-mono">{experimentId}</p>
          </div>
        </div>
      </div>

      {/* Analysis View Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
        {/* Main Chart Area */}
        <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-center h-[500px] border border-dashed border-slate-700 rounded-xl">
            <div className="text-center">
              <Activity className="h-16 w-16 text-slate-600 mx-auto mb-4 animate-pulse" />
              <p className="text-slate-400 font-medium mb-1">
                Chart will render here
              </p>
              <p className="text-slate-500 text-sm">
                Interactive HeatFlow vs. Sample Temperature
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-800 rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white">Peak Analysis</h3>
          <div className="space-y-2">
            {["Peaks", "Detect", "Stats"].map((tab) => (
              <div
                key={tab}
                className="px-3 py-2 rounded-lg bg-slate-800/50 text-slate-500 text-sm"
              >
                {tab} tab — coming in Phase 5
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
