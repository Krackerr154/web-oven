# PRD: DSC Data Analysis Module
## G-Labs Academic Portal (`web-oven`)

**Feature ID:** DSC-001  
**Status:** Ready for implementation  
**Priority:** High  
**Target milestone:** v1.1  
**Last updated:** 2025-07-18

---

## 0. Instructions for the AI Agent

You are implementing the **DSC (Differential Scanning Calorimetry) Data Analysis Module** inside the existing **G-Labs Academic Portal** (`web-oven`). This document is your complete specification. Work through it section by section. Do not skip sections. Do not hallucinate APIs or schema fields — read the existing codebase first.

### Before writing any code, you must:

1. Read `prisma/schema.prisma` fully to understand existing table conventions (`ap_*` prefix, `@@map`, no `_prisma_migrations`, `db push` only).
2. Read `src/lib/` to understand the Prisma singleton, auth config, timezone handling (all times in **WIB / Asia/Jakarta**), and utility patterns.
3. Read `src/app/actions/` (especially `booking.ts`) to understand the Server Action pattern used throughout the project. **All database mutations must be Server Actions — no REST API routes for mutations.**
4. Read `src/middleware.ts` to understand route protection patterns. The new `/dsc` route must follow the same authenticated-route conventions as `/book`, `/reagents`, etc.
5. Read `src/components/` to identify shared UI primitives (buttons, modals, notification system) and reuse them. Do **not** introduce `react-hot-toast` or any new notification library — use the project's existing custom notification system.
6. Read `src/app/(dashboard)/` to understand the dashboard layout and sidebar navigation structure, so your new pages integrate seamlessly.

---

## 1. Feature Overview

Add a **DSC Data Analysis** section to the G-Labs Portal that allows internal lab researchers to:

- Upload raw Setaram DSC instrument data files (`.txt`, UTF-16 LE, tab-delimited).
- View an interactive HeatFlow vs. Sample Temperature chart with all scan cycles overlaid.
- Automatically detect melting (exothermic) and crystallization (endothermic) thermal event peaks.
- Manually adjust, add, or delete peak boundaries on the chart.
- Export results as: interactive chart (in-app), PNG/SVG image, PDF report (matching Setaram Calisto style), and CSV/Excel spreadsheet.
- Access a history of previously processed experiments.

This module follows the same patterns as the existing **XRD Phase Matching** planned feature in architecture (file upload → compute → results), but is fully client-side in v1.0 — no Python microservice required.

---

## 2. Codebase Integration Map

### 2.1 New files to create

```
src/app/(dashboard)/dsc/
  page.tsx                        # Landing / upload page
  [experimentId]/
    page.tsx                      # Analysis view for a loaded experiment
    loading.tsx                   # Skeleton while experiment loads

src/app/actions/dsc.ts            # All Server Actions for DSC (save, delete, list)

src/components/dsc/
  DscUploader.tsx                 # File drop zone + parse trigger
  DscChart.tsx                   # Interactive chart (Plotly or D3)
  PeakSidebar.tsx                # Peak list, detection controls, export buttons
  PeakCard.tsx                   # Single peak display card
  DscExportButtons.tsx           # PNG / SVG / PDF / Excel export logic

src/lib/dsc/
  parser.ts                      # UTF-16 LE TSV parser → typed DataPoint[]
  peakDetection.ts               # Auto peak detection algorithm
  statistics.ts                  # Per-cycle mean / SD aggregation
  exportPdf.ts                   # jsPDF-based PDF report generator
  exportExcel.ts                 # SheetJS XLSX export
```

### 2.2 Modified files

```
prisma/schema.prisma              # Add DscExperiment + DscPeak models
src/app/(dashboard)/layout.tsx    # Add "DSC Analysis" to sidebar nav
src/middleware.ts                 # No changes needed (inherits /dashboard auth)
```

### 2.3 Do NOT modify

- `src/lib/auth.ts` — authentication is unchanged; DSC uses the existing session.
- `src/app/actions/booking.ts` — no coupling between booking and DSC.
- Any existing instrument booking, reagent, or glassware logic.

---

## 3. Database Schema

Add the following models to `prisma/schema.prisma`. Follow the existing `ap_*` prefix convention and use `db push` (never `prisma migrate`).

