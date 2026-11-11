#!/usr/bin/env python3
"""Build the app's Hebrew text font from Frank Ruhl Libre (plan 079).

Downloads Frank Ruhl Libre's variable font (SIL OFL 1.1, no Reserved Font
Name) from the google/fonts commit the hall fonts pin, checks its SHA-256,
adds U+05C4 (HEBREW MARK UPPER DOT), which Lenain points his letters with
and the font lacks, subsets it to the Hebrew block and writes:

- public/fonts/FrankRuhlLibre-Hebrew.woff2, one variable font for every
  weight (300–900), which public/fonts/FrankRuhlLibre.css declares

The upper dot is the font's own holam dot, attached by a new mark class
centred over each letter: across from the letter's below-vowel anchor
(the designer's centre for its points) at the height of its holam anchor,
both of which vary with weight. A letter without those anchors (the final
forms, which never carry the dot in our texts) takes its ink centre at
holam's height. The glyphs `ccmp` composes from a letter and its points
(lamed with dagesh, shin with its dot...) take their letter's anchor. public/fonts/FrankRuhlLibre-OFL.txt, the licence, comes
from scripts/gd-hall-fonts/build.py, which uses the same source.

Run from the repository root:

    python3 scripts/hebrew-text-font/build.py [--cache DIR]

Needs fontTools with brotli and uharfbuzz (for the check). Outputs are
deterministic for the same versions; public/fonts/hebrew-text-font-sources.md
records them and the hashes of the committed file.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import io
import os
import sys
import urllib.request
from pathlib import Path

import uharfbuzz as hb
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables as ot

GOOGLE_FONTS_COMMIT = "8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5"
RAW = f"https://raw.githubusercontent.com/google/fonts/{GOOGLE_FONTS_COMMIT}"
SOURCE = (
    "ofl/frankruhllibre/FrankRuhlLibre%5Bwght%5D.ttf",
    "f9bf26966681037aae894b031bd0dcf2c1bfdfa128dd0640cf276fe62a338a43",
)

UPPER_DOT = 0x05C4
HOLAM = "uni05B9"
# The Hebrew block, as the CLM stylesheet it replaces declared it.
HEBREW_BLOCK = range(0x0590, 0x0600)
LETTERS = range(0x05D0, 0x05EB)
# locl and mkmk have nothing for Hebrew and are pruned; kept in case a
# later source adds some.
LAYOUT_FEATURES = ["ccmp", "locl", "mark", "mkmk", "kern"]

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public" / "fonts" / "FrankRuhlLibre-Hebrew.woff2"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(cache: Path) -> bytes:
    path, expected = SOURCE
    target = cache / "FrankRuhlLibre[wght].ttf"
    if not target.exists():
        print(f"download {RAW}/{path}", file=sys.stderr)
        with urllib.request.urlopen(f"{RAW}/{path}") as response:
            target.write_bytes(response.read())
    data = target.read_bytes()
    if sha256(data) != expected:
        sys.exit(f"{target.name}: SHA-256 {sha256(data)} does not match {expected}")
    return data


def mark_to_base(font: TTFont):
    """The one MarkBasePos subtable the `mark` feature applies."""
    gpos = font["GPOS"].table
    found = []
    for record in gpos.FeatureList.FeatureRecord:
        if record.FeatureTag != "mark":
            continue
        for index in record.Feature.LookupListIndex:
            lookup = gpos.LookupList.Lookup[index]
            for sub in lookup.SubTable:
                sub = sub.ExtSubTable if lookup.LookupType == 9 else sub
                if sub.LookupType == 4:
                    found.append(sub)
    if len({id(s) for s in found}) != 1:
        sys.exit(f"expected one mark-to-base subtable, found {len(found)}")
    return found[0]


def add_upper_dot(font: TTFont) -> None:
    font.ensureDecompiled()
    cmap = font.getBestCmap()
    if UPPER_DOT in cmap:
        sys.exit("the font already has U+05C4")
    by_glyph = {glyph: code for code, glyph in cmap.items()}
    name = "uni05C4"

    font.setGlyphOrder([*font.getGlyphOrder(), name])
    glyf = font["glyf"]
    glyf.glyphOrder = font.getGlyphOrder()
    glyf[name] = copy.deepcopy(glyf[HOLAM])
    font["hmtx"][name] = font["hmtx"][HOLAM]
    font["gvar"].variations[name] = copy.deepcopy(
        font["gvar"].variations.get(HOLAM, []))
    hvar = font["HVAR"].table
    for field in ("AdvWidthMap", "LsbMap", "RsbMap"):
        mapping = getattr(hvar, field, None)
        if mapping is not None:
            mapping.mapping[name] = mapping.mapping[HOLAM]
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[UPPER_DOT] = name
    font["GDEF"].table.GlyphClassDef.classDefs[name] = 3  # a mark
    font["maxp"].numGlyphs = len(font.getGlyphOrder())

    sub = mark_to_base(font)
    marks = sub.MarkCoverage.glyphs
    holam = sub.MarkArray.MarkRecord[marks.index(HOLAM)]
    below_class = sub.MarkArray.MarkRecord[marks.index("uni05B4")].Class  # hiriq
    holam_class = holam.Class
    new_class = sub.ClassCount
    sub.ClassCount += 1
    record = ot.MarkRecord()
    record.Class = new_class
    record.MarkAnchor = copy.deepcopy(holam.MarkAnchor)
    pairs = sorted([*zip(marks, sub.MarkArray.MarkRecord), (name, record)],
                   key=lambda pair: font.getGlyphID(pair[0]))
    sub.MarkCoverage.glyphs = [glyph for glyph, _ in pairs]
    sub.MarkArray.MarkRecord = [rec for _, rec in pairs]
    sub.MarkArray.MarkCount = len(pairs)

    # Every Hebrew letter gets the new class; add the finals the font's
    # bases leave out, with an anchor in no other class.
    bases = dict(zip(sub.BaseCoverage.glyphs, sub.BaseArray.BaseRecord))
    for code in LETTERS:
        glyph = cmap[code]
        if glyph not in bases:
            base = ot.BaseRecord()
            base.BaseAnchor = [None] * new_class
            bases[glyph] = base
    for glyph, base in bases.items():
        base.BaseAnchor.append(
            top_centre(font, glyph, base, below_class, holam_class)
            if by_glyph.get(glyph) in LETTERS else None)
    # `ccmp` composes a letter and its points into one glyph (lamed with
    # dagesh, shin with its dot, alef with qamats...) when the text is
    # tagged Hebrew, as every page of ours is; each takes the dot where
    # the letter it starts from has it. Some build on others (shin with
    # its dot, then dagesh), so repeat until nothing changes.
    pending = ccmp_ligatures(font)
    while True:
        done = []
        for first, ligature in pending:
            anchor = bases[first].BaseAnchor[new_class] if first in bases else None
            if anchor is None:
                continue
            base = bases.get(ligature)
            if base is None:
                base = bases[ligature] = ot.BaseRecord()
                base.BaseAnchor = [None] * (new_class + 1)
            if base.BaseAnchor[new_class] is None:
                base.BaseAnchor[new_class] = copy.deepcopy(anchor)
            done.append((first, ligature))
        if not done:
            break
        pending = [pair for pair in pending if pair not in done]
    ordered = sorted(bases, key=font.getGlyphID)
    sub.BaseCoverage.glyphs = ordered
    sub.BaseArray.BaseRecord = [bases[glyph] for glyph in ordered]
    sub.BaseArray.BaseCount = len(ordered)


def ccmp_ligatures(font: TTFont) -> list[tuple[str, str]]:
    """(first component, ligature) for every `ccmp` ligature."""
    gsub = font["GSUB"].table
    indices = sorted({index for record in gsub.FeatureList.FeatureRecord
                      if record.FeatureTag == "ccmp"
                      for index in record.Feature.LookupListIndex})
    pairs = []
    for index in indices:
        lookup = gsub.LookupList.Lookup[index]
        for sub in lookup.SubTable:
            sub = sub.ExtSubTable if lookup.LookupType == 7 else sub
            if sub.LookupType != 4:
                continue
            for first, ligatures in sub.ligatures.items():
                pairs += [(first, ligature.LigGlyph) for ligature in ligatures]
    return pairs


def top_centre(font, glyph, base, below_class, holam_class):
    below, holam = base.BaseAnchor[below_class], base.BaseAnchor[holam_class]
    anchor = ot.Anchor()
    anchor.Format = 3
    anchor.XDeviceTable = anchor.YDeviceTable = None
    if below is not None:
        anchor.XCoordinate = below.XCoordinate
        anchor.XDeviceTable = copy.deepcopy(getattr(below, "XDeviceTable", None))
    else:
        outline = font["glyf"][glyph]
        outline.recalcBounds(font["glyf"])
        anchor.XCoordinate = (outline.xMin + outline.xMax) // 2
    if holam is not None:
        anchor.YCoordinate = holam.YCoordinate
        anchor.YDeviceTable = copy.deepcopy(getattr(holam, "YDeviceTable", None))
    else:
        anchor.YCoordinate = 468  # holam's height on every letter that has it
    if anchor.XDeviceTable is None and anchor.YDeviceTable is None:
        anchor.Format = 1
    return anchor


def subset_font(font: TTFont) -> TTFont:
    options = subset.Options()
    options.layout_features = LAYOUT_FEATURES
    options.hinting = False
    options.desubroutinize = True
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.recalc_timestamp = False
    subsetter = subset.Subsetter(options)
    cmap = font.getBestCmap()
    subsetter.populate(unicodes=[u for u in HEBREW_BLOCK if u in cmap])
    subsetter.subset(font)
    return font


# What the texts put the dot on, bare and with the points `ccmp` composes
# into one glyph: dagesh (once, and twice as one name has it), qamats,
# holam on vav, shin dot.
DOTTED = ["א", "י", "ל", "ש", "ב", "ל\u05BC", "ל\u05BC\u05BC", "א\u05BC",
          "י\u05BC", "א\u05B8", "ו\u05B9", "ש\u05C1"]


def check(ttf: bytes) -> None:
    """The dot sits over each letter that carries it, at every weight,
    whether or not the text is tagged Hebrew (which selects the `IWR `
    language system and its ligatures, as browsers do for lang="he")."""
    face = hb.Face(hb.Blob(ttf))
    font = hb.Font(face)
    dot_glyph = font.get_nominal_glyph(UPPER_DOT)

    def shape(text, language):
        buf = hb.Buffer()
        buf.add_str(text + chr(UPPER_DOT))
        buf.guess_segment_properties()
        if language:
            buf.language = language
        hb.shape(font, buf)
        dot = next(p for i, p in zip(buf.glyph_infos, buf.glyph_positions)
                   if i.codepoint == dot_glyph)
        base = next(p for p in buf.glyph_positions if p.x_advance)
        return dot, base

    for weight in (300, 400, 700, 900):
        font.set_variations({"wght": weight})
        for language in (None, "he"):
            for text in DOTTED:
                dot, base = shape(text, language)
                bare, _ = shape(text[0], language)
                if (not (0 < dot.x_offset < base.x_advance)
                        or dot.y_offset < -20
                        or (dot.x_offset, dot.y_offset)
                        != (bare.x_offset, bare.y_offset)):
                    sys.exit(f"U+05C4 on {text!r} at weight {weight}, "
                             f"language {language}: offset "
                             f"({dot.x_offset}, {dot.y_offset}), bare letter "
                             f"({bare.x_offset}, {bare.y_offset})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--cache", type=Path,
                        default=Path(os.environ.get("TMPDIR", "/tmp")) / "gd-hall-fonts")
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)

    font = TTFont(io.BytesIO(fetch(args.cache)), recalcTimestamp=False)
    add_upper_dot(font)
    subset_font(font)
    out = io.BytesIO()
    font.save(out)
    check(out.getvalue())
    font.flavor = "woff2"
    out = io.BytesIO()
    font.save(out)
    OUTPUT.write_bytes(out.getvalue())

    import brotli
    import fontTools
    print(f"fontTools {fontTools.version}, brotli {brotli.__version__}, "
          f"uharfbuzz {hb.__version__} (HarfBuzz {hb.version_string()})")
    data = OUTPUT.read_bytes()
    print(f"| {OUTPUT.relative_to(ROOT)} | {len(data)} | {sha256(data)} |")


if __name__ == "__main__":
    main()
