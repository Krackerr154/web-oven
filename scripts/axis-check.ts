import { demoCsv } from "@/lib/ftir/demo";
import { parseFtir } from "@/lib/ftir/parse";
import { toAbsorbance } from "@/lib/ftir/model";
import { buildFtirFigure } from "@/lib/ftir/figure";
import { screenLayout, textWidth } from "@/lib/plot/core";

const s = parseFtir(demoCsv("ni-bdc").text, "x.csv");
const yA = toAbsorbance(s.y, s.unit);

for (const w of [1440, 768, 390]) {
  const base = screenLayout(w);
  const M = { ...base.M, t: Math.max(base.M.t, 26), l: Math.max(base.M.l, 54), b: Math.max(base.M.b, 64) };
  const L = { ...base, H: Math.max(250, Math.min(470, w * 0.36)), M };
  const prims = buildFtirFigure(
    [{ id: "t", label: "Ni-BDC", color: "#1D4ED8", x: s.x, y: yA, visible: true }],
    { lo: 400, hi: 4000, gap: 0, stacked: false, unit: "absorbance", layout: L },
  );
  const bg = prims[0] as any;
  const texts = prims.filter((p: any) => p.t === "text") as any[];
  const yTitle = texts.find((p) => p.s.startsWith("Absorbance") || p.s.startsWith("Transmittance"));
  const yTicks = texts.filter((p) => /^[\d.]+$/.test(p.s) && p.anchor === "end");
  const widest = Math.max(...yTicks.map((p) => textWidth(p.s, p.size)));
  console.log(
    `${w}px  bg=${bg.fill} ${bg.w}x${bg.h}`,
    `| yTitle y=${yTitle.y} size=${yTitle.size} (frame top ${M.t})`,
    `| yTicks ${yTicks.length}, widest ${widest.toFixed(0)}px, right edge ${(M.l - 9).toFixed(0)}`,
    `| tick left ${(M.l - 9 - widest).toFixed(0)} vs title left ${M.l}`,
  );
}
