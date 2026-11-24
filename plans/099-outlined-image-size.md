# Outlined image size

Implementation record, 24 November 2026. Read
[current status](000-current-status.md) first. It follows the input audit's
render limits ([limits README](../src/limits/README.md)), which found that
one kamea sigil could be a 6 MB SVG, and it moves every outlined image's
profile.

## Why the images were large

Every component image is drawn by its React component and then outlined by
resvg (`outlineComponentImage` in `src/render/outlineTreeImage.ts`): text
becomes glyph paths, and the SVG is flattened. Two things made the output
large.

1. **Repeats are copied.** resvg expands every `<use>` into a full copy,
   and the outliner then refuses any link in its output. A kamea sigil
   draws the planet's square under every word, so 32 one-letter words on
   the Moon's square (`kamea-sigil?planet=luna&text=ת ת …`) were 32 copies
   of the square: 81 outlined numerals each, 2,720 paths, 5,996,961 bytes.
   Only 147 of the paths were distinct. Brotli hid this from browsers
   (37 KB), but a client that asks for no compression got all 6 MB, and
   the firewall lets an address fetch a cached image 20 times a minute.
2. **Coordinates kept six or more decimals.** resvg writes glyph outlines
   as single-precision floats (`41.648123 -40.840923`), five or six
   decimals that no reader sees and every download carries. The Tree's
   own geometry was already rounded to three decimals before outlining
   ([plan 030](030-tree-coordinate-rounding.md)); its glyphs were not.

## Repeated groups, drawn once

`reuse: { idPrefix }` on a registration runs `reuseRepeatedGroups` after
outlining: each top-level group whose contents repeat another's byte for
byte (its opening tag bare, or carrying only a `transform`) is written once
in the `<defs>` as `<g id="<prefix><n>">` and placed with
`<use xlink:href="#<prefix><n>" transform="…"/>` wherever it stood. That
draws the same pixels: the `<use>` has the same parent and the shared
group no attributes of its own. Checked with sharp on the 6 MB case and,
in review, on seven cases at three resolutions: zero differing bytes.

- Its links are the only ones an image may hold. The refusal of `href=`,
  `<text>`, `<style>` and `<image>` runs on resvg's output before the step
  adds them; the registry test checks every link names a group in the
  image's own `<defs>`; the ritual image validator accepts `<use>` of a
  `<g>`. The prefix may not share or extend `paintServers`' prefix.
- Its ids are the same in every image (`square-0`), so a document that
  pastes several images together (`scripts/home-tile`) needs its own
  prefixes.
- Used by `kamea-sigil` (`square-`) and `rose-sigil` (`rose-`). The rose
  is shared from the second word on: the first word's rose stands
  ungrouped on its own coordinates, so a two-word rose sigil is
  unchanged. Its worst case was about 400 KB, so this was left.
- The Moon's 32 words: 5,996,961 → 203,668 bytes before rounding; Venus'
  two words 235,171 → 118,423. A one-word sigil's bytes did not change.

## Coordinates rounded

`roundOutlinedPaths` rounds every number in every outlined path's `d` to
the decimals that keep `OUTLINE_PRECISION`, a hundred-thousandth of the
drawing's larger side, with one count of decimals for the whole image.
Where a transform scales a group up (a temple hall's art is drawn small
and scaled by up to 100), the step is divided by the largest nested scale,
so every part keeps the same relative precision. resvg writes matrices in
single precision, so a rotation's scale comes to 1.00000005; a tolerance
of a few parts per million keeps that from costing a decimal.

resvg's paths are absolute, so no error accumulates, and a point several
paths share rounds the same in each. resvg-wasm 2.6.2's `toString()` has
no precision option, so this is done on its output. Transforms and other
attributes are left as written.

### How much precision

A sigil's square is 100 units, so a hundred-thousandth is 0.001, three
decimals: half a micron if a word is printed 10 cm wide, 5 µm at a metre.
For comparison: FDM 3D printing resolves about 0.05 mm in XY (0.4 mm
nozzle), resin printing 0.025–0.05 mm, laser engraving 0.025–0.1 mm, CNC
milling about 0.01 mm, a 1200 dpi print about 0.02 mm. Three decimals is
also SVGO's default. No tradition of the sigils that we know of states a
numeric tolerance: the sources (Agrippa, the Golden Dawn papers) give the
construction (the cells a name visits, the circle at its start, the bar at
its end) and the figures were drawn by hand. Rounding moves a point by a
fraction of a micron at any real size and cannot move it to another cell.

