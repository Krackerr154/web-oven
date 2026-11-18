/**
 * Attachment handling for LUMA.
 *
 * Two kinds of file arrive here and they take completely different paths:
 *   - images  → forwarded to the model as vision content parts
 *   - tabular → parsed into numeric columns the plot tool can address
 *
 * Nothing is written to disk. A file lives in memory for the duration of one
 * request; the client re-sends it while the attachment chip is still on screen.
 * That keeps the whole feature stateless — no volume, no orphan files, no
 * cleanup job, and no path from an upload to somewhere it should not be.
 */

export const MAX_ATTACHMENTS = 2;
export const MAX_UPLOAD_BYTES = 3_000_000; // ~4 MB as base64
const MAX_POINTS = 2000; // plotting more does not change what the eye sees
const MAX_ROWS_SCANNED = 60_000;

export type Attachment = { name: string; mime: string; data: string };

export type Column = {
  name: string;
  min: number;
  max: number;
};

export type Dataset = {
  /** Position in the request, used as the tool's `dataset` argument. */
  index: number;
  name: string;
  columns: Column[];
  /** Row-major numeric grid, already decimated. */
  rows: number[][];
  rawRowCount: number;
  downsampled: boolean;
};

export type AttachmentReport = {
  datasets: Dataset[];
  images: { index: number; name: string }[];
  rejected: { name: string; reason: string }[];
};

const IMAGE_MIME = /^image\/(png|jpe?g|webp|gif)$/i;

export function isImage(mime: string): boolean {
  return IMAGE_MIME.test(mime || "");
}

