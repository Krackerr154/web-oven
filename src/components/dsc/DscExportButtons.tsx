"use client";

import { Download, FileImage, FileSpreadsheet, FileText, Loader2, Save } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { updatePeaks } from "@/app/actions/dsc";
import { useToast } from "@/components/toast";
import type { DscPeakWithId } from "./types";
import { toPeakInput } from "./utils";

type DscExportButtonsProps = {
  experimentId: string;
  peaks: DscPeakWithId[];
  onExportImage?: (format: "png" | "svg") => Promise<void>;
};

export function DscExportButtons({ experimentId, peaks, onExportImage }: DscExportButtonsProps) {
  const toast = useToast();
  const [exporting, setExporting] = useState<"png" | "svg" | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await updatePeaks(experimentId, peaks.map(toPeakInput));
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success("Peak results saved to portal");
    });
  };

  const handleImageExport = async (format: "png" | "svg") => {
    if (!onExportImage) {
      toast.warning("Chart is still loading");
      return;
    }

    setExporting(format);
    try {
      await onExportImage(format);
      toast.success(`${format.toUpperCase()} export started`);
    } catch {
      toast.error(`Could not export ${format.toUpperCase()} image`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-400 transition-colors disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save to portal
      </button>
      <div className="grid grid-cols-2 gap-2">
        <ExportButton label="PNG" icon={<FileImage className="h-4 w-4" />} loading={exporting === "png"} onClick={() => handleImageExport("png")} />
        <ExportButton label="SVG" icon={<Download className="h-4 w-4" />} loading={exporting === "svg"} onClick={() => handleImageExport("svg")} />
        <ExportButton label="PDF" icon={<FileText className="h-4 w-4" />} disabled tooltip="Phase 6 export engine" />
        <ExportButton label="Excel" icon={<FileSpreadsheet className="h-4 w-4" />} disabled tooltip="Phase 6 export engine" />
      </div>
    </div>
  );
}

function ExportButton({
  label,
  icon,
  loading = false,
  disabled = false,
  tooltip,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  tooltip?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={tooltip}
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700/60 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
