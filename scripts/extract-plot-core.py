#!/usr/bin/env python3
"""Phase A: extract shared plotting core + XRD figure builder from the
2,659-line xrd-plotter component. Pure mechanical move; adds `export` keywords
and an import header, changes nothing else."""
import subprocess, pathlib, re, hashlib

ROOT = pathlib.Path("/home/arya/services/web-oven-ap-lab")
SRC = ROOT / "src/components/analysis/xrd-plotter.tsx"
orig = SRC.read_text().splitlines(keepends=True)

def block(a, b):
    """1-indexed inclusive slice."""
    return "".join(orig[a-1:b])

def exportify(text):
    """Prefix the first top-level declaration with `export`."""
    out = []
    done = False
    for line in text.splitlines(keepends=True):
        if not done and re.match(r"^(type|function|const|interface) ", line):
            line = "export " + line
            done = True
        out.append(line)
    assert done, text[:80]
    return "".join(out)

CORE_BLOCKS = [(38,63),(65,93),(95,95),(97,127),(129,135),
               (137,153),(155,170),(172,182),(184,209),
               (633,705),(707,736)]
FIG_BLOCKS  = [(21,36),(249,265),(267,627)]
PARSE_BLOCKS= [(211,243)]

# --- byte-identity record (hash of the untouched source slices) -------------
manifest = {}
for name, blocks in (("core", CORE_BLOCKS), ("figure", FIG_BLOCKS), ("parse", PARSE_BLOCKS)):
    for i, (a, b) in enumerate(blocks):
        manifest[f"{name}:{a}-{b}"] = hashlib.sha256(block(a, b).encode()).hexdigest()

core = ("// Shared plotting primitives, layout and exporters.\n"
        "// Extracted verbatim from xrd-plotter.tsx (Phase A). No logic changes.\n\n"
        + "\n".join(exportify(block(a,b)) for a,b in CORE_BLOCKS))

figure = ("// XRD figure geometry → drawing primitives.\n"
          "// Extracted verbatim from xrd-plotter.tsx (Phase A). No logic changes.\n\n"
          'import { PRINT_LAYOUT, clamp01, niceStep, textWidth, type Layout, type Prim } from "@/lib/plot/core";\n\n'
          + "\n".join(exportify(block(a,b)) for a,b in FIG_BLOCKS))

parse = ("// XRD scan parsing (Rigaku .xy and generic two-column text).\n"
         "// Extracted verbatim from xrd-plotter.tsx (Phase A). No logic changes.\n\n"
         + "\n".join(exportify(block(a,b)) for a,b in PARSE_BLOCKS))

(ROOT/"src/lib/plot").mkdir(parents=True, exist_ok=True)
(ROOT/"src/lib/xrd").mkdir(parents=True, exist_ok=True)
(ROOT/"src/lib/plot/core.ts").write_text(core)
(ROOT/"src/lib/xrd/figure.ts").write_text(figure)
(ROOT/"src/lib/xrd/parse.ts").write_text(parse)

# --- remove moved blocks from the component (bottom-up) ---------------------
drop = sorted(CORE_BLOCKS + FIG_BLOCKS + PARSE_BLOCKS, reverse=True)
kept = list(orig)
for a, b in drop:
    del kept[a-1:b]

text = "".join(kept)
text = re.sub(r"\n{4,}", "\n\n\n", text)
text = re.sub(r"/\* ─+\n   Types\n   ─+ \*/\n\s*\n+", "", text)
text = re.sub(r"/\* ─+\n   Parsing[^\n]*\n   ─+ \*/\n\s*\n+", "", text)
text = re.sub(r"/\* ─+\n   Geometry[^\n]*\n   ─+ \*/\n\s*\n+", "", text)

imports = (
 'import {\n'
 '    PALETTE, PRINT_LAYOUT, screenLayout, snapLegendPos, paintCanvas, toSVG,\n'
 '    type Layout, type Prim,\n'
 '} from "@/lib/plot/core";\n'
 'import { buildFigure, type Overlay, type Reference, type Trace } from "@/lib/xrd/figure";\n'
 'import { parseScan } from "@/lib/xrd/parse";\n'
)
anchor = '} from "@/lib/xrd-session";\n'
assert anchor in text
text = text.replace(anchor, anchor + imports, 1)

SRC.write_text(text)

# --- record manifest for the verifier --------------------------------------
(ROOT/"src/lib/plot/.golden-manifest.json").write_text(
    subprocess.run(["python3","-c","import json,sys;print(json.dumps("+repr(manifest)+",indent=1))"],
                   capture_output=True, text=True).stdout)

print("core.ts   ", len(core.splitlines()), "lines")
print("figure.ts ", len(figure.splitlines()), "lines")
print("parse.ts  ", len(parse.splitlines()), "lines")
print("component ", len(text.splitlines()), "lines (was", len(orig), ")")