function decodeBytes(b64: string): Uint8Array {
  // Node runtime: Buffer is available. atob would also work but mangles UTF-8.
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function toText(bytes: Uint8Array): string {
  let text = Buffer.from(bytes).toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  return text;
}

const COMMENT = /^\s*(#|\/\/|;|\*|--|')/;

/** Rigaku/PANalytical exports often carry a `*` banner and quoted headers. */
function looksLikeHeader(tokens: string[]): boolean {
  return tokens.some((t) => {
    const cleaned = t.replace(/^["']|["']$/g, "").trim();
    return cleaned.length > 0 && !Number.isFinite(Number(cleaned));
  });
}

function countDelims(line: string): Record<string, number> {
  return {
    "\t": (line.match(/\t/g) ?? []).length,
    ",": (line.match(/,/g) ?? []).length,
    ";": (line.match(/;/g) ?? []).length,
  };
}

function pickDelimiter(lines: string[]): string {
  const totals: Record<string, number> = { "\t": 0, ",": 0, ";": 0 };
  for (const line of lines) {
    const c = countDelims(line);
    for (const k of Object.keys(totals)) totals[k] += c[k];
  }
  let best = " ";
  let bestCount = 0;
  for (const [delim, n] of Object.entries(totals)) {
    if (n > bestCount) {
      bestCount = n;
      best = delim;
    }
  }
  return best;
}

function splitLine(line: string, delim: string): string[] {
  const parts = delim === " " ? line.trim().split(/\s+/) : line.split(delim);
  return parts.map((p) => p.replace(/^["']|["']$/g, "").trim());
}

export function parseTabular(
  attachments: Attachment[],
): AttachmentReport {
  const datasets: Dataset[] = [];
  const images: { index: number; name: string }[] = [];
  const rejected: { name: string; reason: string }[] = [];

  attachments.forEach((att, index) => {
    const name = att.name || `file-${index + 1}`;

    if (isImage(att.mime)) {
      images.push({ index, name });
      return;
    }

    let bytes: Uint8Array;
    try {
      bytes = decodeBytes(att.data);
    } catch {
      rejected.push({ name, reason: "not valid base64" });
      return;
    }
    if (bytes.length > MAX_UPLOAD_BYTES) {
      rejected.push({ name, reason: `larger than ${Math.round(MAX_UPLOAD_BYTES / 1000)} kB` });
      return;
    }
    // A NUL byte in the first KB means binary, not a text table.
    if (bytes.subarray(0, 1024).includes(0)) {
      rejected.push({ name, reason: "looks binary, expected CSV/TXT/XY" });
      return;
    }

    const text = toText(bytes);
    const allLines = text.split(/\r?\n/).slice(0, MAX_ROWS_SCANNED);
    const candidate = allLines.filter((l) => l.trim() && !COMMENT.test(l));
    if (candidate.length < 2) {
      rejected.push({ name, reason: "fewer than two data lines" });
      return;
    }

    const delim = pickDelimiter(candidate.slice(0, 40));
    const first = splitLine(candidate[0], delim);
    const hasHeader = looksLikeHeader(first);
    const headerNames = hasHeader
      ? first.map((t, i) => (t || `col${i + 1}`).slice(0, 40))
      : [];
    const body = hasHeader ? candidate.slice(1) : candidate;

    const rows: number[][] = [];
    for (const line of body) {
      const tokens = splitLine(line, delim);
      const nums: number[] = [];
      for (const t of tokens) {
        // Accept 1,234.5 and 1.234,5 style exports only when unambiguous.
        const n = Number(t.replace(/(?<=\d),(?=\d{3}\b)/g, ""));
        if (Number.isFinite(n)) nums.push(n);
      }
      if (nums.length >= 2) rows.push(nums);
    }

    if (rows.length < 2) {
      rejected.push({ name, reason: "no numeric columns found" });
      return;
    }

    // A ragged file truncates to its most common width rather than erroring.
    const width = mode(rows.map((r) => r.length));
    const clean = rows
      .filter((r) => r.length >= width)
      .map((r) => r.slice(0, width));

    if (clean.length < 2) {
      rejected.push({ name, reason: "inconsistent column counts" });
      return;
    }

    const rawRowCount = clean.length;
    const downsampled = rawRowCount > MAX_POINTS;
    const kept = downsampled ? decimate(clean, MAX_POINTS) : clean;

    const columns: Column[] = Array.from({ length: width }, (_, c) => {
      let min = Infinity;
      let max = -Infinity;
      for (const r of kept) {
        const v = r[c];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      return {
        name: headerNames[c] || `col${c + 1}`,
        min: round(min),
        max: round(max),
      };
    });

    datasets.push({ index, name, columns, rows: kept, rawRowCount, downsampled });
  });

  return { datasets, images, rejected };
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0] ?? 0;
  let bestCount = 0;
  for (const [v, n] of counts) {
    if (n > bestCount) {
      bestCount = n;
      best = v;
    }
  }
  return best;
}

function decimate(rows: number[][], target: number): number[][] {
  const out: number[][] = [];
  const step = (rows.length - 1) / (target - 1);
  for (let i = 0; i < target; i += 1) out.push(rows[Math.round(i * step)]);
  return out;
}

function round(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const a = Math.abs(v);
  if (a >= 1000) return Math.round(v);
  if (a >= 1) return Math.round(v * 100) / 100;
  return Number(v.toPrecision(4));
}

/** Compact description of what was attached, for the system prompt. */
export function describeAttachments(report: AttachmentReport): string {
  const lines: string[] = [];

  for (const ds of report.datasets) {
    const cols = ds.columns
      .map((c) => `${c.name} (${c.min} to ${c.max})`)
      .join(", ");
    const rows = ds.downsampled
      ? `${ds.rawRowCount} rows, thinned to ${ds.rows.length} for plotting`
      : `${ds.rawRowCount} rows`;
    lines.push(
      `- dataset ${ds.index}: "${ds.name}" — ${rows}, ${ds.columns.length} numeric columns: ${cols}`,
    );
  }

  for (const img of report.images) {
    lines.push(`- image ${img.index}: "${img.name}" — you can see it`);
  }

  for (const r of report.rejected) {
    lines.push(`- REJECTED "${r.name}": ${r.reason}`);
  }

  return lines.join("\n");
}

/** Build plot series from a dataset by column name, with a forgiving lookup. */
export function seriesFromColumns(
  ds: Dataset,
  xName: string,
  yName: string,
): { x: number[]; y: number[] } | { error: string } {
  const find = (wanted: string): number => {
    const w = wanted.trim().toLowerCase();
    const byExact = ds.columns.findIndex((c) => c.name.toLowerCase() === w);
    if (byExact >= 0) return byExact;
    const byPartial = ds.columns.findIndex(
      (c) => c.name.toLowerCase().includes(w) || w.includes(c.name.toLowerCase()),
    );
    if (byPartial >= 0) return byPartial;
    // Allow "col1"/"1" and zero-based index references.
    const asNum = Number(wanted);
    if (Number.isInteger(asNum) && asNum >= 0 && asNum < ds.columns.length) return asNum;
    return -1;
  };

  const xi = find(xName);
  const yi = find(yName);
  if (xi < 0) {
    return {
      error: `no column matched "${xName}"; available: ${ds.columns.map((c) => c.name).join(", ")}`,
    };
  }
  if (yi < 0) {
    return {
      error: `no column matched "${yName}"; available: ${ds.columns.map((c) => c.name).join(", ")}`,
    };
  }

  return {
    x: ds.rows.map((r) => r[xi]),
    y: ds.rows.map((r) => r[yi]),
  };
}
