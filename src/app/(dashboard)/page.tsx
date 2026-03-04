import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CalendarPlus, Beaker, Search, Users, ArrowRight, Waves, Package, ThermometerSun, CalendarClock } from "lucide-react";
import { formatDateWib, formatMonthDayWib } from "@/lib/utils";
import Link from "next/link";
import { autoCompleteBookings } from "@/app/actions/booking";
import { ProfileReminderBanner } from "@/components/profile-reminder-banner";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await autoCompleteBookings();
  const session = await getServerSession(authOptions);

  const userBookings = session?.user?.id
    ? await prisma.booking.findMany({
      where: { userId: session.user.id, status: "ACTIVE", deletedAt: null },
      include: { instrument: { select: { name: true, type: true } } },
      orderBy: { startDate: "asc" },
    })
    : [];

  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true, nickname: true, hasSeenTour: true, role: true }
    })
    : null;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">AP Lab Dashboard</h1>
        <p className="text-slate-400 mt-2 text-lg">
          Welcome back, {session?.user?.name}. What would you like to do today?
        </p>
      </div>

      {/* Profile Banner */}
      {currentUser && (
        <ProfileReminderBanner
          hasImage={!!currentUser.image}
          hasNickname={!!currentUser.nickname}
        />
      )}

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link id="tour-instruments-card" href="/instruments" className="group relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/50 p-6 transition-all hover:bg-slate-800 hover:shadow-lg hover:shadow-blue-500/10">
          <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl transition-all group-hover:bg-blue-500/20" />
          <div className="relative flex items-center justify-between">
            <div className="rounded-xl bg-blue-500/20 p-3 text-blue-400">
              <Beaker className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
          </div>
          <div className="mt-6">
            <h3 className="text-xl font-semibold text-white">Instruments</h3>
            <p className="mt-2 text-sm text-slate-400">
              Book and manage usage for the Oven, Ultrasonic Bath, and Glovebox.
            </p>
          </div>
        </Link>

        <Link id="tour-reagents-card" href="/reagents" className="group relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/50 p-6 transition-all hover:bg-slate-800 hover:shadow-lg hover:shadow-emerald-500/10">
          <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl transition-all group-hover:bg-emerald-500/20" />
          <div className="relative flex items-center justify-between">
            <div className="rounded-xl bg-emerald-500/20 p-3 text-emerald-400">
              <Search className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
          </div>
          <div className="mt-6">
            <h3 className="text-xl font-semibold text-white">Reagents Inventory</h3>
            <p className="mt-2 text-sm text-slate-400">
              Search the lab inventory and check availability of chemicals.
            </p>
          </div>
        </Link>

        {currentUser?.role === "ADMIN" ? (
          <Link href="/admin/glassware" className="group relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/50 p-6 transition-all hover:bg-slate-800 hover:shadow-lg hover:shadow-purple-500/10">
            <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-purple-500/10 blur-2xl transition-all group-hover:bg-purple-500/20" />
            <div className="relative flex items-center justify-between">
              <div className="rounded-xl bg-purple-500/20 p-3 text-purple-400">
                <Beaker className="h-6 w-6" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
            </div>
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-white">Lab Glassware</h3>
              <p className="mt-2 text-sm text-slate-400">
                Search the lab glassware inventory and log new items.
              </p>
            </div>
          </Link>
        ) : (
          <Link href="/profile" className="group relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/50 p-6 transition-all hover:bg-slate-800 hover:shadow-lg hover:shadow-purple-500/10">
            <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-purple-500/10 blur-2xl transition-all group-hover:bg-purple-500/20" />
            <div className="relative flex items-center justify-between">
              <div className="rounded-xl bg-purple-500/20 p-3 text-purple-400">
                <Users className="h-6 w-6" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
            </div>
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-white">My Profile</h3>
              <p className="mt-2 text-sm text-slate-400">
                Update your account details, supervisor information, and preferences.
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* My Active Bookings */}
      <div className="pt-6 border-t border-slate-700/50">
        <h2 id="tour-active-bookings" className="text-xl font-semibold text-white mb-6">
          Your Active Bookings
        </h2>
        {userBookings.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-10 text-center mx-auto">
            <CalendarPlus className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-300 font-medium mb-2">No active bookings</p>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              You don't have any ongoing or upcoming instrument usage. Click below to schedule time on an instrument.
            </p>
            <Link
              href="/instruments"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
            >
              <CalendarPlus className="h-4 w-4" />
              Book Instrument
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 xl:gap-6">
            {userBookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/my-bookings/${booking.id}`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-800/40 to-slate-900/40 p-5 hover:border-slate-600 hover:shadow-xl hover:shadow-blue-900/10 transition-all duration-300 block"
              >
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                  <div className="bg-slate-700/50 p-1.5 rounded-full text-white">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>

                {/* Top Section */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex gap-4">
                    <div className={`p-3 rounded-xl transition-colors ${booking.instrument.type === 'OVEN' ? 'bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20' :
                      booking.instrument.type === 'ULTRASONIC_BATH' ? 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20' :
                        booking.instrument.type === 'GLOVEBOX' ? 'bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20' :
                          'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20'
                      }`}>
                      {booking.instrument.type === 'OVEN' ? <ThermometerSun className="h-6 w-6" /> :
                        booking.instrument.type === 'ULTRASONIC_BATH' ? <Waves className="h-6 w-6" /> :
                          booking.instrument.type === 'GLOVEBOX' ? <Package className="h-6 w-6" /> :
                            <Beaker className="h-6 w-6" />
                      }
                    </div>
                    <div>
                      <h3 className="font-semibold text-white tracking-wide text-lg">{booking.instrument.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold tracking-wide text-emerald-400 bg-emerald-500/10 w-fit px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-inner">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        ACTIVE
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 text-sm text-slate-300 bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/50">
                    <CalendarClock className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{formatMonthDayWib(booking.startDate)} — {formatDateWib(booking.endDate)}</span>
                  </div>

                  <div className="pl-3 border-l-2 border-slate-700/50">
                    <p className="text-sm text-slate-400 line-clamp-2 italic">"{booking.purpose}"</p>
                  </div>
                </div>
              </Link>
            ))}
            <Link
              href="/instruments"
              className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/20 p-5 hover:bg-slate-800/60 hover:border-blue-500/50 transition-all flex flex-col items-center justify-center min-h-[160px] group block"
            >
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-3 group-hover:bg-blue-500/20 group-hover:scale-110 transition-all duration-300">
                <CalendarPlus className="h-6 w-6 text-blue-400" />
              </div>
              <span className="text-sm font-medium text-slate-300 group-hover:text-blue-300 transition-colors">
                New Booking
              </span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
