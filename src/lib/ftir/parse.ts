/**
 * FTIR spectrum parsing.
 *
 * Instruments export two shapes in practice: plain two-column text (whatever
 * the vendor calls the extension) and JCAMP-DX, which is a text standard rather
 * than a binary format. Both are handled here; proprietary binaries (Bruker
 * OPUS, PerkinElmer .sp, Shimadzu .smf, Nicolet .spa) are deliberately rejected
 * with an instruction to export text — guessing at those formats produces
 * plausible-looking wrong numbers, which is worse than a clear refusal.
 */

export type AxisUnit = "transmittance" | "absorbance";

export type ParsedSpectrum = {
    /** Wavenumber axis, descending 4000 → 400, deduplicated. */
    x: number[];
    /** Values in the file's own unit, parallel to x. */
    y: number[];
    unit: AxisUnit;
    /** Human-readable format label for the trace panel. */
    format: string;
    /** Header sample name when the file carries one. */
    sample: string;
    warnings: string[];
};

export class FtirParseError extends Error {}

const BINARY_HINTS: Array<[RegExp, string]> = [
    [/^\.[0-9]+$/i, "Bruker OPUS"],
    [/\.sp$/i, "PerkinElmer"],
    [/\.smf$/i, "Shimadzu"],
    [/\.spa$/i, "Nicolet"],
];

/** Number in either 1234.5 or 1234,5 form. Returns NaN when not a number. */
function toNumber(token: string): number {
    const t = token.trim();
    if (!t) return NaN;
    // 1.234,56 (thousands dot + decimal comma) → 1234.56
    if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(t)) return Number(t.replace(/\./g, "").replace(",", "."));
    if (/^-?\d+,\d+$/.test(t)) return Number(t.replace(",", "."));
    return Number(t);
}


/**
 * Split one data row into numbers, deciding what the comma means.
 *
 * A comma is a decimal separator in "3500,5 90,0" and a column delimiter in
 * "4000,97.500". Guessing wrong shifts every wavenumber, so the decision is made
 * per row from the shape of the tokens rather than globally from the file.
 */
function readRow(line: string): { values: number[]; commaDecimal: boolean } {
    const clean = line.trim();
    const build = (parts: string[], commaDecimal: boolean) => ({
        values: parts.map(toNumber).filter((v) => Number.isFinite(v)),
        commaDecimal,
    });

    // Semicolon or tab delimited: any comma left inside a field is a decimal.
    if (/[;\t]/.test(clean)) {
        const parts = clean.split(/[;\t]+/).filter(Boolean);
        const dec = parts.some((p) => /\d,\d/.test(p));
        return build(dec ? parts.map((p) => p.replace(/,/g, ".")) : parts, dec);
    }

    const ws = clean.split(/\s+/).filter(Boolean);
    if (ws.length >= 2) {
        if (ws.every((t) => /^-?\d+(\.\d+)?$/.test(t))) return build(ws, false);
        if (ws.every((t) => /^-?\d+,\d+$/.test(t))) return build(ws.map((t) => t.replace(",", ".")), true);
        // Mixed: "4000,90 3998,89" would already be caught above; anything else
        // falls through to whitespace splitting with numeric filtering.
        return build(ws, false);
    }

    // Single token per line means the comma must be the delimiter.
    if (clean.includes(",")) return build(clean.split(",").filter(Boolean), false);
    return build(ws, false);
}

function detectUnit(header: string, ys: number[]): AxisUnit {
    const h = header.toLowerCase();
    if (/absorb/.test(h)) return "absorbance";
    if (/transmit|%\s*t\b|percent\s*t/.test(h)) return "transmittance";
    // No declaration: absorbance spectra live in single digits, %T spans 0–100.
    const max = Math.max(...ys);
    const min = Math.min(...ys);
    if (max <= 3 && min >= -0.5) return "absorbance";
    return "transmittance";
}

function finish(
    xs: number[],
    ys: number[],
    unit: AxisUnit,
    format: string,
    sample: string,
    warnings: string[],
): ParsedSpectrum {
    if (xs.length < 20) {
        throw new FtirParseError(
            `Only ${xs.length} data points found — an FTIR scan needs hundreds. ` +
                `Check that the file is a spectrum export, not a summary table.`,
        );
    }
    // Descending order is the FTIR convention; ascending files are reversed once,
    // here, so no downstream code has to think about direction again.
    const wasAscending = xs.length > 1 && xs[xs.length - 1] > xs[0];
    const idx = xs.map((_, i) => i).sort((a, b) => xs[b] - xs[a]);
    const x: number[] = [];
    const y: number[] = [];
    for (const i of idx) {
        if (x.length && Math.abs(x[x.length - 1] - xs[i]) < 1e-9) continue; // duplicate x
        x.push(xs[i]);
        y.push(ys[i]);
    }
    if (x.length < xs.length) warnings.push(`${xs.length - x.length} duplicate wavenumbers dropped`);
    if (wasAscending) warnings.push("axis reversed to descending");
    return { x, y, unit, format, sample, warnings };
}

/* ── JCAMP-DX ─────────────────────────────────────────────────────────────── */

