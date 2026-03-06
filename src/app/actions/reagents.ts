"use server";

import { fetchReagents, Reagent, getSynonyms } from "@/lib/sheets";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Fuse from "fuse.js";

/**
 * Normalizes text for search (lowercase, removes extra spaces)
 */
function normalizeText(text: string): string {
    return (text || "").toLowerCase().trim();
}

/**
 * Fetches synonyms from the public PubChem API
 * Exposed to client for live-typing debounced fetching
 */
export async function fetchPubChemSynonyms(name: string): Promise<string> {
    try {
        const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name.trim())}/synonyms/JSON`;

        // PubChem strictly requires a valid User-Agent, and adding Next.js cache helps prevent rate limits
        const res = await fetch(url, {
            signal: AbortSignal.timeout(8000), // Increased to 8 seconds
            headers: {
                "Accept": "application/json",
                "User-Agent": "APLab-Inventory-App/1.0 (mailto:admin@example.com)"
            },
            next: { revalidate: 86400 } // Cache results for 24 hours to aggressively avoid rate-limiting
        });

        if (!res.ok) return ""; // Likely not found (404) or rate limited

        const data = await res.json();
        const synonymsList = data?.InformationList?.Information?.[0]?.Synonym || [];

        // Take the top 10 synonyms and join them
        return synonymsList.slice(0, 10).join(", ");
    } catch (error: any) {
        // Silently ignore timeout errors (AbortError/TimeoutError) as PubChem frequently rate-limits
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            return "";
        }
        console.error(`PubChem fetch error for ${name}:`, error.message || error);
        return "";
    }
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

        // 1. Fetch Google Sheets remote reagents
        const sheetReagents = await fetchReagents();

        // 2. Fetch local Database reagents (both lab owned and user owned)
        const dbReagentsRaw = await prisma.reagent.findMany({
            include: {
                owner: {
                    select: {
                        name: true,
                        phone: true
                    }
                }
            }
        });

        // 3. Map DB Reagents to our standard interface
        const dbReagents: Reagent[] = dbReagentsRaw.map(r => ({
            id: r.customId || r.id,
            name: r.name,
            brand: r.brand || "",
            catalogNo: r.casNumber || "",
            arrivalDate: r.arrivalDate || r.createdAt.toISOString().split('T')[0],
            size: r.size || r.quantity,
            unit: r.unit || "",
            notes: [r.condition, r.notes].filter(Boolean).join(" - "),
            location: r.location || "",
            searchTags: getSynonyms(r.name) + " " + getSynonyms(r.brand || "") + " " + (r.synonyms || ""),
            ownershipType: r.ownerId ? "USER" : "LAB",
            ownerContact: r.owner ? {
                name: r.owner.name,
                phone: r.owner.phone
            } : null
        }));

        // 4. Combine all sources
        const combinedReagents = [...sheetReagents, ...dbReagents];

        if (!trimmedQuery) {
            // Empty query = return nothing for standard users to prevent browsing
            return { success: true, data: [] };
        }

        // Configure Fuse.js for fuzzy-searching across ALL sources
        const fuse = new Fuse(combinedReagents, {
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

        const sheetReagents = await fetchReagents();

        // Fetch local Database reagents
        const dbReagentsRaw = await prisma.reagent.findMany({
            include: {
                owner: {
                    select: {
                        name: true,
                        phone: true
                    }
                }
            }
        });

        // Map DB Reagents
        const dbReagents: Reagent[] = dbReagentsRaw.map(r => ({
            id: r.customId || r.id,
            name: r.name,
            brand: r.brand || "",
            catalogNo: r.casNumber || "",
            arrivalDate: r.arrivalDate || r.createdAt.toISOString().split('T')[0],
            size: r.size || r.quantity,
            unit: r.unit || "",
            notes: [r.condition, r.notes].filter(Boolean).join(" - "),
            location: r.location || "",
            searchTags: getSynonyms(r.name) + " " + getSynonyms(r.brand || "") + " " + (r.synonyms || ""),
            ownershipType: r.ownerId ? "USER" : "LAB",
            ownerContact: r.owner ? {
                name: r.owner.name,
                phone: r.owner.phone
            } : null
        }));

        const combinedReagents = [...sheetReagents, ...dbReagents];

        return { success: true, data: combinedReagents };
    } catch (error) {
        console.error("Error fetching all reagents:", error);
        return { success: false, message: "Internal server error" };
    }
}

/**
 * Add a new lab-owned chemical to the database (Admin only)
 */
export async function addLabChemical(data: { customId?: string, name: string, brand?: string, catalogNo?: string, arrivalDate?: string, size: string, unit: string, condition?: string, location?: string, notes?: string, synonyms?: string }): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "ADMIN") {
            return { success: false, message: "Unauthorized. Admin access required." };
        }

        const newChemical = await prisma.reagent.create({
            data: {
                customId: data.customId || null,
                name: data.name,
                brand: data.brand || null,
                casNumber: data.catalogNo || null,
                arrivalDate: data.arrivalDate || null,
                quantity: `${data.size} ${data.unit}`.trim(),
                size: data.size,
                unit: data.unit,
                condition: data.condition || null,
                location: data.location || null,
                notes: data.notes || null,
                synonyms: data.synonyms || null,
                ownerId: null, // Explicitly null for lab-owned
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Error adding lab chemical:", error);
        return { success: false, message: "Internal server error" };
    }
}

/**
 * Add a new user-owned chemical to the database (Any signed-in user)
 */
export async function addUserChemical(data: { customId?: string, name: string, brand?: string, catalogNo?: string, arrivalDate?: string, size: string, unit: string, condition?: string, location?: string, notes?: string, synonyms?: string }): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, message: "Unauthorized." };
        }

        const newChemical = await prisma.reagent.create({
            data: {
                customId: data.customId || null,
                name: data.name,
                brand: data.brand || null,
                casNumber: data.catalogNo || null,
                arrivalDate: data.arrivalDate || null,
                quantity: `${data.size} ${data.unit}`.trim(),
                size: data.size,
                unit: data.unit,
                condition: data.condition || null,
                location: data.location || null,
                notes: data.notes || null,
                synonyms: data.synonyms || null,
                ownerId: session.user.id, // Explicitly tied to the requesting user
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Error adding user chemical:", error);
        return { success: false, message: "Internal server error" };
    }
}
