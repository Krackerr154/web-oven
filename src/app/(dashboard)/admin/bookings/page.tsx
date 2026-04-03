import { getAllBookings } from "@/app/actions/admin";
import { autoCompleteBookings } from "@/app/actions/booking";
import { ListChecks } from "lucide-react";
import { prisma } from "@/lib/prisma";
import DashboardCalendar from "@/components/dashboard-calendar";
import { AdminBookingTable } from "./data-table";
import { getBookingOperationsAnalytics } from "@/app/actions/booking-analytics";
import { BookingOperationsDashboard } from "@/components/analytics/BookingOperationsDashboard";
import Link from "next/link";
import { Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  await autoCompleteBookings();
  const bookings = await getAllBookings();
  const instruments = await prisma.instrument.findMany({ select: { id: true, name: true, type: true, category: true } });

  const analyticsData = await getBookingOperationsAnalytics();

  return (
    <div className="space-y-8 animate-fade-in relative z-0 pb-12">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white">Booking Management</h1>
          <p className="text-slate-400 mt-1">Operational analytics, universal calendar, and advanced historical querying</p>
        </div>
        <Link href="/admin/analytics/detailed" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Deep Dive Analytics
        </Link>
      </div>

      <BookingOperationsDashboard data={analyticsData} />

      <div className="pb-4">
        <DashboardCalendar instruments={instruments} showAllStatuses={true} />
      </div>

      <div className="pt-6 border-t border-slate-700/50">
        <h2 className="text-xl font-bold text-white mb-4">Historical Data Table</h2>
        {bookings.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
            <ListChecks className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No bookings found</p>
          </div>
        ) : (
          <AdminBookingTable bookings={bookings as any[]} />
        )}
      </div>
    </div>
  );
}
