import type { DscDataPoint, DscMetadata } from "@/lib/dsc/parser";
import type { DetectedPeak } from "@/lib/dsc/peakDetection";
import type { DscPeakWithId, DscRawCache, DscSavedPeak } from "./types";

export const DSC_RAW_STORAGE_PREFIX = "dsc_raw_";

export function getDscRawStorageKey(experimentId: string) {
  return `${DSC_RAW_STORAGE_PREFIX}${experimentId}`;
}

export function countCycles(dataPoints: DscDataPoint[]) {
  return new Set(dataPoints.map((point) => point.cycleIndex)).size;
}

export function storeRawDscData(experimentId: string, cache: DscRawCache) {
  sessionStorage.setItem(getDscRawStorageKey(experimentId), JSON.stringify(cache));
}

export function loadRawDscData(experimentId: string): DscRawCache | null {
  const raw = sessionStorage.getItem(getDscRawStorageKey(experimentId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DscRawCache;
    return {
      ...parsed,
      metadata: reviveMetadata(parsed.metadata),
    };
  } catch {
    return null;
  }
}

export function removeRawDscData(experimentId: string) {
  sessionStorage.removeItem(getDscRawStorageKey(experimentId));
}

export function addIdsToDetectedPeaks(peaks: DetectedPeak[], prefix = "auto"): DscPeakWithId[] {
  return peaks.map((peak, index) => ({
    ...peak,
    id: `${prefix}-${peak.cycleIndex}-${peak.peakType}-${index}-${Math.round(peak.peakMaxTempC * 100)}`,
  }));
}

export function mapSavedPeaksToUiPeaks(
  savedPeaks: DscSavedPeak[],
  dataPoints: DscDataPoint[],
): DscPeakWithId[] {
  return savedPeaks.map((peak) => ({
    ...peak,
    id: peak.id,
    label: peak.label ?? undefined,
    baselineType: "linear",
    peakMaxIdx: findNearestPointIndex(dataPoints, peak.cycleIndex, peak.peakMaxTempC, peak.peakMaxTimeH),
    onsetIdx: findNearestPointIndex(dataPoints, peak.cycleIndex, peak.onsetTempC, peak.onsetTimeH),
    offsetIdx: findNearestPointIndex(dataPoints, peak.cycleIndex, peak.offsetTempC, peak.offsetTimeH),
  }));
}

export function toPeakInput(peak: DscPeakWithId) {
  return {
    cycleIndex: peak.cycleIndex,
    peakType: peak.peakType,
    onsetTempC: peak.onsetTempC,
    onsetTimeH: peak.onsetTimeH,
    offsetTempC: peak.offsetTempC,
    offsetTimeH: peak.offsetTimeH,
    peakMaxTempC: peak.peakMaxTempC,
    peakMaxTimeH: peak.peakMaxTimeH,
    peakHeightMw: peak.peakHeightMw,
    heatJPerG: peak.heatJPerG,
    label: peak.label,
    isManual: peak.isManual,
  };
}

export function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function formatPeakType(type: "exothermic" | "endothermic") {
  return type === "exothermic" ? "Exo" : "Endo";
}

export function getCycleLabel(cycleIndex: number) {
  return `Cycle ${Math.floor(cycleIndex / 2) + 1}${cycleIndex % 2 === 0 ? "H" : "C"}`;
}

export function createManualPeakFromRange(
  dataPoints: DscDataPoint[],
  massMg: number,
  rangeStartTempC: number,
  rangeEndTempC: number,
): DscPeakWithId | null {
  const minTemp = Math.min(rangeStartTempC, rangeEndTempC);
  const maxTemp = Math.max(rangeStartTempC, rangeEndTempC);
  const candidates = dataPoints.filter(
    (point) => point.sampleTempC >= minTemp && point.sampleTempC <= maxTemp,
  );

  if (candidates.length < 3) return null;

  const cycleIndex = getDominantCycle(candidates);
  const cyclePoints = dataPoints
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => point.cycleIndex === cycleIndex && point.sampleTempC >= minTemp && point.sampleTempC <= maxTemp)
    .sort((a, b) => a.index - b.index);

  if (cyclePoints.length < 3) return null;

  const direction = getDominantDirection(cyclePoints.map(({ point }) => point));
  const isHeating = direction === "heating";
  const peakEntry = cyclePoints.reduce((best, entry) => {
    if (isHeating) return entry.point.heatflowMw < best.point.heatflowMw ? entry : best;
    return entry.point.heatflowMw > best.point.heatflowMw ? entry : best;
  }, cyclePoints[0]);

  return buildPeakFromBounds({
    id: `manual-${Date.now()}`,
    dataPoints,
    cycleIndex,
    onsetIdx: cyclePoints[0].index,
    offsetIdx: cyclePoints[cyclePoints.length - 1].index,
    peakMaxIdx: peakEntry.index,
    massMg,
    isManual: true,
    label: "Manual peak",
  });
}

