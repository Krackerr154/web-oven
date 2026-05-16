"use client";

import { useEffect, useMemo, useRef } from "react";
import type { DscDataPoint } from "@/lib/dsc/parser";
import type { DscPeakWithId } from "./types";
import { getCycleLabel } from "./utils";

type ExportFormat = "png" | "svg";

export type ChartExportHandlers = {
  exportImage: (format: ExportFormat) => Promise<void>;
};

type DscChartProps = {
  dataPoints: DscDataPoint[];
  peaks: DscPeakWithId[];
  selectedPeakId: string | null;
  showBaseline: boolean;
  manualMode: boolean;
  onSelectPeak: (peakId: string) => void;
  onManualRange: (startTempC: number, endTempC: number) => void;
  onPeakBoundsChange: (peakId: string, onsetTempC: number, offsetTempC: number) => void;
  onReady?: (handlers: ChartExportHandlers) => void;
};

type PlotlyTrace = Record<string, unknown>;
type PlotlyLayout = Record<string, unknown>;
type PlotlyConfig = Record<string, unknown>;

type PlotlyModule = {
  react: (
    element: HTMLDivElement,
    data: PlotlyTrace[],
    layout: PlotlyLayout,
    config: PlotlyConfig,
  ) => Promise<unknown>;
  purge: (element: HTMLDivElement) => void;
  downloadImage: (element: HTMLDivElement, options: { format: ExportFormat; filename: string; width: number; height: number }) => Promise<string>;
};

type PlotlyGraphDiv = HTMLDivElement & {
  on: (event: string, handler: (event: unknown) => void) => void;
  removeListener: (event: string, handler: (event: unknown) => void) => void;
};

type ShapeMeta = {
  peakId: string;
  boundary: "onset" | "offset";
};

type PlotlyClickEvent = {
  points?: { customdata?: string }[];
};

type PlotlySelectedEvent = {
  range?: { x?: [number, number] };
  points?: { x?: number }[];
};

type PlotlyRelayoutEvent = Record<string, number | string | boolean>;

const CYCLE_COLORS = ["#22d3ee", "#fb7185", "#a78bfa", "#34d399", "#fbbf24", "#60a5fa", "#f472b6", "#c084fc"];

