"use server";

import { prisma } from "@/lib/prisma";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Added by Local:
export async function getAdminAnalytics() {
    const session = await getServerSession(authOptions);

    const isAdmin =
        session?.user?.roles?.includes("ADMIN") ||
        session?.user?.email === "admin@g-labs.app";

    if (!isAdmin) throw new Error("Unauthorized");

    // 1. Users by Status
    const usersByStatusRaw = await prisma.user.groupBy({
        by: ['status'],
        _count: true
    });

    const usersOverview = { total: 0, pending: 0, approved: 0, rejected: 0 };

    usersByStatusRaw.forEach(item => {
        usersOverview.total += item._count;
        if (item.status === 'PENDING') usersOverview.pending = item._count;
        if (item.status === 'APPROVED') usersOverview.approved = item._count;
        if (item.status === 'REJECTED') usersOverview.rejected = item._count;
    });

    // 2. Bookings by Status
    const bookingsByStatusRaw = await prisma.booking.groupBy({
        by: ['status'],
        _count: true
    });

    const bookingsOverview = { total: 0, pending: 0, active: 0, completed: 0, cancelled: 0 };

    bookingsByStatusRaw.forEach(item => {
        bookingsOverview.total += item._count;
        if (item.status === 'PENDING_APPROVAL') bookingsOverview.pending = item._count;
        if (item.status === 'ACTIVE') bookingsOverview.active = item._count;
        if (item.status === 'COMPLETED') bookingsOverview.completed = item._count;
        if (item.status === 'CANCELLED' || item.status === 'AUTO_CANCELLED') bookingsOverview.cancelled += item._count;
    });

    // 3. Instrument Utilization (Booking Count per Instrument)
    const bookingsByInstrument = await prisma.booking.groupBy({
        by: ['instrumentId'],
        _count: true
    });

    const instruments = await prisma.instrument.findMany();
    const utilization = bookingsByInstrument.map((b) => {
        const inst = instruments.find((i) => i.id === b.instrumentId);
        return {
            name: inst?.name || 'Unknown',
            bookings: b._count
        };
    }).sort((a, b) => b.bookings - a.bookings);

    // 4. Booking Trends (Last 6 Months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentBookings = await prisma.booking.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true }
    });

    const trendsMap = recentBookings.reduce((acc: Record<string, number>, booking) => {
        const month = booking.createdAt.toLocaleString('default', { month: 'short', year: 'numeric' });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
    }, {});

    const deterministicTrends = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStr = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        deterministicTrends.push({
            month: monthStr,
            bookings: trendsMap[monthStr] || 0
        });
    }

    return { usersOverview, bookingsOverview, utilization, monthlyTrends: deterministicTrends };
}

/**
 * Fetch stats for reagent distribution (Available, Low, Out of Stock)
 */
export async function getReagentStats() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !session.user.roles.includes("ADMIN")) return null;

        const reagents = await prisma.reagent.groupBy({
            by: ['status'],
            _count: {
                id: true
            }
        });

        const data = reagents.map(r => ({
            name: r.status.replace(/_/g, " "),
            value: r._count.id
        }));

        const COLORS = {
            "AVAILABLE": "#10b981", // emerald
            "LOW": "#f59e0b", // amber
            "OUT OF STOCK": "#ef4444" // red
        };

        return data.map(d => ({
            ...d,
            fill: COLORS[d.name as keyof typeof COLORS] || "#64748b"
        }));
    } catch (e) {
        console.error(e);
        return null;
    }
}

/**
 * Fetch stats for top borrowed glassware
 */
export async function getGlasswareStats() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !session.user.roles.includes("ADMIN")) return null;

        // Find the top 5 most borrowed glassware by counting loans
        const loans = await prisma.glasswareLoan.groupBy({
            by: ['glasswareId'],
            _sum: {
                quantity: true
            },
            orderBy: {
                _sum: {
                    quantity: 'desc'
                }
            },
            take: 5
        });

        // Now fetch the actual glassware names
        const glasswareList = await prisma.glassware.findMany({
            where: {
                id: { in: loans.map(l => l.glasswareId) }
            },
            select: { id: true, name: true, size: true, unit: true }
        });

        return loans.map(l => {
            const gw = glasswareList.find(g => g.id === l.glasswareId);
            return {
                name: gw ? `${gw.name} ${gw.size}${gw.unit}` : "Unknown Item",
                borrowed: l._sum.quantity || 0
            };
        });

    } catch (e) {
        console.error(e);
        return null;
    }
}

/**
 * Fetch booking utilization (e.g., last 7 days)
 */
export async function getOvenUtilization() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !session.user.roles.includes("ADMIN")) return null;

        // For simplicity, we fetch bookings from the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const bookings = await prisma.booking.findMany({
            where: {
                startDate: {
                    gte: sevenDaysAgo
                },
                status: {
                    notIn: ["CANCELLED", "AUTO_CANCELLED"]
                },
                deletedAt: null
            },
            select: {
                startDate: true,
                instrumentId: true
            }
        });

        // Group by Date (YYYY-MM-DD)
        const counts: Record<string, number> = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            counts[dateStr] = 0;
        }

        bookings.forEach(b => {
            const dateStr = b.startDate.toISOString().split('T')[0];
            if (counts[dateStr] !== undefined) {
                counts[dateStr]++;
            }
        });

        return Object.entries(counts).map(([date, count]) => ({
            date: date.substring(5), // Make it "MM-DD"
            bookings: count
        }));

    } catch (e) {
        console.error(e);
        return null;
    }
}