```prisma
model DscExperiment {
  id            String       @id @default(cuid())
  userId        String
  user          User         @relation(fields: [userId], references: [id])
  filename      String
  sampleName    String
  massMg        Float
  molarMass     Float?
  atmosphere    String?
  operatorName  String?
  procedureName String?
  recordedAt    DateTime?    // from file header, WIB
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  peaks         DscPeak[]
  // Raw data is NOT stored in the DB — it stays client-side (IndexedDB / state)
  // Only metadata and computed peak results are persisted

  @@map("ap_dsc_experiments")
}

model DscPeak {
  id              String        @id @default(cuid())
  experimentId    String
  experiment      DscExperiment @relation(fields: [experimentId], references: [id], onDelete: Cascade)
  cycleIndex      Int           // 0-based
  peakType        String        // "exothermic" | "endothermic"
  onsetTempC      Float
  onsetTimeH      Float
  offsetTempC     Float
  offsetTimeH     Float
  peakMaxTempC    Float
  peakMaxTimeH    Float
  peakHeightMw    Float
  heatJPerG       Float
  label           String?
  isManual        Boolean       @default(false)
  createdAt       DateTime      @default(now())

  @@map("ap_dsc_peaks")
}
```

**Important:** Add the `DscExperiment` relation to the existing `User` model:
```prisma
// Inside the existing User model, add:
dscExperiments  DscExperiment[]
```

Run `npx prisma db push` and `npx prisma generate` after making schema changes.

---

## 4. File Parser (`src/lib/dsc/parser.ts`)

### 4.1 Input format

The Setaram instrument exports `.txt` files with:
- **Encoding:** UTF-16 LE with BOM (`0xFF 0xFE`).
- **Delimiter:** Tab (`\t`).
- **Header rows:** Variable number of metadata rows before the column header row.
- **Column header row:** Contains `Time`, `Furnace Temperature`, `Sample Temperature`, `HeatFlow`, and one or more `Baseline` columns (exact labels may vary by firmware version — match case-insensitively and by substring).
- **Data rows:** Numeric values. Some rows may be empty or contain only whitespace — skip them.

### 4.2 Output TypeScript types

```typescript
export interface DscMetadata {
  experimentName: string | null;
  sampleName: string | null;
  massMg: number | null;
  molarMass: number | null;
  atmosphere: string | null;
  operator: string | null;
  procedure: string | null;
  recordedAt: Date | null; // parse from file header date string, convert to WIB
}

export interface DscDataPoint {
  timeH: number;
  furnaceTempC: number;
  sampleTempC: number;
  heatflowMw: number;
  baselineMw: number;
  cycleIndex: number; // filled after cycle segmentation
}

export interface ParseResult {
  metadata: DscMetadata;
  dataPoints: DscDataPoint[];
  parseErrors: string[]; // non-fatal warnings (e.g. skipped rows)
}
```

### 4.3 Parsing steps

1. Read the file as `ArrayBuffer`.
2. Decode using `TextDecoder('utf-16-le')` (strip BOM if present).
3. Split on `\n`. Trim each line.
4. Scan header rows (lines before the column header) for key-value metadata pairs. Known patterns from the reference file:
   - `Experiment:` → `experimentName`
   - `Mass:` followed by a number and `(mg)` → `massMg`
   - `Molar mass:` → `molarMass`
   - `Atmosphere:` → `atmosphere`
   - `Procedure:` → `procedureName`
   - A date string matching `DD/MM/YYYY` → `recordedAt`
5. Identify the column header row by checking if it contains both `Time` and `HeatFlow` (case-insensitive substring match).
6. Map column indices from the header row.
7. Parse numeric data rows. Skip rows where any required column is `NaN`.
8. Return `ParseResult`. Do not throw on partial failures — collect warnings in `parseErrors`.

---

## 5. Cycle Segmentation

Implement in `src/lib/dsc/parser.ts` as a post-parse step.

### Algorithm

1. Take the `furnaceTempC` signal over time.
2. Compute a rolling derivative: `dT[i] = furnaceTempC[i+1] - furnaceTempC[i-1]` (central difference).
3. Apply a sign-change detector on the smoothed derivative (window = 20 points) to find heating→cooling and cooling→heating transitions.
4. Assign `cycleIndex` to each `DscDataPoint` based on which segment it falls in (0, 1, 2, …).
5. Also assign a `cycleDirection`: `"heating"` where `dT > 0`, `"cooling"` where `dT < 0`, `"isothermal"` near zero.

