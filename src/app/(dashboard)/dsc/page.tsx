import { Metadata } from "next";
import { Activity, Upload } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = {
  title: "DSC Analysis | AP Lab",
  description:
    "Upload and analyse Differential Scanning Calorimetry data from Setaram instruments",
};

export default async function DscPage() {
  const session = await getServerSession(authOptions);

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

      {/* Upload Zone Placeholder */}
      <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-800 rounded-2xl p-8">
        <div className="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center hover:border-cyan-500/50 transition-colors">
          <Upload className="h-12 w-12 text-slate-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">
            Upload DSC Data File
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Drop a Setaram <code className="text-cyan-400">.txt</code> export
            file here, or click to browse
          </p>
          <p className="text-slate-500 text-xs">
            Supported: UTF-16 LE tab-delimited files up to 50 MB
          </p>
        </div>
      </div>

      {/* Experiment History Placeholder */}
      <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Recent Experiments
        </h2>
        <div className="text-center py-12">
          <Activity className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            No experiments yet. Upload a DSC file to get started.
          </p>
        </div>
      </div>
    </div>
  );
}
