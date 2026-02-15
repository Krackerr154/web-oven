import { prisma } from "@/lib/prisma";
import { OvenActionButtons } from "./action-buttons";

export const dynamic = "force-dynamic";

export default async function AdminOvensPage() {
  const ovens = await prisma.oven.findMany({
    orderBy: { id: "asc" },
    include: {
      _count: {
        select: {
          bookings: { where: { status: "ACTIVE" } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Oven Management</h1>
        <p className="text-slate-400 mt-1">
          Toggle maintenance mode. Setting maintenance will auto-cancel all active bookings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ovens.map((oven) => {
          const isMaintenance = oven.status === "MAINTENANCE";

          return (
            <div
              key={oven.id}
              className={`rounded-xl border p-6 ${
                isMaintenance
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-slate-800/50 border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{oven.name}</h2>
                  <p className="text-sm text-slate-400">
                    {oven.type === "NON_AQUEOUS" ? "Non-Aqueous" : "Aqueous"}
                  </p>
                  {oven.description && (
                    <p className="text-sm text-slate-500 mt-1">{oven.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      isMaintenance ? "bg-amber-400" : "bg-emerald-400"
                    } animate-pulse`}
                  />
                  <span className="text-sm font-medium text-slate-200">
                    {isMaintenance ? "Maintenance" : "Available"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                <p className="text-sm text-slate-400">
                  Active bookings: <span className="text-white font-medium">{oven._count.bookings}</span>
                </p>
                <OvenActionButtons ovenId={oven.id} isMaintenance={isMaintenance} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