export function DscChart({
  dataPoints,
  peaks,
  selectedPeakId,
  showBaseline,
  manualMode,
  onSelectPeak,
  onManualRange,
  onPeakBoundsChange,
  onReady,
}: DscChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotlyRef = useRef<PlotlyModule | null>(null);
  const shapeMetaRef = useRef<ShapeMeta[]>([]);
  const latestPeaksRef = useRef(peaks);
  latestPeaksRef.current = peaks;

  const chartModel = useMemo(() => buildChartModel(dataPoints, peaks, selectedPeakId, showBaseline), [
    dataPoints,
    peaks,
    selectedPeakId,
    showBaseline,
  ]);

  useEffect(() => {
    let active = true;
    let graphNode: PlotlyGraphDiv | null = null;

    const handleClick = (event: unknown) => {
      const clickEvent = event as PlotlyClickEvent;
      const peakId = clickEvent.points?.find((point) => typeof point.customdata === "string")?.customdata;
      if (peakId) onSelectPeak(peakId);
    };

    const handleSelected = (event: unknown) => {
      if (!manualMode) return;
      const selectedEvent = event as PlotlySelectedEvent;
      const range = selectedEvent.range?.x;
      if (range) {
        onManualRange(range[0], range[1]);
        return;
      }

      const xs = selectedEvent.points?.map((point) => point.x).filter((value): value is number => typeof value === "number");
      if (xs && xs.length > 1) onManualRange(Math.min(...xs), Math.max(...xs));
    };

    const handleRelayout = (event: unknown) => {
      const relayout = event as PlotlyRelayoutEvent;
      const updates = new Map<number, number>();

      for (const [key, value] of Object.entries(relayout)) {
        if (typeof value !== "number") continue;
        const match = /^shapes\[(\d+)]\.x[01]$/.exec(key);
        if (!match) continue;
        updates.set(Number(match[1]), value);
      }

      if (updates.size === 0) return;

      const boundaries = new Map<string, { onset?: number; offset?: number }>();
      for (const [shapeIndex, tempC] of updates) {
        const meta = shapeMetaRef.current[shapeIndex];
        if (!meta) continue;
        const item = boundaries.get(meta.peakId) ?? {};
        item[meta.boundary] = tempC;
        boundaries.set(meta.peakId, item);
      }

      for (const [peakId, boundary] of boundaries) {
        const peak = latestPeaksRef.current.find((item) => item.id === peakId);
        if (!peak) continue;
        onPeakBoundsChange(peakId, boundary.onset ?? peak.onsetTempC, boundary.offset ?? peak.offsetTempC);
      }
    };

    async function render() {
      if (!containerRef.current) return;

      const module = await import("plotly.js-dist-min");
      const plotly = ("default" in module ? module.default : module) as PlotlyModule;
      if (!active || !containerRef.current) return;

      plotlyRef.current = plotly;
      shapeMetaRef.current = chartModel.shapeMeta;

      const layout: PlotlyLayout = {
        autosize: true,
        paper_bgcolor: "rgba(15, 23, 42, 0)",
        plot_bgcolor: "rgba(15, 23, 42, 0.35)",
        margin: { l: 64, r: 28, t: 24, b: 58 },
        xaxis: {
          title: { text: "Sample Temperature (°C)", font: { color: "#cbd5e1" } },
          color: "#cbd5e1",
          gridcolor: "rgba(148, 163, 184, 0.14)",
          zerolinecolor: "rgba(148, 163, 184, 0.2)",
        },
        yaxis: {
          title: { text: "HeatFlow (mW)", font: { color: "#cbd5e1" } },
          color: "#cbd5e1",
          gridcolor: "rgba(148, 163, 184, 0.14)",
          zerolinecolor: "rgba(148, 163, 184, 0.2)",
        },
        legend: { orientation: "h", font: { color: "#cbd5e1" }, x: 0, y: -0.22 },
        hovermode: "closest",
        dragmode: manualMode ? "select" : "pan",
        selectdirection: "h",
        shapes: chartModel.shapes,
        annotations: chartModel.annotations,
      };

      const config: PlotlyConfig = {
        responsive: true,
        displaylogo: false,
        editable: true,
        modeBarButtonsToRemove: ["lasso2d", "autoScale2d"],
      };

      await plotly.react(containerRef.current, chartModel.traces, layout, config);
      if (!active || !containerRef.current) return;

      graphNode = containerRef.current as PlotlyGraphDiv;
      graphNode.on("plotly_click", handleClick);
      graphNode.on("plotly_selected", handleSelected);
      graphNode.on("plotly_relayout", handleRelayout);

      onReady?.({
        exportImage: async (format) => {
          if (!containerRef.current || !plotlyRef.current) return;
          await plotlyRef.current.downloadImage(containerRef.current, {
            format,
            filename: "dsc-analysis",
            width: 1400,
            height: 900,
          });
        },
      });
    }

    void render();

    return () => {
      active = false;
      if (graphNode) {
        graphNode.removeListener("plotly_click", handleClick);
        graphNode.removeListener("plotly_selected", handleSelected);
        graphNode.removeListener("plotly_relayout", handleRelayout);
      }
    };
  }, [chartModel, manualMode, onManualRange, onPeakBoundsChange, onReady, onSelectPeak]);

  useEffect(() => {
    return () => {
      if (containerRef.current && plotlyRef.current) {
        plotlyRef.current.purge(containerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative min-h-[560px] rounded-xl border border-slate-800 bg-slate-950/30">
      {manualMode && (
        <div className="absolute left-4 top-4 z-10 rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-100 shadow-lg">
          Drag-select a temperature range to add a manual peak
        </div>
      )}
      <div ref={containerRef} className="h-[560px] w-full" />
    </div>
  );
}

function buildChartModel(
  dataPoints: DscDataPoint[],
  peaks: DscPeakWithId[],
  selectedPeakId: string | null,
  showBaseline: boolean,
) {
  const traces: PlotlyTrace[] = [];
  const shapes: PlotlyLayout[] = [];
  const annotations: PlotlyLayout[] = [];
  const shapeMeta: ShapeMeta[] = [];
  const cycleGroups = groupDataByCycle(dataPoints);

  for (const [cycleIndex, points] of cycleGroups) {
    const color = CYCLE_COLORS[cycleIndex % CYCLE_COLORS.length];
    traces.push({
      type: "scattergl",
      mode: "lines",
      name: `${getCycleLabel(cycleIndex)} ${points[0]?.cycleDirection ?? "cycle"}`,
      x: points.map((point) => point.sampleTempC),
      y: points.map((point) => point.heatflowMw),
      line: { color, width: 2 },
      hovertemplate: "Temp %{x:.2f} °C<br>HeatFlow %{y:.3f} mW<extra>%{fullData.name}</extra>",
    });

    if (showBaseline) {
      traces.push({
        type: "scattergl",
        mode: "lines",
        name: `${getCycleLabel(cycleIndex)} baseline`,
        x: points.map((point) => point.sampleTempC),
        y: points.map((point) => point.baselineMw),
        line: { color, width: 1, dash: "dot" },
        opacity: 0.55,
        hovertemplate: "Temp %{x:.2f} °C<br>Baseline %{y:.3f} mW<extra>%{fullData.name}</extra>",
      });
    }
  }

  for (const peak of peaks) {
    const selected = selectedPeakId === peak.id;
    const color = peak.peakType === "exothermic" ? "#fb7185" : "#38bdf8";
    const fill = buildPeakFillTrace(dataPoints, peak, color, selected);
    if (fill) traces.push(fill);

    traces.push({
      type: "scatter",
      mode: "markers",
      name: peak.label || `${getCycleLabel(peak.cycleIndex)} ${peak.peakType}`,
      x: [peak.peakMaxTempC],
      y: [dataPoints[peak.peakMaxIdx]?.heatflowMw ?? peak.peakHeightMw],
      marker: {
        color,
        size: selected ? 13 : 9,
        line: { color: selected ? "#f8fafc" : "#0f172a", width: selected ? 3 : 1 },
      },
      customdata: [peak.id],
      hovertemplate: [
        `${peak.label || peak.peakType}`,
        "Peak %{x:.2f} °C",
        `${peak.heatJPerG.toFixed(2)} J/g`,
        "<extra></extra>",
      ].join("<br>"),
    });

    shapeMeta.push({ peakId: peak.id, boundary: "onset" });
    shapes.push(buildBoundaryLine(peak.onsetTempC, color, selected));
    shapeMeta.push({ peakId: peak.id, boundary: "offset" });
    shapes.push(buildBoundaryLine(peak.offsetTempC, color, selected));

    annotations.push({
      x: peak.peakMaxTempC,
      y: dataPoints[peak.peakMaxIdx]?.heatflowMw ?? peak.peakHeightMw,
      text: peak.label || `${peak.peakType === "exothermic" ? "Exo" : "Endo"} ${peak.peakMaxTempC.toFixed(1)}°C`,
      showarrow: true,
      arrowcolor: color,
      font: { color: "#e2e8f0", size: selected ? 13 : 11 },
      bgcolor: selected ? "rgba(15, 23, 42, 0.92)" : "rgba(15, 23, 42, 0.72)",
      bordercolor: color,
      borderpad: 4,
      ax: 24,
      ay: -36,
    });
  }

  return { traces, shapes, annotations, shapeMeta };
}

function groupDataByCycle(points: DscDataPoint[]) {
  const groups = new Map<number, DscDataPoint[]>();
  for (const point of points) {
    const existing = groups.get(point.cycleIndex);
    if (existing) {
      existing.push(point);
    } else {
      groups.set(point.cycleIndex, [point]);
    }
  }
  return [...groups.entries()].sort(([a], [b]) => a - b);
}

function buildPeakFillTrace(
  dataPoints: DscDataPoint[],
  peak: DscPeakWithId,
  color: string,
  selected: boolean,
): PlotlyTrace | null {
  const start = Math.max(0, Math.min(peak.onsetIdx, peak.offsetIdx));
  const end = Math.min(dataPoints.length - 1, Math.max(peak.onsetIdx, peak.offsetIdx));
  if (end <= start) return null;

  const peakPoints = dataPoints.slice(start, end + 1);
  const baseline = createBoundaryBaseline(dataPoints, start, end);
  return {
    type: "scatter",
    mode: "lines",
    name: `${peak.label || peak.peakType} area`,
    x: [...peakPoints.map((point) => point.sampleTempC), ...peakPoints.map((point) => point.sampleTempC).reverse()],
    y: [
      ...peakPoints.map((point) => point.heatflowMw),
      ...peakPoints.map((_, index) => baseline(start + index)).reverse(),
    ],
    fill: "toself",
    fillcolor: selected ? toRgba(color, 0.28) : toRgba(color, 0.13),
    line: { color: "rgba(0,0,0,0)", width: 0 },
    hoverinfo: "skip",
    showlegend: false,
  };
}

function buildBoundaryLine(tempC: number, color: string, selected: boolean): PlotlyLayout {
  return {
    type: "line",
    x0: tempC,
    x1: tempC,
    y0: 0,
    y1: 1,
    xref: "x",
    yref: "paper",
    line: { color, width: selected ? 3 : 2, dash: selected ? "solid" : "dash" },
    editable: true,
  };
}

function createBoundaryBaseline(points: DscDataPoint[], startIdx: number, endIdx: number) {
  const startHeat = points[startIdx].heatflowMw;
  const endHeat = points[endIdx].heatflowMw;
  const slope = (endHeat - startHeat) / (endIdx - startIdx);
  return (idx: number) => startHeat + slope * (idx - startIdx);
}

function toRgba(hex: string, opacity: number) {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
