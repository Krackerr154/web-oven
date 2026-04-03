"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Star } from "lucide-react";
import { UserActionButtons } from "./action-buttons";
import { RoleManagementButtons } from "./role-buttons";
import { BanUserButton } from "./ban-user-button";
import { EditUserModal } from "./edit-user-modal";
import { DeleteUserButton } from "./delete-user-button";

export function ClickableUserRow({ user, instruments, bansByUser, statusStyles }: any) {
    const router = useRouter();

    const handleRowClick = () => {
        router.push(`/admin/users/${user.id}`);
    };

    const preventNavigation = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <tr
            onClick={handleRowClick}
            className="hover:bg-slate-700/40 cursor-pointer transition-colors"
        >
            <td className="px-4 py-3 text-sm font-medium text-white">
                <div className="flex flex-col">
                    <span>{user.name}</span>
                    {user.nickname && (
                        <span className="text-xs text-orange-300/80 italic mt-0.5">"{user.nickname}"</span>
                    )}
                </div>
            </td>
            <td className="px-4 py-3 text-sm text-slate-300">{user.email}</td>
            <td className="px-4 py-3 text-sm text-slate-300">{user.phone}</td>
            <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                    {user.roles.map((role: string) => (
                        <span key={role} className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${role === "ADMIN"
                            ? "bg-purple-500/10 border-purple-500/20 text-purple-300"
                            : role === "CPD_ADMIN"
                                ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-300"
                                : "bg-slate-500/10 border-slate-500/20 text-slate-300"
                            }`}>
                            {role === "CPD_ADMIN" ? "CPD Admin" : role}
                        </span>
                    ))}
                </div>
                {user.isContactPerson && (
                    <div className="flex items-center gap-1 mt-1 text-amber-400">
                        <Star className="h-3 w-3 fill-current" />
                        <span className="text-[10px] font-medium uppercase tracking-wider">Contact</span>
                    </div>
                )}
            </td>
            <td className="px-4 py-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyles[user.status] || ""}`}>
                    {user.status}
                </span>
            </td>
            <td className="px-4 py-3 text-sm text-slate-300">
                {format(new Date(user.createdAt), "MMM d, yyyy")}
            </td>
            <td className="px-4 py-3 text-sm text-slate-300 text-center">
                {user._count.bookings}
            </td>

            {/* ACTIONS COLUMN: Stop propagation on click to avoid triggering row nav */}
            <td className="px-4 py-3 cursor-default" onClick={preventNavigation}>
                <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        {user.status === "PENDING" && (
                            <UserActionButtons userId={user.id} />
                        )}
                        <BanUserButton userId={user.id} instruments={instruments} activeBans={bansByUser[user.id] || []} />
                        <EditUserModal user={user} />
                        <DeleteUserButton userId={user.id} />
                    </div>

                    {user.status === "APPROVED" && (
                        <RoleManagementButtons
                            userId={user.id}
                            currentRoles={user.roles}
                            isContactPerson={user.isContactPerson}
                        />
                    )}

                    {(bansByUser[user.id] || []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {(bansByUser[user.id]).map((ban: any) => (
                                <span key={ban.id} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                                    🚫 {ban.instrumentType.replace(/_/g, " ")}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
}
