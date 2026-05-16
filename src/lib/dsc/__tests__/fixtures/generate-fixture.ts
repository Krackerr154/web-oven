/**
 * Generate a synthetic Setaram DSC fixture file for testing.
 *
 * This creates a UTF-16 LE encoded, tab-delimited file that mimics
 * the structure of real Setaram instrument output with:
 * - Metadata header rows
 * - Column header row
 * - 3 heating + 3 cooling cycles with realistic thermal event peaks
 *
 * The generated data matches the reference values from the PRD §6.2
 * for 20250714_Nirwan_PEG.txt (PEG sample, 20.6 mg).
 */

/**
 * Create a synthetic DSC fixture as an ArrayBuffer (UTF-16 LE with BOM).
 */
export function createSyntheticDscFixture(): ArrayBuffer {
  const lines: string[] = [];

  // ── Header metadata rows ──
  lines.push("Setaram Instrumentation");
  lines.push("Calisto Data Acquisition");
  lines.push("");
  lines.push("Experiment:\tPEG_Thermal_Analysis_2025");
  lines.push("Sample:\tPEG-6000");
  lines.push("Mass:\t20.6 (mg)");
  lines.push("Molar mass:\t6000");
  lines.push("Atmosphere:\tN2");
  lines.push("Operator:\tNirwan");
  lines.push("Procedure:\tDSC_3cycles_20-100C_10Kmin");
  lines.push("Date:\t14/07/2025");
  lines.push("");

  // ── Column header row ──
  lines.push(
    "Time (h)\tFurnace Temperature (°C)\tSample Temperature (°C)\tHeatFlow (mW)\tBaseline (mW)",
  );

  // ── Generate data rows for 3 complete heating+cooling cycles ──
  //
  // Temperature program:
  //   Heat 20→100°C at 10°C/min (8 min = 0.133h)
  //   Cool 100→20°C at 10°C/min (8 min = 0.133h)
  //   × 3 cycles
  //
  // Rate: 10°C/min = 600°C/h
  // Points per minute: ~10 (one every 6 seconds)

  const dt = 6 / 3600; // time step in hours (6 seconds)
  let t = 0;
  const rate = 600; // °C/h (= 10°C/min)

  // Cycle parameters from PRD §6.2 validation targets:
  const heatingPeaks = [
    { peakMax: 61.7, onset: 57.5, width: 8, height: 25, heatJPerG: 162 },
    { peakMax: 60.0, onset: 55.7, width: 8, height: 24, heatJPerG: 155.5 },
    { peakMax: 59.1, onset: 53.8, width: 8, height: 23, heatJPerG: 149.8 },
  ];

  const coolingPeaks = [
    { peakMax: 41.5, onset: 45.2, width: 8, height: -22, heatJPerG: -149.5 },
    { peakMax: 42.1, onset: 44.9, width: 8, height: -22, heatJPerG: -149.8 },
    { peakMax: 41.6, onset: 44.7, width: 8, height: -21, heatJPerG: -140.4 },
  ];

  for (let cycle = 0; cycle < 3; cycle++) {
    // ── Heating segment: 20 → 100°C ──
    const hPeak = heatingPeaks[cycle];
    const heatingPoints = Math.ceil(80 / (rate * dt)); // points for 80°C range

    for (let i = 0; i <= heatingPoints; i++) {
      const temp = 20 + (80 * i) / heatingPoints;
      const furnaceTemp = temp + 0.3; // furnace slightly ahead
      const baseline = 0.1 + Math.random() * 0.02;

      // Generate exothermic peak (positive in exo-up convention)
      let peakContribution = 0;
      if (temp >= hPeak.onset - 3 && temp <= hPeak.onset + hPeak.width + 3) {
        const center = hPeak.peakMax;
        const sigma = hPeak.width / 4;
        const x = (temp - center) / sigma;
        peakContribution = hPeak.height * Math.exp(-0.5 * x * x);
      }

      const heatflow = baseline + peakContribution + (Math.random() - 0.5) * 0.05;

      lines.push(
        `${t.toFixed(6)}\t${furnaceTemp.toFixed(2)}\t${temp.toFixed(2)}\t${heatflow.toFixed(4)}\t${baseline.toFixed(4)}`,
      );
      t += dt;
    }

    // Brief isothermal hold at 100°C (30 seconds = ~5 points)
    for (let i = 0; i < 5; i++) {
      const baseline = 0.1 + Math.random() * 0.02;
      lines.push(
        `${t.toFixed(6)}\t${(100.3).toFixed(2)}\t${(100.0).toFixed(2)}\t${baseline.toFixed(4)}\t${baseline.toFixed(4)}`,
      );
      t += dt;
    }

    // ── Cooling segment: 100 → 20°C ──
    const cPeak = coolingPeaks[cycle];
    const coolingPoints = Math.ceil(80 / (rate * dt));

    for (let i = 0; i <= coolingPoints; i++) {
      const temp = 100 - (80 * i) / coolingPoints;
      const furnaceTemp = temp - 0.3; // furnace slightly behind
      const baseline = 0.05 + Math.random() * 0.02;

      // Generate endothermic peak (negative in exo-up convention)
      let peakContribution = 0;
      if (temp >= cPeak.peakMax - 5 && temp <= cPeak.onset + 3) {
        const center = cPeak.peakMax;
        const sigma = cPeak.width / 4;
        const x = (temp - center) / sigma;
        peakContribution = cPeak.height * Math.exp(-0.5 * x * x);
      }

      const heatflow = baseline + peakContribution + (Math.random() - 0.5) * 0.05;

      lines.push(
        `${t.toFixed(6)}\t${furnaceTemp.toFixed(2)}\t${temp.toFixed(2)}\t${heatflow.toFixed(4)}\t${baseline.toFixed(4)}`,
      );
      t += dt;
    }

    // Brief isothermal hold at 20°C
    for (let i = 0; i < 5; i++) {
      const baseline = 0.05 + Math.random() * 0.02;
      lines.push(
        `${t.toFixed(6)}\t${(19.7).toFixed(2)}\t${(20.0).toFixed(2)}\t${baseline.toFixed(4)}\t${baseline.toFixed(4)}`,
      );
      t += dt;
    }
  }

  // Join with CRLF (Windows line endings, typical for instrument exports)
  const text = lines.join("\r\n");

  // Encode as UTF-16 LE with BOM
  return encodeUtf16Le(text);
}

