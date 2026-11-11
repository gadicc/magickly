# Frank Ruhl Libre replaces FrankRuehl CLM — 11 November 2026

Status: decided by Gadi on 11 November 2026 (replace FrankRuehl CLM
everywhere with Frank Ruhl Libre, and set the halls' Hebrew letters in
Frank Ruhl Libre Bold); built on `gate/frank-ruhl-libre`. Decision 2 (the
upper dot Frank Ruhl Libre lacks) confirmed by Gadi the same day. Read
[current status](000-current-status.md) first.

## Background

The app's Hebrew text font was Culmus's **FrankRuehl CLM** (Maxim Iorsh),
four WOFF2 files in `public/fonts` with `FrankRuehlCLM-LICENSE.txt`. That
licence attaches the document-embedding "font exception" to Yoram Gnat's
families only (Shofar, Keter YG, Hadasim, Simple, Stam); Frank-Ruehl is
plain GPL-2, as Debian's packaging also lists it
(<https://metadata.ftp-master.debian.org/changelogs//main/c/culmus/culmus_0.140-2.1_copyright>).
[Plan 061](061-gd-hall.md), decision 7, assumed the exception applied. On
screen that is harmless, but an outlined image or SVG download drawn with
it would carry GPL-2 font data, and none of it may go into the MIT
`magick-components` package that plan 078 (in preparation) sets up.

**Frank Ruhl Libre** (Yanek Iontef; google/fonts
`ofl/frankruhllibre/FrankRuhlLibre[wght].ttf`) is SIL OFL 1.1,
"Copyright 2015 The Frank Ruhl Libre Project Authors
(https://github.com/fontef/frankruhllibre)", with no Reserved Font Name, so
it may be subset, instanced and modified under its own name. It is a
variable font on the weight axis (300–900) and has no italic. A side-by-side
mock-up on 11 November showed its Bold almost identical to FrankRuehl CLM
Bold.

Source, pinned: google/fonts commit
`8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5` (the commit the hall's Noto
fonts and Noto Emoji already use): `FrankRuhlLibre[wght].ttf`, SHA-256
`f9bf26966681037aae894b031bd0dcf2c1bfdfa128dd0640cf276fe62a338a43`;
`OFL.txt`, SHA-256
`4e9720b2544d946737e7dfe0027a62c23c7247f0144f08bc437cdcc2e6a7d828`.

### Where FrankRuehl CLM was used

| Place | What it did |
| --- | --- |
| `src/app/books/la-science-cabalistique/Reading.tsx`, `reading.module.css` | Lenain's Hebrew; [plan 033](033-lenain-edition.md) chose CLM for U+05C4 (upper dot) and U+05BC (dagesh) |
| `src/components/entity/entity.module.css` (`.hebrew`) | Names on the sephirah, path, planet and angel pages, the angels' pointed names among them. No route of theirs loaded the `@font-face`, so they got CLM only after a visit to the Lenain reader or a ritual in the same tab (the live site's angel page loads no CLM) |
| `src/app/doc/[_id]/DocRender.tsx` | Imported the stylesheet, but the `fontFamily` that would have used it has been commented out since it was added (May 2024): rituals' Hebrew has always been the system font, and the live site's `/doc/theoricus` loads no CLM |
| `editor-trial/src/style.css` | The editor trial's "Trial Hebrew" face, by file path |

## Decisions

### 1. One Hebrew text font, self-hosted, every weight

`scripts/hebrew-text-font/build.py` subsets the pinned variable font to its
Hebrew block (U+0590–05FF), keeping the weight axis and the layout features
that have anything for Hebrew (`ccmp`, `mark` and `kern`), as one WOFF2:
`public/fonts/FrankRuhlLibre-Hebrew.woff2`, 14,264 bytes for weights 300–900
(one CLM weight was 18.5 KB).
`public/fonts/FrankRuhlLibre.css` declares it as `Frank Ruhl Libre`,
`font-weight: 300 900`, `unicode-range: U+0590-05FF`;
`public/fonts/hebrew-text-font-sources.md` records the source, versions and
hash. No Google Fonts CDN.

The root layout imports the stylesheet, so every page that names the family
gets it, the entity pages included; the browser downloads the file only on a
page that draws Hebrew in it (a ritual page does not; a hall may, as its
stack's fallback while the hall's own subset loads). The CLM files and
their licence are deleted. The editor trial points at the new file.

**Obliques: none.** Frank Ruhl Libre has no italic and the stylesheet
declares none, so italic Hebrew is the browser's synthesised oblique
(`font-synthesis` allows it by default), where CLM drew its own obliques.

### 2. Lenain's upper dot, added to the font

Frank Ruhl Libre has no U+05C4 (HEBREW MARK UPPER DOT) and no cantillation
marks. The repository uses U+05C4 195 times in the Lenain edition (all in
chapter 6, the 72 genii) and 195 times in the 72 angels' pointed names,
always on א, י or ל (sometimes after a dagesh); and U+0592 (accent segol)
once in Lenain (in the reader's data, and again in its Markdown download).
The built-in rituals' Hebrew needs nothing the font lacks. Ritual drafts in
the database were not scanned.

The options, shown side by side at real sizes on 11 November: keep CLM for
those pages; Frank Ruhl Libre with another font filling in the dotted
letters (whole letters switch face mid-word); **Frank Ruhl Libre with an
upper dot added in the build**; or Noto Serif Hebrew for pointed text.

Gadi chose the third. The build adds a glyph for U+05C4, a copy of the
font's own holam dot, attached by a new mark class centred over each letter
— across from the letter's below-vowel anchor (the designer's centre for its
points) at the height of its holam anchor, both varying with weight like the
font's own anchors. The final forms, which never carry the dot here, take
their ink centre at holam's height. Text tagged Hebrew (`lang="he"`, as the
reader and the entity pages are) selects the font's `IWR ` language system,
whose `ccmp` composes a letter and its points into one glyph (lamed with
dagesh, shin with its dot, alef with qamats...); each of those takes its
letter's anchor. That matters: 21 of the 65 dotted letters in each text are
lamed with dagesh. The script checks with HarfBuzz that the dot lands where
it does on the bare letter, for each letter and composed form the texts dot,
at weights 300, 400, 700 and 900, with and without the language tag. OFL
allows the modified font, and with no Reserved Font Name it keeps its name.
U+0592 falls to the next font in the reader's stack (FrankRuehl CLM had
it).

