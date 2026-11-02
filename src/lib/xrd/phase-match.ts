/**
 * Phase agreement between a measured powder pattern and a simulated reference.
 *
 * The method is the peak-list search–match used across the field (Hanawalt /
 * ICDD PDF heritage), formalised as in XMatcher (Cao, arXiv:2607.17162, 2026):
 * a bounded global angular shift, one-to-one peak assignment, and five
 * separate agreement metrics rather than one opaque score.
 *
 * The composite score RANKS hypotheses. It does not certify phase identity —
 * every result carries the pair list and the residual evidence so a chemist
 * can check the claim instead of trusting a number.
 *
 * Pure functions only: no React, no DOM, no I/O.
 */

export type Peak = {
    /** 2θ in degrees */
    x: number;
    /** Absolute intensity (counts) */
    y: number;
    /** Relative intensity, I/I₀ × 100, where I₀ is the strongest peak in the list */
    i: number;
    /** Reflection indices, when the peak came from a simulated reference */
    hkl?: number[];
};

export type DetectOptions = {
    /** Fraction of max signal a peak must rise above its local baseline. Default 0.03 */
    minHeight?: number;
    /** Fraction of max signal a peak must stand above its valleys. Default 0.02 */
    minProminence?: number;
    /** Minimum angular separation between accepted peaks, degrees. Default 0.20 */
    minSeparation?: number;
    /** Keep at most this many of the strongest peaks. Default 40 */
    maxPeaks?: number;
    /** Moving-average smoothing width in points. Default 5 */
    smoothWindow?: number;
    /** Baseline block width in degrees. Default 2.0 */
    baselineWidth?: number;
};

export type MatchOptions = {
    /**
     * Positional tolerance τ in degrees. Default 0.12.
     *
     * Chosen empirically, not by taste: sweeping τ from 0.05 to 0.20 on a
     * measured Ni-BDC scan, a wrong-phase CIF first clears the "partial" gate
     * at τ = 0.15 and stays clean at τ ≤ 0.12. 0.12 is the loosest tolerance
     * that still rejects the wrong phase, so real specimens keep as much
     * allowance for strain and specimen displacement as the discrimination
     * permits.
     */
    tau?: number;
    /** Maximum absolute global shift |δ| in degrees. Default 0.50 */
    maxShift?: number;
    /** Coarse shift grid step in degrees. Default 0.02 */
    shiftStep?: number;
    /** Weight on position agreement; wi = 1 - wx. Default 0.70 */
    wx?: number;
    /**
     * Keep only the N strongest reference reflections inside the window.
     * A full CIF expansion can carry hundreds of reflections that no scan
     * could ever resolve; scoring against all of them crushes recall and lets
     * noise match by chance. XMatcher's reference library uses the same
     * 30-strongest truncation. Default 30.
     */
    maxReflections?: number;
    /** Drop reference reflections below this relative intensity (%). Default 0 */
    minRefIntensity?: number;
    /** Restrict matching to this 2θ window; defaults to the overlap of both lists */
    range?: [number, number];
};

export type Pair = {
    expIndex: number;
    refIndex: number;
    expX: number;
    refX: number;
    /** refX + δ */
    shiftedRefX: number;
    /** expX - (refX + δ) */
    dTheta: number;
    expI: number;
    refI: number;
    cost: number;
};

export type MatchResult = {
    /** Composite score H, 0–100 */
    score: number;
    /** Precision: fraction of measured peaks that are explained */
    precision: number;
    /** Recall: fraction of expected reflections that were found */
    recall: number;
    /** Intensity-weighted fraction of measured signal explained */
    coverageExp: number;
    /** Intensity-weighted fraction of expected intensity accounted for */
    coverageRef: number;
    /** Quality factor Q = 100·exp(−mean pair cost) */
    quality: number;
    /** Fitted global shift δ in degrees */
    shift: number;
    pairs: Pair[];
    /** Expected reflections with no measured counterpart — counter-evidence */
    missingRef: Peak[];
    /** Measured peaks with no expected counterpart — impurity evidence */
    unexplainedExp: Peak[];
    /** 2θ window actually compared */
    window: [number, number];
    /** Number of measured peaks and reference reflections inside the window */
    expCount: number;
    refCount: number;
};

