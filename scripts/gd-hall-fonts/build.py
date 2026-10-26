#!/usr/bin/env python3
"""Build the temple-hall fonts and their metrics (plan 061, decision 7).

google/fonts ships Noto Serif and Noto Serif Hebrew only as variable fonts.
This script downloads them from a pinned google/fonts commit, checks their
SHA-256, makes static instances with the fontTools instancer, subsets them
and writes:

- public/fonts/NotoSerif-Italic-latin1.woff2      labels and captions
- public/fonts/NotoSerif-BoldItalic-compass.woff2 the compass labels
- public/fonts/NotoSerifHebrew-Bold-letters.woff2 Hebrew-letter banners
- assets/fonts/NotoSerif-Italic-latin1.ttf, NotoSerif-BoldItalic-compass.ttf
  and NotoSerifHebrew-Bold-letters.ttf, the same subsets as TrueType for
  the server's image renderer (resvg reads no WOFF2; plan 062), outside
  public/ so no URL serves them and the service worker never caches them
- public/fonts/NotoSerif-OFL.txt, NotoSerifHebrew-OFL.txt (upstream notices)
- public/fonts/NotoSans-OFL.txt, NotoSansHebrew-OFL.txt, the notices the
  existing NotoSans-Regular.ttf and NotoSansHebrew-Regular.ttf lacked: their
  own copyright line (name ID 0) above the OFL 1.1 text
- src/components/gd/hall/fontMetrics.json, the advances and GPOS kern pairs
  that label wrapping and the Pantacle's ring measure with (no DOM
  measurement)

Run from the repository root:

    python3 scripts/gd-hall-fonts/build.py [--cache DIR]

Needs fontTools with brotli, and uharfbuzz for the kern pairs. Outputs are
deterministic for the same fontTools, brotli and HarfBuzz versions (no
timestamps are recalculated); public/fonts/Noto-hall-sources.md records the
versions and hashes of the committed files. The JSON is formatted with the
repository's Biome afterwards so `pnpm check` stays clean.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

import uharfbuzz as hb
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

GOOGLE_FONTS_COMMIT = "8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5"
RAW = f"https://raw.githubusercontent.com/google/fonts/{GOOGLE_FONTS_COMMIT}"

# Upstream files and their SHA-256 at the pinned commit.
SOURCES = {
    "NotoSerif-Italic[wdth,wght].ttf": (
        "ofl/notoserif/NotoSerif-Italic%5Bwdth,wght%5D.ttf",
        "e87acbc6c0efd0d9a20d6a8cbbda2b266c14be3a3a6f5af8ec9d7b2460570ad1",
    ),
    "NotoSerifHebrew[wdth,wght].ttf": (
        "ofl/notoserifhebrew/NotoSerifHebrew%5Bwdth,wght%5D.ttf",
        "93caef921360788dc3b0e32136bb26f16bc57717ec482d48fc7fd43820617165",
    ),
    "notoserif-OFL.txt": (
        "ofl/notoserif/OFL.txt",
        "cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a",
    ),
    "notoserifhebrew-OFL.txt": (
        "ofl/notoserifhebrew/OFL.txt",
        "9b9fe028b5ba74d231659a1bbaf0ed09b11e759d1ca6a070999e16d151616b47",
    ),
    "notosans-OFL.txt": (
        "ofl/notosans/OFL.txt",
        "cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a",
    ),
}

# Latin-1, plus the dashes, curly quotes and ellipsis an editor types.
LATIN1 = [
    *range(0x20, 0x7F),
    *range(0xA0, 0x100),
    0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026,
]
COMPASS_TEXT = "East West North South"
# The twenty-two letters and the five final forms, U+05D0–U+05EA.
HEBREW = [*range(0x05D0, 0x05EB)]
# Default-ignorable characters in the subset: drawn as nothing.
IGNORABLE = {0x00AD}
# font-variant-ligatures: none turns off all of these in the browser; the
# subsets keep only `kern`, so a renderer that ignores the CSS agrees too.
NO_LIGATURES = {"liga": False, "clig": False, "dlig": False, "hlig": False,
                "calt": False, "kern": True}

ROOT = Path(__file__).resolve().parents[2]
PUBLIC_FONTS = ROOT / "public" / "fonts"
ASSET_FONTS = ROOT / "assets" / "fonts"
METRICS_JSON = ROOT / "src" / "components" / "gd" / "hall" / "fontMetrics.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(cache: Path, name: str) -> bytes:
    path, expected = SOURCES[name]
    target = cache / name
    if not target.exists():
        print(f"download {RAW}/{path}", file=sys.stderr)
        with urllib.request.urlopen(f"{RAW}/{path}") as response:
            target.write_bytes(response.read())
    data = target.read_bytes()
    if sha256(data) != expected:
        sys.exit(f"{name}: SHA-256 {sha256(data)} does not match {expected}")
    return data


def static_instance(data: bytes, wght: int) -> TTFont:
    font = TTFont(io.BytesIO(data), recalcTimestamp=False)
    return instancer.instantiateVariableFont(
        font, {"wght": wght, "wdth": 100}, updateFontNames=True
    )


def subset_font(font: TTFont, unicodes: list[int]) -> TTFont:
    options = subset.Options()
    options.layout_features = ["kern"]
    options.hinting = False
    options.desubroutinize = True
    # Keep the copyright, licence and licence URL with the outlines.
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.recalc_timestamp = False
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    return font


def to_bytes(font: TTFont, flavor: str | None = None) -> bytes:
    font.flavor = flavor
    out = io.BytesIO()
    font.save(out)
    return out.getvalue()


def metrics(ttf: bytes, unicodes: list[int]) -> dict:
    """Advances and kern pairs in font units, as HarfBuzz shapes them."""
    font = TTFont(io.BytesIO(ttf))
    upem = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    os2 = font["OS/2"]
    hb_font = hb.Font(hb.Face(hb.Blob(ttf)))

    def shaped(text: str) -> int:
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(hb_font, buf, NO_LIGATURES)
        return sum(p.x_advance for p in buf.glyph_positions)

    chars = [u for u in unicodes if u in cmap]
    # Unaccented letters and digits; a script with neither (Hebrew) uses
    # all its characters.
    letters = [u for u in chars if chr(u).isascii() and chr(u).isalnum()] or chars
    # Each character's advance as HarfBuzz shapes it alone, not its glyph's:
    # the soft hyphen (U+00AD) is default-ignorable and draws nothing, so
    # it takes no space, and its glyph's 310 units would otherwise turn into
    # a -310 "kern" on each side of it. HarfBuzz kerns across it (A, soft
    # hyphen, V kerns as AV), so it takes no part in pairs either: label
    # measurement skips zero-advance characters when kerning.
    advances = {u: shaped(chr(u)) for u in chars}
    for u in chars:
        if advances[u] != (0 if u in IGNORABLE else hmtx[cmap[u]][0]):
            sys.exit(f"U+{u:04X}: shaped advance {advances[u]} is unexpected")
    kerned = [u for u in chars if u not in IGNORABLE]
    pairs = {}
    for a in kerned:
        for b in kerned:
            delta = shaped(chr(a) + chr(b)) - advances[a] - advances[b]
            if delta:
                pairs[(a, b)] = delta
    # GPOS kerns by class (À kerns like A), so store it that way: about a
    # quarter of the size of the 2,000-odd character pairs. Class 0 never
    # kerns; classes are numbered in character order.
    def classes(row):
        numbers, out = {}, {}
        for u in chars:
            key = row(u)
            if any(key):
                out[u] = numbers.setdefault(key, len(numbers) + 1)
        return out

    left = classes(lambda a: tuple(pairs.get((a, b), 0) for b in kerned))
    right = classes(lambda b: tuple(pairs.get((a, b), 0) for a in kerned))
    class_pairs = {}
    for (a, b), delta in pairs.items():
        class_pairs[(left[a], right[b])] = delta
    table = {
        "upem": upem,
        "ascender": os2.sTypoAscender,
        "descender": os2.sTypoDescender,
        "capHeight": os2.sCapHeight,
        "xHeight": os2.sxHeight,
        # The ink of unaccented letters and digits, for spacing labels from
        # what they label: ascenders above the baseline, descenders below.
        "letterTop": max(ink(font, cmap, u).yMax for u in letters),
        "letterBottom": min(ink(font, cmap, u).yMin for u in letters),
        # Flat arrays so Biome fills lines instead of one entry per line:
        # [codepoint, advance, ...], [codepoint, class, ...] and
        # [left class, right class, kern, ...].
        "advances": [n for u in chars for n in (u, advances[u])],
        "kernLeft": [n for u in left for n in (u, left[u])],
        "kernRight": [n for u in right for n in (u, right[u])],
        "kern": [n for key in sorted(class_pairs) for n in (*key, class_pairs[key])],
    }
    for a in kerned:
        for b in kerned:
            got = class_pairs.get((left.get(a, 0), right.get(b, 0)), 0)
            if got != pairs.get((a, b), 0):
                sys.exit(f"class table gives {got} for {chr(a)}{chr(b)}")
    return table, shaped, len(pairs)


def ink(font: TTFont, cmap: dict, u: int):
    glyph = font["glyf"][cmap[u]]
    glyph.recalcBounds(font["glyf"])
    return glyph


def check_pairs(table: dict, shaped, samples: list[str]) -> None:
    """The class table must reproduce whole-string shaping exactly."""
    adv = dict(zip(table["advances"][::2], table["advances"][1::2]))
    left = dict(zip(table["kernLeft"][::2], table["kernLeft"][1::2]))
    right = dict(zip(table["kernRight"][::2], table["kernRight"][1::2]))
    k = table["kern"]
    kern = {(k[i], k[i + 1]): k[i + 2] for i in range(0, len(k), 3)}
    for text in samples:
        # As labels.ts measures: zero-advance characters are skipped for
        # kerning.
        drawn = [c for c in text if adv[ord(c)] != 0]
        total = sum(adv[ord(c)] for c in text) + sum(
            kern.get((left.get(ord(a), 0), right.get(ord(b), 0)), 0)
            for a, b in zip(drawn, drawn[1:])
        )
        if total != shaped(text):
            sys.exit(f"pair table gives {total} for {text!r}, HarfBuzz {shaped(text)}")


def ofl_notice(upstream: bytes, copyright_line: str | None = None) -> bytes:
    text = upstream.decode("utf-8")
    if copyright_line:
        text = copyright_line + "\n" + text.split("\n", 1)[1]
    return text.encode("utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--cache", type=Path,
                        default=Path(os.environ.get("TMPDIR", "/tmp")) / "gd-hall-fonts")
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)

    italic_vf = fetch(args.cache, "NotoSerif-Italic[wdth,wght].ttf")
    hebrew_vf = fetch(args.cache, "NotoSerifHebrew[wdth,wght].ttf")

    italic = subset_font(static_instance(italic_vf, 400), LATIN1)
    italic_ttf = to_bytes(italic)
    bold = subset_font(static_instance(italic_vf, 700),
                       sorted({ord(c) for c in COMPASS_TEXT}))
    bold_ttf = to_bytes(bold)
    hebrew = subset_font(static_instance(hebrew_vf, 700), HEBREW)
    hebrew_ttf = to_bytes(hebrew)

    outputs = {
        PUBLIC_FONTS / "NotoSerif-Italic-latin1.woff2": to_bytes(italic, "woff2"),
        PUBLIC_FONTS / "NotoSerif-BoldItalic-compass.woff2": to_bytes(bold, "woff2"),
        PUBLIC_FONTS / "NotoSerifHebrew-Bold-letters.woff2": to_bytes(hebrew, "woff2"),
        # The same subsets as TrueType, from the same run, for resvg.
        ASSET_FONTS / "NotoSerif-Italic-latin1.ttf": italic_ttf,
        ASSET_FONTS / "NotoSerif-BoldItalic-compass.ttf": bold_ttf,
        ASSET_FONTS / "NotoSerifHebrew-Bold-letters.ttf": hebrew_ttf,
        PUBLIC_FONTS / "NotoSerif-OFL.txt": ofl_notice(
            fetch(args.cache, "notoserif-OFL.txt")),
        PUBLIC_FONTS / "NotoSerifHebrew-OFL.txt": ofl_notice(
            fetch(args.cache, "notoserifhebrew-OFL.txt")),
    }
    # The 2017 Noto Sans builds carry their own copyright line; the licence
    # text is the same OFL 1.1.
    sans_ofl = fetch(args.cache, "notosans-OFL.txt")
    for name in ("NotoSans-Regular.ttf", "NotoSansHebrew-Regular.ttf"):
        existing = TTFont(PUBLIC_FONTS / name)
        line = existing["name"].getDebugName(0)
        outputs[PUBLIC_FONTS / name.replace("-Regular.ttf", "-OFL.txt")] = (
            ofl_notice(sans_ofl, line))

    label, label_shaped, label_pairs = metrics(italic_ttf, LATIN1)
    check_pairs(label, label_shaped, [
        "Imperator", "Cancellarius", "Hierophant", "Past Hierophant",
        "Praemonstrator", "Hiereus", "Hegemon", "Keryx", "Stolistes",
        "Dadouchos", "Sentinel", "Neophyte Temple", "Banner of the West",
        "AVATAR Wave Ty Yo", "Füße à côté — «Ægir»", "Hiereus’ “Throne”…",
        "Hiero\u00adphant", "Past\u00a0Hierophant", "A\u00adV",
    ])
    compass, compass_shaped, _ = metrics(bold_ttf, sorted({ord(c) for c in COMPASS_TEXT}))
    check_pairs(compass, compass_shaped, COMPASS_TEXT.split(" "))
    hebrew_metrics, hebrew_shaped, _ = metrics(hebrew_ttf, HEBREW)
    # The Earth's names on the Pantacle's ring, set glyph by glyph.
    check_pairs(hebrew_metrics, hebrew_shaped, [
        "אדני", "אוריאל", "כרוב", "פרת", "צפון", "פורלאך", "ארץ",
    ])
    hebrew_glyphs = TTFont(io.BytesIO(outputs[PUBLIC_FONTS / "NotoSerifHebrew-Bold-letters.woff2"]))
    shin = hebrew_glyphs["glyf"][hebrew_glyphs.getBestCmap()[0x05E9]]
    document = {
        "comment": "Generated by scripts/gd-hall-fonts/build.py; do not edit.",
        "source": f"google/fonts@{GOOGLE_FONTS_COMMIT}",
        "label": label,
        "compass": compass,
        "hebrew": {
            **hebrew_metrics,
            "upem": hebrew_glyphs["head"].unitsPerEm,
            # Shin has neither ascender nor descender: the letter body.
            "bodyTop": shin.yMax,
            "bodyBottom": shin.yMin,
        },
    }
    outputs[METRICS_JSON] = (json.dumps(document) + "\n").encode("utf-8")

    for path, data in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    biome = ROOT / "node_modules" / ".bin" / "biome"
    if biome.exists():
        subprocess.run([str(biome), "format", "--write", str(METRICS_JSON)],
                       check=True, cwd=ROOT)
    import brotli
    import fontTools
    print(f"fontTools {fontTools.version}, brotli {brotli.__version__}, "
          f"uharfbuzz {hb.__version__} (HarfBuzz {hb.version_string()})")
    print(f"label: {len(label['advances']) // 2} advances, "
          f"{label_pairs} kern pairs in {len(label['kern']) // 3} class pairs")
    print("| File | Bytes | SHA-256 |\n| --- | --- | --- |")
    for path in outputs:
        data = path.read_bytes()
        print(f"| {path.relative_to(ROOT)} | {len(data)} | {sha256(data)} |")


if __name__ == "__main__":
    main()
