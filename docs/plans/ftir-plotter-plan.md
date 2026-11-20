# FTIR Plotter — Implementation Plan

**Status:** proposed, awaiting approval
**Author:** Hephaestus
**Date:** 2026-11-19
**Target:** `/analysis/ftir` in `web-oven-ap-lab`

---

## 1. Goal

A browser-side FTIR spectrum plotter for AP-Lab members: load instrument exports, apply
credible baseline correction, label peaks, and export publication-ready figures — with the
same interaction language as the existing XRD plotter.

### Non-goals (explicitly out of scope)

- Peak deconvolution / curve fitting (Gaussian, Lorentzian, Voigt)
- Quantitative analysis (Beer–Lambert concentration regression, chemometrics, PLS)
- Spectral library search or automatic compound identification
- Proprietary binary formats (Bruker OPUS `.0`, PerkinElmer `.sp`, Shimadzu `.smf`, Nicolet `.spa`)
- ATR correction and Savitzky–Golay / derivatives — **Phase 2**, after Phase 1 is in use
- Server-side storage of spectra — processing stays in the browser, as with XRD

---

## 2. Where it lives

```
/analysis                 existing hub — add one card
/analysis/xrd             existing plotter (untouched behaviour)
/analysis/ftir            NEW
```

No database model, no migration, no API route in Phase 1. Consistent with the XRD decision:
spectra never leave the browser.

---

## 3. Architecture

### 3.1 The problem with copying XRD

`src/components/analysis/xrd-plotter.tsx` is 2,659 lines. Roughly 60% is generic drawing
machinery (primitives, layout, tick maths, PNG/SVG/PDF export) and 40% is XRD-specific.
Copying the file would create a second 2,600-line fork that drifts.

### 3.2 Extract a shared core first

```
src/lib/plot/core.ts          ← moved from xrd-plotter, unchanged logic
    types: Prim, Layout, TraceStyle
    textWidth, niceStep, snapLegendPos, PALETTE
    screenLayout, PRINT_LAYOUT
    paintCanvas(prims, ctx), toSVG(prims), exportPng/Svg/Pdf

src/lib/plot/axis.ts          ← new, small
    wavenumberTickLabels (descending axis support)

src/lib/xrd/parse.ts          ← moved parseScan (unchanged)
src/lib/ftir/parse.ts         ← new
src/lib/ftir/process.ts       ← new: baseline, normalize
src/lib/ftir/peaks.ts         ← new: detection + label layout
```

`xrd-plotter.tsx` then imports the core instead of defining it. Its rendered output must be
**bit-identical** before and after — enforced by a geometry snapshot (see §9).

### 3.3 Data flow

```
File (drop / picker)
   → parse            raw pairs (wavenumber, value) + detected unit, sorted descending
   → normalise        to absorbance space A = -log10(T/100) if input is %T
   → baseline         per-trace: manual anchors | rubberband | none
   → smooth           (Phase 2)
   → normalise        max = 1 or 0–100 %T
   → peaks            detect, sort, place labels
   → render           buildFigure → primitives → canvas / SVG / PDF
```

Every stage is a pure function over typed data. Nothing touches React state directly, which
is what makes it testable without a DOM.

---

## 4. Data model

```ts
type Point = { x: number; y: number };          // x = wavenumber, descending

type RawSpectrum = {
  points: Point[];
  unit: "transmittance" | "absorbance" | "unknown";
  name: string;
  sourceFormat: string;
};

type Trace = {
  id: string;
  name: string;                 // editable
  raw: RawSpectrum;
  absorbance: number[];         // derived, cached
  baseline: BaselineSpec;       // per-trace — see §6
  corrected: number[];          // derived
  visible: boolean;
  offset: number;               // waterfall slot
  color: string;
};

type BaselineSpec =
  | { kind: "none" }
  | { kind: "manual"; anchors: Point[]; degree: 1 | 2 | 3 }
  | { kind: "rubberband" };
```

`BaselineSpec` lives **per trace**. An "Apply to all traces" action copies the spec of the
active trace to every other trace, but the anchors are stored per trace so a shared spec
still records each trace's own fit.

---

## 5. Parsing

### 5.1 Accepted inputs

```
.csv .txt .tsv .dat .asc .prn .dpt .xy .jws
.jdx .dx        (JCAMP-DX, text form: ##XYDATA= / ##XYPOINTS=)
```

### 5.2 Rules