const BIG = 1e6;

/* ────────────────────────────────────────────────────────────────────────────
   Signal conditioning
   ──────────────────────────────────────────────────────────────────────────── */

function movingAverage(v: number[], w: number): number[] {
    const n = v.length;
    if (w <= 1 || n === 0) return v.slice();
    const half = Math.floor(w / 2);
    const pre = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + v[i];
    const out = new Array<number>(n);
    for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - half);
        const b = Math.min(n, i + half + 1);
        out[i] = (pre[b] - pre[a]) / (b - a);
    }
    return out;
}

/**
 * Rolling minimum over a block-aligned window — a cheap, robust baseline for
 * diffraction data, where the background is the floor between peaks.
 */
function rollingMin(v: number[], blockSize: number): number[] {
    const n = v.length;
    if (n === 0) return [];
    const bs = Math.max(2, Math.round(blockSize));
    const nb = Math.ceil(n / bs);
    const bmin = new Float64Array(nb).fill(Infinity);

    for (let i = 0; i < n; i++) {
        const b = Math.floor(i / bs);
        if (v[i] < bmin[b]) bmin[b] = v[i];
    }

    const out = new Array<number>(n);
    for (let i = 0; i < n; i++) {
        const b = Math.floor(i / bs);
        let m = bmin[b];
        if (b > 0 && bmin[b - 1] < m) m = bmin[b - 1];
        if (b < nb - 1 && bmin[b + 1] < m) m = bmin[b + 1];
        out[i] = m;
    }
    return out;
}

/* ────────────────────────────────────────────────────────────────────────────
   Peak detection
   ──────────────────────────────────────────────────────────────────────────── */

export function detectPeaks(
    xs: number[],
    ys: number[],
    opts: DetectOptions = {},
): Peak[] {
    const {
        minHeight = 0.03,
        minProminence = 0.02,
        minSeparation = 0.2,
        maxPeaks = 40,
        smoothWindow = 5,
        baselineWidth = 2.0,
    } = opts;

    const n = Math.min(xs.length, ys.length);
    if (n < 5) return [];

    const dx = n > 1 ? Math.abs(xs[1] - xs[0]) || 0.01 : 0.01;
    const smooth = movingAverage(ys.slice(0, n), smoothWindow);
    const baseline = rollingMin(smooth, baselineWidth / Math.max(dx, 1e-6));

    const signal = new Array<number>(n);
    for (let i = 0; i < n; i++) signal[i] = Math.max(0, smooth[i] - baseline[i]);

    let maxSignal = 0;
    for (let i = 0; i < n; i++) if (signal[i] > maxSignal) maxSignal = signal[i];
    if (maxSignal <= 0) return [];

    const heightCut = maxSignal * minHeight;
    const promCut = maxSignal * minProminence;

    // Local maxima over a ±2 point neighbourhood
    const candidates: { index: number; value: number }[] = [];
    for (let i = 2; i < n - 2; i++) {
        const v = signal[i];
        if (v < heightCut) continue;
        if (v < signal[i - 1] || v < signal[i - 2]) continue;
        if (v < signal[i + 1] || v < signal[i + 2]) continue;
        candidates.push({ index: i, value: v });
    }

    // Prominence: rise above the higher of the two valleys flanking the peak
    const scored: { index: number; value: number; prominence: number }[] = [];
    for (const c of candidates) {
        const h = c.value;
        let leftMin = h;
        for (let k = c.index - 1; k >= 0; k--) {
            if (signal[k] >= h) break;
            if (signal[k] < leftMin) leftMin = signal[k];
        }
        let rightMin = h;
        for (let k = c.index + 1; k < n; k++) {
            if (signal[k] >= h) break;
            if (signal[k] < rightMin) rightMin = signal[k];
        }
        const prominence = h - Math.max(leftMin, rightMin);
        if (prominence < promCut) continue;
        scored.push({ index: c.index, value: h, prominence });
    }

    // Enforce minimum separation, strongest first
    scored.sort((a, b) => b.value - a.value);
    const kept: typeof scored = [];
    for (const s of scored) {
        const x = xs[s.index];
        if (kept.some((k) => Math.abs(xs[k.index] - x) < minSeparation)) continue;
        kept.push(s);
        if (kept.length >= maxPeaks) break;
    }

    kept.sort((a, b) => xs[a.index] - xs[b.index]);
    const strongest = Math.max(...kept.map((k) => k.value), 1e-12);

    return kept.map((k) => ({
        x: xs[k.index],
        y: k.value,
        i: (k.value / strongest) * 100,
    }));
}