The reference file `20250714_Nirwan_PEG.txt` contains **6 half-cycles** (3 heating + 3 cooling). The algorithm must correctly segment all 6.

---

## 6. Peak Detection (`src/lib/dsc/peakDetection.ts`)

### 6.1 Algorithm

This runs entirely in the browser (no server call needed).

```typescript
export interface PeakDetectionOptions {
  prominenceThresholdMw: number; // default 0.8
  smoothingWindowPts: number;    // default 12
}

export interface DetectedPeak {
  cycleIndex: number;
  peakType: 'exothermic' | 'endothermic';
  peakMaxIdx: number;         // index in dataPoints[]
  peakMaxTempC: number;
  peakMaxTimeH: number;
  peakHeightMw: number;
  onsetIdx: number;
  onsetTempC: number;
  onsetTimeH: number;
  offsetIdx: number;
  offsetTempC: number;
  offsetTimeH: number;
  heatJPerG: number;          // integrated area / mass
  baselineType: 'linear';
  isManual: boolean;
}
```

Steps:

1. **Smooth** the `heatflowMw` signal using a simple moving average over `smoothingWindowPts`.
2. **Per cycle:** operate only on data points belonging to that `cycleIndex`.
3. **Find extrema:** identify local minima (endothermic, heatflow goes negative = exo up convention; verify against the reference PDF) and maxima above the `prominenceThresholdMw`.
4. **For each extremum:**
   - Fit a **linear baseline** between the left and right baseline points (where the peak departs from and returns to the smoothed signal floor).
   - **Onset:** walk left from the peak max along the leading edge; find the intersection of the steepest tangent line with the baseline — this is the onset temperature.
   - **Offset:** walk right from the peak max along the trailing edge; find the tangent–baseline intersection.
   - **Peak height:** `|heatflowMw at peak max − baseline at that temperature|`.
   - **Integrated heat (J/g):** trapezoidal integration of `(heatflowMw − baseline)` over the temperature range `[onsetTempC, offsetTempC]`, divided by `massMg / 1000` to get J/g.
5. Return `DetectedPeak[]`.

### 6.2 Validation against reference file

The algorithm **must** produce results within these tolerances for `20250714_Nirwan_PEG.txt` (20.6 mg sample):

| Cycle | Type | Peak Max (°C) | Onset (°C) | Heat (J/g) |
|---|---|---|---|---|
| 1 | Exo | 61.7 ± 0.5 | 57.5 ± 0.5 | 162 ± 5 |
| 1 | Endo | 41.5 ± 0.5 | 45.2 ± 0.5 | −149.5 ± 5 |
| 2 | Exo | 60.0 ± 0.5 | 55.7 ± 0.5 | 155.5 ± 5 |
| 2 | Endo | 42.1 ± 0.5 | 44.9 ± 0.5 | −149.8 ± 5 |
| 3 | Exo | 59.1 ± 0.5 | 53.8 ± 0.5 | 149.8 ± 5 |
| 3 | Endo | 41.6 ± 0.5 | 44.7 ± 0.5 | −140.4 ± 5 |

Write a unit test file `src/lib/dsc/__tests__/peakDetection.test.ts` that asserts these tolerances using the actual parsed reference file as a fixture.

---

## 7. Server Actions (`src/app/actions/dsc.ts`)

Follow the exact same pattern as `src/app/actions/booking.ts`. Use `getServerSession` from NextAuth for auth. Return typed result objects (not thrown errors) following the existing pattern in the codebase.

### Actions to implement

```typescript
// Save a processed experiment and its peaks to the DB
saveExperiment(input: SaveExperimentInput): Promise<ActionResult<DscExperiment>>

// List all experiments for the current user (paginated, newest first)
listExperiments(page: number, pageSize: number): Promise<ActionResult<DscExperiment[]>>

// Get a single experiment with its peaks
getExperiment(experimentId: string): Promise<ActionResult<DscExperimentWithPeaks>>

// Delete an experiment and all its peaks (cascade)
deleteExperiment(experimentId: string): Promise<ActionResult<void>>

// Update peaks for an experiment (replaces all peaks — called after manual adjustment)
updatePeaks(experimentId: string, peaks: PeakInput[]): Promise<ActionResult<DscPeak[]>>
```

### Authorization rules

- Users may only read and delete **their own** experiments (`userId === session.user.id`).
- `ADMIN` role users may read and delete **any** experiment.
- Always verify ownership server-side; never trust client-sent `userId`.

---

