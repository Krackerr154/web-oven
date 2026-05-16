/**
 * DSC File Parser — Setaram Instrument Export (.txt)
 *
 * Parses UTF-16 LE tab-delimited text files exported by Setaram DSC instruments.
 * Includes metadata extraction and cycle segmentation.
 *
 * @module src/lib/dsc/parser
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface DscMetadata {
  experimentName: string | null;
  sampleName: string | null;
  massMg: number | null;
  molarMass: number | null;
  atmosphere: string | null;
  operator: string | null;
  procedure: string | null;
  recordedAt: Date | null;
}

export type CycleDirection = "heating" | "cooling" | "isothermal";

export interface DscDataPoint {
  timeH: number;
  furnaceTempC: number;
  sampleTempC: number;
  heatflowMw: number;
  baselineMw: number;
  cycleIndex: number;
  cycleDirection: CycleDirection;
}

export interface ParseResult {
  metadata: DscMetadata;
  dataPoints: DscDataPoint[];
  parseErrors: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const BOM_UTF16_LE = 0xfeff;

/** Column identification patterns (case-insensitive substring match) */
const COLUMN_PATTERNS = {
  time: /time/i,
  furnaceTemp: /furnace\s*temp/i,
  sampleTemp: /sample\s*temp/i,
  heatflow: /heatflow/i,
  baseline: /baseline/i,
} as const;

/** Metadata header patterns — supports both Setaram Calisto and PRD-specified formats */
const METADATA_PATTERNS = {
  experimentName: /^experiment\s*:\s*(.+)/i,
  sampleName: /^(?:sample\s*(?:name)?)\s*:\s*(.+)/i,
  massMg: /(?:initial\s+)?mass\s*:\s*([\d.,]+)\s*(?:\(?\s*mg\s*\)?)?/i,
  molarMass: /molar\s*mass\s*:\s*([\d.,]+)/i,
  molarMassNA: /molar\s*mass\s*:\s*N\/A/i,
  atmosphere: /atmosphere\s*:\s*(.+)/i,
  operator: /(?:operator|user)\s*:\s*(.+)/i,
  procedure: /procedure\s*:\s*(.+)/i,
  creationDate: /creation\s+date\s*:\s*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/i,
  date: /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/,
} as const;

// ─── Main Parser ────────────────────────────────────────────────────────

/**
 * Parse a Setaram DSC instrument export file.
 *
 * @param buffer - The raw file content as ArrayBuffer
 * @returns ParseResult containing metadata, data points, and any warnings
 */
export function parseDscFile(buffer: ArrayBuffer): ParseResult {
  const parseErrors: string[] = [];

  // 1. Validate file size
  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    return {
      metadata: emptyMetadata(),
      dataPoints: [],
      parseErrors: [
        `File too large. Maximum size is 50 MB. Got ${(buffer.byteLength / (1024 * 1024)).toFixed(1)} MB.`,
      ],
    };
  }

  // 2. Decode UTF-16 LE
  const text = decodeUtf16Le(buffer);
  if (text === null) {
    return {
      metadata: emptyMetadata(),
      dataPoints: [],
      parseErrors: [
        "Unsupported file format. Please upload a Setaram DSC .txt export (UTF-16 LE encoded).",
      ],
    };
  }

  // 3. Split into lines and trim
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  // 4. Find the column header row
  const { headerIndex, columnMap } = findColumnHeader(lines);
  if (headerIndex === -1 || !columnMap) {
    return {
      metadata: emptyMetadata(),
      dataPoints: [],
      parseErrors: [
        "Could not identify required columns (Time, HeatFlow, Sample Temperature). Check the file format.",
      ],
    };
  }

  // 5. Extract metadata from header rows (everything before the column header)
  const metadata = extractMetadata(lines.slice(0, headerIndex));

  // 6. Parse numeric data rows
  const rawDataPoints = parseDataRows(
    lines,
    headerIndex + 1,
    columnMap,
    parseErrors,
  );

  if (rawDataPoints.length === 0) {
    parseErrors.push(
      "The file appears to be empty or contains no numeric data.",
    );
    return { metadata, dataPoints: [], parseErrors };
  }

  // 7. Segment into cycles
  const dataPoints = segmentCycles(rawDataPoints);

  return { metadata, dataPoints, parseErrors };
}

// ─── UTF-16 LE Decoder ──────────────────────────────────────────────────

/**
 * Decode a buffer as UTF-16 LE text. Returns null if detection fails.
 * Handles BOM stripping.
 */