/* ────────────────────────────────────────────────────────────────────────────
   Assignment — Hungarian / Kuhn–Munkres, O(n²m)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Minimum-cost assignment for a rectangular cost matrix (rows ≤ cols).
 * Returns, for each row, the assigned column index, or -1 if unassigned.
 */
function hungarian(cost: number[][]): number[] {
    const n = cost.length;
    if (n === 0) return [];
    const m = cost[0].length;
    if (m === 0) return new Array(n).fill(-1);
    if (n > m) throw new Error("hungarian requires rows <= cols");

    const INF = Number.MAX_VALUE / 4;
    const u = new Array(n + 1).fill(0);
    const v = new Array(m + 1).fill(0);
    const p = new Array(m + 1).fill(0);
    const way = new Array(m + 1).fill(0);

    for (let i = 1; i <= n; i++) {
        p[0] = i;
        let j0 = 0;
        const minv = new Array(m + 1).fill(INF);
        const used = new Array(m + 1).fill(false);

        do {
            used[j0] = true;
            const i0 = p[j0];
            let delta = INF;
            let j1 = 0;

            for (let j = 1; j <= m; j++) {
                if (used[j]) continue;
                const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
                if (cur < minv[j]) {
                    minv[j] = cur;
                    way[j] = j0;
                }
                if (minv[j] < delta) {
                    delta = minv[j];
                    j1 = j;
                }
            }

            for (let j = 0; j <= m; j++) {
                if (used[j]) {
                    u[p[j]] += delta;
                    v[j] -= delta;
                } else {
                    minv[j] -= delta;
                }
            }
            j0 = j1;
        } while (p[j0] !== 0);

        do {
            const j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
        } while (j0);
    }

    const ans = new Array(n).fill(-1);
    for (let j = 1; j <= m; j++) if (p[j] > 0) ans[p[j] - 1] = j - 1;
    return ans;
}

/** One-to-one assignment; handles both aspect ratios. */
function assign(cost: number[][]): number[] {
    const n = cost.length;
    if (n === 0) return [];
    const m = cost[0]?.length ?? 0;
    if (m === 0) return new Array(n).fill(-1);

    if (n <= m) return hungarian(cost);

    // Transpose, solve, invert
    const t: number[][] = [];
    for (let j = 0; j < m; j++) {
        const row = new Array<number>(n);
        for (let i = 0; i < n; i++) row[i] = cost[i][j];
        t.push(row);
    }
    const tAssign = hungarian(t);
    const out = new Array(n).fill(-1);
    for (let j = 0; j < m; j++) {
        const i = tAssign[j];
        if (i >= 0) out[i] = j;
    }
    return out;
}

/* ────────────────────────────────────────────────────────────────────────────
   Scoring at a fixed shift
   ──────────────────────────────────────────────────────────────────────────── */

type Fixed = {
    pairs: Pair[];
    precision: number;
    recall: number;
    coverageExp: number;
    coverageRef: number;
    quality: number;
    score: number;
};

