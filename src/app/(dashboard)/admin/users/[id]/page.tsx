import { notFound } from "next/navigation";
import Link from "next/link";
import { getUserBookingStats, getUserInstrumentBans, liftInstrumentBan } from "@/app/actions/admin";
import { formatDateTimeWib, formatDuration } from "@/lib/utils";
import { ShieldBan, ShieldCheck } from "lucide-react";
import { LiftBanButton } from "./lift-ban-button";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminUserStatsPage({ params }: Props) {
  const { id } = await params;
  const data = await getUserBookingStats(id);
  const activeBans = await getUserInstrumentBans(id);

  if (!data) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">User Booking Stats</h1>
          <p className="text-slate-400 mt-1">6-month analytics and booking lifecycle details</p>
        </div>
        <Link href="/admin/users" className="text-sm text-orange-300 hover:text-orange-200">
          ← Back to Users
        </Link>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500">User</p>
          <p className="text-white font-medium">{data.user.name}</p>
          <p className="text-slate-400 text-sm">{data.user.email}</p>
          <p className="text-slate-500 text-xs">{data.user.phone}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Window</p>
          <p className="text-slate-200 text-sm">{formatDateTimeWib(data.window.from)} — {formatDateTimeWib(data.window.to)}</p>
          <p className="text-slate-400 text-xs mt-1">Registered: {formatDateTimeWib(data.user.createdAt)}</p>
        </div>
      </div>

      {activeBans.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldBan className="h-5 w-5 text-red-400" />
            <h2 className="text-red-300 font-semibold text-sm">Active Instrument Bans</h2>
          </div>
          <div className="grid gap-2">
            {activeBans.map((ban) => {
              const typeNameMap: Record<string, string> = {
                OVEN: "Oven",
                ULTRASONIC_BATH: "Ultrasonic Bath",
                GLOVEBOX: "Acrylic Glovebox",
              };
              return (
                <div key={ban.id} className="flex items-center justify-between gap-4 bg-slate-900/50 border border-red-500/20 rounded-lg p-3">
                  <div>
                    <p className="text-sm font-medium text-red-200">{typeNameMap[ban.instrumentType] || ban.instrumentType}</p>
                    <p className="text-[11px] text-red-300/70 mt-0.5">
                      Issued {formatDateTimeWib(ban.createdAt)} by {ban.bannedBy.name}
                    </p>
                    {ban.reason && (
                      <p className="text-xs text-red-300 mt-1">Reason: {ban.reason}</p>
                    )}
                  </div>
                  <LiftBanButton banId={ban.id} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total Bookings (6M)</p>
          <p className="text-2xl font-semibold text-white">{data.totals.bookings}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-xs text-slate-500">Used (Derived)</p>
          <p className="text-2xl font-semibold text-white">{data.totals.usedDerivedCount}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-xs text-slate-500">Current Active</p>
          <p className="text-2xl font-semibold text-white">{data.statusCounts.ACTIVE}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Status Summary</h2>
          <div className="space-y-2 text-sm">
            {Object.entries(data.statusCounts).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between border-b border-slate-700/40 pb-1">
                <span className="text-slate-400">{key.replace("_", " ")}</span>
                <span className="text-white font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Lifecycle Event Counts</h2>
          <div className="space-y-2 text-sm">
            {Object.entries(data.lifecycleCounts).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between border-b border-slate-700/40 pb-1">
                <span className="text-slate-400">{key.replace("_", " ")}</span>
                <span className="text-white font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Oven Usage (6M)</h2>
        {data.instrumentUsage.length === 0 ? (
          <p className="text-sm text-slate-500">No instrument usage in this period.</p>
        ) : (
          <div className="space-y-2">
            {data.instrumentUsage.map((item) => (
              <div key={item.instrumentName} className="flex items-center justify-between text-sm border-b border-slate-700/40 pb-1">
                <span className="text-slate-300">{item.instrumentName} ({item.instrumentType === "NON_AQUEOUS" ? "Non-Aqueous" : "Aqueous"})</span>
                <span className="text-white">{item.bookings} bookings • {item.totalHours.toFixed(1)}h</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Recent Bookings</h2>
          {data.bookings.length === 0 ? (
            <p className="text-sm text-slate-500">No bookings in this period.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-auto pr-1">
              {data.bookings.map((booking) => (
                <Link
                  key={booking.id}
                  href={`/admin/bookings/${booking.id}`}
                  className="block rounded-lg border border-slate-700/70 p-3 hover:bg-slate-700/20"
                >
                  <p className="text-sm text-white font-medium">{booking.instrument.name}</p>
                  <p className="text-xs text-slate-400">{formatDateTimeWib(booking.startDate)} — {formatDateTimeWib(booking.endDate)}</p>
                  <p className="text-xs text-slate-500 mt-1">Duration: {formatDuration(booking.startDate, booking.endDate)}</p>
                  <p className="text-xs text-slate-500">Status: {booking.status.replace("_", " ")}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Recent Lifecycle Events</h2>
          {data.events.length === 0 ? (
            <p className="text-sm text-slate-500">No lifecycle events in this period.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-auto pr-1">
              {data.events.map((event) => (
                <div key={event.id} className="rounded-lg border border-slate-700/70 p-3">
                  <p className="text-sm text-white">{event.eventType.replace("_", " ")}</p>
                  <p className="text-xs text-slate-500">{formatDateTimeWib(event.createdAt)}</p>
                  <p className="text-xs text-slate-400 mt-1">Actor: {event.actor?.name ?? event.actorType}</p>
                  {event.note && <p className="text-xs text-slate-300 mt-1">{event.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
