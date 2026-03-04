"use server";

import { fetchReagents, Reagent } from "@/lib/sheets";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Normalizes text for search (lowercase, removes extra spaces)
 */
function normalizeText(text: string): string {
    return (text || "").toLowerCase().trim();
}

/**
 * Search reagents for regular users.
 * Requires an active session.
 */
export async function searchReagents(query: string): Promise<{ success: boolean; data?: Reagent[]; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, message: "Unauthorized" };
        }

        const trimmedQuery = normalizeText(query);
        const reagents = await fetchReagents();

        if (!trimmedQuery) {
            // Empty query = return nothing for standard users to prevent browsing
            return { success: true, data: [] };
        }

        // Filter reagents based on generic matching (ID, Name, or Brand)
        const filtered = reagents.filter((r) => {
            const matchId = normalizeText(r.id).includes(trimmedQuery);
            const matchName = normalizeText(r.name).includes(trimmedQuery);
            const matchBrand = normalizeText(r.brand).includes(trimmedQuery);
            return matchId || matchName || matchBrand;
        });

        return { success: true, data: filtered };
    } catch (error) {
        console.error("Error searching reagents:", error);
        return { success: false, message: "Internal server error" };
    }
}

/**
 * Get all reagents for administrators.
 * Requires an active ADMIN session.
 */
export async function getAllReagents(): Promise<{ success: boolean; data?: Reagent[]; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "ADMIN") {
            return { success: false, message: "Unauthorized. Admin access required." };
        }

        const reagents = await fetchReagents();
        return { success: true, data: reagents };
    } catch (error) {
        console.error("Error fetching all reagents:", error);
        return { success: false, message: "Internal server error" };
    }
}
