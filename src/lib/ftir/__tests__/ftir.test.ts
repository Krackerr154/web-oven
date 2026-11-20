import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { FtirParseError, parseFtir } from "@/lib/ftir/parse";
import { buildFtirFigure, legendGeometry, plotFrame, wavenumberStep, zoomWindow, type FigureTrace } from "@/lib/ftir/figure";
import { toAbsorbance, toTransmittance, convert } from "@/lib/ftir/model";
import { demoCsv, demoSeries } from "@/lib/ftir/demo";
import { PRINT_LAYOUT } from "@/lib/plot/core";

function ascii(n = 60, ascending = false): string {
    const rows = ["*FILE_SAMPLE \"unit test\"", "# wavenumber,transmittance"];
    for (let i = 0; i < n; i++) {
        const w = ascending ? 400 + i * 10 : 4000 - i * 10;
        rows.push(`${w} ${90 - (i % 5)}`);
    }
    return rows.join("\n");
}

describe("ftir parser — plain text", () => {
    test("reads a banner + two-column body", () => {
        const s = parseFtir(ascii());
        expect(s.x.length).toBe(60);
        expect(s.sample).toBe("unit test");
        expect(s.x[0]).toBe(4000);
        expect(s.x[s.x.length - 1]).toBe(3410);
    });

    test("reverses an ascending file exactly once", () => {
        const s = parseFtir(ascii(60, true));
        expect(s.x[0]).toBeGreaterThan(s.x[s.x.length - 1]);
        expect(s.x[0]).toBe(990);
        expect(s.warnings).toContain("axis reversed to descending");
    });

    test("accepts decimal commas", () => {
        const text = ["3500,5 90,0", ...Array.from({ length: 30 }, (_, i) => `${3000 - i * 10} 88,5`)].join("\n");
        const s = parseFtir(text);
        expect(s.x[0]).toBe(3500.5);
        expect(s.warnings).toContain("decimal comma interpreted as decimal separator");
    });

    test("detects transmittance from a header", () => {
        const text = ["*YUNITS %Transmittance", ...Array.from({ length: 30 }, (_, i) => `${4000 - i * 10} ${95 - (i % 3)}`)].join("\n");
        expect(parseFtir(text).unit).toBe("transmittance");
    });

    test("detects absorbance from the value range", () => {
        const text = Array.from({ length: 40 }, (_, i) => `${4000 - i * 10} ${(Math.sin(i / 5) + 1.2).toFixed(3)}`).join("\n");
        expect(parseFtir(text).unit).toBe("absorbance");
    });

    test("refuses proprietary binaries with an actionable message", () => {
        expect(() => parseFtir("x".repeat(100), "sample.0")).toThrow(FtirParseError);
        try {
            parseFtir("x".repeat(100), "sample.sp");
        } catch (e) {
            expect((e as Error).message).toContain("export it as CSV or TXT");
        }
    });

    test("refuses a file with too few points", () => {
        expect(() => parseFtir("4000 90\n3998 89\n3996 88")).toThrow(/needs hundreds/);
    });

    test("refuses binary content masquerading as text", () => {
        expect(() => parseFtir("\u0000\u0001binary".padEnd(80, "\u0000"))).toThrow(/binary/);
    });
});

describe("ftir parser — JCAMP-DX", () => {
    test("reads an XYPAIRS block", () => {
        const lines = [
            "##TITLE= JCAMP unit test",
            "##JCAMP-DX= 5.01",
            "##YUNITS= TRANSMITTANCE",
            "##XFACTOR= 1.0",
            "##YFACTOR= 1.0",
            "##XYPOINTS= (XY..XY)",
        ];
        for (let i = 0; i < 40; i++) lines.push(`${4000 - i * 5},${(92 - (i % 4)).toFixed(1)}`);
        lines.push("##END=");
        const s = parseFtir(lines.join("\n"));
        expect(s.format).toBe("JCAMP-DX");
        expect(s.x.length).toBe(40);
        expect(s.x[0]).toBe(4000);
        expect(s.unit).toBe("transmittance");
    });

    test("reads an X++ block using ##DELTAX", () => {
        const lines = [
            "##TITLE= compressed",
            "##YUNITS= TRANSMITTANCE",
            "##DELTAX= -2",
            "##XYDATA= (X++(Y..Y))",
            "4000 90 89 88 87 86 85 84 83 82 81",
            "3980 90 89 88 87 86 85 84 83 82 81",
            "3960 90 89 88 87 86 85 84 83 82 81",
        ];
        const s = parseFtir(lines.join("\n"));
        expect(s.x[0]).toBe(4000);
        expect(s.x[1]).toBe(3998);
        expect(s.x.length).toBe(30);
    });
});

