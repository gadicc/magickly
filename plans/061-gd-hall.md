# Golden Dawn hall diagrams (`gdHall`) — 17 October 2026

Status: design settled with Gadi on 17 October 2026; adversarially reviewed
twice (Fable) and spiked the same day. Stage A is done on `gate/gd-hall`:
A1 (model, validator, layout, labels, fonts, renderer, original art), A2
(lamen, app art registry, legacy art, first-party art, the five presets)
and A3 (the Zelator Earth tablet per the book, PNG font embedding, the
read-only `/gd/hall` gallery), with the fixes from the final reviews of
stage A. Before stage B (17–18 October 2026) Gadi settled sizes (one
cell size, decision 4), the lamen rings (decision 9), the art and the
tarot titles (Decisions before stage B). Stage B is done on
`gate/gd-hall-b` (18 October 2026): rituals hold halls, drawn in the
reader and as one atom in the visual editor, after the compiler change
of decision 2 (Stage B notes). Stage C is done on `gate/gd-hall-c`
(18 October 2026): the `/hall` slash command and the toolbar insert
presets, the gallery copies a preset's Pug, and the Pug source editor
shows hall warnings (Stage C notes), with the fixes from its review,
among them text typed over a selected block without a keypress (Stage
C review fixes). Stage D is done on `gate/gd-hall-d` (18 October
2026): the visual hall editor, opened in place from a hall in the
ritual editor (Stage D notes). Stage E is done on `gate/gd-hall-e` (19
October 2026): `/gd/hall` is a hall editor with source, visual and split
views, presets, undo, a draft in the browser, share links and export,
and the visual editor reorders rows, stands objects on hosts and badges
a hall's warnings, as Gadi decided that day (Stage E notes), with the
fixes from its review: tabs no longer write over each other's drafts,
heavy halls are capped and typing is read at a rest (Stage E review
fixes). Stage F is done on `gate/gd-hall-f` (19 October 2026): kameas,
placeholder seals, boards with the Tree, the veil, the white altar and
the Practicus, Philosophus and Portal presets (Stage F notes). Two
follow-ups Gadi decided on 20 October 2026 are done on
`gate/gd-hall-f2`: the properties panel beside the drawing whenever it
fits (split `/gd/hall` at the full width) and docked at the foot of the
screen otherwise, and the kameas in magick-data with a shared `Kamea`
component the hall wraps (Follow-ups after stage F). Stage G is done
on `gate/gd-hall-g` (21 October 2026): the Water, Fire and Union tablets
(Stage G notes). The core of stage H is done on `gate/gd-hall-h` (23
October 2026), in the style Gadi chose that day: the nine items drawn
from the old drawings and the Keryx's and Sentinel's glyphs are original
flat emblems, lamps and lanterns take a `light` colour, `Lamen` is in
the MIT package and the third-party list is empty (Stage H notes); the
seals, the boards, the figure markers, the adepts' lamens and the
Minutum Mundum's colours wait for Gadi.

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
  dais lamens 2.31 (drift: decision 4), altar and pillars 2 × 2; the Zelator files carry about 2.4
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
  Since stage H all of the art is the package's, and the app composes
  only the tablets' Enochian font over it.
- **Input shape.** `GdHall` takes the compiled json-rich-text row shape
  (`{type, …attrs, children}`), which is what the reader holds; numbers may
  arrive as numeric strings from the legacy `prepare.js` path. The editor
  converts its semantic subtree (`semanticToJrt` on the subtree) before
  drawing. A test renders the Neophyte hall from `prepare()` output and from
  `semanticToJrt()` output and expects identical SVG.
- **Bundle.** The reader block loads the renderer lazily (a placeholder sized
  from the hall's bounds while it loads: an estimate from the hall's
  structure, since the resolver itself is too large to load up front;
  Stage B notes), so rituals without a hall do not
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
  `/^[A-Za-z][A-Za-z0-9]*$/`, and the names Pug reads as statements are
  reserved (below), so the printer can always write them back: an
  identifier alone is not enough, since a printed `each#…` or `if#…` line
  parses as a Pug statement.
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
  the inventory's resource names (decision 5). Every resource attribute
  name is reserved, so images inside halls (stages F and I) need an
  inventory change and a compiler-identity change, not only new hall
  vocabulary.
- Pug's keywords are reserved hall tags too: `if`, `else`, `unless`,
  `case`, `when`, `default`, `each`, `for`, `while`, `extends`, `extend`,
  `include` and `doctype` could not be printed back (the line parses as a
  statement, or as "template programs are unsupported"), nor any tag that
  begins with `doctype` (`doctypeX`, `doctypes`), since Pug's lexer
  reads a doctype from those letters whatever follows them; and `mixin`,
  `block`, `append`, `prepend`, `yield`, `filter`, `script` and `style`,
  which print back today but are statements when typed bare or mean
  something to Pug or HTML, with them. Reserving a name once halls use it
  would break their saved revisions, so the list errs on the side of more.
- **Where a hall may stand.** At the top level, or directly inside a
  `note`, `summary`, `li` or `todo`, which the reader and the visual
  editor both draw as blocks (`HALL_PARENT_TAGS` in `semantic.ts`).
  Anywhere else, inside `b`, `i`, `a`, a title, an option, a task, a list,
  a footnote or another hall, the validator reports "a temple hall cannot
  stand here" with its line and column, and a compiled hall row there
  imports as opaque legacy content. Before this rule a hall inside `b`
  made the visual editor throw (the top-level node went source-only), a
  title's text was replaced by the drawing, an option saved one that was
  never drawn, and a hall could hold a hall. A task is a block container
  too but is left out: allowing it, or any other parent, later is a
  compiler-identity change only, while tightening the rule after halls
  are saved would break their revisions.
- The hall root is keyed literally (`gdHall`), so a second diagram root,
  such as a `gdVault` for the Vault, is another compiler-identity change
  by design; decided (18 October 2026) to keep the literal root rather
  than a generic diagram tag.
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
- Stage B reserved more names than listed here, and keeps a hall that
  breaks the rule as opaque legacy content on import (Stage B notes).

What the tags mean is checked by the hall validator, outside the hashed files,
and shown as editor diagnostics. The renderer draws an "unknown component"
placeholder for a tag it does not know. Adding hall components later never
changes the compiler identity. Hall tags such as `label` or `img` are scoped
to the subtree and never collide with ritual tags.

**Reverting.** Once a ritual with a `gdHall` is saved, its revisions are valid
only under the new validator, so the change cannot be rolled back without
breaking them: fix forward. Validator, converter, reader block and editor block
therefore land as the final commit of one stage. The previous
`semanticModelSha256` (`041fa6dc…`) stays on every artifact compiled
before stage B: `compilerVersion` is written with each compiled artifact
(`sqlWrites.ts:388`) and nothing reads or compares it, so the bump
triggers no recompilation and invalidates no cache or offline bundle.

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
- **Scale and cells** (settled 17–18 October 2026): `scale=1` gives an
  object a cell of 2 × 2 squares. Its art fills the cell, aspect kept, or
  the share of it the art's `inset` says: officers' lamens, on the dais and
  on the floor alike, are inset to 0.8, 1.6 squares across at scale 1, as
  Regardie's and Greer's diagrams draw every lamen one size (about 1.55
  squares; the drawings' 2.31 on the dais and 1.66 on the floor were
  drift). Spacing between neighbours comes from the inset. Furniture
  fills its cell (altar, pillars, platform and throne, tablets: physical
  sizes); items on the altar and elsewhere keep their measured per-kind
  sizes. A label may use its object's whole cell width (2 squares at
  scale 1), not just the art's. One default scale per kind,
  `DEFAULT_SCALES` in `layout.ts` (officer 1 everywhere); the
  `sizes="drawing" | "uniform"` comparison and `officerScale` of stage A
  are gone.
- **Layout contract**, set now, before any hall is saved (decision 2,
  "Picking up component changes"): each kind's nominal box (its art's
  `box`), its anchor (the centre unless `anchor` says otherwise), its
  default scale and its art's `inset`. Changing any of them moves things
  in saved halls, so it needs a deliberate decision; the preset render
  snapshots catch accidental changes.

  | Kind | Default scale | Drawn at scale 1 |
  | --- | --- | --- |
  | officer, lamen | 1 | 1.6 squares (inset 0.8 in a 2-square cell) |
  | altar, pillar, banner | 1 | fills the 2-square cell (banner 1.6 × 2) |
  | platform, throne, board | 1 | `w` × `h` squares; a board with a diagram 2 × 3, sized by `scale` |
  | hebrewLetter | 1.475 | 2.95 × 2.71 |
  | tablet | 1.345 | a Watchtower 1.91 × 2.69; the Tablet of Union 2.69 × 2.26 (its own board, stage G) |
  | shewbread, candlestick | 1.25 | 2.5 |
  | kamea, seal | 0.9 | 1.8 |
  | veil | 1 | 16 × 0.4 (sized by `scale` only) |
  | marker | 0.6 | 1.2 |
  | tarotKey | 0.81 | 0.94 × 1.62 |
  | card | 0.81 | 0.94 × 1.62, a tarot key's size (stage H, part 2) |
  | items | per kind, 0.235–1.19 (gong, brazier, candle 0.5; other items 0.4) | measured on the drawings |
  | unknown tags (placeholder) | 0.5 | 1 |
- **Bounds and margins** come from content: the viewBox is the union of every
  resolved object and label plus `padding` (default half a square), so an
  Earth tablet outside the North wall widens the North margin by itself.
  `margin*` attributes override.
- **The visual editor** writes positions rounded to two decimals, snapped to
  half squares unless Alt is held, and prints leaves in one form.
- **Hall-level defaults** (`labelSize`, later a palette) are
  how a hall overrides styling without copying values into every node.

Rejected: fractions 0–1 of the container (sixteenths such as 0.1875, units
that differ between x and y in a non-square parent, sizes still in squares)
and a centre origin for the floor (negative numbers for half the hall, unlike
counting squares).

### 5. Vocabulary

Structure: `gdHall`, `dais`, `banners`, `floor`, `caption` (the title),
`door`. Hall attributes: `dais` (depth in squares), `wall`
(`plain` | `gradient`), `compass` (East/West/North/South labels, on by
default; the side labels are rotated as in the drawings), `padding`,
`labelSize` and the `margin*` attributes.

Placeables:

| Tag | Notes |
| --- | --- |
| `officer(role)` | `lamen` + `label`. Roles use the ritual role keys (`src/doc/ritualBlocks/roles.tsx`): imperator, cancellarius, praemonstrator, hierophant, pastHierophant, hiereus, hegemon, keryx, stolistes, dadouchos, sentinel; adepts (chiefAdept, secondAdept, thirdAdept, in the catalog since stage F), with the Portal rubric's lamens since stage H, part 2. `grade="portal"` draws the Portal's own Hiereus and Hegemon (stage H, part 2). Colour lamens only (see Background) |
| `lamen(role)` | The lamen alone; `grade` as on `officer` |
| `marker(text, shape)` | A labelled box or circle, as the book uses for objects (Lamp, Pantacle) and for the candidate. Every grade can be preset before its art exists |
| `altar`, `platform`, `throne` | Hosts. The altar is the black cube, or the Portal's small white altar with `kind="white"` (stage F); what lies on it is items |
| `pillar(kind)` | `black` (downward triangle) or `white` (upward); `glow` for the Neophyte style. No rotation |
| `banner(kind)` | `east` or `west` |
| `hebrewLetter(letter)` | A Hebrew-letter banner, in a row or anywhere |
| `tablet(element)` | Reuses `Tablet`: earth, air, water, fire and union (stage G), the Tablet of Union on a board of its own shape |
| `item(kind)` | Art registry: cup, chalice, salt, bread, rose, lamp, lantern (`light`: red, yellow, white; a lamp red and a lantern yellow by default; stage H), censer, fan, cross (`form`: calvary, latin, greek, greekFiveSquares, fourTriangles), triangle (`dir`: up, down), pentagram, pantacle, serpentTree, lightning, gong, brazier, candle (stage F; the rubrics' candles beside the altar) |
| `tarotKey(n)` | An original simplified card: numeral, Hebrew letter and title from magick-data; `n` is clamped to 0–21 and rounded, with a warning |
| `card(kind)` | An emblem card in the tarot key's frame (stage H, part 2): `pan`, `devil`, `death` (with XIII and XV, the keys' numerals), `typhon`; labelled by the hall, since its title cannot be read at hall size |
| `kamea(planet)`, `seal(planet)` | The number square drawn from its numbers (Agrippa's squares, computed in magick-data's `astrology/kameas` and drawn by the shared `Kamea`, since the follow-ups after stage F); seals drawn after Agrippa's 1533 woodcuts for the Moon and Venus (stage H, part 2), a placeholder for the other five. `planet`: saturn, jupiter, mars, sun, venus, mercury, moon (the hall's words, mapped to magick-data's `sol` and `luna`) |
| `board(kind)` | A diagram on a stand: flamingSword and minutumMundum through the Tree's figure (`TreeFigure`, shared with `TreeOfLife`); gardenOfEden and theFall as labelled boards first |
| `shewbread`, `candlestick` | The existing components |
| `veil` | The Portal's curtain across the dais: 16 × 0.4 squares, sized by `scale` |
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

Data still to add (the tarot titles came in A2): seals (drawn). The kamea
squares (computed) and the adept roles (`chiefAdept`, `secondAdept`,
`thirdAdept`) in the ritual role catalog, so hall roles and ritual roles
stay one set, came in stage F; the squares moved to magick-data after it
(Follow-ups after stage F).

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

