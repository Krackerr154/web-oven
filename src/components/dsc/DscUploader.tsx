"use client";

import { useRef, useState, useTransition, type DragEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertCircle, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { saveExperiment } from "@/app/actions/dsc";
import { parseDscFile } from "@/lib/dsc/parser";
import type { DscDataPoint, DscMetadata } from "@/lib/dsc/parser";
import { formatDateTimeWib } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { countCycles, storeRawDscData } from "./utils";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export function DscUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedFile, setParsedFile] = useState<{
    filename: string;
    metadata: DscMetadata;
    dataPoints: DscDataPoint[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".txt")) {
      toast.error("Only Setaram .txt files are supported");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("File is larger than the 50 MB limit");
      return;
    }

    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseDscFile(buffer);
      setParsedFile({
        filename: file.name,
        metadata: parsed.metadata,
        dataPoints: parsed.dataPoints,
      });
      toast.success("DSC file parsed successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not parse DSC file";
      toast.error(message);
      setParsedFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleAnalyse = () => {
    if (!parsedFile) return;

    startTransition(async () => {
      const sampleName = parsedFile.metadata.sampleName || parsedFile.metadata.experimentName || stripExtension(parsedFile.filename);
      const massMg = parsedFile.metadata.massMg;

      if (!massMg || massMg <= 0) {
        toast.error("Mass metadata is required before analysis");
        return;
      }

      const result = await saveExperiment({
        filename: parsedFile.filename,
        sampleName,
        massMg,
        molarMass: parsedFile.metadata.molarMass,
        atmosphere: parsedFile.metadata.atmosphere,
        operatorName: parsedFile.metadata.operator,
        procedureName: parsedFile.metadata.procedure,
        recordedAt: parsedFile.metadata.recordedAt,
        peaks: [],
      });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      storeRawDscData(result.data.experimentId, parsedFile);
      toast.success("Experiment saved. Opening analysis view.");
      router.push(`/dsc/${result.data.experimentId}`);
      router.refresh();
    });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files.item(0);
    if (file) void handleFile(file);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.item(0);
    if (file) void handleFile(file);
    event.target.value = "";
  };

  return (
    <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-800 rounded-2xl p-6">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${isDragging
          ? "border-cyan-400 bg-cyan-500/10"
          : "border-slate-700 hover:border-cyan-500/50"
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={handleInputChange}
        />
        {isParsing ? (
          <Loader2 className="h-12 w-12 text-cyan-400 mx-auto mb-4 animate-spin" />
        ) : (
          <Upload className="h-12 w-12 text-slate-500 mx-auto mb-4" />
        )}
        <h2 className="text-lg font-semibold text-white mb-2">Upload DSC Data File</h2>
        <p className="text-slate-400 text-sm mb-4">
          Drop a Setaram <code className="text-cyan-400">.txt</code> export file here, or click to browse
        </p>
        <p className="text-slate-500 text-xs">Supported: UTF-16 LE tab-delimited files up to 50 MB</p>
      </div>

      {parsedFile && (
        <div className="mt-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-white font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  {parsedFile.filename}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 mt-3 text-sm">
                  <PreviewItem label="Sample" value={parsedFile.metadata.sampleName || parsedFile.metadata.experimentName || "—"} />
                  <PreviewItem label="Mass" value={parsedFile.metadata.massMg ? `${parsedFile.metadata.massMg} mg` : "Missing"} warning={!parsedFile.metadata.massMg} />
                  <PreviewItem label="Date" value={parsedFile.metadata.recordedAt ? formatDateTimeWib(parsedFile.metadata.recordedAt) : "—"} />
                  <PreviewItem label="Cycles" value={String(countCycles(parsedFile.dataPoints))} />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAnalyse}
              disabled={isPending || isParsing || !parsedFile.metadata.massMg}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              Analyse
            </button>
          </div>
          {!parsedFile.metadata.massMg && (
            <p className="mt-3 flex items-center gap-2 text-xs text-amber-300">
              <AlertCircle className="h-4 w-4" />
              The file must contain mass metadata before peak enthalpy can be calculated.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewItem({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`font-medium ${warning ? "text-amber-300" : "text-slate-200"}`}>{value}</p>
    </div>
  );
}

function stripExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}
