"use client";

import { Edit3, Flame, Snowflake, Trash2 } from "lucide-react";
import type { DscPeakWithId } from "./types";
import { formatNumber, getCycleLabel } from "./utils";

type PeakCardProps = {
  peak: DscPeakWithId;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onLabelChange: (label: string) => void;
};

export function PeakCard({ peak, selected, onSelect, onDelete, onLabelChange }: PeakCardProps) {
  const isExo = peak.peakType === "exothermic";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${selected
        ? "border-cyan-400/60 bg-cyan-500/10"
        : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 rounded-lg p-2 ${isExo ? "bg-rose-500/15 text-rose-300" : "bg-sky-500/15 text-sky-300"}`}>
            {isExo ? <Flame className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {peak.label || `${getCycleLabel(peak.cycleIndex)} ${isExo ? "Exothermic" : "Endothermic"}`}
            </p>
            <p className="text-xs text-slate-500">{peak.isManual ? "Manual" : "Auto-detected"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="rounded-md p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300 transition-colors"
          aria-label="Delete peak"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Metric label="Peak" value={`${formatNumber(peak.peakMaxTempC, 1)} °C`} />
        <Metric label="Heat" value={`${formatNumber(peak.heatJPerG, 2)} J/g`} />
        <Metric label="Onset" value={`${formatNumber(peak.onsetTempC, 1)} °C`} />
        <Metric label="Offset" value={`${formatNumber(peak.offsetTempC, 1)} °C`} />
      </div>

      <label className="mt-3 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/30 px-2 py-1.5 text-xs text-slate-400">
        <Edit3 className="h-3.5 w-3.5" />
        <input
          value={peak.label ?? ""}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onLabelChange(event.target.value)}
          placeholder="Add label"
          className="min-w-0 flex-1 bg-transparent text-slate-200 outline-none placeholder:text-slate-600"
        />
      </label>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800/45 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-medium text-slate-200 tabular-nums">{value}</p>
    </div>
  );
}