Labels wrap at their object's cell width (decision 4), 2 squares for an
officer. At the default sizes "Past Hierophant" and "Banner of the West"
wrap; "Hegemon", "Stolistes", "Hiereus", "Keryx" and "Sentinel" fit; the
single words "Imperator" (2.06 squares), "Dadouchos" (2.22),
"Hierophant" (2.30), "Cancellarius" (2.50) and "Praemonstrator" (3.22)
overflow, centred.

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
  like `assets/fonts/README.md` does today. Sizes as WOFF2 (estimated
  16, 4 and under 3 KB): Latin-1 italic 11,464 bytes, Hebrew letters
  3,340, compass bold italic 2,072; the advance and kern table
  (`fontMetrics.json`, with the compass and Hebrew faces' advances)
  10,736.
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
- `Lamen` gains the Past Hierophant and safe lookups where it is, in
  `src/app/gd/components`, and is injected the same way.
- **Lamen rings** (settled 17–18 October 2026): the ring shows the collar,
  Gadi's own convention, kept deliberately so the roles stay
  distinguishable even as 20–25 px ritual role icons. Imperator red,
  Praemonstrator blue, Cancellarius yellow on the purple ("flashing")
  disc; Hierophant horizontal red and white stripes (8 lamen units each,
  a red stripe centred on the horizontal diameter, so the ring is
  symmetric; the black outline kept); Past Hierophant white, the same
  red cross on green, the same size as the others. The Past Hierophant's
  ritual role icon uses its own lamen. The stripes are geometry (slabs of
  the ring's disc under the inner disc), not a `<pattern>`, so `Lamen`
  still defines no ids and needs no hook. The sources differ, and the
  convention is ours: Regardie (*The Golden Dawn*) hangs the Hierophant's
  lamen from a white collar, the Imperator's scarlet, the
  Praemonstrator's blue and the Cancellarius' purple, and gives the Past
  Hierophant only "a Jewel of that Lamen"; the Ciceros paint the ring in
  the cross's colour and draw the Past Hierophant's lamen smaller; red
  and white stripes are the Hierophant's nemyss in Zalewski and in the
  Ciceros. Books are cited by title, edition and page only; archive.org
  copies of the Cicero and Zalewski books look unauthorised and are
  never linked. The citations, also in `lamen.tsx`'s doc comment:
  Regardie, *The Golden Dawn*, vol. 3 (Aries Press, 1939), Z.1,
  pp. 82–84 (the Chiefs' lamens and collars; "a Jewel of that Lamen"
  for a Past Hierophant) and pp. 88–90 (the Hierophant's lamen on a
  white collar); Pat Zalewski, *Secret Teachings of the Golden Dawn,
  Book 1: The Neophyte Ritual 0=0* (Llewellyn, 1991), p. 76 (the
  Hierophant's scarlet-and-white-striped nemyss), p. 78 (Fig. 26, the
  lamen drawn with an outer ring) and p. 87 (Whare Ra's white-field
  variant); Chic and Sandra Tabatha Cicero, *Secrets of a Golden Dawn
  Temple* (Thoth, 2004), pp. 80–81 (the collars; the Past Hierophant's
  smaller lamen) and pp. 96–97 (the ring in the charge colour). It moves to `src/components/gd/Lamen.tsx` (MIT) in stage H, once
  its caduceus (SVG Repo; "public domain" is the site's label, not the
  author's own licence text) and Eye of Horus (game-icons.net, CC BY) are
  replaced: Gadi wrote the file, but not those two paths, and CC BY
  attribution must travel with the file.
- Replacements are original flat drawings in the lamens' style: black
  outline, limited palette, hand-authored SVG paths.
- Done in stage H (Stage H notes): the items are original in
  `src/components/gd/hall/art` and `legacyArt/` is gone; the caduceus
  and the Eye of Horus are redrawn and `Lamen` is
  `src/components/gd/Lamen.tsx`, which the package's `lamen` art draws
  through, so the app injects neither; `THIRD_PARTY_ART` is empty. The
  hall package is clean, but the old drawings in `public/pics` that the
  built-in rituals still show (`0=0.pug`, `1=10.pug`, `2=9.pug`), which
  offline bundles capture, still carry both icons (the Neophyte's both,
  the Zelator's and Theoricus' the caduceus), so `/about#credits` keeps
  both credits, worded for those drawings, until stage I replaces them.

### 10. Ritual integration

- Reader: `gdHall` in `blocks.jsx` draws `<GdHall>`; the reader stays free of
  editor code and of `ExportControls`. The legacy `prepare.js` path turns
  numbers into strings, so the validator coerces numeric strings.
- Offline: hall art is code, so bundles need nothing new.
- Editor: `gdHall` joins `blockAtoms` (`tiptapRitual.ts:24`) so the text
  editor treats it as one block; its node view draws the hall and hosts the
  visual sub-editor. Without this the hall would open as nested editable
  blocks.
- `/hall` slash command inserts a preset, copied into the source (and
  the toolbar's Insert… dialog; Stage C notes). The static
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
between frames. Built in stage D, without reparenting (Stage D notes);
stage E added reordering rows and standing objects on hosts, by drag and
from the panel (Stage E notes). The panel stands beside the drawing
when the editor is at least 732 px wide and docks at the foot of the
screen, as a strip that can be hidden, when it is not (Follow-ups after
stage F).

### 12. Validation and safety

Ritual content is untrusted. The hall validator reports out-of-range or
malformed values as diagnostics (`NaN`, `Infinity`, `"abc"` and `"1e999"`
are invalid, not clamped); the layout resolver clamps coordinates, scales
and rotation to sane ranges and coerces numeric strings. Registries are
looked up with `Map`/`Object.hasOwn` (`lamen.tsx` indexes plain objects by
officer today, so `"constructor"` yields a function). Attribute strings only
ever reach text nodes. Gradient, pattern and drawing IDs come from `useId`, so
several halls on one page do not collide.

**Output bound.** The SVG grows with the source, never faster than a
small constant per node:

- At most `MAX_HALL_NODES` (4,000) nodes, labels included, within
  `MAX_HALL_DEPTH` (24).
- At most `MAX_HALL_LABEL_LINES` (500) lines of labels, free text and
  markers' text in a hall, 6 per label; what is cut is reported.
- Each drawing appears once per hall: the renderer draws every distinct
  art key, box and variant once in `<defs>` and places it with `<use>`
  (about 70 bytes a placement). An art's `variant(node)` names the
  normalised values it draws (a trump's number, a named colour, a role
  `Lamen` knows), so untrusted spellings of one drawing share it.
  Placeholders are shared by name. Text inside a shared drawing (a tarot
  card's title) is drawn once per drawing, not per placement, so it does
  not count against the line budget.

Measured after the final review of stage A: 4,000 chalices draw 405 KB
(448 MB before), 3,990 tarot keys 312 KB (3.2 MB), 3,990 markers with
200-character text 342 KB in 504 text elements (6.4 MB, 23,944). Tests
hold 4,000 chalices under 1 MB and the package's hostile halls under
500 KB. The visual editor's first write-back
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

Each preset's data carries a `sources` list of stable references (decided
17 October 2026): the book diagram and rubric it follows, as in the Sources
section below, and for the presets ported from a drawing, that
`public/pics` file. A source is structured, `{ kind: "drawing", path }` or
`{ kind: "book", work, page, leaf, note? }` (`regardie1938(131, 125)`),
with the cited works in `HALL_SOURCE_WORKS`; `hallSourceText` writes one
("Regardie 1938, vol. 2, p.131 (archive.org leaf n125)") and
`hallSourceUrl` links it. A test fails for a preset without a source.

| Preset | Source | Notes |
| --- | --- | --- |
| `neophyte` | drawing, checked against the book | Banner of the West follows the book (floor, north of the platform) |
| `zelator1`, `zelator2` | drawings | Earth tablet, lamp and salt on the North wall from the book (conflict 7) |
| `theoricus1`, `theoricus2` | drawings | Hexagram badge renamed `pantacle` |
| `practicus1`–`practicus3` | book layouts (stage F) | the 31st and 30th paths and 3=8; "Mercury" on the 3=8 dais a marker, as the drawing names it |
| `philosophus1`–`philosophus4` | book layouts (stage F) | conflicts 2–5 and 10; the Fire tablet drawn since stage G |
| `portal1`, `portal2` | book layouts (stage F) | each part takes the diagram its rubric describes (conflicts 1, 6); the Tablet of Union and the Fire and Water tablets drawn since stage G |

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
1938 drawings are read. On 17 October 2026 Gadi accepted the
recommendations of rows 1–9, and on 20 October 2026 that of row 10;
the presets follow them.

| # | Setup | Finding | Status | Recommendation |
| --- | --- | --- | --- | --- |
| 1 | Portal 1 and 2 | 1938 p.155 (leaf n148) heads part 1 with the pentagram hanging over a Greek cross, Hegemon West of the altar, Pan, Devil, Death and Typhon; p.175 (n168) heads part 2 with the cross of four triangles and Hegemon East. Each part's own text describes the other drawing (part 1 rubric p.156–157: Adepts NE and SE, Hegemon East; part 2 rubric p.175: pentagram, Greek cross of five squares, Hegemon West). The swap is in the first edition | Documented, original to 1938; which way the Order meant it is unsettled | Follow the text: swap the drawings |
| 2 | Philosophus 1 (29th path) | 1938 p.121 (n115) draws Shin, Tau and Qoph across the East band from its North end to its South end; the rubric (p.122) puts Qoph behind Hegemon in the South-East. The band's South end is the South-East | **Not a conflict** | Model the letters at NE, E and SE, as one row whose ends are the corners |
| 3 | Philosophus 2 (28th path) | 1938 p.131 (n125): Resh NE, Samekh E, Tzaddi SE, as the rubric on the same page says. No Tau below the West in 1938 or 1986; the Greer redraw (PDF p.304) adds one, probably carried over from the Theoricus 2=9 Yesod diagram (1938 p.82, n76), which does have it | **Settled**: no conflict for Resh/Samekh/Tzaddi; the West Tau is a later redraw's addition | NE/E/SE letters; no West Tau. The 1938 drawing also shows the Hierophant before the dais in the NE with the Banner of the East, the pillars in front of Hegemon in the SE, and a candle on each side of the altar, which the redraw omits |
| 4 | Philosophus 3 (27th path) | 1938 p.137 (n131) draws Hiereus (with the Banner of the West), Hierophant and Hegemon (with the Banner of the East) in a row at the East edge, each with a cup; pillars North–South near the South wall facing Peh. The rubric on the same page: Hierophant on his throne on the dais, Hiereus with banner seated before the dais NE, Hegemon SE, red lamps. The cups look carried over from the 29th and 28th path drawings | Documented in 1938; unsettled | Follow the text (Hierophant on the dais, red lamps); keep the drawing's pillars, which the text supports |
| 5 | Philosophus 4 (4=7) | 1938 p.144–145 (n138–139): the rubric twice puts the pillars North and South of the altar with Hiereus and Hegemon beside them; the drawing on the same page puts the pillars West of the altar | Documented in 1938; unsettled, text explicit twice | Follow the text |
| 6 | Portal Adepts | Explained by #1: the floor stations belong to the part 1 drawing (3rd Adept NE, 2nd Adept SE); the part 2 rubric seats them on the dais | Resolved by #1 | As #1 |
| 7 | Zelator Earth tablet | 1938 p.44 (n38) draws a small board, about 2 squares long, with its outer edge on the North wall line, inside the hall, the lamp at its East end and the salt at its West end; no source says whether it hangs or stands. Our drawings hang a board twice that size outside the wall | Settled: Gadi accepted the book's placement; the drawings' large board is drift | On the wall line, inside (the book), at the Theoricus board's size (the default tablet scale, 2.69 squares along the wall), the lamp East and the salt West of it along the wall |
| 8 | Zelator altar | 1938 drawing: the Flaming Sword diagram on the altar, the red lamp at its East end, the cross in the triangle at the base of the Tree. The explicit "For the Altar" requirements line appears only from 1986, an editorial addition consistent with 1938 | Settled | Add the Flaming Sword board and the red lamp to Zelator 1 |
| 9 | Neophyte Banner of the West | 1938 p.11 (n3) draws it free-standing on the floor, North-West of and slightly East of the Hiereus' throne; the Z documents give it a pole and base. No text gives a position | Settled as far as the sources go | On the floor, North-West of the throne (book) |
| 10 | Philosophus 4 (4=7) symbol of Venus | 1938 p.144 (n138) labels a box on the dais "Kamea & Sigils of ♀"; the rubric (p.145, n139) says instead "The symbol of VENUS on the Tree of Life is shown in the East". Neither mentions the other; the Theoricus 2=9 drawing shows the Moon's kamea and seals the same way | New in stage F; Gadi accepted showing both (20 October 2026) | Show both: the kamea and seals of Venus the drawing names, and the rubric's symbol as a marker ("Venus on the Tree of Life") until it is drawn (stage H). The preset does so; dropping either is one line |

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

## Sources

Cited by stable reference, per the outside-sources rule in `AGENTS.md`.
Nothing from these is stored in the repository; presets take only layouts
from them, drawn with our own art.

- **Regardie, *The Golden Dawn*, vol. 2, Aries Press, Chicago, 1938.**
  archive.org item `IsraelRegardie-TheGoldenDawn-Vol2-1938`; a leaf is at
  `https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol2-1938/page/n{leaf}`.
  Copyright status not established (a 1938 US book is public domain only if
  its copyright was not renewed; unchecked), so cited, not copied.

  | Diagram | Printed page | Leaf |
  | --- | --- | --- |
  | Neophyte | 11 | n3 |
  | Zelator, first part | 44 | n38 |
  | Theoricus, 32nd path | 69 | n63 |
  | Theoricus 2=9, second part | 82 | n76 |
  | Practicus, 31st path | 92 | n86 |
  | Practicus, 30th path | 106 | n100 |
  | Practicus 3=8 | 112 | n106 |
  | Philosophus, 29th path (rubric p.122, n116) | 121 | n115 |
  | Philosophus, 28th path | 131 | n125 |
  | Philosophus, 27th path | 137 | n131 |
  | Philosophus 4=7 (rubric p.145, n139) | 144 | n138 |
  | Portal, part 1 (rubric p.156–157, n149–150) | 155 | n148 |
  | Portal, part 2 | 175 | n168 |
  | Adeptus Minor, First and Third Points (not halls) | 199, 230 | n192, n223 |

  The Zelator second-part diagram's leaf is still to be located.
- **Regardie, *The Golden Dawn*, Llewellyn, 5th edition, 1986.** archive.org
  item `IsraelRegardie-TheGoldenDawnblackBrick1986-Enhanced`. Reprints the
  1938 drawings photographically (Portal part 2 at p.208, leaf n226).
  Copyrighted.
- **Regardie, *The Golden Dawn*, Llewellyn, 7th edition, ed. John Michael
  Greer** (ISBN 978-0-7387-4399-8). The edition Gadi owns; its diagrams are
  redraws. Copyrighted; cited by its own page numbers in this plan's
  research only. The archive.org copy (`goldendawnorigin0000rega_7edi`) is
  access-restricted.
- Nick Farrell, "How Israel Regardie saved and distorted the Golden Dawn",
  `https://farrellnick.substack.com/p/how-israel-regardie-saved-and-distorted`
  (on the lecture diagrams, not floor plans).
- Frater I.I.I., "Thoughts on the Portal Ritual", Hermanubis Golden Dawn blog,
  11 June 2018,
  `https://hermanubisgoldendawn.blogspot.com/2018/06/thoughts-on-portal-ritual.html`
  (notes that published Portal floor plans differ; weak evidence).

For the Enochian tablets (stage G):

- **Regardie, *The Golden Dawn*, vol. 4, Aries Press, Chicago, 1940.**
  archive.org item `IsraelRegardie-TheGoldenDawn-Vol4-1940`: the
  Watchtowers of Air, Water, Earth and Fire pp.270–273 (leaves
  n262–n265), the colours p.274–275 (n266–n267, the Tablet of Union's
  lines on p.275), squares with two letters p.306 (n298: "the higher
  one is preferable"), the sigils p.307 (n299). Copyright status not
  established, as for vol. 2; cited, and only letters taken.
- ***The Equinox*, vol. I no. 7, London, 1912**, "Liber Chanokh"
  (Crowley's abstract of the Order's Enochian papers). Public domain in
  the US. archive.org item `crowley-equinox_202110`, file "The Equinox
  Vol. 1, No. 7": the four Watchtowers and the Black Cross in Latin
  letters, Plate III (leaf n241); each Watchtower in Enochian, Plates
  IV–VII (n242–n245); the Tablet of Union, Plate VIII (n246); names
  read off Water pp.235–236 (n247–n248); the Kings' sigils, Plate X
  (n256).
- **Regardie, *The Golden Dawn*, 7th edition, ed. John Michael Greer**
  (Llewellyn, ISBN 978-0-7387-4399-8): the colour plates "Enochian
  Tablet: The First Watchtower" to "The Fourth Watchtower" and "The
  Sigils of the Angelic Tablets" (an unnumbered colour insert), and the
  Seniors' names in "The Four Elemental Weapons". Copyrighted; letters
  and names only.
- Dee's own tables (British Library, Sloane MS 3188 and 3191) were not
  read directly; a research note compared the existing Earth and Air
  grids with a modern transcription of Sloane MS 3191's Great Table
  (Stage G notes).

## Artwork ledger

| Item | Today | Status |
| --- | --- | --- |
| Checker floor, walls, dais, door | drawings, first-party | regenerated in code (A1) |
| Lamens | `Lamen`, first-party | Past Hierophant added (A2); collar rings, the Hierophant striped (before B); the caduceus and the Eye of Horus redrawn from geometry and `Lamen` moved to `src/components/gd/Lamen.tsx` (MIT), drawn by the package's `lamen` art (H); the adepts' lamens and the Portal's Hiereus and Hegemon (`grade`) added, the caduceus's wings and coils redrawn (H2) |
| Pillars, banners, Hebrew banners | drawings, first-party | ported into code (A1) |
| Pantacle | drawing, first-party | redrawn from geometry, `item:pantacle` (A2) |
| Flaming Sword (lightning) | drawing, first-party | redrawn without markers, `item:lightning` (A2) |
| Enochian tablets and sigils | `Tablet`, first-party | reused as `tablet` (A2); the Water and Fire sigils drawn from geometry after Regardie's description and the Tablet of Union drawn (G); drawn in any version, the Equinox's sigils in black after its Plate X, none for Dee's and Raphael's tables (Tablet versions); font licence open |
| Table of Shewbread, candlestick | components, first-party | reused as `shewbread`, `candlestick` (A2) |
| Cup, chalice, salt, bread, rose, lamp, lantern, censer, fan | drawings, icon-set signatures, no source | lifted into `src/app/gd/hall/legacyArt/` (A2, AGPL, injected); redrawn as original flat emblems in the old boxes, `vessels.tsx`, `lights.tsx`, `altarItems.tsx` (H, `original()`), `legacyArt/` removed |
| Caduceus (Keryx lamen) | SVG Repo, "public domain" label | redrawn from geometry in `Lamen` (H); wings K1 with a dip round the ball, coils narrowing and tightening downward (H2) |
| Eye of Horus (Sentinel lamen) | game-icons.net, CC BY | redrawn from strokes after the wedjat's ancient form in `Lamen` (H); the old drawings in `public/pics` still carry it and the caduceus, so `/about` credits both for them until stage I |
| Tarot XXI on the Theoricus altar | RWS raster in the drawing | original card, `tarotKey` (A2) |
| Serpent on the Tree, Moon kamea, Moon seals | rasters in Theoricus 2, no source | markers in the preset (A2); the kamea computed and drawn, `kamea` (F), through the shared `Kamea` (after F); the seals a placeholder, `seal` (F), deferred by Gadi in H; the Moon's seal drawn after Agrippa (H2); the serpent a marker, pending Gadi's decision |
| Planetary kameas | none | computed (Agrippa's squares) and drawn from geometry, `kamea` (F); since the follow-ups after F the squares are magick-data's (`astrology/kameas`, MIT code, no rights asserted over the squares) and the drawing is `Kamea` (`src/components/astrology/Kamea.tsx`, MIT), which the hall's `kamea` art wraps in its font and palette; seals and sigils to overlay it in H |
| Planetary seals | none | placeholder `seal`, a dashed ring naming the planet (F); the Moon's and Venus' drawn from geometry after Agrippa's 1533 woodcuts (LOC copy, archive.org `DeOccultaPhilosophiaLoc1533`, leaves n168 and n166; public domain, recorded with `publicDomain()`), on silver plates (H2); the other five still placeholders, to be hand-drawn after Agrippa the same way (Follow-ups); name sigils traced over a kamea by an adapted `/gd/sigils`, hosted by `Kamea` as an overlay, a later feature once the sigil system handles the hard cases (Gadi, 24 October 2026) |
| Flaming Sword and Minutum Mundum boards | `TreeOfLife`, first-party | `TreeFigure` (the Tree's own geometry) on a board, `board` (F); the Minutum Mundum's paths in their colours need path colour data; pending Gadi's decision (H) |
| Garden of Eden, the Fall | none | labelled boards (F); pending Gadi's decision (H) |
| Veil, white altar, gong, brazier, candle | none | original geometry (F) |
| Adept lamens | none | plain circles in the hall and as role icons (F); the Portal rubric's lamens, option A, drawn from geometry in `Lamen` (`lamenGlyphs.tsx`) (H2) |
| Portal Hiereus and Hegemon lamens | none (the Outer Order's drawn) | drawn from geometry after the rubric (p.156), `grade="portal"` (H2) |
| Markers in the stage F presets | none | the Fire and Water tablets and the Tablet of Union drawn (stage G); Pan, the Devil, Death and Typhon (Portal 2) emblem cards, `card` (H2); "Venus on the Tree of Life" (conflict 10), "Mercury" (3=8), the Theoricus' seat (Practicus): markers still, pending Gadi's decision (Follow-ups: the cards proposal) |

The third-party list the plan requires (decision 9) is
`THIRD_PARTY_ART` in `src/app/gd/hall/art.test.tsx`: the nine legacy
items and `lamen` (for its caduceus and Eye of Horus) until stage H,
which brought it to zero; the test keeps it there.

Outside this project but found on the way: `2=9.pug:414` hotlinks a Pinterest
image; the 22 RWS tarot JPGs in `public/tarot/rws` are uncredited (public
domain 1909 edition; record the source).

## Old `/pics/*.svg` references

Kept until every reference is gone; this list is updated as they go.
Stage I removes them all and redirects the five URLs to the halls'
SVGs (Stage I plan, I.3).

| Where | Kind |
| --- | --- |
| `src/doc/0=0.pug:58`, `1=10.pug:61,480`, `2=9.pug:47,484` | built-in docs; switched in the last stage |
| `src/files/ritualPublicationStaticPaths.ts:11-17` | publication static paths |
| `src/offline/ritualPublicationTracing.test.ts:84-86` | asserts the files exist, via that list |
| `src/doc/ritualBlocks/renderForEditing.test.tsx:172,186` | test fixture |
| The presets' `sources` (`drawing("neophyte")` and so on in `src/components/gd/hall/presets/*.ts`) | the drawing each preset was ported from; a citation, which needs the file only while it is served |
| `/gd/hall`: the sources' links under the editor | link each cited drawing |
| `src/app/gd/hall/presets.test.tsx` (each preset ported from a drawing cites `public/pics/<id>.svg`, which must exist) | test of the two rows above |
| Production ritual "0=0 Grade of the Neophyte" and 13 revisions | from the 15 September Mongo dump; rituals are unchanged since, so the SQL rows match. Migrate by editing the ritual once presets reach parity |
| Published offline bundles, external links, search indexes, user exports | suspected; cannot be enumerated. Keep the files served |

The presets, the page's source links and their tests keep the drawings
served until stage I, which decides whether the citations stay. The
"Compare with the original drawing" switch and the drawing it showed
under the `/gd/hall` editor are gone: Gadi decided on 19 October 2026
that the comparisons are done and that the switch no longer fits the
toolbar.

## Stages

Each stage is a series of gated commits on `gate/gd-hall`.

| Stage | Content | Can be reverted alone | Status |
| --- | --- | --- | --- |
| A | `src/components/gd/hall`: model, validator, layout, renderer, chrome, labels and fonts; `Lamen` Past Hierophant variant and `Map` lookups (the move is stage H); legacy art under `src/app`; the five drawn presets; a read-only `/gd/hall` gallery with export and side-by-side comparison with the old SVGs (the comparison removed 19 October 2026, Gadi's decision); `sizes` comparison (removed before B) | yes | done (A1–A3 and the final review fixes, 17 October 2026) |
| B | Spike results applied: compiler change (decision 2), Pug round trip, lazy reader block, `blockAtoms` entry with a static node view, boundary tests | until the first hall is saved | done (18 October 2026; Stage B notes). Rituals may now save halls, after which the layout contract (decision 4) holds |
| C | `/hall` slash command with presets | yes | done (18 October 2026; Stage C notes): slash command and Insert… dialog, Copy Pug source on `/gd/hall`, hall warnings in the source editor |
| D | Visual sub-editor | yes | done (18 October 2026; Stage D notes): `GdHallEditor`, opened from a hall's atom; refined in stage E (19 October 2026, Gadi's decisions): rows reorder by drag with explicit positions freezing their siblings, objects stand on hosts by drag or the panel's Stands on, and a warnings badge outside edit mode (Stage E notes) |
| E | `/gd/hall` source, visual and split playground with local draft and share link | yes | done (19 October 2026; Stage E notes): the gallery became a hall editor built from the shared source panel and visual editor, with presets, its own history, a draft in localStorage, share links in the fragment, export and Copy Pug source |
| F | Remaining vocabulary and the presets for Practicus, Philosophus and Portal (markers where art is missing) | yes | done (19 October 2026; Stage F notes): kameas, placeholder seals, boards, veil, white altar, gong, brazier, candle, the adepts in the ritual roles, nine presets from the 1938 layouts; the layout switch reads Source, Split, Visual and the drawing comparison is gone |
| G | magick-data: Water, Fire and Union tablets | yes | done (21 October 2026; Stage G notes), with Gadi's split ratios first; the letter choices and the Earth and Air question await Gadi |
| H | Original artwork; ledger to zero; `Lamen` moves to the MIT directory; credits | yes | core done (23 October 2026; Stage H notes): the nine items, `light`, the Keryx's and Sentinel's glyphs, `Lamen` in the MIT package, the ledger at zero; the seals deferred and the boards, figure markers, adept lamens and Minutum Mundum colours pending Gadi's decision |
| I | Built-in docs switched to presets, then `public/pics`' drawings and their `/about` credits removed (Old `/pics/*.svg` references); each built-in ritual's hall linked to its page under `/gd/halls/<slug>` ([plan 062](062-gd-hall-seo.md), as amended on 28 October 2026); reader export; end-of-project review of the hall pages and editor, scales and the conflicts table | yes | planned (28 October 2026; Stage I plan): the old drawings removed and redirected to the halls' SVGs (Gadi's decision), reader export deferred |
| J | Private hall sources, written outside the repository for Gadi to save in his private rituals | — (nothing committed) | |

Stretch: a dark palette. Server rendering through `/api/render` is
planned in [plan 062](062-gd-hall-seo.md) (26 October 2026), for the
presets' search pages.

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
  and the ellipsis. The kern table is stored by kern class (266 class
  pairs for 1,839 character pairs, 8.6 KB of JSON). The soft hyphen has
  no advance and no pairs (HarfBuzz draws nothing and kerns across it),
  and no-break spaces do not break lines.
- The default scales live in one table, `DEFAULT_SCALES` in
  `src/components/gd/hall/layout.ts`, measured on the drawings. Banners
  follow Neophyte (1.51 × 2.02 squares); the Zelator and Theoricus banners
  are half as large again, so their presets will either set `scale` or
  accept the drift. `sizes="uniform"` drew every officer at scale 1
  (removed before stage B: decision 4).
- `margin*` fixes that side of the view at a distance from the wall line;
  without it the side follows the content plus `padding`.
- The dais row centres its block, labels included, in the dais band;
  banner rows stand beyond the compass labels, and `banners(spread="ends")`
  puts the end banners on the corners (Philosophus 1).
- Doors take `x` on the East and West walls and `y` on the North and South.
- Item colours (`fill`, `stroke`) are named palette colours, never CSS.
- A `label` child of a placeable or a host is attached to it (an altar's
  `label` child labels the altar); a `label` in the floor or a row is free
  text placed like any object. Free text on an altar is not possible.

## Stage A2 notes

Settled while building A2, where the plan or the brief left a choice or
proved wrong:

- **Hierophant and Past Hierophant.** The plan said the Past Hierophant's
  lamen is the striped ring "from the Neophyte drawing". The drawings label
  it otherwise, the same in Neophyte, Zelator 1 and Theoricus 1: the
  striped ring (`circle1-6-5`, a stripe pattern) is "Hierophant", and the
  light grey ring with the green disc and red cross (`circle1-6-55`,
  `#f2f2f2`) is "Past Hierophant". `Lamen` draws the Past Hierophant as
  labelled; the Hierophant keeps the existing red ring, so the ritual role
  symbols are unchanged. Open for Gadi: should the Hierophant take the
  striped ring? It would change the role symbol in every ritual. Settled
  before stage B: yes, and the Past Hierophant's ring is white (decision
  9, Lamen rings).
- **Lamen colours** are `Lamen`'s, not the drawings' (whose Cancellarius
  and Praemonstrator use deeper colours); `Lamen` is canonical.
- **Legacy art** is lifted, not traced: every transform applied, centred,
  100 units on the longer side, rounded to 0.1 unit; glow filters, ids and
  Inkscape metadata dropped (the drawings' items have a soft glow; ours do
  not). The chalice (115 KB) and censer (66 KB) are traced drawings with
  hundreds of paths; integer rounding visibly roughened them, so they stay
  that size until stage H.
- **Lamp and lantern** are one drawing (the Neophyte red lamp); the other
  drawings' lanterns are copies of it. The panes take the existing item
  attribute `fill` (a named colour mixed half and half with white) rather
  than a new `color`; the lamp defaults to the drawing's red, the lantern
  to its pale yellow.
- **Item scales** are re-measured on the items' own geometry: A1's figures
  included the glow filters, and its lantern row measured the Zelator
  salt. One default per kind, from the drawing where it first appears;
  presets set `scale` where a drawing draws an item larger (the Theoricus
  cups and lamps, the Zelator salt and triangles).
- **Pantacle ring.** Theoricus 2 (`text39`) rings the disc with SAPERE AUDE
  and seven Earth names separated by runic crosses: Adonai, Auriel, Kerub,
  Phrath, Tzaphon, Phorlakh, Aretz. Its Adonai is spelled "אאאאדני" and a
  stray "t" opens the text; both are read as typos. The names stand in
  eighths of the ring, anticlockwise from SAPERE AUDE (the Hebrew reading
  direction); the runic separators are left out (the hall fonts have no
  such glyph). A2 set each name on one `textPath`, Hebrew in visual order
  with bidi overridden, claiming every renderer would lay them out alike:
  Chromium did, but resvg-wasm (the server's renderer) drew every Hebrew
  name reversed and rsvg draws no `textPath`. Each letter is now its own
  rotated `<text>`, placed by the font's advances and kern pairs
  (`fontMetrics.json` now holds Noto Serif Hebrew Bold's); Chromium and
  resvg draw the same ring, in the order Chromium drew before.
- **Tarot titles** live in magick-data as `treeOfLifePath`'s
  `hermetic.tarotTitle` (one per Hermetic path, so one per trump): the
  trumps' common titles, with the Golden Dawn's "The Universe" for XXI,
  not the Order's own titles (kept: Decisions before stage B). The path page keeps naming the
  trump as its Rider-Waite card prints it.
- **Shewbread and candlestick** both named their text paths
  `path-<branch>-l<line>`, so on one page the second drew its text on the
  first's paths. Each now takes an `idPrefix` prop, defaulting to its own
  name; the hall passes one from `defId`. A first fix with `useId()` broke
  the production build, because the `/og` and `/api/render` routes render
  them with no hook dispatcher, so these components must stay hook-free.
  The `idPrefix` fix was folded into the commits that introduced the ids
  and the hall art, so every commit builds.
  In the hall each draws in a 100-unit nested `<svg>` (they size
  themselves to their parent viewport) on a white disc.
- **Tablets.** The default scale is the Theoricus Air tablet's board
  (`rect164-7`, 1.91 × 2.69 squares): 1.345. A2's 2.05 was mis-measured
  and drew the Theoricus tablet over the Pantacle and the lantern. The
  Zelator drawings' Earth tablet is a larger board (`rect161`, 3.82 ×
  5.31); the review fixes gave the Zelator presets `scale` 2.655, and A3
  went back to the default (conflict 7: the size is drift). Measured in Chromium in the checker
  floor's frame (its altar exactly at (8, 8); `rect313`, the floor's
  outline, sits 0.034 squares off it). The package's tablet
  shows the transliteration; `gdHallArt` passes the app's Enochian font,
  so whatever imports `gdHallArt` also carries that `next/font` face.
- **Zelator 1 altar** (conflict 8): `item(kind="lightning")` drawn yellow
  (`stroke`, a named colour) so it shows on the black altar, the cross in
  the triangle at its West end, the red lamp at its East end.
- **Zelator Earth tablet** (conflict 7): A2 stood it inside on the wall
  line (`anchor="north"`, x = −0.31) at the Theoricus size. The A2 review
  fixes measured the drawings' larger board and, at that size, hung it
  outside the North wall (centre (−1.37, 8.30)), reopening the conflict.
  Gadi then accepted the book's placement and the large board as drift,
  so A3 stands it inside again: outer edge on the outer wall line
  (`anchor="north"`, x = −0.31), centred at y = 8, default scale (1.91 ×
  2.69 squares, the long side along the wall); the lantern just East of
  it (y = 5.3) and the salt just West (y = 10.55), both at x = 0.8, clear
  of the floor's edge, the Hiereus (part 1), the Table of Shewbread (part
  2) and "North". A test pins the placement and that the three overlap
  nothing. Zelator 2 cites p.44 for these three alone ("the Earth tablet,
  lamp and salt only"); its own diagram is still to be located. The
  compass labels still move outward past anything outside their wall.
- **Dais height.** The dais row centres its block, labels included, and the
  two-line "Past Hierophant" label pushed the dais-5 lamens down onto the
  Theoricus Air tablet; the Zelator and Theoricus presets set the lamens'
  `y` (−2.7) instead. With the 1.6-square lamens of decision 4 the
  workaround went: the row centres again, clear of the tablet.
- **Rendered references.** The two diagrams (Shewbread, candlestick) use
  `textPath` with `href="#…"` (the Pantacle's ring no longer does); the
  preset test allows `href` and `url()` only when they point at an id in
  the same SVG.
- **Registry attributes.** `hallTagSpec` now adds the attributes an item's
  or a lamen's injected art declares (found by the A1 review).
- Preset snapshots (`src/app/gd/hall/__snapshots__`) are 56–326 KB each,
  one tag per line; Zelator 2 is the largest (chalice, censer, both
  diagrams, the tablet). Since each drawing sits in `<defs>` once (Review
  fixes) they are 57–314 KB.

## Stage A3 notes

Settled while building A3, where the plan or the brief left a choice:

- **Zelator Earth tablet**: see the Stage A2 notes and conflict 7.
- **The `prepare` hook** (decision 8). `ExportControls` clones the SVG at
  the PNG's size and returns the PNG's promise inside the click, so the
  `ClipboardItem` still gets a promise synchronously (Safari);
  `prepare(clone)` runs inside that promise, then the clone is
  serialised and rasterised. A rejection fails the export ("Export
  failed."). The image links are drawn by the server and never pass
  through it, nor do SVG files and copies.
- **Hall fonts in PNGs.** `embedGdHallFonts` (`src/app/gd/hall/
  exportFonts.ts`) fetches the three WOFF2 subsets from `/fonts` once
  per page (a failed fetch is forgotten, so the next export retries),
  inlines them as `data:` URIs through the package's new
  `gdHallFontFaceRule`, and puts the `<style>` first in the clone.
  Checked in headless Chromium 153 (Linux): a Chromium whose
  fontconfig has no Noto at all (DejaVu and Liberation only) exported
  Zelator 2 with Noto Serif Italic labels, the bold italic compass and
  bold Hebrew letters; the same clone rasterised without the hook fell
  back to the system's faces (38,306 pixels differ). With Noto
  installed the fallback stacks find the system copy, so the hook
  changes almost nothing there (1,023 pixels). An SVG download carries
  no `@font-face`, `<style>` or `data:` URI. Firefox and Safari are
  untested (Follow-ups).
- **Enochian letters in PNGs.** Only the OFL subsets are embedded, as
  the brief asked. A tablet's Enochian letters, drawn with the app's
  `next/font` Enochian Plain, therefore show as Enochian in a PNG only
  where an Enochian font is installed (the development machine has one
  in `~/.local/share/fonts`) and as their Latin letters elsewhere. The
  plan allows embedding Enochian Plain on the PNG path (only rasterised
  glyphs leave the page); whether to, given its unclear licence, is for
  Gadi (Follow-ups).
- **The gallery** is public like `/gd/symbols/*`: `pathnames` ("Temple
  Halls"), `PUBLIC_PAGES` and so the sitemap, a text tile on `/gd` (a
  drawn tile would load the hall art there), and `/gd`'s description.
  Its social card falls back to `/gd`'s Golden Dawn logo until halls
  have a render contract. The server page declares the hall fonts once
  in a `<style>`; the halls carry none (`fontBaseUrl` unset), so SVG
  exports stay font-free. `GdHall` takes a `ref` to its `<svg>`.
- **Sizes**: a three-way toggle, drawing, uniform or both side by side,
  each hall with its own export (`gd-hall-<id>`, `gd-hall-<id>-uniform`);
  removed before stage B with the one cell size (decision 4).
  "Compare with the original drawing" takes the drawing from the
  preset's `sources` (removed 19 October 2026). Panes sit side by side from MUI's `md` breakpoint
  (900 px), at most 560 px each, and stack below it. Uniform sizes draw
  the dais lamens smaller (1 against 1.155) as well as the floor
  officers larger, worth weighing when one strategy is kept.
- **No URL state**: the chosen preset is component state; stage E brings
  the share link.
- **Bundles**: only the gallery imports `gdHallArt`; in the production
  build the chalice's path data appears only in the `/gd/hall` page
  chunk.
- **Documentation screenshots** (`AGENTS.md`) cover temples, the ritual
  list and creation form, the ritual editor and the reader, so they do
  not apply to this page.
- Seen on the way, not changed: in the Neophyte preset "Dadouchos" runs
  over the South wall line.

## Review fixes

An independent review of A1 (`469b66b..34321f7`) found two major and eight
minor problems and some nits; m5 was fixed in A2 (a0381b0), the rest after
A2:

- **One set of rules** (`spec.ts`): tag specs, a placement table (allowed,
  drawn on the floor, ignored) and a document-order walk within
  `MAX_HALL_NODES` and `MAX_HALL_DEPTH` that both the validator and the
  resolver use, so what the validator calls ignored is not drawn (a door in
  a row, a structural tag in a host) and both stop at the same node. Label
  children count towards the node bound. Children of unknown and reserved
  tags are neither checked nor drawn. (M1, m1)
- **Bounded labels**: at most 6 lines per label or caption (`MAX_LABEL_LINES`,
  the last ending in "…"), at most 500 label lines per hall
  (`MAX_HALL_LABEL_LINES`; the largest preset draws 12), and no wrapping
  narrower than 1.5 squares (`MIN_LABEL_WIDTH`). The review's hostile halls
  went from 125,000 and 399,000 lines (9.5 MB and 28 MB of SVG) to 500
  lines (39 KB and 527 KB). (M1)
- **Clamps**: a free label's `width` is clamped like every width; each
  object's centre is clamped again in floor squares and its size to 48
  squares, so nested hosts cannot multiply past them. (M2, m6)
- **Label layout**: labels on one side stack away from the object; a host's
  children wrap labels at their drawn width; rows measure every label of
  their items; labels and lines are keyed by order. (m2, m3, nit)
- **dais=0** stays valid (no dais band): an East door then cuts through to
  the floor, and the validator warns of a dais row. (m7)
- **Import boundary**: relative and `@magick-components/` specifiers are
  resolved, `..` included, and must stay in `src/components`; tests may also
  reach `tests/`. (m8)
- **Fonts**: the soft hyphen has no advance and no kern pairs (HarfBuzz
  draws nothing and kerns across it); no-break spaces do not break lines.
- **Validator**: it reports what the layout cuts (long labels, the line
  budget, a `margin*` clipping the drawing) and clips untrusted text in its
  messages to 40 characters.
- **Nits**: the Hebrew letter's baseline comes from the font's body metrics
  (21 → 21.057 units, the only snapshot change); the art provenance test
  uses `import.meta.glob`; the Neophyte banners' provenance notes that part
  of the source looks auto-traced.

Not changed: `gdHallFontFaceCss` still throws on an unsafe base URL. The URL
is the developer's, not content, and failing loudly is preferred to a hall
silently drawn without its fonts.

An independent review of A2 (`34321f7..7de3734`, before the `idPrefix` fix
was folded in) found one major and four minor problems and two nits, fixed
after it:

- **Tablet scale** (major): the default was measured on the wrong shape;
  re-measured on the boards, 1.345 by default and 2.655 for the Zelator
  Earth tablet, the Theoricus tablets at the board's centre (7.97, 0.63).
  The Zelator tablet then hung outside the North wall, and compass labels
  move outward past anything outside their wall. A3 restored the book's
  placement at the default size (Stage A2 notes, conflict 7).
- **Zelator 2's sources** cited p.44, the first part's diagram; it now
  cites its drawing alone, and a test pins each preset's page to its own
  part.
- **Pantacle ring**: each letter drawn alone, so resvg no longer reverses
  the Hebrew (Stage A2 notes). Checked in headless Chromium and
  resvg-wasm 2.6.2 against the order Chromium drew before.
- **tarotKey**: `n` is clamped and rounded as the validator says, and a
  number spec may ask for whole numbers (`integer`), the validator
  warning that a fraction is rounded.
- **Theoricus 1**: the cup stands 0.21 squares further West, so the card's
  title shows.
- **Nits**: magick-data calls the trump titles the common ones, with the
  Golden Dawn's "The Universe" for XXI; the hook-free test of the
  Shewbread and candlestick renders them with a guarded `react` instead
  of calling `forwardRef`'s internal `render`, and so also sees hooks in
  their child components.

The final reviews of stage A (Fable, `main..72cfad6`; Opus, A3) found one
major problem, an owner decision and minor problems and nits, fixed after
them except the decision:

- **Art amplification** (Fable M1, major): every placement drew its art
  in full, so with the app's art 200 chalices drew 22.4 MB of SVG from
  6.7 KB of source (448 MB at the node bound), and markers wrapped their
  own text outside the line budget. Each art now declares `variant(node)`
  and the renderer draws each distinct drawing once in `<defs>` as
  `<g id="…-art<n>">`, placed with `<use href>`; markers' text goes
  through the label budget and is set over the marker by the layout; the
  bound and the measurements are in decision 12. A `<g>` in `<defs>`
  rather than the `<symbol>` the fix proposed: `<use>` of a `<symbol>`
  opens a viewport that clips at the origin unless the symbol sets
  `overflow`, while a `<g>` draws in the `<use>`'s own coordinates, as the
  art did inline. The five presets rasterise pixel-identically in
  Chromium before and after the `<defs>` change; moving the markers' text
  into hall units changes the anti-aliasing of two of Theoricus 2's
  marker lines (844 pixels at 1,600 px wide, the same glyphs and
  positions). The PNG and SVG downloads of Neophyte, Zelator 2 and
  Theoricus 1 from `/gd/hall` are pixel-identical to the same downloads
  before the change; the SVG files carry no duplicate ids, so
  `renameDuplicateIds` never renames an id a `<use>` points at. The
  snapshots shrink only where a preset repeats art (Theoricus 1
  121 KB → 107 KB, Zelator 2 328 KB → 314 KB) and grow by the `<use>`
  elements elsewhere (Neophyte 56 KB → 57 KB). The art no longer receives
  `unitsPerSquare` and `labelSize`, which only the marker read; the
  largest preset now draws 16 label lines (Theoricus 2's markers).
- **Invalid tags** (Fable m1): a node whose tag is not an identifier was
  drawn as a placeholder while the validator said it was ignored; it is
  no longer drawn.
- **Doors** (Fable m4): `x` and `y` take a door's own 0–16 range, so the
  validator's clamp warning matches the layout's; door bands are keyed by
  order (two doors in one place shared a key).
- **Preset sources** (Fable nit): structured, with one formatter (Presets).
- **Copy PNG** (Opus m1): a failing `prepare` (the font fetch blocked)
  made the clipboard write fail and showed "The browser refused clipboard
  access."; `copyPng` now reports the PNG's own error, so the controls
  say "Export failed.".
- **Zelator Earth tablet test** (Opus n1): checks labels, free text and
  the compass words as well as object boxes.
- **`gdHallFontFaceRule`** (Opus n2): refuses a `src` with a quote,
  bracket, backslash, space or markup character, as the base URL check
  does.
- **Rasterising** (Opus n3): `image.decode()` before `drawImage`, for
  WebKit, which may fire `load` before data-URI fonts are usable.
- **Plan** (Fable m2, m3, m5, nits): the old drawings' ledger, the stage
  table's `Lamen` entry, decision 7's sizes, and the follow-ups below.

Not changed: **sizes** (Fable M2) is Gadi's decision; stage B is gated on
it (Stages). The uniform-size label overlaps (Opus n4) wait on it too
(Follow-ups). Both settled before stage B: one cell size (decision 4),
and the overlaps went with the uniform sizes.

## Decisions before stage B

Gadi's decisions of 17–18 October 2026, implemented on `gate/gd-hall-b`:

- **Cell sizes and the layout contract**: decision 4. The five presets
  were rendered again afterwards. The dais rows centre in the dais again
  (the `y=−2.7` workaround went); Theoricus 2's Banner of the East moved
  from y = −1.24 to −0.84, as in the other dais-5 presets, because the
  Hierophant's lamen covered its hanger (it touched it before too);
  Gadi accepted this as drift normalised (18 October 2026). In
  Zelator 2 "Hiereus" and "Keryx" no longer meet (0.34 squares apart),
  and no label meets a compass word. The Neophyte "Dadouchos" ran 0.06
  squares past the floor's edge into the South wall band (a single
  word: the cell width cannot help); before stage B the Dadouchos moved
  from x = 14.95 to 14.75. The x = 14.9 proposed for it still laid the
  final "s" on the floor's outline when rasterised (its advance ends at
  16.01 squares, the outline's inner edge is at 15.93); at 14.75 the
  label ends at 15.86, clear of it, and a test pins that. Theoricus 1's
  "Hegemon" ends at the floor's edge.
- **Citations** for the lamen rings: decision 9 and `lamen.tsx`.
- **Past Hierophant role icon**: the brackets around it went, since the
  white ring now tells it from the Hierophant's.
- **Lamen rings**: decision 9.
- **Art**: the lifted legacy art stays until stage H; no change.
- **Tarot titles**: the common Rider–Waite titles, with "The Universe"
  for XXI, stay; no data change.

The documentation screenshots that show the ritual editor and reader
(`editor-split`, `editor-source`, `editor-visual`, `editor-phone`,
`reader-phone`) were recaptured from this branch after the lamen change
and came out byte-identical: none of them shows a role icon.

## Stage B notes

Settled while building stage B (18 October 2026), where the plan or the
brief left a choice or proved wrong:

- **Commit order.** The boundary test learns `import()` first
  (575d22a); the reader block next (4d3b50b), harmless without the compiler
  change and useful at once, since a legacy ritual compiled by
  `prepare.js` may already hold a hall; then the editor atom (ab2f700),
  which nothing reaches until source can hold a hall; and then the
  compiler change itself (347fe2b), with the Pug printer's hall form and
  every test that needs source to hold a hall. The review's fixes follow
  it (Review fixes for stage B, below); the compiler's own fixes were
  folded into 347fe2b, so the branch changes the compiler identity once.
  Every commit passes its gate, and nothing a user can reach half-works
  in between.
- **The compiler identity.** `semantic.ts`'s hash went from
  `041fa6dc…` to `6b059a0f…` (347fe2b; `71dba594…` before the review's
  fixes were folded in and `d48ca764…` before the final review's, never
  on `main`); `semanticCompilerImpl.ts` and
  `ritualNodeIds.ts` are unchanged. **Reverting:** the window closes
  when the first ritual with a hall is saved; from then on, fix forward
  (decision 2).
- **Reserved names, beyond decision 2's list.** Tags `stylesheet` and
  `cursor` (the offline inventory reports them, so a hall holding one
  could not be published); `say`, `do` and `ritual` followed by a
  capital (the Pug parser reads them as tasks and its wrappers, so they
  could not be printed back); any tag beginning with `doctype`, which
  Pug reads as a doctype (the final review); and `Object.prototype`'s
  identifier names
  (`constructor`, `toString`, `valueOf` and four more) as tags and as
  attributes, which the inventory calls malformed; and Pug's keywords
  (decision 2). The list is written out rather than read from the
  engine, so the compiler does not depend on it. Reserving the
  prototype names keeps them out of halls in source, but did not, as
  first written here, keep them from crashing the reader: the JRT
  reader looks a row's type up in a plain object and constructs every
  child row eagerly, so a legacy row typed `toString` outside a hall,
  or inside an opaque legacy hall, was taken for a block class and took
  the whole reader down. The reader's registry now has no prototype
  (d7dce07).
- **Messages**: "invalid hall tag", "reserved hall tag" and "a temple
  hall cannot stand here" (line and column), "invalid hall attributes"
  and "reserved hall attribute" (line only), "text is not allowed in a
  hall", and "unsupported hall node" for anything else (a legacy node,
  an unknown key).
- **Importing compiled rows.** A `gdHall` row whose subtree breaks the
  shape rule, or that stands where a hall may not, imports as opaque
  legacy content, as every hall did before, rather than failing the
  whole import. The `{}` rows `prepare.js`
  leaves for `//-` comments inside a hall are skipped, so such a
  ritual's reader tree loses them on import: `audit-ritual-corpus.ts`
  counts it as failed (Follow-ups).
- **Printing.** A hall prints one node per line, never in the inline,
  pipe or shortcut forms other tags may take (a hall `b` or `var` would
  otherwise print as `#[b#…]` or `${…}`). Leaves follow the general
  rule: `children: []` prints bare (`item#…(kind="cup")`), a node
  without `children` ends in `/`. Authors and `prepare.js` produce the
  first, so it is the canonical leaf; `gdHallSource` (in
  `src/doc/gdHallRows.ts`, outside the hashed files) gives preset rows
  `children` when they become source, and the visual editor (stage D)
  should do the same. Spaces typed after a hall's tags, which Pug reads
  as text, are dropped by the parser (34f24ff) rather than refused as
  "text is not allowed in a hall"; the printer never writes them.
- **The reader block** (`GdHallFrame`) loads `GdHallDrawing` with
  `next/dynamic`, the app directory's `React.lazy` with chunk and CSS
  preloading (the CSS is the Enochian face). The hall is drawn at most
  36rem wide. Its placeholder was 3:4 at first, while the presets draw
  at 0.620–0.752 (width over height), a shift of up to 161 px at 576 px
  when the drawing arrived. The resolver cannot size it up front: it
  needs the art registry, and alone, with its label metrics, it is
  23.7 KB minified (9.7 KB gzipped) that every ritual's reader would
  load. `estimateHallAspect` (`src/components/gd/hall/aspect.ts`,
  83b2211) reads the hall's structure only (dais, compass, banner rows,
  floor objects beyond the walls, caption, padding, margins), 2.6 KB
  minified, 1.3 KB gzipped (esbuild); every preset comes within 2 % of
  its drawing (Theoricus 2, the farthest, 1.8 %: 18 px at 576 px), and
  the frame passes it to the placeholder as `--gd-hall-aspect`. It
  clamps floor coordinates to `COORDINATE_RANGE`, as the resolver does,
  and its result to 0.25–4, so a hostile hall cannot ask for a strip
  30,000 px tall. A small
  error boundary around the drawing (98eb915) keeps that placeholder,
  with "The temple hall could not be drawn.", when the chunk fails to
  load or the renderer throws, instead of reaching `DocRender`'s
  whole-document boundary; it tries again when it is given another
  hall, since the editor keeps one node view while the hall is edited.
  The server renders the drawing; being larger than React's progressive chunk
  (12.8 KB), it follows the placeholder in the same response and React's
  inline script swaps it in, and hydration keeps it. The labels'
  `@font-face` rules go in one `<style href precedence>` per page, which
  React hoists and dedupes, rather than into each SVG, so a future reader
  export starts font-free. The footnote plan does not walk a hall's rows.
  `GD_HALL_FONT_BASE` moved to `src/app/gd/hall/fontBase.ts` so the
  export code stays out of the chunk. Tests alias `next/dynamic` to the
  `app-dynamic` module Next compiles it to in the app directory.
- **The editor atom** draws the row `semanticToJrt` compiles for the
  subtree (`gdHallRow`), so the editor draws what the reader will, and
  nothing while a pasted copy's IDs await repair. A transaction filter
  (cc5e413) refuses a paste or drag that would put a hall where it may
  not stand, as another keeps tasks out of tasks, and the clipboard's
  parse rule refuses a pasted hall whose rows break the shape rule
  (0e2b46e). Hall diagnostics from `validateHall` were not shown yet;
  stage C shows them in the Pug source editor (Stage C notes).
- **The Neophyte Dadouchos** moved to x = 14.75, not the 14.9 proposed
  (Decisions before stage B).

**Review fixes for stage B** (the Fable final and Opus independent
reviews, 18 October 2026; the branch was rebased onto `main` at
2468cff, past the Loom 2.0.0 upgrade, first):

- Pug keywords as hall tags (M1, both reviews): reserved (decision 2),
  folded into 347fe2b. They reached the compiler through a crafted
  paste, the text projection, semantic JSON or a JRT import, and their
  printed lines did not parse back.
- No rule on where a hall may stand (Opus m3; Fable m3, which asked
  for the rule, is superseded by it): decision 2's placement rule,
  folded into 347fe2b; the visual editor's filter (cc5e413).
- A legacy `toString` row crashing the reader (Opus m1): d7dce07.
- The hall package's reserved lists behind the compiler's (Opus m2):
  1cdb45a, with `src/doc/gdHallReserved.test.ts`, which reads the
  compiler's lists from `semantic.ts` and expects both validators to
  refuse every name either reserves.
- No error boundary around the lazy drawing (Opus m4): 98eb915.
- The fixed 3:4 placeholder (Opus m5): 83b2211.
- Trailing spaces after a hall tag refused (Opus n1): 34f24ff.
- Recorded in decision 2: a second diagram root is another identity
  change (Fable m1), images in halls need an inventory and an identity
  change (Fable m2), and why reverting invalidates nothing (Fable n2).

**Final review fixes for stage B** (a Fable review of the fixed branch,
18 October 2026; the branch was rewritten again so that it still
changes the compiler identity once, and every rewritten commit was
gated again):

- A tag beginning with `doctype` (M, compiler): Pug's lexer scans
  `doctype` followed by anything to the end of the line, so
  `doctypeX` validated but printed Pug that did not parse back.
  Reserved as a prefix in `semantic.ts` (folded into 347fe2b; the hash
  is now `6b059a0f…`) and in the package's `reservedTag` (folded into
  1cdb45a), with both tests. Every lexer keyword, and the lexer's
  token names, was probed bare and followed by `X`, `s`, `html`, `0`,
  `Y1` and `x`, lower and capitalised, as a leaf and with attributes,
  through the compiler, Pug and the text projection: of 1,260 tags,
  only the lowercase `doctype…` ones validated and then failed to
  round-trip (the other scans match exact words, end at `\b`, or need
  a space or a lookahead).
- `estimateHallAspect` did not clamp coordinates (M): an officer at
  y = 1000 gave 0.0189, a 30,476 px placeholder at 576 px, and
  y = 1e6 none at all. It clamps them to `COORDINATE_RANGE` (moved to
  `dimensions.ts`, re-exported by the vocabulary) and its result to
  0.25–4 (folded into 83b2211); an officer at y = 1e3, 1e4 or 1e6 now
  estimates 0.2670, as drawn, and at x = 1e5 2.9490 (drawn 2.9489).
- Ritual text and U+2028/U+2029 (m, older than halls): its line
  patterns used `.`, so attribute strings, task text and legacy rows
  holding either did not parse back, the typed `Role: text` and
  `* Role text` shortcuts threw on a null match, and so did
  `restoreDraftSourceAnnotations` for such a draft. The patterns use
  the `s` flag (1caf6b7); `ritualText.ts` is not hashed.
- `HallBoundary` never reset (m): it now tries again when its `hall`
  changes (folded into 98eb915).
- Crafted clipboard HTML bypassed the shape rule (m): the atom's parse
  rule validates a pasted hall with its rows (0e2b46e).
- The offline inventory counted the root row (nit, older than halls):
  a 20,000-node document validated but reported `tree-limit`. It
  counts the rows below the root now (4618ca1).
- `-0` coordinates (nit): the compiler keeps them; the visual editor
  must write `0` (Follow-ups).

What was verified, and how:

- **Tests.** The Neophyte hall of decision 3 and the five presets
  round-trip through Pug exactly (print → parse deep-equal, reprint
  byte-identical, IDs and comments kept); 35 hostile inputs are refused
  with the expected message, line and column, and other identifier tags
  and scalars round-trip; semantic JSON hostile shapes are refused; the
  legacy path (`src/doc/fixtures/gdHallNeophyte.pug` through
  `prepare.js` and `semanticFromJrt`) validates and draws the same SVG
  as the compiled rows; the visual editor holds the hall as one atom
  that round-trips through `getJSON` and clipboard HTML, and gives
  duplicated and pasted halls fresh nested IDs once; the reader draws
  the hall lazily, server-renders it and hydrates with no mismatch; a
  ritual holding the Neophyte hall and every preset inventories with no
  issues and no occurrences, plans no assets, and bundles; the boundary
  test sees the hall's code only behind `import()`. After the review's
  fixes, 44 hostile Pug inputs (35 before); the 21 reserved Pug keywords
  refused through semantic JSON, the text projection and JRT import, and
  the 13 unprintable ones shown not to parse back from Pug; halls in a
  note, summary, list item, todo and a note in a task round-trip
  through Pug, the text projection and JRT, draw in the reader and edit
  as atoms, while ten other places refuse them at their line and
  column; the visual editor refuses a hall moved into a task or title
  and accepts one moved into a note; legacy rows typed with six
  `Object.prototype` names render as plain content in and outside
  halls; both validators refuse every reserved name; the placeholder
  estimate holds within 2 % for the presets; a failing or throwing
  drawing leaves the placeholder, the note and the rest of the ritual;
  and spaces after a hall's tags parse as the same hall. The boundary
  test now allows the package's `aspect.ts`, `attributes.ts` and
  `dimensions.ts`, and nothing else of it, in the reader's static graph.
  After the final review's fixes: `doctypeX`, `doctypes` and
  `doctypehtml` are refused on every path and shown not to parse back
  from Pug, and both validators refuse them; the estimate stays within
  0.25–4 and follows the drawing for officers at y = 1e4, ±1e6 and
  x = ±1e5, and for objects at the coordinate range's ends; a hall
  that failed to draw is drawn once it changes, and stays failed
  through a re-render with the same hall; pasted halls holding a text
  row, a reserved tag, a nested hall, an object attribute or a
  reserved attribute are refused, a well-formed one still pastes;
  U+2028 and U+2029 round-trip through ritual text in a hall's
  attribute, an image's, a spoken task, a summary, a title and a
  legacy row, and a draft holding them restores; a 20,000-node
  document validates and inventories completely, and 20,001 rows
  report `tree-limit`. These were checked by tests only, not again in
  the browser.
- **In the browser** (webpack dev server from `gate/gd-hall-b`,
  headless Chromium, the local Creator): a synthetic ritual, "Hall
  check (stage B)" in Fixture Temple, created by pasting the Neophyte
  hall into the creation form's source; the visual and split views drew
  it as one "Temple hall" atom; a reserved attribute typed into the
  saved ritual's source showed "Line 24: reserved hall attribute" and
  disabled Save; Publish ("Published for download") ran the offline
  inventory and bundle on the server; the reader drew it on desktop
  (576 px wide) and phone (358 px, no horizontal scroll) with the hall
  fonts loaded and one font sheet. The only console errors were React's
  `flushSync` warnings from `RitualCreationEditor`'s `setContent` in an
  effect, which a source without a hall raises too (`main` has since
  deferred that `setContent`, 2468cff). The private reader
  renders on the client, so server rendering and hydration were checked
  by the tests only, as was reading the bundle offline (the service
  worker is off in development). The app cannot delete a ritual, so
  the synthetic one stays in the local database. After the review's
  fixes (same setup, port 3093): the reader drew the hall at 576 × 767
  px with the placeholder estimated at 0.7421 (576 × 776 px, 9 px
  taller than the drawing); with the drawing's chunk blocked over the
  DevTools protocol, the placeholder stayed at 576 × 776 px with "The
  temple hall could not be drawn." and the rest of the ritual read on
  (React logged the `ChunkLoadError` as handled by `HallBoundary`). In
  the editor's source, the hall moved into a task showed "Line 5: a
  temple hall cannot stand here" and disabled Save; into a note, the
  visual panel drew it as an atom inside the note, it saved, and the
  reader drew it inside the note on desktop and phone (302 px, no
  horizontal scroll); trailing spaces after the hall's tags raised no
  error; a bare `each` in the hall showed "Line 6: invalid Pug syntax".
  The ritual's source was then restored and saved as it was. Apart from
  the blocked chunk's error, the console showed only the dev server's
  font-preload notice and the source editor's existing "Unknown
  highlighting tag" warnings.
- **Production build** (webpack; first measured on the compiler commit
  before the review's fixes were folded in): the hall's code (renderer,
  layout, app and legacy art, chalice included) is one 260 KB chunk that
  the client reference manifests of the reader (`/doc/[_id]`), the
  editor and the offline reader do not list; they hold only the 25 KB
  chunk with `GdHallFrame`. The react-loadable manifest gives
  `GdHallDrawing` that chunk, a 480-byte entry, two shared chunks and
  the Enochian `@font-face` CSS, so only a ritual that draws a hall
  loads them; `/gd/hall` imports it directly. All of them, and the three
  hall font subsets, are in the service worker's precache. The
  Turbopack build and the data package's smoke test pass too. The
  `GdHallFrame` chunk was 25,037 bytes (10,199 gzipped) on the compiler
  commit and 28,673 (11,710) with the first review's fixes, the
  placeholder estimate and the error boundary added (both measured
  before the final review's fixes were folded in), and is 28,864
  (11,792) at 4618ca1; the drawing's own entry is still 480 bytes.
- **Corpus.** `scripts/audit-ritual-corpus.ts` over a synthetic corpus
  (the three built-in docs as legacy and as semantic sources, a semantic
  hall ritual, and the legacy hall with and without a `//-` comment
  inside it): all lossless and visual except the legacy hall with the
  comment, as expected (Importing compiled rows). No private corpus was
  read.
- **Documentation screenshots** of the editor, reader, ritual list and
  creation form, recaptured from this branch: byte-identical (no shown
  ritual holds a hall).

## Stage C notes

Settled while building stage C (18 October 2026), where the plan or the
brief left a choice or proved wrong:

- **Where the command lives.** "Temple hall" joins the slash menu
  (`ritualSlashCommands.ts`, plan 055's registry) and the toolbar's
  Insert… dialog, the established place for structures (plan 054).
  Choosing it in the slash menu lists the five presets by title and
  grade ("Zelator Temple 1 · 1=10, part 1"), as Speech lists roles; a
  grade typed straight after the slash (`/zel`, `/theo`) lists its
  halls too, labelled "Temple hall · …". The dialog takes a preset from
  a second select. A titled list, not thumbnails: no picker in the
  editor draws previews, and a drawn picker would load the hall art
  before anyone asked for a hall. The empty-line hint keeps naming the
  everyday commands only ("Type / for speech, action, note or section
  title"), so the documentation screenshots did not change.
- **Copies.** Both insert `gdHallPresetAtom(preset)` (`gdHallInsert.ts`):
  the preset through `gdHallSource`, every node with a fresh ID, as one
  atom in one transaction, so one undo step (decisions 3 and 10).
- **Placement (decision 2).** The slash command replaces its command
  paragraph where a hall may stand (the top level, or directly in a
  note, summary, list item or todo), or, from the last paragraph of a
  task whose own container may hold a hall, becomes the task's next
  sibling, as Speech and Action do. Anywhere else it is not offered:
  a title, a list itself, a footnote (collected footnotes have no
  blocks), the middle of a task, a paragraph that already holds text.
  In a list item, where Speech and Action are not offered (plan 050),
  it is the only command. So it never makes a hall the validator
  refuses, and never meets the transaction filter of stage B. The
  toolbar always finds a place: after the block holding the cursor, at
  the nearest level where a hall may stand (after a task, a title or a
  list; after the paragraph inside a note), replacing an empty
  paragraph there (`gdHallInsertionRange`).
- **The caret goes after the hall**, to the start of the paragraph that
  follows it or into a new empty one, which the semantic document does
  not keep (an empty paragraph between blocks, or at the end of its
  container, projects to nothing). The first build selected the hall
  instead, so the first character typed would have replaced it; the
  author goes on writing after the hall instead. Immediate Backspace or
  one undo brings the literal command back. That first build also met a
  wider bug, first read here as a mount-time selection loss: after a
  hall selected right after another atom, the next keystrokes in
  headless Chromium 153 went into the ritual's title. The review found
  the cause (Stage C review fixes): the DOM selection of any selected
  block spans an uneditable element with no caret position, Chromium
  moves input that ProseMirror leaves to it to an editable position of
  its own choosing, and ProseMirror reads that back. Clicking a hall to
  select it is unchanged.
- **Source view.** The source editor has no snippets or completion
  (`basicSetup` with the legacy Pug mode supplies none), and none was
  added. The `/gd/hall` gallery has a "Copy Pug source" button instead
  (`gdHallPug`): the preset printed by the ritual printer, one node per
  line, without the source header and without IDs. `parseRitualPug`
  gives a node without an ID a fresh one, so the same text pastes any
  number of times without duplicate IDs. It is for the top level;
  indented, it goes in a note, summary, list item or todo. The printer
  and the Pug parser load after the gallery page, so its bundle does
  not carry them, and the copy happens inside the click. The Ritual Pug
  guide (`/help/ritual-pug`) describes the command, the button and the
  warnings.
- **Hall diagnostics (decision 2's promise; a stage B follow-up).**
  `validateHall`'s findings show in the Pug source editor as CodeMirror
  warnings beside the source errors of plan 044: yellow underlines,
  gutter markers, F8 and Problems ("Temple hall" as their source).
  Hall errors (a tag that cannot stand there, a missing kind) are shown
  as warnings too, since the compiler accepts the hall and saving is
  never blocked; they do not set `aria-invalid`, and "Go to error"
  reads "Go to warning" when only warnings remain. A source error
  replaces them, as the source no longer parses. `gdHallSourceWarnings`
  (`gdHallDiagnostics.ts`) parses with the parser's location map
  (`parseRitualPugWithLocations`, new), compiles each hall to the row
  the reader draws, validates it with the app's art registry (so the
  legacy items count as known), and walks each diagnostic's path from
  the hall to its node, skipping source annotations as the compiled
  row does. A diagnostic naming an attribute points at the attribute's
  name: the parser now records attribute positions, for hall nodes
  only (`RitualSourceLocation.attributes`); otherwise the tag. Exact
  locations proved cheap, so nothing falls back to the hall's line
  except a diagnostic the walk cannot place (none known). At most 100
  are shown, then one line says how many more. The validator and the
  hall art load lazily, 300 ms after typing stops and only for source
  that holds a hall, so other rituals' editors never fetch them; the
  check then waits for idle time (Stage C review fixes). Ritual Text
  shows none: in the semantic editor it is only the dialect of a
  recovered draft, converted to Pug as soon as it parses, and the
  creation editor is Pug only.
  Neither `ritualPug.ts` nor `ritualSourceDiagnostics.ts` is hashed:
  the compiler identity is unchanged (`6b059a0f…`).
- **Not built here:** the visual sub-editor (stage D) and the
  `/gd/hall` editor (stage E). The warnings show only in the Pug
  source panel; a visual-only author sees none (Follow-ups).

What was verified, and how:

- **Tests.** Every preset inserted by the slash command validates,
  draws what the preset draws (its compiled row equals the preset's
  through `gdHallSource`), has a fresh, valid, unique ID on every node
  (and two copies share none), prints and parses back through Pug
  exactly, holds no `-0`, and goes back to the literal command with
  one undo; immediate Backspace does the same. Placement: the command
  puts the hall at the top level, in a note, summary, todo and list
  item, after a task from its last paragraph (also inside a note), and
  is not offered in the middle of a task, in a title, in a list
  itself, after text or in collected footnotes; in a list item it is
  the only command; `/zel` and `/hall theo` filter the presets. The
  toolbar: an empty paragraph is replaced, otherwise the hall goes
  after the paragraph, task, title or selected block, inside a note it
  stays in the note, and the dialog lists the presets and inserts one
  in one undo step. Diagnostics: an unknown attribute at its name, an
  unknown tag at the tag, a clamped value past comments and folded
  IDs, halls at the top level and in a list item, a hall-wide value at
  the hall's attribute, none for the five presets or for source that
  does not parse, the cap of 100 with its count; in the real
  CodeMirror editor a warning underlines the attribute, leaves
  `aria-invalid` false, offers "Go to warning" and Problems, and gives
  way to a source error. `gdHallPug`: every preset parses back to
  itself with no `#` in the text, pastes twice without shared IDs, and
  indents into a note; the gallery copies the shown preset, clears the
  status for another, reports a refused clipboard, and keeps the
  button disabled when the printer cannot load.
- **In the browser** (Turbopack dev server from this branch on port
  3141, headless Chromium 153, the local Creator; synthetic data
  only): in "Hall check (stage B)" (Fixture Temple), `/hall` listed
  the five presets by title and grade above the line; all five were
  inserted in a row at the end of the ritual, each drawn as its
  preset in the visual and split views and printed in source (194
  lines); Save ("Saved and published for download."), and the reader
  drew all six halls. An unknown attribute and an unknown tag typed
  into the source showed as two yellow warnings at `colour` and
  `unicorn`, listed in Problems as "Temple hall", with "Go to
  warning", `aria-invalid` false and Save enabled; it saved, the
  placeholder drawn. The Insert… dialog with the caret in the first
  speech put Zelator 2 after that speech, and Undo brought back the
  saved state. On `/gd/hall` the button copied the Neophyte as 29
  lines without IDs ("Copied. Paste it into a ritual's source."); at
  390 px the page has no horizontal scroll. The ritual's source was
  then restored and saved as it was; it reads with its one hall. The
  first build's node selection lost the selection as described above,
  which is how it was found. Console: only the existing "Unknown
  highlighting tag" warnings. Once, a navigation straight after a save
  showed "Editor access could not be verified. Reconnect and reload
  to try again."; a reload opened the editor. Screenshots are outside
  the repository.
- **Production build** (webpack): `gdHallDiagnostics` is its own
  1,182-byte chunk (773 gzipped), loaded with the hall code's shared
  265 KB chunk only through the react-loadable entry
  `RitualSourceEditor.tsx -> ./gdHallDiagnostics`; the editor's and
  the reader's client reference manifests do not list it. The
  gallery's printer loads through `gallery.tsx -> @/doc/gdHallPug`;
  the chunk holding the Pug parser (13.9 KB) is not in `/gd/hall`'s
  client reference manifest.
- **Documentation screenshots**, recaptured from this branch
  (`DOCS_SCREENSHOTS_ORIGIN=http://localhost:3141`): the editor and
  reader shots are byte-identical. `join-code` changed only by the
  origin's port in its link, and `members` only by the order of six
  members added on the same day; neither is a stage C change, so both
  were left as committed (Follow-ups).

## Stage C review fixes

An independent review of stage C (d1aaf33..46debf8) found one major
problem and five smaller ones, fixed on `gate/gd-hall-c` on 18 October
2026:

- **Text without a keypress over a selected block (major; 98f4ffa).**
  With a hall, or any other block, node-selected beside uneditable
  neighbours, text that arrives without a keypress (an IME, a virtual
  keyboard, dictation, a spelling replacement, CDP's
  `Input.insertText`) went elsewhere: to the start of the ritual's
  title between two halls or two rules, to the end of the task before a
  hall after a task (the reviewer once saw a new task copying that
  task's `say` and `role` instead, the same mechanism), and so for a
  hall just pasted at the end of the ritual. It predates stage C.
  ProseMirror types over a block selection only in its keypress
  handler; other input is left to the browser and read back from the
  DOM. A selected block's DOM selection spans a `contenteditable=false`
  element with no caret position, and Chromium moves the input to an
  editable position of its own choosing, sometimes moving the DOM
  selection itself before the input event, which ProseMirror then reads
  as an edit there. `RitualSelectionInput` (`ritualSelectionInput.ts`,
  in the visual editor's client extensions) handles the selection
  ProseMirror holds, a selected block or a gap cursor: it cancels
  `beforeinput` for `insertText` and `insertReplacementText` and types
  the text as the keypress handler does (`handleTextInput`, else
  `tr.insertText`), so the block becomes a paragraph holding the text,
  as a real key press makes it, in one undo step; an IME's first keydown
  (key code 229) replaces the block with the empty paragraph typing
  would make, caret inside, before the composition starts (composition
  text cannot be cancelled), and `compositionstart` without that
  keydown does the same. In headless Chromium 153 (Turbopack dev
  server on port 3157, the local Creator, "Hall check (stage B)", each
  case on a freshly loaded editor, nothing saved), CDP
  `Input.insertText` over a hall next to a hall, a rule next to a rule,
  a hall after a task, a hall just pasted at the end, and a gap cursor
  between two halls put the text in a new paragraph in the block's
  place, the title and the tasks (with their roles) unchanged; before
  the fix the same steps put it at the title's start (halls, rules,
  paste) or the end of the task before (a hall after a task). An IME
  composition sent as real IMEs send it (a key code 229 keydown, then
  `Input.imeSetComposition` and a commit) did the same and ended
  cleanly; CDP key presses went into the new paragraph as before.
  Without the keydown, a composition over a hall or rule next to
  another reached the new paragraph but did not end cleanly in
  Chromium (the commit added to the first update, and ProseMirror
  stayed composing): CDP's composition without a keydown is the only
  way seen to reach that, as real IMEs send the keydown (Follow-ups).
  In 3 of 28 fresh runs (hall or rule next to another), a CDP key
  press shortly after selecting went into the title, with or without
  the fix: Chromium had moved the DOM selection before the keydown and
  ProseMirror read it (Follow-ups). Tests
  (`ritualSelectionInput.test.ts`, jsdom): each input type over a hall
  next to a hall, a rule next to a rule and a hall after a task gives
  the document `tr.insertText` gives, at a gap cursor too, in one undo
  step; text in text, a read-only editor and other input types are left
  alone; the keydown and `compositionstart` open the paragraph, other
  keys and shortcuts do not. The comment on `caretAfterGdHall` names
  the real cause; the caret still goes after a new hall.
- **Warnings for Pug only (minor).** The commit and these notes said
  "the source editor shows hall warnings"; they show for Pug. Ritual
  Text is only the dialect of a recovered draft in the semantic editor,
  converted to Pug once it parses (`applySource`), and the creation
  editor is Pug only, so no location mapping was added for it; the
  wording above says Pug.
- **The warnings' second parse (minor; 5a2b847).** On a synthetic
  74 KB ritual with 20 halls (978 lines; the five presets four times,
  each followed by 17 speeches), the warnings were one main-thread task
  of 63–83 ms in headless Chromium, nearly all of it the parse
  (`parseRitualPug` alone: 82 ms in Node, `gdHallSourceWarnings` 77 ms),
  and in four of four measured keystrokes it ran before the semantic
  editor's own parse and visual update (about 600 ms of work), delaying
  it. Reusing the editor's parse is not cleanly reachable: the semantic
  editor parses only dirty source, without locations, its 200 ms
  debounce fired after the warnings' 300 ms one in every measured case,
  and a visual edit reprints the source without parsing it. The check
  now waits for idle time after the pause (`requestIdleCallback`, at
  most 2 s; a later task where it is missing): in two of four measured
  keystrokes it then ran after the visual update. The work is
  unchanged (Follow-ups). Tests: the scheduling, a result for source
  that changed while it waited, older warnings while newer source
  waits, unmounting before or after the import, and the fallback.
- **Insert… with a wide selection (minor; 3016669).** With Select All
  the toolbar put the hall before the title, and a selection across
  blocks put it inside the selection. `gdHallInsertionRange` counts
  from the selection's end when its ends lie in different blocks, so
  the hall goes at the end of the ritual for Select All, after the
  block holding the end otherwise. In Chromium, Select All then Insert…
  → Temple hall put the Neophyte at the end, the title unchanged, and
  one undo removed it.
- **Copy Pug source (nit; 9923d1e).** A printer error reads "Could not
  copy: this hall could not be written as Pug." and leaves the
  clipboard alone; a printer that cannot load leaves a note beside the
  disabled button, which shows no tooltip.
- **Tests for the warnings' guards (nit; 5a2b847)**, as above.

The documentation screenshots of the ritual list, creation form,
editor and reader were recaptured from this branch
(`DOCS_SCREENSHOTS_ORIGIN=http://localhost:3157`) and are
byte-identical; `editor-visual` timed out once waiting for the editor
and was captured on a second run.

## Stage D notes

Settled while building stage D (18 October 2026), where the plan or the
brief left a choice or proved wrong:

- **Where it lives, and its API.** `src/doc/gdHallEditor/` (AGPL, beside
  the semantic model it edits): `GdHallEditor` takes `hall`, the
  semantic `gdHall` element with its subtree and IDs as source holds it,
  `art` (the app's `gdHallArt`), and calls `onChange(nextHall)` once per
  completed gesture, with `onDone`, optional `onUndo`/`onRedo` (the
  host's history), `editable` and `createId`. It holds no document and
  no history: stage E mounts it with a playground's own. A host may
  return `false` from `onChange` to refuse a hall; until the host gives
  a new `hall` back the editor shows the one it sent, since the ritual
  editor's node view draws a frame later and a second key press must
  build on the first. Pure modules beneath it, each tested alone:
  `hallModel.ts` (index by ID and by compiled path, immutable edits,
  copies with fresh IDs, `normalizeHall`), `hallGeometry.ts`
  (conversion, snapping, rounding, hit-testing), `hallEdits.ts` (one
  function per gesture, returning the same hall when nothing changes)
  and `hallPalette.ts`. The panel is `HallProperties.tsx`.
- **The resolver reports frames.** Each resolved object now carries its
  frame (origin, floor squares per frame unit), the `x` and `y` that
  place it where it is drawn (offsets from `at` where it has one, a
  row's spread position otherwise) and the scale it is drawn at; doors
  carry their path (447f30a). The editor therefore never lays a hall
  out twice to learn where a node's values come from. Additive; the
  preset snapshots are unchanged.
- **In the ritual editor** (`GdHallAtomEditor.tsx`, loaded only on
  "Edit hall"): the atom shows its drawing and an Edit hall button;
  editing happens in place, full width, the panel beside the drawing
  from 720 px of container width and below it under that (a container
  query, so the split view stacks too); Done or Escape with nothing
  selected leaves, the focus going back to Edit hall. Each gesture is
  one `setNodeMarkup` with history closed before and after (the Task
  settings pattern), refused when the atom moved, changed identity or
  would not be valid source. The atom's node view stops ProseMirror's
  handling of every event inside `[data-gd-hall-controls]` (the button
  and the editor), so the atom is never node-selected, neither on entry
  nor on a press, ProseMirror's own handlers never see the editor's
  keys, and `RitualSelectionInput` never sees text typed in the panel
  (it reaches the field; the ritual's title is unchanged). That did not
  keep the browser's clipboard actions away from the ritual, which
  follow the page's text selection rather than the focus: Ctrl+X in the
  editor cut ritual text until the review fixes (Stage D review fixes,
  M2). Undo and redo inside the editor are the ritual editor's. While
  the editor takes no changes (a source sync, a save) the hall shows
  read-only with a note.
- **Selection.** By click or tap, hit-tested on the resolver's boxes (at
  least 0.6 squares across), labels and free text, topmost first (a
  host's children over the host; labels and free text, drawn above
  every object, before any object since the review fixes); doors by a
  band across their wall line; empty floor clears it. Tab and Shift+Tab walk objects and doors
  in document order and leave the drawing past either end, so the
  keyboard is never trapped. The selection is a dashed outline, its
  labels highlighted. The drawing is `role="application"`, described
  with what is selected (labelled with it until the review fixes), and
  a polite live region says what each gesture did ("Moved Hegemon to
  x 9.5, y 3").
- **Coordinates.** A drag in floor squares is divided by the node's
  frame unit: floor squares on the floor and in rows, the host's
  unscaled squares for its children (twice as far on an altar at
  scale 2), offsets from `at` with `at` kept. Values snap to half units
  of that frame unless Alt is held, then round to two decimals; an axis
  the pointer moved less than a quarter unit along is not written (a
  sideways drag does not snap the other value); values are clamped to
  `COORDINATE_RANGE`, doors to their wall's 0–16 along it, and `-0` is
  written as `0`. Arrow keys add half a unit (Shift: one) without
  snapping. Scale handles scale with the pointer's distance from the
  centre; `+` and `-` multiply by 1.1 (at least 0.01); both round to two
  decimals within `SCALE_RANGE`. Free text has no scale. **Rows:** a
  dais or banner child without `x` gets one when moved along the row
  (and `y` across it), which takes it out of the spread: the row's other
  children spread again without it. Writing explicit positions to its
  siblings instead would keep them still but change nodes the author
  did not touch; left for Gadi (Follow-ups). A copy of a row child gets
  its own position, so the row does not move.
- **Drags** use pointer events with capture, a 4-pixel threshold, a
  preview laid out once per animation frame, and one write on release;
  a cancelled pointer writes nothing. Since the review fixes a drag is
  applied, by node ID, to the hall the editor holds at release, with
  the drawing's view box held for its duration (Stage D review fixes). On touch the pointer lands on
  HTML boxes over the objects and handles with `touch-action: none`:
  Chromium ignored `touch-action` on SVG shapes (a touch drag on an
  officer was taken for a pan and the pointer cancelled), while a touch
  on the empty floor still scrolls. Chromium applies the most restrictive
  action under a touch's area, so a pan begun within a few pixels of an
  object does not scroll (seen with CDP touches of radius 4).
- **Handles** are 10 pixels drawn and 22 to grab with a mouse, 16 and 40
  on a touch screen, placed just outside the corners so a small object
  stays draggable. On a touch screen an object narrower than one and a
  half handles shows none (a finger-sized handle covered a cup and took
  its drags); the panel's scale field and its − and + buttons are the
  alternative (plan 050's rule), as the panel's fields and its Duplicate
  and Delete buttons are for the keys.
- **The panel** is generated from `hallTagSpec`, the art's attributes
  included: enums as selects (with "Default", which removes the
  attribute), numbers and strings typed and written when the field is
  left or Enter pressed (one change each, a bad or out-of-range number
  refused with a message), booleans as switches; an officer's `role`
  and an item's `kind` as named choices, an unknown value kept
  choosable; `form` only for a cross and `dir` only for a triangle unless
  set. Position, scale and the label come first; `x` and `y` show where
  a node without them stands as a placeholder. An emptied field removes
  its attribute (so an officer's emptied label shows its role again).
  With nothing selected it edits the hall: its attributes and its
  caption. Attributes the vocabulary does not know are listed, for the
  source.
- **The palette** offers every officer role (the lamens' and the
  adepts'), a marker, the altar, both pillars, a platform, a throne, a
  door, both banners, a Hebrew letter, every item kind the art draws
  (the package's and the legacy ones), a tarot key, a tablet, the Table
  of Shewbread, the candlestick and free text. A new object goes into
  the floor (made before the caption if missing) a square past the
  selection's South edge, or at the floor's centre, moved South a square
  at a time until it is clear of other objects, on half squares; with a
  host selected, items, tarot keys, text and markers go onto any host
  (an altar, platform, throne or board) and officers onto a platform or
  throne, at its centre; a door goes into the West wall. It is selected,
  with fresh IDs, and the focus returns to the drawing.
- **Writes** go through `normalizeHall`: numeric and boolean strings
  from the legacy path become numbers and booleans where the vocabulary
  expects them (decision 12), `-0` becomes `0`, and every node gets
  `children`, so leaves print in the bare form presets use (Stage B
  notes). Comments in a hall are kept and skipped when mapping compiled
  paths to nodes. Copies and new nodes get IDs from the ritual editor's
  `createRitualNodeId`. The compiler is untouched: `semantic.ts`,
  `semanticCompile.ts`, `semanticCompilerImpl.ts` and `ritualNodeIds.ts`
  have no diff, so the identity stays `6b059a0f…`.
- **Warnings** (a stage C follow-up): `validateHall` runs on the edited
  hall and lists up to 20 findings under the drawing, then a count;
  choosing one selects the object it names or its nearest drawn
  ancestor. They show in edit mode only: drawing them on the plain atom
  would load the validator for every ritual with a hall (Follow-ups).
- **Not built:** reparenting. Dropping onto a host needs a rule for
  intent (an officer dragged across the altar would land on it), and
  the palette's host rule covers adding to one; left for later
  (Follow-ups). Nor is a label child of an object editable apart from
  it, except in the source.

What was verified, and how:

- **Tests** (96 new, in `src/doc/gdHallEditor` and
  `src/doc/ritualBlocks/GdHallAtomEditor.test.tsx`, with the resolver's
  new fields in `layout.test.ts`): conversion, snapping and rounding on
  the floor, on a scaled host, with `at`, in a row, at the range's ends
  and around `-0`; door moves; scale by handle and by step; hit-testing
  of hosts' children, labels, free text, minimum sizes and doors;
  document order; the model's index (comments skipped), edits, copies
  and normalisation; every gesture and its no-op; the palette's
  entries (each added to the Neophyte hall and drawn), placement on the
  floor, beside a selection, on hosts, a door, a missing floor; the
  component in jsdom: focus on entry, Tab cycling and leaving, Escape
  twice, every key as one change, drags as one change with a live
  preview, Alt, cancel, thresholds and frames, handles, panel fields
  (bad, out of range, emptied, text, switches, selects, unknown roles,
  the hall and its caption), buttons, palette, warnings, a refusing
  host, an undo removing the selection, the touch-screen handle rule,
  read-only; in the ritual editor: entry without selecting the atom,
  keys as one undo step each through the editor's history, Delete on an
  object leaving the hall, Done restoring focus, read-only while not
  editable, the write's refusals and the node view's event filter. A
  randomised test applies 120 seeded operations (moves, nudges,
  scales, steps, deletes, copies, palette insertions, panel values from
  each attribute's spec, strings with quotes, backslashes, newlines,
  U+2028, Greek, Hebrew and emoji) to each of the five presets,
  normalising after each as the editor does, and checks after each
  change (100 to 115 per preset) that the hall validates, prints to Pug
  and parses back deep-equal, reprints byte-identically, and has
  unique valid IDs and no `-0` or non-finite number.
- **In the browser** (Turbopack dev server from this branch on port
  3171, headless Chromium, the local Creator; "Hall check (stage B)" in
  Fixture Temple, restored and saved as it was afterwards). At
  1440 × 900: Edit hall focused the drawing and left ProseMirror's
  selection as it was; a click selected the Hegemon; a drag 1.3 squares
  South previewed and wrote x = 9.5 (y unchanged), one undo step; the
  black pillar's corner handle scaled it to 1.25; Right, Right and
  Shift+Down moved it to (5, 4); "Boaz" typed into its label field went
  to the field (the title unchanged); Add → Cup put a cup at (7.5, 4),
  selected, the drawing focused; Ctrl+D copied the Hegemon to
  (10, 3.5), Delete removed the copy, Ctrl+Z brought it back and
  Ctrl+Shift+Z removed it again; a marker emptied of its text showed
  "marker: no text", which selected it; Done gave the focus to Edit
  hall; the ritual saved, the source kept the comment in the floor and
  the IDs, and the reader drew the edited hall. At 390 × 844 with touch
  emulation (CDP touch events): no horizontal scroll in the editor or
  the reader; a tap selected; a touch drag moved the Hegemon to
  (10, 4); the panel stood below the drawing; the panel's + scaled the
  pillar to 1.1; Add → Cup added a cup with no handles over it; saved,
  read. Before the HTML hit boxes, a touch drag was cancelled as a
  pan (above). Console: only the source editor's existing "Unknown
  highlighting tag" warnings. Screenshots are outside the repository.
- **Documentation screenshots**, recaptured from this branch
  (`DOCS_SCREENSHOTS_ORIGIN=http://localhost:3171`): the editor and
  reader shots are byte-identical (none shows a hall); `join-code`
  changed only by the port in its link and `members` only by the order
  of members added on the same day, as in stage C, so both were left as
  committed.

## Stage D review fixes

An independent Opus review of stage D (a783911..a0d791d) found three
major problems, six smaller ones and nine nits; a final Fable review
confirmed the third and added four more. All were fixed on
`gate/gd-hall-d` on 18 October 2026, in five commits on top of a0d791d
(none of stage D's commits rewritten). Each new test fails on the
commit before its fix, unless said otherwise.

- **A drag reverted edits made before or during it (M1; bc6db42).** A
  gesture kept the hall laid out when the press began and wrote a
  whole hall built from it on release. The press itself blurred a
  panel field, which wrote its value in that same event, after the
  hall was captured, so a label typed and then an object dragged lost
  the label; an undo or Delete during the drag was undone by the
  release, which brought back the deleted node; a hall from the source
  mid-drag was overwritten. A gesture now records its node ID, where it
  began and the view box, and each preview and the release apply the
  move or scale by node ID to the hall the editor holds at that moment
  (the one it last sent, which a change updates at once, or the
  host's). Keys, buttons and fields do the same. A gesture ends
  without writing on Escape, undo, redo, Delete, a lock, a hall from
  the host other than the echo of the one sent, or its node going;
  other keys wait for the release. The hall sent is dropped on any new
  hall from the host, even one identical to the hall it was built on
  (an undo gives that back). Tests: a field typed then a drag, a
  position typed then a drag (a square from the typed value), undo,
  redo, Delete and Escape during a drag, keys during a drag, a hall
  from the host, a lock, a node gone.
- **Ctrl+X in the hall editor cut ritual text (M2; 0c5b352).** The
  drawing takes the focus but is not editable, and Chromium leaves the
  page's text selection in the ritual and sends cut, copy and paste
  there; ProseMirror owns that selection and deleted the text. The
  drawing now clears the page's text selection when it takes the focus
  (on entry and on any later focus), if the selection lies outside the
  editor. Only the DOM selection goes: ProseMirror keeps its selection
  state (nothing is dispatched, nothing scrolls) and restores it when
  the ritual is focused again, as Done then a click or Tab into the
  text does. The drawing also cancels Ctrl/Cmd+X, C and V (no object
  clipboard yet); the panel's fields keep theirs. The jsdom test
  recreates Chromium's selection (jsdom itself moves the selection into
  a focused element) and its choice of target for a cut.
- **Undo and redo while the ritual was locked (M3; 3476c25).** They
  were handed to the ritual's history before the lock was checked, so
  an undo while a source sync or save held the ritual moved the visual
  document under the source panel ("Both panels changed"). The editor
  ignores them while locked, and the host's undo and redo check the
  editor (and the ritual it projects) themselves. They now use
  `undoNoScroll` and `redoNoScroll`, so an undo from the hall editor
  does not scroll the ritual to its caret (m1).
- **Writes while locked, and writes that never landed (Fable (a), (b);
  m2, m3; 3476c25).** A gesture ending as the host locks is dropped;
  `writeHallToAtom` refuses while the editor or the ritual takes no
  changes, and confirms after dispatching that the atom holds the new
  attributes and children: a plugin's `filterTransaction` (the hall
  placement rule drops every write while any hall stands where it may
  not) dropped the write silently, and the editor went on showing a
  hall the ritual did not have. A change the host does not take leaves
  the host's hall shown and says "That change was not made; the hall
  is as it was." under the drawing and in the live region; a refused
  field shows the hall's value again with "Not written".
- **The atom's lock state (Fable (c); 3476c25)** read the ritual
  owner's `isEditable` while subscribing only to the editor's own
  updates; it now subscribes to each.
- **Ctrl+S saved without the value being typed in a field (m4;
  522d4bb).** A field writes its value when left, and Ctrl+S does not
  leave it, nor does a Save button that does not take the focus
  (Safari's). Fields register a flush in `src/doc/pendingEdits.ts`;
  the semantic editor's Ctrl+S and Save write pending values first
  and, when one changed the document, save at the next render through
  the queue Ctrl+S already used for source being applied.
- **A field disabled while holding typed text (Fable (d); 522d4bb).**
  Chromium drops the focus of a field disabled by a lock without a
  blur, so the text stayed unwritten while looking written. The field
  keeps it while locked and writes it on unlocking, as leaving the
  field would have; a hall changed under it during the lock replaces
  it.
- **The drawing rescaled under a drag (m5; bc6db42).** The view box
  includes every object, so a drag past the edge grew it, the drawing
  shrank under the pointer and the page height jumped. The view box is
  held for the gesture: the drawing stands in a frame of the held
  proportions, placed within it, and takes its new extent on release.
- **A second touch took over a drag (m6; bc6db42):** other pointers
  are ignored while a gesture runs.
- **Nits (3e1cb42):** labels and free text are hit before any object,
  as they are drawn above them; a switch put back to its default
  removes the attribute (glow off, compass on); a one-sided bound reads
  "At least 0" or "At most 4"; the drawing takes the focus on arriving
  only if the focus is nowhere or in the editor (an author who moved
  on while the chunk loaded keeps their place); Edit hall stays,
  disabled, while the ritual is locked; the handles follow
  `(pointer: coarse)` as it changes; the drawing's name no longer
  changes with the selection (screen readers announced it with the
  live region on every Tab), the selection being in its description;
  the reader import-boundary test forbids the hall editor's modules;
  a stale comment goes.

What was verified, and how:

- **Tests:** 26 new and 4 extended (in `GdHallEditor.test.tsx`,
  `GdHallAtomEditor.test.tsx`, `hallGeometry.test.ts` and
  `SemanticEditor.test.tsx`, where a hall field typed in and then
  Ctrl+S, or Save pressed without taking the focus, is saved). The
  compiler is untouched: `semantic.ts`, `semanticCompile.ts`,
  `semanticCompilerImpl.ts` and `ritualNodeIds.ts` have no diff.
- **In the browser** (Turbopack dev server from this branch on
  127.0.0.1:3187, headless Chromium, the local Creator; "Hall check
  (stage B)" in Fixture Temple, restored and saved as it was
  afterwards). The dev server must listen on 127.0.0.1 (`-H
  127.0.0.1`), or Next blocks the page's dev resources there and it
  never hydrates; signing in on 127.0.0.1 then works and leaves a
  `localhost` session alone. At 1440 × 900: "Jachin" typed into the
  black pillar's label, then the Hegemon dragged: the source had both,
  one Ctrl+Z took back only the drag; Ctrl+Z during a drag undid the
  previous nudge and the release wrote nothing; Delete during a drag
  removed the Hegemon and the release did not bring it back. With "Let
  the hall be prepared." selected in the ritual, Edit hall left no
  page selection (ProseMirror's kept), and Ctrl+X, C and V left the
  ritual's text as it was; Done gave the focus to Edit hall with
  ProseMirror's selection unchanged. In split view, with the source
  made invalid (the visual panel locked), Ctrl+Z and Ctrl+Y in the
  hall editor changed nothing and no "Both panels changed" appeared.
  A label typed and Ctrl+S pressed in the field: the saved revision
  has it. Escape mid-drag wrote nothing; a corner handle scaled; Add
  → Marker, its text emptied, the warning selected it; Undo, Done.
  At 390 × 844 with touch: a tap selected, a touch drag moved the
  Hegemon a square, the panel stood below, no horizontal scroll; at
  that width only objects at least about 3.25 squares across have
  room for finger-sized handles (the platform after + twice). The
  reader was not checked: the minimal local environment (database and
  local sign-in only) has no publication storage, and publication
  answers 503, so the reader has no ritual to show; no reader code
  changed. Screenshots are outside the repository.
- **Documentation screenshots** were not recaptured: the capture
  publishes the sample rituals first, which needs the storage the
  minimal environment lacks. No documentation fixture holds a hall,
  and the only change to a screen they show without one is the Save
  button's handler, so they are unchanged by this round.

## Stage E notes

Built on `gate/gd-hall-e` (19 October 2026), from `main` at 837ecc9.
Stage E brought the `/gd/hall` editor and three refinements Gadi decided
for the stage D visual editor on 19 October 2026. Each records what was
settled where the brief left a choice or proved wrong.

### Owner decisions of 19 October 2026: the visual editor

- **Rows reorder, with explicit positions as the fallback.** A `dais` or
  `banners` child that its row spreads (no position along the row, no
  `at`) is reordered by a drag along the row: the others make room as
  it passes their centres, an orange box marks where it will land, and
  the release writes only the new order, so the row keeps its even
  spread. Alt and an arrow along the row (Left and Right for the dais
  and the East and West rows, Up and Down for North and South) move it
  one place, as do the panel's Move left and Move right. An explicit
  position stays possible: an Alt-drag places it freely (Alt already
  meant "no snapping"), and so do an arrow along the row without Alt
  and the panel's `x` (or `y`) field. Giving a spread child a position
  freezes its spread siblings: their current positions are written in
  the same change, so nothing jumps. The panel's **Spread evenly
  again** takes every position along the row away (offsets from `at`
  stay), and shows whenever the row holds one. A position across the
  row (`y` on the dais) freezes nothing. Each is one change and one
  undo step; a copy of a row child still gets its own position. The
  rules live in `hallRows.ts`.
- **Objects stand on hosts and leave them.** What each host takes:

  | Host | Takes |
  | --- | --- |
  | altar | item, tarotKey, marker |
  | platform, throne | officer, banner, hebrewLetter, item, marker |
  | board | marker |

  Labels are not in the table although the brief listed them: a
  `label` under a host labels the host (Stage A1 notes), so a free
  label dropped on one would stop being free text and jump to the
  host's label position. Labels never change parent by a drag; adding
  one from the palette with a host selected labels the host, as
  before. During a drag the host the object would join is outlined in
  green. On release it joins the topmost host that takes it and whose
  box holds its centre; while its centre is still on its own host it
  stays there (an object source put on a host that does not take it,
  an officer on an altar, stays while over it, and leaves it for the
  floor); otherwise it stands on the floor, a floor being made when the
  hall has none. Rows never take or give up objects; a host standing in
  a row is still a host. The object stays where it is drawn: its anchor
  point is converted into the new frame, its scale multiplied by the
  old frame's unit over the new (left out when it comes back to its
  kind's default, written only when it changes), `at` gives way to `x`
  and `y`, and it goes to the end of its new parent's children, drawn
  on top. Converted values keep two decimals unless a scaled host's
  frame needs more to stay within half a hundredth of a square (and a
  scale more to keep the drawn size within 0.004 of a square): a cup
  put on a scale-2 altar takes `scale=0.175`. The panel's **Stands on**
  select (Floor and each host that takes the object, named by kind,
  with its position where two share a name) does the same from the
  keyboard or a touch screen (plan 050); since the review fixes it
  also offers the host an object stands on, even one that does not
  take it. One change, one undo step.
  The resolver now reports each host's `childFrame` (d0121ec), so the
  conversion needs no second layout. The rules live in `hallHosts.ts`.
- **A warnings badge outside edit mode, in the editor only.** Beside
  Edit hall, a hall with warnings shows "⚠ N warnings" (labelled "N
  hall warnings: edit the hall to see them"); activating it opens the
  hall editor with the focus on the first warning in its list. The
  count comes from `validateHall` with the app's art, in
  `gdHallWarningCount.ts`, loaded by the editor's node view with
  `import()` a quarter of a second after the hall changes. The reader
  never reaches it; the reader boundary test now says so. Bundle cost:
  below.

### The `/gd/hall` editor

- **Architecture.** Shared, unchanged in behaviour for the ritual
  editor: `RitualSourceEditor` (Pug, IDs folded, hall warnings),
  `GdHallEditor` (always editing here: no Done button, the page's
  history on its keys, a locked note of the page's), `ExportControls`
  with `embedGdHallFonts`, `useRitualEditorLayout` (a storage key of its
  own, `magickli:gd-hall-editor-layout:v1`), and new shared helpers in
  `gdHallPug.ts`: `printHallSource` prints a semantic hall as the Pug
  of a ritual holding only it, without the header, with or without
  IDs (`gdHallPug` uses it), and `parseHallSource` reads that back
  through the ritual parser and validator, refusing anything beside the
  hall but blank lines ("only the hall goes here; put comments inside
  it") with the author's line numbers. `gdHallSourceWarnings` and the
  source panel take `headerless` for the same reason. Page-specific,
  in `src/app/gd/hall/`: `HallPlayground.tsx` (the editor, loaded with
  `next/dynamic` and `ssr: false` by `HallPlaygroundLoader.tsx`),
  `hallHistory.ts` (the page's undo and redo), `hallDraft.ts` and
  `hallShare.ts`. `page.tsx` is a server component: the fonts, two
  short paragraphs (what the page is; that drafts stay in the browser
  and how to keep a hall with history), the loader and the source
  links. The read-only gallery and its tests are gone; their checks
  (fonts, sources, exports, Copy Pug source, the original drawings)
  moved to `HallPlayground.test.tsx`.
- **Views and sync.** Source, visual and split, as in the ritual editor
  (split side by side from 900 px, stacked below). The source is the
  page's state: a visual gesture reprints it with IDs; typed source
  shows at once and is read and drawn once typing rests 0.2 s (Review
  fixes). While the source does not parse, the drawing shows the last
  hall read-only ("The source has an error: correct it to edit the
  drawing again."), Copy Pug source and the share link are disabled, and
  Visual is offered only once there is a hall to show. Nodes typed
  without IDs get fresh ones at each parse until a visual gesture prints
  them.
- **History.** One step per visual gesture, per loaded hall (a preset,
  a share link, Start over) and per source edit once typing pauses for
  0.7 s; undo during unsettled typing takes the whole edit back. At
  most 200 steps. The page's Undo and Redo buttons, and Ctrl+Z, Ctrl+Y
  and Ctrl+Shift+Z in the drawing; CodeMirror keeps its own undo for
  typing inside the source.
- **Presets.** A picker of the five, each loaded as a copy with fresh
  IDs. The picker reads "Your hall (changed)" when the hall's Pug
  without IDs is no preset's; choosing a preset then asks first
  ("Replace your hall?"), since the draft would be replaced, and Undo
  brings the hall back. "Compare with the original drawing" was offered
  while the hall was an unchanged preset that had one, the drawing
  shown below the editor (the choice the brief left); removed on 19
  October 2026 (Gadi: the comparisons are done, and the switch no
  longer fits the toolbar).
- **Draft.** The source is written to `magickli:gd-hall-draft:v1` as
  `{"v":1,"source":…}` 0.4 s after it rests and on `pagehide`, by a tab
  that changed it, and another tab's newer draft is offered (Review
  fixes); at most 96,000 characters and 1,000 nodes (1,000,000
  characters before the review fixes). On return a draft that is no
  unchanged preset is restored with "Draft restored · Start over" (Start
  over loads the Neophyte); a corrupt, other-version or oversized draft
  is said and the Neophyte loads; blocked storage, or a full one, is
  survived and said ("This browser is not keeping a draft…"). A draft
  whose source does not parse opens in the source view with its error.
- **Share link.** "Copy share link" copies
  `/gd/hall#hall=1.<data>`: the hall's Pug without IDs, deflated
  (`CompressionStream("deflate-raw")`) and base64url-encoded, in the
  fragment, never the query string; `hall=0.` carries the UTF-8 text
  uncompressed where a browser has no compression streams. The
  fragment may be at most 8,000 characters (a link the hall is too
  large for is refused with its length and the limit, pointing to Copy
  Pug source), and a link may unpack to at most 64 KB (256 KB before
  the review fixes) and hold at most 1,000 nodes, so a deflate bomb is
  refused while it is read. Opening one parses it as hall
  source and nothing else: a damaged, oversized or non-hall link says
  why ("This share link could not be opened: …") and leaves the draft.
  The fragment is removed from the address bar once read, so a reload
  shows the draft, and a link pasted while the page is open
  (`hashchange`) opens too. A shared hall is loaded as one step (Undo
  goes back) and is not written over the browser's draft until it is
  changed. The link is made ahead of the click, so copying keeps the
  click's permission. Measured: an edited Neophyte hall of 1,139
  characters of Pug gave a 613-character link.
- **Export and copying.** `ExportControls` exports a hidden drawing of
  the hall (no editor overlay; drawn again only when the hall changes),
  PNGs with the embedded fonts of stage A3; Copy Pug source copies the
  Pug without IDs.
- **Accessibility and phones.** Labelled toolbar, picker, layout
  buttons (`aria-pressed`), history buttons and panels; the drawing is
  the stage D editor. At 390 px nothing scrolls sideways in any view.

### Bundle

Production builds (webpack), from each commit's gate:

- **The badge** (fbbe523 against 8fd906f): the editor's lazily loaded
  visual chunk, which the reader never loads, grew by 828 bytes, and
  `gdHallWarningCount` is a 327-byte entry (264 gzipped) whose other
  files are the three shared chunks `GdHallDrawing` already loads, the
  validator among them (the package's index exports it). An editor
  that has drawn a hall therefore fetches 327 bytes more. The reader's
  and the editor's client reference manifests do not list it.
- **`/gd/hall`** (27683ff's code as built before its final rebase,
  against 8663fef): the page's own chunk went from 25,570 bytes (the
  gallery drew a hall on the page) to 4,380 (1,688 gzipped); the chunks
  its client reference manifest lists, the site's layout included, from
  1,160,135 bytes to 733,045 (244,573 gzipped). The editor loads after
  it, client-side only: 30 files, 1,509,131 bytes (491,656 gzipped), of
  which 1,375,459 (444,919) are not already in the shell: CodeMirror,
  the Pug parser and printer, the visual editor and MUI components it
  uses, and the hall code and art (the 266,532-byte hall chunk is the
  one the reader's drawing loads).

### What was verified, and how

- **Gates**, per commit, in this worktree with Node 24 (`pnpm check`,
  `typecheck`, `test:coverage` with the per-file thresholds, `build`),
  all exit 0; the tip also `loom check`, `loom check --production`
  with the CI placeholder environment, the magick-data smoke test and
  `pnpm check:turbopack`, all 0 (the tip's first gate failed `check`
  on the Ritual Pug guide's formatting, which was folded into 27683ff
  and gated again). `hallRows.ts` and `hallHosts.ts` joined the
  coverage list. The compiler is untouched: `semantic.ts`,
  `semanticCompile.ts`, `semanticCompilerImpl.ts` and `ritualNodeIds.ts`
  have no diff, so the identity stays `6b059a0f…`.
- **Tests** (about 90 new): rows (`hallRows.test.ts`: places, spread,
  reordering with comments and fixed siblings around, landing index,
  the preview, freezing by field, arrow and Alt-drag, siblings with
  `at` or a position left alone, spreading again, North rows along
  `y`); hosts (`hallHosts.test.ts`: the table, what never moves, the
  topmost host, staying on one's host, the floor, conversions off a
  board on a scale-2 altar with an anchor, onto that board, an item
  onto the scaled altar, an officer onto and off a platform, an
  unknown item kind's default, a hall without a floor, each within
  0.01 square of where it was drawn; Stands on's choices); the model's
  `moveHallNode` and `ensureFloor`; the component (a reorder drag with
  its mark, an Alt-drag freezing the row, Alt+arrows and the panel's
  buttons, Spread evenly again, a cup off the altar and back with the
  highlight, an officer never on the altar, Stands on, no Done, the
  locked note, focus at the warnings); the randomised operations test
  with row steps, reorders, spreads and Stands on, every operation
  shown to change some hall; the badge in the ritual editor (none for a
  clean hall; "⚠ 2 warnings" opening the editor at the first); the
  page (`HallPlayground.test.tsx`, with the source panel replaced by a
  text box: start, layouts, presets with and without changes, Escape,
  source and drawing in step, the error lock, typing as one step,
  undo keys, the draft restored, unchanged, broken, corrupt, of another
  version, oversized, blocked and too large, share links copied and
  opened in a fresh browser, kept off the draft, damaged, not a hall,
  pasted, after unmounting, unmakeable, too large, refused by the
  clipboard, Copy Pug source and SVG export without the overlay);
  `hallHistory`, `hallDraft` and `hallShare` alone (every preset round
  trip, the uncompressed format, a 1,500-marker hall too large, a
  deflate bomb, bad base64, bad UTF-8); `parseHallSource` and
  `printHallSource`; headerless warnings; a layout key of the page's
  own.
- **In the browser** (Turbopack dev server from this branch on
  127.0.0.1:3213, headless Chromium 153 over CDP; synthetic data only).
  `/gd/hall` at 1440 × 900, logged out: the Neophyte in split view;
  a drag moved the Hegemon to x 9.5 in one step; a caption typed in
  the source redrew the hall; the Hierophant dragged past the Past
  Hierophant showed the others moving and the landing mark, and
  undo and redo took and gave back the order; the cup dragged off
  the altar ("Moved Cup to the floor") and back (the altar outlined
  in green; "Moved Cup onto the Altar", `x=0.5, y=0.5`); the Hegemon
  onto the platform and the Hiereus off it; Zelator Temple 1 chosen
  with changes asked "Replace your hall?", replaced, compared with its
  drawing, and Undo brought the changed hall back; a reload restored
  the draft ("Draft restored"); Copy share link gave a 613-character
  URL with the hall in the fragment and no query, which a second
  Chromium with a fresh profile opened to the same hall (Pug without
  IDs identical), the fragment gone from the address bar and no draft
  written; SVG and PNG downloads (the PNG 1541 × 2048 with the label
  fonts). At 390 × 844 with touch: split, visual and source views
  without horizontal scroll, a tap selected and a touch drag moved the
  Stolistes. In the ritual editor ("Hall check (stage B)", the local
  Creator), at 1440 × 900: a dais reorder by drag with its preview,
  undone and redone as one step each through the ritual's history,
  Alt+Right moving it back; x = 3 typed for the Imperator froze the
  other four at 4.8, 8, 11.2 and 14.4, and Spread evenly again cleared
  all five; the cup off and back onto the altar and the Hiereus off
  and back onto the platform, highlighted, and four undos gave the
  hall back; an unknown attribute on the altar and another on the rose
  typed into the source gave "⚠ 2 warnings" beside Edit hall, which
  opened the editor with the focus on "altar: unknown attribute
  colour". At 390 × 844 with touch, in the visual view: no horizontal
  scroll; a touch reorder of the Hierophant, the cup dragged off the
  altar by touch and put back with Stands on (Floor, Altar, Platform),
  and the editor's Undo three times back to "Saved". Nothing was
  saved; the source was put back as it was ("Saved"). Console: only
  the source editor's existing "Unknown highlighting tag" warning and
  the app's own debug lines. Screenshots are outside the repository.
- **Documentation screenshots** were not recaptured: the capture
  publishes the sample rituals, which needs the storage the minimal
  local environment lacks. No fixture holds a hall, and the only change
  to a screen they show is the badge, which a hall without warnings
  does not show.

### Review fixes

Two reviews of 837ecc9..54ee002 found no blocker: an independent Opus
review (M1, m1–m3, n1–n3) and the final Fable review (F1–F4, Fnit1; F1
is m1 in more detail). Fixed on `gate/gd-hall-e` on 19 October 2026,
in six commits after 54ee002 (Commits):

- **A tab writes only what it changed (M1).** An idle tab wrote its
  old hall over a newer draft from another tab as it closed: it wrote
  whatever differed from a held shared hall, on `pagehide` and 0.4 s
  after loading. Each tab now remembers the draft as it last read or
  wrote it and writes only a hall it changed since. It listens for
  other tabs' drafts (`storage` events): with no changes of its own it
  offers "A newer draft from another tab" with **Load it**; with
  changes of its own as well it writes nothing, on resting or leaving,
  and says "Another tab kept a newer draft while this one has changes
  of its own. Neither is written over until you choose: load it (Undo
  brings yours back), or keep yours.", with **Load it** and **Keep
  mine**. Loading is one step, so Undo brings the tab's own hall back.
  A tab closed with the choice unmade keeps the other tab's draft; a
  tab that starts from a preset no longer writes the untouched copy.
- **Heavy halls (m1, F1).** The review's 934-character link held 8,400
  markers (260,415 bytes of Pug). Before, in the Turbopack dev server
  and headless Chromium, opening it took 8.2 s with one 7.7 s long task,
  and a keystroke that added a marker cost a 589 ms CodeMirror dispatch
  and then long tasks of 1.9 s and 8.1 s (parsing it took 1.4 s in
  Node); the draft then kept it across reloads. Now typed source shows
  at once and is read as a hall once typing rests 0.2 s, as the ritual
  editor applies its source (the reducer's `typed` takes the entry
  read). Undo, Redo, a loaded hall and Copy Pug source read unread
  typing first; a gesture made on the drawing before unread typing is
  refused ("That change was not made; the hall is as it was.") rather
  than written over it; no share link is offered while typing is unread;
  and the draft keeps typing once it is read, or as the page goes
  (`pagehide` reads it first), so it is parsed once. A hall kept as a
  draft or shared holds at most 1,000 nodes (`hallLimits.ts`), a link
  unpacks to at most 64 KB (was 256 KB) and a draft holds at most 96,000
  characters (was 1,000,000), all well below the resolver's 4,000 nodes:
  a link beyond them is refused as it opens ("it unpacks to more than 64
  KB, more than a shared hall may hold"; "its hall holds more than 1,000
  nodes, more than a shared hall may"), none is made ("This hall is too
  large for a share link (1,002 nodes; the most is 1,000)…", or "…KB of
  Pug; the most is 64 KB"), and a draft beyond them is neither written
  ("…a draft holds at most 1,000 nodes and 96,000 characters.") nor
  restored. After (the final code, the same way): the review's link is
  refused in 0.6 s, at 1280 px and at 390 px, with no long task over 135
  ms, and a keystroke in the Neophyte costs a 7 ms dispatch. The largest
  hall allowed (998 markers, 1,000 nodes, a 193-character link, 30,953
  bytes) opens in 1.2 s with one 735 ms long task, and a keystroke in it
  costs a 69 ms dispatch and long tasks of at most 246 ms (parsing it
  takes 118 ms in Node). A hall typed or pasted into the source is not
  capped: it is only not kept or shared, and each rest still reads it
  whole.
- **The palette and Stands on agree (m2).** The palette put items,
  tarot keys and markers into any selected host, while a drag and
  Stands on follow the hosts' table: a tarot key added with a platform
  selected landed on it, and its Stands on (Floor, Altar) showed a
  blank, out-of-range select. The table moved to `hallHostRules.ts`,
  which all three share; the palette's `goesOnHost` is `hostAccepts`,
  so a banner goes onto a selected throne and a tarot key beside a
  platform. Labels stay the documented exception: a new label with a
  host selected labels it. Stands on always offers the host an object
  stands on, even one that does not take it (source may stand an
  officer on an altar), so the select shows where it stands.
- **The draft under a shared hall (m3, F2, Fnit1).** The hold on a
  shared hall was dropped at the first write, so Undo (back to the
  draft) then Redo wrote the shared hall as the draft; it now lasts
  while the hall shown is the shared one, until the author's change is
  written. The note on opening a link said whether a draft existed as
  the page loaded, so a link pasted into an open page claimed "Once
  you change it, it is kept as a draft" over the author's own; the
  page now keeps what this tab changed first and says what the browser
  holds ("Your own draft stays in this browser until you change this
  hall; Undo goes back to the hall you had."). With a share link an
  unreadable draft went unsaid; the note now says "The draft kept in
  this browser could not be read; once you change this hall, it is
  kept as the draft in its place." Notes stack, so a link that fails
  leaves the unreadable-draft note shown, their buttons go below the
  text on a phone, and a parser's message about a link is cut to 120
  characters. Typing read as its 0.2 s wait ended, but not yet drawn,
  as a link opened was not kept: the page kept the hall last drawn (a
  CI failure under load, 21 October 2026). The page now holds its
  history as of the last action, ahead of the render, so that typing
  is the draft (also as the page goes) and one undo step back. A
  gesture on the drawing in such a moment, after typing or a link's
  hall and before it is drawn, is refused as one made before unread
  typing is, and choosing a preset then asks before replacing typing
  that is not yet drawn.
- **An editor that cannot load (F3).** An error boundary around the
  lazily loaded editor says "The hall editor could not load, or
  stopped working." with **Reload**, instead of Next's client error
  screen, and the server shell has a `<noscript>` line ("The hall
  editor needs JavaScript, which is off in this browser."). An
  app-wide `error.tsx` is a follow-up.
- **Nits.** A pasted ritual header gets "Line 1: leave out the
  `//- magickli-ritual-pug 1` header line; paste only the hall" (n1;
  `parseHallSource`, so the ritual editor's hall paste is unchanged).
  "Correct the source to share the hall." is shown but no longer in
  the live region, so it is not announced at every keystroke that
  leaves the source wrong for a moment (n3). Re-choosing the preset
  shown (n2) does not happen: MUI's Select calls `onChange` only for a
  new value (`SelectInput`'s `handleItemClick`), so it changes
  nothing; a test holds that, and no code changed.
- **This plan (F4).** The bundle note cited the tip of a superseded
  backup branch, not an ancestor of this branch; it now says 27683ff's
  code as built before its final rebase. With that fixed, no commit
  named in `plans/` lay only on this stage's own backup branches
  (`backup/gd-hall-e-base-348904c`, `backup/gd-hall-e-part1-v1` and
  `backup/gd-hall-e-tip-v2`), so they were deleted.

Verified:

- **Gates**, per commit, in this worktree with Node 24 (`pnpm check`,
  `typecheck`, `test:coverage`, `build`), all exit 0 for the six
  commits; the last also `loom check`, `loom check --production` with
  the CI placeholder environment, the magick-data smoke test and
  `pnpm check:turbopack`, all 0. The first run failed `test:coverage`
  from the heavy-halls commit on: under the full suite's load the
  draft's timer parsed typing not yet read (a second parse, also paid
  in use) and page tests hit the 5 s timeout. The draft keeps typing
  only once read, the page's slow test groups allow 20 s, and the six
  commits were rebuilt and gated again. The compiler is untouched:
  `semantic.ts`, `semanticCompile.ts`, `semanticCompilerImpl.ts` and
  `ritualNodeIds.ts` have no diff since 54ee002.
- **Bundle**: the page's own chunk grew from 4,380 to 10,009 bytes
  (1,688 to 3,747 gzipped) with the boundary's Alert and Button; the
  chunks its client reference manifest lists, from 733,045 to 738,529
  bytes.
- **Tests that fail without their fix**, each run against the code
  before it: m2, the two `goesOnHost` tests, the tarot key beside a
  platform and both Stands on tests; n1, the header test; m1/F1, the
  heavy link refused in `hallShare.test.ts`, a typing burst read once,
  unread typing before Undo, a gesture and a copy, the draft and share
  node limits and the draft limit message; M1, the two-tab tests (two
  pages on one storage, each write reaching the other as a `storage`
  event: the idle tab wrote "Seven" back over "Six"), the conflict
  and its Load it; F2, the shared hall through Undo and Redo (the
  shared hall was written); m3, the pasted link; Fnit1, the unreadable
  draft with a link and the clipped message; F3, the boundary with a
  loader that throws; n3, the status test. The page tests now wait for
  the draft in short `act()` spans: React renders what a span's timers
  changed only as the span ends, so the old 600 ms waits could not see
  a write made after the hall changed; those waits use the spans now.
- **In the browser** (Turbopack dev server from this branch on
  127.0.0.1:3247, headless Chromium over CDP with background throttling
  off; synthetic halls only): two tabs, the first changing the caption
  to "Seven" and then "Six" while the second sat on "Seven", which said
  "A newer draft from another tab"; both gone, the draft was "Six", and
  a reload showed it. Two tabs both changed: the second said so and
  wrote nothing until Keep mine, after which the first offered the newer
  draft and Load it took it. A draft of the author's own, then a Zelator
  1 link: the note said the draft stays; Undo, Redo and leaving the page
  kept the draft, and the reload restored it. The same link pasted into
  the open page with a draft, and into a fresh one without, gave the two
  notes; a corrupt draft with the link gave the unreadable-draft note; a
  link with the ritual header said to leave it out. The review's link
  before and after, as measured above. These checks ran again on the
  final code. With the editor's chunks blocked
  (`Network.setBlockedURLs`) the page showed the boundary's message
  (Next logged the `ChunkLoadError` as handled by the boundary), and
  Reload brought the editor back. A thousand markers pasted into the
  source gave both too-large messages in 1.1 s. A quick pass: a preset
  chosen, a keyboard nudge, a caption typed (drawn after the rest), Undo
  and Redo, an SVG export, and no horizontal scroll at 390 px in split,
  visual and source views. Screenshots are outside the repository.

## Stage F notes

Built on `gate/gd-hall-f` (19 October 2026), from `main` at 463c12a,
with two changes Gadi asked for first. Each records what was settled
where the brief or the plan left a choice.

### Owner requests of 19 October 2026

- **Source | Split | Visual.** The editors' layout switch now reads in
  the order split view lays the panels out, source on the left:
  `RITUAL_EDITOR_LAYOUTS` (`useRitualEditorLayout.ts`) holds the order
  and labels, and `RitualLayoutSwitch` draws them, the chosen layout
  pressed (`aria-pressed`) as well as filled; the ritual editor (which
  printed its raw lowercase keys and showed the choice by fill alone),
  the `/gd/hall` editor ("Pug source" became "Source") and the
  new-ritual form all use it; a narrow ritual editor offers
  Source and Visual. The new-ritual form was not named in the request
  but has the same switch, so it follows. The temples and Ritual Pug
  guides describe the new order, and the documentation capture clicks
  the new labels. The screenshots that show the switch
  (`editor-split`, `editor-source`, `editor-visual`, `editor-phone`)
  were recaptured from this branch with the local development stack
  and fold into the switch's commit.
- **No drawing comparison.** "Compare with the original drawing" and
  the drawing under the `/gd/hall` editor are gone (Old `/pics/*.svg`
  references); the presets still cite their drawings, which the page
  links.

### Vocabulary

- **Adepts.** `chiefAdept`, `secondAdept` and `thirdAdept` join the
  ritual role catalog with their names, a colour each (ours, after the
  rubric's colours, Regardie 1938 p.156, n149: the Chief Adept's yellow
  collar and nemyss, the Second Adept's orange, the Third Adept's green;
  the Chief Adept's cloak is the Hierophant's red) and a plain circle for a symbol, as the hall
  draws them; a test holds every hall role in the catalog under the
  same name. In the hall, `lamenArt` draws the package's plain circle
  for a hall role `Lamen` has no lamen for; other unknown roles keep
  `Lamen`'s plain lamen, as before. The catalog's consumers (the
  reader's frames, the role pickers and slash menu, the source check)
  read names and symbols by key, so they needed nothing else.
- **Kameas** are computed, not copied (`kameas.ts`, in magick-data since
  the follow-ups after stage F): Agrippa's squares
  (*De occulta philosophia*, 1533, II.22), the odd ones by the
  step-down-right construction, the doubly even ones by complementing
  the 4 × 4 diagonals, both of which give exactly Agrippa's squares,
  and the Sun's order-6 square written out. Tests check every square is
  magic and Agrippa's row by row. `kamea(planet)` draws the grid with
  its numbers (once per planet per hall, the numbers inside the
  drawing), default scale 0.9, the Theoricus 2 drawing's Moon square.
  At that scale the Moon's numbers are about 0.1 squares tall (Saturn's
  0.28): a kamea reads as a number square at the reader's size, and its
  numbers only when zoomed or exported large, by design.
  Like `tarotKey`, `kamea` and `seal` are tags the art registry adds,
  so the validator knows them with the art.
- **Seals** could not be drawn from geometry here, so `seal(planet)` is
  a clearly marked placeholder: a dashed grey ring reading "Seals of
  Luna" (the plural, as the drawings name the seal and sigils
  together). Theoricus 2 now draws its Moon kamea and this placeholder
  instead of its two markers. Stage H draws the seals (Artwork ledger).
- **Boards.** `board(kind)` is an enum: `flamingSword`,
  `minutumMundum`, `gardenOfEden`, `theFall`. `TreeOfLife` could not be
  drawn in a hall as it is: it reads the whole magick-data barrel for
  its labels (which would have gone into the chunk every ritual with a
  hall loads), and draws ids, links, titles, text paths and a
  stylesheet loading fonts by URL. Its geometry, draw order and path
  outlines moved to `treeOfLifeFigure.tsx`, which also draws
  `TreeFigure`, the spheres (Queen scale) and Hermetic paths alone,
  reading only magick-data's sephirot; `TreeOfLife` imports them and
  draws exactly what it drew before (four variants compared byte for
  byte). The Flaming Sword adds the Lightning Flash down the spheres;
  the Minutum Mundum's paths stay white, since magick-data has no path
  colours (Artwork ledger). The Garden of Eden and the Fall are boards
  with their names. A board with a diagram keeps the Tree's 2 × 3
  proportions and is sized by `scale` (`w` and `h` are ignored, with a
  warning), so each diagram is drawn once per hall however many boards
  differ in size; a plain board, or one whose kind is not one of the
  four, still takes `w` and `h`, and the properties panel offers them
  only there (or where the node already has them, so they can be
  emptied). Saved halls: `board(kind)` was free text before stage F,
  so a saved board whose kind is exactly one of the four now draws its
  diagram at 2 × 3 by `scale`, ignoring its `w` and `h` (with a
  warning), and any other kind is an error diagnostic, which never
  blocks a save, the board drawn plain at its `w` and `h`. No saved
  ritual holds a hall yet.
- **"null" in a choice.** The attribute check reads the string "null"
  as absent (the legacy path writes `null` so), which left a kamea or
  seal with `planet="null"` drawn empty, and a board's or altar's
  `kind="null"` drawn plain or black, with nothing said; those are now
  errors like any value the vocabulary does not know.
- **Veil**: a pleated band, 16 × 0.4 squares at scale 1 (the hall's
  width), sized by `scale` only for the same reason; lavender, our
  choice. The palette puts it across the hall at the dais's West edge
  (x 8, y −0.3) whatever is selected: beside the selection it would
  overhang a wall, and the palette never puts anything into a row,
  where it would take a slot and overhang the hall.
- **White altar**: `altar(kind="white")`, an attribute rather than a
  tag, as `pillar(kind)` is: it is still an altar that things are put
  on (the Tablet of Union and the white lamp late in Portal 2), so the
  host rules apply to both kinds. The presets and the palette draw it
  at scale 0.5.
- **Items** `gong`, `brazier` and `candle`, drawn from geometry in the
  package, default scale 0.5. The candle is beyond the plan's list:
  the Practicus and Philosophus rubrics and drawings put a candle on
  each side of the altar in five of the halls.
- **Hebrew letters on any side** needed nothing new: `banners` rows
  already stand beyond each wall, spread evenly, from corner to corner
  or at their own positions. The 1938 drawings put the paths' letters
  inside the walls, as portals; the presets put them in rows beyond the
  walls, as the Theoricus presets and the Greer redraws do, except the
  Portal's five, which stay along the East edge of the floor (the
  Tablet of Union and the gong stand beyond the East wall there).
- **Consistency.** The palette offers every new tag and kind (the
  boards, a kamea, the seals, the white altar, the veil, the items
  through the item kinds); no host takes the new tags, and the
  palette's host test still agrees with the host rules; the properties
  panel shows `kind` on altars and boards and `planet` as selects; the
  editor names the new nodes ("Kamea of Luna", "Board: The Fall",
  "White altar"); no new name is reserved, and every preset round-trips
  through Pug.
- **The placeholder estimate** (`estimateHallAspect`) measured banner
  rows only across the row: letters from corner to corner (Philosophus)
  reach half a banner past the walls, which put the reader's
  placeholder 5.8 % off for Philosophus 1 and 2. Rows are now placed
  along their line as the resolver places them, items placed by `at`
  left out of the spread by `placedByAt` (`attributes.ts`), the rule
  the resolver, the estimate and the editor's rows now share: 1.3 %
  off, and every preset within 2 %.

### Presets

From the 1938 diagrams and rubrics (Sources), following the accepted
conflicts; each cites its pages and leaves, and a test holds every
cited page at its leaf. Moves within a part (the candidate after the
circumambulation, the Hierophant's chair moved West in 3=8) are left
out. Settled here:

- **No Chiefs.** The 1938 diagrams of these grades draw only the
  Hierophant on the dais, and the Philosophus rubric names three
  officers, so the presets have no Chiefs, unlike the five drawn ones
  (and Greer's redraws). For Gadi (Follow-ups).
- **Practicus 1 and 2** (31st and 30th paths): the letter in the
  North-East, the pillars in the North-East as the text says, the
  trump between two candles, incense in the South, the Hiereus and
  Hegemon in the West with red lamps, the cup of water, and the "Seat
  for the Theoricus" as a marker (it is furniture set before the
  ceremony). The hatched corners of the dais in the 31st path (and
  3=8) are not explained by the text and are not drawn.
- **Practicus 3** (3=8): the diagram draws the Hierophant both on the
  dais and at his "1st Position" West of the altar; the officer stands
  at the first position and the dais keeps "Hierophant's throne". The
  dais box "Mercury" is a marker, as the drawing names it (not a
  kamea), East of the throne as the drawing stacks them. On the altar, the cross, the cup and the triangle of Water
  with a lamp at each angle (the drawing's circles; Greer labels them
  lamps).
- **Philosophus 1 and 2**: conflicts 2 and 3. The Fire tablet is a
  marker on the South wall with its lamp and incense.
- **Philosophus 3**: conflict 4: the Hierophant on the dais with a red
  lamp, the Hiereus and Hegemon with red lamps instead of cups, the
  drawing's pillars before Peh and its Banner of the East kept.
- **Philosophus 4** (4=7): conflict 5 (pillars North and South), and a
  new one, conflict 10 (the drawing's kamea and seals of Venus against
  the rubric's symbol of Venus on the Tree): both are shown.
- **Portal 1 and 2**: conflicts 1 and 6. Part 1 has no Tau (its p.175
  diagram draws none); part 2 has Tau beyond the West. The Tablet of
  Union and the gong stand beyond the East wall, as p.175 draws them
  (Greer moves the gong onto the dais); p.155's unlabelled hexagram
  above the East is not drawn. Incense sticks and the incense for the
  altar are censers; the white lamp is a lamp with `fill="white"`.
  The grade is written "Portal".

### Bundle

From the gates' production builds (webpack), a2e29c7 against 1ad0abc:
the hall chunk the reader's drawing loads grew from 266,532 to 276,349
bytes (90,779 to 95,072 gzipped), with the new art, `TreeFigure` and
magick-data's sephirot; the chunk holding the presets (the Insert
dialog, the slash command and `/gd/hall`) from 16,280 to 25,232 (6,069
to 7,767). The reader's static graph is unchanged (its boundary test
passes).

### Review fixes

Two independent reviews of stage F found no blocker. Their fixes were
folded into the commits they belong to (the branch rewritten; Commits
lists the new ones): the shared `RitualLayoutSwitch` with
`aria-pressed`; the adepts' colours credited to the rubric's collars
and nemysses; "null" in a choice an error; the board's `w`/`h` warning
only for a kind the vocabulary knows, and the panel's Width and Height
only where they do something; board fixtures in `hallHosts.test.ts`
without kinds, so they draw as their comments say and warn of nothing;
`LineOutline` typed; the veil from the palette across the hall; the
placeholder estimate's rows sharing the resolver's `at` rule, in one
pass; Practicus 3's "Mercury" East of the throne, and the Philosophus 3
comment on Shin; the conflicts' acceptance limited to rows 1–9; commit
subjects within 50 characters, the type included.

### What was verified, and how

- **Gates**, per commit, each in a clean export of the commit with
  Node 24 (`pnpm check`, `typecheck`, `test:coverage`, `build`): all 0
  for every commit. `kameas.ts` joined the coverage list. The compiler
  is untouched: `semantic.ts`, `semanticCompile.ts`,
  `semanticCompilerImpl.ts` and `ritualNodeIds.ts` have no diff, so the
  identity stays `6b059a0f…`.
- **Tests**: the switch's order in each editor; the adepts in the
  catalog and drawn as one plain circle; the kameas magic and Agrippa's,
  the constructions for other orders; kamea, seal, board, altar, veil
  and item drawings (no ids, links or text where none belongs), their
  validation, their bounded output (3,990 kameas and seals in 14
  drawings, 3,990 boards of different sizes in 2), their names and
  palette entries; the placeholder estimate for rows (failing without
  the fix); every preset validated with the app's art without warnings,
  drawn to a snapshot, inventoried, round-tripped through Pug, inserted
  by the slash command and the Insert dialog, and randomly edited.
- **In the browser** (Turbopack dev server from this branch on
  127.0.0.1:3291, headless Chromium over CDP; synthetic data only):
  `/gd/hall` reads Source, Split, Visual with no comparison switch, and
  its picker lists the fourteen presets; Practicus 1 and 3, Philosophus
  1 and 4 and Portal 1 and 2 drawn in the visual view with no warnings;
  at 390 px no horizontal scroll. In the ritual editor ("Hall check
  (stage B)", the local Creator) the switch reads Source, Split,
  Visual, and Source, Visual at 390 px; the new-ritual form reads
  Source, Split, Visual. After the review fixes (same setup): the
  switch's chosen layout is `aria-pressed` in all three, and a veil
  added from the palette with a dais officer selected lies across the
  hall at x 8, y −0.3. Nothing was saved. Screenshots are outside the
  repository.

## Follow-ups after stage F

Built on `gate/gd-hall-f2` (20 October 2026), from `main` at 33ad461:
two changes Gadi decided that day, the first from mock-ups (A, the
panel beside the drawing whenever it fits; C, docked at the foot of the
screen otherwise; B, a panel floating over the drawing, was the
runner-up and was not built). Two independent reviews (Opus, Fable)
found the kamea move clean and the dock in need of work, and a second,
focused review of their fixes found more (phones, focus, the reveal);
all their fixes were folded into the commits they belong to (the branch rewritten;
Commits lists the new ones). Each point records what was settled where
the brief or the reviews left a choice. Every width here was measured
with classic 15 px scrollbars, as most desktop browsers on Windows and
Linux draw them (the first measurements, with the headless browser's
hidden scrollbars, overstated them by 9–15 px).

### The properties panel

- **Beside or docked.** `hallPanelDock.ts` measures the editor before
  its first paint and then from the `ResizeObserver` entry's border box
  (its content box where a browser has no border box). The panel
  stands beside the drawing from 732 px: the beside layout is
  `minmax(30rem, 1fr) minmax(15rem, 19rem)`, so the drawing keeps 480
  px and the panel 240, and room beyond both goes first to the panel
  (up to 19rem), then to the drawing. A docked panel goes back beside
  only at 748 px (16 px of hysteresis, more than a classic scrollbar),
  so a scrollbar that comes and goes as the panel moves cannot make it
  flap. Either side of the switch (`/gd/hall` visual, the window
  stepped 778, 779, 790, 794, 795, 779, 778 px): docked at 731–747 px
  with a 640 px drawing (its 40rem), beside at 748 px with a 480 px
  drawing and a 256 px panel, beside still at 732 px (480 and 240),
  docked again at 731. The jump is 640 to 480 px (25 %), where the
  stage D container query's 720 px gave 408 beside and 640 docked
  (57 %). Until the editor has a width the place is unknown, and the
  drawing and the panel share one column (no `data-panel`), which fits
  any width; the measurement comes before the first paint, so a wide
  screen never shows the dock for a frame. (The first rendering was
  "beside" until the second review: its two minimums asked 748 px of a
  phone's 358, the phone's browser shrank the page to fit, and the
  measurement then read a window of 748 × 1,619 at 390 × 844, which
  stuck.) A measured width rather than the container query: the dock's
  buttons exist only where they do something, and the switch can be
  tested.
- **The dock.** `position: sticky; bottom: 0`: the panel sticks to the
  foot of the nearest scrolling box (the page on `/gd/hall`; the visual
  panel, which scrolls, in the ritual editor), stays there while the
  editor is on screen and stops at the editor's end, so it neither
  covers the page beyond the editor nor leaves the ritual editor's
  visual panel. A sticky grid item cannot leave its own grid area, so
  the editor's body is a block while the panel is docked. Its place in
  the flow stays below the drawing, so scrolled to the editor's end the
  drawing's foot lies clear above it. Its fields run in as many columns
  as fit (at least 9rem each; x and y side by side across two).
- **Its size follows the box it sticks in**, not the screen:
  `hallPanelDock.ts` measures that box's height (the scrolling
  ancestor's `clientHeight`, or the window's layout viewport,
  `documentElement.clientHeight`, which holds still under a phone's
  address bar, measured again on `resize` and `visualViewport`
  resizes) and the fields take at
  most 30 % of it less the title bar's 3.5rem, within 4.5–13rem,
  scrolling inside. In a box under 400 px (`DOCK_MIN_ROOM`; the ritual
  editor's visual panel on a landscape phone is 183 px under its header
  and toolbars) the panel stays in the flow below the drawing, at its
  full height, as it stood before the dock: there even its title bar
  and caption would have covered three quarters of the drawing. Its
  foot is padded by `env(safe-area-inset-bottom)`, 0 until the app sets
  `viewport-fit=cover`.
- **Nothing selected, the dock is short.** Docked with nothing selected
  it shows its title bar, the caption and **All hall settings**, which
  shows the hall's other fields (padding, margins, the dais and the
  rest) and becomes **Fewer hall settings**; beside the drawing every
  hall field shows as before. A selection shows its own fields at once,
  unless the viewer has hidden the dock. Measured (classic scrollbars,
  the Neophyte): 164 px with nothing selected, 18–29 % of its box in
  every docked case; with the Black pillar selected 234 px at 1280 ×
  800 (29 % of the window), 238 at 1024 × 768 (31 %) and 272 on a 390 ×
  844 phone (32 %); hidden, 57 px.
- **Keyboard selections are scrolled into view.** After a key that
  selects (Tab, or a warning chosen), nudges, reorders along a row,
  scales or duplicates, and after the panel's own buttons (Duplicate,
  Move left and right, Smaller and Larger, Spread evenly again, Stands
  on), whose result can land under the dock, the selection's rectangle
  is scrolled into its scrolling box with 12 px to spare, its foot
  clear of a docked panel's measured height (`revealDelta`,
  `scrollingAncestor`). The request keeps the selection and hall it
  found and is acted on only if the next render shows another, so a key
  that changed nothing (+ on a door, a nudge at a limit) leaves nothing
  pending; a pointer press clears any. A selection made with the
  pointer is where the pointer is, and is left alone; a field typed in
  the panel is not followed, since its author is in the panel.
  Checked by tabbing through all 25 objects of the Neophyte and nudging
  the last, in `/gd/hall` (split and visual) and the ritual editor, at
  every size below: none was left outside its box or under the dock.
- **Hiding.** **Hide** and **Show** (a text button in the title bar, at
  least 44 × 44 px; its name "Hide properties" or "Show properties",
  with `aria-expanded` and `aria-controls`; no tooltip) fold the strip
  to its title bar, which still names the selection. The choice is kept
  for the viewer in `localStorage`
  (`magickli:gd-hall-panel-collapsed:v1`, in try/catch) and shared:
  every editor in the page hears of a change at once, and other tabs
  by the `storage` event. Where storage is blocked or full the choice
  lasts for that editor only. Beside the drawing the panel is never
  hidden. Hidden fields stay mounted (`hidden`), so a value being typed
  is still written by Ctrl+S or Save.
- **Focus is never dropped by the dock.** A panel that docks while one
  of its fields holds the focus stays open, in that editor, until the
  viewer hides it again or it next stands beside the drawing (the kept
  choice is not changed); a hall field holding the focus keeps its
  fields shown. When the panel goes beside the drawing with Hide or All
  hall settings focused (both go with the dock), the focus goes to the
  panel's first field (the caption, with nothing selected), or to the
  drawing when the panel has none: a callback ref notes the focus as
  React detaches it, before the element is removed. Whether a field
  holds the focus is read again after every render, not taken from
  blur events alone, which Firefox does not fire for a focused field
  that is removed.
- **Unchanged:** keys and focus in the drawing, the live region, the
  warnings and their badge, fields written when left, drags (released
  over the dock too, the pointer being captured), Escape and undo. The
  Ritual Pug guide says where the panel goes.

### Split `/gd/hall` at the full width

- **Columns.** Only split view's two panels take the screen's full
  width (16 px gutters), the source and the drawing two parts to three
  from 900 px. The toolbar (preset, undo and redo, the layout switch),
  the notes and the share controls keep to the text column (1,168 px,
  the lg Container less its gutters) in every layout, so the layout
  switch stays under the pointer (it moved 353 px at 1920 before the
  review fix).
- **Measured** (classic scrollbars): the drawing's half is 1,114 px at
  1920 × 1080 and 826 at 1440 × 900, the panel beside; 730 at 1280 × 800
  and 577 at 1024 × 768, docked. So 1280 × 800 misses the side-by-side
  width by 2 px; from about 1,300 px of window it is beside, as Gadi's
  "around 1,300 px or wider" asked. A 3:5 split would give 761 px at
  1280 × 800 (beside); that is Gadi's call, not taken here.
- **Visual alone stays in the text column**, as do source alone, the
  loading line and the error message: the drawing stops at 40rem, and
  in visual view the panel already stands beside it in that column
  (at 1024 × 768 too, 977 px), so more width would only add empty space
  and part the editor from the page's text. The page's text and its
  sources stay in lg Containers; the editor sits in a band between
  them, the three marked with `data-hall-page` for the page's test.
- **The ritual editor** keeps its 1:1 split: it is the ritual's
  document editor, and the brief changed only `/gd/hall`; the question
  goes to Gadi. With classic scrollbars its visual panel has its own
  15 px scrollbar, and its hall editor is 717 px at 1920 × 1080, 637 at
  1440 × 900, 557 at 1280 × 800 and 429 at 1024 × 768: docked at every
  size (beside only with overlay scrollbars, as the first measurements
  had them). For comparison, measured by injecting the CSS and changing
  nothing: a 2:3 ritual split would give 873 px at 1920 × 1080 (beside,
  a 557 px drawing), 777 at 1440 × 900 (beside, 480) and 681 at 1280 ×
  800 (docked). A lower switch would have to sit at 717 px to put the
  1:1 split beside at 1920 × 1080 (a drawing of at least 465 px), and
  at 637 px for 1440 × 900 (385 px).

### Kameas in magick-data and a shared `Kamea`

- **The squares** are `magick-data/astrology/kameas`, beside the planet
  table whose ids key them (`saturn`, `jupiter`, `mars`, `sol`,
  `venus`, `mercury`, `luna`; the type is held to the table's
  `PlanetId`): the default export is every square, frozen, in a table
  without a prototype (so "constructor" or "__proto__" read as nothing),
  with `KAMEA_PLANETS` (frozen) in the Chaldean order and the two
  constructions. `oddKamea` and `doublyEvenKamea` throw a RangeError
  for an order they do not build: odd from 3, or a multiple of 4, up
  to `MAX_KAMEA_ORDER` (100); before the review fix 2 and 6 gave
  squares that were not magic and 4 threw a TypeError. They are
  derived values, as Lenain's are in `seventyTwoAngelsDerived.ts`, so
  a hand-written module rather than a JSON5 table: no schema, no JSON,
  nothing in the barrel or the graph. The package's conventions
  followed: both exports maps, the publish emit (`tsconfig.build.json`,
  with `isolatedDeclarations`), the README (Licences says the module is
  code, under MIT; it is listed under "Texts and values that are not
  tables", and Sources carries the provenance: Agrippa, *De occulta
  philosophia*, 1533, II.22; no rights asserted, the squares being
  facts), the coverage list, and a load in the smoke test.
  `LICENSE.txt` already puts hand-written modules under MIT. The
  package is private at 0.0.0 with no changelog; a new subpath is a
  minor change under its README's versioning, recorded here. The tests
  moved with the module (every square magic; each starting with
  Agrippa's first row; Saturn's and Jupiter's his row by row; new:
  keyed by the table's planets, frozen, hostile names, refused orders).
- **The hall keeps its words.** Saved halls hold `planet="sun"` and
  `"moon"`, so the hall's vocabulary stays (`planets.ts`: `PLANETS`,
  `PLANET_NAMES`) and `KAMEA_PLANET_IDS` maps it to magick-data's ids;
  a test holds the names to the planet table's.
- **The component** is `src/components/astrology/Kamea.tsx` (MIT),
  beside the other planetary components: `Kamea` draws a planet's
  square in an `<svg>` of its own (`planet`, `size`, `label` for an
  image's name, otherwise `aria-hidden`; `className`, `style`);
  `KameaFigure` is the same as bare elements centred on the origin, 96
  units across, for a drawing that places it (`fontFamily`, `paper`,
  `ink`); `kameaGeometry(order)` gives each cell's centre. A name that
  is not one of the seven draws the empty frame (`Object.hasOwn`). No
  ids, links or `<style>`, so any number share a page. Room for stage
  H's seals and sigils: `children` are drawn over the numbers in the
  square's own frame, where `kameaGeometry` places the cells.
- **The hall's `kamea` art** is `KameaFigure` in the hall's font and
  palette. Its markup for the seven planets, the empty frame and an
  unknown planet is pinned by a file snapshot
  (`src/components/gd/hall/__snapshots__/kameaArt.html`) written by the
  same test run at 33ad461, before the change (SHA-256 `8b5061f7…`),
  and the preset snapshots (Theoricus 2's Moon, Philosophus 4's Venus)
  pass unchanged. The import boundary holds: `Kamea` imports React,
  `magick-data/astrology/kameas` and `../svgCoordinate` (inside
  `src/components`), and the hall reaches it by a relative path inside
  `src/components`.
- **No demo page.** The repository shows a symbol on a `/gd/symbols`
  page with its SEO entry, card, render contract and their tests
  (about fifteen files for the Shewbread); that is more than this
  change warranted, so the component has none yet (Follow-ups).

### Bundle

Production builds (webpack) from each commit's gate, gzip -6: the hall
chunk the reader's drawing loads was 276,349 bytes (95,072 gzipped) at
33ad461, 276,910 (93,958) with the squares read from magick-data's
subpath (d5219d7; 276,597 before the review fixes added the order
checks), and 277,262 (94,153) with the `Kamea` component (1c291d6;
276,928 before them); the dock and the page do not touch that chunk. Neither the planet table nor any other barrel table entered it
(no planet or zodiac names in the chunk); the squares' only literal is
still the Sun's.

### What was verified, and how

- **Gates**, per commit, each in a clean `git archive` export with Node
  24 and the CI placeholder environment (`pnpm check`, `typecheck`,
  `test:coverage` with the per-file thresholds, `build`): all 0 for the
  four code commits as first built and again as rebuilt with the review
  fixes; the tip also `loom check`, the magick-data smoke test (which
  loads the kameas) and `pnpm check:turbopack`, all 0. The new modules
  joined the coverage list (`astrology/kameas.ts`, `Kamea.tsx`, the
  hall's `planets.ts`, `hallPanelDock.ts`). The compiler is untouched:
  `semantic.ts`, `semanticCompile.ts`, `semanticCompilerImpl.ts` and
  `ritualNodeIds.ts` have no diff.
- **Tests:** the squares in magick-data (with hostile names and refused
  orders), the hall's planet names against the planet table, `Kamea`
  and `KameaFigure` (numbers row by row in their cells, the rules, the
  `<svg>` and its label, no ids or links among many, fonts and colours,
  the empty frame, hostile names, the overlay last and in the square's
  frame, the geometry), the hall's kamea art against its snapshot from
  33ad461; `hallPanelDock` (the 732 px switch and its hysteresis, the
  border box and its fallback, `revealDelta`, `scrollingAncestor`, the
  box's height from a scroller or the window's layout viewport and its
  resizes and `visualViewport`'s, no place before a width, the observer
  disconnected on unmount, the 400 px floor, the kept choice
  shared in the page and across tabs, blocked storage, the server's
  snapshot); the editor: beside at 732, docked at 731 and back only at
  748, docked and back beside, the box's height as a CSS variable, in
  the flow in a short box, one column without a width, the dock's own
  observer stopped on unmount, the compact hall fields, hidden and shown
  with the selection
  named and the choice kept and followed by a second editor and another
  tab, a typed value kept while hidden, a field focused as the panel
  docks kept open and the viewer's choice followed again after it has
  been beside, the focus followed out of a field without a blur, the
  focus of Hide and of All hall settings given to a field or the
  drawing, keyboard selections and nudges scrolled clear of the dock
  and a pointer's not, a key that changed nothing forgotten before a
  pointer's selection, the panel's Larger, Duplicate and Smaller
  revealed, no scroll beside; the page's three parts in
  order and the toolbar in the text column in every layout. The focus,
  reveal and flow tests and those of the second review fail with their
  fix taken out; the page tests fail on the page before the change.
- **Not tested in jsdom**, which lays nothing out: the CSS itself
  (sticky positioning, the grid's minimums, the strip's height cap,
  the scroll margins, the safe-area padding, the columns, the toolbar's
  column). Those were checked in the browser only.
- **In the browser** (Turbopack dev server from this branch on
  127.0.0.1, headless Chromium over CDP with classic 15 px scrollbars,
  `Emulation.setScrollbarsHidden(false)`; the phones with touch
  emulation and the mobile viewport, whose scrollbars overlay;
  synthetic data only), after the review fixes: `/gd/hall` in split
  and visual at 1920 × 1080, 1440 × 900, 1280 × 800, 1024 × 768, 390 ×
  844 and 844 × 390, with the widths above, no horizontal scroll, the
  layout switch at the same place in every layout, and every keyboard
  selection in view; the landscape phone's 812 px editor is beside. In
  the ritual editor ("Hall check (stage B)", the local Creator,
  nothing edited) in split at the four desktop sizes and on the phones
  with Edit hall open: docked at each, its foot on the visual panel's
  (1,064, 884, 784, 752 and 828 px, the panel's own bottoms), in the
  flow below the drawing on the landscape phone; every keyboard
  selection clear of the dock; Escape twice left the editor, and the
  ritual stayed "Saved". Before the review fixes the same checks (with
  hidden scrollbars) covered hiding and a reload, x typed in the dock,
  Ctrl+Z and a drag released over the dock. Screenshots are outside
  the repository.
- **Phones, after the second review** (mobile emulation with touch,
  `/gd/hall` visual and split and the ritual editor's visual view with
  Edit hall open; the window now reads the device's size, no
  horizontal scroll anywhere, and Tab through all 25 objects left none
  hidden):

  | Phone | `/gd/hall` editor | Dock | Strip, nothing selected → an object |
  | --- | --- | --- | --- |
  | 390 × 844 | 358 px, docked | stuck, room 844 | 164 px (19 %) → 261 (31 %) |
  | 375 × 667 | 343 px, docked | stuck, room 667 | 164 (25 %) → 208 (31 %) |
  | 667 × 375 | 635 px, docked | in the flow, room 375 | below the drawing |
  | 640 × 360 | 608 px, docked | in the flow, room 360 | below the drawing |

  In the ritual editor: 390 × 844 stuck in a 632 px panel (164 → 197
  px, 26–31 %), 375 × 667 stuck in 455 px (144 px, 32 %), and in the
  flow on both landscape phones (rooms of 200 and 140 px); Escape twice
  left the editor and the ritual stayed "Saved". Before the fix
  667 × 375 and 640 × 360 had a 136 px sticky dock over a 375 px
  screen, and portrait phones about twice their room.
- **Documentation screenshots:** none shows the hall editor or
  `/gd/hall` (the capture's editor shots open the Neophyte ritual, which
  holds no hall, and none opens Edit hall), so none was recaptured.

## Stage G notes

Built on `gate/gd-hall-g` (21 October 2026), from `main` at 1f16a7b:
first the split ratios Gadi chose that morning, then the tablets. The
agent that began the stage was cut off; this one finished it. Each
point records what was settled where the brief left a choice, and
what waits for Gadi.

### Gadi's split ratios (21 October 2026)

- **`/gd/hall` split is 3:5** (source to visual) from 900 px, not 2:3
  (026a55a), curing the 2 px it missed side by side at 1280 × 800. With
  classic 15 px scrollbars, in headless Chromium: the hall editor is
  1,161 px at 1920 × 1080, 861 at 1440 × 900 and 761 at 1280 × 800,
  the panel beside the drawing at each, and 601 at 1024 × 768, docked;
  no horizontal scroll. jsdom lays nothing out, so the page's test reads
  the stylesheet's columns.
- **The ritual editor's split is 2:3 while a hall is open for editing**
  and 1:1 for writing (f809947). The hall atom marks itself
  (`data-gd-hall-editing`) from the moment Edit hall is chosen, its
  loading line included, and the stylesheet widens the visual side
  through `:has()`: one attribute, one relayout, no state crossing from
  the Tiptap node view to the page, so the hall editor measures itself
  at its final width and its panel never flips between docked and
  beside. Measured the same way ("Hall check (stage B)", nothing saved):
  873 px at 1920 × 1080 and 777 at 1440 × 900, beside; 681 at
  1280 × 800 and 527 at 1024 × 768, docked. The source keeps its
  selection, and CodeMirror's scroll anchoring its top line as lines
  rewrap, but for one line back on closing at 1024 × 768. The Ritual
  Pug guide says the visual side widens for a hall. The `editor-split`
  documentation screenshot shows no hall being edited, so it is
  unchanged.

### The data

- **Sources.** The Golden Dawn's tablets are the Book of the Concourse
  of the Forces in Regardie's vol. 4 (1940; Sources), cross-checked
  against the Equinox's Plate III (1912) and Greer's redrawn plates.
  Each of the three was transcribed twice, independently (one
  transcription by a research agent, one by the stage agent, both from
  the scans at full size, both kept outside the repository); the two
  differ in one square, an Equinox U against V. The Tablet of Union is
  EXARP, HCOMA, NANTA, BITOM in all three (Regardie p.275, the Equinox's
  Black Cross on Plate III and its Plate VIII).
- **Squares with two letters.** Regardie prints a second, smaller
  letter in about twenty squares of each Watchtower, and once four
  (Water, row 5, square 12: y and l over N and h); he says either
  characterises the square, the higher being preferable (p.306), and
  the Order's names use both (Oblgotca, through Air of Water). The
  Equinox and Greer print one letter a square. While Gadi decides, the
  coordinator's instruction (21 October 2026): each square holds its
  letter, an optional `alt` and a `reversed` flag, its capital the
  letter's case, designed so that a source `version` can be added
  later; Earth and Air untouched; the letter choices in commits of
  their own. After the review, `alt` holds every other letter any of
  the three sources prints in the square (Regardie's first, the higher
  first, then the Equinox's and Greer's), so no reading is lost, and
  `reversed` says only that the grid's letter is printed reversed,
  never the `alt` letters: a flag per letter was the alternative, but
  only grid letters are printed reversed in any source, and a source
  `version` would carry its own grid and marks.
- **The model** (e7657d7): every row has `kind` (`watchtower` or
  `union`), and its grid is held to that kind's shape (13 rows of 12,
  4 of 5); a square is one Latin letter; optional `marks` name squares
  by row and column from 0 with `alt` (the other letters printed there,
  the higher first) and `reversed`. `WATCHTOWER_IDS` lists the four.
  The ids stay the bare elements, so Dee's 1584 table, Raphael's 1587
  revision and the Golden Dawn's can later be a `version` field or
  sibling tables without renaming a row; nothing is built for that now.
  New fields and rows are minor changes under the package's versioning
  (it is private at 0.0.0).
- **Water and Fire**: Regardie's letter, the higher where he prints
  two, except where both other sources print another letter and the
  Order's names through the square read it too: the Seniors as the
  Greer edition's "The Four Elemental Weapons" names them, and the names
  Liber Chanokh reads off Water (the Equinox, pp.235–236). Eight squares
  are read so, and a ninth, Water's four-letter square, takes N, as
  below. A test reads all
  twelve Seniors of Water and Fire and eight of Water's names off the
  grids. Reversed letters, marked, are those the Equinox prints in
  Enochian and Greer mirrors (Water's N and L, Fire's P and A); Fire's
  row 13 square 7 is a capital P, as the Equinox and Greer print it
  (Regardie prints O over p).
- **Variants, all for Gadi.** Every square where the three sources
  differ in Water or Fire, or where Regardie prints two letters ("Data"
  is what the package holds; case and u/v differences are noted only
  where they are the difference):

| Tablet, row, square | Regardie 1940 | The Equinox 1912 | Greer | Data, with `alt` | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Water 1, 6 | u over v | v | u | u; alt v | Agreed (u and v one letter) |
| Water 2, 1 | a over o | a | o | a; alt o | Keep a (higher; the Equinox). For Gadi |
| Water 2, 3 | b over l | l | l | l; alt b | l (Olgota, Aalco; both others). For Gadi |
| Water 3, 2 | o over a | o | a | o; alt a | Keep o (higher; the Equinox). For Gadi |
| Water 3, 7 | x over z | z | x | x; alt z | Keep x (higher; Greer; Laoaxrp). For Gadi |
| Water 3, 8 | m over i | i | m | m; alt i | Keep m (higher; Greer); the Equinox's INGM reads i. For Gadi |
| Water 3, 9 | a over n, u | n | a | a; alt n, u | Keep a (higher; Greer); the Equinox's INGM reads n. For Gadi |
| Water 4, 8 | i | l | l | l; alt i | l (Laoc; both others): Regardie's i looks a misprint. For Gadi |
| Water 4, 9 | l over a | a | e | l; alt a, e | Keep l (higher); the Equinox's Laoc reads a, Greer e. For Gadi |
| Water 5, 1 | f over p | p | p | f; alt p | Keep f (higher; no name settles it). For Gadi |
| Water 5, 3 | t over c | t | t | t; alt c | Agreed |
| Water 5, 7 | v over o | o | o | o; alt v | o (Laoaxrp; both others). For Gadi |
| Water 5, 11 | x over s | s | s | s; alt x | s (Vssn; both others). For Gadi |
| Water 5, 12 | y, l over N, h | N | N | N (reversed); alt y, l, h | N: four letters, no single higher one; both others print N. For Gadi |
| Water 6, 5 | z over x | z | z | z; alt x | Agreed |
| Water 6, 11 | c over L | o | o | o; alt c, L | o (Rvoi; both others), though Regardie prints neither. For Gadi |
| Water 9, 6 | n over a | a | a | n; alt a | Keep n (higher; Soniznt). For Gadi |
| Water 11, 6 | z over x | z | z | z; alt x | Agreed |
| Water 12, 1 | r over i | i | i | r; alt i | Keep r (higher; no name settles it). For Gadi |
| Water 13, 3 | i over r | i | i | i; alt r | Agreed |
| Water 13, 9 | n over a | n | n | n; alt a | Agreed |
| Fire 2, 11 | u over v | v | u | u; alt v | Agreed (u and v one letter) |
| Fire 2, 12 | a over i | a | a | a; alt i | Agreed |
| Fire 3, 7 | v over o | O | O | v; alt o | Keep v (higher; Alndvod). For Gadi |
| Fire 3, 9 | m over n | m | m | m; alt n | Agreed |
| Fire 4, 2 | p over b | b | p | p; alt b | Keep p (higher; Greer). For Gadi |
| Fire 4, 7 | c over d | d | d | d; alt c | d (Alndvod; both others). For Gadi |
| Fire 5, 5 | o | a | o | o; alt a | Keep o (Regardie; Greer). For Gadi |
| Fire 5, 6 | a | o | o | o; alt a | o (Adoeoet; both others): Regardie's a looks a misprint. For Gadi |
| Fire 6, 8 | b over v | b | b | b; alt v | Agreed |
| Fire 8, 3 | u over v | u | u | u; alt v | Agreed |
| Fire 10, 3 | l over b | l | l | l; alt b | Agreed |
| Fire 13, 7 | O over p | P | P | P (reversed); alt O | P (Arinnap; both others print P). For Gadi |

  Beyond these, case or u for v alone differs in four squares: Water's
  row 10 square 3 (Greer l for L) and row 11 square 8 (the Equinox U
  for V), and Fire's row 8 squares 1 (the Equinox and Greer p for
  Regardie's P) and 11 (both Z for z). Water's row 5 square 12 departs
  from the rule in a different way from its rows 5 and 12, square 1:
  there Regardie prints two letters, one plainly higher (f over p, r
  over i), and the higher stands though both other sources print the
  lower, since no name settles them; at row 5 square 12 he prints four,
  y and l side by side over N and h, so there is no single higher
  letter for the rule to take, and the grid takes N, one of his four,
  which both other sources print.
- **Earth and Air: an open decision.** They had no source. Read against
  the three, they are not the Golden Dawn's version: they differ from it
  in thirteen squares each. A research note compared them with a modern
  transcription of Dee's Great Table (Sloane MS 3191), with which they
  agree letter for letter but for every p being a capital; that
  transcription has no stable reference to cite and the manuscript was
  not read here, so the data and the page say only that they seem to
  follow Dee's table. The brief keeps them byte for byte until Gadi
  decides. Switching them to the Golden Dawn's, by the rule used for
  Water and Fire, would change these squares (row, square, from 1;
  current → Golden Dawn):
  - letters: Earth 3, 8 o → a; 8, 1 O → R (Regardie R over o; the
    others R); 8, 8 a → i (Regardie prints i and a side by side over b
    and t; the others i; either reading keeps the square); 10, 12 P → T
    (Regardie T over L; the Equinox L, Greer l; P is in no source).
    Air 6, 12 i → l (Regardie l over i; the others i); 11, 11 n → u
    (Regardie u over a; the others a; n is in no source). Air 5, 7 (n
    over m) keeps its m, which Htmorda reads and both others print, and
    Earth 11, 6 its i (Ahmlicv; Regardie prints only l, a misprint);
  - case: every capital P that the sources print p (Earth 1, 8; 4, 3;
    9, 10; 10, 2; 12, 3; 12, 12; Air 1, 11; 2, 8; 7, 11; 9, 7; 11, 9;
    13, 8), Earth 10, 6 L → l, Air 1, 8 Y → y, 3, 1 c → C, 7, 6 A → a;
  - u for v: Earth 2, 1 and 5, 12; Air 3, 11 and 10, 10;
  - and marks: the other letters the sources print in their squares,
    and the reversed letters (Air's O and A in rows 9 and 10, square 1; Earth's
    R and A in rows 8 and 9, square 1).
  None of this moves a square's place, so no hall layout changes; it
  redraws the Earth and Air tablets in `Tablet`, the page, the image
  route and the presets that hold them.
- **Colours: a question for Gadi.** Regardie's p.274–275: the Great
  Cross and the Calvary Crosses black on white; each tablet painted in
  its element's colour, its own angle lettered in the complementary
  (Air yellow, mauve letters; Water blue, orange; Earth black, green;
  Fire red, green), the other angles in their elements' colours. The
  existing tablets letter Air's own angle brown, not mauve, and Earth's
  white, not green; Water and Fire follow the book (`#59f` with orange, `#f33` with green); the
  Tablet of Union is white, its lines yellow, blue, black and red
  (p.275), the yellow darkened to `#d4a000` to read on white.

### The component and the page

- **`Tablet`** (3c86990) draws Water and Fire as Earth and Air are
  drawn, their sigils from geometry after Regardie's description
  (p.307): Water a blue cross potent with b, 6, 4 and b in its angles,
  on orange in a blue ring; Fire twelve wavy rays, alternately mauve
  and yellow, about a red centre and ring, on green in a red ring.
  The Equinox's Plate X puts Water's figures 4, b over b, 6; Regardie
  and Greer b, 6 over 4, b, which `Tablet` follows (for Gadi). Letters
  marked reversed are mirrored in their squares; `alt` letters are not
  drawn (a choice for Gadi: Regardie prints them small in the corner).
- **The Tablet of Union** draws on a page of its own, 124 × 104
  (`UNION_VIEWBOX`; `tabletViewBox(id)` gives each tablet's), its
  squares a Watchtower's size, with no sigil. A key the data does not
  have draws an empty page rather than throwing.
- **Earth and Air draw the same bytes** for both fonts and frames: a
  test pins their SHA-256 from f809947, and every preset snapshot
  holding them passed unchanged.
- **`/enochian/tablets`** and the `enochian-tablet` image offer Water
  and Fire. The image contract has one viewBox for every id, which the
  Tablet of Union's page does not fit, so the Union is not on the page
  or the route yet (Follow-ups). The image spec now reads each tablet's
  `kind` and `marks` as well as its `grid`, and lists Water and Fire, so
  its inputs hash moved (pinned anew; Earth and Air bytes unchanged);
  the whole-data render sweep (`RENDER_INPUT_SWEEP=1`) passes. The SEO
  description names the four. No documentation screenshot shows the
  page.

### The hall

- **`tablet(element)`** (48664e4) takes earth, air, water, fire and
  union; the validator, the properties panel's select and the Pug round
  trip follow from the art's attribute. A Watchtower keeps its
  210 × 297 board (decision 4: Earth and Air lay out as before); the
  Tablet of Union stands on a 124 × 104 board, so at the one default
  scale per kind (1.345) it is 2.69 × 2.26 squares. The editor names it
  "Tablet of Union".
- **The presets** (65bf16a) draw each tablet where its marker stood:
  Fire on the South wall line and Water on the West, inside, as Earth
  stands on the North (conflict 7); the Tablet of Union in Portal 1's
  East row at the marker's scale (0.9). At the default scale the
  Philosophus Fire tablet would overlap its lamp, its incense and, in
  4=7, the Hegemon, and Portal 1's Water tablet the Hiereus, so those
  draw at scale 1 (2 squares along the long side); Portal's Fire and
  Portal 2's Water keep the default, as Earth does. A Watchtower on the
  West wall is portrait, so its long side runs into the hall rather
  than along the wall (the hall draws nothing rotated). A test holds
  that the six halls draw their tablets, name none in a marker, stand
  them on their walls or beyond the East, and overlap nothing.

### Review fixes

Two independent reviews (Opus and Fable) found no blocker; their
letter checks matched the scans square by square. Their fixes were
folded into the commits they belong to (the branch rewritten with
`git commit --fixup` and an autosquash; Commits lists the new ones),
and the letter corrections, first made in a commit of their own, were
folded into the data commit, so `main` never carries the intermediate
letters. Two fixes are commits of their own.

- **`alt` and `reversed`.** `alt` now holds every other letter any of
  the three sources prints in the square, so Regardie's single letters
  where the grid reads otherwise are kept too (Water row 4 square 8, i;
  Fire row 5 square 6, a), and the Equinox's and Greer's where they
  differ (Water row 4 square 9 gains Greer's e, Fire row 5 squares 5
  and 6 the Equinox's a). `reversed` describes the grid's letter only,
  as the schema and the data file now say; Water's N and Fire's P carry
  `alt` letters that are not reversed. A flag per letter was the
  alternative; no source prints an `alt` letter reversed, and a source
  `version` would carry its own grid and marks, so the flag stays on
  the square.
- **Water row 5 square 12** is explained beside the rule in the data
  file and above: four letters, no single higher one.
- **Fire's capital P** rests on the sources (the Equinox and Greer
  print P), not on how a mirrored p would look.
- **Colours**: Regardie letters Earth's own angle green (p.275), not
  white; the existing component letters it white (corrected above).
- **Citations**: Greer by edition and ISBN, by the plates' titles (the
  colour insert is unnumbered, and Gadi's copy is a reflowed ebook);
  the Equinox's file named within its archive.org item; the Equinox's
  Fire row 2 square 11 is a lowercase v.
- **The image contract's viewBox** is written out rather than imported
  (the contracts are imported widely and must not pull in `Tablet`); a
  test holds it equal to `WATCHTOWER_VIEWBOX`. The image spec's comment
  says why `marks` is hashed whole, its undrawn `alt` too: a field path
  cannot select inside an array.
- **An accessible name** (a7b46b3): `Tablet` is `role="img"` with a
  `<title>` ("Enochian Watchtower of Fire", "Tablet of Union"), so the
  page's Earth and Air tablets change bytes, deliberately. The hall and
  the image route draw it with `label={false}`: the hall drawing names
  itself, so no preset snapshot moves, and the published Earth and Air
  images keep their bytes (a page showing one gives it alt text); the
  f809947 hashes are pinned for that unnamed form.
- **Tests**: the presets' overlap test covers officers' and other
  labels and marker text as well as objects; a render test of
  `/enochian/tablets` checks its four tablets by name and their letters.
- **The hall editor failing to load** (d34635e, found in review, older
  than stage G): Edit hall loaded the editor through `next/dynamic` with
  no boundary, so a chunk that could not be fetched took down the whole
  ritual editor. A boundary now ends the editing (dropping the
  attribute that widens the split), draws the hall again, gives Edit
  hall back and says "Couldn't load the hall editor; reload to try
  again." A test makes the chunk fail.
- **For Gadi, decision renders** outside the repository, in
  `/home/dragon/.cache/gdhall-g/decide/` (README there): contrast with a
  thin dark letter outline, and Earth with green letters; Earth and Air
  as now beside the Golden Dawn reading, the changed squares marked;
  `alt` letters drawn small in a corner or not; the Water and Fire
  sigils as Regardie and as the Equinox draw them.

### Notes on the versions (Gadi's request of 21 October 2026)

Gadi liked the research on the variants and asked for it to be kept in
magick-data and shown on `/enochian/tablets`.

- **The data** (68d96bc): `enochian/tabletNotes.json5`, a text rather
  than a table, in our own words, facts only: the versions (Dee and
  Kelley 1584, Raphael's Tabula recensa of 1587, the Golden Dawn, and
  the printings), how they differ (letters; squares with two letters
  and the higher-letter rule; reversed letters; Earth's eighth row; the
  Tablet of Union as the Order's, its letters those of the Black Cross;
  the elements and quarters; colours and pyramids), a note on each
  tablet, and notes on 70 squares (Water 22, Fire 13, Earth 15, Air 20),
  each with what Regardie, the Equinox and Greer print there. Squares
  count from 0 as the tablets' `marks` do, so a square's note sits beside
  its mark and a source `version` can hang off the same keys. Works are
  cited by stable reference: archive.org items and leaves, British
  Library shelfmarks (Sloane MS 3191; Cotton MS Appendix XLVI through
  Casaubon's 1659 printing), Greer's ISBN. The subpath
  `magick-data/enochian/tabletNotes` (`squareNote`, `squareNotes`,
  `sourceText`, `sourceUrl`) is its own, so the hall's chunk, which
  draws tablets, carries none of the prose. Tests hold the notes to the
  tablets (every tablet noted; squares inside their grids, once each;
  every marked square of Water and Fire noted, and every letter its grid
  or `alt` holds one a source prints).
- **The page** (4f7c9e9): under the tablet, a section on it (version,
  sources) and "About these tablets" (the versions and the differences,
  each with its sources linked to their scans). A switch, "Show where
  the sources differ", outlines the noted squares and lists them as
  buttons; choosing one, from the list by keyboard or on the tablet by
  pointer, shows what each source prints there, the note and its
  sources in a polite live region. The outlines are drawing only, the
  tablet being one image to a screen reader; the list is the accessible
  way in. `Tablet` takes `highlights` and draws the same bytes without
  them. The SEO description mentions the notes; no documentation
  screenshot shows the page. Checked in headless Chromium at 1440 × 900
  (classic scrollbars) and 390 × 844 (touch emulation): the switch by
  Space, a square by Enter and by a click on the tablet, no horizontal
  scroll, no console errors.
- **The claims about Dee's and Raphael's tables** rest on the shelfmarks
  and the printed diaries, not on reading them here; they are kept to
  what those records are and what the later printings show.
- **Review fixes** (an independent review found no blocker; each fix
  folded into its commit): Earth's and Air's notes no longer say they
  are Dee's table, only that they differ from the Golden Dawn's in
  thirteen squares each (Air's count corrected from fourteen; a test
  derives both from the square notes' new `goldenDawn` letters) and
  that a comparison with a modern transcription suggests they follow
  Dee's, since that transcription cannot be cited; the notes speak of
  "this tablet", not "the data"; the reversed letters spell Paraoan,
  a governor's name, but for Water's last letter, an L; the second
  letters' cause, the Great Table's cross and a near-quotation of
  Regardie are gone; Casaubon's 1659 printing is cited by its
  archive.org item, `truefaithfulrela00deej` (its OCR finds no Tabula
  recensa, so no leaf is given). On the page, only a one-line summary
  is announced; the tablet's section (h2) now holds the squares (h3);
  a second tap on a square clears it and a square chosen on the tablet
  scrolls its detail into view; while the outlines show, the downloads
  draw them and the image links give way to a note; the cursor is the
  page's CSS, not inline in the drawing. `Tablet` is named by an
  `aria-label`, which shows no tooltip over the squares, instead of a
  `<title>`. The hall editor's boundary says "The hall editor failed;
  reload to try again.", since it also catches an editor that loaded
  and then threw.

### Bundle

From the gates' production builds (webpack), gzip -6. At f809947 the
reader's hall drawing loaded one chunk of 277,262 bytes (94,153
gzipped), `Tablet` and its two rows inside it. At d34635e `Tablet` and
the five rows (magick-data's `enochian/tablets` subpath, as before) are
a chunk of their own, 13,014 bytes (4,391), which the hall chunk, now
270,187 (91,519), and the `/enochian/tablets` page share: 283,201 bytes
(95,910) in all, 5,939 (1,757 gzipped) more, for the two new sigils,
the Tablet of Union, three rows, their marks and the accessible name.
No other table entered either chunk (no barrel names in them). The
chunk holding the presets (the Insert dialog, the slash command and
`/gd/hall`) went from 25,232 bytes (7,767) to 25,257 (7,777). At 4f7c9e9,
with the outlines `Tablet` can draw, the shared chunk is 13,410 bytes
(4,563) and the hall chunk unchanged; the notes' prose is only in the
`/enochian/tablets` page's chunk (36,362 bytes, 7,470 gzipped), none of
it in the hall's.

### What was verified, and how

- **Gates**, per commit, each in a clean `git archive` export with Node
  24 and the CI placeholder environment (`pnpm check`, `typecheck`,
  `test:coverage` with the per-file thresholds, `build`): all 0 for
  026a55a, f809947 and, after the review fixes, e7657d7, ce0b8c3,
  3c86990, 48664e4, 65bf16a, the plan, a7b46b3, d34635e, the plan's
  update, 68d96bc and 4f7c9e9. (Before
  the rewrite, one run of the Tablet commit failed one test outside this
  work, `SqlDocAdmin.test.tsx`, its Source button not found at a load
  average near 40; it passed on a rerun and in every later gate.) The
  tip also passed `loom check`, the magick-data smoke test (which now
  loads the tablets) and `pnpm check:turbopack`. `Tablet.tsx` joined
  the coverage list. The whole-data render sweep
  (`RENDER_INPUT_SWEEP=1`) passed on the Tablet commit's changes and
  after the letter corrections. The compiler is untouched:
  `semantic.ts`, `semanticCompilerImpl.ts` and `ritualNodeIds.ts` have
  no diff.
- **In the browser** (Turbopack dev server from this branch on
  127.0.0.1:3297, headless Chromium over CDP with classic 15 px
  scrollbars; nothing signed in or saved): `/enochian/tablets` lists
  Earth, Air, Water and Fire, draws each with 156 letters (Water's N
  and L and Fire's P and A mirrored), links each to its image, and
  draws Fire in the Enochian font; at 390 px no horizontal scroll.
  `/gd/hall` draws Portal 1 (five tablets), Portal 2 (four) and
  Philosophus 1 (one) with no warnings; the Tablet of Union, clicked,
  is selected as "Tablet of Union", and its Element select offers
  earth, air, water, fire and union; the source reads
  `tablet(element="union", x=8, scale=0.9)`. No console errors.
  Screenshots are outside the repository.

## Stage H notes

Built on `gate/gd-hall-h` (23 October 2026), from `main` at 570e5f8,
after a design round outside the repository (three directions, mock-ups
at real sizes) and Gadi's decisions of the same day. This is the core
of the stage: the third-party art is gone. What Gadi has not decided
yet is listed at the end and in Follow-ups.

### Gadi's decisions (23 October 2026)

- **One style for everything**: direction A, the flat emblem: flat fills
  from the hall's palette, one black outline, one accent per object,
  plus a single white highlight on metal (from direction C). It matches
  the first-party art already in the hall (the gong, brazier, candle,
  pillars and pantacle), reads at 16 to 24 px on the checker and on the
  black altar, and needs no gradients, ids or `<defs>` of its own.
- **Boxes stay**: every item is drawn into the box the old drawing had
  (decision 4's layout contract), so no saved hall or preset moves. The
  Zelator test that pins the lantern, the salt and the tablet passes
  with the presets untouched.
- **What the items are**: the salt a shaker (more recognisable than a
  cellar), the bread a round loaf, the censer standing, the rose
  heraldic; the lights per the rituals (below).
- **Lamens**: the caduceus and the Eye of Horus as drafted; `Lamen`
  moves to the MIT directory.
- **Seals deferred**: the placeholder stays (Follow-ups).

### The palette

`PALETTE` (`art/shared.ts`) gains the items' materials. The gold stays
the hall's gold, as on the banners and the gong, with the named `gold`
as its deep tone; the outline is one weight for every item.

| Entry | Colour | Used for |
| --- | --- | --- |
| `gold` (existing) | `#fae513` | cup, chalice, the rose's seed, the gong's boss |
| `goldDeep` | `#d4a017` | rims, knops and the chalice's band |
| `silver` | `#d3d7dc` | the censer, the salt's cap |
| `bronze` (existing) | `#b08d3c` | the lantern, the censer's band and finial, the fan's guards |
| `wine` | `#7a0c1e` | the cup's wine |
| `rose` | `#d92128` | petals, the chalice's jewels |
| `green` | `#108010` | the rose's stem, leaves and barbs |
| `bread`, `crumb` | `#e3a857`, `#f6d79a` | the loaf, its scored crust |
| `air` | `#ffe000` | the fan, the flame's core |
| `glassRed`, `glassYellow`, `glassWhite` | `#ff9a8a`, `#fbf0b8`, `#ffffff` | a light's panes |
| `flame`, `fire` (existing) | `#ff9a1f`, `#d92128` | flames, the censer's glowing piercings |

`ITEM_OUTLINE` is black, 3.6 units in a drawing 100 units on its longer
side, round joins, set on each drawing's group so its shapes give only
fills; `ITEM_DETAIL` (2.4) is for the few inner lines (a few tiny parts,
the jewels, thorns and fan ribs, are hairlines of 1.2 to 1.6), and
`HIGHLIGHT` is a 2.6-unit white stroke along the lit side of metal (the
cup, chalice, censer, salt cap and lantern roof). The rose, small and
many-petalled, is drawn in the detail width throughout. The gong, the
brazier and the candle took the same weights (their outlines were 3
and 2, inner lines 1.5 to 2).

### The items

All in `src/components/gd/hall/art` with `original()` provenance and
`sameForEveryNode` variants (the lights excepted), drawn from geometry:
lathe profiles written as their right half and mirrored (`mirrored`),
smooth curves through points (`smoothPath`), polar points; no image was
traced or sampled, the old drawings were looked at only for what each
item shows and how big it is.

| Kind | Box (unchanged) | Drawing | Module |
| --- | --- | --- | --- |
| cup | 76.67 × 100 | a wide gold goblet, wine at the brim | `vessels.tsx` |
| chalice | 56.17 × 100 | a taller bowl, a jewelled band, two knops | `vessels.tsx` |
| censer | 73.69 × 100 | standing: a domed silver lid, pierced and glowing, on a bowl, stem and foot | `vessels.tsx` |
| lamp, lantern | 60.09 × 100 | a lantern: ring, roof, glazed panes, flame, stepped base | `lights.tsx` |
| rose | 100 × 36.35 | heraldic: five petals over five, barbs, seed, on a stem with two leaves and two thorns | `altarItems.tsx` |
| salt | 42.41 × 100 | a shaker: pierced silver cap, a glass of salt marked with salt's sign | `altarItems.tsx` |
| bread | 100 × 100 | a round loaf, scored three times, 80 tall (review) | `altarItems.tsx` |
| fan | 100 × 62.79 | folding, Air's yellow, twelve ribs, scalloped | `altarItems.tsx` |

The nine join `CORE_ITEM_KINDS`, so the validator knows them without
the app's registry.

### Lamps and lanterns

The rituals need a red light and a yellow one. `0=0.pug` puts a red
lamp on the altar and gives the Keryx "lamen, lamp, and wand", the
"Lamp of Hidden Knowledge" he raises; `1=10.pug` asks for a red light
on the altar; `2=9.pug` sets the elements' fan, lamp, cup and salt
round the altar diagram. The presets draw red lamps (the Neophyte and
Zelator altars, the Practicus and Philosophus stations and altars), yellow
lanterns (the Zelator's North wall and altar, the Theoricus' before the
dais and on the altar), and the Portal's white lamp.

- **One drawing, two kinds.** A lamp and a lantern draw the same
  lantern, as the old drawings did (their lanterns were the lamp
  stretched). They stay two kinds: their default scales differ (0.47
  and 1.19, 0.94 and 2.38 squares tall), which is the layout contract,
  and saved halls and the presets name both.
- **`light`**: `red`, `yellow` or `white`, the colour of the panes; a
  lamp is red and a lantern yellow by default, as before. The name says
  what it colours, as `fill` and `stroke` do, and is none of decision
  2's reserved names. It is the lights' art attribute (`HallArt.attributes`),
  so the validator checks it on lamps and lanterns and reports it on any
  other item, the properties panel offers it as "Light colour" for those
  two only, and the Pug round trip carries it like any attribute (the
  Portal 1 preset's `item(kind="lamp", light="white", …)`). The variant
  is the colour drawn, so a hall carries at most three drawings per
  kind, six in all.
- **Earlier halls.** The glass used to take the generic `fill`; a lamp
  or lantern saved with `fill` red, yellow or white still draws it when
  it has no `light` (other colours draw the kind's default). The Portal
  1 preset now says `light="white"`. Any other `fill` on a light, or one
  beside `light`, draws the kind's default, so the validator warns
  "item: fill no longer colours a lamp; use light (red, yellow or
  white)", and the panel names that field "Fill (old light colour)"
  (shown only where a hall still has it); a label rather than an offer
  to move the value, which would be a second kind of edit for one old
  attribute.
- **The panel** offers `fill`, `stroke` and `dir` only to the items
  that draw them (`fill` to crosses, triangles and pentagrams, `stroke`
  to those and the lightning, `dir` to triangles and pentagrams), or
  when a node already has them; it used to offer colours to every item
  and hid a pentagram's `dir`.

### The lamens

- **The caduceus** (`Lamen`'s Keryx glyph): a staff and ball, two wings
  (one hand-written path, flipped), and two serpents
  `x = ±A·sin(2π·0.75·t)`, widening from the tail, sampled at 16 points
  and drawn smooth to one decimal: one crossing and two thick coils,
  the heads below the ball (after the review, for the 20 px role icon;
  the first version had 1.25 turns, thinner serpents and heads over the
  ball). The serpents lie on a halo of the disc's black, and each is
  drawn again on its halo where it passes over the other, so they
  interlace with no ids or masks. Scaled so the wings stay inside the
  disc. The Keryx's role icon is 4,429 bytes of markup,
  against 5,832 with the SVG Repo icon; the Sentinel's 1,022, against
  3,517.
- **The Eye of Horus** (the Sentinel's): the brow, the eye and pupil,
  the line from the outer corner, the drop and the spiral, a few
  strokes after the wedjat's ancient form, facing as before.
- Both stay white on the black disc and serve as the ritual role icons
  at 20 to 25 px (`roles.tsx`, the reader), where they read as before
  (the sheets below).
- **The move.** `Lamen` is `src/components/gd/Lamen.tsx` (MIT); its
  only imports are the package's geometry and `svgCoordinate`. The
  package's `lamen` art draws through it, with the plain circle for an
  officer without a role and for the adepts, so `lamenArt.tsx` is gone
  and the app's registry adds only the tablets' Enochian font. The role
  icons and `/gd/components` import it from the package; its test moved
  with it. `/about#credits` keeps the two credits, now for the old
  drawings in `public/pics` that still embed the icons, until stage I
  (decision 9).

### Output

Every drawing is still drawn once per hall in `<defs>` and placed with
`<use>`; none defines an id, a gradient or a pattern, and their paths
are computed once at module load, to two decimals. The presets' SVG,
as the committed snapshots hold it (`src/app/gd/hall/__snapshots__`,
one tag per line), shrank with the legacy paths: the Neophyte from
57,720 bytes to 27,906, Zelator 2 from 314,583 to 113,863, Practicus 1
from 101,418 to 14,551.

From the gates' production builds (webpack), gzip -6, with the same
method before and after. At 570e5f8 the reader's hall drawing loaded one
chunk of 270,187 bytes (93,777 gzipped); at 3bcc110 it is 76,481
(27,444), the 122 KB chalice, the 70 KB censer and the other lifted
paths gone. `Lamen` sits in a shared chunk the reader's role icons load
(30,054 bytes, 12,003 gzipped, before; 25,208, 9,119, after) and in one
lazy chunk (42,467, 16,636; now 37,622, 13,885), so moving it changed
no chunk boundary. All JavaScript chunks: 8,159,958 bytes before,
7,956,929 after. (Before the review fixes, at the first version of the
move, the hall chunk was 76,241 bytes, 27,350 gzipped.)

### Sheets for Gadi

Outside the repository, in `~/.cache/gdhall-h/impl/sheets/`: every
preset before (main at 570e5f8) and after, side by side at reader width
(`01-neophyte.png` to `14-portal2.png`), the ritual role icons at 20, 25
and 40 px before and after (`15-role-icons.png`), and every item at 16,
24, 40 and 120 px and on the altar, before and after (`16-items.png`).

### What was verified, and how

- **Gates**, per commit, each in a clean `git archive` export with Node
  24 and the CI placeholder environment (`pnpm check`, `typecheck`,
  `test:coverage` with the per-file thresholds, `build`): all 0 for
  every commit before the review (8e60545, 1bc6756, 58e9911, 6e5e235,
  and the glyphs and the move as 9ef4c5e and 050c41b) and again for
  every commit the review fixes rewrote (aa92abd, 158a48f, f26ae70,
  10d8c1f, 3bcc110; 8e60545 is unchanged). The tip, with this plan,
  also ran `loom check`, the magick-data smoke test and `pnpm
  check:turbopack`, before the review and after. The compiler is untouched: `semantic.ts`,
  `semanticCompilerImpl.ts` and `ritualNodeIds.ts` have no diff, and
  `src/components` imports no app code (the boundary test).
- **Snapshots** were regenerated in the commit that changes each
  drawing; the presets' SVG differ only in the redrawn items and the
  two glyphs (and, from the first commit, the gong's, brazier's and
  candle's stroke widths).
- **In the browser** (Turbopack dev server from this branch on
  127.0.0.1:3361 with placeholder settings, headless Chromium over CDP;
  nothing signed in or saved): `/gd/hall` draws the Neophyte preset
  with no placeholder and no console error; clicking the altar's lamp
  selects "Lamp · item" and the panel offers "Light colour", not Fill
  or Stroke (checked before the review fixes; the label for a light's
  old `fill`, the warning, the loaf, the chalice's rim and the
  caduceus are covered by tests and the sheets). The bundled `/doc/neophyte` reader draws its role icons with
  the new glyphs (92 of the Keryx, and the Sentinel's). A ritual from the database
  with a hall was not opened (no sign-in): its block draws the same
  `GdHall` with the same registry, and `readerBoundary.test.ts` holds
  that the reader loads it, `Lamen` included, as before.
- **Help screenshots** were not recaptured: none shows the new art.
  The ones of the ritual editor and reader do show the old drawing
  (`/pics/neophyte.svg`, with its third-party caduceus and eye, which
  `/about` credits), since the built-in Neophyte shows it until stage I,
  but no `gdHall` and no Keryx or Sentinel role icon.

### Review fixes

Two independent reviews (Opus and Fable) found the drawings original
and every placement in the 14 presets byte-identical. Their fixes were
folded into the commits they belong to (the branch rewritten with
`git rebase -i`, each commit amended at its own place so its snapshots
are its own; Commits lists the new ones):

- **Credits kept** (major): the glyphs commit had removed `/about`'s
  credits, but the old drawings the built-in rituals still show embed
  both icons (decision 9). Both are back, worded for those drawings.
- **Old light colours** warned about and labelled (above).
- **A bigger loaf**: it filled about 57 % of its box and read as the
  smallest item on the altar; it is now 80 units tall (y −40 to 40) in
  the same box.
- **Inside their boxes**: measured in Chromium (each shape's box plus
  half its stroke), only the chalice's rim reached past its box (to
  −50.3); it sits 0.5 lower. The cup's rim (±37.3 of ±38.3) and the
  fan's scallops (−30.8 of −31.4) were inside.
- **The caduceus at icon size**: fewer, thicker coils, heads below the
  ball and the wings a little deeper (above; `15-role-icons.png`).
- **Not done**: deriving the panel's `fill` and `stroke` from the art's
  declared attributes. They belong to the `item` tag's own vocabulary,
  which every item is validated against and saved halls use; moving them
  into the crosses', triangles', pentagrams' and lightning's art would
  make them unknown attributes, with warnings, on every other item. The
  panel's `SOME_KINDS` table stays, beside the art that reads them.

### Waiting for Gadi

Kept as they are, as Gadi asked, until he decides:

- **Seals** (deferred): the placeholder stays. The follow-up is to
  adapt `/gd/sigils`, which draws sigils on the Golden Dawn's rose, to
  draw sigils on the kameas, and then decide what the hall's `seal`
  shows (the traditional seals after Agrippa's 1533 woodcuts, or
  generated figures, and whether name sigils belong in the hall).
- **Pan, the Devil, Death and Typhon** (Portal 2): drawn figures, tarot
  keys for Death and the Devil with emblems for Pan and Typhon, or
  labelled markers.
- **The Garden of Eden and the Fall**: drawn schematically, or labelled
  boards.
- **The adepts' lamens**: what each shows.
- **Tree markers**: "Venus on the Tree of Life", "Mercury" and the
  serpent on the Tree, drawn over `TreeFigure` or kept as markers.
- **The Minutum Mundum's path colours**, which need path colour data in
  magick-data.

## Tablet versions

Built on `gate/enochian-versions` (24 October 2026), from `main` at
2b07004, after Gadi's decisions of that morning on the research into
Dee's tables (outside the repository, in `~/.cache/tablets-dee/`:
`README.md`, `sources.md`, `diffs.md`, `grids.json`).

### The principle

In Gadi's words (24 October 2026): "we want to accommodate Enochian
practitioners from both traditions; for gdHall we use the Regardie/GD
version, but we also accommodate Dee purists." The Golden Dawn's version
is the default everywhere, and the only one a hall draws unless told
otherwise; Dee's tables of 1584 and 1587 stand beside it, from his own
records. The magick-data README says the same.

### Gadi's decisions (24 October 2026)

1. **Versions.** One concept, `version`: `gd` (the default, the Golden
   Dawn's by the rules of Stage G: Regardie's higher letter, the
   name-based corrections and the variants table's recommendations),
   `regardie` (his 1940 print exactly, higher letter), `equinox` (the
   1912 print), `dee` (the 1584 table as Dee corrected it, which the
   angel approved, with the first-dictated letters recorded) and
   `raphael` (the Tabula recensa of 1587). Each source's reading is
   stored square by square, and a version is a rule over the readings,
   not a copy. Earth and Air take the Golden Dawn's version too; their
   old letters, which are 1587's, become Raphael's reading in the 1659
   print's case. Dee's Black Cross stays out of the data for now.
2. **Differences both ways**, each version against each other, the
   facts generated from the readings and the prose our own.
3. **`Tablet`** takes `version`, `reversed` and `alt`; the sigils follow
   the version.
4. **`/enochian/tablets`**: a version picker, the version's notes and
   differences, the existing differences view across versions, and
   switches for reversed and second letters.
5. **The hall**: `tablet(element, version)`, `gd` when absent.
6. The principle above, recorded here and in the README.
7. The British Library follow-up, and 8. the kamea follow-up (below).

Two questions are not decided, and the recommendation is built where
it is cheap to change (below): what the two empty Fire squares of 1584
mean, and Cotton's x against Sloane's p in two Fire squares of 1587
(follow the print).

### The data

- **The model** (6db02d5). A tablet row is `id`, `kind`, `readings` and,
  for Watchtowers, `choices`. `readings` holds each source by key,
  `regardie1940`, `equinox1912`, `greer`, `dee1584` and `raphael1587`
  (`TABLET_SOURCES`): its `rows`, one character a square ("." for an
  empty one, the first letter where several are printed) and `marks`
  for the squares that hold more: `beside` (letters on the same line,
  Regardie's "yl"), `below` (his second letters), `reversed`,
  `dictated` (the letters first written down in 1584, where Dee later
  corrected the square), `misprint` (what the 1659 print has where every
  other witness agrees otherwise), `alt` (other readings within the
  version's witnesses) and `doubt` (low, medium or high). `choices.gd`
  lists the eleven squares where the Golden Dawn's version takes the
  Equinox's letter rather than Regardie's higher one (Stage G's nine in
  Water and Fire; Air's row 5 square 7, m, by Htmorda; Earth's row 11
  square 6, i, by Ahmlicv). The Tablet of Union has the three Golden
  Dawn readings only.
- **The versions** are code (`Tablets.ts`, MIT): `TABLET_VERSIONS`
  (`gd`, `regardie`, `equinox`, `dee`, `raphael`),
  `DEFAULT_TABLET_VERSION` and `tabletVersion(tablet, version)`, which
  resolves a frozen, cached view (`grid`, with `null` for an empty
  square, and `marks` with `alt`, `reversed` and `doubt`), or
  `undefined` where a version has no such tablet. `gd`: Regardie's
  higher letter but where `choices.gd` says; `alt` every other letter
  Regardie, the Equinox or Greer prints (Regardie's all, the others'
  where they add more than case or u for v, which reproduces Stage G's
  marks exactly); reversed letters the Equinox's. The others take their
  source's letters, reversed letters and doubts, and `alt` from
  `beside`, `below`, `dictated` and `alt`. `tabletDifferences(a, b)`
  lists the squares where two views differ, as `letter`, `uv`, `case` or
  `empty`. A new source is a new key in `readings`, a new version a new
  id and rule: no tablet's id moves.
- `grid` and `marks` left the rows: a breaking change, which the
  package's 0.0.0 and privacy allow. Its readers in the app (`Tablet`,
  the image spec, the page) moved with it.
- **Dee 1584.** From Casaubon's *A True & Faithful Relation* (1659,
  archive.org `truefaithfulrela00deej`), pp.175–177 (leaves n264–n266),
  with Dee's corrections (p.185, n274; p.188, n277: the tables true,
  both readings of a name true, the capitals well corrected). As
  corrected: Air row 3 square 7 r (first written v), Water row 5 square
  3 t (c), row 5 square 12 N reversed (y and l), row 13 square 4 n (i);
  every later copy has the corrected letter. Case is Casaubon's type,
  and he sets Earth's row 8 square 1, a reversed R, as the ligature Æ,
  which the header of `tablets.json5` records. Reversed: the eight
  smallest letters Dee picked out (pp.179, 183), which spell Paraoan;
  the print marks Fire's P and A (its margin) and Water's L (its sort)
  reversed, and p.183 asks after the "averted" L; the other five rest on
  later copies as modern renderings show them (doubt medium).
- **The two empty Fire squares** (row 1 square 12, row 2 square 11) are
  empty in every 1584 witness read: printed as dots, and empty in a
  modern rendering of the Cotton manuscript. As recommended, the
  `dee1584` reading has "." there, with Raphael's 1587 letters (a, v)
  as `alt`; `Tablet` draws them blank and the hall and the image with
  it. Changing the decision is two characters and two marks in
  `tablets.json5` (the `dee1584` reading of `fire`), the notes'
  `emptyFire` topic and two square notes, and the tests that pin them.
- **Raphael 1587.** From the same book's "Actio Tertia", second
  pagination, p.15 (leaf n456): the print's letters and case, mostly
  small letters, in ten squares a misprint corrected to the letter
  every other copy of Dee's tables has (`misprint` keeps the printed
  one; the Golden Dawn's sources are not counted, so Fire's row 6
  square 8, where the print's v is Regardie's second letter, b over v,
  has doubt medium and a note: it may be the Cotton copy's reading); the
  print's q in Fire's last row is its reversed p. Fire's row 8 square 1
  and row 12 square 4 follow the print, x (from the Cotton manuscript),
  with Sloane MS 3191's p as `alt` (doubt high). Its capitals, from
  Sloane MS 3191, are known only through Peterson's and Vovina's
  renderings (cross-checks, never cited), so they wait for the British
  Library (below). Reversed: seven of Dee's eight; Earth's R left the
  table when its eighth row moved one square left.
- **Earth and Air** now read the Golden Dawn's by default: thirteen
  squares change in each, exactly the list in Stage G's notes. Raphael's
  reading holds the old letters, u and v and case aside (a test pins
  them).
- **The research findings** are in the notes, cited by stable
  reference: Earth and Air's old letters are 1587's, not 1584's; many
  of Regardie's doubled squares pair the 1584 and the 1587 letter,
  nearly always 1587 above, and Earth's eighth row is the 1587 row over
  the 1584 row, which the notes call an inference; giving a whole
  Watchtower an element is the Golden Dawn's (Dee gives elements to the
  angels under each lesser cross, p.181); the Tablet of Union is the
  Order's, from Dee's Black Cross letters (pp.179–180).

### The notes

`tabletNotes.json5` is rewritten around the versions (6db02d5): an
`intro` (the principle, for readers); a note per version (`text`,
`reversed`, `sigils`, `sources` and `differs`, a paragraph on how it
differs from each of the four others, so twenty in all, in both
directions); nine topics on how the versions differ (letters, second
letters, reversed letters, Earth's eighth row, the empty Fire squares,
the Tablet of Union, elements and quarters, sigils, colours); a note per
tablet; and 59 square notes. A square note is prose and sources only:
what each source prints there, and the counts and squares where two
versions differ, are read from the readings (a test holds the prose to
no counts of squares but the sources' own: four corrected, ten
misprints, two empty). New works: Cotton MS Appendix XLVI, and
`casaubon1659` cited by page and leaf, the 1587 table by part
("Actio Tertia").

### Counts of the differences

Squares that differ in letter or by an empty square, per Watchtower,
with every difference (u for v and case too) in brackets:

| Versions | Earth | Air | Water | Fire | All four |
| --- | ---: | ---: | ---: | ---: | --- |
| gd / regardie | 1 (1) | 1 (1) | 6 (6) | 3 (3) | 11 (11: 0 u/v, 0 case) |
| gd / equinox | 10 (10) | 6 (8) | 7 (9) | 3 (6) | 26 (33: 3 u/v, 4 case) |
| gd / dee | 12 (15) | 6 (13) | 7 (9) | 4 (8) | 29 (45: 1 u/v, 15 case) |
| gd / raphael | 4 (29) | 2 (28) | 5 (29) | 2 (27) | 13 (113: 7 u/v, 93 case) |
| regardie / equinox | 11 (11) | 7 (9) | 13 (15) | 6 (9) | 37 (44: 3 u/v, 4 case) |
| regardie / dee | 13 (16) | 7 (14) | 11 (13) | 7 (11) | 38 (54: 1 u/v, 15 case) |
| regardie / raphael | 5 (30) | 3 (29) | 9 (32) | 5 (29) | 22 (120: 7 u/v, 91 case) |
| equinox / dee | 4 (7) | 2 (9) | 7 (11) | 5 (7) | 18 (34: 3 u/v, 13 case) |
| equinox / raphael | 11 (35) | 5 (31) | 7 (30) | 5 (30) | 28 (126: 6 u/v, 92 case) |
| dee / raphael | 13 (34) | 5 (32) | 2 (26) | 6 (29) | 26 (121: 5 u/v, 90 case) |

Dee's 1584 table and Raphael's 1587 differ in 26 squares, as the
research found: Earth's eighth row (12), the three Fire squares 1587
fills or changes, Fire's two x squares, and nine elsewhere. Case
dominates every comparison with Raphael's, whose print is in small
letters.

### Defaults chosen

- **Reversed letters** are mirrored by default in every version; a
  version marks only what its source marks: `gd` and `equinox` the
  eight the Equinox prints in Enochian, `regardie` none (he prints them
  plain), `dee` the eight Dee picked out, `raphael` seven of them.
- **Second letters** are off by default.
- **Sigils**: Regardie's for `gd` and `regardie`; the Equinox's for
  `equinox`, from its Plate X, in black (Water's figures 4 and b over b
  and 6; Earth a plain cross potent; Fire's rays straight and wavy by
  turns); none for `dee` and `raphael`, since Regardie says the Order
  took its sigils from the Sigillum Dei Aemeth (p.307), and the pages
  of Dee's record cited draw none above the tables. As Gadi asked in
  review, a short note stands in the sigil's place, in three small
  lines ("No sigil: Dee's tables carry none. The Watchtower sigils are
  the Golden Dawn's, from the Sigillum Dei Aemeth (Regardie, vol. 4,
  p.307)."), so the page keeps its shape. The image route draws it
  too, outlined like the letters; it fits the sigil's band of the
  page, and an image of Dee's table then says why it has no sigil.

### The component, the page, the image and the hall

- **`Tablet`** (a05f661): `version`, `reversed` (default true) and `alt`
  (default false), second letters drawn small in each square's top right
  corner (6 units, left to right in either font); Dee's empty squares
  draw no letter; a tablet a version lacks (Dee's or Raphael's Tablet of
  Union) draws its page with a dashed outline and "No Tablet of Union in
  Dee's table of 1584"; Dee's and Raphael's Watchtowers draw the note
  above in the sigil's place; a version other than the default is in the
  accessible name. The default drawing keeps its bytes (Water, Fire and
  the Union unchanged; Earth's and Air's re-pinned in 6db02d5 for their
  new letters).
- **`/enochian/tablets`** (d129108): Tablet, Version (the Golden
  Dawn's marked default), the font, and switches for Reversed letters,
  Second letters and "Show where the sources differ". The chosen
  version's section gives its note, its reversed letters, its sigils
  and its sources, then, for each other version, the notes' paragraph,
  a count read from the readings ("In the Earth tablet, 34 squares
  differ: 13 in letter, 2 in u for v, 19 in case alone", Dee's against
  Raphael's) and the squares in a `<details>` list. The
  differences view outlines, across all versions, every square where
  two versions differ in more than case, a version holds second
  letters, a doubt or a reversed letter, or a note speaks; a square's
  detail gives each version's letter, each source's reading in words
  ("y and l over N and h"; "N, reversed; first written y and l; high
  doubt") and the note. The live region announces each version's
  letter.
- **The image route** takes `version` (written out in the contract,
  held equal to `TABLET_VERSIONS` by a test; `gd` when absent, so old
  links keep their meaning, and left out of canonical queries; the
  filename gains `-dee` and the like). The page links the image in the
  version shown, and gives no link, saying why, while second letters
  are shown or reversed letters drawn plain; downloads are named for
  what is drawn (`-second-letters`, `-plain`, `-differences` after the
  image's name). The image's inputs hash every reading, the `choices`
  and the version rules (`TABLET_VERSION_RULES`, exported frozen, each
  with a `revision` to bump when `tabletVersion`'s code changes what it
  makes of a rule), so a change of rule moves the identity with the
  bytes (re-pinned in 6db02d5). Bytes are pinned, after a review of the
  rasters, for Air in the Golden Dawn's version (both fonts) and for
  Fire in each other version. On this merge the identities
  (`inputs.sha256`) of all four Watchtowers' images move, since every
  reading and the rules join their inputs, while the bytes move for
  Earth and Air only: a catalog or bundle that compares the images'
  metadata will re-identify and republish every tablet image once.
- **The hall** (fc7a6e1): `tablet` takes `version` (enum), `reversed`
  and `alt` (booleans), none of them a reserved name; absent, the
  version is `gd`, reversed letters are mirrored and second letters left
  out. The validator, the properties panel and the Pug round trip follow
  from the art's attributes; the palette's tablet leaves the version
  unwritten. A boolean's default is now part of its attribute spec
  (`default: true` for the tablet's `reversed` and the hall's
  `compass`), replacing the panel's list of names, and an enum spec may
  name its values (`labels`): the panel offers each version as its id,
  which the Pug holds, with its name beside it ("dee · Dee, 1584";
  Gadi's request in review), in its usual select, no special case. A
  tablet drawn as before keeps its variant, so no preset snapshot moved
  for this commit (they moved in 6db02d5, Earth's and Air's letters
  only). The board is the same in every version, so the layout contract
  stands.

### Bundle

From the gates' production builds (webpack), gzip -6, at fc7a6e1
against `main` at 2b07004 built the same way. The reader's hall
drawing loads its art in one chunk, 76,481 bytes before and 77,044
after (27,444 and 27,679 gzipped): the tablet's three attributes and
the versions' names for the panel. It carries no table of the barrel
and none of the notes' prose. `Tablet` with magick-data's
`enochian/tablets` is a chunk of its own, which the hall and the page
share: 13,410 bytes before and 24,177 after (4,564 and 7,273 gzipped),
for the five sources' readings, the rules, the resolver, the Equinox's
sigils, the note where a sigil is missing, and the props. The notes'
prose is in the `/enochian/tablets` page's chunk alone: 36,359 bytes
before and 56,016 after (7,419 and 12,498 gzipped).
## Stage H, part 2

Built on `gate/gd-hall-h2` (24 October 2026), from `main` at 2b07004,
after a second design round outside the repository (mock-ups at real
sizes, `~/.cache/gdhall-h2/`) and Gadi's decisions of the same day.

### Gadi's decisions (24 October 2026)

- **Pan, the Devil, Death and Typhon: option (d)**, four emblem cards
  in the tarot key's frame, Death and the Devil with their keys'
  numerals.
- **Adept lamens: option A**, the Portal rubric's, the ring in the
  collar's colour.
- **The Keryx's wings: K1**, with a dip where they meet round the ball,
  as the old icon had, and coils narrowing and tightening towards the
  tail.
- **The Portal's Hiereus and Hegemon** in their own lamens.
- **Seals drawn by hand** for the Moon and Venus, after Agrippa's
  woodcuts, before any sigil work.

### The emblem cards

- **A tag, `card(kind)`**, kinds `pan`, `devil`, `death`, `typhon`
  (`CARD_KINDS`), added by the art registry as `tarotKey`, `kamea` and
  `seal` are, so the validator knows it with its art. Not item kinds:
  the four hang by the walls, they are not things set on an altar, and
  items carry per-kind scales and the item tag's colours, which mean
  nothing here. Not a `tarotKey` variant: Pan and Typhon are the
  rubric's "drawings", not keys, and a variant would need a second
  attribute beside `n` for half of them. A card is a tarot key's size
  (box 58 × 100, default scale 0.81: 0.94 × 1.62 squares), recorded in
  the sizes table, and shares its frame, numeral and title
  (`CardFrame`, `CardNumeral`, `CardTitle` in `tarotKey.tsx`, which
  draws the same bytes as before).
- **The drawings** (`art/cards.tsx`) are the mock-ups' emblems, cleaned:
  paths computed once at load and rounded, no ids. Pan: seven reeds,
  level at the top and each shorter than the last, a red band, a
  bronze crook. The Devil: bat wings, a red horned head under a
  reversed pentagram, on the cube. Death: a skull and a scythe. Typhon:
  a red serpent rising from blue waves into a storm cloud, a yellow
  bolt below. Each emblem is drawn in a 100-unit box at 0.44 inside the
  card, so its 3.6-unit outline matches the frame's 1.6.
- **Labels.** A card's title cannot be read at hall size, so the hall
  labels it: `CARD_LABELS` gives "Pan", "Devil", "Death" and "Typhon",
  the names the p.155 diagram writes by the walls. "Devil" rather than
  "The Devil": it stays on one line like the other three, and the card
  itself still reads "The Devil", the key's title, when zoomed or
  exported. Cards are not labelled by default, as officers are: that
  would be a second default-label rule in the resolver and the aspect
  estimate. Portal 2 and the palette write the label instead.
- **Everywhere else**: the validator reports a card without a kind
  ("drawn blank") and `kind="null"` like any unknown kind; the palette
  offers the four, labelled ("The Devil (card)"); the properties panel
  shows `kind` as a select; the editor names a card "Card: The Devil";
  no name is reserved (`card` is not one of Pug's or the reader's); the
  hosts are unchanged, so a card may stand wherever a tarot key may:
  on the floor, in a row or on a host (the editor's host rules keep
  cards off altars when dragging); Portal 2 round-trips through Pug.
- **The palette** gains `storm` (`#6b6f78`), Typhon's cloud and the
  cube's lit faces.
- **Portal 2** draws the four cards at the markers' places (x 1.2 and
  14.8, y 5 and 11.2). At 1.62 squares they stand clear of the Earth
  and Fire tablets on the same walls (sheet `02-portal2.png`).

### The lamens

- **The adepts** (`lamenGlyphs.tsx`, drawn by `Lamen`): the Chief
  Adept's Rose-Cross on a yellow ring, the Second Adept's red triangle
  in a green pentagram on a white ring, the Third Adept's blue cup on an
  orange octagram (two squares crossed) on a blue ring, each on the
  black disc. The rubric
  (Regardie 1938, vol. 2, p.156, leaf n149) gives the lamens and the
  collars; the ring shows the collar, Gadi's convention (decision 9).
  The Rose-Cross is simplified, as in the mock-ups: Air's yellow above,
  Fire's red on the viewer's left (Geburah's side), Water's blue on the
  right, the lower arm in Malkuth's four colours, trefoil ends, a
  five-petalled rose; vol. 3 (1939), pp.51–53 describes the full one.
  Malkuth's colours moved into `PALETTE` (`citrine`, `olive`, `russet`,
  `earthBlack`), shared with the Pantacle, which draws the same bytes;
  the octagram's orange is `orange` (`#ff8c1a`). The role icons
  (`roles.tsx`), the hall and `/gd/components` all draw them; the hall's
  plain circle is now only for an officer without a role.
- **Role icons and assistive technology.** The adepts' old plain
  circles were `aria-hidden`; `Lamen`'s svg has neither `aria-hidden`
  nor a title, so the role icons would have been unnamed graphics. The
  reader's task frame (`Frames.tsx`) now hides its whole symbol column,
  every role's lamen or emoji, since each only repeats the role name
  shown beside it; a test renders every role so (review fix).
- **Caveats.** The Third Adept's blue ring and orange star are close to
  the Praemonstrator's blue ring and orange disc, though the glyphs
  differ (sheet `05-role-icons.png`). A future 5=6 hall would use the
  same role names, but every Adept there wears the Rose-Cross (vol. 2,
  pp.250 and 256): `grade` (below) is where a Vault preset could ask
  for it.
- **The Portal's Hiereus and Hegemon.** The rubric (p.156) gives the
  Hiereus a "Lamen of Four Colours of Malkuth with White Hexagram" and
  the Hegemon a "Lamen of Red and Blue Hexagram on White Ground" on a
  yellow collar. `Lamen` takes a `grade` prop, and the hall's `officer`
  and `lamen` a matching `grade` attribute, one value, `portal`
  (`lamenGrades.ts`). It is the lamen art's own attribute
  (`HallArt.attributes`), as `light` is the lights', so the validator,
  the properties panel ("Lamen of the grade", offered only to the
  officers it changes) and the Pug round trip carry it. A grade on any
  officer it does not change draws as without it, with a warning: on
  another known role, without a role or with `role=""`, or with an
  unknown role (review fix). `LAMEN_GRADE_NAMES` names the grade for
  those messages and for the editor, which calls the two "Hiereus
  (Portal)" and "Hegemon (Portal)".
  Distinct roles (`portalHiereus`) were rejected: the hall's roles are
  the ritual catalog's keys, and the same officer would need two names
  in tasks. The role icons keep the Outer Order lamens. The Hiereus
  draws a white interlaced hexagram on a disc quartered as the
  Pantacle's (citrine above, olive right, black below, russet left); his
  ring is red: the rubric names a "Black Collar" and then "Red Shoes and
  Collar", and a black ring would vanish into the outline (for Gadi).
  The Hegemon draws a red upward and a blue downward triangle,
  interlaced, on white, ringed in yellow. Portal 1 and 2 use both.
- **The Keryx.** Wings K1, written in lamen units outside the serpents'
  group: the leading edge leaves the staff under the ball, dips beside
  it and sweeps up to a pointed tip, the trailing edge nearly flat in
  four feathers, so a notch shows round the ball, as the old icon's did
  (looked at only for its silhouette; none of its path data used). The
  serpents make a turn and a quarter (three-quarters before): their
  reach falls to 65% at the tail and the turns run faster there
  (`turned(u) = 1 − (1 − u)^1.2`), so the top loop is wide and the
  lower ones smaller. Two crossings, one each over the other; the pieces
  drawn again over a crossing now follow the whole curve exactly
  (`smoothPath` takes a stretch) and reach an eighth of a turn either
  side, since a band's square end on a loop's sharp turn showed as a
  spike. The first version (serpents 6.2 units wide, the reach falling
  to half, `^1.4`) turned to noise at 20 px, the review found; the
  serpents are now 8.4 units wide before the glyph's 0.66 scale, 1.1 px
  at 20 px, with the gentler taper above. At 20 px the icon reads as
  the wings and ball over a column of white coils, the lowest about a
  pixel wide, as bold as main's; at 25 px the crossings show (sheets
  `06-keryx.png`, the 20 and 25 px renders magnified ×4 pixel for
  pixel, and `06b-keryx-magnified.png`, ×10 and ×8, the old icon, main
  and the new one). 22 samples a serpent; the Keryx's role icon is
  5,198 bytes of markup (4,429 before).

### The seals

- **Source.** Agrippa, *De occulta philosophia libri tres* (Cologne:
  Soter, 1533), book II, chapter 22: each planet's table is followed by
  its "signacula sive characteres". Read from the Library of Congress
  copy on archive.org, item `DeOccultaPhilosophiaLoc1533`: Venus' seal
  on p. CLI (leaf n166), the Moon's on p. CLIII (leaf n168). The
  McGill (`McGillLibrary-osl_henrici-cornelii-agrippae_folioA279o1533-19978`)
  and Wellcome (`hin-wel-all-00001912-001`) copies of the same edition
  are on archive.org too. The chapter's text (leaf n162) says each of
  these planets' tables, with its characters, is engraved on silver,
  Venus' "in lamina argenti", the Moon's "in argento"; the silver plate
  under each seal is our reading of that, since the woodcuts draw the
  seals on the bare page.
- **Public-domain basis**, recorded in `seals.tsx` and in the art's
  provenance through a new `publicDomain(notes, { source, basis })`
  helper (`art/shared.ts`): printed in 1533, Agrippa died in 1535 and
  the woodcuts' cutters are anonymous, so the work is out of copyright
  everywhere; a faithful scan of a two-dimensional public-domain work
  adds no copyright, and the archive.org item carries the Public Domain
  Mark 1.0.
  The drawing is ours (origin `original`, MIT), so the third-party list
  stays empty. No image of the book is committed; the page images were
  looked at outside the repository.
- **The drawings** (`art/seals.tsx`) follow the woodcuts, made
  symmetric where the cutter's hand wandered. The Moon: a saltire from
  a ring at the centre to rings in the corners, and four crescents
  between its arms, each a lune of two circular arcs with a third along
  its middle, ringed at the horns (the woodcut's lower-right arm ends in
  a blot, drawn as a ring like the others). Venus: three arms of a
  saltire from a ring at the centre to rings at their ends, the fourth
  running to the foot of a great arc on the right; above the centre a
  cross whose stem forks into two arms, serifed; an open arc on the
  left, like a ")", even in width with blunt ends; a ring below. (The
  first version filled that arc as a horned lune at twice the weight,
  which read as a crescent moon; the review found it, and it is now a
  stroke at the other lines' weight.) Each is engraved in ink (3 units,
  the Moon's inner lines 2.4 and 1.6) on a silver plate, a rounded square in the items' outline
  (the placeholder was a ring; the box, 100 × 100, and the default
  scale, 0.9, are unchanged). Theoricus 2 and Philosophus 4 draw them;
  the other five planets keep the placeholder, and the editor still
  names the node "Seals of Luna".

### Output

Every new drawing is drawn once per hall in `<defs>` and placed with
`<use>`; none defines an id, a gradient or a pattern. The committed
preset snapshots: Portal 1 233,041 bytes before, 239,851 after; Portal
2 226,284 and 239,388; Theoricus 2 88,557 and 90,472; Philosophus 4
71,874 and 72,315; the Neophyte (its Keryx) 27,906 and 28,671.

From the gates' production builds (webpack), gzip -6, measured the same
way before and after (2b07004 against ce5daa8): the hall chunk the
reader's drawing loads grew from 76,481 bytes (27,444 gzipped) to
79,358 (28,360), with the cards and the seals. `Lamen` sits in the
shared chunk the reader's role icons load, which grew from 25,208
(9,119) to 29,972 (10,787), and in one lazy chunk, from 37,622 (13,884)
to 42,426 (15,653): the adepts' and the Portal's glyphs, the new
caduceus, and the hall's `PALETTE`, which `lamenGlyphs.tsx` imports
whole. No chunk boundary moved. All JavaScript chunks: 7,956,929 bytes
before, 7,978,904 after (measured after the review fixes).

### Sheets for Gadi

Outside the repository, in `~/.cache/gdhall-h2/impl/sheets/`: Portal 1
and 2 before (main at 2b07004) and after at reader width
(`01-portal1.png`, `02-portal2.png`), Theoricus 2 and Philosophus 4 for
the seals (`03-theoricus2.png`, `04-philosophus4.png`), the ritual role
icons at 20, 25 and 40 px (`05-role-icons.png`), the Keryx's old icon
(570e5f8), main and the new one at 20, 25, 40, 51 and 120 px as role
icons, on a dark row and magnified (`06-keryx.png`), and close-ups of
the cards, the new lamens and the seals (`07-close-ups.png`).

### What was verified, and how

- **Gates**, per commit, each in a clean `git archive` export with Node
  24 and the CI placeholder environment (`pnpm install
  --frozen-lockfile`, `check`, `typecheck`, `test:coverage` with the
  per-file thresholds, `build`): all 0 for 6db02d5, a05f661, d129108 and
  fc7a6e1 after the review fixes, as for each before them, and for the
  plan's commit with `loom check`, the magick-data smoke test and
  `pnpm check:turbopack`, all 0 at fc7a6e1 (6,614 tests passed, 17
  skipped; the smoke test's 13 steps), after the final review's fixes
  as after the first review's. One run of the data commit between the
  two reviews failed a test outside this work, `TrainingUpload.test.tsx`
  (its FilePond upload), and passed on a rerun. The smoke test's packed
  build is what found the declarations `Tablets.ts` lacked under
  `isolatedDeclarations`, a fix folded into the data commit. The
  compiler is untouched: `semantic.ts`, `semanticCompilerImpl.ts` and
  `ritualNodeIds.ts` have no diff; the MIT directories import no app
  code.
- **The data against the sources.** The Golden Dawn rule reproduces
  Water's, Fire's and the Union's Stage G letters and marks exactly, and
  Earth's and Air's thirteen changes each as Stage G listed them; the
  transcriptions of Regardie, the Equinox and Greer in Stage G's seventy
  square notes (before the rewrite to the present 59) match the
  readings square for square; the `dee1584` reading is
  Casaubon's print but for the four corrected squares and the print's
  glyphs for reversed letters; `raphael1587` is the 1587 print but for
  its ten misprints; Earth's and Air's old letters equal Raphael's, u
  and v and case aside. The Seniors of all four Watchtowers read off the
  Golden Dawn's version (tests).
- **In the browser** (Turbopack dev server from this branch on
  127.0.0.1:3317, headless Chromium over CDP with classic 15 px
  scrollbars; nothing signed in or saved): `/enochian/tablets` at 1440 ×
  900 and 390 × 844 (mobile emulation): the Version choice redraws
  Earth's eighth row (RCanchiisomt, ROcanchiasom), names the tablet
  "Enochian Watchtower of Earth, Dee's table of 1584", draws Dee's Fire
  with 154 letters and, after the review fixes, the note in the sigil's
  place; Second letters by keyboard (Space) draws the two empty squares'
  1587 letters; the differences view outlines 18 Fire squares and
  announces each version's letter; no horizontal scroll, no console
  errors. `/gd/hall` at both sizes: Portal 1's Fire tablet given
  `version="dee", alt=true` in the source draws the note in its sigil's
  place and its second letters; its Tablet of Union given
  `version="raphael"` says it has none; no warnings, no console errors.
  Screenshots are outside the repository
  (`~/.cache/enochian-versions/shots/`).
- **Documentation screenshots**: none shows a tablet or a hall
  (`scripts/docs-screenshots`), so none was regenerated.

### Review fixes

An independent review by Opus 5.5 (24 October 2026) found the letters
right against the scans and Stage G, the API safe and the default
drawings' bytes unchanged but for Earth and Air. Its fixes, and Gadi's
two requests, were folded into the commits they belong to (a `--fixup`
and `amend!` autosquash; Commits lists the new SHAs): the page commit's
subject shortened to 50 characters; Fire's row 6 square 8 (above);
`misprint` defined against Dee's copies only, which Water's row 4 square
9 had shown too broad; Casaubon's Æ recorded; the version rules in the
image's identity, and a pin for each version; a count in the notes'
prose reworded ("about two dozen squares"), and their test widened to
words such as "dozen" and "half"; boolean defaults in the attribute
spec; downloads named for what is drawn; "From the Golden Dawn's" in
lower case mid-sentence; the schema refusing a mark that says only
`reversed: false` and a choice of an empty square or of Regardie's own
letter; `TabletView.id` typed as a tablet's id, `tabletDifferences`
refusing views of two tablets, and the rows deeply frozen so the views'
cache stays sound; the notes saying Casaubon *marks* three reversed
letters (two in his margin), and naming the four Greer mirrors, N, L, R
and P. Gadi asked for the note in the sigil's place and the version
names in the hall's panel (both above).

A final review by Fable 5.1 (24 October 2026) checked every square of
every version against the scans, found no disagreement and the branch
safe to merge, and asked for a last few small fixes, folded the same
way: this section and plan 000 say that every tablet image's identity
moves on the merge (above); with second letters shown, the page lists
them in words, square by square, for readers who cannot see the
corners; Water's row 6 square 11 explains that Regardie sets L large
and first, with c small and raised, which is why c is read as the
higher letter; two marks Casaubon prints on Earth, a rule under the c
of row 12 square 6 and over the V of row 13 square 6, have notes saying
their meaning is unknown, perhaps letters Dee queried (so 59 square
notes); `Tablet`'s `alt` is documented as Watchtowers only, since the
Tablet of Union has no second letters; and the hall's panel names the
Golden Dawn's version "gd · Golden Dawn", its own "Default" choice
already saying it is the default.

### British Library follow-up

The Library's Rhysida ransomware attack of October 2023 took its
Digitised Manuscripts service offline. About 1,000 manuscripts returned
in October 2024, and recovery was reported as ongoing in 2026. On 24
October 2026 the catalogue record for Sloane MS 3191 still read
"Images currently unavailable", and Cotton MS Appendix XLVI was never
digitised. Re-check the catalogue (searcharchives.bl.uk, Sloane MS
3191) from time to time; when the images return, check:

- the folios of the reformed table: Peterson gives ff.53v–54r, Vovina
  and Burford ff.55v–56r;
- the 1587 capitals, which `raphael1587` leaves as the 1659 print's
  small letters;
- the Black Cross's placement, and then whether it enters the data;
- the letters Dee struck through in 1584, which may explain Regardie's
  second letters that are neither of Dee's tables;
- the two Fire squares where Sloane (p) and Cotton through the print
  (x) differ, row 8 square 1 and row 12 square 4;
- the images' licence terms, before any is cited by URL or used.

### Open for Gadi

- The two empty Fire squares of 1584: what they mean, and whether Dee's
  version keeps them empty (built so; cheap to change, above).
- The two Fire squares where Cotton's print has x and Sloane p (built
  following the print).
- Dee's Black Cross in the data, after the British Library.
- Fire's row 6 square 8 in the 1587 print: a misprint, as the version
  reads it, or the Cotton copy's v, which Regardie keeps as a second
  letter (doubt medium, until the British Library).
  per-file thresholds, `build`): all 0 for f05bbf7, ce5b2a1, 3b8bd15,
  501d320 and ce5daa8. The tip, with this plan, also ran `loom check`,
  the magick-data smoke test and `pnpm check:turbopack`. The compiler
  is untouched: `semantic.ts`, `semanticCompilerImpl.ts` and
  `ritualNodeIds.ts` have no diff, and `src/components` imports no app
  code (the boundary test).
- **Snapshots** were regenerated in the commit that changes each
  drawing: the Portal presets for the adepts (f05bbf7) and the grade
  (ce5b2a1), the five halls with a Keryx (3b8bd15), Portal 2 for the
  cards (501d320), Theoricus 2 and Philosophus 4 for the seals
  (ce5daa8). Moving tarotKey's frame and Malkuth's colours changed no
  byte of any other preset.
- **Tests**: the adepts' and the Portal's lamens (rings, colours, no
  ids; other officers and unknown grades unchanged), every hall role
  drawn by `Lamen`, every role's symbol hidden from assistive
  technology beside its name, the grade's validation (on any role it
  does not change, without a role and with an unknown one), panel field
  and names, the
  caduceus's two crossings and size, a stretch of a smooth path along
  the same curve, the cards (frame, numerals, titles, no ids, kinds
  validated, a tarot key's size, the palette's labelled entries, the
  editor's names), the seals (silver plates, rings and arcs, the
  placeholder for the other planets, the provenance's source and
  basis), and every preset validated, drawn, inventoried and
  round-tripped through Pug as before.
- **In the browser** (Turbopack dev server from this branch on
  127.0.0.1:3427 with placeholder settings, headless Chromium over CDP;
  nothing signed in or saved): `/gd/components` draws the sixteen
  lamens, the adepts and the Portal's two among them, with no console
  error; `/gd/hall`, Portal Temple 2 in the visual view, draws the four
  cards labelled and the Portal lamens, with no warning badge; tabbing
  through it names "Card: Pan", "Card: The Devil", "Card: Death",
  "Card: Typhon", "Hegemon (Portal)" and "Hiereus (Portal)", and the
  Devil's panel shows its Label ("Devil") and Kind ("devil"). The one
  console warning, CodeMirror's "Unknown highlighting tag indent", comes
  from the source view and is older than this work.
- **Help screenshots** were not recaptured: none shows the changed art
  (the editor and reader shots show the Neophyte's old `/pics` drawing,
  with no Keryx or adept role icon in view; hiding the symbol column
  changes no pixel).
- **After the review fixes** the browser check was not repeated: the
  fixes change drawings the tests and the sheets cover, an `aria-hidden`
  the role test checks, and the validator's messages.

### Review fixes

An independent review found no blocker: the seals match the woodcuts,
the provenance is sound and the layout contract holds. Its fixes were
folded into the commits they belong to (`--fixup` and `amend!`, the
branch rewritten with `git rebase -i --autosquash`, each commit's
snapshots regenerated at its own place; Commits lists the new ones):

- **Venus' left figure** an open arc at the lines' one weight, not a
  filled crescent (The seals).
- **The Keryx at 20 px**: thicker serpents and a gentler taper (The
  lamens).
- **Role icons hidden from assistive technology** beside their names,
  for every role (The lamens).
- **Grade warnings** for a grade on any officer it does not change,
  without a role or with an unknown one (The lamens).
- **Nits**: the seals' wording (the archive.org item carries the mark;
  the silver plate an interpretation of n162); `LAMEN_GRADE_NAMES`
  shared by the validator and the editor; the octagram two true
  squares (inner radius 37 · cos 45° / cos 22.5°, about 28.3, not 26);
  the palette's doc comment reflowed; `cards.tsx`'s `Band` takes a
  `stroke`; `lamenGlyphs.tsx`'s doc comment corrected in the commit
  that adds the Portal glyphs; the Third Adept against the
  Praemonstrator in plan 000's open questions.

### Waiting for Gadi

- The Portal Hiereus' ring: red (chosen) or black, the rubric naming
  both collars.
- Whether the Third Adept's lamen needs telling apart from the
  Praemonstrator's at icon size.
- The cards proposal (Follow-ups).
- The five remaining seals.

### Follow-ups (26 October 2026)

Built on `gate/gd-hall-h3`, from `main` at a84d017, after Gadi's
decisions that day on the third round of Keryx mock-ups
(`~/.cache/keryx-v3/`), the hall editor's palette and two research
questions (`~/.cache/research-56/README.md`).

#### Gadi's decisions (26 October 2026)

- **The Keryx: V1 with V2's two turns.** V1 ("Arch"): a crest beside
  the ball, the top edge falling to a far, low tip, a flat underside cut
  into four round feathers, the heads turned outward; but two turns of
  the serpents, as V2 has, for contrast at small sizes. Gadi was tempted
  by V2's Shin (wings rising to high tips towards Chokmah and Binah,
  Regardie vol. 2, p.83, so that wings and staff make a Shin), and chose
  what reads best at icon size.
- **One button per palette group** instead of one "Add" button, each
  opening its group's menu, with a small drawing of each entry.
- **`/gd/hall`'s source panel** to reach the foot of the screen in
  Source view, and in split view to stay in view, as tall as the
  viewport, while the page scrolls past the drawing.
- **Brief notes in the code** for the 5=6 lamens and the Portal
  Hiereus' collar (below).

#### The Keryx

- **The geometry** (`Lamen.tsx`), in lamen units, with no scale group
  now: a pointed staff 3.4 wide, a ball of radius 4.8 with a black ring
  (1.6) at y −27, the wing as one static outline mirrored with
  `flipped`, and two serpents derived at load from a few constants. Each
  serpent is a double helix seen a little from above: `x = A(u)·sin θ`,
  with a tilt of 0.3 · dy/dθ · cos θ added to y, which rounds the loops.
  The reach falls from 12 at the neck to 40% at the tail, the turning
  rate rises linearly to 1.9 times the neck's at the tail, and the body
  thins from 5 to 3 (3.2 as drawn, arc by arc). The serpent is cut into
  half-turn arcs where it turns at a side: the arcs behind are drawn
  under the staff, whose black edge (2.5) parts them from it, and the
  arcs in front over it, each on a band of the disc's black over its
  middle two-thirds only, clear of the turns. Depth settles every
  crossing, with no over-and-under bookkeeping. Each arc is four
  Hermite cubics through eighth-turn knots (the bands three), tangents
  by central difference, rounded to one decimal; the heads are
  ellipses on short necks. No ids, no gradients.
- **The same bytes as the mock-up**: the port reproduces `gen.ts`'s V1
  at two turns coordinate for coordinate.
- **Size.** The Keryx's role icon is 3,376 bytes of markup (5,211 on
  main). The five halls with a Keryx shrink by 1,823 bytes each: the
  Neophyte 28,671 to 26,848, Zelator 1 78,620 to 76,797, Zelator 2
  114,708 to 112,885, Theoricus 1 84,769 to 82,946, Theoricus 2 90,552
  to 88,729 (snapshots regenerated in the same commit).
- **Originality.** The old icon (SVG Repo, 570e5f8) was looked at only
  as a rendered silhouette, never its path data, and nothing was copied
  or traced from the mock-ups' `old/` reference copy. The serpents are
  a parametric helix with depth-ordered arcs and per-arc widths, not a
  filled outline; the wing is generated (notch, crest, tip, feathers
  along a straight underside) and mirrored. Overlap with the old
  glyph's white area inside the disc at 200 px (intersection over
  union): the new one 0.54, main 0.43; V1 at 2.5 turns was 0.56. A trace
  would score above 0.9.
- **Checked** at 20, 25, 40 and 120 px and as the 25 px role chip beside
  "Keryx": at 20 px the wings and ball read as a bright bar with a dark
  notch over a checked column; at 25 px the two crossings show.
- **Tests** check four arcs behind the staff, four bands after it, the
  body's widths (5 at the neck, 3.2 at the tail), two heads and the
  size.

#### The palette's buttons

- **The toolbar** shows "+ Officer", "+ Furniture", "+ Banner",
  "+ Item", "+ Symbol" and "+ Text", the palette's six groups
  (`HALL_PALETTE_GROUPS` gives each group's button name, singular:
  what one choice adds). Their accessible names are "Add officer",
  "Add furniture" and so on, which contain the visible text.
  `hallPaletteSections` splits the palette in toolbar order and leaves
  out a group without entries (the art registry decides the items).
- **Each button's name covers what it offers** (review). Officer held
  the marker and Banner the Hebrew letter, which their names did not
  hint at. Of the two fixes offered, moving them or listing each
  button's contents in a tooltip, they moved: the marker, text in a
  box for an object without art, is under Text beside the label
  ("Marker (text in a box)"), and the Hebrew letter under Symbol.
  Only the group changed: where each lands is as before.
- **One tab stop.** The six buttons are a toolbar of their own ("Add
  to the hall") with a roving tab stop: Tab reaches the last one used,
  and the left and right arrows (wrapping), Home and End move along
  it (review).
- **Menus.** Each button opens its group's MUI menu
  (`aria-haspopup="menu"`, `aria-expanded`, `aria-controls` naming the
  menu's list, which `aria-labelledby` names after the button): arrow
  keys, Home and End, type-ahead, Escape back to the button, Tab out.
  A group of one would add its entry at once, without a menu (none is
  now). A choice moves the focus to the drawing, as before.
- **Icons.** Beside each entry's name the menu draws the entry itself at
  22 px through the hall's own art registry (`PaletteIcon`: the entry's
  tag and attributes as a hall row, its art's `Component` in its
  nominal box, gradient ids from `useId`), hidden from assistive
  technology. An entry without art (the door, which its wall draws)
  keeps an empty slot. The name comes first in the markup and the icon
  shows first by CSS `order`, so the type-ahead reads the name: a
  tablet's icon holds its letters, and "e" would otherwise not find
  "Enochian tablet" (tested).
- **Behaviour kept.** `insertFromPalette` is unchanged: where a new
  object lands, the host rules and one undo step per addition.
- **Layout.** The buttons wrap: one row at 1440 px and in `/gd/hall`'s
  split view at 1024 px (the panel docked), two rows of three on a 390
  px phone; no horizontal scroll. No "More" overflow was needed.
- **Help.** Neither the editor's hint nor the Ritual Pug guide
  mentioned "Add", so neither changed. No documentation screenshot
  shows the hall editor, its Add menu or the Keryx (the editor and
  reader shots show the Neophyte's old `/pics` drawing), so none was
  recaptured.

#### The 5=6 lamens and the Hiereus' collar

From the research of 26 October 2026, kept outside the repository
(`~/.cache/research-56/README.md`); only facts and page references
enter it.

- **The adepts in a 5=6 hall.** The Chief Adept bears the Rose-Cross on
  his breast: Regardie 1938, vol. 2, p.202 (leaf n195, the Chief's
  breast emblem) and p.220 (n213: in the Pastos it hangs from a double
  Phoenix collar); the Equinox I.3, pp.208–222, agrees. The Second and
  Third Adepts probably wear it too, but that is inferred, not stated
  in the 5=6 rubric: every Adept wears it at all meetings of Adepts
  (vol. 3, p.51, n44, from a yellow collarette), and the Third Adept
  touches the Rose-Cross on his own breast (vol. 2, p.254, n248, in the
  Equinox ceremony). No source carries the Portal's
  triangle-in-pentagram or cup-on-octagram into the 5=6; they belong to
  the Portal only. The only source with distinct jewels for the Second
  and Third Adepts is Waite's reworked Fellowship of the Rosy Cross rite
  (1917). The review corrected the first citations, which made all
  three stated and the collar yellow. Noted by
  the adepts' lamens (`lamenGlyphs.tsx`, `Lamen.tsx`) and in
  `lamenGrades.ts`, where a 5=6 grade would go. Nothing drawn changes:
  without a grade the adepts keep the Portal's lamens.
- **The Portal Hiereus' collar.** The p.156 (n149) list gives him two
  collars and no cloak ("Black Collar", then "Red Shoes and Collar").
  We read "Black Collar" as a misprint for "Black Cloak", which keeps
  the Outer Order's black cloak and scarlet collar (Z.1, Regardie vol.
  3, pp.92–93, leaves n84–85, where the scarlet is the Divine
  Severity's), so the ring stays red, as built. Noted at `GRADE_LAMENS`
  in `Lamen.tsx` and by `PortalHiereus`. If Gadi chooses black, the
  ring becomes a dark grey (about `#333`) with the usual outline, so it
  shows against the black disc.

#### The source panel

- **Before**, `/gd/hall`'s source editor held the bounded height it has
  inline (25rem to 65vh), so in Source view it ended well above the
  screen's foot, and in split view it scrolled away with the drawing.
- **From 900px wide** (where split puts the panels side by side) the
  editor now fills its panel (`RitualSourceEditor`'s `fill`). In Source
  view the panel ends 0.75rem above the viewport's foot: the panels'
  distance from the top of the page is measured into `--panels-top`
  (`usePanelsTop`). It is measured again when anything above the
  panels can have moved them: a resize of any of their ancestors or of
  the elements before each (a dozen or so elements, ResizeObserver),
  of the window, or the fonts' loading; a measurement that finds the
  same top writes nothing (review: observing only the playground
  missed the page's text above it). In split view the panel is
  `position: sticky` 0.5rem below the 64px app bar and as tall as the
  viewport below it, so it stays in view while the page scrolls past
  the drawing, its source scrolling inside it; its minimum height,
  20rem, never exceeds that room on a short screen (review). It is not
  sized to the drawing, whose height varies by hall and layout; a
  drawing shorter than the panel simply ends the sticking sooner.
- **Narrower**, stacked, the editor keeps its bounded height (a CSS
  rule restores 25rem to 65vh, since `fill` is now always passed).
- **The ritual editor** already does this: its surface is the
  viewport's height below the app bar (`SemanticEditor.module.css`)
  and the window does not scroll, so its source reaches within its 1rem
  bottom padding of the foot. Nothing changed there; it was read, not
  opened in the browser (no database here).
- **Measured** in headless Chromium with classic 15px scrollbars (the
  phone with none): Source view, the editor's foot 12px above the
  viewport's at 1920 × 1080, 1440 × 900 and 1280 × 800; split view with
  Portal 2, scrolled half-way down the drawing, the panel from 72px to
  8px above the foot at 1440 × 900 and 1280 × 800, its source scrolling
  inside (1,072 and 1,224px of source in 779 and 679), and at 1920 ×
  1080, where the drawing's column is barely taller than the panel, held
  until that column ends; at 390 × 844 the editor 548px (65vh), as
  before; no horizontal scroll. After the review fixes: 150px of text
  added above the playground moved the panel down and kept its foot
  12px above the viewport's; at 1280 × 360 the split panel ran from 72
  to 352px, inside the screen. The app bar hides as the page scrolls
  down, which leaves the sticky panel's top 72px empty until it shows
  again.

#### Bundle

From the gates' production builds (webpack), gzip -6 for the chunks:

- **The Keryx** (main a84d017 against d62c7c0): the lazy chunk holding
  `Lamen` with the hall's art grew from 42,426 bytes (15,653 gzipped)
  to 42,685 (15,842), and the shared chunk the reader's role icons load
  from 29,972 (10,788) to 30,231 (10,977): the helix is a little more
  code than the stretches it replaces, though each drawing is 1,835
  bytes smaller. All JavaScript chunks: 8,010,204 bytes before,
  8,010,714 after.
- **The palette's buttons** (d62c7c0 against ea29a29, with the review
  fixes): the hall editor's chunk grew from 43,496 bytes (15,852
  gzipped) to 45,135 (16,410), 1,639 bytes (558 gzipped), with
  `PaletteIcon`, `hallPaletteSections`, the menu's wiring and the
  toolbar's roving tab stop; the art registry it draws with was loaded
  already. Webpack also re-split two lazy chunks the page loads (MUI's
  `ListSubheader`, which the editor no longer imports, moved to a
  shared chunk `/gd/hall` does not load), so the scripts `/gd/hall`
  itself loads, measured in a production server after the editor has
  drawn, went from 3,689,085 bytes to 3,688,930 (1,162,666 to
  1,162,716 as served). All JavaScript chunks: 8,010,714 before,
  8,018,144 after, the shared chunk's growth.

#### Sheets

Outside the repository, in `~/.cache/gdhall-h3/`:

- `keryx/keryx-before-after.png`: the old icon, main and the new one at
  20, 25, 40 and 120 px, the 20 and 25 px renders magnified ×8 pixel
  for pixel, and the 25 px role chip, every row labelled.
- `browser/add-menus-desktop-v2.png` and
  `browser/add-menus-phone-and-docked-v2.png`: the Officer, Symbol and
  Text menus at 1440 px; the toolbar and the Officer and Item menus on
  a 390 px phone; the Officer menu in the docked split view at 1024 px
  (every shot in `browser/shots2/`).
- `browser/source-panel-desktop-v2.png` and
  `browser/source-panel-phone-v2.png`: Source view and split view,
  scrolled, at the four sizes, and split view at 1280 × 360 (every shot
  in `browser/panel2/`).
- The sheets before the review fixes keep their names without `-v2`.

#### What was verified, and how

- **Gates**, per commit, each in a clean `git archive` export with Node
  24 and the CI placeholder environment (`pnpm install
  --frozen-lockfile`, `check`, `typecheck`, `test:coverage`, `build`):
  all 0 for d62c7c0 and, after the review fixes, for ea29a29, 620b3d6
  and 366e80d (6,627 tests passed, 17 skipped, at 366e80d), as for each before them. The plan's
  commit also ran `loom check`, the magick-data smoke test and `pnpm
  check:turbopack`. The compiler is untouched (`semantic.ts`,
  `semanticCompilerImpl.ts` and `ritualNodeIds.ts` have no diff);
  `src/components` imports no app code; no hall box or scale changed.
- **In the browser** (Turbopack dev servers from this branch on
  127.0.0.1:3463 and, after the review fixes, 3466, with placeholder
  settings, headless Chromium over CDP; nothing signed in or saved):
  `/gd/hall` at 1440 × 900, at 390 × 844 (mobile emulation, the panel
  docked) and in split view at 1024 × 768 (docked): six buttons named
  "Add officer" … "Add text" in one toolbar, whose arrows and End move
  the tab stop; the Officer, Symbol, Item and Text menus named after
  their buttons, 14, 15, 17 and 2 entries, each with its icon (the
  label has none); Escape back to the button; Enter, an arrow and
  Enter from the keyboard adds the Enochian tablet, selected, the
  drawing focused; "e" in the Symbol menu finds "Enochian tablet";
  Text's Label adds a label, selected; no horizontal scroll, no
  console error. The ritual editor's hall editor is the same component
  (tests); it was not opened in the browser (no database here).

## Stage I plan (28 October 2026)

Status: planned on `gate/halls-i` (from `main` at ec6f765), with the
move of the hall pages to `/gd/halls` that
[plan 062's amendment](062-gd-hall-seo.md#amendment-the-halls-under-gdhalls-28-october-2026)
records; not yet built. Stage I as the Stages table defines it: the
built-in docs switched to the presets, each built-in hall linked to its
page, `public/pics`' five drawings and their `/about` credits removed,
reader export, and the end-of-project review. The links go to
`/gd/halls/<slug>`, so the amendment's commits come first.

Gadi's decision of 28 October 2026 (the old drawings):

- **Remove the five drawings, then permanently redirect each to its
  hall's image**, SVG to SVG: `/pics/neophyte.svg`, `zelator1.svg`,
  `zelator2.svg`, `theoricus1.svg` and `theoricus2.svg` each to the
  matching file under `/gd/halls/<slug>/`, such as
  `/gd/halls/zelator-1/golden-dawn-zelator-1-temple.svg`.

### I.1 The built-in docs draw the presets

- **What.** Each `img(src="/pics/<name>.svg")` in `src/doc/0=0.pug`
  (line 58), `1=10.pug` (61, 480) and `2=9.pug` (47, 484) becomes that
  preset's hall, as Pug: exactly what `gdHallPug(preset.hall)` prints
  (one node per line, no IDs, no `//-` comments, which the Stage B notes
  forbid inside a built-in doc's hall), indented into its note.
  Presets are copied, never referenced (decisions 3 and 10).
- **Measured** (a scratch test, 28 October 2026, nothing committed):
  the five halls print as 30 to 36 lines, 1.1 to 1.3 KB each, 2.4 KB
  gzipped in all; `prepare()` compiles each to a `gdHall` row with
  numeric strings, and `semanticFromJrt` imports each as an element, not
  as opaque legacy content. The built-in docs ship in the client bundle
  (`DocLoader.tsx`), so the docs' chunk grows by about that much; the
  drawing itself loads lazily from the hall chunk the service worker
  already precaches.
- **Where.** In 1=10 and 2=9 the images already stand in notes. In 0=0
  the image stands at the top level; the hall goes into a note like the
  others, so that its link can sit under it in the same block. A note
  is one of `HALL_PARENT_TAGS`, so the compiler accepts it unchanged.
- **The link to each hall's page.** Under each hall, in its note, a
  plain ritual link: `a(href="/gd/halls/neophyte") Neophyte Temple:
  stations, sources and downloads`, the name being the hall's short name
  (`gdHallShortName`: "Zelator Temple, part 1", "Theoricus Temple in
  Yesod"). Considered and not chosen:
  - *a caption link*: the caption is drawn SVG text inside the hall, and
    a hall holds no links;
  - *a hall attribute*: none exists. `href` is a reserved hall attribute,
    as is every resource name the offline inventory follows (decision
    2). A new attribute (say `page="neophyte"`) would be hall vocabulary
    that any ritual could set on any hall, claiming a preset's page for
    a hall edited away from it, and the reader would need to learn it.
  A ritual `a` is what the docs already use (`2=9.pug:419`), the reader
  draws it as a link, and the offline inventory skips an `a`'s `href`
  (`ritualAssetInventory.ts`), so it never blocks a publication.
- **Each note is printed, not typed.** A draft of the note (the hall
  from `gdHallPug` and the link) is parsed with `parseRitualPug` and
  printed back without IDs, so it is in the form the printer writes: the
  hall one node per line, and the link a block `a` with a `|` text
  child, as `2=9.pug:419–420` has it. The tests over the three docs
  (the round trip and JRT parity in `ritualPug.test.ts`, the parity in
  `semanticCompile.test.ts`) then hold that form.
- **A test** (`src/doc/builtInHalls.test.ts`): for each of the five,
  the built-in doc's hall, compiled by `prepare()`, imported by
  `semanticFromJrt` and printed without IDs, equals
  `gdHallPug(preset.hall)` exactly, and the note's next node is a link
  to `hallPath` of that slug. A preset that changes changes the docs in
  the same commit, without a hand paste into three files: run with
  `BUILT_IN_HALLS=write`, as the image pins update with `GD_HALL_PINS`,
  the test rewrites each doc's hall block (the `gdHall` line and the
  lines indented under it, found by the link that follows it) with that
  preset's `gdHallPug` at the block's indent, and fails otherwise with
  a message naming the variable. The docs stay copies, never
  references: the updater writes text into them, and nothing reads a
  preset when a doc is drawn.
  The existing tests over the three docs (JRT parity in
  `semanticCompile.test.ts`, the Pug round trip in `ritualPug.test.ts`,
  the task and grade counts in `prepare.test.ts`) cover the rest.
- **Compiler identity.** Unchanged: halls compile since stage B, and
  none of `semantic.ts`, `semanticCompilerImpl.ts` or `ritualNodeIds.ts`
  is touched. If the docs needed a compiler change, the work would stop
  and come back to Gadi.
- **Documentation screenshots** (`scripts/docs-screenshots`). The
  "Neophyte 0=0" sample is seeded from the bundled `0=0.pug`, and four
  shots show its old drawing: `editor-split` (the image atom, "Image ·
  /pics/neophyte.svg"), `editor-visual` and `editor-phone` (the same
  atom) and `reader-phone` (the drawing under the opening title).
  `editor-source` shows the source's first lines, which may reach the
  hall. All five are recaptured with `magickli-docs-capture` and the
  changed images committed with I1, each looked at. The seed creates the
  ritual once and never updates it (it stops at the operation's
  receipt), so the shared local database would keep the image: the seed
  learns to save a new revision (`kind: "save"`, an operation id derived
  from the bundled source's hash) when the ritual's current source
  differs from the bundled one, and the capture's "(publish)" step
  publishes it. The README says so. A side effect: until this merges, a
  capture from `main` would show the hall in that ritual, because the
  local database is shared.

### I.2 The drawings are no source

The five presets cite their drawings (`drawing("neophyte")`, a path in
the repository), the editor's Sources list links them, and four art
modules name them in their provenance (`banner.tsx`, `hebrewLetter.tsx`,
`lightning.tsx`, `pantacle.tsx`). Gadi decided on 28 October 2026 to
drop them as sources altogether: he drew them himself from Regardie's
diagrams, so they are not an authority and must not be presented as
one. The presets cite only the primary sources they already rely on,
the 1938 pages.

- **The `drawing` kind goes**: from `HallPresetSource`, `drawing()`,
  `hallSourceText`, `hallSourceCitation` and `hallSourceUrl`
  (`src/components/gd/hall/presets/types.ts`), and from the five
  presets' `sources`. Zelator 2 keeps its one book source (p.44, "the
  Earth tablet, lamp and salt only"), and its lead's sources sentence
  already says its own 1938 diagram is still to be located.
- **The presets' doc comments** describe the layouts after the book, not
  as "ported from `public/pics/...`".
- **The art's provenance** loses its `source` paths, and its notes
  describe the art as Gadi's own design drawn as geometry, without naming
  the files (provenance needs a `source` only for third-party art).
- **The editor's Sources list** and the hall pages list the book pages
  alone; the hall page's and the image metadata's `kind === "book"`
  filters become unnecessary and go. The image files already cite the
  book only, so no pin moves.
- **No wording about older drawings** anywhere a reader sees it, the
  leads included (Gadi's rule from plan 062, stage 6, which
  `hallLeads.test.ts` keeps).
- **Tests**, all in I2 so that it builds alone: `presets.test.tsx`
  requires every preset's sources to be book pages;
  `src/components/gd/hall/presets/presets.test.ts` (the "write each
  source one way" test, lines 102–112) expects the book line and URL
  only; the editor's test (`HallPlayground.test.tsx:202`) finds the
  book's link instead of `public/pics/neophyte.svg`.

### I.3 Removing the drawings, and the redirects

**Removed**: `public/pics/{neophyte,zelator1,zelator2,theoricus1,theoricus2}.svg`
(1,983,319 bytes) and every reference in the "Old `/pics/*.svg`
references" table: the built-in docs (I.1); the five paths in
`RITUAL_PUBLICATION_STATIC_PATHS` (15 to 10; `next.config.ts`'s trace
files follow the list); `staticRitualImageCatalog.test.ts`'s list of
real files (15 names to 10, 17 available paths with the two aliases to
12, SVGs 6 to 1, rasters still 11); `ritualPublicationTracing.test.ts`
(it follows the list); the fixture in `renderForEditing.test.tsx`
(`/pics/candidate-hexagram.svg` instead, which stays); `/about`'s link
to `/pics/neophyte.svg`. (The presets' and the editor's tests changed in
I2.)

**Redirects** (308, `next.config.ts`'s `redirects()`), from one table
of the five old names and their slugs, `RETIRED_HALL_DRAWINGS`, with
the targets from `hallFiles(...).svg.path`. Next checks redirects before
the filesystem and `public`. A test holds the table: each target is a
hall's SVG path, no source is a file under `public`, and no source is
in the publication's static paths.

How each thing that holds a `/pics` URL behaves afterwards, from the
code:

- **A browser** loading the URL (the ritual editor's preview of an
  `img` in an unedited revision, external links, search engines, the
  legacy public reader if a ritual still holds one) follows the 308 and
  shows the hall's SVG, which has no external references and draws in an
  `<img>`.
- **Publication does not follow redirects.** The static catalog
  (`staticRitualImageCatalog.ts`) reads each listed path from `public/`
  on disk, and the inventory (`ritualAssetInventory.ts`) admits only
  listed paths. So the list drops the five and gains nothing: the new
  hall SVGs are build output, not files in `public/`, and were never put
  to the ritual SVG validator (plan 062, decision 8); rituals now hold
  halls as `gdHall`, not as images. An alias in the manner of
  `legacyStaticImageAliases` would need both, so it is not done. A ritual
  whose current revision still holds `img(src="/pics/neophyte.svg")` then
  reports `unrecognized-local-reference`, its asset plan is incomplete,
  and publishing it fails (`INCOMPLETE`) until the image is replaced.
  The administrators' publication backfill, which walks every ritual,
  would stop there too.
- **Bundles already published** keep working as they are. A private
  ritual is read from its bundle (`PrivateRitualReader.tsx` turns each
  captured asset into a `blob:` URL, online and offline), and the server
  serves the newest publication for the ritual's current revision
  (`sqlRitualBundleReads.ts`). The production ritual "0=0 Grade of the
  Neophyte", published on 15 September with the drawing captured,
  therefore still shows the old drawing, from its own copy, until it is
  edited and republished; the redirect is never involved.
- **Existing revisions** are unchanged in the database. Opened in the
  editor, an old revision's image previews through the redirect as the
  new hall.
- **The service worker** precaches `public/**` (`precacheEntries()` in
  `next.config.ts`), so the five drawings leave the precache, about 2 MB
  less on every install; Serwist deletes them when the new worker
  activates (`skipWaiting: false`, so after the app's tabs close). Until
  then the old worker's precache answers `/pics/*.svg` with the old
  drawing. A runtime image cache entry (Serwist's `defaultCache`,
  stale-while-revalidate) would show the old drawing once and then the
  hall; an image request from the worker follows redirects (only
  navigations use manual mode). Checked in Chromium in the stage's
  browser run (below).

**What Gadi must do**, after the deploy that carries this. The bundle
reader (`sqlRitualBundleReads.ts`, lines 211–218) returns nothing unless
the newest accepted publication belongs to the ritual's current
revision, so `PrivateRitualReader` shows the ritual as unavailable, and
devices that resync drop their copy (`repository.ts`, lines 479–503).
From the moment the edit is saved until it is published, readers
cannot open the ritual at all; if the publication fails, it stays
unreadable. Reverting does not help after this deploy either: the old
source's `/pics/neophyte.svg` can no longer be published. Hence:

0. **First, the query.** Check, read-only, which rituals' current
   revisions cite a drawing:
   `select r.id, r.title from rituals r join ritual_revisions v on v.id = r.current_revision_id where v.source ~ '/pics/(neophyte|zelator1|zelator2|theoricus1|theoricus2)\.svg';`
   The pattern matches the path anywhere in the source, so it
   deliberately catches absolute same-origin URLs
   (`https://magick.ly/pics/neophyte.svg`) too, which the inventory
   also treats as local. Every ritual it finds goes through steps 1
   and 2.
1. **Rehearse locally.** Put a copy of the production ritual's current
   source into the local database (a private ritual in the local
   development temple; the copy never enters the repository), replace
   `img(src="/pics/neophyte.svg")` with the Neophyte hall (`/hall` →
   Neophyte Temple, or the hall and its link from the built-in
   `0=0.pug`), save, publish, and see the publication succeed and the
   reader draw the hall, offline too.
2. **Then production, at a quiet time.** Keep the current source to
   hand, make the same edit, save and publish at once, and open the
   ritual in the reader. Whether one action does both: the classic
   editor (`/doc/<id>/edit`, `SqlDocEdit.tsx`) publishes straight after a
   save that queued a publication ("The saved version is queued for
   publication"), while the semantic editor publishes with its own
   button after Save; the rehearsal shows which applies, and the single
   action is the one to use if it does. If the publication fails, do not
   go back to the kept source (it cannot be published any more): save a
   version without the image line, which publishes with no image at
   all, and look into the failure; the kept source is for the hall's
   text, not for publishing.
3. **Not before step 2**: the administrators' publication backfill,
   which would stop at this ritual.

**The `/about` credits.** The Eye of Horus (game-icons.net, CC BY) and
the caduceus (SVG Repo) are in these five drawings only: `Lamen` was
redrawn in stage H (its test checks for neither), and the other SVGs
under `public` are `candidate-hexagram.svg`, Gadi's own drawing
(efe0c4a, "replace candidate-hexagram with own svg"), and `vercel.svg`,
the framework's logo. After I3 no URL of the site serves either icon,
except a published bundle that captured a drawing, which the bundle
endpoint serves until its ritual is republished: today the production
Neophyte ritual's, until it is republished. Gadi decided on 28 October
2026 to remove the credits now, on this branch, since he is not sure
when he will deploy and a short uncredited window is fine:

- I3 removes the files and the redirects, and drops the credit's link to
  `/pics/neophyte.svg` (which would now lead to our own art).
- I4 removes the two credits, in the main sequence on `gate/halls-i`.
  The steps above for the production ritual stay; the credits no longer
  wait for them.

### I.4 Reader export: deferred

Plan 061 names reader export in the Stages table and decision 8 ("a
later stage") but never designs it; decision 10 keeps `ExportControls`
and editor code out of the reader. With stage I, each built-in hall
links to its page, where its PNG and SVG download under CC BY 4.0, and
any hall in a ritual can be exported by copying its Pug into
`/gd/halls/editor`. A real export from the reader would put a menu and
the export code into the reader's chunk and the offline bundle, and
needs a design (where it sits, a private hall's file name, the
Enochian font in PNGs). Deferred to the Follow-ups (Gadi, 28 October
2026). A cheaper way, recorded there too: an "Open in the hall editor"
link on a ritual's hall, which loads the Pug printer on click and opens
a `#hall=` link in the same browser (the fragment never reaches a
server), where the editor's export already works.

### I.5 The end-of-project review (prepared for the orchestrator)

To run once I1 to I3 are built (fresh Opus High per area, Fable High
for the whole):

- **The hall pages and the editor**: `/gd/halls`, every hall page and
  `/gd/halls/editor` at 1,440 × 900, 1,024 × 768 and 390 × 844, against
  sheets A1 to A3; the redirects with `#hall=` and `#preset=`; whether
  the editor is still wanted beside the ritual editor's hall editor, as
  decision 1 asks to revisit at the end, and what it should say about
  saving in a ritual.
- **Scales**: `DEFAULT_SCALES` (`layout.ts`) against the 1938 diagrams
  and the drawings it was measured on: the Zelator and Theoricus
  banners (half as large again in the drawings; the presets accept the
  drift or set `scale`), floor lamens (1.66 squares) against dais
  lamens (2.31), the tablets (1.345; Zelator 2.655), the boards by
  `scale`, the kameas; a sheet of all fourteen presets side by side at
  one size, and each beside its 1938 page, viewed from a local copy
  outside the repository and never committed.
- **The conflicts table** ("Where the sources disagree"): each of rows 1
  to 10 against its preset as built (the Portal's swapped diagrams, the
  Philosophus letters, pillars and Venus, the Zelator's Earth tablet and
  altar, the Neophyte's Banner of the West), and the notes under the
  table (incense in the Theoricus' South-East, the Practicus pillars).
- **Open decisions for Gadi**, gathered from the Follow-ups: the Chiefs
  on the daises of the stage F presets; the cards proposal (Eden, the
  Fall, the serpent and Venus on the Tree); the Minutum Mundum's path
  colours; the five remaining planetary seals; the Portal Hiereus'
  ring; the tablets' colours and letter choices; Enochian Plain's
  licence and whether PNG exports embed it.
- **The artwork ledger**: every row's status, `THIRD_PARTY_ART` empty,
  `/about#credits` matching what is served (after I4).
- **Stage I itself**: the built-in docs in the reader and the ritual
  editor, offline (a published sample ritual read with the network off),
  the five redirects, publication refusing an unedited `/pics` image
  with a clear message, and the docs screenshots.
- **Housekeeping**: the "Old `/pics/*.svg` references" table empty;
  the URL-form grep of plan 062's amendment (A6) only the redirects; the
  Follow-ups pruned of what stage I and plan 062 closed; plan 000.

The reviewers get this list, the branch, the sheets and a running
production build on 127.0.0.1.

### I.6 Commits

After plan 062's amendment (P1 to P3), each one gated commit on
`gate/halls-i`, building and passing alone:

| # | Commit (subject) | Content |
| --- | --- | --- |
| I1 | `feat(doc): Draw the built-in rituals' halls` | I.1: the five halls and their links in the three docs, `builtInHalls.test.ts`, the screenshot seed's update, the recaptured screenshots |
| I2 | `refactor(gd): Drop the old drawings as sources` | I.2: the `drawing` source kind and the five presets' drawing sources, the art's file paths, the books-only filters, the presets' and the editor's tests |
| I3 | `feat(gd): Retire the old temple hall drawings` | I.3: the five files, the static paths and their tests, the fixture, the redirects and their test, the reworded credits |
| I4 | `docs(about): Drop the old drawings' credits` | the two credits (Gadi: now, on this branch) |
| D | `docs(plan): Record the halls and stage I` | the results here and in plan 062's amendment, the Old references table, the Follow-ups, plan 000 |

I3 and I4 can be reverted together without I1 or I2 (the drawings
served again, credited); I1 alone (the docs' images back) only before
I3; I2 alone at any time.

### I.7 Verification

- **Gates**, per commit, one at a time, in a clean `git archive` export
  on `/home` with Node 24 and the CI placeholder environment (the
  stage's adaptation of `~/.cache/gates/gate.sh`, statuses under
  `~/.cache/halls-i/gates/`): `install --frozen-lockfile`, `check`,
  `typecheck`, `test:coverage` and `build`, each `$?` read; the tip also
  `loom check`, the magick-data smoke test and `check:turbopack`. The
  compiler identity files show no diff against `main`; `src/components`
  imports no app code.
- **Unit tests**: I.1's test; the redirect table; the static paths and
  the catalog's real-file test at ten; the presets' sources.
- **Built output** (`next build`, `next start` on 127.0.0.1): `curl -I`
  of each `/pics/<name>.svg` gives 308 to its hall's SVG, which is 200
  `image/svg+xml`; `/pics/candidate-hexagram.svg` still 200; the
  precache manifest without the five.
- **Browser** (headless Chromium over CDP on 127.0.0.1 and a fresh port;
  a temporary `.env.local` holding only the local-login and database
  lines, deleted afterwards and before any docs capture, which refuses
  a worktree with one): `/doc/neophyte`, `/doc/zelator` and
  `/doc/theoricus` draw their halls, each link opens its page; a
  temple ritual from the built-in 0=0 in the reader and the semantic
  editor; a revision still holding `/pics/neophyte.svg` previews the
  hall through the redirect, and publishing it fails with the image
  named; a service worker from the commit before I3, then the update,
  then `/pics/neophyte.svg` (the old drawing until the new worker
  activates, the hall after). Firefox: the redirect of an image. No
  Safari or real device; stated.
- **Documentation screenshots**: the five recaptured and inspected.

### I.8 Risks

- **The production ritual** shows the old drawing until Gadi edits and
  republishes it, cannot be republished before he does, and is
  unreadable between the edit's save and its publication. Steps 0 to 3
  above: rehearsal first, then save and publish together; the
  publication error names the image.
- **A dead link offline**: a reader of a published ritual offline who
  follows a hall's link gets no page, since the hall pages are not
  precached (plan 062 keeps them out of the service worker). Accepted;
  the hall above the link draws offline.
- **Unknown rituals or bundles** citing a drawing: the query in step 0
  finds rituals; bundles published from them keep their copies and
  keep working; external links follow the redirect.
- **The credits** are gone before the production ritual is
  republished, so its bundle serves the two icons uncredited until then
  (Gadi accepts the window).
- **The built-in docs and the presets drift apart**: the test ties them,
  at the cost of editing three docs when a preset changes.
- **The shared local database**: the seed's new revision of the sample
  ritual shows in captures from other worktrees until this merges.
- **A redirect to a different drawing**: the old URLs now show the
  preset, which differs where the presets follow the book (Zelator's
  Earth tablet on the wall, conflict 7). That is the intent: the
  drawings are retired, not kept.

### I.9 Gadi's answers (28 October 2026)

1. **The credits**: removed now, on this branch (I4 in the main
   sequence), not held for the republish; a short uncredited window is
   fine. The production ritual's steps stay.
2. **The drawings as sources**: dropped entirely, not pinned to commits
   (I.2). He drew them from Regardie's diagrams; only the primary
   sources are cited.
3. **Reader export**: deferred, as recommended (I.4); recorded in the
   Follow-ups.
4. **The link under each built-in hall**: "Neophyte Temple: stations,
   sources and downloads" (each hall's short name), with the 0=0 hall
   moved into a note, as recommended.
5. **The editor in the sitemap**: a plain entry (plan 062's amendment,
   A10).

## Commits

| Commit | Change |
| --- | --- |
| 4165f3c | Noto Serif and Noto Serif Hebrew subsets, their generator and kern table, OFL notices (also for the existing Noto Sans fonts) |
| ed0d464 | Hall model, vocabulary and validator |
| 946a743 | Layout resolver and label wrapping |
| e63ae08 | `GdHall` renderer, chrome and the package's original art |
| 8a7babd | Import-boundary test for `src/components` |
| a0381b0 | Registry attributes for item kinds and officers (A1 review) |
| 7ef8363 | `Lamen`: Past Hierophant, `Map` lookups, no duplicate caduceus id |
| 82f2bee | App art registry `gdHallArt`, `lamenArt`, legacy art, item scales |
| 507b99e | Unique text path ids in the Shewbread and candlestick (hook-free `idPrefix`) |
| c1b775c | magick-data: the trumps' titles on the paths ("The Universe" for XXI) |
| 9b37566 | Pantacle, lightning, `tarotKey`, `tablet`, `shewbread`, `candlestick` |
| f4f4ff7 | The five presets and their tests |
| 7a7885e | Shared placement rules and node walk (review M1, m1) |
| 77dedc4 | Label line limits and minimum wrap width (M1) |
| d5551bf | Free label width and nested geometry clamped (M2, m6) |
| 3424553 | Stacked labels, wrapping at the drawn width, row extents (m2, m3) |
| fe21e69 | A hall without a dais (m7) |
| fe2a380 | Import boundary resolves aliases and `..` (m8) |
| 3fae4ba | Soft hyphen and no-break space in label measurement |
| 28e3677 | The validator reports what the layout cuts |
| 538198e | Clipped messages, Hebrew baseline, glob, provenance |
| 47990fc | Compass labels move past art outside their wall (A2 review) |
| 51d67ec | Tablet scales from the boards: 1.345, Zelator 2.655; Zelator tablet outside (A2 review, major) |
| dc27b1a | Zelator 2 cites its drawing alone (A2 review) |
| 4b996aa | Pantacle ring drawn letter by letter; Hebrew advances in `fontMetrics.json` (A2 review) |
| 6e79728 | `tarotKey` clamps and rounds `n`; `integer` number specs (A2 review) |
| 1173d66 | Theoricus 1 cup clear of the card's title (A2 review) |
| 7262684 | magick-data: the trump titles described as the common ones (A2 review) |
| 4e30021 | Hook-free test of the Shewbread and candlestick by rendering (A2 review) |
| 8ace114 | Zelator Earth tablet inside on the North wall line at the default size, per the book (conflict 7) |
| 2eec39e | `ExportControls` `prepare` hook; hall fonts inlined in PNG exports |
| e1e5ec7 | Read-only `/gd/hall` gallery: presets, sizes side by side, the original drawings, sources, export |
| 87b6b6a | No node drawn without a valid tag (final review m1) |
| 37f9d36 | Doors on the floor's 0–16; door bands keyed by order (final review m4, nit) |
| ab35fcb | Markers' text laid out through the label line budget (final review M1) |
| acb5ebb | Each art variant drawn once per hall in `<defs>`, placed with `<use>`; attack tests with byte budgets (final review M1) |
| 0f3ca01 | Structured preset sources with one formatter (final review nit) |
| 47eddf8 | A failed PNG copy reported as failed, not as a refused clipboard (A3 review m1) |
| a6d1faa | `image.decode()` before rasterising (A3 review n3) |
| 0b03f8b | `gdHallFontFaceRule` checks its source (A3 review n2) |
| e1fb37a | The Zelator Earth tablet test checks labels and compass words (A3 review n1) |
| 14d74fa | `Lamen`: the Hierophant's striped ring, the Past Hierophant's white ring and role icon (before B) |
| b8d6394 | One cell size: `inset`, labels at the cell width, one default scale per kind; `sizes`, `officerScale` and the gallery's toggle removed (before B) |
| c916b3e | Citations for the lamen rings in `lamen.tsx` and decision 9 (before B) |
| 55f2430 | The Past Hierophant's role icon without brackets (before B) |
| b19a005 | The Neophyte Dadouchos at x = 14.75, its label inside the floor (before B) |
| 575d22a | The reader boundary test follows `import()`, the `@magick-components` alias and index files (B) |
| 4d3b50b | The reader's lazy `gdHall` block, hoisted hall fonts, `next/dynamic` in tests (B) |
| ab2f700 | `gdHall` as one editor atom, drawn and labelled "Temple hall" (B) |
| 347fe2b | The compiler accepts a `gdHall` subtree by shape and imports it as elements, Pug's keywords and the `doctype` prefix reserved, at the top level or in a note, summary, list item or todo only; Pug prints halls one node per line (B, decision 2; review M1, m3; final review M) |
| d7dce07 | The reader's block registry without a prototype: a legacy `toString` row renders as plain content (B review m1) |
| 1cdb45a | The hall package reserves the compiler's names; `reservedTag`, with the `ritual` + capital and `doctype` prefixes; a cross-test of both validators (B review m2; final review M) |
| 83b2211 | The placeholder shaped by `estimateHallAspect`, coordinates and result clamped; base dimensions and `COORDINATE_RANGE` in `dimensions.ts` (B review m5; final review M) |
| 98eb915 | An error boundary keeps the placeholder and the ritual when a hall cannot draw, and tries again for a changed hall (B review m4; final review m) |
| 34f24ff | Spaces after a hall's tags ignored by the Pug parser (B review n1) |
| cc5e413 | The visual editor refuses to move a hall where it may not stand (B review m3) |
| 0e2b46e | A pasted hall whose rows break the shape rule is refused by the clipboard parse rule (B final review m) |
| 1caf6b7 | Ritual text reads U+2028 and U+2029 in its line forms (B final review m; older than halls) |
| 4618ca1 | The offline inventory counts the rows below the root, as the compiler counts nodes (B final review nit; older than halls) |
| 71847b9 | Temple hall in the slash menu and the Insert… dialog: presets copied with fresh IDs where a hall may stand, the caret after it (C) |
| ea0f106 | Copy Pug source on `/gd/hall`: a preset as Pug without IDs, the printer loaded after the page (C) |
| 52ab8b6 | Hall warnings in the Pug source editor at the node or attribute they name, never blocking a save (C; decision 2) |
| 98f4ffa | Text without a keypress over a selected block or gap cursor typed over it as a keypress does; an IME's first keydown opens the paragraph (C review, major) |
| 3016669 | The Insert… dialog puts a hall after a selection whose ends lie in different blocks, at the end for Select All (C review) |
| 5a2b847 | Hall warnings checked in idle time after the pause; stale and unmount guards tested (C review) |
| 9923d1e | Copy Pug source reports a printer error as such and says when the printer cannot load (C review) |
| 447f30a | The resolver reports each object's frame, position and scale, and each door's path (D) |
| d7bec90 | The visual hall editor `GdHallEditor`: selection, drag, handles, keys, properties panel, palette, warnings; its model, geometry, edits and palette modules; randomised operations on every preset (D) |
| fc00423 | Edit hall in the ritual editor's hall atom: in place, one undo step per gesture, ProseMirror kept out of the editor's events (D) |
| bc6db42 | Drags applied by node ID to the hall held at release; gestures ended by Escape, undo, redo, Delete, a lock or a new hall; the view box held during a drag; one pointer at a time (D review M1, m5, m6) |
| 0c5b352 | The page's text selection cleared when the hall drawing takes the focus; Ctrl/Cmd+X, C and V cancelled there (D review M2) |
| 3476c25 | Undo and redo only while the ritual takes changes, without scrolling; `writeHallToAtom` refuses while locked and reports a dropped write; refusals shown (D review M3, m1–m3; Fable review) |
| 522d4bb | Ctrl+S and Save write a hall field's typed value first (`pendingEdits.ts`); a field disabled by a lock writes on unlocking (D review m4; Fable review) |
| 3e1cb42 | Labels hit first; defaults remove switches; one-sided bounds; focus only for a waiting author; Edit hall disabled, not hidden; `(pointer: coarse)` followed; the selection described, not named (D review nits) |
| d0121ec | The resolver reports each host's child frame (E) |
| d28e67f | Rows reorder by drag, Alt+arrows and the panel; an explicit position freezes the spread siblings; Spread evenly again (E, Gadi's decision) |
| 8fd906f | Objects stand on hosts and leave them by drag or the panel's Stands on, converted to stay where they are drawn; `hallHosts.ts`, `ensureFloor`, `moveHallNode` (E, Gadi's decision) |
| fbbe523 | A "⚠ N warnings" badge beside Edit hall, opening the editor at its warnings; the validator loaded by the editor only (E, Gadi's decision) |
| b3b4d22 | `GdHallEditor` without Done, history buttons or the ritual's locked note, for a host that is always editing (E) |
| 8663fef | `printHallSource` and `parseHallSource` for a hall's own source; headerless hall warnings; a layout preference per editor (E) |
| 27683ff | `/gd/hall` as a hall editor: views, presets, history, draft, share link, export; the gallery removed (E) |
| add477f | The palette puts on a host only what it takes (`hallHostRules.ts`); Stands on offers the current host (E review m2) |
| 8560526 | A pasted ritual header: "leave out the … header line" (E review n1) |
| aee6374 | Typed source read once typing rests; kept and shared halls at most 1,000 nodes, links 64 KB, drafts 96,000 characters (E review m1, F1) |
| 0e129f3 | A tab writes only what it changed and offers another tab's newer draft; the shared hall held through Undo and Redo; notes from what the browser holds, stacked, clipped (E review M1, F2, m3, Fnit1) |
| b0324d6 | An error boundary and `<noscript>` line for the lazily loaded editor (E review F3) |
| 398b7c9 | "Correct the source to share the hall." not announced (E review n3; n2 held by a test) |
| b29b2a3 | The layout switch reads Source, Split, Visual in every editor, pressed as well as filled (`RITUAL_EDITOR_LAYOUTS`, `RitualLayoutSwitch`) (F, Gadi's request) |
| a2e29c7 | The original-drawing comparison removed from `/gd/hall` (F, Gadi's request) |
| a551e6e | The adepts in the ritual role catalog; plain circles for hall roles without a lamen (F) |
| afa1fe9 | `kamea(planet)` drawn from Agrippa's squares, computed; `seal(planet)` a placeholder; Theoricus 2 draws both (F) |
| 6b2d403 | `board(kind)` diagrams: `TreeFigure` shared with `TreeOfLife`, the Flaming Sword and Minutum Mundum, labelled Eden and Fall boards (F) |
| 65162ab | `veil`, `altar(kind="white")`, items `gong`, `brazier` and `candle` (F) |
| a842390 | The placeholder estimate places banner rows along their line; `placedByAt` shared (F) |
| 1ad0abc | The Practicus, Philosophus and Portal presets from the 1938 layouts; conflict 10 (F) |
| d5219d7 | magick-data: the planetary kameas (`astrology/kameas`), orders checked, a table without a prototype; the hall's planet words in `planets.ts` (after F, Gadi's decision; review fixes folded in) |
| 1c291d6 | The shared `Kamea` component (`src/components/astrology`), which the hall's `kamea` art wraps, pinned to 33ad461's bytes (after F, Gadi's decision; review fixes folded in) |
| 8096767 | The hall editor's properties panel docked at the foot of its scrolling box when the editor is under 732 px (16 px of hysteresis), sized by that box, hideable and shared, keyboard selections scrolled clear of it, focus kept (after F, Gadi's decision; review fixes folded in) |
| 4bb082d | Split `/gd/hall`'s panels at the full width, its columns 2:3, the toolbar in the text column (after F, Gadi's decision; review fixes folded in) |
| 571b022 | `/gd/hall` keeps its history ahead of the render: typing read but not yet drawn is kept as a link opens or the page goes; gestures made before the hall is drawn are refused; the preset question asks from the hall as it is (after F, a CI failure under load; review fixes folded in) |
| 012aa58 | Every `/gd/hall` test allows 20 s, as most did (after F, timeouts under load) |
| 026a55a | `/gd/hall` split 3:5 (G, Gadi's decision) |
| f809947 | The ritual editor's split 2:3 while a hall is open for editing (G, Gadi's decision) |
| e7657d7 | magick-data: tablets' `kind`, shapes, letters and `marks`; `WATCHTOWER_IDS` (G; review fixes folded in) |
| ce0b8c3 | magick-data: the Golden Dawn's Water, Fire and Tablet of Union, with sources, nine squares read as the Order's names read them, `alt` from every source (G; review fixes folded in) |
| 3c86990 | `Tablet` draws Water, Fire (their sigils) and the Tablet of Union, mirrors reversed letters; `/enochian/tablets` and the image offer Water and Fire (G; review fixes folded in) |
| 48664e4 | The hall's `tablet(element)` takes all five, the Union on its own board (G) |
| 65bf16a | The Philosophus and Portal presets draw their Fire, Water and Union tablets (G; review fixes folded in) |
| a7b46b3 | `Tablet` named as an image; unnamed in the hall and the image route, whose bytes stay (G review) |
| d34635e | An error boundary ends hall editing when the hall editor cannot load, instead of taking down the ritual editor (G review) |
| 68d96bc | magick-data: notes on the tablets' versions, differences, sources and 70 squares (`enochian/tabletNotes`) (G, Gadi's request) |
| 4f7c9e9 | `/enochian/tablets` explains the tablets and shows, square by square, where the sources differ (G, Gadi's request) |
| 8e60545 | The items' palette (silver, wine, bread, green, gold's deep tone, glass), one outline weight for every item, the gong, brazier and candle on it; geometry helpers (H) |
| aa92abd | The cup, chalice and censer (standing) as original flat emblems in the old boxes (H; review fixes folded in) |
| 158a48f | The lamp and lantern as one original drawing; `light` (red, yellow, white) in the validator, the panel and the Pug; a warning and a label for a light's old `fill`; the panel's colours only for the items that draw them (H; review fixes folded in) |
| f26ae70 | The rose (heraldic), salt (a shaker), bread (a round loaf) and fan as original flat emblems; `legacyArt/` removed (H; review fixes folded in) |
| 10d8c1f | The Keryx's caduceus and the Sentinel's Eye of Horus redrawn from geometry; the list of third-party art empty; `/about`'s two credits kept for the old drawings (H; review fixes folded in) |
| 3bcc110 | `Lamen` moved to `src/components/gd/Lamen.tsx` (MIT), drawn by the package's `lamen` art; `lamenArt.tsx` gone (H) |
| 6db02d5 | magick-data: each source's reading per square, versions as rules (`tabletVersion`, `tabletDifferences`), Earth and Air the Golden Dawn's by default, the notes rewritten around the versions (Tablet versions) |
| a05f661 | `Tablet` draws any version, its reversed letters optional and second letters in the corners; the Equinox's sigils; none for Dee's and Raphael's (Tablet versions) |
| d129108 | `/enochian/tablets` chooses a version and says how it differs from each other; the image route takes `version` (Tablet versions) |
| fc7a6e1 | The hall's `tablet` takes `version`, `reversed` and `alt`, the Golden Dawn's when absent (Tablet versions) |
| f05bbf7 | The adepts' Portal lamens (option A) in `Lamen`, `lamenGlyphs.tsx`; Malkuth's colours in the palette (H2, Gadi's decision) |
| ce5b2a1 | The Portal's own Hiereus and Hegemon: `Lamen`'s `grade`, the hall's `grade="portal"` (`lamenGrades.ts`), in the validator, the panel, the editor's names and both Portal presets (H2) |
| 3b8bd15 | The Keryx's wings (K1, a dip round the ball) and coils narrowing and tightening downward; `smoothPath` draws a stretch of a path (H2, Gadi's decision) |
| 501d320 | `card(kind)`: Pan, the Devil, Death and Typhon as emblem cards in the tarot key's frame, labelled; Portal 2 draws them; storm grey (H2, Gadi's decision) |
| ce5daa8 | The Moon's and Venus' seals after Agrippa's 1533 woodcuts on silver plates; `publicDomain()` provenance (H2, Gadi's decision) |
| d62c7c0 | The Keryx's caduceus as V1 with two turns: a helix of depth-ordered arcs, the "Arch" wings (H2 follow-ups, Gadi's decision) |
| ea29a29 | One palette button per group, each with its menu, and each entry drawn beside its name; one tab stop for the six; the marker under Text and the Hebrew letter under Symbol (H2 follow-ups, Gadi's request; review fixes folded in) |
| 620b3d6 | Notes on the 5=6 lamens and the Portal Hiereus' collar (H2 follow-ups; review fixes folded in) |
| 366e80d | `/gd/hall`'s source panel reaches the screen's foot in Source view and sticks, as tall as the viewport, in split view (H2 follow-ups, Gadi's request; review fixes folded in) |

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
`planetarySpirits`, `entity/index`; the README note below); export font
embedding for the Tree of Life; Firefox and Safari checks of PNG export with
embedded fonts; whether a hall's PNG embeds Enochian Plain for the tablets
(Stage A3 notes); labels of single words wider than their cell, which
the layout cannot keep inside the walls (the Neophyte "Dadouchos" was
moved instead: Decisions before stage B); the
RWS tarot credit and the Pinterest hotlink in `2=9.pug`;
`src/components/entity/entityFields.test.ts`, which reaches app code
through `import.meta.glob("../../app/**/fields.ts")`, a path the
import-boundary test cannot see;
`README.md` (lines 13–15) says `src/components/LICENSE.txt` lists the
components that import app code; it lists none, so either the file
gains the list or the README stops saying so. `GdHall` uses `useId`
and `useMemo`, and the `/og` and `/api/render` routes render without a
hook dispatcher (Stage A2 notes), so server rendering of halls and the
reader export (stage I, Stretch) need a hook-free id scheme, such as an
`idPrefix` prop as the Shewbread and candlestick take; and the resvg
font stacks below.

From stage B: built-in docs that hold halls (stage I) must
keep `//-` comments out of them, or their exact parity test and the
corpus audit must allow the dropped `{}` rows (Stage B notes); the
synthetic "Hall check (stage B)" ritual stays in the local development
database.

From stage C: the warnings parse the source a second time (63–83 ms on 74 KB, now in
idle time), so they could reuse the editor's parse, which would need
it to keep locations and run first, or move off the main thread;
Chromium can move a selected block's DOM selection to an editable
position before input arrives, and ProseMirror then reads it as the
author's: seen in 3 of 28 fresh CDP key presses shortly after
selecting a hall or rule next to another (the key went into the
title), and in the first stage C build after a hall selected as it
mounted. Keeping a block
selection against moves the author did not make (no pointer, touch or
key) would cover it, at the risk of refusing a caret set by assistive
technology, so it is not done (the hall editor of stage D selects no
node, on entry or after). A composition
that starts without an IME keydown over a block next to another
uneditable block reaches the new paragraph but does not end cleanly in
Chromium (seen only with CDP's `Input.imeSetComposition`). The input
handling is checked in Chromium only (no Firefox or Safari run here).
The `members` documentation screenshot depends on the order of
members added on the same day, and `join-code` on the capture's
origin; during the capture the dev server logged a server error on
`/temples/admin/<temple>/membership/<member>` ("Cannot read properties
of undefined (reading 'disabled')", HTTP 500) while the shot still
came out unchanged; and `pnpm check:turbopack` failed on 18 October
2026 for `main` (d1aaf33) as for this branch, Turbopack's
`next/font/google` resolving no Roboto files
(`@vercel/turbopack-next/internal/font/google/font` not found), while
it passed for stage B.

For stage B (PNG export): resvg-wasm 2.6.2 did not resolve the hall's
quoted font stacks (`"GdHall Noto Serif", "Noto Serif", serif`) to a
loaded Noto Serif in a test harness, falling back to Noto Sans, while the
bare family name worked; check the stacks before relying on resvg for
hall images.

From stage D: editing a label child apart from its object; Firefox and Safari, and a real phone or tablet, for the
pointer, touch and focus handling (checked in headless Chromium with
CDP touch events only; no Safari device); Chromium not scrolling a pan
that begins within a touch's radius of an object.

From the stage D review fixes: the ritual creation form saves through
its Create button, which in Safari does not take the focus, so a hall
field still being typed there is not written first (only the semantic
editor's Ctrl+S and Save flush); the save that Ctrl+S starts locks the
ritual, which disables the field and drops its focus, so the author
clicks back into it; on a phone only objects at least about 3.25
squares across get finger-sized handles at 390 px (the panel scales
the rest); the reader and the documentation screenshots were not
rechecked in this round (no publication storage in the minimal local
environment).

From stage E: free labels never move onto hosts, since a `label`
under a host labels it (a free-text child of a host would need a
vocabulary change); `/gd/hall` renders no drawing on the server (the
editor is client-only for its draft and fragment), so search engines
see its text only; share links in format 0 (uncompressed, for browsers
without compression streams) are tested in jsdom and Node only; the
new gestures (reorder, hosts, Alt+arrows) and the page are checked in
headless Chromium only, with CDP touch events for the phone (no Firefox,
Safari or real device); on the phone the badge and the Hiereus moves
were checked at desktop size only; during a reorder drag the dragged
officer's label can overlap its neighbour's until release; nodes typed
in the page's source without IDs get new ones at every parse, so such a
node selected in the drawing loses its selection as typing goes on; the
documentation screenshots were not recaptured (no publication storage
locally) though no screen they show changed unless a hall has warnings.

From the stage E review fixes: an app-wide `error.tsx` (and
`global-error.tsx`), since only `/gd/hall`'s editor has a boundary and
any other client error shows Next's default screen; the two-tab draft
handling (`storage` events), the boundary and the notes checked in
headless Chromium only, with background throttling off and CDP's
viewport for the phone (no Firefox, Safari or real device); a hall
typed or pasted beyond the limits is still read whole at each rest
(seconds for thousands of nodes), which a worker or an incremental
parse would cure; a tab closed while the choice between two tabs'
drafts is unmade keeps the other tab's.

From stage F: whether the Practicus, Philosophus and Portal presets
should have the Chiefs on the dais like the five drawn ones (the 1938
diagrams draw none; Stage F notes; Gadi leans towards Greer's redraws,
which seat them, and will decide after reviewing the merged presets);
Gadi to look again at saved boards drawing by `scale` once merged (he
accepted the change on 20 October 2026); drawing the seals, the Garden of Eden and the Fall, the
adepts' lamens, the symbol of Venus on the Tree and the Portal 2
figures (Pan, the Devil, Death, Typhon), and the Minutum Mundum's path
colours (magick-data has none) in stage H; the slash menu now lists fourteen halls
after "Temple hall" (typing a grade narrows it); the new presets and
the switch checked in headless Chromium only.

From the follow-ups after stage F: the docked panel (sticky in the page
and in the ritual editor's scrolling visual panel, the safe-area inset,
the scroll margins, keyboard selections scrolled clear of it) checked
in headless Chromium only, with touch emulation for the phones (no
Safari, Firefox or real device); `env(safe-area-inset-bottom)` stays 0
until the app opts into `viewport-fit=cover` (the ritual editor's
split and `/gd/hall`'s 2 px at 1280 × 800 Gadi settled in stage G);
a `/gd/symbols` page for `Kamea` (the repository's way of showing
a symbol: page, SEO entry, card, render contract); the seals and
sigils over `Kamea` in stage H, through its `children` and
`kameaGeometry`.

From stage G, for Gadi: the letter choices in Water and Fire (the
variants table in Stage G notes, every row marked); switching Earth and
Air to the Golden Dawn's version, and the squares it would change; the
tablets' colours (Air's own angle brown rather than mauve); drawing
`alt` letters, and the reversed letters on Earth and Air once they
carry marks; Water's sigil as Regardie and Greer draw it rather than
the Equinox; the Tablet of Union on `/enochian/tablets` and the image
route, which needs a viewBox per id in the render contract; a source
`version` for the tablets (done in Tablet versions, with Earth and Air
switched and second letters drawable); Dee's
manuscripts read directly for it; a West-wall Watchtower drawn along
the wall needs rotation, which the hall does not do. The tablets'
colours wait for Gadi's review at the end of the project (the contrast
renders are in the decision folder). The notes on the versions could
later name each square's reading per version once the `version` work
lands, and cover the Tablet of Union once the page shows it; the page's
export still draws the outlines when the switch is on.

From stage H, for Gadi: the Garden of Eden and the Fall (drawn
schematically or labelled boards; see the cards proposal below);
"Venus on the Tree of Life", "Mercury" and the serpent drawn over
`TreeFigure` or kept as markers; the Minutum Mundum's path colours
(path colour data in magick-data first). The seals, Pan, the Devil,
Death and Typhon, and the adepts' lamens were decided on 24 October
2026 and are done in part 2. The before and after sheets are outside
the repository (Stage H notes). The new art is checked in headless
Chromium only (no Firefox, Safari or real device).

From stage H, for Gadi: the seals, deferred (adapt `/gd/sigils`, which
draws sigils on the Golden Dawn's rose, to draw sigils on the kameas,
then decide what the hall's `seal` shows: the traditional seals after
Agrippa's 1533 woodcuts from a cited scan, or generated figures, and
whether name sigils belong in the hall); Pan, the Devil, Death and
Typhon (drawn figures, tarot keys and emblems, or markers); the Garden
of Eden and the Fall (drawn schematically or labelled boards); what each
adept's lamen shows; "Venus on the Tree of Life", "Mercury" and the
serpent drawn over `TreeFigure` or kept as markers; the Minutum
Mundum's path colours (path colour data in magick-data first). The
before and after sheets are outside the repository (Stage H notes). The
new art is checked in headless Chromium only (no Firefox, Safari or
real device).

From the tablet versions (24 October 2026): the British Library
follow-up (Tablet versions: re-check the Sloane MS 3191 catalogue
record and, when its images return, the folios, the 1587 capitals, the
Black Cross, Dee's struck letters, Fire's x and p squares and the
licence); Dee's Black Cross in the data after that; Gadi's calls on the
two empty Fire squares and Cotton's x (both built as recommended); the
1587 print's v in Fire's row 6 square 8; the Tablet
of Union on the page and the image route, still waiting for a viewBox
per id. The page and the hall checked in headless Chromium only (no
Firefox, Safari or real device).

The seals and the kamea sigils, both deferred (Gadi, 24 October 2026):

- **Name sigils over a kamea.** Adapt `/gd/sigils`, which traces a
  name's sigil over the Golden Dawn's rose, to trace it over a planet's
  kamea as well: the planet's square; the name's letters as numbers,
  reduced by Aiq Bekar where a value exceeds the square; a path through
  the cell centres `kameaGeometry` gives; and start and end marks as on
  the rose. That gives the *name sigils*, such as those of the planetary
  intelligences and spirits. `Kamea` can host it as an overlay, through
  its `children`.
- **The traditional seals** are not those sigils but designed figures in
  Agrippa, *De occulta philosophia* (1533), book II, chapter 22, to be
  hand-drawn after his public-domain woodcuts, cited by archive.org item
  and leaf. The hall's `seal(planet)` shows them; the sigil tool is a
  separate feature.
From stage H, part 2:

- **The remaining seals.** Saturn's, Jupiter's, Mars', the Sun's and
  Mercury's seals are still the placeholder; they are drawn the same
  way, after the same copy (leaves n163–n167 hold their tables), when
  a hall needs them.
- **Name sigils** over the kamea (the intelligences' and spirits'
  sigils, and sigils of any name) are a separate, later `/gd/sigils`
  feature, not hall art. The sigil system needs more work first: it
  handles easy names but not all the hard cases.
- **For Gadi**: the Portal Hiereus' ring, red as built, reading
  p.156's "Black Collar" as a misprint for "Black Cloak" (Follow-ups
  of 26 October 2026); if Gadi chooses black, a dark grey (about
  `#333`) ring with the usual outline. Whether the Third Adept's blue
  and orange need telling apart from the Praemonstrator's at icon size.
- **A 5=6 hall** (none yet): the Chief Adept bears the Rose-Cross
  (Regardie 1938, vol. 2, pp.202 and 220, a double Phoenix collar in
  the Pastos), and the Second and Third probably do too (inferred from
  vol. 3, p.51, and vol. 2, p.254), not the Portal's lamens. A grade value
  in `lamenGrades.ts` for the 5=6 would draw it, when a Vault or 5=6
  preset needs it; noted in the code.
- **The Keryx's Shin** (V2), which Gadi liked for its symbolism but did
  not choose for icon sizes: possible later as a larger drawing, such
  as the Keryx's own lamen in a close-up, if ever wanted.
- **The palette's menus** checked in headless Chromium only (no
  Firefox, Safari or real device), and only in `/gd/hall`; the ritual
  editor's hall editor, the same component, by its tests.
- **`/gd/hall`'s sticky source panel** leaves 72px empty above it while
  the app bar is hidden on scrolling down; following the bar's
  visibility would close the gap. Checked in headless Chromium only;
  `100dvh` on a phone is not used (the panels stack there).
- **The cards proposal** (not done, for Gadi). The rituals show the
  candidate three kinds of thing, and the hall could draw each one way:
  - *Pictures shown to the candidate*, which the officers hold up or
    lead the candidate to: the Portal's four (cards now), the Garden of
    Eden shown with the Kerubim in the Theoricus (vol. 2, p.83, leaf
    n77), the serpent of Wisdom on the Tree (p.84, n78), the "Diagram of
    THE FALL, facing West" in the Philosophus (p.144, n138) and the
    symbol of Venus on the Tree of Life there (p.145, n139). These suit
    the card: portable, upright, labelled, one emblem each. They would
    become `card` kinds (`gardenOfEden`, `theFall`, `serpentTree`,
    `venusTree`), Eden, the Fall and Venus drawing the Tree's own
    `TreeFigure` inside the card frame, so the frame is shared and the
    Tree's geometry with it.
  - *Diagrams on a stand* that stay in the hall for the whole grade:
    the Flaming Sword (Zelator) and the Minutum Mundum. These stay
    `board`s, larger and sized by `scale`, as now.
  - *Objects*: the furniture and the items (lamps, cups, the tablets,
    the Pantacle). They stay items and tags.
  The boards `gardenOfEden` and `theFall` would stay valid for saved
  halls (decision 2); the presets would move to the cards. The serpent
  on the Tree is today a marker and `serpentTree` an item kind with no
  art of its own in the presets. Recommendation: cards for the pictures
  shown, as above, with one frame; to be decided before stage I.
- **Checked in headless Chromium only** (no Firefox, Safari or real
  device); no documentation screenshot shows the changed art (the
  editor and reader shots show the Neophyte's old `/pics` drawing, and
  no Keryx or adept role icon).

From the search pages (26 October 2026; [plan 062](062-gd-hall-seo.md),
built on `gate/hall-seo`):

- **What remains here**: stage I (the built-in docs switched to the
  presets, the `public/pics` drawings and their `/about` credits
  removed once nothing cites them, each built-in ritual's hall linked
  to its page, reader export, and the end-of-project review of
  `/gd/hall`, the scales and the conflicts table) and stage J (the
  private hall sources, outside the repository).
- **"+ Image" in the hall editor** (Gadi, 26 October 2026: should a
  hall allow images?). Saved for later; Gadi wants the current work
  finished first. The ritual renderer may already draw images in
  rituals, but offline bundles and rights need thought. Options to
  weigh, not decided: users upload images and assert their rights;
  for private temples rights may not matter; or an uploader consents
  to (donates under) CC BY 4.0, against keeping copyright for internal
  use.
- For stage I, from plan 062: each built-in ritual's hall links its
  page under `/gd/hall/<slug>`; whether the `/gd/hall` editor's source
  list keeps citing the `public/pics` drawings, which the hall pages no
  longer cite; and the reader's hall could take a `<desc>` from
  `describeHall`.
- Plan 062 closes, once merged, the follow-ups on a hook-free id scheme
  for `GdHall`, resvg's fallback for the quoted font stacks and a
  drawing of `/gd/hall` for search engines. Gadi answered this plan's
  question on Enochian Plain for the published images: fine to draw the
  tablets in it; its unknown licence stays a follow-up (plan 062). The
  editor's exports will carry the art's attribution only (plan 062,
  decision 12).
