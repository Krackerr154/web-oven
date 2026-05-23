"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Activity, ArrowLeft, FileWarning, Loader2, RefreshCw, Upload } from "lucide-react";
import { getExperiment, getRawFile, upsertRawFile } from "@/app/actions/dsc";
import { DscChart, type ChartExportHandlers } from "./DscChart";
import { PeakSidebar } from "./PeakSidebar";
import { detectPeaks } from "@/lib/dsc/peakDetection";
import { parseDscFile } from "@/lib/dsc/parser";
import type { DscRawCache, DscExperimentWithPeaks, DscPeakWithId } from "./types";
import { formatDateTimeWib } from "@/lib/utils";
import { useToast } from "@/components/toast";
import {
  addIdsToDetectedPeaks,
  createManualPeakFromRange,
  decodeDscRawFile,
  encodeDscRawFile,
  mapSavedPeaksToUiPeaks,
  rebuildPeakWithBounds,
} from "./utils";

export function DscAnalysisClient({ experimentId }: { experimentId: string }) {
  const toast = useToast();
  const [experiment, setExperiment] = useState<DscExperimentWithPeaks | null>(null);
  const [rawData, setRawData] = useState<DscRawCache | null>(null);
  const [peaks, setPeaks] = useState<DscPeakWithId[]>([]);
  const [selectedPeakId, setSelectedPeakId] = useState<string | null>(null);
  const [showBaseline, setShowBaseline] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reuploading, setReuploading] = useState(false);
  const [exportImage, setExportImage] = useState<ChartExportHandlers["exportImage"] | undefined>();
  const initializedPeaksRef = useRef(false);
  const exportReadyRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const [result, rawFileResult] = await Promise.all([
        getExperiment(experimentId),
        getRawFile(experimentId),
      ]);
      if (!active) return;

      if (!result.success) {
        toast.error(result.message);
        setLoading(false);
        return;
      }

      setExperiment(result.data);
      if (!rawFileResult.success) {
        toast.error(rawFileResult.message);
      } else if (rawFileResult.data) {
        const parsed = parseDscFile(decodeDscRawFile(rawFileResult.data));
        if (parsed.dataPoints.length === 0) {
          toast.error(parsed.parseErrors[0] ?? "Stored raw DSC file could not be parsed");
          setRawData(null);
        } else {
          setRawData({
            filename: rawFileResult.data.filename,
            metadata: parsed.metadata,
            dataPoints: parsed.dataPoints,
          });
        }
      } else {
        setRawData(null);
      }
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [experimentId, toast]);

  useEffect(() => {
    if (!experiment || !rawData || initializedPeaksRef.current) return;

    if (experiment.peaks.length > 0) {
      const mappedPeaks = mapSavedPeaksToUiPeaks(experiment.peaks, rawData.dataPoints);
      setPeaks(mappedPeaks);
      setSelectedPeakId(mappedPeaks[0]?.id ?? null);
    } else {
      const detected = addIdsToDetectedPeaks(detectPeaks(rawData.dataPoints, experiment.massMg), "initial");
      setPeaks(detected);
      setSelectedPeakId(detected[0]?.id ?? null);
    }

    initializedPeaksRef.current = true;
  }, [experiment, rawData]);

  const handleDetect = (prominenceThresholdMw: number, smoothingWindow: number) => {
    if (!experiment || !rawData) return;
    const detected = addIdsToDetectedPeaks(
      detectPeaks(rawData.dataPoints, experiment.massMg, { prominenceThresholdMw, smoothingWindowPts: smoothingWindow }),
      `detect-${Date.now()}`,
    );
    setPeaks(detected);
    setSelectedPeakId(detected[0]?.id ?? null);
    toast.success(`Detected ${detected.length} peak${detected.length === 1 ? "" : "s"}`);
  };

  const handleManualRange = (startTempC: number, endTempC: number) => {
    if (!experiment || !rawData) return;

    const peak = createManualPeakFromRange(rawData.dataPoints, experiment.massMg, startTempC, endTempC);
    if (!peak) {
      toast.warning("Select a wider range within one DSC cycle");
      return;
    }

    setPeaks((current) => [...current, peak]);
    setSelectedPeakId(peak.id);
    setManualMode(false);
    toast.success("Manual peak added");
  };

  const handlePeakBoundsChange = (peakId: string, onsetTempC: number, offsetTempC: number) => {
    if (!experiment || !rawData) return;
    setPeaks((current) => current.map((peak) => {
      if (peak.id !== peakId) return peak;
      return rebuildPeakWithBounds(peak, rawData.dataPoints, experiment.massMg, onsetTempC, offsetTempC) ?? peak;
    }));
  };

  const handleReupload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.item(0);
    event.target.value = "";
    if (!file || !experiment) return;

    setReuploading(true);
    try {
      const rawFile = await encodeDscRawFile(file);
      const parsed = parseDscFile(decodeDscRawFile(rawFile));
      if (parsed.dataPoints.length === 0) {
        toast.error(parsed.parseErrors[0] ?? "Could not parse DSC file");
        return;
      }
      const saved = await upsertRawFile(experiment.id, rawFile);
      if (!saved.success) {
        toast.error(saved.message);
        return;
      }
      const cache = {
        filename: file.name,
        metadata: parsed.metadata,
        dataPoints: parsed.dataPoints,
      };
      setRawData(cache);
      initializedPeaksRef.current = false;
      toast.success("Raw data restored and saved to portal");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not parse DSC file";
      toast.error(message);
    } finally {
      setReuploading(false);
    }
  };

  const handleChartReady = useCallback((handlers: ChartExportHandlers) => {
    if (exportReadyRef.current) return;
    exportReadyRef.current = true;
    setExportImage(() => handlers.exportImage);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!experiment) {
    return <MissingState title="Experiment not found" message="The experiment may have been deleted or you may not have access." />;
  }

  if (!rawData) {
    return (
      <div className="space-y-6 animate-fade-in">
        <AnalysisHeader experiment={experiment} />
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-8 text-center">
          <FileWarning className="mx-auto mb-4 h-12 w-12 text-amber-300" />
          <h2 className="text-lg font-semibold text-white">Raw DSC data is not available in this browser</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-amber-100/80">
            The portal stores metadata and peak results only. Re-upload the original Setaram file to restore the chart for this session.
          </p>
          <label className="mt-5 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-300 transition-colors">
            {reuploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Re-upload raw file
            <input type="file" accept=".txt,text/plain" className="hidden" onChange={handleReupload} />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <AnalysisHeader experiment={experiment} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-800 rounded-2xl p-4">
          <DscChart
            dataPoints={rawData.dataPoints}
            peaks={peaks}
            selectedPeakId={selectedPeakId}
            showBaseline={showBaseline}
            manualMode={manualMode}
            onSelectPeak={setSelectedPeakId}
            onManualRange={handleManualRange}
            onPeakBoundsChange={handlePeakBoundsChange}
            onReady={handleChartReady}
          />
        </div>

        <PeakSidebar
          experimentId={experiment.id}
          peaks={peaks}
          selectedPeakId={selectedPeakId}
          showBaseline={showBaseline}
          manualMode={manualMode}
          onSelectPeak={setSelectedPeakId}
          onDeletePeak={(peakId) => {
            setPeaks((current) => current.filter((peak) => peak.id !== peakId));
            if (selectedPeakId === peakId) setSelectedPeakId(null);
          }}
          onLabelPeak={(peakId, label) => {
            setPeaks((current) => current.map((peak) => peak.id === peakId ? { ...peak, label } : peak));
          }}
          onDetect={handleDetect}
          onToggleBaseline={() => setShowBaseline((current) => !current)}
          onToggleManualMode={() => setManualMode((current) => !current)}
          onExportImage={exportImage}
        />
      </div>
    </div>
  );
}

function AnalysisHeader({ experiment }: { experiment: DscExperimentWithPeaks }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4 min-w-0">
        <Link href="/dsc" className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0 shadow-inner">
          <Activity className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-white">{experiment.sampleName}</h1>
          <p className="truncate text-xs text-slate-500">{experiment.filename}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 lg:text-right">
        <HeaderMetric label="Mass" value={`${experiment.massMg} mg`} />
        <HeaderMetric label="Atmosphere" value={experiment.atmosphere ?? "—"} />
        <HeaderMetric label="Date" value={formatDateTimeWib(experiment.recordedAt ?? experiment.createdAt)} />
        <HeaderMetric label="Operator" value={experiment.operatorName ?? "—"} />
      </div>
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 font-medium text-slate-200">{value}</p>
    </div>
  );
}

function MissingState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
      <RefreshCw className="mx-auto mb-4 h-10 w-10 text-slate-600" />
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      <Link href="/dsc" className="mt-5 inline-flex rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-400 transition-colors">
        Back to DSC Analysis
      </Link>
    </div>
  );
}
