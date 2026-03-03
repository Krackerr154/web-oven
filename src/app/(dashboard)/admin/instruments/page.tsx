import { prisma } from "@/lib/prisma";
import { InstrumentActionButtons } from "./action-buttons";
import { AddInstrumentModal } from "./add-oven-modal";

export const dynamic = "force-dynamic";

export default async function AdminInstrumentsPage() {
  const instruments = await prisma.instrument.findMany({
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Instrument Management</h1>
          <p className="text-slate-400 mt-1">
            Add, edit, or remove instruments. Toggle maintenance mode to auto-cancel active bookings.
          </p>
        </div>
        <AddInstrumentModal />
      </div>

      {instruments.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <p className="text-slate-400">No instruments configured yet.</p>
          <p className="text-slate-500 text-sm mt-1">Click &quot;Add Instrument&quot; to create your first instrument.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {instruments.map((instrument) => {
            const isMaintenance = instrument.status === "MAINTENANCE";

            return (
              <div
                key={instrument.id}
                className={`rounded-xl border p-6 ${isMaintenance
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-slate-800/50 border-slate-700"
                  }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{instrument.name}</h2>
                    <p className="text-sm text-slate-400">
                      {instrument.category === "NON_AQUEOUS" ? "Non-Aqueous" : "Aqueous"}
                    </p>
                    {instrument.description && (
                      <p className="text-sm text-slate-500 mt-1">{instrument.description}</p>
                    )}
                    <p className="text-sm text-slate-400 mt-1">
                      Max Temp: <span className="text-white font-medium">{instrument.maxTemp}°C</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${isMaintenance ? "bg-amber-400" : "bg-emerald-400"
                        } animate-pulse`}
                    />
                    <span className="text-sm font-medium text-slate-200">
                      {isMaintenance ? "Maintenance" : "Available"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                  <p className="text-sm text-slate-400">
                    Active bookings: <span className="text-white font-medium">{instrument._count.bookings}</span>
                  </p>
                  <InstrumentActionButtons
                    instrument={{
                      id: instrument.id,
                      name: instrument.name,
                      type: instrument.type,
                      category: instrument.category,
                      description: instrument.description,
                      maxTemp: instrument.maxTemp,
                    }}
                    isMaintenance={isMaintenance}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