export function rebuildPeakWithBounds(
  peak: DscPeakWithId,
  dataPoints: DscDataPoint[],
  massMg: number,
  onsetTempC: number,
  offsetTempC: number,
): DscPeakWithId | null {
  const onsetIdx = findNearestPointIndex(dataPoints, peak.cycleIndex, onsetTempC, peak.onsetTimeH);
  const offsetIdx = findNearestPointIndex(dataPoints, peak.cycleIndex, offsetTempC, peak.offsetTimeH);

  if (onsetIdx === offsetIdx) return null;

  const startIdx = Math.min(onsetIdx, offsetIdx);
  const endIdx = Math.max(onsetIdx, offsetIdx);
  const peakMaxIdx = Math.min(Math.max(peak.peakMaxIdx, startIdx), endIdx);

  return buildPeakFromBounds({
    id: peak.id,
    dataPoints,
    cycleIndex: peak.cycleIndex,
    onsetIdx: startIdx,
    offsetIdx: endIdx,
    peakMaxIdx,
    massMg,
    isManual: peak.isManual,
    label: peak.label,
  });
}

function reviveMetadata(metadata: DscMetadata): DscMetadata {
  return {
    ...metadata,
    recordedAt: metadata.recordedAt ? new Date(metadata.recordedAt) : null,
  };
}

function findNearestPointIndex(
  points: DscDataPoint[],
  cycleIndex: number,
  tempC: number,
  timeH: number,
) {
  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (point.cycleIndex !== cycleIndex) continue;
    const score = Math.abs(point.sampleTempC - tempC) + Math.abs(point.timeH - timeH) * 10;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function getDominantCycle(points: DscDataPoint[]) {
  const counts = new Map<number, number>();
  for (const point of points) {
    counts.set(point.cycleIndex, (counts.get(point.cycleIndex) ?? 0) + 1);
  }

  let bestCycle = points[0].cycleIndex;
  let bestCount = 0;
  for (const [cycleIndex, count] of counts) {
    if (count > bestCount) {
      bestCycle = cycleIndex;
      bestCount = count;
    }
  }
  return bestCycle;
}

function getDominantDirection(points: DscDataPoint[]) {
  let heating = 0;
  let cooling = 0;
  for (const point of points) {
    if (point.cycleDirection === "heating") heating++;
    if (point.cycleDirection === "cooling") cooling++;
  }
  return heating >= cooling ? "heating" : "cooling";
}

function buildPeakFromBounds(args: {
  id: string;
  dataPoints: DscDataPoint[];
  cycleIndex: number;
  onsetIdx: number;
  offsetIdx: number;
  peakMaxIdx: number;
  massMg: number;
  isManual: boolean;
  label?: string;
}): DscPeakWithId | null {
  const { dataPoints, cycleIndex, onsetIdx, offsetIdx, peakMaxIdx, massMg } = args;
  if (offsetIdx <= onsetIdx || massMg <= 0) return null;

  const onsetPoint = dataPoints[onsetIdx];
  const offsetPoint = dataPoints[offsetIdx];
  const peakPoint = dataPoints[peakMaxIdx];
  const direction = getDominantDirection(
    dataPoints.slice(onsetIdx, offsetIdx + 1).filter((point) => point.cycleIndex === cycleIndex),
  );

  const baselineAt = createBaselineFunction(dataPoints, onsetIdx, offsetIdx);
  const peakHeightMw = peakPoint.heatflowMw - baselineAt(peakMaxIdx);
  const heatJPerG = integrateHeat(dataPoints, onsetIdx, offsetIdx, baselineAt, massMg);

  return {
    id: args.id,
    cycleIndex,
    peakType: direction === "heating" ? "endothermic" : "exothermic",
    peakMaxIdx,
    peakMaxTempC: peakPoint.sampleTempC,
    peakMaxTimeH: peakPoint.timeH,
    peakHeightMw,
    onsetIdx,
    onsetTempC: onsetPoint.sampleTempC,
    onsetTimeH: onsetPoint.timeH,
    offsetIdx,
    offsetTempC: offsetPoint.sampleTempC,
    offsetTimeH: offsetPoint.timeH,
    heatJPerG,
    baselineType: "linear",
    isManual: args.isManual,
    label: args.label,
  };
}

function createBaselineFunction(points: DscDataPoint[], onsetIdx: number, offsetIdx: number) {
  const onsetHeat = points[onsetIdx].heatflowMw;
  const offsetHeat = points[offsetIdx].heatflowMw;
  const slope = (offsetHeat - onsetHeat) / (offsetIdx - onsetIdx);
  return (idx: number) => onsetHeat + slope * (idx - onsetIdx);
}

function integrateHeat(
  points: DscDataPoint[],
  onsetIdx: number,
  offsetIdx: number,
  baselineAt: (idx: number) => number,
  massMg: number,
) {
  let integral = 0;
  for (let i = onsetIdx; i < offsetIdx; i++) {
    const dt = points[i + 1].timeH - points[i].timeH;
    const y0 = points[i].heatflowMw - baselineAt(i);
    const y1 = points[i + 1].heatflowMw - baselineAt(i + 1);
    integral += 0.5 * (y0 + y1) * dt;
  }

  return -(integral * 3.6) / (massMg / 1000);
}