## 8. UI Implementation

### 8.1 Route: `/dsc` — Upload & History page

**File:** `src/app/(dashboard)/dsc/page.tsx`

This is a Server Component. It fetches the user's recent experiments via `listExperiments()`.

Layout:
- Page heading: "DSC Analysis"
- A prominent file drop zone (`DscUploader` client component) at the top.
- Below: a table/grid of recent experiments (filename, sample name, date, peak count, actions: Open / Delete).
- Empty state if no experiments exist yet.

`DscUploader` client component behavior:
1. Accepts `.txt` file via drag-and-drop or file picker.
2. Reads file as `ArrayBuffer`, calls `parseDscFile()` from `src/lib/dsc/parser.ts`.
3. On success: shows metadata preview (sample name, mass, date, cycle count detected).
4. Shows a "Analyse" button. On click: calls `saveExperiment()` Server Action with metadata only (no raw data), receives the new `experimentId`, then redirects to `/dsc/[experimentId]` and stores the raw `DscDataPoint[]` in `sessionStorage` keyed by `experimentId`.
5. On parse error: shows the error using the project's existing notification system.

### 8.2 Route: `/dsc/[experimentId]` — Analysis view

**File:** `src/app/(dashboard)/dsc/[experimentId]/page.tsx`

This is a Client Component (needs browser APIs for chart interactivity and sessionStorage access).

On mount:
1. Load raw data from `sessionStorage[experimentId]`. If not found (e.g. user navigated directly via URL), show a message: "Raw data not available in this session. Please re-upload the file." with an upload button.
2. Load experiment metadata and saved peaks from `getExperiment(experimentId)`.
3. Run `detectPeaks()` with default settings if no saved peaks exist yet.

Layout (two-column, matching the mockup):
- **Left (main):** metadata chips row + `DscChart` component.
- **Right (sidebar, 260px):** `PeakSidebar` component.

### 8.3 `DscChart` component

