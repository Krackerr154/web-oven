import type { DscDataPoint, DscMetadata } from "@/lib/dsc/parser";
import type { DetectedPeak } from "@/lib/dsc/peakDetection";

export type DscPeakWithId = DetectedPeak & {
  id: string;
  label?: string;
};

export type DscRawCache = {
  metadata: DscMetadata;
  dataPoints: DscDataPoint[];
  filename: string;
};

export type DscExperimentSummary = {
  id: string;
  filename: string;
  sampleName: string;
  massMg: number;
  molarMass: number | null;
  atmosphere: string | null;
  operatorName: string | null;
  procedureName: string | null;
  recordedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  _count: { peaks: number };
};

export type DscSavedPeak = {
  id: string;
  experimentId: string;
  cycleIndex: number;
  peakType: "exothermic" | "endothermic";
  onsetTempC: number;
  onsetTimeH: number;
  offsetTempC: number;
  offsetTimeH: number;
  peakMaxTempC: number;
  peakMaxTimeH: number;
  peakHeightMw: number;
  heatJPerG: number;
  label: string | null;
  isManual: boolean;
  createdAt: Date | string;
};

export type DscExperimentWithPeaks = Omit<DscExperimentSummary, "_count"> & {
  userId: string;
  peaks: DscSavedPeak[];
};

export type DscRawFilePayload = {
  filename: string;
  content: string;
  sizeBytes: number;
};
