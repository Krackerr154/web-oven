import { getAllUsers } from "@/app/actions/admin";
import { format } from "date-fns";
import { UserActionButtons } from "./action-buttons";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await getAllUsers();

  const statusStyles: Record<string, string> = {
    PENDING: "bg-amber-500/20 text-amber-300",
    APPROVED: "bg-emerald-500/20 text-emerald-300",
    REJECTED: "bg-red-500/20 text-red-300",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-slate-400 mt-1">Approve or reject user registrations</p>
      </div>

      {users.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <p className="text-slate-400">No users found</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card layout */}
          <div className="lg:hidden space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{user.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${
                      statusStyles[user.status] || ""
                    }`}
                  >
                    {user.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="text-slate-300">{user.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Role</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      user.role === "ADMIN"
                        ? "bg-purple-500/20 text-purple-300"
                        : "bg-slate-500/20 text-slate-300"
                    }`}>
                      {user.role}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Registered</p>
                    <p className="text-slate-300">
                      {format(new Date(user.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Bookings</p>
                    <p className="text-slate-300">{user._count.bookings}</p>
                  </div>
                </div>
                {user.status === "PENDING" && (
                  <div className="pt-2 border-t border-slate-700/50">
                    <UserActionButtons userId={user.id} />
                  </div>
                )}
                <div className="pt-1">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-xs text-orange-300 hover:text-orange-200"
                  >
                    View 6-month booking stats
                  </Link>
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
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Name</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Email</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Phone</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Role</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Registered</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Bookings</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-700/20">
                      <td className="px-4 py-3 text-sm font-medium text-white">{user.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{user.email}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{user.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          user.role === "ADMIN"
                            ? "bg-purple-500/20 text-purple-300"
                            : "bg-slate-500/20 text-slate-300"
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          statusStyles[user.status] || ""
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {format(new Date(user.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300 text-center">
                        {user._count.bookings}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {user.status === "PENDING" && (
                            <UserActionButtons userId={user.id} />
                          )}
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="text-xs text-orange-300 hover:text-orange-200"
                          >
                            Stats
                          </Link>
                        </div>
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
