export default function DscExperimentLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-9 w-9 rounded-lg bg-slate-800/60" />
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-800/60" />
          <div className="space-y-2">
            <div className="h-5 w-48 rounded bg-slate-800/60" />
            <div className="h-3 w-32 rounded bg-slate-800/40" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
        {/* Chart area */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <div className="h-[500px] rounded-xl bg-slate-800/30" />
        </div>

        {/* Sidebar */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="h-5 w-24 rounded bg-slate-800/60" />
          <div className="h-10 rounded-lg bg-slate-800/30" />
          <div className="h-10 rounded-lg bg-slate-800/30" />
          <div className="h-10 rounded-lg bg-slate-800/30" />
          <div className="h-24 rounded-lg bg-slate-800/30" />
          <div className="h-24 rounded-lg bg-slate-800/30" />
        </div>
      </div>
    </div>
  );
}
