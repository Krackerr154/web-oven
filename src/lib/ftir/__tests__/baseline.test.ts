import { describe, expect, test } from "bun:test";
import {
    baselineFor,
    corrected,
    nearestIndex,
    polynomialBaseline,
    rubberbandBaseline,
    rubberbandCaution,
    type Anchor,
} from "@/lib/ftir/baseline";

const STEP = 2;
const X: number[] = [];
for (let w = 4000; w >= 400; w -= STEP) X.push(w);

/** Smooth baseline + three absorption bands, in absorbance units. */
function synthetic(offset = 0) {
    const base = (w: number) => {
        const u = (w - 2200) / 1800;
        return 0.05 + 0.03 * u + 0.02 * u * u + offset;
    };
    const peak = (w: number, c: number, h: number, fw: number) =>
        h * Math.exp(-0.5 * ((w - c) / (fw / 2.355)) ** 2);
    const y = X.map(
        (w) => base(w) + peak(w, 1580, 0.6, 30) + peak(w, 1360, 0.4, 26) + peak(w, 1100, 0.25, 40),
    );
    return { y, base };
}

const anchorsAt = (base: (w: number) => number, xs: number[]): Anchor[] =>
    xs.map((x) => ({ x, y: base(x) }));

describe("baseline — manual anchors", () => {
    test("two anchors reproduce the analytic straight line", () => {
        const y = new Array(X.length).fill(0);
        const anchors: Anchor[] = [
            { x: 4000, y: 0.2 },
            { x: 400, y: 0.6 },
        ];
        const b = polynomialBaseline(X, anchors, 1);
        X.forEach((w, i) => {
            const expected = 0.2 + ((4000 - w) / 3600) * 0.4;
            expect(Math.abs(b[i] - expected)).toBeLessThan(1e-9);
        });
        expect(y.length).toBe(X.length);
    });

    test("quadratic fit recovers a quadratic baseline and the peaks survive", () => {
        const { y, base } = synthetic();
        const anchors = anchorsAt(base, [3800, 3000, 2400, 1800, 900, 500]);
        const b = polynomialBaseline(X, anchors, 2);
        const corr = corrected(y, b);

        // baseline recovered
        const baseErr = Math.max(...X.map((_, i) => Math.abs(b[i] - base(X[i]))));
        expect(baseErr).toBeLessThan(1e-3);

        // peak positions unchanged, heights within 0.5 %
        const peakAt = (arr: number[], c: number) => {
            let best = -Infinity;
            let at = 0;
            for (let i = 0; i < X.length; i++) {
                if (Math.abs(X[i] - c) > 40) continue;
                if (arr[i] > best) {
                    best = arr[i];
                    at = X[i];
                }
            }
            return { at, h: best };
        };
        for (const [c, h] of [[1580, 0.6], [1360, 0.4], [1100, 0.25]] as const) {
            const p = peakAt(corr, c);
            expect(p.at).toBe(c);
            expect(Math.abs(p.h - h) / h).toBeLessThan(0.005);
        }
    });

    test("too few anchors for the degree is refused with a clear message", () => {
        expect(() => polynomialBaseline(X, [{ x: 4000, y: 0 }], 1)).toThrow(/needs at least 2 anchors/);
        expect(() =>
            polynomialBaseline(X, [{ x: 4000, y: 0 }, { x: 3000, y: 0 }], 3),
        ).toThrow(/needs at least 4 anchors/);
    });
});

describe("baseline — rubberband", () => {
    test("returns a strictly convex curve unchanged in the interior", () => {
        const convex = X.map((w) => 0.001 * ((w - 2200) / 600) ** 2 + 0.4);
        const b = rubberbandBaseline(X, convex);
        for (let i = 20; i < X.length - 20; i++) {
            expect(Math.abs(b[i] - convex[i])).toBeLessThan(1e-6);
        }
    });

    test("never rises above the data (it is a lower hull)", () => {
        const { y } = synthetic();
        const b = rubberbandBaseline(X, y);
        for (let i = 0; i < y.length; i++) expect(b[i]).toBeLessThanOrEqual(y[i] + 1e-9);
    });

    test("leaves the bands standing on the true baseline", () => {
        const { y, base } = synthetic();
        const b = rubberbandBaseline(X, y);
        const corr = corrected(y, b);
        let best = -Infinity;
        let at = 0;
        for (let i = 0; i < X.length; i++) {
            if (Math.abs(X[i] - 1580) < 40 && corr[i] > best) {
                best = corr[i];
                at = X[i];
            }
        }
        expect(at).toBe(1580);
        expect(Math.abs(best - 0.6) / 0.6).toBeLessThan(0.05); // hull is a touch below the fit
        expect(Math.abs(b[0] - base(4000))).toBeLessThan(0.05);
    });

    test("flags a hull that shaves a band", () => {
        // A broad band plus a hull anchored inside it: corrected height collapses.
        const broad = X.map((w) => 0.5 * Math.exp(-0.5 * ((w - 2000) / 700) ** 2));
        const b = broad.map((v) => v * 0.95); // hull 95 % up the band = pathological
        expect(rubberbandCaution(broad, b)).toContain("cutting into a band");
        expect(rubberbandCaution(broad, broad.map(() => 0))).toBeNull();
    });
});

describe("baseline — invariants", () => {
    test("adding a constant to the spectrum does not change the correction", () => {
        const a = synthetic(0);
        const c = synthetic(5);
        const anchors = anchorsAt(a.base, [3800, 3000, 1800, 900]);
        const anchorsShifted = anchors.map((p) => ({ ...p, y: p.y + 5 }));
        const corrA = corrected(a.y, polynomialBaseline(X, anchors, 2));
        const corrC = corrected(c.y, polynomialBaseline(X, anchorsShifted, 2));
        for (let i = 0; i < X.length; i += 50) {
            expect(Math.abs(corrA[i] - corrC[i])).toBeLessThan(1e-6);
        }
    });

    test("none means no correction at all", () => {
        const { y } = synthetic();
        const b = baselineFor(X, y, { kind: "none" });
        expect(b.every((v) => v === 0)).toBe(true);
        expect(corrected(y, b)).toEqual(y);
    });

    test("corrected signal is non-negative outside noise", () => {
        const { y } = synthetic();
        const corr = corrected(y, rubberbandBaseline(X, y));
        const min = Math.min(...corr);
        expect(min).toBeGreaterThan(-1e-6);
    });

    test("nearestIndex snaps to a data point", () => {
        expect(X[nearestIndex(X, 1579)]).toBe(1580);
        expect(X[nearestIndex(X, 399)]).toBe(400);
    });
});
