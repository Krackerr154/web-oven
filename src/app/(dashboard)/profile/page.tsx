import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Activity, CalendarDays, CheckCircle, XCircle } from "lucide-react";
import { ProfileEditor } from "@/components/profile-editor";
import { TelegramConnect } from "@/components/telegram-connect";
import { WhatsappConnect } from "@/components/whatsapp-connect";
import { lumaWhatsappNumber, resolveWhatsappLink, whatsappDeepLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        redirect("/login");
    }

    // Fetch user details, bookings, and the WhatsApp link attempt.
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            bookings: {
                where: { deletedAt: null },
            },
            whatsappLink: {
                select: {
                    status: true,
                    phone: true,
                    requestId: true,
                    createdAt: true,
                    verifiedAt: true,
                    lastError: true,
                },
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
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">My Profile</h1>
                <p className="text-slate-400 mt-1">Manage your account information and view your booking activity.</p>
            </div>

            {/*
              Two balanced regions instead of three cards crammed into a 1/3
              column next to two short rows in a 2/3 column — that mismatch was
              what left the void on the right. Left holds the tall identity form;
              right stacks both LUMA connections, which ends at a similar height.
            */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5">
                    {/* telegramUserId is a BigInt; stringify before crossing into
                        a client component so neither the editor nor the RSC
                        serializer has to carry it. */}
                    <ProfileEditor
                        user={{
                            ...user,
                            telegramUserId: user.telegramUserId?.toString() ?? null,
                        } as any}
                    />
                </div>

                <div className="lg:col-span-7 space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">LUMA connections</h2>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Link a chat account so LUMA recognises you instead of asking who you are.
                        </p>
                    </div>
                    <TelegramConnect
                        initial={{
                            telegramUserId: user.telegramUserId?.toString() ?? null,
                            telegramUsername: user.telegramUsername ?? null,
                            telegramLinkedAt: user.telegramLinkedAt?.toISOString() ?? null,
                        }}
                    />
                    <WhatsappConnect
                        initial={resolveWhatsappLink({
                            configured: lumaWhatsappNumber() !== null,
                            status: user.whatsappLink?.status ?? null,
                            phone: user.whatsappLink?.phone ?? null,
                            requestId: user.whatsappLink?.requestId ?? null,
                            createdAt: user.whatsappLink?.createdAt ?? null,
                            verifiedAt: user.whatsappLink?.verifiedAt ?? null,
                            lastError: user.whatsappLink?.lastError ?? null,
                        })}
                        deepLink={whatsappDeepLink()}
                    />
                </div>
            </div>

            {/*
              Full-width row: four counters on one line at desktop. Kept out of a
              half-column so it can never run short against the taller neighbour.
            */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">Booking Activity</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat, i) => (
                        <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex items-center gap-4 hover:bg-slate-800 transition-colors">
                            <div className={`p-3 rounded-lg shrink-0 ${stat.bg}`}>
                                <stat.icon className={`h-6 w-6 ${stat.color}`} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-3xl font-bold text-white leading-none">{stat.value}</p>
                                <p className="text-sm text-slate-400 mt-1.5 font-medium truncate">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="bg-orange-500/10 p-3 rounded-full shrink-0">
                        <CalendarDays className="h-6 w-6 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium">Need to book an instrument?</h3>
                        <p className="text-slate-400 text-sm">
                            Check availability and schedule your next session online.
                        </p>
                    </div>
                    <a
                        href="/book"
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors shrink-0"
                    >
                        Book Now
                    </a>
                </div>
            </div>
        </div>
    );
}
