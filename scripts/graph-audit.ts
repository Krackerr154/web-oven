import { demoCsv } from "@/lib/ftir/demo";
import { parseFtir } from "@/lib/ftir/parse";
import { detectPeaks, placeLabels } from "@/lib/ftir/peaks";
import { toAbsorbance } from "@/lib/ftir/model";
import { screenLayout, textWidth } from "@/lib/plot/core";
import { buildFtirFigure, plotFrame, wavenumberStep } from "@/lib/ftir/figure";

const s = parseFtir(demoCsv("ni-bdc").text, "x.csv");
const yA = toAbsorbance(s.y, s.unit);
const peaks = detectPeaks(s.x, yA, { minProminencePct: 4, minSeparation: 20, maxCount: 12 });

for (const w of [1440, 1024, 768, 390]) {
  const L = screenLayout(w);
  const H = Math.max(250, Math.min(470, w * 0.36));
  const layout = { ...L, H: Math.round(H) };
  const { PW, mainH } = plotFrame(layout, false);
  const M = layout.M;

  // same mapping the figure uses
  let lo = 1e9, hi = -1e9;
  for (const v of yA) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  const px = (x: number) => M.l + ((4000 - x) / 3600) * PW;
  const py = (y: number) => M.t + ((hi - y) / (hi - lo)) * mainH;

  const fs = Math.max(11, L.tickFont - 2);
  const reqs = peaks.map((p, i) => ({ key: String(i), x: p.x, y: p.y, text: String(Math.round(p.x)),
    widthPx: textWidth(String(Math.round(p.x)), fs) + 2 }));
  const placed = placeLabels(reqs, px, py, { fontSize: fs, plotLeft: M.l + 2, plotRight: M.l + PW - 2, plotTop: M.t + fs + 2, rows: 4 });

  const xStep = wavenumberStep(3600);
  const xTicks = Math.floor(3600 / xStep) + 1;
  const tickPx = (3600 / xStep) > 0 ? PW / (3600 / xStep) : PW;
  console.log(`${String(w).padStart(4)}px  canvas ${w}x${layout.H}  labels ${placed.length}/${peaks.length}  labelFont ${fs}px  xTicks ${xTicks} @${Math.round(tickPx)}px  tickFont ${L.tickFont}`);
}
