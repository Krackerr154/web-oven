/**
 * Release history for AP-Lab.
 *
 * Written for the person using the lab, not for the person who wrote the code.
 * Commit subjects are not reused here: "fix(analysis): legend click-to-toggle
 * lost when drag was added" tells a student nothing, so each entry states what
 * they can now do, or what stopped going wrong.
 *
 * Ordering: newest first. `version` must match package.json for the top entry.
 *
 * Editing rules:
 *  - Add a new entry at the top when you ship something a user would notice.
 *  - Bump `version` here AND in package.json in the same commit.
 *  - Never rewrite a released entry. Corrections get their own line.
 *  - `changes` is grouped by kind and rendered in the order given.
 */

export type ChangeKind = "new" | "improved" | "fixed" | "removed";

export type Change = {
    kind: ChangeKind;
    text: string;
};

export type Release = {
    version: string;
    date: string; // ISO date the release went live
    title: string;
    summary: string;
    changes: Change[];
};

export const CURRENT_VERSION = "1.0.0";

export const KIND_LABEL: Record<ChangeKind, string> = {
    new: "New",
    improved: "Improved",
    fixed: "Fixed",
    removed: "Removed",
};

export const RELEASES: Release[] = [
    {
        version: "1.0.0",
        date: "2026-11-07",
        title: "First stable release",
        summary:
            "AP-Lab reaches 1.0: booking, inventory, forms and analysis in one place, with supervisors now taken from the department register instead of typed by hand.",
        changes: [
            {
                kind: "new",
                text: "Supervisors are picked from a directory built from the ITB chemistry department pages, instead of being typed as free text. Registration and the XRD form now share one picker.",
            },
            {
                kind: "new",
                text: "Multi-supervisor registration: choose a main supervisor and any co-supervisors. The first one selected is marked as main.",
            },
            {
                kind: "new",
                text: "XRD sessions are saved in your browser, so a half-finished plot survives a refresh or an accidental tab close.",
            },
            {
                kind: "new",
                text: "The in-plot legend can be dragged to any corner, and the position is kept when you export.",
            },
            {
                kind: "new",
                text: "Drag to zoom, shift-drag to pan, double-click to reset the XRD plot.",
            },
            {
                kind: "new",
                text: "Phase agreement scoring against reference patterns simulated from a CIF file.",
            },
            {
                kind: "improved",
                text: "Legend entries can be hidden by clicking them, and the panel uses two columns and a backing plate once there are more than four traces.",
            },
            {
                kind: "improved",
                text: "The 2θ axis picks its own tick spacing, so a zoomed view no longer collapses to a single label.",
            },
            {
                kind: "improved",
                text: "Export buttons explain what they produce, and a confirmation appears once a file has downloaded.",
            },
            {
                kind: "fixed",
                text: "Clicking a legend entry could hide the wrong trace when another was already hidden. Each entry now keeps its own position.",
            },
            {
                kind: "fixed",
                text: "Panning the plot wrote long unrounded numbers into the 2θ fields; values are now given to 0.01°.",
            },
            {
                kind: "fixed",
                text: "Searching the supervisor list by name no longer matches every row.",
            },
            {
                kind: "removed",
                text: "The analysis page no longer advertises CV, EIS, FTIR and TGA plotters that do not exist.",
            },
        ],
    },
    {
        version: "0.9.0",
        date: "2026-11-01",
        title: "XRD plotter",
        summary:
            "Diffraction patterns can be plotted, compared and exported for a report without leaving AP-Lab.",
        changes: [
            {
                kind: "new",
                text: "XRD plotter: load up to eight scans (.xy, .xye, .dat, .txt, .csv), stack them as a waterfall, and adjust 2θ and the offset.",
            },
            {
                kind: "new",
                text: "Export a publication-ready figure as PNG, SVG or an 85 mm PDF, or the underlying numbers as CSV.",
            },
            {
                kind: "new",
                text: "Drag traces to reorder them; the list, the plot and the legend stay in step.",
            },
            {
                kind: "new",
                text: "Name each trace and read off the intensity at any angle.",
            },
        ],
    },
    {
        version: "0.8.0",
        date: "2026-10-08",
        title: "Member cards",
        summary:
            "Printable lab ID cards, and a database that no longer depends on anything outside the stack.",
        changes: [
            {
                kind: "new",
                text: "AP-Lab member card with your name, NIM and supervisor, exportable as a high-resolution PNG or a CR80 print-ready PDF.",
            },
            {
                kind: "improved",
                text: "The database runs inside the stack, so the app comes up on its own after a restart.",
            },
        ],
    },
    {
        version: "0.7.0",
        date: "2026-04-04",
        title: "Admin analytics",
        summary:
            "Administrators can see how the lab is actually being used.",
        changes: [
            {
                kind: "new",
                text: "Analytics dashboard: instrument utilisation, booking trends over six months, reagent stock levels, and the most-borrowed glassware.",
            },
            {
                kind: "new",
                text: "Admin user management with per-student booking history.",
            },
        ],
    },
    {
        version: "0.6.0",
        date: "2026-03-18",
        title: "Inventory and announcements",
        summary: "The lab's shared stock and its notice board join the booking system.",
        changes: [
            {
                kind: "new",
                text: "Glassware borrowing with partial returns and overdue tracking.",
            },
            {
                kind: "new",
                text: "Announcements with pinned posts, emoji reactions and threaded comments.",
            },
            {
                kind: "new",
                text: "Chemical inventory with PubChem data and Google Sheets sync.",
            },
        ],
    },
    {
        version: "0.5.0",
        date: "2026-04-01",
        title: "Accounts and bookings",
        summary: "The first working version: sign in, see what is free, book it.",
        changes: [
            {
                kind: "new",
                text: "Email-verified accounts with an approval step before first use.",
            },
            {
                kind: "new",
                text: "Instrument booking with clash detection and a 15-minute cancellation window.",
            },
            {
                kind: "new",
                text: "Supercritical point drying requests go to a separate approval queue.",
            },
        ],
    },
];
