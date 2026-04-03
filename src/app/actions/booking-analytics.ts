"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function getBookingOperationsAnalytics() {
    const session = await getServerSession(authOptions);
    const isAdmin =
        session?.user?.roles?.includes("ADMIN") ||
        session?.user?.email === "admin@g-labs.app";

    if (!isAdmin) {
        throw new Error("Unauthorized");
    }

    // 1. Funnel (All Time or Last 30 Days)
    const funnelRaw = await prisma.booking.groupBy({
        by: ['status'],
        _count: true
    });

    const funnel = {
        pending: 0,
        active: 0,
        completed: 0,
        cancelled: 0,
        total: 0
    };

    funnelRaw.forEach(item => {
        funnel.total += item._count;
        if (item.status === 'PENDING_APPROVAL') funnel.pending = item._count;
        if (item.status === 'ACTIVE') funnel.active = item._count;
        if (item.status === 'COMPLETED') funnel.completed = item._count;
        if (item.status === 'CANCELLED' || item.status === 'AUTO_CANCELLED') funnel.cancelled += item._count;
    });

    // 2. Peak days based on start dates in the last 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const recentBookings = await prisma.booking.findMany({
        where: { startDate: { gte: sixtyDaysAgo } },
        select: { startDate: true }
    });

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];

    recentBookings.forEach(booking => {
        const dayIndex = booking.startDate.getDay();
        dayCounts[dayIndex]++;
    });

    const peakDays = daysOfWeek.map((day, index) => ({
        name: day,
        count: dayCounts[index]
    }));

    // 3. Auto vs Manual Cancellations (Lifetime)
    const cancellations = await prisma.booking.findMany({
        where: { status: { in: ['CANCELLED', 'AUTO_CANCELLED'] } },
        select: { status: true, cancelReason: true }
    });

    let autoCancelled = 0;
    let manualCancelled = 0;

    cancellations.forEach(c => {
        if (c.status === 'AUTO_CANCELLED') autoCancelled++;
        else manualCancelled++;
    });

    return { funnel, peakDays, cancelStats: { auto: autoCancelled, manual: manualCancelled, total: autoCancelled + manualCancelled } };
}
