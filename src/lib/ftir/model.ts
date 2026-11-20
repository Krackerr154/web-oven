/**
 * FTIR unit handling.
 *
 * Baseline maths and any future quantitative work must happen in absorbance:
 * Beer–Lambert is additive in A, multiplicative in %T. Everything downstream of
 * the parser therefore works in A, and only the renderer converts back.
 */

import type { AxisUnit } from "./parse";

/** Transmittance percent → absorbance. Clamped so 0 %T does not become Infinity. */
export function toAbsorbance(y: number[], unit: AxisUnit): number[] {
    if (unit === "absorbance") return y;
    return y.map((t) => -Math.log10(Math.max(t, 0.01) / 100));
}

/** Absorbance → transmittance percent. */
export function toTransmittance(y: number[]): number[] {
    return y.map((a) => 100 * Math.pow(10, -a));
}

/** Convert a trace's native values into the display unit. */
export function convert(y: number[], from: AxisUnit, to: AxisUnit): number[] {
    if (from === to) return y;
    return to === "absorbance" ? toAbsorbance(y, from) : toTransmittance(y);
}

/** Min/max of an array, returning [0, 1] for degenerate input. */
export function extent(y: number[]): [number, number] {
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of y) {
        if (!Number.isFinite(v)) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
    if (hi - lo < 1e-9) return [lo - 0.5, hi + 0.5];
    return [lo, hi];
}

/**
 * Scale a trace's intensity by its maximum, keeping ratios honest.
 * Zero-maximum spectra are returned unchanged rather than divided by zero.
 */
export function normaliseToMax(y: number[]): number[] {
    const [, hi] = extent(y);
    if (!Number.isFinite(hi) || Math.abs(hi) < 1e-9) return y;
    return y.map((v) => v / hi);
}
