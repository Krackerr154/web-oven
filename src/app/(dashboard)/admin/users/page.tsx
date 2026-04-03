import { getAllUsers } from "@/app/actions/admin";
import { format } from "date-fns";
import { UserActionButtons } from "./action-buttons";
import Link from "next/link";
import { AddUserModal } from "./add-user-modal";
import { RoleManagementButtons } from "./role-buttons";
import { Users, Star } from "lucide-react";
import { EditUserModal } from "./edit-user-modal";
import { DeleteUserButton } from "./delete-user-button";
import { BanUserButton } from "./ban-user-button";
import { prisma } from "@/lib/prisma";
import { ClickableUserCard } from "./ClickableUserCard";
import { ClickableUserRow } from "./ClickableUserRow";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [users, instruments, bans] = await Promise.all([
    getAllUsers(),
    prisma.instrument.findMany({ select: { id: true, name: true, type: true } }),
    prisma.instrumentBan.findMany({
      where: { isActive: true },
      include: {
        bannedBy: { select: { name: true } },
      },
    }),
  ]);

  const bansByUser = bans.reduce((acc, ban) => {
    if (!acc[ban.userId]) acc[ban.userId] = [];
    acc[ban.userId].push(ban as any);
    return acc;
  }, {} as Record<string, any[]>);

  const statusStyles: Record<string, string> = {
    PENDING: "bg-amber-500/10 border border-amber-500/20 text-amber-300",
    APPROVED: "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300",
    REJECTED: "bg-red-500/10 border border-red-500/20 text-red-300",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-slate-400 mt-1">Approve or reject user registrations</p>
        </div>
        <AddUserModal />
      </div>

      {users.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <Users className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No users found</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card layout */}
          <div className="lg:hidden space-y-4">
            {users.map((user: any) => (
              <ClickableUserCard
                key={user.id}
                user={user}
                instruments={instruments}
                bansByUser={bansByUser}
                statusStyles={statusStyles}
              />
            ))}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden lg:block bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-800/40">
                  <tr className="border-b border-slate-700/50">
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
                  {users.map((user: any) => (
                    <ClickableUserRow
                      key={user.id}
                      user={user}
                      instruments={instruments}
                      bansByUser={bansByUser}
                      statusStyles={statusStyles}
                    />
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