describe("ftir units", () => {
    test("T → A → T round trip", () => {
        const t = [100, 50, 10, 1];
        const back = toTransmittance(toAbsorbance(t, "transmittance"));
        back.forEach((v, i) => expect(v).toBeCloseTo(t[i], 6));
    });

    test("0 %T is clamped instead of becoming Infinity", () => {
        expect(toAbsorbance([0], "transmittance")[0]).toBeCloseTo(4, 5);
    });

    test("convert is identity when units match", () => {
        expect(convert([1, 2, 3], "absorbance", "absorbance")).toEqual([1, 2, 3]);
    });
});

describe("ftir figure", () => {
    const demo = demoCsv("ni-bdc");
    const parsed = parseFtir(demo.text, demo.fileName);

    const traces: FigureTrace[] = [
        {
            id: "t1",
            label: "Ni-BDC",
            color: "#1D4ED8",
            x: parsed.x,
            y: parsed.y,
            visible: true,
        },
    ];

    test("wavenumber runs right-to-left", () => {
        const prims = buildFtirFigure(traces, {
            lo: 400,
            hi: 4000,
            gap: 0,
            stacked: false,
            unit: "transmittance",
        });
        const axes = prims.filter((p) => p.t === "text" && /^\d+$/.test((p as { s: string }).s));
        const four = axes.find((p) => (p as { s: string }).s === "4000") as { x: number };
        const rightmost = axes.reduce(
            (acc, p) => ((p as { x: number }).x > (acc as { x: number }).x ? p : acc),
            axes[0],
        ) as { x: number };
        expect(four.x).toBeLessThan(rightmost.x);
    });

    test("absorption dips downward in %T", () => {
        const prims = buildFtirFigure(traces, {
            lo: 400,
            hi: 4000,
            gap: 0,
            stacked: false,
            unit: "transmittance",
        });
        const poly = prims.find((p) => p.t === "poly") as { pts: Array<[number, number]> };
        expect(poly.pts.length).toBeGreaterThan(100);
        // y grows downward on canvas: the 1579 band must sit below the 4000 baseline
        const at = (target: number) => {
            let best = poly.pts[0];
            for (const p of poly.pts) if (Math.abs(p[0] - target) < Math.abs(best[0] - target)) best = p;
            return best[1];
        };
        const left = at(10);
        const band = at(10 + (4000 - 1579) / (4000 - 400) * 700); // approximate x of 1579
        expect(band).toBeGreaterThan(left);
    });

    test("legend lists every visible trace and none hidden", () => {
        const two: FigureTrace[] = [traces[0], { ...traces[0], id: "t2", label: "Cu-BDC", visible: false }];
        const prims = buildFtirFigure(two, { lo: 400, hi: 4000, gap: 0, stacked: false, unit: "transmittance" });
        const texts = prims.filter((p) => p.t === "text").map((p) => (p as { s: string }).s);
        expect(texts).toContain("Ni-BDC");
        expect(texts).not.toContain("Cu-BDC");
    });

    test("geometry is deterministic", () => {
        const build = () =>
            buildFtirFigure(traces, {
                lo: 400,
                hi: 4000,
                gap: 20,
                stacked: true,
                unit: "transmittance",
                layout: PRINT_LAYOUT,
            });
        const a = createHash("sha256").update(JSON.stringify(build())).digest("hex");
        const b = createHash("sha256").update(JSON.stringify(build())).digest("hex");
        expect(a).toBe(b);
    });

    test("tick step follows the IR ladder", () => {
        expect(wavenumberStep(3600)).toBe(500);
        expect(wavenumberStep(1000)).toBe(100);
        expect(wavenumberStep(100)).toBe(10);
    });
});

describe("demo spectra", () => {
    test("demo parses through the real parser", () => {
        const d = demoCsv("cu-bdc");
        const s = parseFtir(d.text, d.fileName);
        expect(s.unit).toBe("transmittance");
        expect(s.x.length).toBeGreaterThan(1700);
    });

    test("carboxylate bands land where they should", () => {
        const { x, y } = demoSeries("cu-bdc");
        // local minima in %T within ±40 cm⁻¹ of the literature positions
        const minima = (centre: number) => {
            let best = Infinity;
            let at = 0;
            for (let i = 1; i < x.length - 1; i++) {
                if (Math.abs(x[i] - centre) > 40) continue;
                if (y[i] < y[i - 1] && y[i] < y[i + 1] && y[i] < best) {
                    best = y[i];
                    at = x[i];
                }
            }
            return at;
        };
        expect(Math.abs(minima(1569) - 1569)).toBeLessThanOrEqual(4);
        expect(Math.abs(minima(1396) - 1396)).toBeLessThanOrEqual(4);
    });
});