function decodeUtf16Le(buffer: ArrayBuffer): string | null {
  // Try UTF-16 LE detection: check for BOM or heuristic
  const bytes = new Uint8Array(buffer);

  // Check BOM: FF FE
  const hasBom = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;

  // Heuristic: in UTF-16 LE ASCII text, every other byte is typically 0x00
  const looksLikeUtf16 =
    hasBom ||
    (bytes.length >= 4 &&
      bytes[1] === 0x00 &&
      bytes[3] === 0x00);

  if (!looksLikeUtf16) {
    // Try decoding as UTF-8 as a fallback for tab-delimited files
    try {
      const utf8Text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      // Verify it looks like DSC data (has tabs and numbers)
      if (utf8Text.includes("\t")) {
        return utf8Text;
      }
    } catch {
      // Not valid UTF-8 either
    }
    return null;
  }

  const decoder = new TextDecoder("utf-16le", { fatal: false });
  let text = decoder.decode(buffer);

  // Strip BOM character if present
  if (text.charCodeAt(0) === BOM_UTF16_LE) {
    text = text.slice(1);
  }

  return text;
}

// ─── Column Header Detection ───────────────────────────────────────────

interface ColumnMap {
  time: number;
  furnaceTemp: number;
  sampleTemp: number;
  heatflow: number;
  baseline: number;
}

/**
 * Scan lines to find the column header row.
 * A valid header row must contain both "Time" and "HeatFlow" (case-insensitive).
 */
function findColumnHeader(
  lines: string[],
): { headerIndex: number; columnMap: ColumnMap | null } {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Quick check: must contain both required column names
    const lower = line.toLowerCase();
    if (!lower.includes("time") || !lower.includes("heatflow")) {
      continue;
    }

    const columns = line.split("\t").map((c) => c.trim());
    const map = mapColumns(columns);
    if (map) {
      return { headerIndex: i, columnMap: map };
    }
  }

  return { headerIndex: -1, columnMap: null };
}

/**
 * Map column headers to their indices.
 * Returns null if required columns (Time, SampleTemp, HeatFlow) are missing.
 */
function mapColumns(headers: string[]): ColumnMap | null {
  let time = -1;
  let furnaceTemp = -1;
  let sampleTemp = -1;
  let heatflow = -1;
  let baseline = -1;

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (COLUMN_PATTERNS.time.test(h) && time === -1) {
      time = i;
    } else if (COLUMN_PATTERNS.furnaceTemp.test(h) && furnaceTemp === -1) {
      furnaceTemp = i;
    } else if (COLUMN_PATTERNS.sampleTemp.test(h) && sampleTemp === -1) {
      sampleTemp = i;
    } else if (COLUMN_PATTERNS.heatflow.test(h) && heatflow === -1) {
      heatflow = i;
    } else if (COLUMN_PATTERNS.baseline.test(h) && baseline === -1) {
      baseline = i;
    }
  }

  // Time, SampleTemp, and HeatFlow are required
  if (time === -1 || sampleTemp === -1 || heatflow === -1) {
    return null;
  }

  // FurnaceTemp and Baseline fall back to defaults if missing
  if (furnaceTemp === -1) furnaceTemp = sampleTemp; // fallback
  if (baseline === -1) baseline = heatflow; // fallback: baseline = heatflow (flat)

  return { time, furnaceTemp, sampleTemp, heatflow, baseline };
}

// ─── Metadata Extraction ───────────────────────────────────────────────

function emptyMetadata(): DscMetadata {
  return {
    experimentName: null,
    sampleName: null,
    massMg: null,
    molarMass: null,
    atmosphere: null,
    operator: null,
    procedure: null,
    recordedAt: null,
  };
}

/**
 * Extract metadata from header lines (before the column header row).
 */
