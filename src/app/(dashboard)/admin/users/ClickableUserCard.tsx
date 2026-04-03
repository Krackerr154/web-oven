"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Star } from "lucide-react";
import { UserActionButtons } from "./action-buttons";
import { RoleManagementButtons } from "./role-buttons";
import { BanUserButton } from "./ban-user-button";
import { EditUserModal } from "./edit-user-modal";
import { DeleteUserButton } from "./delete-user-button";

export function ClickableUserCard({ user, instruments, bansByUser, statusStyles }: any) {
    const router = useRouter();

    const handleCardClick = () => {
        router.push(`/admin/users/${user.id}`);
    };

    const preventNavigation = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <div
            onClick={handleCardClick}
            className="bg-slate-900/50 backdrop-blur-md shadow border border-slate-700/50 rounded-2xl p-5 space-y-4 hover:bg-slate-800/60 cursor-pointer transition-colors"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="font-medium text-white truncate">{user.name}</p>
                    {user.nickname && (
                        <p className="text-xs text-orange-300/80 italic mb-0.5 truncate">"{user.nickname}"</p>
                    )}
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                </div>
                <span
                    className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusStyles[user.status] || ""}`}
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
                    <div className="flex flex-wrap gap-1 mt-1">
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

            {/* ACTION CORNER: Stop propagation so card isn't triggered */}
            <div onClick={preventNavigation} className="cursor-default">
                {user.status === "PENDING" && (
                    <div className="pt-2 border-t border-slate-700/50">
                        <UserActionButtons userId={user.id} />
                    </div>
                )}
                {user.status === "APPROVED" && (
                    <RoleManagementButtons
                        userId={user.id}
                        currentRoles={user.roles}
                        isContactPerson={user.isContactPerson}
                    />
                )}
                <div className="pt-2 mt-2 border-t border-slate-700/50 flex items-center justify-end">
                    <div className="flex items-center gap-1">
                        <BanUserButton userId={user.id} instruments={instruments} activeBans={bansByUser[user.id] || []} />
                        <EditUserModal user={user} />
                        <DeleteUserButton userId={user.id} />
                    </div>
                </div>
            </div>

            {(bansByUser[user.id] || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {(bansByUser[user.id]).map((ban: any) => (
                        <span key={ban.id} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                            🚫 {ban.instrument.name}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
