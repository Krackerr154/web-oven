// XRD scan parsing (Rigaku .xy and generic two-column text).
// Extracted verbatim from xrd-plotter.tsx (Phase A). No logic changes.

/* ────────────────────────────────────────────────────────────────────────────
   Parsing — Rigaku .xy / generic two-column text
   ──────────────────────────────────────────────────────────────────────────── */

export function parseScan(text: string) {
    const x: number[] = [];
    const y: number[] = [];
    let sample = "";

    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;

        if (line.startsWith("*")) {
            const m = line.match(/^\*FILE_SAMPLE\s+"(.*)"/);
            if (m && m[1].trim()) sample = m[1].trim();
            continue;
        }
        if (line[0] === "#" || line[0] === ";" || line[0] === "!") continue;

        const parts = line.split(/[\s,;\t]+/).filter(Boolean);
        if (parts.length < 2) continue;

        const a = Number(parts[0]);
        const b = Number(parts[1]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;

        x.push(a);
        y.push(b);
    }

    return { x, y, sample };
}
