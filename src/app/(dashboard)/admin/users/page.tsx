import { getAllUsers } from "@/app/actions/admin";
import { format } from "date-fns";
import { UserActionButtons } from "./action-buttons";

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

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
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
                    {user.status === "PENDING" && (
                      <UserActionButtons userId={user.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
