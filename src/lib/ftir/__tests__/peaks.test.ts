import { describe, expect, test } from "bun:test";
import { detectPeaks, localMaxima, placeLabels } from "@/lib/ftir/peaks";

const STEP = 2;
const X: number[] = [];
for (let w = 4000; w >= 400; w -= STEP) X.push(w);

const gauss = (w: number, c: number, h: number, fw: number) =>
    h * Math.exp(-0.5 * ((w - c) / (fw / 2.355)) ** 2);

/** Corrected-absorbance-like signal: flat zero + three bands. */
function spectrum(extra: Array<[number, number, number]> = []) {
    return X.map((w) => {
        let v = 0.02;
        v += gauss(w, 1580, 0.6, 30);
        v += gauss(w, 1354, 0.4, 26);
        v += gauss(w, 1105, 0.25, 40);
        for (const [c, h, fw] of extra) v += gauss(w, c, h, fw);
        return v;
    });
}

describe("peak detection", () => {
    test("finds the three synthetic bands at their exact positions", () => {
        const peaks = detectPeaks(X, spectrum(), { minProminencePct: 4 });
        const xs = peaks.map((p) => p.x);
        expect(xs).toContain(1580);
        expect(xs).toContain(1354);
        expect(xs).toContain(1106);
        expect(peaks.length).toBe(3);
    });

    test("prominence is measured from the higher adjacent valley", () => {
        const peaks = localMaxima(X, spectrum());
        const main = peaks.find((p) => p.x === 1580)!;
        // The 1580 band sits on a floor of ~0.02, so its prominence ≈ its height.
        expect(main.prominence).toBeGreaterThan(0.5);
        expect(main.prominence).toBeLessThan(0.62);
    });

    test("a weak shoulder is suppressed by the threshold", () => {
        const withShoulder = spectrum([[1500, 0.03, 20]]);
        const loose = detectPeaks(X, withShoulder, { minProminencePct: 0.5, minSeparation: 10 });
        const tight = detectPeaks(X, withShoulder, { minProminencePct: 10 });
        expect(loose.length).toBeGreaterThan(tight.length);
        expect(tight.some((p) => Math.abs(p.x - 1500) < 6)).toBe(false);
    });

    test("minimum separation merges peaks that are too close", () => {
        const doublet = X.map((w) => 0.02 + gauss(w, 1600, 0.3, 10) + gauss(w, 1565, 0.3, 10));
        const merged = detectPeaks(X, doublet, { minSeparation: 40, minProminencePct: 2 });
        const apart = detectPeaks(X, doublet, { minSeparation: 4, minProminencePct: 2 });
        expect(merged.length).toBeLessThan(apart.length);
        for (let i = 0; i < merged.length; i++) {
            for (let j = i + 1; j < merged.length; j++) {
                expect(Math.abs(merged[i].x - merged[j].x)).toBeGreaterThanOrEqual(40 - 1e-9);
            }
        }
    });

    test("the cap keeps the strongest bands", () => {
        const many = spectrum([
            [3000, 0.5, 60],
            [2500, 0.45, 50],
            [2000, 0.4, 45],
            [900, 0.35, 40],
        ]);
        const capped = detectPeaks(X, many, { maxCount: 3, minProminencePct: 2 });
        expect(capped.length).toBe(3);
        const ys = capped.map((p) => p.y).sort((a, b) => b - a);
        expect(ys[0]).toBeGreaterThan(0.55); // keeps the tallest, not the first found
    });

    test("a flat trace yields nothing", () => {
        expect(detectPeaks(X, new Array(X.length).fill(1), {})).toEqual([]);
    });
});

describe("label placement", () => {
    const toPx = (w: number) => (4000 - w) / 2; // 0..1800 px across the axis
    const toPy = (v: number) => 300 - v * 200;

    test("places labels for well-separated peaks", () => {
        const placed = placeLabels(
            [
                { key: "a", x: 1580, y: 0.6, text: "1580", widthPx: 30 },
                { key: "b", x: 1354, y: 0.4, text: "1354", widthPx: 30 },
            ],
            toPx,
            toPy,
            { fontSize: 11, plotLeft: 0, plotRight: 2000, plotTop: 0 },
        );
        expect(placed.length).toBe(2);
    });

    test("drops a label that cannot fit, rather than overlapping", () => {
        // Two peaks 4px apart: the second has nowhere to go beyond its rows.
        const placed = placeLabels(
            [
                { key: "a", x: 1580, y: 0.6, text: "1580", widthPx: 60 },
                { key: "b", x: 1578, y: 0.59, text: "1578", widthPx: 60 },
                { key: "c", x: 1576, y: 0.58, text: "1576", widthPx: 60 },
                { key: "d", x: 1574, y: 0.57, text: "1574", widthPx: 60 },
            ],
            toPx,
            toPy,
            { fontSize: 11, plotLeft: 0, plotRight: 2000, plotTop: 0, rows: 2 },
        );
        expect(placed.length).toBeLessThan(4);
        // whatever survived must not overlap
        for (let i = 0; i < placed.length; i++) {
            for (let j = i + 1; j < placed.length; j++) {
                const a = placed[i].box;
                const b = placed[j].box;
                const overlap = !(a.r < b.l || a.l > b.r || a.b < b.t || a.t > b.b);
                expect(overlap).toBe(false);
            }
        }
    });

    test("keeps labels inside the plot area", () => {
        const placed = placeLabels(
            [{ key: "edge", x: 4000, y: 0.5, text: "4000", widthPx: 40 }],
            toPx,
            toPy,
            { fontSize: 11, plotLeft: 10, plotRight: 300, plotTop: 0 },
        );
        expect(placed.length).toBe(0); // centre would be at x=0, outside the left edge
    });
});
