import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { format } from "date-fns";
import { CancelBookingButton } from "./cancel-button";

export const dynamic = "force-dynamic";

export default async function MyBookingsPage() {
  const session = await getServerSession(authOptions);

  const bookings = await prisma.booking.findMany({
    where: { userId: session?.user?.id },
    include: {
      oven: { select: { name: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const statusStyles: Record<string, string> = {
    ACTIVE: "bg-blue-500/20 text-blue-300",
    COMPLETED: "bg-emerald-500/20 text-emerald-300",
    CANCELLED: "bg-slate-500/20 text-slate-300",
    AUTO_CANCELLED: "bg-amber-500/20 text-amber-300",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Bookings</h1>
        <p className="text-slate-400 mt-1">View and manage your oven bookings</p>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <p className="text-slate-400">No bookings yet</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Oven</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Start</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">End</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Purpose</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-700/20">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{booking.oven.name}</p>
                        <p className="text-xs text-slate-400">
                          {booking.oven.type === "NON_AQUEOUS" ? "Non-Aqueous" : "Aqueous"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {format(new Date(booking.startDate), "MMM d, yyyy HH:mm")}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {format(new Date(booking.endDate), "MMM d, yyyy HH:mm")}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 max-w-[200px] truncate">
                      {booking.purpose}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          statusStyles[booking.status] || ""
                        }`}
                      >
                        {booking.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {booking.status === "ACTIVE" && (
                        <CancelBookingButton bookingId={booking.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
