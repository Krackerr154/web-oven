/**
 * DSC Peak Detection Engine
 *
 * Detects thermal events (melting/crystallization peaks) in DSC data.
 * Runs entirely client-side — no server calls needed.
 *
 * Sign convention (exo-up):
 *   - Heating cycles: endothermic melting → heatflow dips DOWN (minima)
 *   - Cooling cycles: exothermic crystallization → heatflow goes UP (maxima)
 *
 * @module src/lib/dsc/peakDetection
 */

import type { DscDataPoint } from "./parser";

// ─── Types ──────────────────────────────────────────────────────────────

export interface PeakDetectionOptions {
  prominenceThresholdMw: number; // default 0.8
  smoothingWindowPts: number;    // default 12
}

export interface DetectedPeak {
  cycleIndex: number;
  peakType: "exothermic" | "endothermic";
  peakMaxIdx: number;
  peakMaxTempC: number;
  peakMaxTimeH: number;
  peakHeightMw: number;
  onsetIdx: number;
  onsetTempC: number;
  onsetTimeH: number;
  offsetIdx: number;
  offsetTempC: number;
  offsetTimeH: number;
  heatJPerG: number;
  baselineType: "linear";
  isManual: boolean;
}

const DEFAULT_OPTIONS: PeakDetectionOptions = {
  prominenceThresholdMw: 0.8,
  smoothingWindowPts: 12,
};

// ─── Main Entry Point ──────────────────────────────────────────────────

/**
 * Detect peaks across all cycles in parsed DSC data.
 */
export function detectPeaks(
  dataPoints: DscDataPoint[],
  massMg: number,
  options: Partial<PeakDetectionOptions> = {},
): DetectedPeak[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const peaks: DetectedPeak[] = [];

  // Group data points by cycle index
  const cycles = groupByCycle(dataPoints);

  for (const [cycleIndex, cyclePoints] of cycles) {
    if (cyclePoints.length < 30) continue;

    // Determine dominant direction
    const direction = getDominantDirection(cyclePoints);
    if (direction === "isothermal") continue;

    // Smooth the heatflow signal
    const smoothed = smoothSignal(
      cyclePoints.map((p) => p.heatflowMw),
      opts.smoothingWindowPts,
    );

    // Find peaks: minima for heating (endothermic), maxima for cooling (exothermic)
    const isHeating = direction === "heating";
    const extrema = findExtrema(smoothed, isHeating, opts.prominenceThresholdMw);

    for (const extremum of extrema) {
      const peak = analyzePeak(
        cyclePoints,
        smoothed,
        extremum,
        cycleIndex,
        isHeating,
        massMg,
      );
      if (peak) peaks.push(peak);
    }
  }

  return peaks;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function groupByCycle(points: DscDataPoint[]): Map<number, DscDataPoint[]> {
  const map = new Map<number, DscDataPoint[]>();
  for (const p of points) {
    let arr = map.get(p.cycleIndex);
    if (!arr) {
      arr = [];
      map.set(p.cycleIndex, arr);
    }
    arr.push(p);
  }
  return map;
}

function getDominantDirection(points: DscDataPoint[]): string {
  let heating = 0, cooling = 0;
  for (const p of points) {
    if (p.cycleDirection === "heating") heating++;
    else if (p.cycleDirection === "cooling") cooling++;
  }
  if (heating > cooling) return "heating";
  if (cooling > heating) return "cooling";
  return "isothermal";
}

export function smoothSignal(data: number[], window: number): Float64Array {
  const n = data.length;
  const result = new Float64Array(n);
  const halfW = Math.floor(window / 2);
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - halfW);
    const end = Math.min(n - 1, i + halfW);
    let sum = 0;
    for (let j = start; j <= end; j++) sum += data[j];
    result[i] = sum / (end - start + 1);
  }
  return result;
}

// ─── Extrema Finder ─────────────────────────────────────────────────────

interface Extremum {
  index: number;
  value: number;
  prominence: number;
}

/**
 * Find significant extrema in a smoothed signal.
 * For heating: find minima (endothermic dips).
 * For cooling: find maxima (exothermic peaks).
 */
