"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BarChart3, ListChecks, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { computePeakStatistics } from "@/lib/dsc/statistics";
import type { DscPeakWithId } from "./types";
import { DscExportButtons } from "./DscExportButtons";
import { PeakCard } from "./PeakCard";
import { formatNumber } from "./utils";

type SidebarTab = "peaks" | "detect" | "stats";

type PeakSidebarProps = {
  experimentId: string;
  peaks: DscPeakWithId[];
  selectedPeakId: string | null;
  showBaseline: boolean;
  manualMode: boolean;
  onSelectPeak: (peakId: string) => void;
  onDeletePeak: (peakId: string) => void;
  onLabelPeak: (peakId: string, label: string) => void;
  onDetect: (prominenceThresholdMw: number, smoothingWindow: number) => void;
  onToggleBaseline: () => void;
  onToggleManualMode: () => void;
  onExportImage?: (format: "png" | "svg") => Promise<void>;
};

export function PeakSidebar({
  experimentId,
  peaks,
  selectedPeakId,
  showBaseline,
  manualMode,
  onSelectPeak,
  onDeletePeak,
  onLabelPeak,
  onDetect,
  onToggleBaseline,
  onToggleManualMode,
  onExportImage,
}: PeakSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("peaks");
  const [pendingDelete, setPendingDelete] = useState<DscPeakWithId | null>(null);
  const [prominenceThreshold, setProminenceThreshold] = useState(0.8);
  const [smoothingWindow, setSmoothingWindow] = useState(12);
  const stats = useMemo(() => computePeakStatistics(peaks), [peaks]);

  return (
    <aside className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-800 rounded-2xl p-4 space-y-4 lg:sticky lg:top-6">
      <div>
        <h3 className="text-sm font-semibold text-white">Peak Analysis</h3>
        <p className="text-xs text-slate-500">{peaks.length} peak{peaks.length === 1 ? "" : "s"}</p>
      </div>

      <div className="grid grid-cols-3 rounded-xl border border-slate-800 bg-slate-950/40 p-1">
        <TabButton active={activeTab === "peaks"} onClick={() => setActiveTab("peaks")} icon={<ListChecks className="h-4 w-4" />} label="Peaks" />
        <TabButton active={activeTab === "detect"} onClick={() => setActiveTab("detect")} icon={<SlidersHorizontal className="h-4 w-4" />} label="Detect" />
        <TabButton active={activeTab === "stats"} onClick={() => setActiveTab("stats")} icon={<BarChart3 className="h-4 w-4" />} label="Stats" />
      </div>

      {activeTab === "peaks" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleManualMode}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${manualMode
                ? "bg-amber-500 text-slate-950"
                : "border border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60"
                }`}
            >
              <Plus className="h-4 w-4" />
              Manual peak
            </button>
            <button
              type="button"
              onClick={onToggleBaseline}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${showBaseline
                ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/35"
                : "border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700/60"
                }`}
            >
              Baseline
            </button>
          </div>

          <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {peaks.length === 0 ? (
              <EmptyState message="No peaks detected yet. Use Detect or add a manual peak." />
            ) : (
              peaks.map((peak) => (
                <PeakCard
                  key={peak.id}
                  peak={peak}
                  selected={selectedPeakId === peak.id}
                  onSelect={() => onSelectPeak(peak.id)}
                  onDelete={() => setPendingDelete(peak)}
                  onLabelChange={(label) => onLabelPeak(peak.id, label)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "detect" && (
        <div className="space-y-4">
          <Control
            label="Prominence threshold"
            value={prominenceThreshold}
            min={0.1}
            max={5}
            step={0.1}
            unit="mW"
            onChange={setProminenceThreshold}
          />
          <Control
            label="Smoothing window"
            value={smoothingWindow}
            min={3}
            max={51}
            step={2}
            unit="pts"
            onChange={(value) => setSmoothingWindow(Math.max(3, Math.round(value)))}
          />
          <button
            type="button"
            onClick={() => onDetect(prominenceThreshold, smoothingWindow)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-400 transition-colors"
          >
            <Search className="h-4 w-4" />
            Re-detect peaks
          </button>
          <p className="text-xs text-slate-500">
            Detection uses the existing DSC engine. Saving replaces portal peak results with the current list.
          </p>
        </div>
      )}

      {activeTab === "stats" && (
        <div className="space-y-3">
          {stats.length === 0 ? (
            <EmptyState message="No statistics until peaks exist." />
          ) : (
            stats.map((item) => (
              <div key={item.peakType} className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold capitalize text-white">{item.peakType}</p>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">n={item.count}</span>
                </div>
                <StatRow label="Peak temp" stat={`${formatNumber(item.peakMaxTempC.mean, 1)} ± ${formatNumber(item.peakMaxTempC.stdDev, 1)} °C`} />
                <StatRow label="Onset" stat={`${formatNumber(item.onsetTempC.mean, 1)} °C`} />
                <StatRow label="Offset" stat={`${formatNumber(item.offsetTempC.mean, 1)} °C`} />
                <StatRow label="Heat" stat={`${formatNumber(item.heatJPerG.mean, 2)} ± ${formatNumber(item.heatJPerG.stdDev, 2)} J/g`} />
              </div>
            ))
          )}
        </div>
      )}

      <DscExportButtons experimentId={experimentId} peaks={peaks} onExportImage={onExportImage} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete peak?"
        description="This removes the peak from the current analysis. Save to portal to persist the change."
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) onDeletePeak(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </aside>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors ${active
        ? "bg-cyan-500 text-white"
        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Control({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-xl border border-slate-800 bg-slate-950/35 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-300">{label}</span>
        <span className="text-cyan-300">{value} {unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-cyan-500"
      />
    </label>
  );
}

function StatRow({ label, stat }: { label: string; stat: string }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-800/70 py-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-200 tabular-nums">{stat}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 py-8 text-center">
      <Trash2 className="mx-auto mb-2 h-8 w-8 text-slate-700" />
      <p className="px-4 text-sm text-slate-500">{message}</p>
    </div>
  );
}
