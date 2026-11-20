/**
 * FTIR baseline correction.
 *
 * Everything here operates on ABSORBANCE, never on %T. Beer–Lambert is additive
 * in A; a baseline subtracted in transmittance is a different (and wrong)
 * operation. The component converts for display, but calls into this module with
 * absorbance values.
 *
 * Two methods, deliberately different in character:
 *   manual      the analyst names the regions that really are free of absorption
 *   rubberband  a parameter-free lower convex hull, matching what instrument
 *               software does when nobody has chosen anchors
 */

export type Anchor = { x: number; y: number };

export type BaselineSpec =
    | { kind: "none" }
    | { kind: "rubberband" }
    | { kind: "manual"; anchors: Anchor[]; degree: 1 | 2 | 3 };

export const EMPTY_BASELINE: BaselineSpec = { kind: "none" };

/** Index of the data point nearest to `target` (x is descending or ascending). */
export function nearestIndex(x: number[], target: number): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < x.length; i++) {
        const d = Math.abs(x[i] - target);
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
}

/**
 * Lower convex hull of the spectrum, sampled back onto every x.
 *
 * The hull is computed on the interior and held constant across the first/last
 * `trim` points: truncated scan ends produce hulls that dive to a single noisy
 * point, which then becomes the baseline for the whole low-wavenumber region.
 */
export function rubberbandBaseline(x: number[], yA: number[], trim = 10): number[] {
    const n = Math.min(x.length, yA.length);
    if (n === 0) return [];
    if (n <= trim * 2 + 2) return new Array(n).fill(0);

    // Work in ascending x so "lower hull" means what it usually means.
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a] - x[b]);
    const px = order.map((i) => x[i]);
    const py = order.map((i) => yA[i]);

    const hull: number[] = []; // indices into px/py
    const cross = (o: number, a: number, b: number) =>
        (px[a] - px[o]) * (py[b] - py[o]) - (py[a] - py[o]) * (px[b] - px[o]);

    for (let i = trim; i < n - trim; i++) {
        while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], i) <= 0) {
            hull.pop();
        }
        hull.push(i);
    }
    if (hull.length < 2) return new Array(n).fill(py[trim] ?? 0);

    // Sample the hull polyline back over the full ascending axis.
    const base = new Array<number>(n);
    let seg = 0;
    for (let i = 0; i < n; i++) {
        while (seg < hull.length - 2 && px[i] > px[hull[seg + 1]]) seg++;
        const a = hull[seg];
        const b = hull[Math.min(seg + 1, hull.length - 1)];
        if (a === b || px[b] === px[a]) {
            base[i] = py[a];
        } else {
            const t = (px[i] - px[a]) / (px[b] - px[a]);
            base[i] = py[a] + Math.max(0, Math.min(1, t)) * (py[b] - py[a]);
        }
    }

    // Back to the caller's original ordering.
    const out = new Array<number>(n);
    for (let k = 0; k < n; k++) out[order[k]] = base[k];
    return out;
}

/* ── Manual anchors ───────────────────────────────────────────────────────── */

/** Solve A·c = b for a small square system (Gaussian elimination, partial pivot). */
function solve(A: number[][], b: number[]): number[] {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
        let piv = col;
        for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
        if (Math.abs(M[piv][col]) < 1e-12) throw new Error("anchor configuration is degenerate");
        [M[col], M[piv]] = [M[piv], M[col]];
        for (let r = col + 1; r < n; r++) {
            const f = M[r][col] / M[col][col];
            for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
        }
    }
    const out = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
        let sum = M[r][n];
        for (let c = r + 1; c < n; c++) sum -= M[r][c] * out[c];
        out[r] = sum / M[r][r];
    }
    return out;
}

/**
 * Least-squares polynomial through the anchors, evaluated over the whole axis.
 *
 * Anchors are fitted in a locally scaled u = (x − xc) / xs so a degree-3 fit on
 * wavenumbers in the thousands does not become numerically hopeless.
 */
export function polynomialBaseline(x: number[], anchors: Anchor[], degree: 1 | 2 | 3): number[] {
    const need = degree + 1;
    if (anchors.length < need) {
        throw new Error(`degree ${degree} needs at least ${need} anchors (have ${anchors.length})`);
    }
    const xs = anchors.map((a) => a.x);
    const xc = xs.reduce((s, v) => s + v, 0) / xs.length;
    const span = Math.max(...xs) - Math.min(...xs);
    const scale = span > 0 ? span : 1;
    const u = (v: number) => (v - xc) / scale;

    const m = degree + 1;
    const A: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
    const b = new Array(m).fill(0);
    for (const a of anchors) {
        const ui = u(a.x);
        const powers = Array.from({ length: 2 * degree + 1 }, (_, k) => Math.pow(ui, k));
        for (let r = 0; r < m; r++) {
            b[r] += a.y * powers[r];
            for (let c = 0; c < m; c++) A[r][c] += powers[r + c];
        }
    }
    const coeff = solve(A, b);

    return x.map((v) => {
        const ui = u(v);
        let s = 0;
        for (let k = 0; k < coeff.length; k++) s += coeff[k] * Math.pow(ui, k);
        return s;
    });
}

/** Baseline samples for a trace under a given spec. */
export function baselineFor(x: number[], yA: number[], spec: BaselineSpec): number[] {
    if (spec.kind === "none") return new Array(x.length).fill(0);
    if (spec.kind === "rubberband") return rubberbandBaseline(x, yA);
    return polynomialBaseline(x, spec.anchors, spec.degree);
}

/** Raw minus baseline. */
export function corrected(yA: number[], baseline: number[]): number[] {
    return yA.map((v, i) => v - (baseline[i] ?? 0));
}

/**
 * Detect the failure mode that matters with a rubberband: the hull climbing into
 * a band and shaving it. Flags when the tallest corrected band keeps less than
 * 80 % of the height it had above the raw minimum.
 */
export function rubberbandCaution(yA: number[], baseline: number[]): string | null {
    if (!yA.length) return null;
    const rawMax = Math.max(...yA);
    const rawMin = Math.min(...yA);
    const rawHeight = rawMax - rawMin;
    if (rawHeight <= 0) return null;
    const corr = corrected(yA, baseline);
    const corrHeight = Math.max(...corr);
    if (corrHeight < rawHeight * 0.8) {
        const kept = Math.round((corrHeight / rawHeight) * 100);
        return `Rubberband may be cutting into a band — the tallest peak keeps only ${kept}% of its height. Consider manual anchors.`;
    }
    return null;
}

/** Residual (raw − corrected) is by definition equal to the baseline. */
export function residual(yA: number[], baseline: number[]): number[] {
    return corrected(yA, baseline);
}