function findExtrema(
  smoothed: Float64Array,
  findMinima: boolean,
  prominenceThreshold: number,
): Extremum[] {
  const n = smoothed.length;
  const candidates: Extremum[] = [];

  // Work on inverted signal for minima to unify the logic
  const signal = findMinima
    ? smoothed.map((v) => -v)
    : new Float64Array(smoothed);

  // Find local maxima in the (possibly inverted) signal
  for (let i = 2; i < n - 2; i++) {
    if (
      signal[i] > signal[i - 1] &&
      signal[i] > signal[i + 1] &&
      signal[i] >= signal[i - 2] &&
      signal[i] >= signal[i + 2]
    ) {
      // Calculate prominence
      const prominence = calculateProminence(signal, i);
      if (prominence >= prominenceThreshold) {
        candidates.push({
          index: i,
          value: smoothed[i], // original (non-inverted) value
          prominence,
        });
      }
    }
  }

  // Sort by prominence descending, keep only the most significant per cycle
  candidates.sort((a, b) => b.prominence - a.prominence);

  // Filter out peaks too close together (within 50 points)
  const filtered: Extremum[] = [];
  for (const c of candidates) {
    const tooClose = filtered.some((f) => Math.abs(f.index - c.index) < 50);
    if (!tooClose) filtered.push(c);
  }

  return filtered;
}

function calculateProminence(signal: Float64Array, peakIdx: number): number {
  const peakVal = signal[peakIdx];
  const n = signal.length;

  // Walk left to find the lowest valley before a higher peak
  let leftMin = peakVal;
  for (let i = peakIdx - 1; i >= 0; i--) {
    if (signal[i] > peakVal) break;
    if (signal[i] < leftMin) leftMin = signal[i];
  }

  // Walk right
  let rightMin = peakVal;
  for (let i = peakIdx + 1; i < n; i++) {
    if (signal[i] > peakVal) break;
    if (signal[i] < rightMin) rightMin = signal[i];
  }

  return peakVal - Math.max(leftMin, rightMin);
}

// ─── Peak Analysis ──────────────────────────────────────────────────────

function analyzePeak(
  points: DscDataPoint[],
  smoothed: Float64Array,
  extremum: Extremum,
  cycleIndex: number,
  isHeating: boolean,
  massMg: number,
): DetectedPeak | null {
  const n = points.length;
  const peakIdx = extremum.index;

  // Find baseline boundaries (where peak departs from and returns to baseline)
  const { leftBaseIdx, rightBaseIdx } = findBaselineBoundaries(
    smoothed,
    peakIdx,
    isHeating,
    points,
  );

  if (leftBaseIdx < 0 || rightBaseIdx >= n || rightBaseIdx <= leftBaseIdx) {
    return null;
  }

  // Linear baseline between left and right boundary points
  const leftBaseVal = smoothed[leftBaseIdx];
  const rightBaseVal = smoothed[rightBaseIdx];
  const baselineSlope =
    (rightBaseVal - leftBaseVal) / (rightBaseIdx - leftBaseIdx);

  const baselineAt = (idx: number) =>
    leftBaseVal + baselineSlope * (idx - leftBaseIdx);

  // Peak height: difference between peak heatflow and baseline at peak position
  const peakHeightMw = points[peakIdx].heatflowMw - baselineAt(peakIdx);

  // Onset: steepest tangent on leading edge → intersect with baseline
  const onsetIdx = findOnset(
    smoothed,
    leftBaseIdx,
    peakIdx,
    baselineAt,
    isHeating,
  );

  // Offset: steepest tangent on trailing edge → intersect with baseline
  const offsetIdx = findOffset(
    smoothed,
    peakIdx,
    rightBaseIdx,
    baselineAt,
    isHeating,
  );

  // Enthalpy integration: trapezoidal rule over [leftBaseIdx, rightBaseIdx]
  const heatJPerG = integrateEnthalpy(
    points,
    leftBaseIdx,
    rightBaseIdx,
    baselineAt,
    massMg,
    isHeating,
  );

  return {
    cycleIndex,
    peakType: isHeating ? "endothermic" : "exothermic",
    peakMaxIdx: peakIdx,
    peakMaxTempC: points[peakIdx].sampleTempC,
    peakMaxTimeH: points[peakIdx].timeH,
    peakHeightMw,
    onsetIdx,
    onsetTempC: points[onsetIdx].sampleTempC,
    onsetTimeH: points[onsetIdx].timeH,
    offsetIdx,
    offsetTempC: points[offsetIdx].sampleTempC,
    offsetTimeH: points[offsetIdx].timeH,
    heatJPerG,
    baselineType: "linear",
    isManual: false,
  };
}

// ─── Baseline Boundary Detection ────────────────────────────────────────

