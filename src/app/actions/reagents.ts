"use server";

import { fetchReagents, Reagent } from "@/lib/sheets";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Fuse from "fuse.js";

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

        // Configure Fuse.js for fuzzy-searching
        const fuse = new Fuse(reagents, {
            keys: [
                { name: 'name', weight: 1.0 },
                { name: 'searchTags', weight: 0.8 },
                { name: 'brand', weight: 0.5 },
                { name: 'id', weight: 0.3 }
            ],
            // Lower threshold = stricter match. 0.3-0.4 is good for typo tolerance.
            threshold: 0.4,
            distance: 100, // How close the match must be to the exact string
            ignoreLocation: true, // Find the match anywhere in the string
        });

        // Search and map back to the original Reagent objects
        const results = fuse.search(trimmedQuery);
        const filtered = results.map(result => result.item);

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
