# Golden Dawn hall diagrams (`gdHall`) — 17 October 2026

Status: design settled with Gadi on 17 October 2026; adversarially reviewed
twice (Fable) and spiked the same day. Stage A started on `gate/gd-hall`;
A1 (model, validator, layout, labels, fonts, renderer, original art) is in.

Composable Golden Dawn temple-hall diagrams, authored in the ritual Pug
dialect, drawn as inline SVG in the reader and editor, edited visually, and
exported as SVG/PNG. They replace the hand-drawn Inkscape files
`public/pics/{neophyte,zelator1,zelator2,theoricus1,theoricus2}.svg`, and add
the grades those files never covered. Every piece of artwork shipped must
eventually be original.

## Background

Research on 17 October 2026 (agents' reports checked against the code):

- **The drawings.** Five Inkscape files (one flat layer each, unlabelled
  groups, shapes pasted between files): a 16 × 16 checker floor of 6.6182 mm
  squares, East at the top, North on the left; dais 4 squares deep
  (Neophyte) or 5 (Zelator, Theoricus); floor lamens 1.66 squares across,
  dais lamens 2.31, altar and pillars 2 × 2; the Zelator files carry about 2.4
  squares of extra margin on the North for the Earth tablet. Differences
  between the drawings are treated as drift, not intent, unless Gadi says
  otherwise. The Zelator drawings (July 2024) draw the dais lamens grey with a
  black Hierophant; Neophyte (late July 2024) and Theoricus (March 2025) use
  the colour lamens, which came later. The book draws the Chiefs grey and the
  Hierophant black in every grade, Neophyte included, so grey is a drawing
  style, not "inactive officers" (an earlier reading of ours). Colour lamens
  are canonical.
- **The book.** The diagrams in Regardie's *The Golden Dawn* use the same
  floor and orientation for every Outer grade and the Portal. Our five
  drawings follow them closely (differences under Presets). The book also
  covers Practicus 1–3, Philosophus 1–4 and the Portal 1–2. Adeptus Minor uses
  the Vault, which is not a checker hall. Nothing from the book is stored in
  the repository; presets record layouts (which object stands where), drawn
  with our own art.
- **Existing components** (assumed latest; never recreated from the SVGs):
  `Lamen` (`src/app/gd/components/lamen.tsx`) draws dais and floor lamens —
  the drawings' lamens are copies of it; `Tablet` and its sigils
  (`src/components/enochian/Tablet.tsx`; earth and air data only);
  `TableOfShewbread` and `SevenBranchedCandleStick` (symbolic diagrams);
  `TreeOfLife`. Nothing exists for the altar, items, pillars, banners,
  thrones, dais or floor.
- **Ritual editor.** Saved source is semantic JSON (`src/doc/semantic.ts`),
  Pug is an editing view (`src/doc/ritualPug.ts`), the visual editor is Tiptap
  (`src/doc/tiptapRitual.ts`), and the reader renders the compiled
  json-rich-text tree (`src/doc/blocks.jsx`). `semantic.ts`,
  `semanticCompilerImpl.ts` and `ritualNodeIds.ts` are hashed into the
  compiler identity (`src/doc/semanticCompile.ts:6-14`). Revisions are kept
  but have no history UI; offline means reading published bundles. A generic
  document model (plan 058) is a proposal only.
- **Export.** `src/export/ExportControls.tsx` exports a live `<svg>` as
  SVG/PNG (download, copy, image link). Fonts loaded by URL and `<image href>`
  do not survive the PNG rasterisation.

## Decisions

### 1. One hall model, two hosts

- **`src/components/gd/hall/`** (MIT, under `@magick-components`; no app
  imports, no `next/*`, no MUI): the hall node types, a validator that returns
  diagnostics, the layout resolver (frames, anchors, scales, label wrapping,
  bounds), the SVG renderer `<GdHall hall={tree} art={registry} />`, the
  original art with provenance, and the presets as data.
- **The art registry is injected.** The MIT package ships only original art
  and an "unknown component" placeholder; the app composes in the art it may
  not put under MIT (the legacy drawings' items, and `Lamen` until its
  caduceus and Eye of Horus are replaced) for the reader block, the editor
  and `/gd/hall`. Preset snapshot tests run with the composed registry.
- **Input shape.** `GdHall` takes the compiled json-rich-text row shape
  (`{type, …attrs, children}`), which is what the reader holds; numbers may
  arrive as numeric strings from the legacy `prepare.js` path. The editor
  converts its semantic subtree (`semanticToJrt` on the subtree) before
  drawing. A test renders the Neophyte hall from `prepare()` output and from
  `semanticToJrt()` output and expects identical SVG.
- **Bundle.** The reader block loads the renderer lazily (a placeholder sized
  from the hall's bounds while it loads), so rituals without a hall do not
  carry it; the chunk is still precached for offline. `readerBoundary.test.ts`
  learns to follow `import()` calls and the `@magick-components/*` alias, and
  a new test forbids `@/`, `next/`, `@mui/`, `@tiptap` and `prosemirror`
  imports anywhere under `src/components`.
- **The app (AGPL)** owns Pug integration, the reader block, the Tiptap block
  and visual sub-editor, the `/gd/hall` page and export controls.
- **`/gd/hall`** is a playground: source, visual and split views, a preset
  picker, a draft in localStorage, a share link and export. The share link
  carries the source without IDs in the URL fragment (never the query string,
  so user text stays out of server logs), with a stated maximum length. A note on the page says drafts stay in
  this browser and that saving with history means putting the hall in a
  ritual — embedded, or as a ritual whose only content is a `gdHall`. No new
  tables. At the end of the project we revisit whether the page is still
  wanted and how it relates to the ritual editor.

### 2. The compiler accepts a `gdHall` subtree by shape

One reviewed compiler-identity change, shipped together with the reader block
and the editor block:

- `validateRitualSemantic`: a `gdHall` element whose descendants are elements
  or annotations (no text) with identifier tags and JSON-scalar attributes,
  within the existing node and depth bounds. Tag and attribute names match
  `/^[A-Za-z][A-Za-z0-9]*$/`, so the printer can always write them back.
  Attributes named `type`, `children` or `id` are rejected anywhere in the
  subtree: the compiled tree stores the tag in `type` and spreads attributes
  over it (`semantic.ts:298-304`), so `item(type="cup")` would become a `cup`
  node, and the Pug parser takes `id` as the node identity
  (`ritualPug.ts:517-518`).
- `semanticFromJrt`: a `gdHall` subtree imports as elements instead of opaque
  legacy nodes (`semantic.ts:134-140`). Without this a built-in doc's hall
  still opens and still draws, but as a preserved "unsupported legacy
  content" block that cannot be edited.
- Reserved hall tags, which the reader or the offline inventory treat
  specially: `text` (it would compile to a json-rich-text text node), `title`,
  `grade`, `footnote`, `footnotes`, `task`, `span`, and `img` until it is
  designed. Reserved attribute names: `type`, `children`, `id`, `style` and
  the inventory's resource names (decision 5).
- Inside a hall in a built-in `.pug` doc, a `//-` comment compiles through
  `prepare.js` to `{}`; the hall importer skips such rows (the comment is
  already gone from the compiled tree) rather than throwing.
- Legacy imports keep numeric strings (`x="9.4"`) so the built-in docs'
  exact parity test holds; the layout resolver coerces them (decision 12).
- `semanticToJrt` needs no change beyond what the shape rule guarantees.
- Re-pin the hash and the parity tests. The spike's patch touched only
  `semantic.ts` (and `tiptapRitual.ts`, which is not hashed): one hash
  changed, and all 2,049 other tests in `src/doc`, `src/offline` and
  `src/app/doc` passed.
- Attribute errors report a line but no column ("Line 5: invalid hall
  attributes"), as attribute errors do today; text and tag errors carry both.

What the tags mean is checked by the hall validator, outside the hashed files,
and shown as editor diagnostics. The renderer draws an "unknown component"
placeholder for a tag it does not know. Adding hall components later never
changes the compiler identity. Hall tags such as `label` or `img` are scoped
to the subtree and never collide with ritual tags.

**Reverting.** Once a ritual with a `gdHall` is saved, its revisions are valid
only under the new validator, so the change cannot be rolled back without
breaking them: fix forward. Validator, converter, reader block and editor block
therefore land as the final commit of one stage.

**Picking up component changes.** The compiled tree holds the hall's nodes,
not a drawing, and the reader draws it with the current components. An
improved Shewbread or lamen therefore appears in every ritual on the next
deploy, without resaving or republishing; offline readers see it when their
service worker updates the app. The flip side: a component's nominal box,
anchor and default scale are a layout contract, because changing them moves
things in saved halls. Changes to them need a deliberate decision, and preset
render snapshots catch accidental ones.

### 3. Source dialect

Valid Pug with JSON-literal attributes in parentheses (`0.5`, not `.5`;
double-quoted strings). The printer adds node IDs (`altar#Ab3kXyz…(…)`),
folded in the editor. The hall model treats IDs as optional; the app assigns
them on write-back.

```pug
gdHall(dais=4, wall="gradient")
  dais
    officer(role="imperator")
    officer(role="cancellarius")
    officer(role="hierophant")
    officer(role="pastHierophant")
    officer(role="praemonstrator")
  floor
    banner(kind="east", x=9.4, y=0)
    pillar(kind="black", x=4, y=3)
    officer(role="hegemon", x=8, y=3, labelPos="top")
    pillar(kind="white", x=12, y=3)
    altar(at="centre")
      item(kind="cross", y=-0.4)
      item(kind="triangle", y=0.3)
      item(kind="rose", at="east")
      item(kind="salt", at="north", y=-0.3)
      item(kind="bread", at="north", y=0.35)
      item(kind="lamp", at="south")
      item(kind="cup", at="west")
    officer(role="stolistes", x=1, y=8, labelPos="bottom")
    officer(role="dadouchos", x=15, y=8, labelPos="bottom")
    platform(x=8, y=14.5, w=4, h=3)
      officer(role="hiereus", labelPos="top")
    banner(kind="west", x=4.8, y=14.3)
    officer(role="keryx", x=14, y=15, labelPos="top")
    door(x=14, width=2)
    officer(role="sentinel", x=14, y=17.2, labelPos="bottom")
  caption(text="Neophyte Temple")
```

### 4. Frames, units and anchors

- **One unit: the checker square.**
- **The floor frame** has its origin at the North-East corner of the floor
  (top left). x runs North → South, 0–16; y runs East → West, 0–16. The dais
  is the band y ∈ [−dais, 0]; banner rows lie beyond it. Values outside 0–16
  place things outside the walls.
- **`dais` and `banners`** are rows in the floor frame, not frames of their
  own: children without x are spread evenly, children with x keep it.
  `banners(side="east")` is the default; `north`, `south` and `west` rows
  stand outside those walls.
- **Hosts** (`altar`, `platform`, `throne`, `board`) give their children a
  frame whose origin is the host's centre, in the host's unscaled squares. The
  children scale and move with the host.
- **`at`** works in every frame: `centre`, `north`, `south`, `east`, `west`
  and the four corners name a point on the parent's box (on the floor, the
  floor's centre and walls). With `at`, x and y are offsets from that point.
- **Anchor**: an object's centre by default; `anchor` overrides it.
- **Scale**: `scale=1` fits the object into a 2 × 2-square box, aspect kept.
  Each kind has a default scale from the drawings (floor lamen 0.83, dais
  lamen 1.15, altar and pillar 1). A hall-level `sizes="drawing" | "uniform"`
  renders the same hall with drawing scales or one common size, so the two can
  be compared side by side; we keep one afterwards.
- **Bounds and margins** come from content: the viewBox is the union of every
  resolved object and label plus `padding` (default half a square), so an
  Earth tablet outside the North wall widens the North margin by itself.
  `margin*` attributes override.
- **The visual editor** writes positions rounded to two decimals, snapped to
  half squares unless Alt is held, and prints leaves in one form.
- **Hall-level defaults** (`labelSize`, `officerScale`, later a palette) are
  how a hall overrides styling without copying values into every node.

Rejected: fractions 0–1 of the container (sixteenths such as 0.1875, units
that differ between x and y in a non-square parent, sizes still in squares)
and a centre origin for the floor (negative numbers for half the hall, unlike
counting squares).

### 5. Vocabulary

Structure: `gdHall`, `dais`, `banners`, `floor`, `caption` (the title),
`door`. Hall attributes: `dais` (depth in squares), `wall`
(`plain` | `gradient`), `compass` (East/West/North/South labels, on by
default; the side labels are rotated as in the drawings), `sizes`, `padding`,
`labelSize`.

Placeables:

| Tag | Notes |
| --- | --- |
| `officer(role)` | `lamen` + `label`. Roles use the ritual role keys (`src/doc/ritualBlocks/roles.tsx`): imperator, cancellarius, praemonstrator, hierophant, pastHierophant, hiereus, hegemon, keryx, stolistes, dadouchos, sentinel; adepts (chiefAdept, secondAdept, thirdAdept) as labelled circles until their lamens exist. Colour lamens only (see Background) |
| `lamen(role)` | The lamen alone |
| `marker(text, shape)` | A labelled box or circle, as the book uses for objects (Lamp, Pantacle) and for the candidate. Every grade can be preset before its art exists |
| `altar`, `platform`, `throne` | Hosts. The altar is the black cube; what lies on it is items |
| `pillar(kind)` | `black` (downward triangle) or `white` (upward); `glow` for the Neophyte style. No rotation |
| `banner(kind)` | `east` or `west` |
| `hebrewLetter(letter)` | A Hebrew-letter banner, in a row or anywhere |
| `tablet(element)` | Reuses `Tablet`; earth and air now, water, fire and union once the data exists |
| `item(kind)` | Art registry: cup, chalice, salt, bread, rose, lamp, lantern, censer, fan, cross (`form`: calvary, latin, greek, greekFiveSquares, fourTriangles), triangle (`dir`: up, down), pentagram, pantacle, serpentTree, lightning, gong, brazier |
| `tarotKey(n)` | An original simplified card: numeral, Hebrew letter and title from magick-data |
| `kamea(planet)`, `seal(planet)` | The number square drawn from its numbers; seals redrawn |
| `board(kind)` | A diagram on a stand: flamingSword and minutumMundum via `TreeOfLife`; gardenOfEden and theFall as labelled boards first |
| `shewbread`, `candlestick` | The existing components |
| `veil` | The Portal's curtain across the dais |
| `label` | Free or attached text |
| `img` | Later; goes through the ritual image policy and the offline asset inventory |

Altar "tops" are not an altar attribute: the cross and triangle on a Neophyte
or Zelator altar, the sulphur symbol of 4=7 (triangle above a cross), the
water triangle of 3=8 and the Portal's crosses are items placed on the altar,
composed with `at` and offsets. Primitive symbols (cross, triangle) are drawn
from geometry, so they are original by construction.

Attribute names avoid `type`, `children` and `id` (reserved, see decision 2)
and all of the offline inventory's resource names (`src`, `srcSet`,
`srcset`, `href`, `xlinkHref`, `poster`, `data`, `background`,
`dangerouslySetInnerHTML`; `ritualAssetInventory.ts:81-91`): any of them on a
hall node would stop publication. The hall validator rejects them, and a test
runs the inventory over every preset and expects a complete enumeration with
no issues. No hall tag is called `title`, which the inventory treats
specially.

Data still to add: tarot card titles (magick-data has path-to-key numbers and
Hebrew letters, not titles), kamea squares (computed), seals (drawn), and the
adept roles (`chiefAdept`, `secondAdept`, `thirdAdept`) in the ritual role
catalog, so hall roles and ritual roles stay one set.

### 6. Labels

`officer` labels by default; any placeable takes `label="…"` and `labelPos`
(`top`, `bottom`, `left`, `right`), and a `label` child gives full control
(`text`, `pos`, `width`, `size`). The label box is as wide as the object
unless `width` says otherwise. Text wraps at spaces ("Past / Hierophant"); a
single word wider than the box stays on one line, centred, and overflows, as
"Praemonstrator" does today. Lines grow away from the object.

Line breaking uses a generated table of the label font's advances and kern
pairs (GPOS), not browser measurement, so server, browser and export agree.
The spike measured it against Chromium: advances plus kerning match to
0.0092 %, plain advances without kerning are off by up to 0.73 %, and the 359
ASCII kern pairs fit in about 4 KB of JSON. Labels set
`font-variant-ligatures: none` (the font has fi, fl and ffi ligatures). Text
is laid out at a large font size inside a scaled group, never at a sub-unit
size with `text-rendering="geometricPrecision"`, which Chromium lays out on a
1/64 px grid (widths 1.9 % off, bounding boxes up to 152 % off). Wrapping
uses advances, not `getBBox`, which includes the italic overhang.

At the default sizes, "Past Hierophant", "Neophyte Temple" and "Banner of the
West" wrap; "Hierophant" fits a dais lamen with 0.016 square to spare;
"Cancellarius" and "Praemonstrator" overflow on the dais, and "Stolistes",
"Hegemon" and "Dadouchos" slightly overflow a floor lamen.

### 7. Fonts

- Labels, title: Noto Serif Italic; compass labels: Noto Serif Bold Italic.
- Hebrew banners: Noto Serif Hebrew (OFL). Not FrankRuehl: its GPL licence
  with a document-embedding exception does not allow copying its outlines
  into MIT code.
- Fonts live in `public/fonts` (precached for offline) with their OFL
  notices; add the notices missing for the existing `NotoSans-Regular.ttf`
  and `NotoSansHebrew-Regular.ttf` at the same time.
- google/fonts ships these families only as variable fonts. A script
  (fontTools: `pyftsubset` and the instancer) makes static instances and
  subsets — Latin-1 for labels, the 22 letters for Hebrew — and the kern
  table; its outputs are committed with their sources and hashes recorded,
  like `assets/fonts/README.md` does today. Sizes as WOFF2: Latin-1 italic
  16 KB, Hebrew letters 4 KB, compass bold italic under 3 KB.
- Enochian Plain: no licence text exists; font archives call it freeware,
  non-commercial (`assets/fonts/EnochianPlain-NOTICE.txt`, plan 027).
  `Tablet` keeps referring to the font rather than copying outlines. Original
  Enochian letterforms are a follow-up.

### 8. Export

`/gd/hall` uses `ExportControls`. For PNG, `ExportControls` gains a
`prepare(clone)` hook that embeds the fonts a drawing uses as data-URI
`@font-face` rules; the Tree of Life exports need the same, so it is shared
work. The hook runs only on the PNG path, where only rasterised glyphs leave
the page; an SVG file only ever embeds OFL fonts, never Enochian Plain. It
embeds the pre-built WOFF2 subsets (about 20 KB in all, against 1.5 MB for
the full fonts), so no subsetter runs in the browser. The spike rasterised a
hall-like SVG this way in Chromium: the subset and full fonts render alike,
and the image's load waited for the data-URI fonts. Firefox and Safari are
untested; Safari has no test device, so it ships on the platform rules with
the check stated as outstanding.

In the reader and offline, the hall block declares its `@font-face` rules
for the Noto Serif faces (woff2 subsets in `public/fonts`, precached). The
`Tablet` font comes from `next/font/local` today
(`src/components/enochian/enochianFont.ts`, a `next/*` import already inside
the MIT directory); the hall passes the Enochian font in through `Tablet`'s
`enochianStyle` prop from the app, and moving `enochianFont.ts` out of
`src/components` is a follow-up. Hall art contains no rasters and no external references. Exporting from
the reader is a later stage.

### 9. Artwork and provenance

- Every art module exports `provenance` (`origin`: original or thirdParty,
  author, licence, source, notes). A test checks third-party entries against
  an explicit list that must reach zero before the project is finished; the
  generated table is the artwork report, also reflected on `/about#credits`.
- Art lifted from the drawings (cup, chalice, salt, bread, rose, lamp and
  lantern, censer, fan) lives under `src/app/gd/hall/legacyArt/`, not the MIT
  directory, and reaches the renderer through the injected registry
  (decision 1) until it is redrawn. MIT `src/components/gd/hall` receives only
  original art.
- `Lamen` gains the Past Hierophant (striped ring, from the Neophyte drawing)
  and safe lookups where it is, in `src/app/gd/components`, and is injected the
  same way. It moves to `src/components/gd/Lamen.tsx` (MIT) in stage H, once
  its caduceus (SVG Repo; "public domain" is the site's label, not the
  author's own licence text) and Eye of Horus (game-icons.net, CC BY) are
  replaced: Gadi wrote the file, but not those two paths, and CC BY
  attribution must travel with the file.
- Replacements are original flat drawings in the lamens' style: black
  outline, limited palette, hand-authored SVG paths.

### 10. Ritual integration

- Reader: `gdHall` in `blocks.jsx` draws `<GdHall>`; the reader stays free of
  editor code and of `ExportControls`. The legacy `prepare.js` path turns
  numbers into strings, so the validator coerces numeric strings.
- Offline: hall art is code, so bundles need nothing new.
- Editor: `gdHall` joins `blockAtoms` (`tiptapRitual.ts:24`) so the text
  editor treats it as one block; its node view draws the hall and hosts the
  visual sub-editor. Without this the hall would open as nested editable
  blocks.
- `/hall` slash command inserts a preset, copied into the source. The static
  node view of stage B labels the block "Temple hall" (today's `label()`
  would print the bare tag).
- No ritual text is embedded for chat today (only PDFs are ingested), and the
  corpus export dumps whole rows, so nothing needs skipping. If rituals are
  ever embedded, `gdHall` subtrees are skipped so labels are not read as
  prose.

### 11. Visual sub-editor

Click (or Tab) to select, which opens a properties panel; drag to move with
half-square snapping; corner handles to scale; arrow keys to nudge (Shift for
a whole square); a palette to add components; delete and duplicate. Each
gesture is one `setNodeMarkup` on the block: one undo step, IDs kept, new
nodes given fresh IDs. Touch: tap to select, drag to move, the panel for the
rest (plan 050's rule on small handles). Reparenting converts positions
between frames.

### 12. Validation and safety

Ritual content is untrusted. The hall validator reports out-of-range or
malformed values as diagnostics (`NaN`, `Infinity`, `"abc"` and `"1e999"`
are invalid, not clamped); the layout resolver clamps coordinates, scales
and rotation to sane ranges and coerces numeric strings. Registries are
looked up with `Map`/`Object.hasOwn` (`lamen.tsx` indexes plain objects by
officer today, so `"constructor"` yields a function). Attribute strings only
ever reach text nodes. Gradient and pattern IDs come from `useId`, so several
halls on one page do not collide. The visual editor's first write-back
normalises numeric strings to numbers, and treats `children: []` and an
absent `children` alike.

The SVG has `role="img"` and a `<title>` taken from the caption.

### 13. Theme

Light only, white background. Colours go through a palette object so a dark
palette can follow.

## Public and private halls

The presets, tests, fixtures, screenshots and this plan come only from the
public drawings in `public/pics` (used by the built-in rituals) and from the
book's published layouts. Gadi's private temple drawings, used for private
rituals, never enter the repository in any form. At the end of the project
(stage J) their hall sources are written outside the repository and handed to
Gadi, who saves them in the private rituals himself. They follow the public
versions closely with a few deliberate changes; other differences are treated
as drift and checked with him. Any vocabulary they need is added in a general
form, never named after a private setup.

## Presets

Copied into the source on insertion; styling defaults inherited (decision 4).

| Preset | Source | Notes |
| --- | --- | --- |
| `neophyte` | drawing, checked against the book | Banner of the West follows the book (floor, north of the platform) |
| `zelator1`, `zelator2` | drawings | Earth tablet position: see conflicts |
| `theoricus1`, `theoricus2` | drawings | Hexagram badge renamed `pantacle` |
| `practicus1`–`practicus3` | book layouts | markers where art is missing |
| `philosophus1`–`philosophus4` | book layouts | conflicts below |
| `portal1`, `portal2` | book layouts | diagrams appear swapped against the text |

### Where the sources disagree

Three sources: the ritual text, the diagrams in the edition Gadi has (the
John Michael Greer edition, whose diagrams are clean redraws with lamens and
checker floors), and the hand-lettered diagrams of Regardie's first edition
(Aries Press, Chicago, vol. 2, 1938; scans on archive.org, checked on
17 October 2026). The 1986 Llewellyn fifth edition reprints the 1938 drawings
photographically. A search for errata or commentary (Farrell, Zalewski, the
Ciceros, Greer, Order sites) found none on these floor plans; Llewellyn's
blurbs for the 6th and 7th editions mention corrected errors without detail,
and the 7th edition scan on archive.org is access-restricted. Most conflicts
therefore go back to Regardie's own 1938 edition, and two disappear once the
1938 drawings are read. On 17 October 2026 Gadi accepted every recommendation
below; the presets follow them.

| # | Setup | Finding | Status | Recommendation |
| --- | --- | --- | --- | --- |
| 1 | Portal 1 and 2 | 1938 p.155 (leaf n148) heads part 1 with the pentagram hanging over a Greek cross, Hegemon West of the altar, Pan, Devil, Death and Typhon; p.175 (n168) heads part 2 with the cross of four triangles and Hegemon East. Each part's own text describes the other drawing (part 1 rubric p.156–157: Adepts NE and SE, Hegemon East; part 2 rubric p.175: pentagram, Greek cross of five squares, Hegemon West). The swap is in the first edition | Documented, original to 1938; which way the Order meant it is unsettled | Follow the text: swap the drawings |
| 2 | Philosophus 1 (29th path) | 1938 p.121 (n115) draws Shin, Tau and Qoph across the East band from its North end to its South end; the rubric (p.122) puts Qoph behind Hegemon in the South-East. The band's South end is the South-East | **Not a conflict** | Model the letters at NE, E and SE, as one row whose ends are the corners |
| 3 | Philosophus 2 (28th path) | 1938 p.131 (n125): Resh NE, Samekh E, Tzaddi SE, as the rubric on the same page says. No Tau below the West in 1938 or 1986; the Greer redraw (PDF p.304) adds one, probably carried over from the Theoricus 2=9 Yesod diagram (1938 p.82, n76), which does have it | **Settled**: no conflict for Resh/Samekh/Tzaddi; the West Tau is a later redraw's addition | NE/E/SE letters; no West Tau. The 1938 drawing also shows the Hierophant before the dais in the NE with the Banner of the East, the pillars in front of Hegemon in the SE, and a candle on each side of the altar, which the redraw omits |
| 4 | Philosophus 3 (27th path) | 1938 p.137 (n131) draws Hiereus (with the Banner of the West), Hierophant and Hegemon (with the Banner of the East) in a row at the East edge, each with a cup; pillars North–South near the South wall facing Peh. The rubric on the same page: Hierophant on his throne on the dais, Hiereus with banner seated before the dais NE, Hegemon SE, red lamps. The cups look carried over from the 29th and 28th path drawings | Documented in 1938; unsettled | Follow the text (Hierophant on the dais, red lamps); keep the drawing's pillars, which the text supports |
| 5 | Philosophus 4 (4=7) | 1938 p.144–145 (n138–139): the rubric twice puts the pillars North and South of the altar with Hiereus and Hegemon beside them; the drawing on the same page puts the pillars West of the altar | Documented in 1938; unsettled, text explicit twice | Follow the text |
| 6 | Portal Adepts | Explained by #1: the floor stations belong to the part 1 drawing (3rd Adept NE, 2nd Adept SE); the part 2 rubric seats them on the dais | Resolved by #1 | As #1 |
| 7 | Zelator Earth tablet | 1938 p.44 (n38) draws it with its outer edge on the North wall line, inside the hall, lamp and salt before it; no source says whether it hangs or stands | Partly settled | On the wall line, inside (the book), not outside (our drawing) |
| 8 | Zelator altar | 1938 drawing: the Flaming Sword diagram on the altar, the red lamp at its East end, the cross in the triangle at the base of the Tree. The explicit "For the Altar" requirements line appears only from 1986, an editorial addition consistent with 1938 | Settled | Add the Flaming Sword board and the red lamp to Zelator 1 |
| 9 | Neophyte Banner of the West | 1938 p.11 (n3) draws it free-standing on the floor, North-West of and slightly East of the Hiereus' throne; the Z documents give it a pole and base. No text gives a position | Settled as far as the sources go | On the floor, North-West of the throne (book) |

Also from 1938, with no errata found: Theoricus 32nd path (p.69, n63) writes
"Flaming Sword" West of the altar and has incense in the South-East corner;
Practicus 31st and 30th paths (p.92, p.106) put the pillars in the North-East
as the text says; Practicus 3=8 (p.112) has the misprint "Hiesophant" and
draws no Water tablet. Farrell's essay on how Regardie "saved and distorted"
the Golden Dawn (farrellnick.substack.com) concerns the lecture diagrams
shown to candidates, not floor plans.

Sequences within one part (the Garden of Eden moved to the South-West in 3=8,
the Tablet of Union and white lamp placed on the altar late in Portal 2) are
not presets; they belong with officer movement (Future).

## Artwork ledger

| Item | Today | Status |
| --- | --- | --- |
| Checker floor, walls, dais, door | drawings, first-party | regenerated in code |
| Lamens | `Lamen`, first-party | keep; caduceus and Eye of Horus to replace |
| Pillars, banners, Hebrew banners, pantacle | drawings, first-party | port into code |
| Enochian tablets and sigils | `Tablet`, first-party | reuse; font licence open |
| Cup, chalice, salt, bread, rose, lamp, lantern, censer, fan | drawings, icon-set signatures, no source | replace |
| Caduceus (Keryx lamen) | SVG Repo, "public domain" label | replace |
| Eye of Horus (Sentinel lamen) | game-icons.net, CC BY | replace |
| Tarot XXI on the Theoricus altar | RWS raster in the drawing | original card |
| Serpent on the Tree, Moon kamea, Moon seals | rasters in Theoricus 2, no source | redraw / generate |

Outside this project but found on the way: `2=9.pug:414` hotlinks a Pinterest
image; the 22 RWS tarot JPGs in `public/tarot/rws` are uncredited (public
domain 1909 edition; record the source).

## Old `/pics/*.svg` references

Kept until every reference is gone; this list is updated as they go.

| Where | Kind |
| --- | --- |
| `src/doc/0=0.pug:58`, `1=10.pug:61,480`, `2=9.pug:47,484` | built-in docs; switched in the last stage |
| `src/files/ritualPublicationStaticPaths.ts:11-17` | publication static paths |
| `src/offline/ritualPublicationTracing.test.ts:84-86` | asserts the files exist, via that list |
| `src/doc/ritualBlocks/renderForEditing.test.tsx:172,186` | test fixture |
| Production ritual "0=0 Grade of the Neophyte" and 13 revisions | from the 15 September Mongo dump; rituals are unchanged since, so the SQL rows match. Migrate by editing the ritual once presets reach parity |
| Published offline bundles, external links, search indexes, user exports | suspected; cannot be enumerated. Keep the files served |

## Stages

Each stage is a series of gated commits on `gate/gd-hall`.

| Stage | Content | Can be reverted alone |
| --- | --- | --- |
| A | `src/components/gd/hall`: model, validator, layout, renderer, chrome, labels and fonts; `Lamen` move and variants; legacy art under `src/app`; the five drawn presets; a read-only `/gd/hall` gallery with export and side-by-side comparison with the old SVGs; `sizes` comparison | yes |
| B | Spike results applied: compiler change (decision 2), Pug round trip, lazy reader block, `blockAtoms` entry with a static node view, boundary tests | until the first hall is saved |
| C | `/hall` slash command with presets | yes |
| D | Visual sub-editor | yes |
| E | `/gd/hall` source, visual and split playground with local draft and share link | yes |
| F | Remaining vocabulary and the presets for Practicus, Philosophus and Portal (markers where art is missing) | yes |
| G | magick-data: Water, Fire and Union tablets | yes |
| H | Original artwork; ledger to zero; `Lamen` moves to the MIT directory; credits | yes |
| I | Built-in docs switched to presets; reader export; end-of-project review of `/gd/hall`, scales and the conflicts table | yes |
| J | Private hall sources, written outside the repository for Gadi to save in his private rituals | — (nothing committed) |

Stretch: a dark palette, server rendering through `/api/render`.

## Spike (17 October 2026)

Run in a throwaway worktree, since removed; the patch, test, measurements and
PNGs are kept outside the repository.

| Question | Result |
| --- | --- |
| Pug round trip of the Neophyte hall with the shape rule | Exact: print → parse deep-equals, reprint is byte-identical, IDs and a comment inside the hall survive; bare `glow` prints as `glow=true` |
| Rejections | `type`/`children` attributes, text, unknown-shape tags and `.5` all rejected with line numbers |
| Compile and re-import | Compiles; re-import validates with no legacy nodes; IDs regenerate and comments drop, as for all JRT imports |
| Legacy `prepare.js` path | Numbers become strings, `null` becomes `"null"`; a comment inside the hall becomes `{}` and made the import throw (now skipped, decision 2) |
| Existing tests | Only the identity hash fails (one hash); 2,049 tests pass |
| Tiptap | One atom, visually editable; exact round trip through `getJSON` and the clipboard HTML; a pasted duplicate hall gets fresh nested IDs |
| Offline inventory | Recurses, complete, no issues; colliding names found and reserved (decision 2) |
| Label widths | Advances plus kerning match Chromium to 0.0092 % (decision 6) |
| PNG export with embedded fonts | Works in Chromium with 14 KB of WOFF2 subsets (decision 8) |

## Stage A1 notes

Settled while building A1, where the decisions above left a choice:

- Hebrew banners use Noto Serif Hebrew **Bold** (the drawings' letters are
  heavy). The compass subset holds only the letters of East, West, North
  and South (2 KB); the label italic is Latin-1 plus dashes, curly quotes
  and the ellipsis. The kern table is stored by kern class (340 class
  pairs for 2,234 character pairs, 11 KB of JSON).
- The default scales live in one table, `DEFAULT_SCALES` in
  `src/components/gd/hall/layout.ts`, measured on the drawings. Banners
  follow Neophyte (1.51 × 2.02 squares); the Zelator and Theoricus banners
  are half as large again, so their presets will either set `scale` or
  accept the drift. `sizes="uniform"` draws every officer at scale 1.
- `margin*` fixes that side of the view at a distance from the wall line;
  without it the side follows the content plus `padding`.
- The dais row centres its block, labels included, in the dais band;
  banner rows stand beyond the compass labels, and `banners(spread="ends")`
  puts the end banners on the corners (Philosophus 1).
- Doors take `x` on the East and West walls and `y` on the North and South.
- Item colours (`fill`, `stroke`) are named palette colours, never CSS.
- A `label` child of a placeable is attached to it; a `label` in the floor,
  a row or a host's frame is free text placed like any object.

## Commits

| Commit | Change |
| --- | --- |
| 4165f3c | Noto Serif and Noto Serif Hebrew subsets, their generator and kern table, OFL notices (also for the existing Noto Sans fonts) |
| ed0d464 | Hall model, vocabulary and validator |
| 946a743 | Layout resolver and label wrapping |
| e63ae08 | `GdHall` renderer, chrome and the package's original art |
| 8a7babd | Import-boundary test for `src/components` |

## Future

**Officer movement.** Rituals describe movement in prose ("Keryx approaches
the altar"). A later stage could record it: an officer moving from one
station to another, along a path (for example clockwise around the altar),
leading to animated playback, simulations and eventually augmented-reality
guidance. The positioning chosen here supports it: stations are positions in
the floor frame, and named stations ("Keryx's place", "Hiereus' throne") can
be added as a `name` attribute later without a compiler change, because hall
vocabulary lies outside the compiler identity. Hall roles use the ritual role
keys (the adept roles are added to the catalog in stage F), so a
`task(role="keryx")` and the Keryx on the floor already share a name. Nothing is built for this now.

**Vault.** Adeptus Minor's Vault is a different space; a `gdVault` could come
later.

## Follow-ups

Listed in `plans/000-current-status.md`:
officer movement; `gdVault`; original Enochian letterforms; moving
`enochianFont.ts` (`next/font/local`) out of `src/components`, and the other
files the import-boundary test still allows (`Link`, `Tiles`, `Mercury`,
`planetarySpirits`, `entity/index`), which `src/components/LICENSE.txt` should
list as the README says it does; export font
embedding for the Tree of Life; Firefox and Safari checks of PNG export with
embedded fonts; the RWS tarot credit and the Pinterest
hotlink in `2=9.pug`.