### 3. The halls' Hebrew in Frank Ruhl Libre Bold

`scripts/gd-hall-fonts/build.py` makes a static Bold (700) instance of the
pinned font and subsets it to U+05D0–05EA, as it did Noto Serif Hebrew
Bold: `public/fonts/FrankRuhlLibre-Bold-letters.woff2` (3,424 bytes) and
its TrueType twin for resvg, `assets/fonts/FrankRuhlLibre-Bold-letters.ttf`
(7,812 bytes), with `fontMetrics.json`'s Hebrew table and the upstream
`FrankRuhlLibre-OFL.txt`. The family is the hall's own, `GdHall Frank Ruhl
Libre`, falling back to `Frank Ruhl Libre`. It draws all the hall's Hebrew:
the letter banners, the Tarot keys' letters and the Pantacle's ring. The
Noto Serif Hebrew subset, its twin and its OFL notice are deleted; nothing
else used them. `public/fonts/Noto-hall-sources.md` becomes
`hall-font-sources.md`.

The rebuild ran with the toolchain the sources file records (fontTools
4.66.1, Brotli 1.2.0, uharfbuzz 0.56.2) and left both Noto Serif subsets and
their twins byte for byte as they were.

Sizes stay as they were (banner 62, Tarot key 36, ring 6.4). Frank Ruhl
Libre's letter body is 597 units against Noto Serif Hebrew's 647, so the
letters are about 8% smaller; a banner size of 67 would restore the old
height if wanted. The banner's baseline still comes from the measured body
(shin's), so the body stays centred on the pennant's middle (baseline
19.507; body −17.51 to 19.51, centred on 1). Every outline point of the 22
letters lies inside the pennant: the closest is lamed's ascender, 7.9 units
below the pennant's top, where Noto Serif Hebrew's qof came within 5.0 of
its point.

### 4. The hall images' identity moves

`GD_HALL_IMAGE_PROFILE` goes from `magickli-gd-hall-image-v1` to `-v2`, and
the identity's font list carries the new TrueType's hash, so every hall
image's identity moves. The bytes (and ETags) of the 13 halls that draw
Hebrew move, and their pins in `gdHallImage.test.tsx` with them; Neophyte
draws none, and its source, SVG and PNGs are byte for byte the same.
Published rituals keep their stored bytes, as always.

### 5. Plan 061, decision 7, corrected

Plan 061 gains a dated correction: FrankRuehl CLM is plain GPL-2, and the
halls' Hebrew is now Frank Ruhl Libre Bold.

### Not in scope

- Rituals' Hebrew: still the system font, as it always has been; setting it
  in Frank Ruhl Libre is the commented line in `DocRender.tsx`.
- `/about#credits` lists no fonts (nor does the hall images' licence
  metadata), so neither gains one.
