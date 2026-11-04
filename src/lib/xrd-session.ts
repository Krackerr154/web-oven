/**
 * Local persistence for the XRD plotter.
 *
 * Why IndexedDB and not localStorage: one 7,500-point scan is ~135 KB as JSON
 * and the plotter holds up to eight, so a full session is over a megabyte.
 * localStorage caps near 5 MB per origin and is shared with the booking-tour
 * flags, so a couple of sessions would start throwing QuotaExceededError at a
 * point where the user has already done the work. IndexedDB has no such
 * practical ceiling, and it stores Float64Array natively — the same scan then
 * costs ~60 KB with no JSON text overhead at all.
 *
 * Nothing here touches the network. The scans never leave the browser.
 */

const DB_NAME = "ap-lab-xrd";
const DB_VERSION = 1;
const STORE = "sessions";
const CURRENT_KEY = "current";

export type StoredTrace = {
    id: string;
    label: string;
    fileName: string;
    color: string;
    visible: boolean;
    peak2Theta: number;
    peakIntensity: number;
    x: Float64Array;
    y: Float64Array;
};

export type StoredReference = {
    id: string;
    fileName: string;
    formula: string;
    spacegroup: string;
    volume: number;
    wavelength: number;
    peaks: { two_theta: number; intensity: number; hkl: number[] }[];
    visible: boolean;
};

export type SessionSettings = {
    lo: number;
    hi: number;
    gap: number;
    stacked: boolean;
    /**
     * Legend placement as a fraction of the reachable plot area: 0 = flush
     * left/top, 1 = flush right/bottom. Fractions rather than pixels so a
     * position dragged on a 1600 px screen still lands correctly on a phone,
     * and so the same value maps onto the print layout for exports.
     * Absent or null means automatic corner selection.
     */
    legendPos?: { fx: number; fy: number } | null;
};

export type StoredSession = {
    /** "current" for the autosaved working session, otherwise a uuid. */
    key: string;
    /** User-given name for a named save. Absent on the autosave. */
    name?: string;
    savedAt: number;
    traces: StoredTrace[];
    settings: SessionSettings;
    reference: StoredReference | null;
};

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("IndexedDB is unavailable in this browser"));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: "key" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Could not open the local database"));
        req.onblocked = () => reject(new Error("The local database is blocked by another tab"));
    });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return openDb().then(
        (db) =>
            new Promise<T>((resolve, reject) => {
                const t = db.transaction(STORE, mode);
                const req = fn(t.objectStore(STORE));
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error ?? new Error("Local storage request failed"));
                t.oncomplete = () => db.close();
                t.onerror = () => reject(t.error ?? new Error("Local storage transaction failed"));
            }),
    );
}

/** Save the working session. Silently no-ops on quota or private-mode failure. */
export async function saveCurrent(session: Omit<StoredSession, "key">): Promise<void> {
    const record: StoredSession = { ...session, key: CURRENT_KEY };
    await tx("readwrite", (s) => s.put(record));
}

export async function loadCurrent(): Promise<StoredSession | null> {
    const row = await tx<StoredSession | undefined>("readonly", (s) => s.get(CURRENT_KEY));
    return row ?? null;
}

export async function saveNamed(name: string, session: Omit<StoredSession, "key" | "name">): Promise<string> {
    const key =
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await tx("readwrite", (s) => s.put({ ...session, key, name }));
    return key;
}

export async function listNamed(): Promise<StoredSession[]> {
    const all = await tx<StoredSession[]>("readonly", (s) => s.getAll());
    return all
        .filter((r) => r.key !== CURRENT_KEY)
        .sort((a, b) => b.savedAt - a.savedAt);
}

export async function loadByKey(key: string): Promise<StoredSession | null> {
    const row = await tx<StoredSession | undefined>("readonly", (s) => s.get(key));
    return row ?? null;
}

export async function deleteByKey(key: string): Promise<void> {
    // Explicit user action only. The auto-deletion policy in this project
    // applies to files and containers; this is a per-item undo the user asks
    // for by name, in a UI that says which session it removes.
    await tx("readwrite", (s) => s.delete(key));
}

/**
 * Drop the working session. Removing every trace has to clear the autosave
 * too: leaving the record behind means the scans a user deliberately deleted
 * reappear on the next reload, which reads as the delete having failed.
 */
export async function clearCurrent(): Promise<void> {
    await tx("readwrite", (s) => s.delete(CURRENT_KEY));
}

/**
 * Ask the browser not to evict this origin's data. Without it a browser under
 * storage pressure may clear the whole store, which is exactly the "my work
 * vanished" outcome this feature exists to prevent.
 */
export async function requestPersistentStorage(): Promise<boolean> {
    try {
        if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
    } catch {
        return false;
    }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
    try {
        if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
        const { usage, quota } = await navigator.storage.estimate();
        return { usage: usage ?? 0, quota: quota ?? 0 };
    } catch {
        return null;
    }
}
