"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Activity, Calendar, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { deleteExperiment } from "@/app/actions/dsc";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { formatDateTimeWib } from "@/lib/utils";
import type { DscExperimentSummary } from "./types";
import { removeRawDscData } from "./utils";

export function DscHistory({ experiments }: { experiments: DscExperimentSummary[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState<DscExperimentSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  const confirmDelete = () => {
    if (!pendingDelete) return;

    startTransition(async () => {
      const result = await deleteExperiment(pendingDelete.id);
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      removeRawDscData(pendingDelete.id);
      toast.success(result.message);
      setPendingDelete(null);
      router.refresh();
    });
  };

  return (
    <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Recent Experiments</h2>
          <p className="text-sm text-slate-500">Previously saved DSC metadata and peak results</p>
        </div>
        <span className="text-xs text-slate-500">{experiments.length} saved</span>
      </div>

      {experiments.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-slate-800">
          <Activity className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No experiments yet. Upload a DSC file to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-3 pr-4 font-medium">File</th>
                <th className="py-3 px-4 font-medium">Sample</th>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium text-right">Peaks</th>
                <th className="py-3 pl-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {experiments.map((experiment) => (
                <tr key={experiment.id} className="text-slate-300 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 pr-4 min-w-56">
                    <p className="font-medium text-white truncate max-w-72">{experiment.filename}</p>
                    <p className="text-xs text-slate-500">Mass {experiment.massMg} mg</p>
                  </td>
                  <td className="py-3 px-4 min-w-44">{experiment.sampleName}</td>
                  <td className="py-3 px-4 min-w-48">
                    <span className="inline-flex items-center gap-2 text-slate-400">
                      <Calendar className="h-4 w-4" />
                      {formatDateTimeWib(experiment.recordedAt ?? experiment.createdAt)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">{experiment._count.peaks}</td>
                  <td className="py-3 pl-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/dsc/${experiment.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700/60 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </Link>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(experiment)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/20 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete DSC experiment?"
        description={`This will remove ${pendingDelete?.filename ?? "the experiment"} and all saved peak results.`}
        confirmLabel="Delete"
        loading={isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
