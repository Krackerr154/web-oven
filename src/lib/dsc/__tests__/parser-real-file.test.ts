/**
 * Integration test: Parse the ACTUAL Setaram reference file.
 *
 * This test uses the real `20250714_Nirwan_PEG.txt` instrument export
 * to validate the parser against actual Setaram Calisto output.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { parseDscFile, type ParseResult } from "../parser";
import { readFileSync } from "fs";
import { join } from "path";

// ─── Load the real fixture ──────────────────────────────────────────────

let result: ParseResult;

beforeAll(() => {
  const filePath = join(
    __dirname,
    "fixtures",
    "20250714_Nirwan_PEG.txt",
  );
  const buffer = readFileSync(filePath);
  // Convert Node Buffer to ArrayBuffer
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  result = parseDscFile(arrayBuffer);
});

// ─── Metadata from the real file ────────────────────────────────────────

describe("Real File: Metadata Extraction", () => {
  it("should extract experiment name from first line", () => {
    expect(result.metadata.experimentName).toBe("20250714_Nirwan_PEG");
  });

  it("should extract mass as 20.6 mg", () => {
    expect(result.metadata.massMg).toBeCloseTo(20.6, 1);
  });

  it("should extract the creation date (18/07/2025)", () => {
    expect(result.metadata.recordedAt).toBeInstanceOf(Date);
    const d = result.metadata.recordedAt!;
    // Convert to WIB
    const wibMs = d.getTime() + 7 * 60 * 60 * 1000;
    const wibDate = new Date(wibMs);
    expect(wibDate.getUTCFullYear()).toBe(2025);
    expect(wibDate.getUTCMonth()).toBe(6); // July
    expect(wibDate.getUTCDate()).toBe(18);
  });

  it("should extract operator as 'admin'", () => {
    expect(result.metadata.operator).toBe("admin");
  });

  it("should have molarMass as null (N/A in file)", () => {
    expect(result.metadata.molarMass).toBeNull();
  });

  it("should use experiment name as sample name fallback", () => {
    expect(result.metadata.sampleName).toBe("20250714_Nirwan_PEG");
  });
});

// ─── Data Parsing ───────────────────────────────────────────────────────

describe("Real File: Data Parsing", () => {
  it("should parse ~57,600 data points", () => {
    // File has ~57,604 data rows
    expect(result.dataPoints.length).toBeGreaterThan(50000);
    expect(result.dataPoints.length).toBeLessThan(60000);
  });

  it("should have parse errors be warnings only (not fatal)", () => {
    // Some skipped rows are OK
    expect(result.dataPoints.length).toBeGreaterThan(0);
  });

  it("should span ~16 hours of recording time", () => {
    const lastPoint = result.dataPoints[result.dataPoints.length - 1];
    expect(lastPoint.timeH).toBeGreaterThan(15.5);
    expect(lastPoint.timeH).toBeLessThan(16.5);
  });

  it("should have temperatures in range 27-100°C", () => {
    let minTemp = Infinity;
    let maxTemp = -Infinity;
    for (const dp of result.dataPoints) {
      if (dp.sampleTempC < minTemp) minTemp = dp.sampleTempC;
      if (dp.sampleTempC > maxTemp) maxTemp = dp.sampleTempC;
    }
    expect(minTemp).toBeGreaterThan(20);
    expect(minTemp).toBeLessThan(35);
    expect(maxTemp).toBeGreaterThan(80);
    expect(maxTemp).toBeLessThan(110);
  });

  it("should have HeatFlow values with significant peaks", () => {
    let minHF = Infinity;
    let maxHF = -Infinity;
    for (const dp of result.dataPoints) {
      if (dp.heatflowMw < minHF) minHF = dp.heatflowMw;
      if (dp.heatflowMw > maxHF) maxHF = dp.heatflowMw;
    }
    // PEG melting/crystallization peaks should be significant
    expect(maxHF - minHF).toBeGreaterThan(10); // at least 10 mW range
  });
});

// ─── Cycle Segmentation ─────────────────────────────────────────────────

describe("Real File: Cycle Segmentation", () => {
  it("should detect 24 half-cycles (12 heating + 12 cooling)", () => {
    const maxCycle = result.dataPoints.reduce(
      (max, dp) => Math.max(max, dp.cycleIndex),
      0,
    );
    // The real file has 12 complete heating+cooling cycles
    // = 24 half-cycles, cycle indices 0..23
    // PRD §5 mentioned 6 half-cycles but the actual file has 24.
    expect(maxCycle).toBe(23);
  });

  it("should have both heating and cooling directions", () => {
    const directions = new Set(
      result.dataPoints.map((dp) => dp.cycleDirection),
    );
    expect(directions.has("heating")).toBe(true);
    expect(directions.has("cooling")).toBe(true);
  });

  it("should start with a heating segment", () => {
    // The experiment starts with heating from ~27°C upward
    const firstNonIso = result.dataPoints.find(
      (dp) => dp.cycleDirection !== "isothermal",
    );
    expect(firstNonIso?.cycleDirection).toBe("heating");
  });

  it("should have each cycle contain data points", () => {
    // Count points per cycle
    const cycleCounts = new Map<number, number>();
    for (const dp of result.dataPoints) {
      cycleCounts.set(dp.cycleIndex, (cycleCounts.get(dp.cycleIndex) || 0) + 1);
    }

    // All 24 half-cycles should have substantial data
    for (let i = 0; i <= 23; i++) {
      const count = cycleCounts.get(i) || 0;
      expect(count).toBeGreaterThan(100);
    }
  });

  it("should have heating cycles with increasing temp and cooling with decreasing", () => {
    // Check cycle 0 (first heating)
    const cycle0 = result.dataPoints.filter(
      (dp) => dp.cycleIndex === 0 && dp.cycleDirection === "heating",
    );
    if (cycle0.length > 100) {
      const q1 = cycle0[Math.floor(cycle0.length * 0.1)].sampleTempC;
      const q3 = cycle0[Math.floor(cycle0.length * 0.9)].sampleTempC;
      expect(q3).toBeGreaterThan(q1); // heating = increasing temp
    }

    // Check cycle 1 (first cooling)
    const cycle1 = result.dataPoints.filter(
      (dp) => dp.cycleIndex === 1 && dp.cycleDirection === "cooling",
    );
    if (cycle1.length > 100) {
      const q1 = cycle1[Math.floor(cycle1.length * 0.1)].sampleTempC;
      const q3 = cycle1[Math.floor(cycle1.length * 0.9)].sampleTempC;
      expect(q3).toBeLessThan(q1); // cooling = decreasing temp
    }
  });
});

// ─── Summary Output ─────────────────────────────────────────────────────

describe("Real File: Summary", () => {
  it("should print a summary for inspection", () => {
    const meta = result.metadata;
    const cycleCounts = new Map<number, { heating: number; cooling: number; iso: number }>();
    for (const dp of result.dataPoints) {
      if (!cycleCounts.has(dp.cycleIndex)) {
        cycleCounts.set(dp.cycleIndex, { heating: 0, cooling: 0, iso: 0 });
      }
      const c = cycleCounts.get(dp.cycleIndex)!;
      if (dp.cycleDirection === "heating") c.heating++;
      else if (dp.cycleDirection === "cooling") c.cooling++;
      else c.iso++;
    }

    console.log("\n=== REAL FILE PARSE SUMMARY ===");
    console.log(`Experiment:  ${meta.experimentName}`);
    console.log(`Sample:      ${meta.sampleName}`);
    console.log(`Mass:        ${meta.massMg} mg`);
    console.log(`Molar mass:  ${meta.molarMass ?? "N/A"}`);
    console.log(`Operator:    ${meta.operator}`);
    console.log(`Date:        ${meta.recordedAt?.toISOString()}`);
    console.log(`Data points: ${result.dataPoints.length}`);
    console.log(`Parse errors: ${result.parseErrors.length}`);
    if (result.parseErrors.length > 0) {
      result.parseErrors.forEach((e) => console.log(`  - ${e}`));
    }
    console.log("\nCycle breakdown:");
    for (const [idx, counts] of Array.from(cycleCounts.entries()).sort(
      (a, b) => a[0] - b[0],
    )) {
      console.log(
        `  Cycle ${idx}: ${counts.heating} heating, ${counts.cooling} cooling, ${counts.iso} isothermal`,
      );
    }
    console.log("=============================\n");

    // This is informational — always passes
    expect(true).toBe(true);
  });
});