function extractMetadata(headerLines: string[]): DscMetadata {
  const meta = emptyMetadata();

  // In Setaram Calisto exports, the very first non-empty line is often
  // the experiment/file name (no key: prefix). Capture it as a fallback.
  let firstNonEmptyLine: string | null = null;

  for (const line of headerLines) {
    if (!line) continue;

    // Track first non-empty line for fallback experiment name
    if (firstNonEmptyLine === null) {
      firstNonEmptyLine = line;
    }

    // Experiment name (explicit "Experiment:" prefix)
    let match = METADATA_PATTERNS.experimentName.exec(line);
    if (match && !meta.experimentName) {
      meta.experimentName = match[1].trim();
      continue;
    }

    // Sample name
    match = METADATA_PATTERNS.sampleName.exec(line);
    if (match && !meta.sampleName) {
      meta.sampleName = match[1].trim();
      continue;
    }

    // Mass (mg) — matches both "Mass: 20.6 (mg)" and "Initial Mass: 20.6 mg"
    match = METADATA_PATTERNS.massMg.exec(line);
    if (match && meta.massMg === null) {
      const val = parseFloat(match[1].replace(",", "."));
      if (!isNaN(val)) meta.massMg = val;
      continue;
    }

    // Molar mass — skip lines with "N/A" value
    if (METADATA_PATTERNS.molarMassNA.test(line)) {
      continue; // molar mass is N/A, leave as null
    }
    match = METADATA_PATTERNS.molarMass.exec(line);
    if (match && meta.molarMass === null) {
      const val = parseFloat(match[1].replace(",", "."));
      if (!isNaN(val)) meta.molarMass = val;
      continue;
    }

    // Atmosphere
    match = METADATA_PATTERNS.atmosphere.exec(line);
    if (match && !meta.atmosphere) {
      meta.atmosphere = match[1].trim();
      continue;
    }

    // Operator (matches both "Operator:" and "User:")
    match = METADATA_PATTERNS.operator.exec(line);
    if (match && !meta.operator) {
      meta.operator = match[1].trim();
      continue;
    }

    // Procedure
    match = METADATA_PATTERNS.procedure.exec(line);
    if (match && !meta.procedure) {
      meta.procedure = match[1].trim();
      continue;
    }

    // Creation Date ("Creation Date: DD/MM/YYYY HH:MM:SS")
    match = METADATA_PATTERNS.creationDate.exec(line);
    if (match && !meta.recordedAt) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
        const utcMs =
          Date.UTC(year, month - 1, day, 0, 0, 0) - 7 * 60 * 60 * 1000;
        meta.recordedAt = new Date(utcMs);
      }
      continue;
    }

    // Fallback: bare date (DD/MM/YYYY) → WIB
    match = METADATA_PATTERNS.date.exec(line);
    if (match && !meta.recordedAt) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
        const utcMs =
          Date.UTC(year, month - 1, day, 0, 0, 0) - 7 * 60 * 60 * 1000;
        meta.recordedAt = new Date(utcMs);
      }
      continue;
    }
  }

  // Fallback: use first non-empty line as experiment name if none was found
  if (!meta.experimentName && firstNonEmptyLine) {
    // Only use it if it doesn't look like a known metadata key
    const lower = firstNonEmptyLine.toLowerCase();
    const isMetadataLine = [
      "heatflow", "baseline", "creation date", "user:", "initial mass",
      "molar mass", "atmosphere", "operator", "procedure", "sample",
    ].some((key) => lower.includes(key));
    if (!isMetadataLine) {
      meta.experimentName = firstNonEmptyLine.trim();
    }
  }

  // Fallback: use experiment name as sample name if none was found
  if (!meta.sampleName && meta.experimentName) {
    meta.sampleName = meta.experimentName;
  }

  return meta;
}

// ─── Data Row Parsing ──────────────────────────────────────────────────

interface RawDataPoint {
  timeH: number;
  furnaceTempC: number;
  sampleTempC: number;
  heatflowMw: number;
  baselineMw: number;
}

/**
 * Parse numeric data rows starting from `startIndex`.
 */
function parseDataRows(
  lines: string[],
  startIndex: number,
  columnMap: ColumnMap,
  parseErrors: string[],
): RawDataPoint[] {
  const points: RawDataPoint[] = [];
  let skippedCount = 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.includes("\t")) {
      // Skip empty / whitespace-only rows
      continue;
    }

    const cols = line.split("\t");

    const timeH = parseNumericCell(cols[columnMap.time]);
    const furnaceTempC = parseNumericCell(cols[columnMap.furnaceTemp]);
    const sampleTempC = parseNumericCell(cols[columnMap.sampleTemp]);
    const heatflowMw = parseNumericCell(cols[columnMap.heatflow]);
    const baselineMw = parseNumericCell(cols[columnMap.baseline]);

    // Skip rows where required columns are NaN
    if (
      isNaN(timeH) ||
      isNaN(sampleTempC) ||
      isNaN(heatflowMw)
    ) {
      skippedCount++;
      continue;
    }

    points.push({
      timeH,
      furnaceTempC: isNaN(furnaceTempC) ? sampleTempC : furnaceTempC,
      sampleTempC,
      heatflowMw,
      baselineMw: isNaN(baselineMw) ? 0 : baselineMw,
    });
  }

  if (skippedCount > 0) {
    parseErrors.push(
      `Skipped ${skippedCount} row(s) with non-numeric or missing values.`,
    );
  }

  return points;
}

/**
 * Parse a single cell value to a number.
 * Handles European comma-as-decimal format.
 */
