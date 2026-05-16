/**
 * DSC Statistics Module
 *
 * Computes cross-cycle statistics from detected peaks.
 *
 * @module src/lib/dsc/statistics
 */

import type { DetectedPeak } from "./peakDetection";

// ─── Types ──────────────────────────────────────────────────────────────

export interface PeakStatistics {
  peakType: "exothermic" | "endothermic";
  count: number;
  peakMaxTempC: StatSummary;
  onsetTempC: StatSummary;
  offsetTempC: StatSummary;
  peakHeightMw: StatSummary;
  heatJPerG: StatSummary;
}

export interface StatSummary {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  values: number[];
}

// ─── Main ───────────────────────────────────────────────────────────────

/**
 * Compute summary statistics across peaks grouped by type.
 */
export function computePeakStatistics(
  peaks: DetectedPeak[],
): PeakStatistics[] {
  const grouped = new Map<string, DetectedPeak[]>();

  for (const peak of peaks) {
    const key = peak.peakType;
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
    }
    arr.push(peak);
  }

  const results: PeakStatistics[] = [];

  for (const [type, group] of grouped) {
    results.push({
      peakType: type as "exothermic" | "endothermic",
      count: group.length,
      peakMaxTempC: summarize(group.map((p) => p.peakMaxTempC)),
      onsetTempC: summarize(group.map((p) => p.onsetTempC)),
      offsetTempC: summarize(group.map((p) => p.offsetTempC)),
      peakHeightMw: summarize(group.map((p) => p.peakHeightMw)),
      heatJPerG: summarize(group.map((p) => p.heatJPerG)),
    });
  }

  return results;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function summarize(values: number[]): StatSummary {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, values: [] };
  }

  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance =
    n > 1
      ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
      : 0;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return { mean, stdDev, min, max, values: [...values] };
}

export { summarize as _summarize };
