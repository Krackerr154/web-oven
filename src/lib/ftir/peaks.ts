/**
 * Peak detection and label placement for FTIR spectra.
 *
 * Peaks are found on the CORRECTED absorbance trace: a band that only exists
 * because the baseline was left in is not a band. Prominence is measured against
 * the higher of the two adjacent valleys, which is what separates a real band
 * from a shoulder.
 */

export type Peak = {
    /** Wavenumber, cm⁻¹. */
    x: number;
    /** Corrected absorbance at the peak. */
    y: number;
    /** Height above the higher adjacent valley. */
    prominence: number;
    /** Index into the source arrays. */
    index: number;
};

export type DetectOptions = {
    /** Percent of the tallest peak a band must rise to count. Default 4. */
    minProminencePct?: number;
    /** Minimum spacing between accepted peaks, cm⁻¹. Default 20. */
    minSeparation?: number;
    /** Hard cap on labels (the strongest survive). Default 12. */
    maxCount?: number;
};

/** Local maxima with their prominence, before any filtering. */
export function localMaxima(x: number[], y: number[]): Peak[] {
    const out: Peak[] = [];
    const n = Math.min(x.length, y.length);
    for (let i = 1; i < n - 1; i++) {
        const v = y[i];
        if (!Number.isFinite(v)) continue;
        if (!(v > y[i - 1] && v >= y[i + 1])) continue;

        // Walk out to the first higher point in each direction, tracking the
        // lowest value crossed: that dip is the valley this peak rises from.
        let leftMin = v;
        for (let k = i - 1; k >= 0; k--) {
            if (y[k] > v) break;
            if (y[k] < leftMin) leftMin = y[k];
        }
        let rightMin = v;
        for (let k = i + 1; k < n; k++) {
            if (y[k] > v) break;
            if (y[k] < rightMin) rightMin = y[k];
        }
        out.push({ x: x[i], y: v, prominence: v - Math.max(leftMin, rightMin), index: i });
    }
    return out;
}

export function detectPeaks(x: number[], y: number[], opts: DetectOptions = {}): Peak[] {
    const { minProminencePct = 4, minSeparation = 20, maxCount = 12 } = opts;
    const all = localMaxima(x, y);
    if (!all.length) return [];

    const maxY = Math.max(...y.filter(Number.isFinite));
    const floor = Math.max(0, maxY) * (minProminencePct / 100);
    const prominent = all.filter((p) => p.prominence >= floor && p.prominence > 0);

    // Strongest first, so the cap keeps the bands that matter.
    const byStrength = [...prominent].sort((a, b) => b.prominence - a.prominence);
    const kept: Peak[] = [];
    for (const p of byStrength) {
        if (kept.length >= maxCount) break;
        if (kept.some((k) => Math.abs(k.x - p.x) < minSeparation)) continue;
        kept.push(p);
    }
    return kept.sort((a, b) => b.x - a.x);
}

/* ── Label placement ──────────────────────────────────────────────────────── */

export type LabelRequest = { key: string; x: number; y: number; text: string; widthPx: number };
export type PlacedLabel = { key: string; x: number; y: number; text: string; box: { l: number; r: number; t: number; b: number } };

/**
 * Place labels above their peaks without overlap.
 *
 * Highest peak wins the space, then lower ones try one row higher before being
 * dropped. Dropping is deliberate: two labels on top of each other is worse than
 * a missing one, and the peak list under the plot still shows every position.
 */
export function placeLabels(
    items: LabelRequest[],
    toPx: (x: number) => number,
    toPy: (y: number) => number,
    opts: { fontSize: number; plotLeft: number; plotRight: number; plotTop: number; rows?: number } = {
        fontSize: 11,
        plotLeft: 0,
        plotRight: 0,
        plotTop: 0,
    },
): PlacedLabel[] {
    const rows = opts.rows ?? 3;
    const rowH = opts.fontSize + 4;
    const placed: PlacedLabel[] = [];
    const ordered = [...items].sort((a, b) => b.y - a.y);

    for (const item of ordered) {
        const cx = toPx(item.x);
        const baseY = toPy(item.y) - 7;
        let done = false;
        for (let r = 0; r < rows && !done; r++) {
            const y = baseY - r * rowH;
            const box = {
                l: cx - item.widthPx / 2,
                r: cx + item.widthPx / 2,
                t: y - opts.fontSize,
                b: y + 2,
            };
            if (box.l < opts.plotLeft || box.r > opts.plotRight) continue;
            if (box.t < opts.plotTop) continue;
            const collides = placed.some(
                (p) => !(box.r < p.box.l || box.l > p.box.r || box.b < p.box.t || box.t > p.box.b),
            );
            if (collides) continue;
            placed.push({ key: item.key, x: cx, y, text: item.text, box });
            done = true;
        }
    }
    return placed;
}
