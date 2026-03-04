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
            .map((row) => ({
                id: row["Identifier"] || "",
                name: row["Nama"] || "",
                brand: row["Merk"] || "",
                catalogNo: row["No. katalog"] || "",
                arrivalDate: row["Waktu kedatangan"] || "",
                size: row["Ukuran"] || "",
                unit: row["Satuan"] || "",
                notes: row["Keterangan"] || "",
                location: row["Posisi"] || "",
            }));

        cachedReagents = reagents;
        lastFetchTime = now;
        return reagents;

    } catch (error) {
        console.error("Error fetching reagents from sheets:", error);
        // Return cached data as fallback if available
        return cachedReagents || [];
    }
}
