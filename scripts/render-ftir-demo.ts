/** Dev utility: render the FTIR demo figure to /tmp/ftir-demo.html for visual review. */
import { demoCsv } from "@/lib/ftir/demo";
import { parseFtir } from "@/lib/ftir/parse";
import { buildFtirFigure, type FigureTrace } from "@/lib/ftir/figure";
import { convert } from "@/lib/ftir/model";
import { PRINT_LAYOUT, toSVG } from "@/lib/plot/core";

const ni = parseFtir(demoCsv("ni-bdc").text, "ni-bdc-demo.csv");
const cu = parseFtir(demoCsv("cu-bdc").text, "cu-bdc-demo.csv");

const mk = (label: string, s: ReturnType<typeof parseFtir>, color: string): FigureTrace => ({
    id: label, label, color, x: s.x, y: convert(s.y, s.unit, "transmittance"), visible: true,
});

const traces = [mk("Ni-BDC", ni, "#1D4ED8"), mk("Cu-BDC", cu, "#C2410C")];
const svg = toSVG(
    buildFtirFigure(traces, { lo: 400, hi: 4000, gap: 18, stacked: true, unit: "transmittance", layout: PRINT_LAYOUT }),
    PRINT_LAYOUT.W,
    PRINT_LAYOUT.H,
);
await Bun.write("/tmp/ftir-demo.html", `<!doctype html><meta charset=utf8><body style="margin:0;background:#fff">${svg}</body>`);
console.log("svg bytes:", svg.length, "layout:", PRINT_LAYOUT.W + "x" + PRINT_LAYOUT.H);