function parseJcamp(text: string): ParsedSpectrum {
    const lines = text.split(/\r?\n/);
    const header: Record<string, string> = {};
    let dataStart = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (/^##XYDATA\s*=/.test(line)) {
            header.XYDATA = line.split("=").slice(1).join("=").trim();
            dataStart = i + 1;
            break;
        }
        if (/^##XYPOINTS\s*=/.test(line)) {
            header.XYPOINTS = line.split("=").slice(1).join("=").trim();
            dataStart = i + 1;
            break;
        }
        const m = line.match(/^##([A-Z0-9_ ]+)=(.*)$/);
        if (m) header[m[1].trim()] = m[2].trim();
    }
    if (dataStart < 0) throw new FtirParseError("JCAMP-DX file has no ##XYDATA or ##XYPOINTS block.");

    const num = (key: string, dflt: number) => {
        const raw = header[key];
        if (!raw) return dflt;
        const n = toNumber(raw.split(/\s+/)[0]);
        return Number.isFinite(n) ? n : dflt;
    };
    const xFactor = num("XFACTOR", 1);
    const yFactor = num("YFACTOR", 1);
    const deltaX = num("DELTAX", NaN);
    const declaredUnit = header["YUNITS"] ?? "";
    const sample = header["TITLE"] ?? header["SAMPLE DESCRIPTION"] ?? "";

    const xs: number[] = [];
    const ys: number[] = [];
    const pairs = /PAIRS/i.test(header.XYPOINTS ?? header.XYDATA ?? "");
    const xpp = /X\+\+/.test(header.XYDATA ?? "");

    if (pairs) {
        for (let i = dataStart; i < lines.length; i++) {
            const clean = lines[i].replace(/##.*$/, "").trim();
            if (!clean) continue;
            const t = clean.split(/[\s,]+/).filter(Boolean).map(toNumber);
            for (let k = 0; k + 1 < t.length; k += 2) {
                if (Number.isFinite(t[k]) && Number.isFinite(t[k + 1])) {
                    xs.push(t[k] * xFactor);
                    ys.push(t[k + 1] * yFactor);
                }
            }
        }
    } else if (xpp && Number.isFinite(deltaX)) {
        for (let i = dataStart; i < lines.length; i++) {
            const clean = lines[i].replace(/##.*$/, "").trim();
            if (!clean) continue;
            const t = clean.split(/[\s,]+/).filter(Boolean).map(toNumber);
            if (!t.length || !Number.isFinite(t[0])) continue;
            let x = t[0] * xFactor;
            for (let k = 1; k < t.length; k++) {
                if (!Number.isFinite(t[k])) continue;
                xs.push(x);
                ys.push(t[k] * yFactor);
                x += deltaX * xFactor;
            }
        }
    } else {
        // Last resort: two columns per line.
        for (let i = dataStart; i < lines.length; i++) {
            const clean = lines[i].replace(/##.*$/, "").trim();
            if (!clean) continue;
            const t = clean.split(/[\s,;]+/).filter(Boolean);
            if (t.length < 2) continue;
            const a = toNumber(t[0]);
            const b = toNumber(t[1]);
            if (Number.isFinite(a) && Number.isFinite(b)) {
                xs.push(a * xFactor);
                ys.push(b * yFactor);
            }
        }
    }

    const unit: AxisUnit = /absorb/i.test(declaredUnit)
        ? "absorbance"
        : /transmit|%\s*t/i.test(declaredUnit)
          ? "transmittance"
          : detectUnit(JSON.stringify(header), ys);

    const warnings: string[] = [];
    if (!Number.isFinite(deltaX) && xpp) warnings.push("X++ block without ##DELTAX");
    return finish(xs, ys, unit, "JCAMP-DX", sample, warnings);
}

/* ── Plain text ───────────────────────────────────────────────────────────── */

function parseText(text: string, fileName: string): ParsedSpectrum {
    const lines = text.split(/\r?\n/);
    const warnings: string[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    const headerLines: string[] = [];
    let sample = "";
    let sawCommaDecimal = false;
    let started = false;

    for (const raw of lines) {
        const line = raw.replace(/\uFEFF/g, "").trim();
        if (!line) continue;

        if (!started) {
            // Comments and instrument banners live above the data block.
            if (/^[*#;!]/.test(line)) {
                headerLines.push(line);
                const m = line.match(/FILE_SAMPLE\s+"?([^"]+)"?/i);
                if (m) sample = m[1].trim();
                continue;
            }
            const probe = readRow(line);
            if (probe.values.length >= 2) started = true;
            else {
                headerLines.push(line);
                continue;
            }
        }

        if (/^[*#;!]/.test(line)) continue;
        const row = readRow(line);
        if (row.commaDecimal) sawCommaDecimal = true;
        if (row.values.length < 2) continue;
        xs.push(row.values[0]);
        ys.push(row.values[1]);
    }

    if (!xs.length) throw new FtirParseError("No numeric rows found. Expected two columns: wavenumber and value.");

    if (sawCommaDecimal) warnings.push("decimal comma interpreted as decimal separator");
    const unit = detectUnit(headerLines.join("\n"), ys);
    const ext = (fileName.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase() || "text";
    if (!(unit === "absorbance" && /absorb/i.test(headerLines.join("\n")))) {
        // no action — detectUnit already resolved it
    }
    return finish(xs, ys, unit, `ASCII ${ext}`, sample, warnings);
}

/** Parse an FTIR export. Throws FtirParseError with a user-facing message. */
export function parseFtir(text: string, fileName = ""): ParsedSpectrum {
    for (const [re, name] of BINARY_HINTS) {
        if (re.test(fileName)) {
            throw new FtirParseError(
                `${name} binary files are not supported. Open the file in the instrument software ` +
                    `and export it as CSV or TXT, then load that here.`,
            );
        }
    }
    if (!text || text.trim().length < 12) throw new FtirParseError("File is empty or too short to be a spectrum.");
    if (/\u0000/.test(text.slice(0, 2048))) {
        throw new FtirParseError("This looks like a binary file, not text. Export CSV/TXT from the instrument software.");
    }
    if (/##TITLE|##XYDATA|##JCAMP-DX|##XYPOINTS/i.test(text.slice(0, 4096))) return parseJcamp(text);
    return parseText(text, fileName);
}