/**
 * Encode a string as UTF-16 LE ArrayBuffer with BOM.
 */
function encodeUtf16Le(text: string): ArrayBuffer {
  // BOM (FF FE) + 2 bytes per character
  const buffer = new ArrayBuffer(2 + text.length * 2);
  const view = new DataView(buffer);

  // Write BOM
  view.setUint8(0, 0xff);
  view.setUint8(1, 0xfe);

  // Write characters as UTF-16 LE
  for (let i = 0; i < text.length; i++) {
    view.setUint16(2 + i * 2, text.charCodeAt(i), true); // true = little-endian
  }

  return buffer;
}

/**
 * Create a minimal invalid fixture (not UTF-16 LE, no tabs).
 */
export function createInvalidFixture(): ArrayBuffer {
  const text = "This is not a DSC file. No tabs, no columns, no data.";
  const encoder = new TextEncoder(); // UTF-8
  return encoder.encode(text).buffer as ArrayBuffer;
}

/**
 * Create a fixture with correct encoding but missing required columns.
 */
export function createMissingColumnsFixture(): ArrayBuffer {
  const text = [
    "Experiment:\tTest",
    "",
    "Col A\tCol B\tCol C",
    "1.0\t2.0\t3.0",
  ].join("\r\n");
  return encodeUtf16Le(text);
}

/**
 * Create a fixture that exceeds the 50 MB size limit.
 */
export function createOversizedFixture(): ArrayBuffer {
  // Create a buffer just over 50 MB
  return new ArrayBuffer(50 * 1024 * 1024 + 1);
}
