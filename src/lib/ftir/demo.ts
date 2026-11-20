/**
 * Deterministic synthetic FTIR spectra for demos and tests.
 *
 * Generated as %T with Gaussian absorption dips at literature band positions, so
 * the demo exercises the same parse → convert → render path as a real file
 * (including unit detection from the header) rather than injecting points.
 *
 * Band positions are approximate literature values for the MOF series Gerald
 * works with; they exist to make the demo plausible, not to serve as reference
 * data for assignment.
 */

type Band = { centre: number; width: number; depth: number };

export type DemoSample = "ni-bdc" | "cu-bdc" | "blank";

const BANDS: Record<DemoSample, Band[]> = {
    "ni-bdc": [
        { centre: 3480, width: 240, depth: 20 }, // O–H, water/DMF (broad)
        { centre: 2930, width: 60, depth: 6 }, // aliphatic C–H
        { centre: 2350, width: 26, depth: 9 }, // atmospheric CO2 artefact
        { centre: 1655, width: 38, depth: 26 }, // residual DMF C=O
        { centre: 1579, width: 26, depth: 44 }, // νas(COO−)
        { centre: 1508, width: 24, depth: 12 }, // aromatic C=C
        { centre: 1354, width: 22, depth: 36 }, // νs(COO−)
        { centre: 1105, width: 40, depth: 18 }, // C–O
        { centre: 820, width: 26, depth: 11 }, // aromatic C–H out-of-plane
        { centre: 590, width: 55, depth: 27 }, // Ni–O
        { centre: 470, width: 45, depth: 21 }, // lattice
    ],
    "cu-bdc": [
        { centre: 3420, width: 250, depth: 18 },
        { centre: 2925, width: 62, depth: 5 },
        { centre: 2350, width: 26, depth: 8 },
        { centre: 1660, width: 36, depth: 22 },
        { centre: 1569, width: 28, depth: 42 }, // νas(COO−), Cu-BDC
        { centre: 1505, width: 22, depth: 10 },
        { centre: 1396, width: 24, depth: 34 }, // νs(COO−), Cu-BDC
        { centre: 1110, width: 42, depth: 16 },
        { centre: 760, width: 30, depth: 12 },
        { centre: 520, width: 60, depth: 24 }, // Cu–O
    ],
    blank: [{ centre: 2350, width: 26, depth: 6 }],
};

const LABELS: Record<DemoSample, string> = {
    "ni-bdc": "Ni-BDC (demo)",
    "cu-bdc": "Cu-BDC (demo)",
    blank: "Background (demo)",
};

/** mulberry32 — small, fast, deterministic. Same seed, same spectrum. */
function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function demoSeries(sample: DemoSample, step = 2): { x: number[]; y: number[] } {
    const bands = BANDS[sample];
    const seed = sample === "ni-bdc" ? 20261119 : sample === "cu-bdc" ? 424242 : 7;
    const rand = rng(seed);
    const x: number[] = [];
    const y: number[] = [];

    for (let w = 4000; w >= 400; w -= step) {
        // Gentle baseline tilt plus a mild scattering tail at low wavenumber.
        let t = 97.5 + 0.0009 * (w - 2200) + 2.4 * Math.exp(-(w - 400) / 380);
        for (const b of bands) {
            t -= b.depth * Math.exp(-0.5 * ((w - b.centre) / (b.width / 2.355)) ** 2);
        }
        t += (rand() - 0.5) * 0.55; // detector noise, ~±0.3 %T
        x.push(w);
        y.push(Math.round(Math.min(100, Math.max(1, t)) * 1000) / 1000);
    }
    return { x, y };
}

/**
 * A synthetic instrument export: banner lines, a unit declaration, then two
 * columns — the shape the parser is built to handle.
 */
export function demoCsv(sample: DemoSample): { fileName: string; text: string } {
    const { x, y } = demoSeries(sample);
    const head = [
        `*FILE_SAMPLE "${LABELS[sample]}"`,
        "*INSTRUMENT AP-Lab FTIR (synthetic demo)",
        "*RESOLUTION 4.000",
        "*SCANS 64",
        "*YUNITS %Transmittance",
        "# wavenumber(cm-1),transmittance(%)",
    ];
    const body = x.map((w, i) => `${w.toFixed(0)},${y[i].toFixed(3)}`);
    return { fileName: `${sample}-demo.csv`, text: [...head, ...body].join("\n") };
}

export const demoLabel = (s: DemoSample) => LABELS[s];