function parseNumericCell(value: string | undefined): number {
  if (value === undefined || value === null) return NaN;
  const trimmed = value.trim();
  if (trimmed === "") return NaN;

  // Handle European decimal comma: "1,234" → "1.234"
  // But be careful with thousand separators. Setaram typically uses
  // comma as decimal separator without thousand separators.
  const normalized = trimmed.replace(",", ".");
  return parseFloat(normalized);
}

// ─── Cycle Segmentation ────────────────────────────────────────────────

/**
 * Segment raw data points into heating/cooling cycles.
 *
 * Algorithm:
 * 1. Compute central-difference derivative of furnaceTempC.
 * 2. Smooth the derivative (moving average, window=20).
 * 3. Detect sign changes in the smoothed derivative.
 * 4. Assign cycleIndex and cycleDirection to each point.
 */
function segmentCycles(rawPoints: RawDataPoint[]): DscDataPoint[] {
  const n = rawPoints.length;
  if (n === 0) return [];

  // Step 1: Central difference derivative
  const dT = new Float64Array(n);
  dT[0] = rawPoints.length > 1
    ? rawPoints[1].furnaceTempC - rawPoints[0].furnaceTempC
    : 0;
  dT[n - 1] = rawPoints.length > 1
    ? rawPoints[n - 1].furnaceTempC - rawPoints[n - 2].furnaceTempC
    : 0;

  for (let i = 1; i < n - 1; i++) {
    dT[i] = rawPoints[i + 1].furnaceTempC - rawPoints[i - 1].furnaceTempC;
  }

  // Step 2: Smooth with moving average (window = 20)
  const smoothWindow = 20;
  const smoothedDt = smoothMovingAverage(dT, smoothWindow);

  // Step 3: Classify direction at each point
  //   We use a threshold to distinguish isothermal from heating/cooling.
  //   A reasonable threshold is a fraction of the max abs derivative.
  const maxAbsDt = smoothedDt.reduce(
    (max, v) => Math.max(max, Math.abs(v)),
    0,
  );
  const isothermalThreshold = maxAbsDt * 0.05; // 5% of max rate

  const directions: CycleDirection[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (Math.abs(smoothedDt[i]) < isothermalThreshold) {
      directions[i] = "isothermal";
    } else if (smoothedDt[i] > 0) {
      directions[i] = "heating";
    } else {
      directions[i] = "cooling";
    }
  }

  // Step 4: Detect sign changes in smoothed derivative → cycle boundaries
  //   A new cycle starts when the direction changes between heating and cooling.
  //   Isothermal segments are assigned to the most recent non-isothermal direction.
  let cycleIndex = 0;
  let lastNonIsothermalDir: "heating" | "cooling" | null = null;

  // Find initial non-isothermal direction
  for (let i = 0; i < n; i++) {
    if (directions[i] !== "isothermal") {
      lastNonIsothermalDir = directions[i] as "heating" | "cooling";
      break;
    }
  }

  const cycleIndices = new Int32Array(n);

  for (let i = 0; i < n; i++) {
    const dir = directions[i];

    if (dir !== "isothermal") {
      if (
        lastNonIsothermalDir !== null &&
        dir !== lastNonIsothermalDir
      ) {
        // Direction changed → new cycle
        cycleIndex++;
      }
      lastNonIsothermalDir = dir as "heating" | "cooling";
    }

    cycleIndices[i] = cycleIndex;
  }

  // Build final DscDataPoint array
  const result: DscDataPoint[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const raw = rawPoints[i];
    result[i] = {
      timeH: raw.timeH,
      furnaceTempC: raw.furnaceTempC,
      sampleTempC: raw.sampleTempC,
      heatflowMw: raw.heatflowMw,
      baselineMw: raw.baselineMw,
      cycleIndex: cycleIndices[i],
      cycleDirection: directions[i],
    };
  }

  return result;
}

/**
 * Simple moving average smoothing.
 */
function smoothMovingAverage(
  data: Float64Array,
  window: number,
): Float64Array {
  const n = data.length;
  const result = new Float64Array(n);
  const halfW = Math.floor(window / 2);

  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - halfW);
    const end = Math.min(n - 1, i + halfW);
    let sum = 0;
    for (let j = start; j <= end; j++) {
      sum += data[j];
    }
    result[i] = sum / (end - start + 1);
  }

  return result;
}

// ─── Utilities (exported for testing) ───────────────────────────────────

export {
  decodeUtf16Le as _decodeUtf16Le,
  extractMetadata as _extractMetadata,
  findColumnHeader as _findColumnHeader,
  segmentCycles as _segmentCycles,
  parseNumericCell as _parseNumericCell,
};
