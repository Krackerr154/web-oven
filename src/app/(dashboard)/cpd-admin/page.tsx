import { getPendingCPDBookings } from "@/app/actions/admin";
import { Microscope, Clock, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { CPDBookingActions } from "./_components/cpd-booking-actions";

export const dynamic = "force-dynamic";

export default async function CPDAdminPage() {
  const bookings = await getPendingCPDBookings();

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">CPD Booking Requests</h1>
        <p className="text-slate-400 mt-1">Review and approve pending CPD Tousimis booking requests</p>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <Microscope className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No pending requests</p>
          <p className="text-slate-500 text-sm mt-1">All CPD booking requests have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-amber-400/80 font-medium">
            {bookings.length} pending request{bookings.length !== 1 ? "s" : ""}
          </p>
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-slate-800/50 border border-amber-500/20 rounded-xl p-5 space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/15 text-amber-300 text-xs font-semibold rounded-full border border-amber-500/30">
                    <Clock className="h-3 w-3" />
                    Pending Approval
                  </span>
                  <span className="text-slate-500 text-xs">
                    Submitted {format(new Date(booking.createdAt), "d MMM yyyy, HH:mm")}
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span className="font-medium">{booking.user.name}</span>
                  {booking.user.nim && (
                    <span className="text-slate-500 text-xs">({booking.user.nim})</span>
                  )}
                </div>
                <div className="text-slate-400 text-xs">{booking.user.email}</div>

                <div className="flex items-center gap-2 text-slate-300">
                  <Microscope className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span>{booking.instrument.name}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Calendar className="h-3 w-3 text-slate-500 shrink-0" />
                  {format(new Date(booking.startDate), "d MMM yyyy, HH:mm")}
                  {" → "}
                  {format(new Date(booking.endDate), "d MMM yyyy, HH:mm")}
                </div>

                <div>
                  <span className="text-slate-500 text-xs uppercase tracking-wide">Purpose</span>
                  <p className="text-slate-300 mt-0.5">{booking.purpose}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs uppercase tracking-wide">Sample</span>
                  <p className="text-slate-300 mt-0.5">{booking.sample}</p>
                </div>

                <div>
                  <span className="text-slate-500 text-xs uppercase tracking-wide">CPD Mode</span>
                  <p className="text-slate-300 mt-0.5">
                    {booking.cpdMode}
                    {booking.cpdModeDetails && (
                      <span className="text-slate-400"> — {booking.cpdModeDetails}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-700/50">
                <CPDBookingActions bookingId={booking.id} userName={booking.user.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
