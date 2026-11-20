import { demoCsv } from "@/lib/ftir/demo";
import { parseFtir } from "@/lib/ftir/parse";
import { toAbsorbance } from "@/lib/ftir/model";
import { buildFtirFigure } from "@/lib/ftir/figure";
import { PRINT_LAYOUT } from "@/lib/plot/core";

const s = parseFtir(demoCsv("ni-bdc").text, "x.csv");
const yA = toAbsorbance(s.y, s.unit);
const prims = buildFtirFigure(
  [{ id: "t", label: "Ni-BDC", color: "#1D4ED8", x: s.x, y: yA, visible: true }],
  { lo: 400, hi: 4000, gap: 0, stacked: false, unit: "absorbance", layout: PRINT_LAYOUT },
);
const by = (f: (p: any) => boolean) => prims.filter(f).length;
console.log("total prims:", prims.length);
console.log("grid lines (near-white):", by((p) => p.t === "line" && p.stroke === "#E2E8F0"));
console.log("axis strokes (#111827 lines):", by((p) => p.t === "line" && p.stroke === "#111827"));
console.log("text prims:", by((p) => p.t === "text"));
const sizes = new Map<number, number>();
for (const p of prims) if (p.t === "text") sizes.set(p.size, (sizes.get(p.size) ?? 0) + 1);
console.log("text sizes:", [...sizes.entries()].sort((a, b) => a[0] - b[0]));
console.log("polylines:", by((p) => p.t === "poly"));
console.log("rects:", by((p) => p.t === "rect"));