describe("ftir figure — baseline and residual", () => {
    const demo = parseFtir(demoCsv("ni-bdc").text, "ni-bdc-demo.csv");
    const base = { lo: 400, hi: 4000, gap: 0, stacked: false, unit: "transmittance" as const };
    const trace = (withBaseline: boolean): FigureTrace => ({
        id: "t1",
        label: "Ni-BDC",
        color: "#1D4ED8",
        x: demo.x,
        y: demo.y,
        baseline: withBaseline ? demo.y.map((v) => v + 12) : null,
        visible: true,
    });

    test("draws a dashed baseline polyline in the trace colour", () => {
        const prims = buildFtirFigure([trace(true)], base);
        const polys = prims.filter((p) => p.t === "poly") as Array<{ dash?: number[] }>;
        expect(polys.length).toBe(2);
        expect(polys.some((p) => p.dash && p.dash.length === 2)).toBe(true);
    });

    test("no baseline polyline when the trace has none", () => {
        const prims = buildFtirFigure([trace(false)], base);
        expect(prims.filter((p) => p.t === "poly").length).toBe(1);
    });

    test("residual strip shortens the main panel and adds its own axis", () => {
        const plain = plotFrame(PRINT_LAYOUT, false);
        const withRes = plotFrame(PRINT_LAYOUT, true);
        expect(withRes.mainH).toBeLessThan(plain.mainH);
        expect(withRes.resH).toBeGreaterThan(0);

        const prims = buildFtirFigure([trace(true)], { ...base, showResidual: true });
        const texts = prims.filter((p) => p.t === "text").map((p) => (p as { s: string }).s);
        expect(texts.some((t) => t.startsWith("residual"))).toBe(true);
    });

    test("residual strip draws a zero reference line", () => {
        const prims = buildFtirFigure([trace(true)], { ...base, showResidual: true });
        const dashed = prims.filter((p) => p.t === "line" && (p as { dash?: number[] }).dash);
        expect(dashed.length).toBeGreaterThan(0);
    });
});

describe("zoom window", () => {
    test("normalises a right-to-left drag", () => {
        expect(zoomWindow(1800, 1200)).toEqual([1200, 1800]);
        expect(zoomWindow(1200, 1800)).toEqual([1200, 1800]);
    });

    test("clamps to the IR range", () => {
        const [lo, hi] = zoomWindow(200, 6000);
        expect(lo).toBe(400);
        expect(hi).toBe(4000);
    });

    test("widens a too-short drag to the minimum span", () => {
        const [lo, hi] = zoomWindow(1990, 1995, 50);
        expect(hi - lo).toBe(50);
        expect(lo).toBeLessThanOrEqual(1990);
        expect(hi).toBeGreaterThanOrEqual(1995);
    });

    test("a drag over the low edge stays inside the range", () => {
        const [lo, hi] = zoomWindow(395, 410, 50);
        expect(lo).toBe(400);
        expect(hi).toBe(450);
    });

    test("degenerate input falls back to the full range", () => {
        expect(zoomWindow(NaN, NaN)).toEqual([400, 4000]);
    });
});

describe("legend geometry", () => {
    const demo = parseFtir(demoCsv("ni-bdc").text, "ni-bdc-demo.csv");
    const t = (id: string, visible = true): FigureTrace => ({
        id, label: `Trace ${id}`, color: "#1D4ED8", x: demo.x, y: demo.y, visible,
    });

    test("is null when no trace is visible", () => {
        expect(legendGeometry([t("a", false)], {})).toBeNull();
    });

    test("one row per visible trace, all inside the plot box", () => {
        const g = legendGeometry([t("a"), t("b"), t("c", false)], {});
        expect(g).not.toBeNull();
        expect(g!.rows.map((r) => r.id)).toEqual(["a", "b"]);
        const { PW, mainH } = plotFrame(PRINT_LAYOUT, false);
        for (const row of g!.rows) {
            expect(row.x).toBeGreaterThanOrEqual(PRINT_LAYOUT.M.l);
            expect(row.x + row.w).toBeLessThanOrEqual(PRINT_LAYOUT.M.l + PW + 1e-6);
            expect(row.y).toBeGreaterThanOrEqual(PRINT_LAYOUT.M.t);
            expect(row.y + row.h).toBeLessThanOrEqual(PRINT_LAYOUT.M.t + mainH + 1e-6);
        }
    });

    test("the box is the same rect the figure draws", () => {
        const traces = [t("a"), t("b")];
        const g = legendGeometry(traces, { layout: PRINT_LAYOUT })!;
        const prims = buildFtirFigure(traces, {
            lo: 400, hi: 4000, gap: 0, stacked: false, unit: "transmittance", layout: PRINT_LAYOUT,
        });
        const rect = prims.find((p) => p.t === "rect" && (p as { opacity?: number }).opacity === 0.93) as
            | { x: number; y: number; w: number; h: number }
            | undefined;
        expect(rect).toBeDefined();
        expect(rect!.x).toBeCloseTo(g.box.x, 6);
        expect(rect!.y).toBeCloseTo(g.box.y, 6);
        expect(rect!.w).toBeCloseTo(g.box.w, 6);
        expect(rect!.h).toBeCloseTo(g.box.h, 6);
    });
});
