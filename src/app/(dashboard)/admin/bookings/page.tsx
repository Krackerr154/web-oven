import { getAllBookings } from "@/app/actions/admin";
import { autoCompleteBookings } from "@/app/actions/booking";
import { ListChecks } from "lucide-react";
import { prisma } from "@/lib/prisma";
import DashboardCalendar from "@/components/dashboard-calendar";
import { AdminBookingTable } from "./data-table";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  await autoCompleteBookings();
  const bookings = await getAllBookings();
  const ovens = await prisma.oven.findMany({ select: { id: true, name: true, type: true } });

  return (
    <div className="space-y-8 animate-fade-in relative z-0">
      <div>
        <h1 className="text-2xl font-bold text-white">Booking History</h1>
        <p className="text-slate-400 mt-1">Universal calendar and advanced record querying</p>
      </div>

      <div className="pb-4">
        <DashboardCalendar ovens={ovens} showAllStatuses={true} />
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