**Library choice:** Use **Plotly.js** (`plotly.js-dist-min` — already listed in the project's planned XRD dependencies). If Plotly is not yet installed, add it: `npm install plotly.js-dist-min`. Do not use D3 from scratch — too much boilerplate for this chart type.

Chart requirements:
- X-axis: Sample Temperature (°C), auto-range from data.
- Y-axis: HeatFlow (mW), label includes "Exo↑" annotation following DSC convention.
- One trace per cycle half (heating = warm orange/red shades, cooling = cool blue shades). Heating cycles use `#D85A30` family (darker for cycle 1, lighter for later), cooling uses `#378ADD` family.
- Baseline traces rendered as thin dashed lines, toggled by a checkbox.
- Detected peaks rendered as:
  - Filled regions (`fill: 'tozeroy'` per segment) between the peak curve and baseline.
  - Vertical dashed lines at Onset and Offset.
  - Annotation callout boxes (matching the Setaram PDF style) showing: peak max temp, onset, offset, height, heat.
- **Selected peak** (highlighted from the sidebar) rendered with a brighter fill and slightly thicker trace.
- Pan and zoom: enabled via Plotly's built-in `dragmode: 'pan'` with scroll-to-zoom.
- Hover tooltip: shows Temperature (°C), HeatFlow (mW), Time (h), Cycle.
- **Manual peak addition:** when the user clicks the "Add peak" toolbar button, enter a "draw mode" where a click+drag on the chart defines the onset–offset temperature range. On mouseup, compute peak parameters for that range and emit to parent state.
- **Onset/offset drag adjustment:** Plotly shapes with `editable: true` on the onset/offset vertical lines, so researchers can drag them. On `plotly_relayout` event, recompute peak parameters.

### 8.4 `PeakSidebar` component

Three tabs: **Peaks**, **Detect**, **Stats**.

**Peaks tab:**
- Scrollable list of `PeakCard` components, one per detected/manual peak.
- Each card shows: cycle number, heating/cooling badge, peak type (Exo/Endo), peak max, onset, offset, height, heat.
- Clicking a card highlights the corresponding peak on the chart (`selectedPeakId` state lifted to parent).
- Each card has a delete button (icon, requires confirmation via the project's existing modal/confirm pattern).
- Each card has an optional editable label field.

**Detect tab:**
- Prominence threshold slider (0.1–5.0 mW, step 0.1, default 0.8).
- Smoothing window slider (4–40 pts, step 2, default 12).
- "Re-detect peaks" button — re-runs `detectPeaks()` with current slider values, replaces auto-detected peaks (keeps manual ones).
- Note: debounce slider changes by 400ms before re-running detection.

**Stats tab:**
- For each cycle group (Cycle 1, Cycle 2, … and "All cycles"):
  - Mean ± SD of: Onset (°C), Peak Max (°C), Heat (J/g) across repeated heating cycles and separately for cooling cycles.
- Rendered as a simple table using existing project table styles.

### 8.5 `DscExportButtons` component

Four buttons at the bottom of the sidebar:

| Button | Action |
|---|---|
| PNG | `Plotly.downloadImage(graphDiv, { format: 'png', width: 1800, height: 1000, filename: experimentName })` |
| SVG | Same but `format: 'svg'` |
| PDF | Call `exportPdf()` from `src/lib/dsc/exportPdf.ts` — see §9 |
| Excel | Call `exportExcel()` from `src/lib/dsc/exportExcel.ts` — see §10 |

A "Save to portal" button calls `updatePeaks()` Server Action to persist the current peak state. Show the project's existing success/error notification on completion.

---

## 9. PDF Export (`src/lib/dsc/exportPdf.ts`)

Use `jspdf` and `html2canvas` — both are already in the project's `package.json`. Do not introduce new PDF libraries.

### Report structure (matching the Setaram Calisto PDF format)

**Page 1:**
1. Header block (top): Instrument logo placeholder | Experiment name | Atmosphere | Mass | Date | Procedure | Zone | Molar mass | Operator.
2. The full annotated chart — capture via `html2canvas` on the Plotly div, embed as image.
3. Footer: generation timestamp, app name "G-Labs DSC Analyser".

**Page 2:**
1. Peak parameters table with columns: `#` | Cycle | Type | Onset (°C) | Peak Max (°C) | Offset (°C) | Peak Height (mW) | Heat (J/g) | Baseline Type | Mass (mg).
2. Statistics summary table: per cycle group, mean ± SD.
3. Footer: same as page 1.

File is downloaded as `{experimentName}_DSC_Report.pdf`.

---

## 10. Excel Export (`src/lib/dsc/exportExcel.ts`)

Use `SheetJS` (`xlsx`) — already in the project's package.json (used by existing XRD form logic). Do not introduce a different Excel library.

### Workbook structure

**Sheet 1 — "Raw Data":**
Columns: `Time (h)` | `Furnace Temp (°C)` | `Sample Temp (°C)` | `HeatFlow (mW)` | `Baseline (mW)` | `Cycle Index` | `Cycle Direction`

**Sheet 2 — "Peak Parameters":**
Columns: `#` | `Cycle` | `Type` | `Onset (°C)` | `Onset Time (h)` | `Peak Max (°C)` | `Peak Max Time (h)` | `Offset (°C)` | `Offset Time (h)` | `Peak Height (mW)` | `Heat (J/g)` | `Baseline` | `Mass (mg)` | `Label` | `Manual?`

**Sheet 3 — "Statistics":**
Columns: `Cycle Group` | `Direction` | `N` | `Mean Onset (°C)` | `SD Onset` | `Mean Peak Max (°C)` | `SD Peak Max` | `Mean Heat (J/g)` | `SD Heat`

File downloaded as `{experimentName}_DSC_Data.xlsx`.

---

## 11. Sidebar Navigation

Add a "DSC Analysis" entry to the dashboard sidebar. Find the nav items array in `src/app/(dashboard)/layout.tsx` (or wherever sidebar items are defined in the existing code) and add:

```typescript
{
  label: 'DSC Analysis',
  href: '/dsc',
  icon: FlaskConical,  // from lucide-react — already installed
  roles: ['ADMIN', 'USER'],
}
```

Place it after the existing instrument booking links and before Reagents, or follow the existing ordering logic.

---

## 12. Session Storage Pattern

Raw `DscDataPoint[]` arrays can be very large (50 MB files → ~200k rows). Do **not** store raw data in the database or in React state across navigation.

Use `sessionStorage` with the key `dsc_raw_{experimentId}`. On the analysis page:
- On mount: attempt to read from `sessionStorage`. If missing, show re-upload prompt.
- Before navigating away (on the upload page): write to `sessionStorage` immediately after save.
- On experiment deletion: also clear `sessionStorage.removeItem('dsc_raw_{experimentId}')`.

---

## 13. Error Handling Conventions

Follow the existing pattern from `src/app/actions/booking.ts`:

```typescript
// Server actions return:
type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string }

// Client components check result.success before using result.data
// Display errors using the project's existing notification system — NOT alert()
```

Specific error cases to handle:
- File not UTF-16 LE or not tab-delimited → "Unsupported file format. Please upload a Setaram DSC .txt export."
- Column headers not found → "Could not identify required columns (Time, HeatFlow, Sample Temperature). Check the file format."
- No data rows parsed → "The file appears to be empty or contains no numeric data."
- File > 50 MB → "File too large. Maximum size is 50 MB." (check before parsing).
- SessionStorage quota exceeded → "File too large to cache in browser. Analysis is available for this session only."

---

## 14. TypeScript & Code Quality Rules

- All new files must be fully typed — no `any` except where interfacing with Plotly's untyped events.
- Use `zod` for validating Server Action inputs (follow the existing pattern in `src/app/actions/`).
- No `console.log` left in production code — use the project's existing logger if one exists, or remove debug logs before committing.
- Follow the existing file naming convention: kebab-case for files, PascalCase for components.
- All date/time values displayed in the UI must be in **WIB (Asia/Jakarta)** — use the existing timezone utilities in `src/lib/`.

---

## 15. Testing Requirements

Create the following test files:

```
src/lib/dsc/__tests__/
  parser.test.ts          # Unit tests for UTF-16 parsing, metadata extraction, cycle segmentation
  peakDetection.test.ts   # Validation against reference file (see §6.2 tolerances)
  statistics.test.ts      # Mean/SD calculation tests
```

Use the project's existing test runner (check `package.json` for `vitest` or `jest`). Use `20250714_Nirwan_PEG.txt` as the primary fixture — place a copy in `src/lib/dsc/__tests__/fixtures/`.

---

## 16. Acceptance Criteria

The feature is complete when all of the following pass:

- [ ] **AC-01:** Uploading `20250714_Nirwan_PEG.txt` parses correctly: 3 heating cycles, 3 cooling cycles, metadata extracted (mass: 20.6 mg, date: 14/07/2025).
- [ ] **AC-02:** Auto peak detection finds 6 peaks matching the tolerances in §6.2.
- [ ] **AC-03:** Dragging an Onset marker recomputes onset temperature and enthalpy within 200ms.
- [ ] **AC-04:** Adding a manual peak via click+drag creates a new peak card and callout annotation.
- [ ] **AC-05:** Deleting a peak removes it from the chart and the sidebar.
- [ ] **AC-06:** "Save to portal" persists peaks to the DB; reloading the page in the same session shows the saved peaks.
- [ ] **AC-07:** PNG export downloads a 1800×1000px image with all annotations visible.
- [ ] **AC-08:** PDF export produces a two-page document with header, chart, and peak table.
- [ ] **AC-09:** Excel export produces a three-sheet workbook with correct column headers and data.
- [ ] **AC-10:** The `/dsc` route is inaccessible without authentication (middleware blocks it).
- [ ] **AC-11:** A user cannot view or delete another user's experiment (server-side ownership check).
- [ ] **AC-12:** All unit tests in `src/lib/dsc/__tests__/` pass.
- [ ] **AC-13:** No TypeScript errors (`tsc --noEmit` passes).
- [ ] **AC-14:** No new npm packages introduced without justification. Any new package must be added to this PRD as an approved dependency.

---

## 17. Approved New Dependencies

If any of the following are not yet in `package.json`, you may install them. **Do not install anything not on this list without asking.**

| Package | Purpose | Version constraint |
|---|---|---|
| `plotly.js-dist-min` | Interactive chart rendering | `^2.x` |
| `xlsx` | Excel export | Already in project (SheetJS) |
| `jspdf` | PDF generation | Already in project |
| `html2canvas` | Chart screenshot for PDF | Already in project |

---

## 18. Out of Scope for This PR

Do not implement the following — they are planned for later milestones:

- Multi-experiment overlay / comparison view.
- Support for non-Setaram file formats (TA Instruments, Mettler Toledo).
- Advanced kinetics analysis (Ozawa, Kissinger).
- Admin dashboard analytics for DSC usage.
- Email notifications on experiment completion.
- Server-side raw data storage (DB or S3).

---

*End of PRD. Implement section by section. Commit in logical units (schema → parser → detection → UI → exports → tests). Open a PR when all acceptance criteria pass.*