function findBaselineBoundaries(
  smoothed: Float64Array,
  peakIdx: number,
  isHeating: boolean,
  _points: DscDataPoint[],
): { leftBaseIdx: number; rightBaseIdx: number } {
  const n = smoothed.length;

  // ── First derivative (for left boundary + right fallback) ──
  const deriv = new Float64Array(n);
  for (let i = 1; i < n - 1; i++) {
    deriv[i] = smoothed[i + 1] - smoothed[i - 1];
  }

  // Left boundary: proven d1 sign-change method
  let leftBaseIdx = 0;
  for (let i = peakIdx - 1; i >= 1; i--) {
    if (isHeating) {
      if (deriv[i] >= 0 && deriv[i - 1] >= 0) {
        leftBaseIdx = i;
        break;
      }
    } else {
      if (deriv[i] <= 0 && deriv[i - 1] <= 0) {
        leftBaseIdx = i;
        break;
      }
    }
  }

  // Right boundary (d1 fallback): derivative sign-change
  let rightBaseD1 = n - 1;
  for (let i = peakIdx + 1; i < n - 1; i++) {
    if (isHeating) {
      if (deriv[i] <= 0 && deriv[i + 1] <= 0) {
        rightBaseD1 = i;
        break;
      }
    } else {
      if (deriv[i] >= 0 && deriv[i + 1] >= 0) {
        rightBaseD1 = i;
        break;
      }
    }
  }

  // ── Second derivative (for right boundary refinement) ──
  // This catches the exact tail end more precisely than d1
  const stencil = 5;
  const d2 = new Float64Array(n);
  for (let i = stencil; i < n - stencil; i++) {
    d2[i] = smoothed[i + stencil] - 2 * smoothed[i] + smoothed[i - stencil];
  }

  // Smooth d2
  const d2Smooth = new Float64Array(n);
  const d2Half = 12;
  for (let i = d2Half; i < n - d2Half; i++) {
    let sum = 0;
    for (let j = i - d2Half; j <= i + d2Half; j++) sum += d2[j];
    d2Smooth[i] = sum / (2 * d2Half + 1);
  }

  // Max |d2| in peak region for threshold
  const margin = stencil + d2Half;
  let maxD2 = 0;
  const scanLeft = Math.max(margin, peakIdx - 500);
  const scanRight = Math.min(n - margin - 1, peakIdx + 500);
  for (let i = scanLeft; i <= scanRight; i++) {
    const mag = Math.abs(d2Smooth[i]);
    if (mag > maxD2) maxD2 = mag;
  }

  const nearZeroThreshold = maxD2 * 0.02; // 2% of max curvature
  const consecutiveNeeded = 12;

  // Walk right from peak to find d2 flat zone
  let rightBaseD2 = n - 1;
  const searchEnd = Math.min(n - margin - 1, peakIdx + 1500);
  for (let i = peakIdx + margin; i < searchEnd; i++) {
    if (Math.abs(d2Smooth[i]) < nearZeroThreshold) {
      let staysFlat = true;
      for (let j = 1; j < consecutiveNeeded && i + j < searchEnd; j++) {
        if (Math.abs(d2Smooth[i + j]) >= nearZeroThreshold) {
          staysFlat = false;
          break;
        }
      }
      if (staysFlat) {
        rightBaseD2 = i;
        break;
      }
    }
  }

  // Choose right boundary: prefer d2 if it gives a reasonable window,
  // otherwise fall back to d1. "Reasonable" = at least 100 data points
  // from peak (prevents clipping narrow peaks).
  const minPeakWidth = 100;
  let rightBaseIdx: number;
  if (rightBaseD2 < n - 1 && (rightBaseD2 - peakIdx) >= minPeakWidth) {
    rightBaseIdx = rightBaseD2;
  } else {
    rightBaseIdx = rightBaseD1;
  }

  return { leftBaseIdx, rightBaseIdx };
}

// ─── Onset/Offset Detection ─────────────────────────────────────────────

/**
 * Find onset point: steepest tangent on leading edge intersected with baseline.
 * Uses multi-point linear regression (±10 pts) for stable tangent estimation.
 */
