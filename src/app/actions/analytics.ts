"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Fetch stats for reagent distribution (Available, Low, Out of Stock)
 */
export async function getReagentStats() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "ADMIN") return null;

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
        if (!session?.user || session.user.role !== "ADMIN") return null;

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
        if (!session?.user || session.user.role !== "ADMIN") return null;

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
