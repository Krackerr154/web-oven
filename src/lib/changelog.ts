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

export const CURRENT_VERSION = "1.3.0";

export const KIND_LABEL: Record<ChangeKind, string> = {
    new: "New",
    improved: "Improved",
    fixed: "Fixed",
    removed: "Removed",
};

export const RELEASES: Release[] = [
    {
        version: "1.3.0",
        date: "2026-11-20",
        title: "XRD joins the FTIR layout",
        summary:
            "The two analysis tools now share one layout and one look: a full-width figure on a white sheet, and the controls in a strip beneath it instead of a narrow column beside it.",
        changes: [
            {
                kind: "improved",
                text: "The XRD plot spans the full width of the page instead of sharing it with a 330px column, so a pattern is about 50% wider than before.",
            },
            {
                kind: "improved",
                text: "Settings, export and CIF reference sit in one row under the figure, the same arrangement as the FTIR plotter.",
            },
            {
                kind: "improved",
                text: "The figure now sits on a white sheet inside the dark panel, matching FTIR and the exported files. The page header no longer renders as a white slab.",
            },
            {
                kind: "fixed",
                text: "Nothing on the page is set below 11px any more, and the small uppercase section labels are now readable sentence-case headings.",
            },
        ],
    },
    {
        version: "1.2.1",
        date: "2026-11-20",
        title: "Readable axes",
        summary:
            "The axis labels were drawn in dark ink on the dark panel and were nearly impossible to read. The figure now has its own white sheet, and the Y title no longer fights the tick numbers for the margin.",
        changes: [
            {
                kind: "fixed",
                text: "Axis titles and tick numbers were invisible against the dark panel: dark ink was drawn outside the white plotting box, at about 1.2 to 1 contrast. The whole figure now sits on a white sheet, so every label reads on screen and the exported PNG and PDF match what you see.",
            },
            {
                kind: "improved",
                text: "The Y axis title is horizontal above the axis instead of a rotated line squeezed beside the numbers, so it stops colliding with them at narrow widths.",
            },
            {
                kind: "fixed",
                text: "A peak label at the right edge could be clipped by a few pixels; labels now reserve their full width.",
            },
        ],
    },
    {
        version: "1.2.0",
        date: "2026-11-20",
        title: "FTIR: readable and keyboard-friendly",
        summary:
            "The FTIR plot now answers questions instead of only drawing them: read any point, zoom into the fingerprint region, drive it from the keyboard, and come back to the same workspace after a refresh.",
        changes: [
            {
                kind: "new",
                text: "Hover the plot to read the wavenumber and value of the nearest data point, with the trace name beside it.",
            },
            {
                kind: "new",
                text: "Drag across the plot to zoom into a wavenumber window, shift-drag to pan, and double-click or Reset view to go back. Useful for the 1500 to 400 cm-1 region, where identification actually happens.",
            },
            {
                kind: "new",
                text: "The plot works from the keyboard: focus it, use the arrow keys to move a cursor, Enter to place a baseline anchor and Delete to remove it. The position is announced as you move.",
            },
            {
                kind: "new",
                text: "Your workspace is restored after a refresh or an accidental tab close, including traces, baseline anchors and labels. It is scoped to you and clears when the tab closes.",
            },
            {
                kind: "improved",
                text: "Rename a trace by clicking its name in the list, and click an entry in the plot legend to hide or show that trace.",
            },
            {
                kind: "improved",
                text: "Contrast corrections: the primary button and the helper text now meet WCAG AA, peak labels never render below 11px, and the grid was halved so the spectrum carries the ink.",
            },
            {
                kind: "fixed",
                text: "The page had two first-level headings, so assistive technology announced the product name instead of the page. It now has one.",
            },
        ],
    },
    {
        version: "1.1.0",
        date: "2026-11-20",
        title: "FTIR Plotter",
        summary:
            "Spectra now have a plotter of their own: load instrument exports, correct the baseline, label the bands, and export a figure that records what was done to it.",
        changes: [
            {
                kind: "new",
                text: "FTIR Plotter under Analysis. Load CSV, TXT or JCAMP-DX exports, overlay several spectra, switch between %T and absorbance, and offset them into a waterfall.",
            },
            {
                kind: "new",
                text: "Baseline correction per trace, two ways: click anchors onto the regions that really have no absorption, or let the automatic hull follow the floor. A residual strip shows whether the correction ate a band.",
            },
            {
                kind: "new",
                text: "Peak labels. Bands are found on the corrected trace, and every detected position appears as a chip you can rename, so a figure can read 1654 C=O instead of just 1654.",
            },
            {
                kind: "improved",
                text: "Exports state what was done to the data. The PDF caption and the CSV header both record the baseline method and the labelled peaks, because a corrected spectrum with no stated method cannot be reproduced.",
            },
            {
                kind: "improved",
                text: "Spectra are parsed in your browser. Nothing you load is uploaded, the same as the XRD plotter.",
            },
        ],
    },
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