- Help screenshots: none shows Hebrew (the Neophyte hall has no letter
  banners), so none is recaptured.

## Stages

1. This plan.
2. The halls' Hebrew in Frank Ruhl Libre Bold (decisions 3–5).
3. The Hebrew text font, and CLM removed (decisions 1–2).

## Verification

- Halls: snapshot diffs touch only Hebrew `<text>`; the measured fit above;
  server PNGs of five halls before and after; `/gd/halls/zelator-1`'s SVG
  and PNG on a dev server match the new pins; the editor's PNG export
  (fonts inlined as `data:` URIs) draws Frank Ruhl Libre in a Chromium
  that has no such font installed, and its SVG export names the hall family
  without embedding a font, as before (plan 061, decision 8).
- Offline: `gdHallBundle.test.ts`; the production build's service worker
  precaches the new files and none of CLM's.
- Text: the Lenain reader (chapter 6), an angel page (Lelahel) and the
  Theoricus ritual, before (live site) and after (dev server).
- Text: every dotted cluster in the data shapes with the dot where it sits
  on the bare letter, with and without `lang="he"`; undotted text shapes as
  it did before the dot was added. The reader and Lelahel were shot again
  after the fix below.
- Safari: not checked (no device).

## Review

A Fable review of the branch (11 November) found the upper dot fell on
lamed's ascender wherever the letter carries a dagesh and the text is
tagged Hebrew: `ccmp` composes those into one glyph, which the first
build gave no anchor, and its check shaped untagged text. Fixed in
`24ec0a40`; a second look at that commit found nothing more. Its smaller
findings (features list, U+0592 count, the OFL notice's footer, the
trial's weight range) were fixed with it.

## Follow-ups

- `public/fonts/FrankRuhlLibre-Hebrew.woff2` is precached twice: the root
  layout's import bundles it into `_next/static/media`, and the
  service worker also precaches all of `public/` (14 KB; CLM did the
  same). Moving the stylesheet and font out of `public/` would end it.
- One angel name has a doubled dagesh (`05DC 05BC 05BC 05C4`), in
  `packages/magick-data/src/kabbalah/seventyTwoAngels.json5` and Lenain's
  `apparatus.json5`; probably a data slip, to check against the scan.

## Commits

| Commit | What |
| --- | --- |
| `f59e33f4` | This plan |
| `21800693` | The halls' Hebrew in Frank Ruhl Libre Bold (decisions 3–5) |
| `bb372996` | The Hebrew text font with the added upper dot; CLM removed (decisions 1–2) |
| `24ec0a40` | The upper dot on composed letters; the review's smaller fixes |

Each was gated in a clean worktree (Node 24.21.0, CI's placeholder
environment): install, `loom init` clean, `loom check` and `--production`,
`pnpm check`, typecheck, coverage and build; for the last two also the
data package's smoke test, the Turbopack check and the built service
worker's precache list (Frank Ruhl Libre in, CLM out). All passed (8,042
tests). `21800693`'s first coverage run had 8 timeouts in unrelated tests
(SQL import, the hall editor, the dictionary's interaction tests) at a
load average of 27; its rerun passed. On 11 November the branch was
rebased onto `main` with dark mode ([plan 076](076-dark-mode.md)) and every
code commit gated again (8,086 tests); `bb372996`'s first coverage run had
5 timeouts in the same kind of unrelated tests at a load average of 54, and
its rerun passed. The Lenain reader, Lelahel and the hall editor's banners
were checked in dark as well as light: the text takes dark mode's colours,
and the halls keep their light plate, as plan 076 has them.