function findOnset(
  smoothed: Float64Array,
  leftBaseIdx: number,
  peakIdx: number,
  baselineAt: (idx: number) => number,
  _isHeating: boolean,
): number {
  const regWindow = 10; // regression half-window

  // Find the point of steepest slope on the leading edge
  let maxSlopeIdx = leftBaseIdx + regWindow;
  let maxSlope = 0;

  for (let i = leftBaseIdx + regWindow; i < peakIdx - regWindow; i++) {
    // Compute slope using linear regression over [i-regWindow, i+regWindow]
    const { slope } = linearRegression(smoothed, i - regWindow, i + regWindow);
    if (Math.abs(slope) > maxSlope) {
      maxSlope = Math.abs(slope);
      maxSlopeIdx = i;
    }
  }

  // Compute full tangent line at the steepest point using regression
  const { slope: tangentSlope, intercept: tangentIntercept } = linearRegression(
    smoothed,
    maxSlopeIdx - regWindow,
    maxSlopeIdx + regWindow,
  );

  // Find intersection with baseline
  const b0 = baselineAt(0);
  const b1 = baselineAt(1) - b0;

  const denom = tangentSlope - b1;
  if (Math.abs(denom) < 1e-12) return maxSlopeIdx;

  const intersectIdx = (b0 - tangentIntercept) / denom;
  return Math.max(leftBaseIdx, Math.min(peakIdx, Math.round(intersectIdx)));
}

/**
 * Find offset point: steepest tangent on trailing edge intersected with baseline.
 */
function findOffset(
  smoothed: Float64Array,
  peakIdx: number,
  rightBaseIdx: number,
  baselineAt: (idx: number) => number,
  _isHeating: boolean,
): number {
  const regWindow = 10;

  let maxSlopeIdx = peakIdx + regWindow;
  let maxSlope = 0;

  for (let i = peakIdx + regWindow; i < rightBaseIdx - regWindow; i++) {
    const { slope } = linearRegression(smoothed, i - regWindow, i + regWindow);
    if (Math.abs(slope) > maxSlope) {
      maxSlope = Math.abs(slope);
      maxSlopeIdx = i;
    }
  }

  const { slope: tangentSlope, intercept: tangentIntercept } = linearRegression(
    smoothed,
    maxSlopeIdx - regWindow,
    maxSlopeIdx + regWindow,
  );

  const b0 = baselineAt(0);
  const b1 = baselineAt(1) - b0;
  const denom = tangentSlope - b1;
  if (Math.abs(denom) < 1e-12) return maxSlopeIdx;

  const intersectIdx = (b0 - tangentIntercept) / denom;
  return Math.max(peakIdx, Math.min(rightBaseIdx, Math.round(intersectIdx)));
}

/**
 * Simple linear regression: y = slope*x + intercept
 * over indices [startIdx, endIdx].
 */
function linearRegression(
  data: Float64Array,
  startIdx: number,
  endIdx: number,
): { slope: number; intercept: number } {
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  const n = endIdx - startIdx + 1;

  for (let i = startIdx; i <= endIdx; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumX2 += i * i;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-20) {
    return { slope: 0, intercept: data[startIdx] };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// ─── Enthalpy Integration ───────────────────────────────────────────────

/**
 * Integrate (heatflow - baseline) using the trapezoidal rule.
 * Result in J/g = mW·h × 3600 / (massMg / 1000)
 */
function integrateEnthalpy(
  points: DscDataPoint[],
  startIdx: number,
  endIdx: number,
  baselineAt: (idx: number) => number,
  massMg: number,
  isHeating: boolean,
): number {
  let integral = 0;

  for (let i = startIdx; i < endIdx; i++) {
    const dt = points[i + 1].timeH - points[i].timeH; // hours
    const y0 = points[i].heatflowMw - baselineAt(i);
    const y1 = points[i + 1].heatflowMw - baselineAt(i + 1);
    integral += 0.5 * (y0 + y1) * dt;
  }

  // Convert mW·h to J: 1 mW·h = 3.6 J
  const totalJ = integral * 3.6;

  // Normalize by mass (mg → g)
  const massG = massMg / 1000;
  const jPerG = totalJ / massG;

  // Sign convention (matching Calisto software):
  //   Heating (endothermic melting): heatflow dips below baseline → integral is negative
  //     → negate to get positive J/g (energy absorbed)
  //   Cooling (exothermic crystallization): heatflow rises above baseline → integral is positive
  //     → negate to get negative J/g (energy released)
  return -jPerG;
}

// ─── Exports for testing ────────────────────────────────────────────────

export {
  findExtrema as _findExtrema,
  analyzePeak as _analyzePeak,
  findBaselineBoundaries as _findBaselineBoundaries,
  integrateEnthalpy as _integrateEnthalpy,
  calculateProminence as _calculateProminence,
};
