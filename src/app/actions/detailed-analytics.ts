"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function getDetailedAnalytics() {
    const session = await getServerSession(authOptions);
    const isAdmin =
        session?.user?.roles?.includes("ADMIN") ||
        session?.user?.email === "admin@g-labs.app";

    if (!isAdmin) {
        throw new Error("Unauthorized");
    }

    // 1. Per-User Cohort Data
    // Power Users (Top Users by successful bookings)
    const powerUsersRaw = await prisma.booking.groupBy({
        by: ['userId'],
        where: { status: 'COMPLETED' },
        _count: true,
        orderBy: {
            _count: { userId: 'desc' }
        },
        take: 5
    });

    const powerUserIds = powerUsersRaw.map(u => u.userId);
    const powerUserProfiles = await prisma.user.findMany({
        where: { id: { in: powerUserIds } },
        select: { id: true, name: true, email: true }
    });

    const powerUsers = powerUsersRaw.map(pu => ({
        user: powerUserProfiles.find(p => p.id === pu.userId)?.name || 'Unknown User',
        completedBookings: pu._count
    }));

    // Abandonment Users (Top Cancelled)
    const abandonmentRaw = await prisma.booking.groupBy({
        by: ['userId'],
        where: { status: { in: ['CANCELLED', 'AUTO_CANCELLED'] } },
        _count: true,
        orderBy: {
            _count: { userId: 'desc' }
        },
        take: 5
    });

    const abandonmentIds = abandonmentRaw.map(u => u.userId);
    const abandonmentProfiles = await prisma.user.findMany({
        where: { id: { in: abandonmentIds } },
        select: { id: true, name: true, email: true }
    });

    const abandonmentUsers = abandonmentRaw.map(au => ({
        user: abandonmentProfiles.find(p => p.id === au.userId)?.name || 'Unknown User',
        cancelledBookings: au._count
    }));

    // 2. Per-Instrument Friction Index
    // Total cancellations vs completions per instrument
    const instrumentBreakdownRaw = await prisma.booking.groupBy({
        by: ['instrumentId', 'status'],
        _count: true
    });

    const instruments = await prisma.instrument.findMany();

    const instrumentRecords: Record<number, { completed: number; cancelled: number; name: string }> = {};
    instruments.forEach(i => {
        instrumentRecords[i.id] = { completed: 0, cancelled: 0, name: i.name };
    });

    instrumentBreakdownRaw.forEach(item => {
        if (instrumentRecords[item.instrumentId]) {
            if (item.status === 'COMPLETED') {
                instrumentRecords[item.instrumentId].completed += item._count;
            } else if (item.status === 'CANCELLED' || item.status === 'AUTO_CANCELLED') {
                instrumentRecords[item.instrumentId].cancelled += item._count;
            }
        }
    });

    const frictionIndex = Object.values(instrumentRecords).map(ir => {
        const totalAssessed = ir.completed + ir.cancelled;
        const frictionPercentage = totalAssessed === 0 ? 0 : (ir.cancelled / totalAssessed) * 100;
        return {
            name: ir.name,
            frictionPercentage: Number(frictionPercentage.toFixed(1)),
            details: `${ir.cancelled}/${totalAssessed} cancelled`
        };
    }).sort((a, b) => b.frictionPercentage - a.frictionPercentage);

    // 3. Average Duration (Hours) per Instrument
    // Fetch a subset of completed bookings to calculate averages
    const completedBookings = await prisma.booking.findMany({
        where: { status: 'COMPLETED' },
        select: { instrumentId: true, startDate: true, endDate: true }
    });

    const durationTotals: Record<number, { totalMs: number; count: number }> = {};
    completedBookings.forEach(cb => {
        if (!durationTotals[cb.instrumentId]) {
            durationTotals[cb.instrumentId] = { totalMs: 0, count: 0 };
        }
        durationTotals[cb.instrumentId].totalMs += (cb.endDate.getTime() - cb.startDate.getTime());
        durationTotals[cb.instrumentId].count += 1;
    });

    const averageDurations = instruments.map(i => {
        const data = durationTotals[i.id];
        let avgHours = 0;
        if (data && data.count > 0) {
            avgHours = (data.totalMs / data.count) / (1000 * 60 * 60);
        }
        return {
            name: i.name,
            avgHours: Number(avgHours.toFixed(1))
        };
    }).filter(ad => ad.avgHours > 0);

    return {
        powerUsers,
        abandonmentUsers,
        frictionIndex,
        averageDurations
    };
}