function scoreAtShift(
    exp: Peak[],
    ref: Peak[],
    shift: number,
    tau: number,
    wx: number,
    wi: number,
): Fixed {
    const m = exp.length;
    const n = ref.length;

    const cost: number[][] = [];
    for (let i = 0; i < m; i++) {
        const row = new Array<number>(n);
        for (let j = 0; j < n; j++) {
            const shifted = ref[j].x + shift;
            const dTheta = Math.abs(exp[i].x - shifted);
            if (dTheta > tau) {
                row[j] = BIG;
                continue;
            }
            row[j] = wx * (dTheta / tau) + wi * (Math.abs(exp[i].i - ref[j].i) / 100);
        }
        cost.push(row);
    }

    const assignment = assign(cost);

    const pairs: Pair[] = [];
    for (let i = 0; i < m; i++) {
        const j = assignment[i];
        if (j < 0) continue;
        const c = cost[i][j];
        if (c >= BIG / 2) continue; // ineligible pair the solver had to place somewhere
        const shiftedRefX = ref[j].x + shift;
        pairs.push({
            expIndex: i,
            refIndex: j,
            expX: exp[i].x,
            refX: ref[j].x,
            shiftedRefX,
            dTheta: exp[i].x - shiftedRefX,
            expI: exp[i].i,
            refI: ref[j].i,
            cost: c,
        });
    }

    const sumExp = exp.reduce((s, p) => s + p.i, 0) || 1e-12;
    const sumRef = ref.reduce((s, p) => s + p.i, 0) || 1e-12;

    const precision = m > 0 ? pairs.length / m : 0;
    const recall = n > 0 ? pairs.length / n : 0;
    const coverageExp = pairs.reduce((s, p) => s + p.expI, 0) / sumExp;
    const coverageRef = pairs.reduce((s, p) => s + p.refI, 0) / sumRef;

    const meanCost = pairs.length
        ? pairs.reduce((s, p) => s + p.cost, 0) / pairs.length
        : 1;
    const quality = 100 * Math.exp(-meanCost);

    const score =
        0.45 * quality * ((precision + recall) / 2) +
        0.30 * (100 * coverageRef) +
        0.15 * (100 * coverageExp) +
        0.10 * (100 * Math.min(precision, recall));

    return { pairs, precision, recall, coverageExp, coverageRef, quality, score };
}

/* ────────────────────────────────────────────────────────────────────────────
   Public entry point
   ──────────────────────────────────────────────────────────────────────────── */

export function matchPhase(
    expPeaks: Peak[],
    refPeaks: Peak[],
    opts: MatchOptions = {},
): MatchResult | null {
    const {
        tau = 0.12,
        maxShift = 0.5,
        shiftStep = 0.02,
        wx = 0.7,
        maxReflections = 30,
        minRefIntensity = 0,
    } = opts;
    const wi = 1 - wx;

    if (expPeaks.length === 0 || refPeaks.length === 0) return null;

    // Default window = the span of the measured peaks. It must NOT be clipped
    // by the reference extent: a measured peak just below the first calculated
    // reflection is still a real observation and dropping it silently loses
    // evidence. Callers that know the data range (the UI does) should pass it.
    const lo = opts.range?.[0] ?? Math.min(...expPeaks.map((p) => p.x));
    const hi = opts.range?.[1] ?? Math.max(...expPeaks.map((p) => p.x));

    const exp = expPeaks.filter((p) => p.x >= lo && p.x <= hi);

    // Truncate the reference to the strongest reflections inside the window,
    // then restore angular order for downstream reporting.
    const refWindow = refPeaks
        .filter((p) => p.x >= lo && p.x <= hi)
        .filter((p) => p.i >= minRefIntensity);
    const ref = refWindow
        .slice()
        .sort((a, b) => b.i - a.i)
        .slice(0, Math.max(1, maxReflections))
        .sort((a, b) => a.x - b.x);

    if (exp.length === 0 || ref.length === 0) return null;

    // Coarse sweep, then a finer sweep around the winner
    let bestShift = 0;
    let best: Fixed | null = null;

    const evaluate = (shift: number) => {
        const r = scoreAtShift(exp, ref, shift, tau, wx, wi);
        // Tie-break toward a smaller correction: prefer the smaller |δ|
        if (
            !best ||
            r.score > best.score + 1e-9 ||
            (Math.abs(r.score - best.score) <= 1e-9 && Math.abs(shift) < Math.abs(bestShift))
        ) {
            best = r;
            bestShift = shift;
        }
    };

    const steps = Math.round(maxShift / shiftStep);
    for (let k = -steps; k <= steps; k++) evaluate(k * shiftStep);

    const fine = shiftStep / 5;
    for (let k = -4; k <= 4; k++) {
        const s = bestShift + k * fine;
        if (Math.abs(s) <= maxShift) evaluate(s);
    }

    const chosen = best as Fixed | null;
    if (!chosen) return null;

    const matchedRefIdx = new Set(chosen.pairs.map((p) => p.refIndex));
    const matchedExpIdx = new Set(chosen.pairs.map((p) => p.expIndex));

    return {
        score: chosen.score,
        precision: chosen.precision,
        recall: chosen.recall,
        coverageExp: chosen.coverageExp,
        coverageRef: chosen.coverageRef,
        quality: chosen.quality,
        shift: bestShift,
        pairs: chosen.pairs,
        missingRef: ref.filter((_, j) => !matchedRefIdx.has(j)),
        unexplainedExp: exp.filter((_, i) => !matchedExpIdx.has(i)),
        window: [lo, hi],
        expCount: exp.length,
        refCount: ref.length,
    };
}

