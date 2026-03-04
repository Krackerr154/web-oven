import Papa from 'papaparse';

// Public CSV export URL for the INV2026 Google Sheet
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1fakhZGefVarmqFOcjZ4FrMZTodSriMIYGoCV57z5PAg/export?format=csv&gid=1766823686";

export interface Reagent {
    id: string;          // Identifier
    name: string;        // Nama
    brand: string;       // Merk
    catalogNo: string;   // No. katalog
    arrivalDate: string; // Waktu kedatangan
    size: string;        // Ukuran
    unit: string;        // Satuan
    notes: string;       // Keterangan
    location: string;    // Posisi
    searchTags: string;  // Derived synonyms for Fuse.js searching
}

// ── Hardcoded Synonym Dictionary for Chemistry ───────────────────────────
const synonymDictionary: Record<string, string[]> = {
    // Abbreviations -> Full names (or vice versa depending on what's in sheet)
    "etoh": ["ethanol", "ethyl alcohol"],
    "meoh": ["methanol", "methyl alcohol"],
    "dmf": ["dimethylformamide", "n,n-dimethylformamide"],
    "ipa": ["isopropanol", "isopropyl alcohol", "2-propanol", "propan-2-ol"],
    "tfh": ["tetrahydrofuran"],
    "dcm": ["dichloromethane", "methylene chloride"],
    "dmso": ["dimethyl sulfoxide", "dimethylsulfoxide"],
    "ea": ["ethyl acetate", "etac"],
    "hex": ["hexane", "n-hexane"],
    "hcl": ["hydrochloric acid", "hydrogen chloride"],
    "h2so4": ["sulfuric acid", "sulphuric acid"],
    "hno3": ["nitric acid"],
    "ch3cooh": ["acetic acid", "ethanoic acid", "glacial acetic acid"],
    "naoh": ["sodium hydroxide", "lye", "caustic soda"],
    "koh": ["potassium hydroxide", "caustic potash"],
    "di hp": ["deionized water", "di water", "h2o", "aquadest", "akuades"],
};

/**
 * Normalizes text to lowercase and checks if it matches any known synonyms
 */
function getSynonyms(text: string): string {
    if (!text) return "";
    const lower = text.toLowerCase();
    const tags = new Set<string>();

    // Check if the exact text (like "ethanol") is a value in our dictionary
    // If so, add its abbreviation (like "etoh")
    for (const [abbr, fullNames] of Object.entries(synonymDictionary)) {
        if (lower === abbr) {
            fullNames.forEach(n => tags.add(n));
        }
        for (const fullName of fullNames) {
            if (lower.includes(fullName) || fullName.includes(lower)) {
                tags.add(abbr);
                fullNames.forEach(n => tags.add(n));
            }
        }
    }

    return Array.from(tags).join(" ");
}

// In-memory cache to avoid Google Sheets API rate limits
let cachedReagents: Reagent[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 1000 * 60 * 5; // 5 minutes

export async function fetchReagents(): Promise<Reagent[]> {
    const now = Date.now();
    if (cachedReagents && (now - lastFetchTime) < CACHE_DURATION_MS) {
        return cachedReagents;
    }

    try {
        const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
        if (!res.ok) {
            throw new Error("Failed to fetch Google Sheet CSV");
        }

        const csvText = await res.text();

        // Parse using PapaParse
        const parsed = Papa.parse<Record<string, string>>(csvText, {
            header: true,
            skipEmptyLines: true,
        });

        const reagents: Reagent[] = parsed.data
            .filter((row) => row["Identifier"] || row["Nama"]) // basic filter for non-empty rows
            .map((row) => {
                const name = row["Nama"] || "";
                const brand = row["Merk"] || "";
                return {
                    id: row["Identifier"] || "",
                    name,
                    brand,
                    catalogNo: row["No. katalog"] || "",
                    arrivalDate: row["Waktu kedatangan"] || "",
                    size: row["Ukuran"] || "",
                    unit: row["Satuan"] || "",
                    notes: row["Keterangan"] || "",
                    location: row["Posisi"] || "",
                    searchTags: getSynonyms(name) + " " + getSynonyms(brand),
                };
            });

        cachedReagents = reagents;
        lastFetchTime = now;
        return reagents;

    } catch (error) {
        console.error("Error fetching reagents from sheets:", error);
        // Return cached data as fallback if available
        return cachedReagents || [];
    }
}
