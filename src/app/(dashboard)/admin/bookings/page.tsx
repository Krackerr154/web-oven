import { getAllBookings } from "@/app/actions/admin";
import { format } from "date-fns";
import { formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const bookings = await getAllBookings();

  const statusStyles: Record<string, string> = {
    ACTIVE: "bg-blue-500/20 text-blue-300",
    COMPLETED: "bg-emerald-500/20 text-emerald-300",
    CANCELLED: "bg-slate-500/20 text-slate-300",
    AUTO_CANCELLED: "bg-amber-500/20 text-amber-300",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">All Bookings</h1>
        <p className="text-slate-400 mt-1">Overview of all oven bookings</p>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <p className="text-slate-400">No bookings found</p>
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
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{booking.user.name}</p>
                    <p className="text-xs text-slate-400">{booking.user.email}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${
                      statusStyles[booking.status] || ""
                    }`}
                  >
                    {booking.status.replace("_", " ")}
                  </span>
                </div>
                <div className="text-sm">
                  <p className="text-xs text-slate-500">Oven</p>
                  <p className="text-slate-300">
                    {booking.oven.name}{" "}
                    <span className="text-xs text-slate-500">
                      ({booking.oven.type === "NON_AQUEOUS" ? "Non-Aqueous" : "Aqueous"})
                    </span>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Start</p>
                    <p className="text-slate-300">
                      {format(new Date(booking.startDate), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">End</p>
                    <p className="text-slate-300">
                      {format(new Date(booking.endDate), "MMM d, yyyy HH:mm")}
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
              </div>
            ))}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden lg:block bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">User</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Oven</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Start</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">End</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Duration</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Temp</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Flap</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Purpose</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-700/20">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-white">{booking.user.name}</p>
                        <p className="text-xs text-slate-400">{booking.user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-white">{booking.oven.name}</p>
                        <p className="text-xs text-slate-400">
                          {booking.oven.type === "NON_AQUEOUS" ? "Non-Aqueous" : "Aqueous"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {format(new Date(booking.startDate), "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {format(new Date(booking.endDate), "MMM d, yyyy HH:mm")}
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
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          statusStyles[booking.status] || ""
                        }`}>
                          {booking.status.replace("_", " ")}
                        </span>
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
