import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Flame, Clock, User, AlertTriangle, CalendarPlus } from "lucide-react";
import { formatDateTimeWib, formatDateWib, formatMonthDayWib } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  const ovens = await prisma.oven.findMany({
    include: {
      bookings: {
        where: {
          status: "ACTIVE",
          deletedAt: null,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
        include: {
          user: { select: { name: true } },
        },
        take: 1,
      },
    },
  });

  const userBookings = session?.user?.id
    ? await prisma.booking.findMany({
      where: { userId: session.user.id, status: "ACTIVE", deletedAt: null },
      include: { oven: { select: { name: true, type: true } } },
      orderBy: { startDate: "asc" },
    })
    : [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">
          Welcome back, {session?.user?.name}
        </p>
      </div>

      {/* Oven Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {ovens.map((oven) => {
          const currentBooking = oven.bookings[0];
          const isMaintenance = oven.status === "MAINTENANCE";
          const isInUse = !!currentBooking;

          let statusColor = "bg-emerald-500/20 border-emerald-500/30";
          let statusText = "Available";
          let statusDot = "bg-emerald-400";

          if (isMaintenance) {
            statusColor = "bg-amber-500/20 border-amber-500/30";
            statusText = "Maintenance";
            statusDot = "bg-amber-400";
          } else if (isInUse) {
            statusColor = "bg-red-500/20 border-red-500/30";
            statusText = "In Use";
            statusDot = "bg-red-400";
          }

          return (
            <div
              key={oven.id}
              className={`rounded-xl border p-6 hover-lift ${statusColor}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-800">
                    {isMaintenance ? (
                      <AlertTriangle className="h-6 w-6 text-amber-400" />
                    ) : (
                      <Flame className="h-6 w-6 text-orange-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {oven.name}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {oven.type === "NON_AQUEOUS" ? "Non-Aqueous" : "Aqueous"}
                      {" \u00b7 Max "}{oven.maxTemp}{"\u00b0C"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${statusDot} animate-pulse`} role="status" aria-label={`Status: ${statusText}`} />
                  <span className="text-sm font-medium text-slate-200">
                    {statusText}
                  </span>
                </div>
              </div>

              {currentBooking && (
                <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <User className="h-4 w-4" />
                    <span>{currentBooking.user.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Clock className="h-4 w-4" />
                    <span>
                      Until {formatDateTimeWib(currentBooking.endDate)}
                    </span>
                  </div>
                </div>
              )}

              {!currentBooking && !isMaintenance && (
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <p className="text-sm text-emerald-300">
                    Ready for booking
                  </p>
                </div>
              )}

              {isMaintenance && (
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <p className="text-sm text-amber-300">
                    Temporarily unavailable
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* My Active Bookings */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Your Active Bookings ({userBookings.length}/2)
        </h2>
        {userBookings.length === 0 ? (
          <div className="rounded-xl border border-slate-700 p-8 text-center">
            <CalendarPlus className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 mb-3">No active bookings</p>
            <Link
              href="/book"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors"
            >
              <CalendarPlus className="h-4 w-4" />
              Book an Oven
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {userBookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/my-bookings/${booking.id}`}
                className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 hover-lift"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-white">{booking.oven.name}</h3>
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                    Active
                  </span>
                </div>
                <div className="space-y-1 text-sm text-slate-400">
                  <p>
                    {formatMonthDayWib(booking.startDate)} — {formatDateWib(booking.endDate)}
                  </p>
                  <p className="truncate">{booking.purpose}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
