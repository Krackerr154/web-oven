import { notFound } from "next/navigation";
import Link from "next/link";
import { getBookingDetailForAdmin } from "@/app/actions/admin";
import { formatDateTimeWib, formatDuration } from "@/lib/utils";
import { BookingManagementForm } from "../booking-management-form";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-blue-500/20 text-blue-300",
  COMPLETED: "bg-emerald-500/20 text-emerald-300",
  CANCELLED: "bg-slate-500/20 text-slate-300",
  AUTO_CANCELLED: "bg-amber-500/20 text-amber-300",
};

export default async function AdminBookingDetailPage({ params }: Props) {
  const { id } = await params;
  const booking = await getBookingDetailForAdmin(id);

  if (!booking) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Booking Management</h1>
          <p className="text-slate-400 mt-1">Admin detail, lifecycle, and controls</p>
        </div>
        <Link
          href="/admin/bookings"
          className="text-sm text-orange-300 hover:text-orange-200"
        >
          ← Back to All Bookings
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-white">{booking.oven.name}</p>
              <p className="text-sm text-slate-400">
                {booking.oven.type === "NON_AQUEOUS" ? "Non-Aqueous" : "Aqueous"} • Max {booking.oven.maxTemp}°C
              </p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyles[booking.status] || ""
                }`}
            >
              {booking.status.replace("_", " ")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">User</p>
              <p className="text-slate-200">{booking.user.name}</p>
              <p className="text-slate-400 text-xs">{booking.user.email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Phone</p>
              <p className="text-slate-200">{booking.user.phone}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Start (WIB)</p>
              <p className="text-slate-200">{formatDateTimeWib(booking.startDate)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">End (WIB)</p>
              <p className="text-slate-200">{formatDateTimeWib(booking.endDate)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Duration</p>
              <p className="text-slate-200">{formatDuration(booking.startDate, booking.endDate)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Temp / Flap</p>
              <p className="text-slate-200">{booking.usageTemp}°C / {booking.flap}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Created At</p>
              <p className="text-slate-200">{formatDateTimeWib(booking.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Booking ID</p>
              <p className="text-slate-400 text-xs break-all">{booking.id}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500">Purpose</p>
            <p className="text-slate-200 text-sm">{booking.purpose}</p>
          </div>

          <div className="pt-3 border-t border-slate-700/60">
            <BookingManagementForm
              booking={{
                id: booking.id,
                startDate: booking.startDate,
                endDate: booking.endDate,
                purpose: booking.purpose,
                usageTemp: booking.usageTemp,
                flap: booking.flap,
                status: booking.status,
              }}
            />
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Lifecycle Timeline</h2>
          {booking.events.length === 0 ? (
            <p className="text-xs text-slate-500">No lifecycle events recorded.</p>
          ) : (
            <div className="space-y-3 max-h-[540px] overflow-auto pr-1">
              {booking.events.map((event: any) => (
                <div key={event.id} className="rounded-lg border border-slate-700/70 p-3">
                  <p className="text-xs font-medium text-slate-200">{event.eventType.replace("_", " ")}</p>
                  <p className="text-[11px] text-slate-500">{formatDateTimeWib(event.createdAt)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    By {event.actor?.name ?? event.actorType}
                  </p>
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