- Two numeric columns, any order, any delimiter (comma, semicolon, tab, run of spaces)
- Decimal comma supported (`1500,5`) — detect, then normalise
- Header lines skipped until the first row with two parseable numbers
- If the file declares `%T` / `Transmittance` in a header or is bounded 0–105 with a flat top,
  unit = transmittance; if bounded ~0–3 with peaks pointing up, absorbance
- Ambiguous → default to `%T` (the overwhelming instrument default) with a visible toggle
- Wavenumbers auto-sorted **descending**; if the file ascends, reverse once at parse time
- Duplicate x values: keep the first, drop later duplicates (instrument stitching artefacts)

### 5.3 Rejections (explicit, actionable)

```
binary instruments  → "Export as CSV/TXT from your instrument software"
< 50 points         → "This file has N points; FTIR scans need hundreds"
non-numeric body    → show the first offending line number
```

---

## 6. Baseline engine

### 6.1 Space rule (non-negotiable)

All baseline maths happens in **absorbance**. Beer–Lambert is additive there; in
transmittance the same absorption is multiplicative. The user may view and export %T, but the
correction is computed on A and converted back at render time.

```
T%  →  A = -log10(T/100)        clamp T ≥ 0.01 to avoid infinity
A   →  T% = 100 · 10^(-A)
```

### 6.2 Manual anchors (per trace)

- Click on the plot to place an anchor at the nearest data point
- Drag an existing anchor to move it (snaps to nearest x)
- Click an anchor with the delete modifier / hit the chip in the trace panel to remove it
- 1 anchor → constant offset
- 2 anchors → straight line (the publication-standard two-point baseline)
- 3+ anchors and degree 1–3 → least-squares polynomial through the anchors
- Fewer anchors than degree+1 → the UI refuses and explains ("degree 3 needs 4 anchors")

The fitted polyline is drawn dashed over the raw trace, and the segment between the first and
last anchor is shaded so you can see commitment.

### 6.3 Rubberband (automatic)

Lower convex hull of the absorbance trace — parameter-free, deterministic, matches the
behaviour of OPUS / Essential FTIR / Spectragryph. Computed with a monotone-chain hull over
the data points; the hull drops out in O(n log n) and is exact for a convex baseline.

Guard rails learned from real spectra:

- The hull is computed **excluding the last and first 10 points** at the scan edges, where
  truncation makes hulls behave badly
- A visible warning when the hull rises *into* a peak region by more than 20% of peak height
  ("rubberband may be cutting into the 3400 cm⁻¹ band — consider manual anchors")
- The 2350 cm⁻¹ CO₂ artefact is never special-cased; it is a real feature of the raw data and
  silently removing it would be falsification

### 6.4 Residual display

Optional strip beneath the plot showing `raw − corrected`. A good correction leaves a
featureless residual; a bad one leaves the ghost of the peaks it ate. This is the fastest
visual way to catch over-correction, and it is what reviewers see first in a bad figure.

---

## 7. Peak picking

- Local maxima in corrected absorbance
- Prominence threshold (fraction of max peak), adjustable 1–20%
- Minimum separation (cm⁻¹), default 20
- Sorted by position, capped at N labels (default 12)
- Label collision: greedy placement above the peak with horizontal nudging, dropping labels
  rather than overlapping them — same approach that already works in the XRD plotter
- Each label is editable text, so you can rename `1650` to `1650 C=O` without fighting the UI

Peak *assignment* (mapping a wavenumber to a functional group) is **Phase 2** and would be
suggested, never auto-written.

---

## 8. Rendering, UI, persistence

### 8.1 Axes

- X: wavenumber, **descending** 4000 → 400, ticks every 500 by default
- Y: %T (0–100, peaks down) or Absorbance (peaks up); axis label follows the mode
- Both ranges editable, drag-to-zoom, shift-drag pan, double-click reset — reuse the XRD
  interaction model exactly

### 8.2 Layout

```
desktop ≥ 1024px   canvas left (flex)  |  settings panel right (320px)
mobile  < 1024px   canvas full width, settings in a bottom sheet
```

The settings panel holds: traces list (name, colour, visibility, baseline chip, remove),
baseline mode + controls, peaks controls, axis ranges, export.

### 8.3 Persistence

`sessionStorage` keyed `ftir:workspace:<userId>` — traces (points excluded above a size cap),
baseline specs, axis ranges, peak settings. Cleared on tab close, same policy as the LUMA
thread. No cross-user leakage: the key is user-scoped and the value is re-validated on mount.

### 8.4 Export

