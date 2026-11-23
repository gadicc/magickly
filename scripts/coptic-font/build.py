#!/usr/bin/env python3
"""Build the tablets page's Coptic font from Noto Sans Coptic (plan 095).

Downloads Noto Sans Coptic Regular (SIL OFL 1.1, no Reserved Font Name)
and its licence from the google/fonts commit the hall fonts pin, checks
their SHA-256, subsets the font to the letters the Golden Dawn's gods
are spelled in (`gd/godForms.json5`'s `coptic`) and sou (U+2C8B), which
stands for the table's "st" sign, and writes:

- public/fonts/NotoSansCoptic-gods.woff2, which
  public/fonts/NotoSansCoptic.css declares for those code points only
- public/fonts/NotoSansCoptic-OFL.txt, the upstream licence, byte for byte

The letters are read from the data each time, so a corrected spelling that
needs a new letter fails here until the font is rebuilt, and
`src/app/enochian/tablets/copticFont.test.ts` fails until the stylesheet's
`unicode-range` covers it.

Run from the repository root:

    python3 scripts/coptic-font/build.py [--cache DIR]

Needs fontTools with brotli and uharfbuzz (for the check). Outputs are
deterministic for the same versions; public/fonts/coptic-font-sources.md
records them and the hashes of the committed files.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import os
import re
import sys
import urllib.request
from pathlib import Path

import uharfbuzz as hb
from fontTools import subset
from fontTools.ttLib import TTFont

GOOGLE_FONTS_COMMIT = "8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5"
RAW = f"https://raw.githubusercontent.com/google/fonts/{GOOGLE_FONTS_COMMIT}"
SOURCES = {
    "NotoSansCoptic-Regular.ttf": (
        "ofl/notosanscoptic/NotoSansCoptic-Regular.ttf",
        "51990af1bb0df7be8bfe98fda97769cecfa36eee15381e5504df400276abd735",
    ),
    "OFL.txt": (
        "ofl/notosanscoptic/OFL.txt",
        "322570ceef6e9935b2422470682e42481903eb444fc416455c32c2c3c888c78c",
    ),
}

# Sou, the letter that stands for the "st" the gods' table marks five
# names with (`st` in gd/godForms.json5).
SOU = 0x2C8B
# The kerning is all a Coptic name of plain letters can use; the rest are
# pruned by the subsetter when they have nothing for these letters.
LAYOUT_FEATURES = ["ccmp", "kern", "mark", "mkmk"]

ROOT = Path(__file__).resolve().parents[2]
GODS = ROOT / "packages" / "magick-data" / "src" / "gd" / "godForms.json5"
OUTPUT = ROOT / "public" / "fonts" / "NotoSansCoptic-gods.woff2"
LICENCE = ROOT / "public" / "fonts" / "NotoSansCoptic-OFL.txt"


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
        sys.exit(f"{target.name}: SHA-256 {sha256(data)} does not match {expected}")
    return data


def code_points() -> list[int]:
    """Every letter of the gods' Coptic names, and sou."""
    names = re.findall(r'^\s*coptic: "([^"]*)",$', GODS.read_text(), re.M)
    if len(names) != 15:
        sys.exit(f"expected the 15 gods' Coptic names, found {len(names)}")
    letters = {ord(letter) for name in names for letter in name}
    return sorted(letters | {SOU})


def subset_font(font: TTFont, unicodes: list[int]) -> TTFont:
    options = subset.Options()
    options.layout_features = LAYOUT_FEATURES
    options.hinting = False
    options.desubroutinize = True
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.recalc_timestamp = False
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    return font


def check(ttf: bytes, unicodes: list[int]) -> None:
    """Every code point has a glyph of its own, with ink and an advance."""
    face = hb.Face(hb.Blob(ttf))
    font = hb.Font(face)
    cmap = TTFont(io.BytesIO(ttf)).getBestCmap()
    if sorted(cmap) != unicodes:
        sys.exit(f"the subset maps {sorted(cmap)}, not {unicodes}")
    for code in unicodes:
        glyph = font.get_nominal_glyph(code)
        extents = font.get_glyph_extents(glyph) if glyph else None
        if not glyph or not extents or not extents.width:
            sys.exit(f"U+{code:04X} has no glyph with ink")
        if font.get_glyph_h_advance(glyph) <= 0:
            sys.exit(f"U+{code:04X} has no advance")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--cache", type=Path,
                        default=Path(os.environ.get("TMPDIR", "/tmp")) / "coptic-font")
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)

    unicodes = code_points()
    source = fetch(args.cache, "NotoSansCoptic-Regular.ttf")
    missing = [code for code in unicodes
               if code not in TTFont(io.BytesIO(source)).getBestCmap()]
    if missing:
        sys.exit("Noto Sans Coptic lacks " +
                 ", ".join(f"U+{code:04X}" for code in missing))
    font = TTFont(io.BytesIO(source), recalcTimestamp=False)
    subset_font(font, unicodes)
    out = io.BytesIO()
    font.save(out)
    check(out.getvalue(), unicodes)
    font.flavor = "woff2"
    out = io.BytesIO()
    font.save(out)
    OUTPUT.write_bytes(out.getvalue())
    LICENCE.write_bytes(fetch(args.cache, "OFL.txt"))

    import brotli
    import fontTools
    print(f"fontTools {fontTools.version}, brotli {brotli.__version__}, "
          f"uharfbuzz {hb.__version__} (HarfBuzz {hb.version_string()})")
    print("unicode-range: " + ", ".join(f"U+{code:04X}" for code in unicodes))
    for path in (OUTPUT, LICENCE):
        data = path.read_bytes()
        print(f"| {path.relative_to(ROOT)} | {len(data)} | {sha256(data)} |")


if __name__ == "__main__":
    main()
