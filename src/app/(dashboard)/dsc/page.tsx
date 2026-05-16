import { Metadata } from "next";
import { Activity } from "lucide-react";
import { listExperiments } from "@/app/actions/dsc";
import { DscHistory } from "@/components/dsc/DscHistory";
import { DscUploader } from "@/components/dsc/DscUploader";

export const metadata: Metadata = {
  title: "DSC Analysis | AP Lab",
  description:
    "Upload and analyse Differential Scanning Calorimetry data from Setaram instruments",
};

export default async function DscPage() {
  const experimentsResult = await listExperiments();
  const experiments = experimentsResult.success ? experimentsResult.data : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0 shadow-inner">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">DSC Analysis</h1>
            <p className="text-slate-400 mt-0.5 text-sm">
              Upload Setaram DSC data files for thermal event analysis
            </p>
          </div>
        </div>
      </div>

      <DscUploader />

      {!experimentsResult.success && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {experimentsResult.message}
        </div>
      )}

      <DscHistory experiments={experiments} />
    </div>
  );
}
