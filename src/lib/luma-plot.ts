import { z } from "zod";
import { seriesFromColumns, type Dataset } from "./luma-files";

/**
 * The plotting tool.
 *
 * The model chooses *which columns* and *what kind of figure* — it never
 * carries the numbers. A 7,500-point XRD scan would be ~90 kB of JSON in the
 * prompt and the model would still have to reproduce it exactly; instead the
 * server already holds the parsed grid and only the spec crosses the wire.
 */

export const PlotSpec = {
  name: "render_plot",
  description:
    "Render a figure from an attached data file and show it to the user. Use whenever the user asks to plot, graph, chart or visualise attached data. You choose the columns and the figure kind; the numbers are already loaded server-side, so never repeat them.",
  schema: z.object({
    dataset: z.number().int().min(0).max(1),
    kind: z.enum(["xy", "xrd", "cv", "tauc", "bar", "scatter"]),
    x: z.string().min(1).max(60),
    y: z.string().min(1).max(60),
    title: z.string().max(160).optional(),
    xlabel: z.string().max(120).optional(),
    ylabel: z.string().max(120).optional(),
    width_mm: z.number().min(40).max(180).optional(),
  }),
} as const;

export type PlotArgs = {
  dataset: number;
  kind: "xy" | "xrd" | "cv" | "tauc" | "bar" | "scatter";
  x: string;
  y: string;
  title?: string;
  xlabel?: string;
  ylabel?: string;
  width_mm?: number;
};

export type PlotResult =
  | { ok: true; png: string; caption: string; bytes: number }
  | { ok: false; error: string };

/** Sensible axis labels per figure kind, so the model does not have to guess. */
const AXIS_DEFAULTS: Record<string, { x: string; y: string }> = {
  xrd: { x: "2θ (degree)", y: "Intensity (a.u.)" },
  cv: { x: "Potential (V)", y: "Current (A)" },
  tauc: { x: "Photon energy (eV)", y: "(αhν)² (eV² cm⁻²)" },
};

export async function executePlot(
  args: PlotArgs,
  datasets: Dataset[],
): Promise<PlotResult> {
  const ds = datasets.find((d) => d.index === args.dataset) ?? datasets[0];
  if (!ds) return { ok: false, error: "no dataset attached" };

  const series = seriesFromColumns(ds, args.x, args.y);
  if ("error" in series) return { ok: false, error: series.error };

  const base = (process.env.XRD_SIM_URL ?? "http://xrd-sim:8000").replace(/\/$/, "");
  const defaults = AXIS_DEFAULTS[args.kind];
  const xLabel = args.xlabel ?? defaults?.x ?? args.x;
  const yLabel = args.ylabel ?? defaults?.y ?? args.y;

  // Unnamed columns ("col2") mean nothing to a reader; fall back to the axes.
  const generic = /^col\d+$/i;
  const subject =
    generic.test(args.x) || generic.test(args.y)
      ? `${yLabel} vs ${xLabel}`
      : `${args.y} vs ${args.x}`;

  const body = {
    kind: args.kind,
    series: [{ label: args.y, x: series.x, y: series.y }],
    xlabel: xLabel,
    ylabel: yLabel,
    title: args.title ?? "",
    width_mm: args.width_mm ?? 85,
    // 300 dpi keeps the 85 mm figure crisp when the chat column stretches it
    // past its natural 1004 px; at 200 dpi the browser upscaled and softened it.
    dpi: 300,
  };

  let res: Response;
  try {
    res = await fetch(`${base}/plot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    return {
      ok: false,
      error: `renderer unreachable: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    return { ok: false, error: `renderer ${res.status}: ${detail.slice(0, 200)}` };
  }

  const json = (await res.json()) as { png_base64?: string; bytes?: number };
  if (!json.png_base64) return { ok: false, error: "renderer returned no image" };

  return {
    ok: true,
    png: json.png_base64,
    bytes: json.bytes ?? 0,
    caption: `${args.kind.toUpperCase()} · ${subject} · ${ds.name}`,
  };
}
