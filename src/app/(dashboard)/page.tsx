import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Flame, Clock, User, AlertTriangle, CalendarPlus } from "lucide-react";
import { formatDateTimeWib, formatDateWib, formatMonthDayWib } from "@/lib/utils";
import Link from "next/link";
import DashboardCalendar from "@/components/dashboard-calendar";
import { OvenStatusCard } from "./oven-status-card";
import { autoCompleteBookings } from "@/app/actions/booking";
import { ProfileReminderBanner } from "@/components/profile-reminder-banner";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await autoCompleteBookings();
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

  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true, nickname: true, hasSeenTour: true }
    })
    : null;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">
          Welcome back, {session?.user?.name}
        </p>
      </div>

      {/* Profile Banner */}
      {currentUser && (
        <ProfileReminderBanner
          hasImage={!!currentUser.image}
          hasNickname={!!currentUser.nickname}
        />
      )}

      {/* Oven Status Cards */}
      <div id="tour-ovens" className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {ovens.map((oven) => (
          <OvenStatusCard key={oven.id} oven={oven as any} />
        ))}
      </div>

      {/* My Active Bookings */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Your Active Bookings ({userBookings.length}/1)
        </h2>
        {userBookings.length === 0 ? (
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center max-w-2xl mx-auto">
            <CalendarPlus className="h-10 w-10 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-300 font-medium mb-2">No active bookings</p>
            <p className="text-sm text-slate-400 mb-6">
              To start using the Lab Ovens, click the "Book an Oven" button below. Make sure you check the calendar for available slots first!
            </p>
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
            {userBookings.length < 1 && (
              <Link
                href="/book"
                className="rounded-xl border border-dashed border-slate-600 bg-slate-800/20 p-5 hover:bg-slate-800/60 hover:border-orange-500/50 transition-all flex flex-col items-center justify-center min-h-[120px] group"
              >
                <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center mb-2 group-hover:bg-orange-500/20 transition-colors">
                  <CalendarPlus className="h-5 w-5 text-orange-400" />
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-orange-300 transition-colors">
                  Book Another Oven
                </span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Booking Calendar Timeline */}
      <div id="tour-calendar" className="pt-4 border-t border-slate-700/50">
        <DashboardCalendar ovens={ovens.map(o => ({ id: o.id, name: o.name, type: o.type }))} />
      </div>
    </div>
  );
}