/**
 * Convenience wrapper: detect peaks in a raw scan and score it in one call.
 */
export function scoreScanAgainstReference(
    xs: number[],
    ys: number[],
    refPeaks: Peak[],
    detect: DetectOptions = {},
    match: MatchOptions = {},
): MatchResult | null {
    const peaks = detectPeaks(xs, ys, detect);
    return matchPhase(peaks, refPeaks, match);
}

/* ────────────────────────────────────────────────────────────────────────────
   Evidence classification
   ──────────────────────────────────────────────────────────────────────────── */

export type Verdict = "supported" | "partial" | "unsupported";

/**
 * The composite score H ranks one phase against another. It is NOT a presence
 * test: unstructured noise scores H≈34 against a dense reference because
 * random peaks land near some line eventually, while coverage stays poor.
 *
 * These gates answer the different question — "is the reference accounting for
 * the signal that is actually there?" They are OUR thresholds, calibrated on
 * measured Rigaku scans, NOT an ICDD or XMatcher criterion. The component
 * numbers are always shown alongside so the call can be checked.
 */
export const VERDICT_GATES = {
    /**
     * All three must hold. Recall is in the gate because a scan with only a
     * handful of detected peaks can score high on the peaks it does have —
     * that is a thin basis for calling a phase present.
     *
     * Calibrated on measured Rigaku scans at tau = 0.12: a true phase lands at
     * CE 95-98% with R 43-57%, a wrong-phase CIF at CE 24%, noise at CE 20%.
     * CE carries the discrimination; R separates degrees of crystallinity.
     */
    supported: { coverageExp: 0.65, quality: 65, recall: 0.3 },
    partial: { coverageExp: 0.4, quality: 55, recall: 0.15 },
} as const;

export function classifyMatch(r: MatchResult): { verdict: Verdict; reason: string } {
    const { coverageExp: ce, quality: q, recall: rec } = r;
    const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
    const evidence =
        `${pct(ce)} of measured intensity explained, ` +
        `${pct(rec)} of expected reflections found, Q=${q.toFixed(0)}`;

    const c = VERDICT_GATES.supported;
    const p = VERDICT_GATES.partial;

    if (ce >= c.coverageExp && q >= c.quality && rec >= c.recall) {
        return { verdict: "supported", reason: `Reference accounts for the pattern — ${evidence}.` };
    }
    if (ce >= p.coverageExp && q >= p.quality && rec >= p.recall) {
        return {
            verdict: "partial",
            reason: `Partially explained — ${evidence}. Check missing reflections and unexplained peaks.`,
        };
    }
    return {
        verdict: "unsupported",
        reason: `The evidence does not support this phase — ${evidence}.`,
    };
}