Measured at each image's PNG size, rounding the outlined paths to three
decimals changed under 1% of pixel channels, almost all by a few levels
at anti-aliased edges. The few channels that changed by up to 255 belong
to nearly transparent edge pixels, whose colour is meaningless; enlarged
8×, the worst spots look identical.

### Effect, by image

One sample of each, before (main at `bb0188e2`, with reuse) and after.
"Decimals" is what the image keeps.

| Image | Decimals | Bytes | Brotli |
|---|---|---|---|
| `tree-of-life` | 3 | 44,251 → 38,117 (−14%) | 10,649 → 8,377 (−21%) |
| `astro-geomancy-chart` | 3 | 52,476 → 45,104 (−14%) | 10,222 → 8,571 (−16%) |
| `enochian-tablet` | 3 | 121,886 → 116,673 (−4%) | 19,143 → 13,342 (−30%) |
| `enochian-tablet-pyramids` | 3 | 252,005 → 243,520 (−3%) | 22,198 → 18,215 (−18%) |
| `seven-branched-candlestick` | 3 | 87,746 → 68,598 (−22%) | 24,189 → 17,181 (−29%) |
| `table-of-shewbread` | 3 | 126,699 → 94,793 (−25%) | 34,478 → 22,686 (−34%) |
| `rose-sigil` | 3 | 12,640 → 10,957 (−13%) | 3,083 → 2,547 (−17%) |
| `kamea` | 3 | 186,103 → 145,019 (−22%) | 36,380 → 27,482 (−24%) |
| `kamea-sigil` | 3 | 187,893 → 146,648 (−22%) | 36,804 → 27,747 (−25%) |
| `gd-hall` | 4 | 210,246 → 200,206 (−5%) | 51,961 → 48,499 (−7%) |
| `angel-sigil` | 4 | 16,823 → 14,490 (−14%) | 3,306 → 2,736 (−17%) |

The published Theoricus ritual Tree, which the golden test pins, went from
150,785 to 124,411 bytes.

## Profiles

Every outlined image's bytes changed, so every image profile moved
([plan 027](027-component-exports.md) asks for a bump exactly when the
outlined bytes change): the Tree's `magickli-tree-image-outlines-v5`, the
shared `magickli-component-image-outlines-v2`, `magickli-gd-hall-image-v3`,
`magickli-angel-sigil-image-v2`, `magickli-kamea-image-v2`,
`magickli-tablet-pyramids-image-v2`, and for the two sigils, which also
gained reuse, `magickli-rose-sigil-image-v3` and
`magickli-kamea-sigil-image-v3` (their v2, reuse alone, landed on local
main the same day and was never pushed). Pins keyed by profile keep every
earlier set and add one for the new profile; pins keyed by query moved in
place, each with its old size and hash in a comment. Digests of the
figures' path data, taken before outlining, did not move and are recorded
again under the new profiles.

## Effects on published rituals

As in [plan 030](030-tree-coordinate-rounding.md#effects-on-published-rituals):
offline bundles already published keep their stored bytes, and each
ritual's next publication draws the new images and its own manifest. A
publication started before the deploy and retried after it builds a
different manifest under the same operation and is refused as an operation
conflict; starting a new publication resolves that.

### The temple halls

A hall keeps four decimals (its art is scaled by up to 100), which moves a
point by about 0.004 px at its 1,500 px raster. Even so, rasterised by
sharp, 1.4–1.9% of its pixel channels change by at least one level, up to
about 70, against under 1% elsewhere: anti-aliased edges and the faint
seams of a tiled background, where librsvg responds to tiny changes in
the coordinates, not shapes that moved. Enlarged 10× at the worst spot,
the two are the same drawing. `compactHallSvg`'s note recorded that a
flat thousandth once moved a hall's pixels visibly; with the decimals
scaled to the art, the owner chose to round the halls with everything
else (24 November 2026), for 5% of their bytes, 7% compressed.

## Not done

- The rose sigil's first rose is not shared (above).
- Transforms keep resvg's single-precision digits; there are few of them.
