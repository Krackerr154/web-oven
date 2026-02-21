import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { User, Phone, Mail, Shield, Activity, CalendarDays, CheckCircle, XCircle, Clock } from "lucide-react";
import { formatDateTimeWib } from "@/lib/utils";
import { ProfileEditor } from "@/components/profile-editor";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        redirect("/login");
    }

    // Fetch user details and bookings
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            bookings: {
                where: { deletedAt: null },
            },
        },
    });

    if (!user) {
        redirect("/login");
    }

    // Calculate booking stats
    const totalBookings = user.bookings.length;
    const activeBookings = user.bookings.filter((b) => b.status === "ACTIVE").length;
    const completedBookings = user.bookings.filter((b) => b.status === "COMPLETED").length;
    const cancelledBookings = user.bookings.filter(
        (b) => b.status === "CANCELLED" || b.status === "AUTO_CANCELLED"
    ).length;

    const stats = [
        { label: "Total Bookings", value: totalBookings, icon: CalendarDays, color: "text-blue-400", bg: "bg-blue-500/20" },
        { label: "Active", value: activeBookings, icon: Activity, color: "text-orange-400", bg: "bg-orange-500/20" },
        { label: "Completed", value: completedBookings, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/20" },
        { label: "Cancelled", value: cancelledBookings, icon: XCircle, color: "text-slate-400", bg: "bg-slate-500/20" },
    ];

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">My Profile</h1>
                <p className="text-slate-400 mt-1">Manage your account information and view your booking activity.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Account Details */}
                <div className="md:col-span-1 space-y-6">
                    <ProfileEditor user={user as any} />
                </div>

                {/* Statistics & Activity Summary */}
                <div className="md:col-span-2 space-y-6">
                    <h2 className="text-lg font-semibold text-white">Booking Activity</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {stats.map((stat, i) => (
                            <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex items-start gap-4 hover:bg-slate-800 transition-colors">
                                <div className={`p-3 rounded-lg shrink-0 ${stat.bg}`}>
                                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-white leading-none">{stat.value}</p>
                                    <p className="text-sm text-slate-400 mt-2 font-medium">{stat.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mt-6 flex flex-col items-center justify-center text-center gap-3">
                        <div className="bg-orange-500/10 p-4 rounded-full">
                            <CalendarDays className="h-8 w-8 text-orange-400" />
                        </div>
                        <h3 className="text-white font-medium">Need to book an oven?</h3>
                        <p className="text-slate-400 text-sm max-w-sm mb-2">Check availability and schedule your next session online.</p>
                        <a href="/book" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors">
                            Book Now
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