```
PNG   300 dpi at 85 mm (single column) and 170 mm (double column)
SVG   vector, text as paths optional
PDF   85 mm, embedded caption text
CSV   corrected (x, y) per trace, plus a header line recording the method
```

Caption carries provenance: `baseline: manual linear, anchors 4000/1800 cm⁻¹` or
`baseline: rubberband`. A corrected spectrum without a stated method is not reproducible.

---

## 9. Testing

No test harness exists around the XRD plotter today; this plan adds one without rewriting it.

```
src/lib/plot/__tests__/core.test.ts
  textWidth monotonicity, niceStep 1–2–5, hull/geometry helpers
  golden primitives: a fixed XRD scan → JSON hash, unchanged across the refactor

src/lib/ftir/__tests__/parse.test.ts
  decimal comma · header skipping · ascending input reversed once · %T vs A detection
  JCAMP-DX minimal fixture · malformed file rejected with a useful message

src/lib/ftir/__tests__/process.test.ts
  round-trip T→A→T identity (method none)
  offset invariance: raw + c → corrected identical
  two-point manual equals the analytic straight line (exact)
  rubberband on a convex curve returns that curve (exact)
  synthetic quadratic + 3 Gaussians: positions unchanged, heights ±0.5%, residual flat
  non-negativity outside noise epsilon

src/lib/ftir/__tests__/peaks.test.ts
  known synthetic peaks recovered at exact positions
  prominence threshold suppresses shoulders correctly
  label count cap respected
```

Manual check on every deploy: load two traces at 390 px and 1440 px, export all three
formats, confirm the PDF caption and that no text clips.

---

## 10. Phases

```
Phase A  Extract shared core; XRD output must be bit-identical (golden test)
Phase B  FTIR parsing + render (no processing): load, overlay, offset, axes, export
Phase C  Baseline engine: manual anchors + rubberband + residual strip
Phase D  Peak picking + labels + CSV export + caption provenance
Phase E  Polish, mobile layout, help card, /analysis card, changelog, deploy
```

Each phase ends with a report and your confirmation before the next begins. Phase A is
sequenced first because everything else imports from it, and because a silent regression in
the working XRD plotter is the main risk in this whole job.

---

## 11. Acceptance criteria

```
AC-1  XRD plotter renders identically before/after Phase A (golden primitives hash)
AC-2  A two-column CSV, a decimal-comma CSV and a JCAMP-DX file all load correctly
AC-3  %T input displays as %T; absorbance toggle is mathematically consistent
AC-4  Wavenumber axis is descending; typed ranges clamp to data bounds
AC-5  Manual two-point baseline on a synthetic spectrum flattens it to noise
AC-6  Rubberband on a convex baseline returns that baseline exactly
AC-7  Adding a constant to a raw spectrum does not change the corrected result
AC-8  Baseline is per trace; "apply to all" copies the spec without welding traces together
AC-9  Residual strip shows no structure after a correct correction
AC-10 Exports carry the method in the caption; CSV carries it in the header
AC-11 440 px viewport: no horizontal overflow, settings reachable, canvas legible
AC-12 Processing is 100% client-side — no network request carries spectrum data
```

---

## 12. Risks

```
Risk                               Mitigation
Refactor breaks XRD                Golden primitives hash + manual side-by-side check
Rubberband eats a broad band       Residual strip + "hull rising into peaks" warning
Baseline in %T (physics error)     Absorbance-space maths, enforced in one module
Ambiguous %T vs A detection        Explicit toggle, defaults to %T, shown in the panel
Proprietary files rejected         Clear message naming the export path
2,600-line component growth        Pure lib modules; the component stays a view
Scope creep into deconvolution     Written non-goals; Phase 2 gate
```

---

## 13. Effort

```
Phase A  ~1 session    (mechanical move + golden test)
Phase B  ~1 session    (parser + render)
Phase C  ~1–2 sessions (interaction-heavy: anchors, drag, live preview)
Phase D  ~1 session
Phase E  ~1 session
```

Phase C is where the time actually goes: dragging anchors with a live-updating plot is
interaction work, not maths.

---

## 14. Open decisions

1. **Test data** — a real Ni-BDC or Cu-BDC export would let me verify band positions against
   literature (Cu ≈ 1569/1396, Ni ≈ 1579/1354 cm⁻¹) instead of synthetic fixtures only.
2. **Combined "Spectra" page later?** If CV/EIS plotters are ever built, `/analysis` becomes a
   hub of four; the route layout chosen now should not block that.
