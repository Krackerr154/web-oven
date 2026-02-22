import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CancelBookingButton } from "./cancel-button";
import { EditBookingModal } from "./edit-booking-modal";
import { formatDateTimeWib, formatDuration, getCancellationWindowInfo } from "@/lib/utils";
import { autoCompleteBookings } from "@/app/actions/booking";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyBookingsPage() {
  await autoCompleteBookings();
  const session = await getServerSession(authOptions);

  const bookings = await prisma.booking.findMany({
    where: { userId: session?.user?.id, deletedAt: null },
    include: {
      oven: { select: { name: true, type: true, maxTemp: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const contactAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN", isContactPerson: true },
    select: { phone: true },
  });

  const statusStyles: Record<string, string> = {
    ACTIVE: "bg-blue-500/20 text-blue-300",
    COMPLETED: "bg-emerald-500/20 text-emerald-300",
    CANCELLED: "bg-slate-500/20 text-slate-300",
    AUTO_CANCELLED: "bg-amber-500/20 text-amber-300",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">My Bookings</h1>
        <p className="text-slate-400 mt-1">View and manage your oven bookings</p>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <CalendarPlus className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-3">No bookings yet</p>
          <Link
            href="/book"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors"
          >
            <CalendarPlus className="h-4 w-4" />
            Book an Oven
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile: Card layout */}
          <div className="lg:hidden space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3"
              >
                <Link href={`/my-bookings/${booking.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{booking.oven.name}</p>
                      <p className="text-xs text-slate-400">
                        {booking.oven.type === "NON_AQUEOUS" ? "Non-Aqueous" : "Aqueous"}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusStyles[booking.status] || ""
                        }`}
                    >
                      {booking.status.replace("_", " ")}
                    </span>
                  </div>
                </Link>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Start</p>
                    <p className="text-slate-300">
                      {formatDateTimeWib(booking.startDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">End</p>
                    <p className="text-slate-300">
                      {formatDateTimeWib(booking.endDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Duration</p>
                    <p className="text-slate-300">
                      {formatDuration(booking.startDate, booking.endDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Temp / Flap</p>
                    <p className="text-slate-300">
                      {booking.usageTemp}°C / {booking.flap}%
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Purpose</p>
                  <p className="text-sm text-slate-300">{booking.purpose}</p>
                </div>
                {booking.status === "ACTIVE" && (
                  <div className="pt-2 border-t border-slate-700/50">
                    {(() => {
                      const cancelInfo = getCancellationWindowInfo(booking.createdAt, 15);
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <EditBookingModal booking={booking} />
                            <CancelBookingButton
                              booking={booking}
                              contactPhone={contactAdmin?.phone || null}
                            />
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {cancelInfo.canCancel
                              ? `Can be cancelled for ${cancelInfo.minutesRemaining} more minute(s)`
                              : "Cancellation window passed. Please contact admin."}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden lg:block bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Oven</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Start</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">End</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Duration</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Temp</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Flap</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Purpose</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-700/20">
                      <td className="px-4 py-3">
                        <Link href={`/my-bookings/${booking.id}`} className="block hover:opacity-90">
                          <p className="text-sm font-medium text-white">{booking.oven.name}</p>
                          <p className="text-xs text-slate-400">
                            {booking.oven.type === "NON_AQUEOUS" ? "Non-Aqueous" : "Aqueous"}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {formatDateTimeWib(booking.startDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {formatDateTimeWib(booking.endDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {formatDuration(booking.startDate, booking.endDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {booking.usageTemp}°C
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {booking.flap}%
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300 max-w-[200px] truncate">
                        {booking.purpose}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyles[booking.status] || ""
                            }`}
                        >
                          {booking.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {booking.status === "ACTIVE" && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <EditBookingModal booking={booking} />
                              <CancelBookingButton
                                booking={booking}
                                contactPhone={contactAdmin?.phone || null}
                              />
                            </div>
                            {(() => {
                              const cancelInfo = getCancellationWindowInfo(booking.createdAt, 15);
                              return (
                                <p className="text-[11px] text-slate-500">
                                  {cancelInfo.canCancel
                                    ? `${cancelInfo.minutesRemaining}m left`
                                    : "Contact admin"}
                                </p>
                              );
                            })()}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
