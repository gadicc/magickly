# The tablets page: desktop layout and the tablets' names — 18 November 2026

Status: drafted 18 November 2026 and amended after a Fable 5.2 review the
same day (see [Review](#review-18-november-2026)). Stage 0, the sources,
done on 19 November 2026 (see [Sources](#sources-stage-0-19-november-2026));
the decisions below are amended from it. Stage 1, the desktop layout,
built on 19 November 2026 on `gate/tablet-names` (see Stages). Read [current status](000-current-status.md) first. The
number was free on every branch and worktree when drafted (088 and 089 are
claimed on other branches); claim it again when committing.

Gadi's decisions so far (18 November 2026): names may be added to
magick-data; the Tablet of Union is in scope, on the page and the image
route; the order of the work is ours; the tablet images may be
re-identified and republished where a change moves them.

## Background

`/enochian/tablets` ([page](<../src/app/(public)/enochian/tablets/page.tsx>),
[component](../src/app/enochian/tablets/tablets.tsx)) draws a Watchtower
as a portrait page, 210 × 297, its sigil above its grid, at the full width
of a `lg` container. Measured on magick.ly on 18 November 2026:

| Viewport | Tablet drawn | Square |
| --- | --- | --- |
| 1440 × 900 | 1152 × 1629 px, 1.8 screens tall | ~84 px |
| 375 × 812 | 343 × 484 px | 25 px |

On a desktop the whole tablet is never on screen at once. The grid starts
halfway down the first screen, and the list of squares where the sources
differ, with a chosen square's detail, is below all of it. On a phone the
page is fine as it is.

The page names no angel. Readers come to the tablets for the names read
off them: the three holy names, the King, the Seniors and the sub-angles'
names. The Tablet of Union, which the data and `Tablet` already draw, is
not offered on the page or the image route. `TABLET_IDS` in
[the render contract](../src/render/contracts/enochianTablet.ts) holds the
four Watchtowers, "waiting for a viewBox per id" (its comment, and plan
061).

### The names follow from where squares sit

Each name is read along a fixed path of squares. On a Watchtower's 13 rows
of 12 squares, counting from 1:

- **The Great Cross** is row 7 and columns 6 and 7.
- **The three holy names** are row 7, read as 3, 4 and 5 letters (MOR, DIAL,
  HCTGA on Earth).
- **The six Seniors** are read outward from the centre, seven letters each:
  along row 7 to the left from square 7 and to the right from square 6, and
  up and down columns 6 and 7 from row 7.
- **The King** is read in a whirl through eight squares round the centre:
  row 7 square 5, row 6 squares 6 and 7, row 7 square 8, row 8 squares 7
  and 6, row 7 squares 6 and 7. It is the same eight squares on all four
  tablets (ICZHIHAL, BATAIVAH, RAAGIOSL, EDLPRNAA). That is the Golden
  Dawn's King. Dee's is seven letters: the first six squares of the whirl
  and one of the two centre letters, so two spellings, Bataiva or Bataivh
  (stage 0).
- **The four sub-angles** are the quarters the Great Cross leaves, 6 rows
  of 5 squares each. In each one, the column in the middle and the row
  below the top make a Calvary cross: the column read down is a name of
  six letters, the row read across a name of five. Across the top row, the
  four squares outside the cross hold the Kerubic name, read in four
  rotations, each one letter further to the left (RZLA, ZLAR, LARZ, ARZL);
  Dee was given the same rotations. The four rows below the cross bar, four
  squares each, are the four servient angels, which the Golden Dawn also
  rotates.

The Golden Dawn attributes the sub-angles by position: top left Air, top
right Water, bottom left Earth, bottom right Fire. So BOZA is the Kerubic
name of "Air of Earth".

That is 38 names a tablet, 152 for the four. Most squares lie in one name.
Of the 156 squares, 136 lie in exactly one name, 16 in two and 2 in three.
The two centre squares lie in six: a holy name, four Seniors and the King.

### Measurements (18 November 2026, at `28a7f9f1`)

The 152 names read from each version were checked against the dictionary's
headwords, by script (not committed; stage 2 turns them into tests).

Read from the Golden Dawn version:

| Read as | Names |
| --- | --- |
| The version's letters | 140 |
| With a second letter the Golden Dawn prints in one of its squares (`alt`) | 10 |
| With another version's letter in one of its squares | 2 |
| Not found | 0 |

Read directly from each version: Raphael 143, the Golden Dawn 140,
Regardie 134, Dee 134, the Equinox 128. None of the Kerubic rotations
(OZAB, ZABO, ABOZ and so on) is a headword.

These matches say less than they seem to. Every tablet-role entry in the
dictionary (Seniors, Kerubic angels, servient angels, archangels) comes
from `WE`, *The Whole Enochian Dictionary*, which the magick-data README
describes as an online compilation of unknown author and status. The
dictionary is a list to link to, not an authority for the names. The
cited lists in the repository are the twenty-four Seniors from Regardie's
vol. 3 (1939), p. 73, and eight of Water's names from Liber Chanokh
([`tablets.test.ts`](../packages/magick-data/src/enochian/tablets.test.ts),
which reads them along its own path helpers).

### The Tablet of Union and the names built with it

The Union's four rows are names: EXARP (Air), HCOMA (Water), NANTA
(Earth), BITOM (Fire). The Kerubic archangels are a Kerubic name with a
Union letter in front. The dictionary gives two prefixes for most
sub-angles. One is always the first letter of the tablet's own Union row
(NBOZA, ERZLA, HTAAD, BDOPA), and the other varies (ABOZA, HTNBR, ETAAD,
ADOPA). For four sub-angles it says only "WATER OF" or "EARTH OF", with the
tablet's element missing (plan 000 lists this). Stage 0 found the Golden
Dawn's rule: the first letter of the tablet's own Union row, for all four
sub-angles (decision 8). No source found explains `WE`'s second prefixes.

## Decisions

### 1. Two columns on a desktop, the tablet no taller than the screen

From MUI's `md` breakpoint (900 px) up:

- **Left column:** the tablet in a box sized to fit both ways: at most the
  column's width and at most the screen's height less a fixed allowance for
  the app bar, the breadcrumbs, the margins and the dark plate's padding.
  The box does not depend on the tablet's shape, so the landscape Tablet of
  Union fits it in stage 4 as the portrait Watchtowers do. It stays in
  place (`position: sticky`) at a fixed top, as the halls' rail does
  (`hallPage.module.css`, `top: 80px`); it does not move with the app bar,
  since moving or resizing the largest thing on the page whenever the
  scroll changes direction would be worse than the bar covering its top
  margin.
- **Right column:** the tablet and version choices, the switches, the
  panel (decision 2), then the downloads (`ExportControls`), the second
  letters' list and the font credit.
- **Below both:** the tablet's note, the chosen version's note and how it
  differs from the others (`VersionSection`), and "About these tablets",
  at full width as now. They stay in the prerendered page.

Square sizes this gives, at the measured allowance of about 108 px:

| Viewport | Square |
| --- | --- |
| 1440 × 900 | ~41 px |
| 1366 × 768 | ~33 px |
| 1280 × 720 | ~32 px |
| 900 × 700 | ~31 px |

The left column is at least 440 px wide. Where the height would make the
squares smaller than 30 px, the tablet is sized by the column's width and
no longer stays in place, so it scrolls with the page as it does now. A
"grid only" view (cropping the sigil, about 31% of the page's height) is
left as a follow-up for a laptop screen, to decide after stage 1 is seen.

Below `md` the page stacks as it does now.

The page's choices go into its URL (`?tablet=&version=`), so a view can
be shared; `ExportControls` already takes a `share` link. Only the default
view (Earth, the Golden Dawn's) is prerendered; the others are read on the
client.

### 2. Two tabs, and a state with nothing highlighted

The panel has two tabs, **Names** and **Differences**.

- **Differences** outlines the squares where the sources differ, as the
  switch does now, and holds their list, a chosen square's detail and the
  pairwise comparisons with the other versions (from `VersionSection`'s
  "How it differs from the others", whose square lists are what a reader
  most wants outlined).
- **Names** highlights names (decision 5). With no name chosen, nothing
  is highlighted.

Names is the default, so the page opens with nothing highlighted and the
image link offered. Only one tab is open, so names and difference outlines
are never drawn together.

Stage 1 comes before the names, so in stage 1 the panel holds Differences
alone, behind the switch as now, off by default. Stage 3 adds Names and
makes the switch a tab. The page's copy that names the switch
(`TabletsText.tsx`) is rewritten with it.

The downloads draw what is shown, as now. `downloadName` adds a suffix for
each drawn state: `-differences`, the chosen name's id, `-regions`, and a
chosen square. The image link is offered only when nothing is highlighted.

### 3. The names are computed in magick-data

A new module, `magick-data/enochian/tabletNames`
(`packages/magick-data/src/enochian/TabletNames.ts`), reads the paths of
the Background off a version's grid, as `astrology/kameas` computes its
squares. It has no data file of its own.

- `tabletNames(view: TabletView): TabletName[]` gives one version's names.
  A name holds:
  - `id`: positional and the same in every version (`senior-row-left`,
    `senior-col6-up`, `king`, `top-left-servient-3`), since "Air" and
    "Kerubic" are the Golden Dawn's attributions, not Dee's;
  - `kind`: `holyName`, `senior`, `king`, `crossColumn`, `crossRow`,
    `topRow`, `servient`, and in stage 4 `union` and `kerubicArchangel`;
  - `quarter` where it has one (`topLeft` … `bottomRight`);
  - `squares`, in reading order;
  - `spelling`, the version's letters, a `null` square shown as `?`.
- A `topRow` name carries its `rotations`, each one letter further left,
  which are a property of the one name, not names of their own; Dee was
  given them, so every version has them. A `servient` name carries them
  only in the Golden Dawn's versions, which name each square of a servient
  row by the rotation that starts there (vol. 4 pp.325–326); Dee's record
  gives his servient angels unrotated.
- The King has one spelling in the Golden Dawn's versions (eight squares)
  and two in Dee's and Raphael's (`king` with `spellings`: the six squares
  and either centre letter), as stage 0 found in Dee's record.
- The Golden Dawn's attributions are data on the name where its versions
  are chosen: the quarter's element, and the Seniors' planets (left Mars,
  right Venus, column 6 up Jupiter and down Mercury, column 7 up Luna and
  down Saturn, the King the Sun; vol. 4 p.278).
- `tabletNameVariants(tablet, id)` compares the versions by `id`, as
  `tabletDifferences(a, b)` compares their squares, and gives each other
  version's whole reading of the path, labelled with the version. Second
  letters are not multiplied into spellings: letter-by-letter mixes make
  spellings no source has (74 over the Golden Dawn's names, 31 for Earth's
  ISMT alone, whose row is a whole shifted line in Regardie). They stay
  shown per square, as now.
- The Order's spellings that the paths cannot produce are cited spellings,
  kept beside the name with their source. Stage 0 found twelve: six that
  read a doubled square as two letters (Oblgotca and five others, vol. 4
  pp.330–331), two that read several of Regardie's lower letters along
  Earth's row 8 (NROAM and NAAOM, vol. 3), the three Seniors vol. 3 spells
  unusually, and AISMT (decision 8).

What cannot be computed goes into the existing `tabletNotes.json5`: the
citation for each path, the cited spellings above, and the Golden Dawn's
attributions (the quarters' elements, the Seniors' planets), given as the
Golden Dawn's.

The name lists stage 0 took from the sources (221 entries from the Golden
Dawn's, 67 from Dee's record, each with its source, page and leaf) become a
test fixture beside the tests, not a published data file. No new data file means no new
row in the README's Sources table, `TEXTS` entry or coverage mapping.

`tablets.test.ts` reads its cited lists through `tabletNames` instead of
its own path helpers, so the paths are written once. The component's
`isCrossFromPosition` and `elementFromPosition` (`tabletSvg.tsx`) are
held to the same paths by a test.

The order of the Seniors in `tablets.test.ts` is not the source's; the
tests follow vol. 4 p.277 (left, column 6 up, column 7 up, right, column 6
down, column 7 down).

### 4. The names are tested against cited lists, and link to the dictionary

- **Correctness:** stage 2's tests check the names against stage 0's cited
  lists. Of the Golden Dawn's 221 entries, 188 are produced along the paths
  (181 by the `gd` version, 7 more by Dee's or the Equinox's letters), 20
  are pronunciations or demon roots and not paths, and 13 are the cited
  spellings of decision 3 or are misprints (Equinox I.7's OCAAD for OLAAD);
  the test derives each group and checks every entry's label against the
  paths. Of Dee's ORO names, 36 of 58 are produced by
  his 1584 grid; the rest are pronunciations, 1659 misprints, his
  early guesses at the King, Black Cross names and names read backward,
  each listed.
- **The dictionary:** a test counts, per version, the names whose spelling
  (or another version's) is a headword, case and u/v folded, and pins the
  count. A change in the data
  that loses a match fails it. This decides links; it does not vouch for
  the names.
- **Links:** a name links to its dictionary entry where one of its
  spellings is a headword, trying the version's spelling, the other
  versions' and then a single second letter. The link is relative,
  `/enochian/dictionary?w=KEY` (`wordLink` builds an absolute URL from
  `window` and cannot be prerendered). The map from name to headword is
  built on the server, as the Keys page's `keyEntries.ts` does, so the
  client never loads the dictionary (about 276 KB).
- **Labels:** a dictionary spelling that no version or cited list has
  (the Kerubic archangels' second prefixes) is shown as the dictionary's,
  not as a tradition's.

### 5. The Names tab: one name at a time, and the names through a square

- **The list**, grouped as the tablet is built: the Great Cross (the three
  holy names, the King, the six Seniors), then each quarter (its two cross
  names, its top row, its four servient names). The groups collapse. Each
  name is a button showing its spelling; the Golden Dawn's role and
  quarter name it where that version is chosen.
- **Hover or focus** previews a name on the tablet: its squares filled and
  its first square marked. A chosen name also shows its reading order,
  since the Seniors read leftward and upward and the King turns.
- **Choosing** a name pins it (`aria-pressed`) and shows its detail: its
  role, its squares in words for the live region, its variants, its
  dictionary link, and the other names through its squares. Choosing it
  again lets it go. Each kind has its own whole message for Lingui ("{name},
  a Senior: row 7, squares 7 to 1"), not a concatenation.
- **Choosing a square** on the tablet pins its name when the square lies
  in one name. Where it lies in more, the panel lists them to choose from.
  The detail's "other names through its squares" gives the same choice from
  the keyboard, as the component's contract asks of anything the squares
  offer.
- **"Show the regions"**, a switch in the tab, tints the Great Cross, the
  top rows, the Calvary crosses and the servient squares. These do not
  overlap, so they can be shown together.

On a phone the list is below a 484 px tablet, so choosing a name would
send the reader back and forth. Before stage 3 is built, a mock-up at
real sizes compares three ways: scrolling to the tablet only when it is
off screen, with the detail under it; the grid alone kept in place while
Names is open; and the detail in the dictionary's sheet (`EntrySheet`).
Any scroll allows for the app bar (`scroll-margin-top`, as `dictionary.tsx`
does) and is instant under reduced motion.

`Tablet`'s `highlights` keeps today's `{ squares, selected, onSelect }`
working (it is published API, magick-components 0.3.1) and adds kinds:
`fill` with an optional order number, `start`, and `region` tints. The
styles are drawn on all five grounds (Earth's black squares and the
yellow, blue, red and white of the others), in light and dark, in the
same mock-up, and must not rely on dashes, which the export strips
(`svgExport.ts`), or put order numbers where the second letters go (top
right). The default drawing's bytes must not move: `Tablet.test.tsx` pins
them, and the halls draw `TabletSvg` too. The package's examples and the
explorer's props are updated with it.

**The mock-up (19 November 2026).** Drawn from the real tablets and
names (a scratch render of `TabletSvg` with candidate layers, screenshot
in headless Chromium), it compared four highlight styles on the five
grounds in light and dark at desktop size, three phone behaviours at
390 × 844, and two ways to show the regions. Gadi chose, as recommended:

- **A chosen name dims the rest.** Every other square is veiled in white
  (about 70%), and the name's squares keep their colours inside a dark
  violet outline, with a flag in the first square's top left corner and
  the reading order in each square's bottom left (clear of the second
  letters, top right). It is one layer over the drawing, so the letters,
  the Enochian font and the mirrored letters are untouched and exports
  draw it as shown.
- **A hovered or focused name is ringed**, a solid violet ring with a
  white edge round each square and the start flag, so moving along the
  list does not dim the whole tablet. Repainting the squares pale with
  dark letters needed the letters redrawn; a line through the squares in
  reading order crossed the letters. Both were dropped.
- **Order numbers only where the squares are big enough.** At a phone's
  24 to 29 px squares the numbers are about 8 px; there the order is in
  the detail's words ("row 7, squares 7 to 1"), which the live region
  reads anyway.
- **On a phone, the grid alone stays in place while Names is open.** The
  title, choices and sigil scroll away; the grid (without the sigil)
  sticks under the app bar and the list scrolls in the space beneath, so
  choosing a name never moves the page. Where the screen is too short
  for that (landscape), choosing a name scrolls the tablet into view only
  when it is off screen. At every width a chosen name's detail opens in
  the list, under the name.
  The dictionary's sheet was dropped: it is modal, and its backdrop
  shades the tablet the reader is meant to look at.
- **The regions are tints:** the Great Cross and the Calvary crosses
  tinted under the letters (they are white squares), the rows above the
  bar hatched lightly over their ground, the servient squares left
  plain, with a key. Outlines were too thin at phone size.

### 6. Every version gets its names; the Union's only where it exists

Stage 0 confirmed the paths against Dee's record: the three names of
God, the Seniors (first given at six letters, then all six at seven), the
Calvary crosses' six- and five-letter names, the four above the bar with
their rotations, and the sixteen below. The King differs (decision 3).
Dee's record gives the rules for ORO, and the others "as the first"; it
writes out no path name of MPH, MOR or OIP. Dee's and Raphael's versions
list their own spellings, by position, without the Golden Dawn's
attributions. Dee names a lesser angle by its place and its office
(medicine, metals, transformation, the elements), not by an element. In Dee's version two names include one of
Fire's empty squares (OBA?I and ANA?), shown with the gap. The names built
with the Union's letters are the Golden Dawn's construction and are listed
only for the versions that have a Tablet of Union (`gd`, `regardie`,
`equinox`). Dee's equivalent, built with the Black Cross, waits until the
Black Cross is in the data.

### 7. The Tablet of Union on the page and the image route

"Union" becomes a fifth choice. Its names are its four rows and the one
column the Golden Dawn reads, E.H.N.B. (vol. 4 p.330).

`TABLET_IDS` grows to take `union`, which needs the contract widened, not
only the list:

- a viewBox per id (`viewBoxOf`, which the contract types already allow),
  a default raster size per id (today one constant, 840 × 1188, which would
  crop the 124 × 104 Union), and dimensions parsed against the id's viewBox;
- `parse` rejecting `union` with Dee's and Raphael's versions, so no "no
  Tablet of Union" image is published;
- the chat catalogue's tool (`catalogue.ts`), whose `element` and title
  say "Watchtower", and the explorer's images (`explorer/images.ts`);
- the contract tests rewritten for per-id shapes, the contract's comment
  and plan 061's note updated, and plan 000's "the Union on the page and
  the image route" item closed.

If that moves the four Watchtower images' identity (`inputs.sha256`), they
are re-identified and republished once, as on the tablet versions' merge
(plan 000); Gadi accepted that on 18 November 2026.

`UnionGrid` takes highlights, as the Watchtowers' grid does, so its names
can be shown. Its Differences tab says that its readings agree (all three
Golden Dawn sources have the same letters), rather than showing an empty
list.

### 8. The names with a Union letter

Stage 0 found the Golden Dawn's rule (vol. 4 p.280): each Kerubic name,
in each rotation, takes the first letter of its tablet's Union row (E for
Air, H for Water, N for Earth, B for Fire), for all four sub-angles. The
row's other four letters go to the servient angels, by the sub-angle's
element in the order Air, Water, Earth, Fire (from EXARP: X, A, R, P).
Vol. 3 pp.74–77 prints all sixteen Kerubic archangels by this rule.

- Stage 4 lists both: the Kerubic archangels, and the servient names with
  their letter. `tabletNames` then needs the Union's view as well as the
  Watchtower's; its signature for that is settled before the package is
  released (decision 10).
- Earth's two lower sub-angles: the rule on the `gd` grid gives NRCNC and
  NISMT, which no source prints. Vol. 3 has NROAM and NAAOM, reading
  Regardie's lower letters along Earth's row 8, and vol. 4 p.303 has
  AISMT. The page shows the derived spelling with the cited ones beside
  it (decision 3).
- `WE`'s second prefixes (ABOZA, HTNBR, ETAAD, ADOPA and the rest) follow
  a pattern by position that no Golden Dawn source gives. They are shown
  as the dictionary's, and the question goes to plan 082.
- Dee's equivalent prefixes a Black Cross letter (Erzla from rzla, p.180),
  which waits for the Black Cross (decision 6).

### 9. Search and the page's description

Site search reads only literal JSX and never runs the page's code
(`src/search/README.md`), so computed names would not be indexed. Stage 3
adds an explicit adapter in `src/search/catalogue.ts` that gives the
Golden Dawn's names of the four tablets (and the Union's in stage 4) as the
page's text. Each change to the page's literal text moves the catalogue's
digest and turns semantic search off until `pnpm search:publish` runs, so
each stage that changes it runs that step. The page's description
(`src/seo/pages.ts`) names the holy names, Kings and Seniors once they are
on the page, and the Union in stage 4.

### 10. One package release after stage 4

magick-data gains `enochian/tabletNames` (its export, `publishConfig`
export and `scripts/smoke.mjs` entry, and a README entry), and
magick-components gains the highlight kinds. CI publishes when `main` is
pushed, and stage 4 changes the names' kinds and signature, so neither
version is bumped inside a stage. A release commit after stage 4 bumps
magick-data to 0.3.0 and magick-components to its next minor, as plan 080
did for 0.2.0.

### Not in scope

- **Cacodemons.** Equinox I.7 pp.236–237 builds three-letter names from
  two letters of a servient row and a Union letter, but defers the rule
  and never gives it; no source found lists them.
- **Dee's Black Cross and the names built with it** (decision 6). Stage 0
  recorded where the letters are given for when it is added.
- **The zodiacal kings and the other tables** (the Tablet of 12, the Holy
  Table), which are not on these tablets.
- **Translating the page.** It is batch T9b of
  [plan 086](086-translation-batches.md). New labels are marked for Lingui
  and their Hebrew written as the repository's rules ask, but the existing
  copy waits for T9b.

## Sources (stage 0, 19 November 2026)

Facts only. Regardie's volumes were read by script and from single page
images; nothing of their text is quoted here or goes into the repository.
Leaves are archive.org page indexes (`/page/n{N}`). The notes on mapping
pages to leaves matter, since the items' page maps are missing or off:

| Item | Pages to leaves |
| --- | --- |
| `IsraelRegardie-TheGoldenDawn-Vol4-1940` | page = leaf + 8 on pp.270–331 (p.270 = n262, as `tablets.json5` has); its page map is empty |
| `IsraelRegardie-TheGoldenDawn-Vol3-1939` | pp.73–77 = n66–n70; no page map |
| `crowley-equinox_202110`, *The Equinox* I.7 | pp.235–237 = n247–n249, by the printed folios (n247 checked on the scan); the page map is a few leaves off here |
| `crowley-equinox_202110`, *The Equinox* I.8 | page = leaf − 30, by the printed folios |
| `truefaithfulrela00deej` | leaf = the page map's `leafNum` − 1, checked on page images |

### The Golden Dawn (Regardie 1940, vol. 4, the Book of the Concourse of the Forces, unless noted)

| Rule | Page | Leaf |
| --- | --- | --- |
| Row 7 the line of the Holy Spirit; columns 6 and 7 of the Father and the Son | pp.276, 278 | n268, n270 |
| The three holy names, row 7 as 3, 4, 5 letters, for all four tablets | p.276 | n268 |
| The King, the eight-square whirl (diagram) | pp.276–277 | n268–n269 |
| The holy names, the Kings and the Seniors of the four tablets | Equinox I.7 p.235 | n247 |
| The Seniors, from the centre squares outward, seven letters, with Air's six | p.277 | n269 |
| The Seniors' planets and the King's Sun; the rules hold for all four tablets | p.278 | n270 |
| The sub-angles' elements by position, as the tablets' own arrangement | pp.278, 281–282 (also p.275) | n270, n273–n274 (n267) |
| The Calvary cross: six letters down, five across; read reversed for evil | pp.278–279; Equinox I.7 pp.235–236 | n270–n271; n247–n248 |
| The Kerubic names and their rotations one letter left | p.279; Equinox I.7 p.236 | n271; n248 |
| The servient rows, left to right without the upright's square | Equinox I.7 p.236 | n248 |
| The Union letters: the row's first to the Kerubic names, the others to the servients by element | p.280 | n272 |
| All sixteen Kerubic archangels | vol. 3 pp.74–77 | n67–n70 |
| Each servient square named by the rotation starting there | pp.325–326 | n317–n318 |
| The Union's rows | pp.275–276, 324 | n267–n268, n316 |
| The Union's column E.H.N.B. | p.330 | n322 |
| The sixteen Calvary column names by sub-angle | pp.330–331 | n322–n323 |
| The Seniors in the consecration of the weapons | vol. 3 p.73 | n66 |

Not found: a full list of the servient angels, a list or rule of the
cacodemons, any other Union column read as a name, and any source for
`WE`'s second prefixes. Equinox I.8 has no name tables beyond the grade
openings.

### Dee (*A True & Faithful Relation*, 1659)

The rules are given for ORO, "from the East gate"; p.184 (n273) says the
other tables are as the first, with three names of God in each.

| Rule | Page | Leaf | The plan's path |
| --- | --- | --- | --- |
| The three names of God, row 7 as 3, 4, 5 letters; the great cross of row 7 and the two columns | p.177; p.184 | n266; n273 | holds |
| The Seniors outward from the centre, six letters, then all six at seven | p.178 | n267 | holds, as the seven-letter form |
| The King: the six squares of the whirl and A or H, Bataiva or Bataivh | pp.178, 184, 189 | n267, n273, n278 | differs (decision 3) |
| The six-letter name that calls and the five-letter name that commands | pp.177–178, 180 | n266–n267, n269 | holds, all eight of ORO |
| The four above the bar, rotated (rzla, zlar, Larz, arzl), and their offices | pp.178, 181 | n267, n270 | holds |
| The sixteen below the bar, and the fourth cross's four by element | pp.180–181 | n269–n270 | holds |
| Names of God with a Black Cross letter (Erzla), the healing angel, demons (aTo, XOY, apa), names read backward (Ogiodi) | pp.180–181 | n269–n270 | not paths |
| The Black Cross letters from Lexarph, Comanan, Tabitom: exarp, hcoma (printed "hcona"), nanta, bitom, set down without the first table | pp.179–180 | n268–n269 | later |
| The Black Cross confirmed; its transversary | pp.183–184, 187 | n272–n273, n276 | later |
| The tables dictated ORO, MOR, OIP, MPH | pp.176–177 | n265–n266 | — |
| The 1587 layout: ORO top left, MPH top right, MOR bottom left, OIP bottom right | Actio Tertia p.15 | n456 | — |

Not found: a quarter for MPH, MOR or OIP; any path name of those tables
written out; which Black Cross letters go with them; the Black Cross drawn.

The stage 0 notes, with the name lists, are in the session's scratchpad;
stage 2 commits the name lists as its test fixture.

## Stages

0. **Sources.** Done 19 November 2026: the leaves for each path, the
   cited name lists, the prefix rule, and Dee's King.
1. **Desktop layout.** Decision 1: two columns from `md`, the tablet
   capped and in place, the URL holding the choices; the differences behind
   their switch in the right column; the phone layout unchanged. Checked in
   a browser at the sizes in Verification.
   **Built 19 November 2026** (`2caae0e1`). Squares measured in a browser:
   42 px at 1440 × 900, 35 at 1366 × 768, 32.5 at 1280 × 720, 31.5 at
   900 × 700; under 690 px tall the tablet scrolls with the page. The
   allowance is 98 px in light and 114 px in dark, and the threshold of
   690 px is the dark figure, used for both. The cap uses the small
   viewport (`svh`) where there is one. A fresh Opus review found no
   blocker or major issue; its minor findings were fixed before the gate
   (the iPad toolbar, focus across the breakpoint, the chosen square on a
   tablet change, the app bar's height, tests for hydration, the downloads
   and the URL's other parameters). Left for Gadi: on a wide but short
   screen (under 690 px tall) the tablet keeps its 440 px column and leaves
   space beside it; and the page's help text (`TabletsText.tsx`) does not
   yet mention "Copy page link", which changes the search text and so
   waits for a stage that republishes search.
2. **The names in magick-data.** `TabletNames.ts`, the notes in
   `tabletNotes.json5`, the export, smoke test and README; no version bump.
   **Built 19 November 2026** (`309d6c34`). The module exports `tabletNames`,
   `findTabletName` (not `tabletName`, which magick-components already
   exports as the image's label), `isTabletNameId`, `TABLET_NAME_IDS`,
   `TABLET_QUARTERS`, `TABLET_QUARTER_ID_PREFIXES`,
   `TABLET_NAME_TRADITIONS` (each version's tradition, `gd` or `dee`,
   which decides the King, the servient rotations and the attributions),
   `tabletNameVariants` (for display: other versions' readings, hiding
   case- and u/v-only differences) and `tabletNameSpellings` (the link
   candidates of decision 4: the version's spelling first, then every
   other version's). Where it departs from the decisions above: the Golden
   Dawn's attribution values are in `TabletNames.ts`, with their citations
   in the notes, so the module does not load the notes; a Union view gives
   no names until stage 4; and the module has a `TEXTS` entry in
   `fieldManifest.ts` with no sources, as `astrology/kameas` has, which the
   package's tests require of every published module. NROAM, NAAOM and
   AISMT are filed under their top rows' ids with `kerubicArchangel: true`
   until stage 4 gives the archangels ids of their own. The fixture is a
   TypeScript module under `src/enochian/fixtures/`, neither exported nor
   packed. Dictionary headwords, case and u/v folded, over the 152 names:
   directly gd 140, regardie 134, equinox 131, dee 135, raphael 150; with
   every version's reading, 152 for each. A fresh Opus review found two
   errors, both fixed before the gate: four holy names from vol. 3 p.73
   were filed as pronunciations though they are path spellings (the counts
   above are after the fix), and Dee's servient names had been given the
   Golden Dawn's rotations.
   Tests: 38 names a Watchtower, the King's whirl, the rotations, the cited
   lists, the pinned dictionary counts per version, Dee's two gaps, the
   component's cross and quarter helpers held to the same paths.
3. **The Names tab.** First the mock-up (decision 5: the phone and the
   highlight styles on five grounds, light and dark) for Gadi. Then the
   highlight kinds (magick-components, default bytes unmoved), the two
   tabs, the list, hover and pin, square to names, the regions switch,
   dictionary links from the server, the downloads' names, the search
   adapter and `search:publish`, the description.
   **Built 19 November 2026** (`4675badf`), to the mock-up's choices
   (decision 5). `TabletHighlights` keeps `squares` required and adds
   `name` (dim the rest, start flag, optional `numbers`), `preview` (the
   ring), `regions` and `anySquare` (one click handler on the grid that
   finds the square from the clicked shape, adding no markup); every
   layer drawn over the squares ignores the pointer. The default drawing,
   with `{ squares: [] }` and the new kinds off, is byte for byte as
   before, and the tablet images' identity did not move. The page:
   `NamesPanel.tsx` (the list as MUI accordions, the Great Cross open;
   the detail under the chosen name; the square's names box; the regions
   switch and key; a visually hidden live region), `nameWords.ts` (one
   whole message per kind and tradition; the Golden Dawn's roles, and for
   Dee's and Raphael's versions positional ones such as "Above the
   cross"), `nameLinks.ts` (server only: the name-to-headword map, 4.8 KB,
   through the Keys' `findWord` and then a case, u/v and hyphen-folded
   index; every name links on today's data, so the single-second-letter
   step is tested on a made-up dictionary). Order numbers are drawn where
   a square measures at least 30 px. Both tabs sit in the panel at every
   width. The phone's grid sticks under
   `(max-width: 899.95px) and (max-aspect-ratio: 5/8) and (min-height: 560px)`
   while Names is open, its top offset from the measured layout width so
   the sigil slides under the app bar, and it follows the bar as it
   hides; elsewhere choosing a name scrolls its squares into view, and
   never while the tablet is stuck. The tab and the chosen name are not in
   the URL; the chosen name is kept by id across tablets and versions.
   Checked in a browser at 1440 × 900 (light and dark), 390 × 844 and
   844 × 390 against a dev server on the gate branch. A fresh Opus review
   found two defects, both fixed and checked in a browser before the
   gate: the region tints took clicks on the 76 cross squares, and with
   the app bar hidden choosing a name in a top quarter scrolled the
   phone's page. Site search: the adapter gives the Golden Dawn's names of
   the four Watchtowers; `search:publish` embedded 8 changed passages;
   after rebasing onto main's own publish, `search:assemble` rebuilt the
   matrix from both sides' committed rows. The pairwise comparisons stay in the
   version section below both columns, as decision 1 places it, not in
   the Differences tab as decision 2 has it.
4. **The Tablet of Union.** Decision 7 (the contract per id, the catalogue,
   the explorer, the republish if identity moves), `UnionGrid`'s
   highlights, its names, the Kerubic archangels and the servient names
   with their Union letter (decision 8), with ids of their own; NROAM,
   NAAOM and AISMT move to the archangels' ids then.
   **Built 20 November 2026** (`8767fa20`). `tabletNames(view)` keeps its
   one parameter: a view carries its version, and a version has one
   Tablet of Union, so the function reads the Union of the same version
   from the package's own data; a second parameter could only be passed
   the wrong Union or left out. New kinds `kerubicArchangel`,
   `servientArchangel`, `union` and `unionColumn` (the fixture's own
   words), ids `<quarter>-kerubic-archangel`,
   `<quarter>-servient-1-archangel` to `-4-archangel`, `union-row-1` to
   `-4` and `union-column-1`, and a `unionLetter` on each archangel, whose
   `squares` are the Watchtower's alone. `TABLET_NAME_IDS` has 63 ids, the
   old 38 first; a Golden Dawn Watchtower gives 58 names, Dee's and
   Raphael's 38, the Union 5 (none in their versions). Dictionary pins of
   the 38 are unchanged; the Kerubic archangels match 14, 14 and 12 by
   their own spelling (gd, regardie, equinox), the Union's lines 4 of 5,
   the servient archangels none. The dictionary's `WE` second prefixes are
   `names.dictionary`, shown as the dictionary's, and their source is a
   question in plan 082. `UnionGrid` takes the same highlights;
   `regions` are the Watchtowers' only. On the page the choice reads
   "Tablet of Union"; tapping a quarter square pins its base name, whose
   detail offers its archangel first. The image contract is per id
   (`TABLET_VIEWBOXES`, the Union's 496 × 416 default, `union` refused
   with `dee` and `raphael`); the 80 Watchtower images' bytes were
   compared before and after and did not move, but their identity moved
   (`1212086a…` to `d7fd15d8…`) because the spec's one input now holds the
   Union's line. A per-id input would have kept it, but needs the
   registry's identity design (plan 032) changed for every component, so
   it is a follow-up. Checked in a browser at 1440 × 900 and 390 × 844. A
   fresh Opus review found a square chosen on one tablet carried to the
   other (drawn off the Union's page) and states that draw nothing on the
   Union still withholding the image link; both were fixed and checked
   before the gate. `search:publish` embedded 14 passages.
5. **Release.** magick-data 0.3.0 and the magick-components minor
   (decision 10); plan 000's status and follow-ups.

Each stage is its own gated commit on a `gate/tablet-names` branch,
implemented by subagents per the model policy (layout and the names tab
Opus high; the data module Opus medium) and reviewed fresh before Gadi
fast-forwards.

## Verification

- `tabletNames` tests as in stage 2.
- In a browser at 1440 × 900, 1366 × 768, 1280 × 720 and 900 × 700: the
  whole tablet beside the panel, staying in place while the panel scrolls;
  below 30 px squares, the tablet scrolling with the page instead. At
  390 × 844: the stacked page and the phone behaviour chosen in stage 3.
  Light and dark, for the Watchtowers and the Union.
- Keyboard: every name reachable and choosable from the list, and every
  square's names reachable from a chosen name's detail; the live region
  reads the chosen name and its squares.
- Downloads: the filenames carry every drawn state; the image link is
  offered only with nothing highlighted; the Union's default PNG is its own
  shape, and Dee's and Raphael's Union is refused.
- The tablet images' identity checked before and after stages 3 and 4.
- Site search: the names in the built catalogue; semantic search on again
  after `search:publish`.

## Risks

- **The names are only as good as the paths and their citations.** The
  dictionary is unsourced (`WE`) and only decides links; the cited lists
  and stage 0's citations are what vouch for the names.
- **A laptop screen.** At 1366 × 768 the squares are about 33 px, the
  second letters under 9 px. The grid-only follow-up exists for this.
- **A long list on a phone.** Thirty-eight names a tablet. The groups
  collapse, and the stage 3 mock-up decides the rest.
- **Image identity.** Widening the contract can move the tablet images'
  identity. Republishing them is accepted (decision 7); the stage that
  moves it says so in its commit and republishes once. Stage 3 must not
  move it.

## Review (18 November 2026)

A Fable 5.2 (high) review of the first draft, read-only, checked the paths,
the King's whirl, the measurements and the layout arithmetic by script and
found them right. Its findings, each checked before acceptance, and what
became of them:

| Finding | Severity | Now |
| --- | --- | --- |
| The Kerubic rotations as four names: none is a headword, and they break the count of 38 | blocker | Rotations are a property of one name (decision 3) |
| Growing `TABLET_IDS` needs per-id viewBox, raster size and parsing, and reaches the chat catalogue and explorer | major | Decision 7 lists them |
| Letter-by-letter variants publish spellings no source has | major | Variants are other versions' whole readings and cited spellings (decision 3) |
| "The dictionary follows the Golden Dawn" is wrong; its roles are all from the unsourced `WE` | major | Tests against cited lists; the dictionary decides links only (decision 4) |
| No default tab; the version note placed twice; three tabs where two serve | major | Two tabs, Names the default with nothing highlighted, the version note below (decision 2) |
| A sticky tablet following the app bar; small squares on a laptop; the controls not placed | major | Fixed top, sizes per viewport, a minimum, controls placed (decision 1) |
| The Union cannot be highlighted, and has no differences | major | `UnionGrid` highlights and an empty state (decision 7) |
| A new data file needs a Sources row, `TEXTS`, coverage; a bump inside a stage is fragile | major | No new file; one release after stage 4 (decisions 3, 10) |
| Computed names are not indexed by site search | major | A catalogue adapter and `search:publish` (decision 9) |
| `wordLink` cannot prerender; the dictionary is too large for the client | major | A relative link and a server-built map (decision 4) |
| The phone's back and forth between list and tablet | major | Mock-up of three ways before stage 3 (decision 5) |
| No keyboard route from a square; pin directly when a square is in one name | minor | Decision 5 |
| `downloadName` misses the regions and a chosen square | minor | Decision 2 |
| Dashes stripped from exports; highlight styles on five grounds; order numbers against second letters | minor | Decision 5 and the mock-up |
| Golden Dawn ids for Dee's and Raphael's names | minor | Positional ids (decision 3) |
| The paths defined twice (component helpers) | minor | A test ties them (decision 3) |
| The Seniors' planets | minor | Cited in stage 0 (vol. 4 p.278); included (decision 3) |
| URL state deferred | minor | `?tablet=&version=` in stage 1 (decision 1) |
| The page's description and plan 000's Union item | minor | Decisions 7 and 9 |

## Follow-ups

To be copied to plan 000's list when the plan is accepted:

- A "grid only" view for laptop screens (decision 1).
- Open a name's dictionary entry in the dictionary's sheet on the tablets
  page, if the phone mock-up does not already choose it.
- Link back from a dictionary entry to its place on a tablet
  (`/enochian/tablets?tablet=earth&name=…`).
- Hash each tablet image's own readings only (a per-id input in the
  render registry, plan 032), so a change to one tablet's data stops
  re-identifying the others (stage 4).
- The dictionary's four Kerubic archangel entries that lack their tablet's
  element (already in plan 000).
