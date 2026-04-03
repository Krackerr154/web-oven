"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function getAdminAnalytics() {
    const session = await getServerSession(authOptions);

    // We allow either raw ADMIN role representation or verifying through roles array based on setup
    // Since db has 'roles Role[]', session might have 'roles' or 'role' depending on next-auth config
    const isAdmin =
        session?.user?.roles?.includes("ADMIN") ||
        session?.user?.email === "admin@g-labs.app"; // Fallback admin 

    if (!isAdmin) {
        throw new Error("Unauthorized");
    }

    // 1. Users by Status
    const usersByStatusRaw = await prisma.user.groupBy({
        by: ['status'],
        _count: true
    });

    const usersOverview = {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0
    };

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

    const bookingsOverview = {
        total: 0,
        pending: 0,
        active: 0,
        completed: 0,
        cancelled: 0
    };

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

    const monthlyTrends = Object.entries(trendsMap).map(([month, bookings]) => ({
        month,
        bookings
    }));

    // Ensure chronological order could be improved by using actual Date parsing, but for UI graph this map usually works if ordered.
    // Actually reduce doesn't guarantee order if Object.entries is used. Let's build it deterministically.
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

    return {
        usersOverview,
        bookingsOverview,
        utilization,
        monthlyTrends: deterministicTrends
    };
}
