/**
 * Golden geometry tests for the extracted plotting core + XRD figure builder.
 *
 * Phase A moved these out of xrd-plotter.tsx without changing a line. The hash
 * below locks the primitive stream: if a later edit to core.ts (which the FTIR
 * plotter also uses) moves an axis, a tick or a label, this fails loudly instead
 * of shipping a subtly different figure.
 *
 * Regenerate intentionally — and only when a visual change is the point:
 *   bun test src/lib/plot/__tests__/figure.golden.test.ts --update
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { PRINT_LAYOUT, screenLayout, niceStep, textWidth } from "@/lib/plot/core";
import { buildFigure, type Trace } from "@/lib/xrd/figure";
import { parseScan } from "@/lib/xrd/parse";

function makeTrace(
    id: string,
    label: string,
    color: string,
    shift: number,
    amp: number,
): Trace {
    const x: number[] = [];
    const y: number[] = [];
    for (let t = 5; t <= 50.0001; t += 0.02) {
        const v =
            100 +
            amp * Math.exp(-((t - shift) ** 2) / 0.08) +
            40 * Math.exp(-((t - (shift + 10)) ** 2) / 0.2);
        x.push(Math.round(t * 100) / 100);
        y.push(Math.round(v * 1000) / 1000);
    }
    return {
        id,
        label,
        fileName: `${label.replace(/\s+/g, "_")}.xy`,
        color,
        x,
        y,
        peak2Theta: shift,
        peakIntensity: amp,
        visible: true,
    };
}

const TRACES = [
    makeTrace("a", "Ni-BDC", "#1D4ED8", 9.2, 900),
    makeTrace("b", "Cu-BDC", "#C2410C", 11.8, 700),
];

describe("xrd figure — golden geometry", () => {
    test("primitive stream is stable", () => {
        const prims = buildFigure(
            TRACES, 5, 50, 34, true, null, null, PRINT_LAYOUT, TRACES, null,
        );
        const json = JSON.stringify(prims);
        const hash = createHash("sha256").update(json).digest("hex");

        expect(prims.length).toBe(EXPECTED.count);
        expect(hash).toBe(EXPECTED.hash);
    });

    test("print layout is fixed so exports never depend on screen size", () => {
        expect(PRINT_LAYOUT).toEqual({
            W: 1210,
            H: 760,
            M: { l: 86, r: 30, t: 34, b: 88 },
            tickFont: 13,
            titleFont: 15,
            legendFont: 12,
            hklFont: 9.5,
            legendInPlot: true,
            showHkl: true,
        });
    });

    test("screen layout never drops type below 11px", () => {
        for (const w of [280, 390, 560, 768, 840, 1440, 2560]) {
            const L = screenLayout(w);
            expect(Math.min(L.tickFont, L.titleFont, L.legendFont)).toBeGreaterThanOrEqual(11);
            expect(L.W).toBeGreaterThanOrEqual(280);
        }
    });

    test("tick step follows the 1-2-5 progression", () => {
        expect(niceStep(40)).toBe(5); // 5.0 lands exactly on the ladder
        expect(niceStep(45)).toBe(10); // 5.625 rounds UP to the next step
        expect(niceStep(15)).toBe(2); // 1.875 → 2
        expect(niceStep(0)).toBe(10); // degenerate span falls back
    });

    test("text width estimate stays monotonic", () => {
        expect(textWidth("MMM", 12)).toBeGreaterThan(textWidth("iii", 12));
        expect(textWidth("", 12)).toBe(0);
    });
});

describe("xrd parsing — unchanged by the move", () => {
    test("reads a Rigaku header and two-column body", () => {
        const text = [
            '*FILE_SAMPLE "Ni-BDC solvothermal"',
            "*DATE 2026-01-01",
            "5.00 120",
            "5.02 135",
            "5.04 141",
        ].join("\n");
        const { x, y, sample } = parseScan(text);
        expect(sample).toBe("Ni-BDC solvothermal");
        expect(x).toEqual([5, 5.02, 5.04]);
        expect(y).toEqual([120, 135, 141]);
    });

    test("skips comment lines and non-numeric rows", () => {
        const { x, y } = parseScan("# comment\n\nfoo bar\n10 200\n11 210");
        expect(x).toEqual([10, 11]);
        expect(y).toEqual([200, 210]);
    });
});

/**
 * Locked from the pre-refactor component: this exact hash was produced by
 * xrd-plotter.tsx before Phase A and by lib/xrd/figure.ts after it.
 */
const EXPECTED = {
    count: 53,
    hash: "b6e405399914934da36729377d685cda9055ae68e06da008ba18882401ed2085",
};
