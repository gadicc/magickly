# The tablets' pyramids — 23 November 2026

Status: done. Stages 0 to 4 on 23 November 2026: the sources (see
[Stage 0](#stage-0-what-the-sources-show-23-november-2026)), the data,
the square's detail, the mock-up and the whole tablet drawn as
pyramids, released as magick-components 0.8.0 on magick-data 0.5.0;
stage 5, the image route (`enochian-tablet-pyramids`), on 24 November
2026, and the follow-up "Symbols on the sides" the same day, released
as magick-components 0.9.0. On 26 November 2026 the symbols' facing
was corrected: "outward" had turned each symbol's head to the outer
edge, where Regardie's drawings stand it on its feet there (see
[Symbols on the sides](#follow-ups-not-in-this-plan)), released as
magick-components 0.9.1. The other follow-ups remain. Drafted
23 November 2026, before any code; Gadi answered its first open
questions the same day; amended the same day after a Fable 5.2 review
(see [Review](#review-23-november-2026)), which reversed one answer and
found one question for Gadi, the Calvary bar, which he settled the same
day: the layout per version (decision 2).
Read [current status](000-current-status.md) and
[plan 090](090-tablet-layout-and-names.md) (the page, the names and the
Tablet of Union this builds on) first. The number was free on every
branch and worktree when drafted (092 is the shared tiered location on
another branch, 093 and 094 are taken); claim it again when committing.

Gadi's request (23 November 2026): offer the Golden Dawn's truncated
pyramids on the tablets page, after a survey of what the sources say
about the tablets that the page does not yet use.

## Background

The Golden Dawn treats every square of the four Watchtowers and of the
Tablet of Union as a truncated pyramid (vol. 4 p.291). Its four sides
(triangles) each carry an element and an attribution: a sign and its
decan, a planet, a Sephirah, a Tarot card, a geomantic figure, a Hebrew
letter. Its flat top carries the square's letter. On the servient
squares, the mix of elements on the four sides also gives the square an
Egyptian god, who rules above the pyramid, and a sphinx, built from the
four Kerubs, inside it; both are used in skrying the square
(pp.310–315).

What the members painted were the flat wall tablets (pp.274–275), a
cardboard pyramid for one square at a time (pp.313–314) and the chess
boards, which drop the flat top (pp.347–348). *The Equinox* I(7) prints
every square of the four Watchtowers and the Union as a pyramid (Plates
IV–VIII), in line. A whole Watchtower in coloured pyramids is therefore
our drawing after the Order's rule for one square, and the page says so.

None of the attributions depends on the letters: they are a rule over
positions, which the Golden Dawn applies to its own tablets. So they can
be computed, as the names are (plan 090, decision 3), and tested against
the worked squares and plates the sources print.

## Sources

Read for this plan from plan 090's stage 0 cache (page images and OCR)
and by the review; the facts below are ours, nothing is quoted.

- **Regardie, *The Golden Dawn*, vol. 4 (Aries Press, Chicago, 1940)**,
  "The Book of the Concourse of the Forces", archive.org
  `IsraelRegardie-TheGoldenDawn-Vol4-1940`, page = leaf + 8. In copyright
  outside the US; facts only (AGENTS.md, plan 091). Rules in words,
  tables, worked squares and diagrams.
- **"Liber Chanokh", *The Equinox* I(7) (London, 1912)**, pp.236–238 and
  Plates IV–VIII, archive.org `crowley-equinox_202110` ("The Equinox Vol.
  1, No. 7"), leaves n242–n246 (plates) and n248–n250 (text). Public
  domain. The rules in words by side (upper, lower, left, right), without
  the Kerubic squares' left and right sides, gods or sphinxes; and the
  plates, which draw every square's four sides with their symbols and the
  Calvary crosses' Sephirah numbers. The plates draw every symbol
  upright on the page, the side triangles' too, and the text gives no
  rule for which way they face (added 26 November 2026). Not mirrored in `public/sources/`
  until the plates' draughtsman is established (`src/sources/works.ts`
  holds Plate X back for the same reason).
- **Regardie, vol. 1 (1937)**, the Ten Squares badge of the 27th Path,
  p.157 (leaf n148): a second witness of the Calvary layout. In US
  copyright to 2032; facts only. Vol. 2 (1938) p.137 only names it.
- **Regardie, vol. 3 (1939)**, the Z documents (about leaves n93–n121): a
  second witness for the gods' names and stations (stage 0).

| What | Vol. 4 | Leaf | Equinox I(7) |
| --- | --- | --- | --- |
| The pyramids introduced | 291 | n283 | p.237 |
| The Name's letters on the Great Cross in blocks of three squares (diagram of all four tablets): the tablet's letter at the top and left, the Name read upward and leftward ending there | 282–283 | n274–n275 | p.237; Plates IV–VII |
| The Name across each lesser angle's Kerubic rank, all sixteen (table), and the same rule in words (the outside square is the lesser angle's letter; the reading direction by tablet and quarter) | 283–284 | n275–n276 | p.238 (Air of Water); Plates IV–VII |
| The servient columns follow the Kerubic squares above; the ranks follow the same order read right to left, downward (Air of Air worked) | 284 | n276 | p.238 |
| Signs on the Great Cross: fixed on row 7, cardinal on column 6, mutable on column 7, by the block's letter; the decans in the Order's sequence (36 steps through the Chaldean order, Mars on the first and the last); small cards 2–4 cardinal, 5–7 fixed, 8–10 mutable; the decans run downward on the columns and left to right on row 7, against the Name | 285–287 | n277–n279 | p.237 |
| The Air tablet's Great Cross with every decan, and the small cards on its Swords and Cups blocks (18 of 36) (diagram) | 287 | n279 | Plate IV |
| The Calvary cross: ten squares, the ten Sephiroth; Kether to Tiphareth with Jupiter, Mercury, the Moon, Venus, Mars and the Sun and their trumps (no Saturn); the Ace and 2–10 of the lesser angle's suit | 287–288 | n279–n280 | p.238 |
| The Calvary bar's order: contested (decision 2) | 290, 302 | n282, n294 | Plates IV–VII |
| The Kerubic squares: Yod the Lion, Leo, King; He the Eagle, Scorpio, Queen; Vau the Man, Aquarius, Prince; He final the Bull, Taurus, Princess; of the lesser angle's suit (the Order's court ranks) | 288–289 | n280–n281 | Plates IV–VII |
| The servient squares: the column gives the triplicity, the rank the quality (Yod cardinal, He fixed, Vau mutable, He final the element itself, Earth as Saturn) | 289 | n281 | Plates IV–VII |
| A whole lesser angle worked: the Earth angle of the Water tablet (diagram) | 290 | n282 | Plate V |
| The Tablet of Union: the Aces in the first column, then Prince, Queen, Princess and King, each line its suit (table); its sides | 290, 296 | n282, n288 | p.238; Plate VIII |
| The triangles numbered (1 left, 2 top, 3 right, 4 bottom); each region's rule; colours (Fire red, Water blue, Air yellow, Earth black, Spirit white; a planet by the element it rules: Sun and Jupiter Fire, Saturn and Mercury Air, Venus and the Moon Earth, Mars Water); the alternative in the signs' and planets' own colours; symbols painted in the side's complementary colour | 293–296 | n285–n288 | pp.237–238 (sides only, no colours) |
| Which way the symbols face (added 26 November 2026): vol. 4's drawings stand each symbol on its side's outer edge, its head toward the flat top, so that the top side's symbol is upside down on the page (that a face is to be read from outside the pyramid is our reading; no source states it): p.294, the three ORO pyramids of the Air tablet ("5/6/7 Swords" with their baselines on the outer edge; Venus and Mercury on the right side with their crosses toward it); p.296, the two worked squares (Lovers and Chariot upside down on the top side; the element triangles, read with up toward the centre, give the elements p.295's rules assign; a geomantic figure read from the centre outward gives Albus, the other way Rubeus). p.295 has no drawing and no rule for the facing, only the sides' attributions and the complementary colours | 294, 296 | n286, n288 | Plates IV–VIII draw every symbol upright on the page; pp.236–238 give no rule |
| The table of attributions by Hebrew letter: column and rank letters, trump, symbol and geomantic figure, including the four elements' figures (Air Fortuna Minor, Water Via, Fire Cauda Draconis, Earth as Saturn Caput Draconis) and the six Calvary planets | 298 | n290 | — |
| Worked squares: ORO on Air's row 7; Earth of Earth, column and rank Vau; Water tablet, Air angle, column He, rank Yod; the A of EXARP, the H of MPH, the O of OMEBB, the M of AISMT, the R of BRAP | 294, 296–297, 301–303 | n286, n288–n289, n293–n295 | — |
| The sphinx and the god of a square, the god "especially" for the 16 servient squares; which side gives the sphinx's head, body and limbs; which Kerubs are winged; the tendency | 310–312 | n302–n304 | — |
| The cut-up Kerub figures of the cardboard model | 313–314 | n305–n306 | — |
| The gods by the mix of elements, with Coptic names and the Neophyte station of each (table of 15) | 315 | n307 | — |
| Two worked gods: the n of nhdD (Ahephi), the l of lSha (Anubis) | 318–319 | n310–n311 | — |
| Fortuna Minor for elemental Air again; each Child of Horus as three elements lacking its own element's contrary | 357, 361 | n349, n353 | — |
| Each servient square named by the rotation of its row that starts there; the square's great angel takes its Union letter | 311, 325–326 | n303, n317–n318 | — |

## What it gives each square

| Region | Squares a Watchtower | 1 left | 2 top | 3 right | 4 bottom |
| --- | --- | --- | --- | --- | --- |
| Great Cross | 36 (row 7, columns 6 and 7) | the decan's sign and small card (the sign's triplicity) | Spirit | the decan's planet (the element it rules) | the tablet's element |
| Calvary crosses | 4 × 10 | the tablet's element | Spirit | the lesser angle's element | the Sephirah, with the Ace to 10 of the suit and, on six squares, a planet and trump (white, or the Sephirah's colour) |
| Kerubic squares | 4 × 4 | the Order's court card (the Kerub's element) | the tablet's element | the Kerub and its fixed sign | the lesser angle's element |
| Servient squares | 4 × 16 | the tablet's element, with the sign or element | the column's element, with the trump | the lesser angle's element, with the geomantic figure (p.298) | the rank's element, with the trump's Hebrew letter |
| Tablet of Union | 20 | the column's element (Spirit in the first), with its card (p.301) | Spirit | the line's element | Spirit |

36 + 40 + 16 + 64 = 156, every square in one region, as
`regionFromPosition` (plan 090) divides them. Over the 256 servient
squares of the four tablets the four sides' elements fall as: one element
on all four, 4; three and one, 48; two pairs, 36; one doubled and two
single, 144; all four different, 24. The p.315 table covers every case.

## Decisions

### 1. The attributions are computed in magick-data

A new module, `magick-data/enochian/tabletPyramids`:

- `tabletPyramid(view, square)` and `tabletPyramids(view)`: the square's
  region; the Name's letters that govern it (its block on the Great
  Cross; its column and rank in a lesser angle); its four sides, each
  with its element id and its attribution ids (zodiac sign, decan,
  planet, Sephirah, Tarot card, geomantic figure, Hebrew letter); and for
  a servient square its god and the four Kerubs of its sphinx. Element
  ids, not colours (the colours live in `tabletSvg.tsx`). The square's
  angel and great angel come from `tabletNames` (the servient row's
  rotation from that square, and its Union letter), not recomputed.
- The view is needed for the version (the Golden Dawn's three only;
  Dee's tables carry no elements, and his versions say so, as the
  Union's names do) and for the Calvary layout (decision 2).
- The rules, written as formulas, each with its leaf. The Great Cross:
  block k from the top or left of an arm takes the Name's letter
  (t − k) mod 4 counting from the tablet's letter t, read upward and
  leftward; decan n of the block's sign is the n-th square downward or
  rightward; row 7 keeps its 12 squares, the columns skip it.
- The constants they need, named with their leaves: the sixteen Kerubic
  ranks (p.284, and tested against the rule in words, 16 of 16), the
  planets' ruled elements (p.294), the Calvary planets and trumps
  (pp.287–288, unlike `sephirot.json5`'s planets), the Order's court ranks
  (p.288), the Union's cards (p.290).
- The ids it points at: `astrology/zodiac`, `astrology/planets`,
  `alchemy/elements`, `kabbalah/sephirot`, `kabbalah/paths` (the trumps),
  `kabbalah/kerubim`, `hebrewLetters`, `geomancy/tetragrams`. Two gaps,
  filled first: `zodiac.json5` (12) and `alchemy/elements.json5` (3) gain
  `hebrewLetterId`, graph-checked as `planets.json5`'s is, with p.298 as
  the test; and the geomantic figure comes from p.298's table, not from
  `zodiacId`, which gives Cancer both Populus and Via and Leo both
  Fortunae.
- A new computed module, `magick-data/astrology/decans`: the 36 decans
  (sign, planet) and their small cards, the one source for them;
  `kabbalah/seventyTwoAngelsDerived.ts`, which writes the decans' planets
  out today, uses it.
- The Tarot's minor cards (Aces, small cards and the Order's court cards,
  King, Queen, Prince and Princess, which are not the common deck's
  ranks) as ids and English names in a small `tarot/minorCards` module,
  without titles ("Lord of Peace Restored"), which are a later table.
- The region rule moves into magick-data (`tabletPyramids` exports it),
  and `tabletSvg.tsx`'s `regionFromPosition` is held to it by a test, as
  the cross and quarter helpers are held to the names' paths. One word
  for the top row's squares: Kerubic.
- The gods' table is data: `gd/godForms.json5` (15 rows: the elements,
  the god, the Coptic name, the Neophyte station), cited to p.315 and
  checked against vol. 3's Z documents, with its schema, graph and
  manifest entries and a Sources row, so the halls and any chess can use
  it. The Coptic spellings are transcribed from the page image by hand;
  the "(st)" sign and the font's Coptic coverage are checked before they
  are shown.
- The notes join `tabletNotes.json5` as a `pyramids` section, signed off
  in the Sources table; the README's "not tables" section names the
  computed modules.

### 2. The Calvary bar: per version

The ten Sephiroth's places on a Calvary cross are not agreed. Kether
tops the column and Netzach, Hod, Yesod and Malkuth run down it in every
witness; the bar's five squares differ:

| Witness | The bar, left to right |
| --- | --- |
| Vol. 4 p.290 (n282), the Earth angle of the Water tablet, by its planets | Binah, Geburah, Tiphareth, Chesed, Chokmah |
| Vol. 1 p.157 (n148), the 27th Path's Ten Squares badge, numbered and named | Binah, Geburah, Tiphareth, Chesed, Chokmah |
| *The Equinox* I(7) Plates IV and VI (n242, n244), every lesser angle, the same in each; Plate V read at thumbnail size only, Plate VII not yet (stage 0) | Geburah, Binah, Tiphareth, Chokmah, Chesed |
| Vol. 4 p.302 (n294), worked square: the O of OMEBB, the bar's leftmost square in the Water angle of the Water tablet, is Geburah | agrees with the Equinox |

So vol. 4 disagrees with itself, and its worked square sides with the
Equinox. What would settle it: an Order manuscript of the Concourse of
the Forces, or a surviving painted tablet. Gadi chose (23 November 2026)
the layout per version, as the readings are. The Golden Dawn's and Regardie's versions
take the badge and p.290 (the Order's own badge, the Tree as the Order
draws it, Binah and Geburah on the left); the Equinox's version takes its
plates. p.302 is recorded as vol. 4's own inconsistency, an exception the
fixture names. The page says that the layout is disputed and shows the
other.

### 3. The square's detail first, then the drawing

The detail carries most of the value and none of the legibility or
identity risk, so it ships first.

- **Where:** a third tab, **Squares**, beside Names and Differences. A tap
  on a square in the Squares tab opens its detail; in the Names tab a tap
  keeps plan 090's behaviour (one name pinned; several listed), which its
  tests hold.
- **Keyboard:** the Squares tab has a row and square picker (two selects
  and a button), and a chosen name's detail lists its squares as buttons
  that open the Squares tab at that square; every square lies in at
  least one name.
- **What it shows:** the region and the letters of the Name that govern
  the square; its pyramid, drawn large, with each side's element,
  attribution and symbol, facing outward and in the side's complementary
  colour (p.295, the p.296 squares, which also show a white top), and in
  words for screen readers; the rule it follows, cited; and on a servient
  square its angel and great angel, its god (with the Coptic name and the
  Neophyte station) and its sphinx. [Corrected 26 November 2026: the
  colours are p.295; the facing is Regardie's drawings on pp.294 and
  296, each symbol on its side's outer edge; see the follow-up "Symbols
  on the sides".]
- **The sphinx is shown as the source gives it.** Side 2 gives the head
  and neck, sides 1 and 3 together the body and forelimbs, side 4 the
  lower limbs and tail (p.311); the Eagle and the Man are winged. The
  detail lists the four Kerubs by side with that rule. It does not
  compose one figure (sides 1 and 3 differ in 192 of the 256 servient
  squares, and nothing says which is upper), and the tendency (p.312) is
  "male", "female" or "none stated" where two sides are active and two
  passive (96 squares).
- **The Children of Horus** are the table's reading (each Child by the
  three elements present, p.315; each lacking its own element's
  contrary, p.361), confirmed at p.318 for a doubled element (nhdD: Water,
  Air, Air and Fire, Ahephi); the other doublings follow the same reading,
  labelled as ours.
- **URL:** `?square=row,column` (and the tab) join `tablet` and `version`,
  so the share link carries the chosen square. With Dee's or Raphael's
  version the Squares tab says their tables carry no elements.
- **Citations** go through `<Cite>` and `src/sources/works.ts` (AGENTS.md,
  rule 4), registering vol. 4, vol. 1 and the Equinox's plates.

### 4. The pyramid drawing, after a mock-up

`Tablet` gains `pyramids` (default off; the default drawing's bytes do
not move, nor the halls'): each square drawn as four triangles meeting a
small flat top that holds the letter, in the elemental colours, with a
colour key. Symbols stay off the tablet: at a desktop's 40 px squares
they would be about 8 px. The Union draws its own.

The mock-up decides, at 320, 375, 768 and 1440 px wide, light and dark:
the flat top's size and the letter's ground (the letters fall to about
8 px on a flat top at 320 px); thin lines between black Earth sides; and
each of plan 090's highlight layers over pyramids (the order numbers in
the bottom-left corner and the second letters in the top-right now sit
on triangles; the violet ink sits on black, blue and red; the region
tints assume white cross squares). Proposed: regions and second letters
off in pyramid mode. The switch, "Draw as pyramids", sits with "Reversed
letters" and "Second letters", joins the URL (`pyramids=1`, dropped under
Dee's and Raphael's versions) and the downloads' names (`-pyramids`).

### 5. The image route: a slug of its own

Pyramid images get their own slug and profile, as the kamea and the rose
sigil have (`src/render/componentImage.tsx` line 61 and
`src/render/registry.tsx` lines 285–306 hash one input set per slug), so
the five tablet images keep their identity and a later rule fix moves
only the pyramids'. The contract refuses Dee's and Raphael's versions.
Plan 090's per-tablet identity follow-up need not come first. Until the
route exists, the page withholds the image link in pyramid mode.
Built as planned in stage 5 (below): the slug is
`enochian-tablet-pyramids`, and its inputs hash, besides the letters and
the zodiac, the other fields the pyramids' rules look up (the Kerubs'
signs and the Sephiroth's numbers among them), since a drawing that
fails is a changed drawing, and the fields of the symbols a later
`symbols` key would draw, ahead of that switch, since the inputs hash is
one per slug.

### 6. Search and the page's text

The page's text gains a section on the pyramids (literal JSX, indexed),
saying what is the Order's and what is our drawing; the computed details
are not indexed, as the names' are not. Sphinx and god sentences are
whole Lingui messages; card and attribution names come from magick-data
in English. `search:publish` follows, with Gadi's go-ahead.

## Open questions

Answered by Gadi on 23 November 2026, before the review: the Children of
Horus by the three elements present (now the table's reading, decision
3); gods and sphinxes on the servient squares only; no pyramids in Dee's
versions; the alternative colours later.

Reversed by the review: the element squares' geomantic figures. Gadi
accepted "none", on the draft's claim that vol. 4 gives none; p.298 gives
them (Air Fortuna Minor, Water Via, Fire Cauda Draconis, Earth as Saturn
Caput Draconis), so the plan uses them.

Settled after the review: the Calvary bar, per version (decision 2).

## Stages

0. **Sources.** Read blind, by hand, into a fixture: every square of the
   Equinox's Plates IV–VIII (624 + 20 squares, each side's symbol and the
   Sephirah numbers); vol. 4's worked diagrams (p.287, p.290), tables
   (p.284, p.290, p.298, p.315) and the ten worked squares and two worked
   gods; vol. 1's badge; vol. 3's gods. Record where the witnesses differ
   and whose slip each is, and read Plates V and VII in full for the
   Calvary bar (decision 2). Facts only, by leaf.
1. **Data.** `hebrewLetterId` on signs and elements; `astrology/decans`;
   `tarot/minorCards`; `enochian/tabletPyramids` with the region rule;
   `gd/godForms.json5`; the notes, Sources rows, exports, smoke test;
   tests against stage 0's fixture.
   **Built 23 November 2026** (`aa99a712`). `tabletPyramids(view)` and
   `tabletPyramid(view, square)`, cached and frozen, nothing for Dee's and
   Raphael's versions; a square's `sides` 1–4 carry an `elementId` (one of
   `alchemy/elements`' five, Spirit included; absent only on a Calvary
   square's side 4, which carries the Sephirah) and an `attribution` of
   ids (`zodiacId`, `decanId`, `planetId`, `elementId`, `sephirahId`,
   `pathId` for the trump, `hebrewLetterId`, `minorCardId`, `tetragramId`,
   `kerubId`); servient squares add `angel` and `greatAngel` from
   `tabletNames`, `godFormId` and `sphinx` (the Kerub of each side). The
   region rule is `tabletRegion` (`undefined` off the grid), the Name's
   letters `yod`, `he`, `vav`, `heFinal` with `NAME_LETTER_HEBREW`, and
   every constant is exported with its page and leaf. `astrology/decans`
   is now the 72 angels' source of decans, their outputs unchanged;
   `tarot/minorCards` has 56 cards with the Order's court ranks;
   `gd/godForms.json5` is a table (`gdGodForm`) with the Coptic names read
   by hand from p.315 at 2,648 px (Sothis's first letter low in
   confidence, to be checked before it is shown; no font the site ships
   covers Coptic). Where it departs: magick-components keeps `topRow`
   (follow-up), and the Earth squares of a rank under He final draw
   Saturn on side 1, with Tav as its letter. Tests: the five plates under
   `equinox` but for the five named slips, and under `gd` those plus the
   64 bar sides; pp.283, 284, 287 (one named exception), 290, 298; the ten
   worked squares and three worked gods; every computed attribution over
   2,016 squares against values written out in the test; the exceptions a
   closed set; the counts. A fresh Opus review found no blocker or major;
   its minor findings (untested attributions, an open set of exceptions,
   the region rule off the grid, `vau` against the letters' `vav`, small
   API points) were fixed before the gate. The Sources rows for
   `gd/godForms.json5` and `enochian/tabletNotes.json5` are dated
   2026-11-23, which Gadi confirmed that day.
2. **The square's detail.** The Squares tab, the picker, the large
   pyramid, the god and sphinx, URL, citations, i18n, the page's text and
   search.
   **Built 23 November 2026** (`28a14de6`). The Squares tab
   (`SquaresPanel.tsx`, keyed by tablet), the detail (`PyramidDetail.tsx`)
   and its drawing (`PyramidDrawing.tsx`, app-local SVG), the words
   (`pyramidWords.ts`, whole Lingui messages with Hebrew). Gadi chose, on
   seeing it, the symbols upright by default with a switch to face them
   outward as the Order painted them (page state, kept across squares and
   tabs). [Corrected 26 November 2026: "outward" then turned each head to
   the outer edge; Regardie's drawings (vol. 4) stand each symbol's feet there.
   See the follow-up "Symbols on the sides".] Each symbol has an outline so it reads at 3:1 or better against
   its side (the complementary colours alone are 1.2–1.4:1 on Water and
   Fire). Which symbol a side shows when it carries several (the sign,
   else the Sephirah's number, else the planet, else the Hebrew letter; a
   geomantic figure as dots; the element's own mark otherwise) is ours.
   A name's squares are links that push a history entry, so Back returns
   to the name; `?tab=squares&square=row,column` is written only on that
   tab and dropped off the grid and under Dee's and Raphael's versions.
   The Calvary dispute is one square-specific sentence, the reading behind
   a disclosure; only the O of OMEBB's sentence names vol. 4's worked
   square. Noto Sans Coptic 2.004 (OFL), subset to the names' 29 letters
   and sou, 2,548 bytes, from the google/fonts commit the other fonts pin,
   loaded with the detail and precached by the service worker; Sothis's
   first letter checked on the largest scan there is (the 2,648 px JP2),
   medium confidence. `regardie1939` joins `works.ts`. Checked in a
   browser at 1440 × 900 and 390 × 844, light and dark, every region, the
   Union and Dee's note. A fresh Opus review rendered the detail for all
   1,932 squares of the three versions without a data error, and found
   the dispute sentence crediting vol. 4's worked square everywhere, the
   picker submitting an off-grid square after a change of tablet, the sou
   sign outside its font, low contrast, the letter missing for screen
   readers, the square kept off its tab, and no history for a name's
   squares; all fixed before the gate. `search:publish` embedded 18
   passages.
3. **Mock-up** of the pyramid drawing for Gadi (decision 4).
   **Done 23 November 2026.** Six sheets rendered from the real data by
   a prototype of `Tablet`'s pyramids, each drawing at the width the page
   gives it (squares about 21 px at 320, 25 at 375, 54 at 768 and 42 at
   1,440 × 900), at 320 and 375 (shown at 2×) and 768 and 1,440, light
   and dark: the flat top and its ground, the lines, the other tablets
   and the Union, a name over pyramids, the regions and second letters,
   and the key. Gadi chose:
   - **The top:** half the square, white, the letter black (option B, of
     a third, half, three fifths, and half in the flat tablet's colours).
     No source gives a size: vol. 4 says none in words, and the
     Equinox's plates draw the top about a quarter of the square (27%,
     measured on Plate IV, leaf n242), leaving the sides room for their
     symbols, which the whole tablet does not draw. The page says the
     size is ours.
   - **The top as a number:** `Tablet` computes the top from one share
     of the square (`pyramidTop`, default ½); the page draws ½ and
     offers no picker for now (see Follow-ups).
   - **Lines:** thin grey diagonals, a grey edge round the top and grey
     square borders (L2), so two black Earth sides never run together.
   - **Highlights:** the chosen name, the preview ring and the chosen
     square as they are drawn today. The regions stay off by default,
     with *Show the regions* tinting the whole squares over the pyramids
     as over the flat tablet (R1, not the tops only). No second letters
     on pyramids, ever.
   - **The key:** in the page, translated and read by screen readers,
     not in the download (K1). Built under the switches rather than
     under the drawing, as the mock-up had it: on a wide screen the
     drawing fills the screen's height, so a key below it would fall
     off the screen.
4. **The drawing.** `Tablet`'s `pyramids`, the Union's, the switch, the
   key; default bytes unmoved.
   **Built 23 November 2026** (`9f4a5389`, released in `a4a42550`).
   `Tablet` takes `pyramids` (default off) and `pyramidTop` (the top's
   share of the square, ½ by default, held between 0.2 and 0.8), and
   exports `PYRAMID_COLOURS` and `PYRAMID_TOP`. Every square of a
   Watchtower and of the Tablet of Union is four sides in their
   elements' colours round a white top with the letter in black, grey
   lines between the sides, round the top and round each square; a grey
   border over each square takes its click. No symbols and no second
   letters; the highlights, the regions' tints among them, are drawn
   over the pyramids. Dee's and Raphael's versions, which have no
   pyramids, draw flat, byte for byte. The rules load with the entry
   (`Tablet.tsx` passes `tabletPyramids` in), so the halls' art, which
   shares the drawing, loads none of them. The page: *Draw as pyramids*
   beside the other two switches in the Golden Dawn's versions,
   `pyramids=1` in the URL (dropped under Dee's and Raphael's, and back
   with a Golden Dawn version), in a name's links to its squares and in
   the share link; `-pyramids` in the downloads' names; no image link
   while pyramids are drawn, here and in the component explorer, until
   decision 5's slug; *Second letters* rests while they are drawn. The
   key (`PyramidKey.tsx`) is drawn as a pyramid's lower side, not a
   square, which read as an empty checkbox in white. The Squares tab's
   large pyramid takes its colours from `PYRAMID_COLOURS`. The page's
   text says the whole-tablet drawing and its top's size are ours.
   Checked in headless Chromium against the dev server at 320, 375, 768
   and 1,440 px, light and dark: no sideways scroll, the key under the
   switches, a click on a side choosing the square on a Watchtower and
   on the Union. A fresh Opus review found the component explorer
   offering a flat image under the pyramid examples (a blocker, which
   failed `imageParity.test.tsx`), a name's square links dropping
   `pyramids=1` in a new tab, the halls loading the pyramid rules, the
   white swatches reading as checkboxes and the translation context's
   snapshot due; all fixed before the gate. `search:publish` embedded
   9 passages, on Gadi's go-ahead.
   **Released** in the same branch, on Gadi's choice (23 November
   2026): `Tablet` now imports magick-data's `enochian/tabletPyramids`,
   which the published magick-data 0.4.0 lacks, so the components'
   smoke failed against the registry until magick-data's version moved,
   as plan 090's release did. First released here as magick-data 0.5.0
   and magick-components 0.7.0, which plan 096's release on `main` took
   first; rebased onto `main` (75adebf6), whose magick-data 0.5.0
   already ships the pyramids (stage 1's data), so only
   magick-components is released: 0.8.0 (`Tablet`'s `pyramids`, on
   magick-data ^0.5.0), published by CI when `main` is pushed. Its
   Provenance row, `enochian/Tablet`, now names the pyramid drawing and
   is dated 2026-11-23, as the release option Gadi chose named it.
5. **Image route.** The pyramid slug and profile (decision 5). The
   release moved into stage 4 (above).
   **Built 24 November 2026.** `/api/render/enochian-tablet-pyramids`
   (`src/render/contracts/enochianTabletPyramids.ts`), under its own
   profile, `magickli-tablet-pyramids-image-v1`, so that no flat image
   moves. Its keys are the flat tablet's: `id` (the five tablets),
   `font` (`latin` or `enochian`) and `version`, here only `gd`,
   `regardie` and `equinox` (held to magick-data's `CALVARY_BARS` by a
   test); Dee's and Raphael's are refused with the route's 400, as any
   invalid choice is. Each key is omitted at its default, so a later
   `symbols` key, off by default, leaves every existing query and image
   as it is. The pages and PNG sizes are the flat tablet's (840 × 1188
   for a Watchtower, 496 × 416 for the Union). The file is named as the
   flat image, then `-pyramids`
   (`enochian-air-tablet-regardie-glyphs-pyramids`), which is what the
   page already named its downloads of the drawing;
   the page now takes the name from the image, so the two cannot drift.
   The registration draws `Tablet` with `pyramids` at the top's default
   half, as the page does, in Enochian Plain for the glyphs.
   Its inputs are the flat tablet's two groups (each tablet's readings
   and the version rules) and, for the pyramids' rules, the zodiac's
   `no`, `elementId` and `quadruplicity` (a Great Cross square's sign and
   its decans' planets, which colour its sides), plus what the rules look
   up and fail without: every tablet's `id`, the Union's with the four
   Watchtowers', the signs', the Calvary planets' and Saturn's and the
   four elements' `hebrewLetterId`, the four Kerubs' `zodiacId` (a
   Kerubic square's sign), the `index` of the ten Sephiroth of the
   Calvary crosses, every row but Da'at's (a Calvary square's number,
   and so its card), the paths' `hermetic.hebrewLetterId` and the god
   forms' `mix` and `elementIds`. Last, the fields of the symbols a side carries
   (`sideSymbol`), hashed ahead of the `symbols` switch that would draw
   them, since the inputs hash is one per slug and that switch must not
   move an existing image's identity: the signs' `symbol`, the seven
   planets' `symbol` (the decans', which hold the Calvary crosses' and
   Saturn), the Hebrew letters' `letter.he` and the geomantic figures'
   `rows`; the Sephiroth's numbers are the `index` above. No image draws
   them yet, so a correction to one re-identifies the images without
   moving a byte, the safe direction. A scratch run of the render sweep
   over the nine tables it could change at the time (2,107 changes, not
   committed) found every change that moves the drawing moving the hash;
   the colours, the elements of the Name, the quarters and the ranks, and
   the Calvary bars are code, in the profile. The whole sweep (`RENDER_INPUT_SWEEP=1`) cannot pass as
   it stands: since stage 4, a sign's `elementId` that is no element
   stops the decans, and so the registry, from loading, which the sweep
   does not catch.
   The page links the pyramids' image while they are drawn, and the
   flat image otherwise; the note "No image link while the tablet is
   drawn as pyramids." and its message are gone. A version drawn with
   pyramids that the image does not take (none today) has its link
   withheld with a note, never the flat image's in its place. The component
   explorer offers the image for a pyramid example drawn at the top's
   default, and none for one with a `pyramidTop` of its own (the
   Union's quarter top), which the route does not draw;
   `imageParity.test.tsx` checks each image against its example.
   The flat tablets' identity: their inputs hash (`d7fd15d8…`) and every
   byte pin in `registry.test.tsx` are unchanged and pass. New pins: the
   pyramids' inputs hash; the bytes of Air, Air in glyphs and the Union
   under the new profile, reviewed as rasterised; and, under the same
   profile, a digest of the source markup of all five tablets in each of
   the three versions, so that a rule fix confined to Earth, Water or
   Fire, or to one version's bar, fails until the profile is bumped.

Each stage a gated commit on a gate branch, by subagents per the model
policy (data Opus medium; detail and drawing Opus high), reviewed fresh.

## Verification

- `tabletPyramid` reproduces stage 0's fixture: every square of the
  Equinox's plates (but for the Calvary bar where the version follows
  vol. 4) and of vol. 4's worked diagrams, tables and squares (with p.302
  as the named exception or not, per decision 2).
- Counts: 36 decans each once per tablet's Great Cross; the ten Sephiroth
  once per lesser angle; the twelve signs and four elements once per
  lesser angle's servient squares; the servient element mixes as above;
  every square in one region, in magick-data and the component alike.
- In a browser at 320, 375, 768 and 1440 px wide, light and dark: the
  detail by pointer and keyboard (44 px touch targets), the drawing, the
  key, downloads named.
- The default drawing's and the halls' bytes unmoved; the five tablet
  images' identity unmoved.

## Risks

- **Legibility.** Black Earth sides around a letter, and four colours in
  a 26 px phone square, may read as noise; the mock-up decides, and the
  switch is off by default.
- **The Calvary bar.** Whichever layout is chosen, a witness disagrees;
  the page shows both.
- **Our readings.** The sphinx's composition, the tendency on ties and
  the doublings of the Children of Horus are labelled as ours.

## Stage 0: what the sources show (23 November 2026)

Read blind: five readers, one per plate of the Equinox (Plates IV to
VIII), each given the plate cut into labelled strips of six squares and
a vocabulary of symbols, and nothing about what to expect; a sixth read
vol. 4's tables, diagrams and worked squares, vol. 1's badge and vol. 3's
gods. Each reading was then compared, by script, with this plan's rules
written as a derivation. The readings are facts (a symbol per side), kept
in the session's scratch for stage 1's fixture.

- **The Equinox's plates agree with the rules on 2,571 of their 2,576
  sides**, under the Equinox's Calvary layout. The five exceptions are
  the printer's: two blank triangles in Plate V (the Water tablet, row 9,
  squares 6 and 7, bottom, where the tablet's Water belongs) and three
  Suns drawn without their dot (Plate VI, row 3 square 6 and row 12
  square 6; Plate VII, row 6 square 6), each where the decan rule puts
  the Sun (the third decan of Capricorn twice, the second of Aries once);
  the plates' other seventeen Suns have the dot. Plates V and VII, which
  the review read at thumbnail size or not at all, are now read in full.
- **The Calvary bar.** Every one of the sixteen lesser angles on the
  plates reads Geburah, Binah, Tiphareth, Chokmah, Chesed; under the
  badge's layout 69 sides differ, all on the bars. Decision 2 stands.
- **Vol. 4's diagrams.** The Earth angle of the Water tablet (p.290):
  30 of 30 squares under the badge's layout. The Air tablet's Great Cross
  (p.287): 35 of 36; the 3 of Swords (Libra, column 6, row 2) is drawn
  with Jupiter's glyph, as is the 4 of Swords below it, where the decan
  rule gives Saturn and the Equinox's Plate IV has Saturn: a slip in vol.
  4's drawing, a named exception. The Kerubic ranks (p.284) and the Great
  Cross's letters (p.283) as this plan states them; p.282's grids give
  the lesser angles' corner letters, the same in every tablet.
- **Vol. 4's worked squares**, ten of ten: ORO's three squares (p.294),
  the Lovers and the Chariot squares (p.296), the A of EXARP, the H of
  MPH, the O of OMEBB, the M of AISMT and the R of BRAP (pp.301–303). The
  O of OMEBB is Geburah, which fits the Equinox's layout (decision 2).
- **The gods.** The p.315 table's fifteen rows read; the three squares
  vol. 4 works with their god follow it: the N of nhdD (Water tablet,
  Air angle: Water, Air, Air, Fire) Ahephi, the C of CPao (Air tablet,
  Water angle, a rotation of the second servient row: Air, Water, Water,
  Air) Harpocrates, and the l of lSha (Air tablet, Earth angle, a rotation
  of Shal: Air, Air, Earth, Earth) Anubis (pp.318–319, 321; leaves
  n310–n311, n313). The Children of Horus at p.361 (leaf n353) list the
  same three elements each as p.315. So the reading of decision 3 is the
  sources', confirmed for a doubled element by nhdD.
- **Where vol. 3 differs (the Z documents, pp.101–104, leaves
  n93–n96).** The East's and the South's Kerubs agree with p.315 (Athor;
  Pasht), and so does the North's: vol. 3's Earth Kerub is a power of
  Ahaphshi, which is the Coptic name p.315 prints for Apis (found in stage
  1; vol. 3 names Apis in English only as "the Bull", p.129). The West
  differs: vol. 3 makes the Water Kerub a power of Thoomoo (Tum), where
  p.315 gives Sothis, who is not in vol. 3 at all. Harpocrates stands
  between the Hegemon and the Altar in vol. 4 p.315 and vol. 3 p.121, but
  between the Hegemon and the Evil Triad at vol. 3 p.103. The pyramids'
  gods are p.315's (the table made for them); the West's station is shown
  with vol. 3's reading beside it.
- **The Coptic names** are transcribed with high confidence for six
  rows, medium for seven, low for Osiris and Sothis; stage 1 reads those
  by hand at a larger size before any is shown.
- **The table of attributions (p.298)**: 22 rows, each column and rank
  letter as the servient rule gives it; the He final in the Star's rank
  is printed with its dot below the letter (read as He, which the rule
  gives).
- **The badge (vol. 1 p.157)**: the column Kether, Tiphareth, Netzach,
  Hod, Yesod, Malkuth; the bar Binah, Geburah, Tiphareth, Chesed,
  Chokmah. As the review read it.

## Review (23 November 2026)

A Fable 5.2 (high) review of the draft, read-only, derived the rules by
script and reproduced every worked example it found (p.287 36 of 36,
p.290 16 of 16, the ten worked squares, the Kerubic ranks 16 of 16 by
table and by rule), and read the Equinox's plates and vol. 1's badge.

| Finding | Severity | Now |
| --- | --- | --- |
| The element squares' geomantic figures are in vol. 4 p.298, which the draft missed; `zodiacId` is not a function of the sign | blocker | p.298 is the source; the answer reversed |
| The Calvary bar is contested between vol. 4's diagram and badge and the Equinox's plates and vol. 4's own worked square; the badge is in vol. 1, not vol. 2 | blocker | Decision 2: per version, Gadi's choice |
| The Equinox's Plates IV–VIII draw every square | major | The fixture's main witness (stage 0) |
| Seven worked squares and two worked gods missing; the Children of Horus confirmed once | major | Sources; decision 3 |
| The Great Cross rule misworded; the decans' direction missing; p.287 prints 18 cards, not 36 | major | A formula (decision 1); Sources corrected |
| The ids cannot all be pointed at: no Hebrew letter on signs or elements, Calvary planets unlike `sephirot.json5`, no minor-card table; constants hidden in code | major | `hebrewLetterId` added; constants named; `tarot/minorCards` |
| The sphinx under-specified in the source | major | Shown by side, not composed; "none stated" on ties |
| The detail collides with plan 090's tap; no tab, no URL for the square | major | The Squares tab; plan 090's tap kept; `square=` |
| Highlights over pyramids unexamined | major | In the mock-up; regions and second letters off proposed; a key |
| The identity question answerable now | major | A slug of its own (decision 5) |
| Symbols' colours and orientation; the background's over-reach; the region rule in the wrong package; the decans half-written; the API's shape; the Order's court ranks; the Calvary and Union cards; the gods as `gd/godForms`; Provenance; citations through `<Cite>`; verification sizes; i18n; staging | minor | Each in decisions 1–6, Stages and Verification |

## Follow-ups (not in this plan)

- **The render sweep and a table that stops the registry loading**
  (stage 5, 24 November 2026). `dataInputs.sweep.test.ts` loads the
  registry over each changed table outside its `try`, so a change that
  makes a module throw as it loads (a sign's `elementId` that is no
  element, which `astrology/decans` computes from when `Tablet` loads the
  pyramids' rules) fails the whole sweep instead of counting as a changed
  drawing. Catch it there as a drawing that threw, for every slug.

- **Stretch goal (Gadi, 23 November 2026): the tablet in 3D.** The whole
  tablet as pyramids in three dimensions, which the reader can zoom and
  rotate on desktop and phone, with gestures fit for each (drag to
  rotate, pinch or wheel to zoom, a reset, keyboard controls, reduced
  motion respected). After the flat tablet-wide drawing (stages 3–4).
- The alternative colours, with a King-scale colour table.
- One word for the Kerubic squares in both packages: magick-components'
  `regionFromPosition` still says `topRow` (and draws
  `data-region="topRow"`), held to magick-data's `kerubic` by a test;
  renaming it is a breaking change for the component (stage 1).
- **Symbols on the sides (Gadi, 23 November 2026).** A *Symbols on the
  sides* switch beside *Draw as pyramids*, drawing each side's symbol
  as the Squares tab does (its marks moved into magick-components, so
  both drawings share them) and the top at a size the switch sets, so
  that the reader never sets it. Also the image route's large sizes,
  as the plates print them, as a `symbols` key on decision 5's slug,
  whose inputs already hash the symbols' data.
  **Mock-up and Gadi's choice (24 November 2026).** The Fire tablet at
  the page's square sizes (21, 25, 54 and 42 px at 320, 375, 768 and
  1,440), light and dark, phones with a crop pinch-zoomed 3×: A,
  symbols upright on a quarter top (the Equinox's plates'); B, facing
  out on a quarter top; C, upright on a third (the Squares tab's top);
  and the stage 4 drawing. On a quarter top the letter is about 9 px at
  1,440, on a third about 12.5 px; the symbols are about 8–9 px either
  way, and every variant needs a pinch-zoom on a phone. The outlines
  were drawn at half the Squares tab's width, which at full width fill
  Spirit's wheel. Gadi chose **the top at a third, the symbols facing
  out from the top by default**, as the Order painted them (vol. 4,
  p.295) and as the 3D view (stretch goal above) will want them, **with
  a toggle to turn them upright**. [Corrected 26 November 2026: p.295
  gives the colours, not the facing; Regardie's drawings (vol. 4, pp.294
  and 296) stand each symbol on its side's outer edge, head toward the
  top, which is what a face of the 3D view will want; the build below
  drew the opposite. See the correction at the end of this item.] Asked then whether the Squares
  tab's large pyramid, upright by default, should face out by default
  too, so that both drawings start alike, Gadi chose to face it out
  (24 November 2026; see below).
  **Built 24 November 2026** (`3616fd73`, released in `57b3f598`). The marks moved into magick-components as
  a new entry, `enochian/pyramidMarks`: `sideSymbol`, `asText`, the
  symbols' inks (`PYRAMID_SYMBOL_INKS`, keyed as `PYRAMID_COLOURS`;
  `pyramidColours.test.ts` moved with them), and `SideMark`, each mark
  centred on 0, 0 in a box of about 34 units, its outline widths a
  parameter: the Squares tab's (`MARK_OUTLINES`: element 6 under 3,
  figure 1.5, text 3) and the mock-up's thinner ones on the tablet
  (`TABLET_MARK_OUTLINES`: 4.5, 1 and 1.5). The Squares tab's drawing
  imports them and is unchanged byte for byte, which a digest of every
  square of the three versions, upright and facing out, pinned before
  the move, holds (`PyramidDrawing.test.tsx`). `Tablet` takes
  `pyramidSymbols` (`"outward" | "upright"`, with `pyramids` only):
  each mark in the middle of its band, its box scaled to 78% of the
  band's depth, turned −90°, 0°, 90° and 180° on sides 1 to 4 unless
  upright [which put each head on the outer edge; corrected to 90°,
  180°, −90° and 0° on 26 November 2026, below], drawn after the sides and before the tops, borders, tints
  and letters, on a top a third of the square by default
  (`PYRAMID_TOP_SYMBOLS`, exported; `pyramidTop` still overrides). The
  entry passes the marks in as it passes the rules, so the halls' art
  loads none of their data (a test reads `tabletSvg.tsx`'s imports).
  Without the prop every drawing is as before.
  The page: *Symbols on the sides* (`symbols=1`) while pyramids are
  drawn, and *Stand the symbols upright* (`upright=1`) while symbols
  are, each remembered while hidden and written to the URL only while
  it shows, kept in a name's square links; the switches' row has 44 px
  targets. The image link and the downloads follow
  (`…-pyramids-symbols`, `…-pyramids-symbols-upright`). The Squares
  tab is unchanged. The page's text says what the symbols are and how
  they face, citing vol. 4 p.295 by leaf through `<Cite>`; its
  embeddings were published with the change (9 passages, 1,981
  tokens, about $0.02). Checked in the browser at
  320, 375, 768 and 1,440 px, light and dark: no sideways scroll, the
  switches wrapping under the others on a phone.
  The image: `enochian-tablet-pyramids` takes `symbols` (`none`, the
  default, omitted | `outward` | `upright`) under the same profile,
  `magickli-tablet-pyramids-image-v1`, with the filenames above. Its
  inputs hash (`bef0cacc…`), the 15-drawing digest (`c9e913c0…`) and
  the three byte pins are unchanged and pass. New pins: a digest of
  the 30 drawings with symbols (5 tablets × 3 versions × 2 facings,
  `59057dbb…`) and the bytes of Fire facing out (1,135,168 bytes,
  `6d41a143…`) and the Union upright (159,476, `e4b58519…`), reviewed
  as rasterised. `FrankRuhlLibre-Bold-letters.ttf` joined the slug's
  fonts for the Hebrew letters, which resvg then sets in it (the
  outlines differ from Noto Sans Hebrew's); the signs and planets come
  from the base Noto Sans Symbols and Symbols 2, the Sun among them;
  U+FE0E draws nothing (ten glyphs outline identically with and
  without it). The fonts are part of every pyramids image's recorded
  identity, so that list moved for the images without symbols too,
  though not their bytes. The component explorer gains Water with its
  symbols, its image checked against the component. Released as
  magick-components 0.9.0 on magick-data 0.5.0, which already
  publishes every entry the marks read.
  **The Squares tab faces out too** (24 November 2026, Gadi's choice):
  its large pyramid starts with the symbols facing out, and its switch,
  *Stand this pyramid's symbols upright*, stands them to be read for
  the session, across squares and tabs. It is named apart from the
  whole tablet's *Stand the symbols upright*, as both show at once
  with the pyramids drawn, and stays out of the URL as before; the
  two do not move each other. `PyramidDrawing` takes `upright` for
  `outward`; its digest of every square, both ways, is unchanged. The
  page's text says both drawings face out unless stood upright.
  **Correction: the symbols stand on their bases (26 November 2026,
  Gadi approved the fix).** What was wrong: "outward" turned each
  symbol with its head on the side's outer edge (`rotate(-90)` turns an
  upright glyph's top to the left, side 1's outer edge, in SVG's y-down
  frame), the comment beside the turns described the opposite, and the
  page cited the facing to p.295, which gives the colours and no rule
  for the facing. The evidence: Regardie's drawings stand each symbol
  with its feet on the outer edge and its head toward the flat top, and
  on the page the top side's symbol is upside down (we take a face to be
  read from outside the pyramid; no source states that as a rule): p.296 (leaf n288), the two worked
  squares, Lovers and Chariot upside down on the top side, the element
  triangles read with up toward the centre giving exactly the elements
  p.295's rules assign, and a geomantic figure read from the centre
  outward giving Albus (the other way, Rubeus); p.294 (leaf n286), the
  three ORO pyramids of the Air tablet, "5/6/7 Swords" with their
  baselines on the outer (left) edge and Venus and Mercury on the right
  side lying with their crosses toward the outer edge. The Equinox
  I(7)'s Plates IV–VIII (leaves n242–n246) draw every symbol upright on
  the page, even on the side triangles, and its text (pp.236–238,
  leaves n248–n250) gives no rule. Which way the Order itself painted
  them, these two witnesses do not settle; a manuscript or a surviving
  painted pyramid would. Who read what: a research agent (Opus 5.5, a
  general-purpose subagent) read vol. 4 pp.293, 294, 295 and 296 and the
  Equinox's Plates IV, the Water plate (n243) and VIII and pp.236–238;
  it was told both hypotheses and the earlier reading note, so its
  reading was not blind. The orchestrator (Opus 5.5) looked at the
  p.296 crop (both worked squares: Lovers upside down on the top side)
  and at the fixed drawings in a browser. No owner reading yet. What changed: one table
  of turns, `PYRAMID_SYMBOL_TURNS` (90°, 180°, −90°, 0° on sides 1 to
  4), defined in its own module, `pyramidSymbolTurns.ts`, which loads no
  data so the halls' art can share it, and exported from
  `enochian/pyramidMarks`; `tabletSvg.tsx` and the Squares tab's
  `PyramidDrawing.tsx` both read it, so no second copy remains, and a
  later 3D view lifts the same turns onto its faces. The prop keeps its
  name, `pyramidSymbols="outward" | "upright"`: `outward` now means feet
  on the outer edge, as Regardie's drawings have them (read, as we take
  it, from outside the pyramid), and `upright` is how the Equinox's
  plates draw them. The page says so, citing pp.294 and
  296 for the facing, p.295 for the colours, and the Equinox's Plate IV
  (`<Cite work="equinoxI7" leaf={242}>`, an outside link); the Squares
  tab's detail gives the colours (p.295) and the facing (pp.294, 296,
  Plate IV) as two notes, in English and Hebrew. Tests: the turns'
  head direction, (0, −1) turned by each, points from every outward
  mark toward its square's centre, on the whole tablet and the large
  pyramid. The new pins, each checked to move by the turns alone (the
  outward markup with its turns mapped back gives the old digests
  exactly): `PyramidDrawing.test.tsx`'s one digest split in two, upright
  `bb3e7bd1…` (unchanged, as before the fix) and outward `8dbb30c5…`
  (was part of `82c4348b…`); the image route's profile bumped to
  `magickli-tablet-pyramids-image-v3`, its Fire outward bytes
  `cb730849…` (1,020,768 bytes, the same count as v2's, since only the
  turns' signs and digits swapped), its other four byte pins, its
  15-drawing digest (`c9e913c0…`) and a new upright-only digest
  (`c6b2cce3…`) all v2's, and the 30-drawing symbols digest
  `a22a0188…`; the Fire image was reviewed as rasterised. Built in
  `01844766`, released as magick-components 0.9.1, a fix (`cfe3d726`).
  Its embeddings were republished with it (8 records, 1,813 tokens,
  estimated $0.0238), and again after a review's rewording, which says
  whose drawings these are and labels the outside reading as ours (6
  records, 1,273 tokens, estimated $0.0227). The README's Provenance row
  for the symbols keeps its sign-off date, 2026-11-24, since the column
  takes only a date and an empty one would hold the release; its Source
  cell says the correction awaits the owner's sign-off. Checked in the
  browser on 26 November by the orchestrator, on the branch's dev
  server at 375 px light, 768 px dark and 1,440 px dark: Fire and Earth
  with pyramids and symbols; the Squares tab's row 1, square 1 (the
  top Fire triangle with its apex toward the centre, the bottom Air
  triangle upright, the left Air triangle's apex toward the centre);
  the two notes with their citations (colours p.295; facing p.294,
  p.296, Plate IV); no sideways scroll (scrollWidth within the
  viewport). The tablets page has no Hebrew edition
  (`/he/enochian/tablets` is 404), so there was no Hebrew page to
  check.
- **The top's size as a choice.** Gadi asked whether readers should
  pick it, perhaps among advanced options. Recommended on 23 November
  2026, and held there: no picker yet. The page has seven controls with
  the switches, and every free choice multiplies the URL's states, the
  downloads' names and the image route's profiles; `pyramidTop` keeps
  the door open. Revisit if a reader or the image route wants another
  size.
- **The tablets in image search (Gadi, 23 November 2026).** Publish the
  images worth finding as files on stable paths, as the kameas, the
  angels' and planetary sigils and the halls are (plans 062, 088, 093),
  listed under their page in the image sitemap (`src/app/sitemap.ts`)
  with alt text, a caption and a descriptive name: each Watchtower and
  the Union in each version, and the Golden Dawn's versions as pyramids
  once decision 5's slug exists; not every combination of the page's
  choices, which would be thin near-duplicates. Per-tablet pages
  (`/enochian/tablets/fire`), carrying plan 090's notes and names, would
  rank better than the one hub whose variants are query parameters. A
  plan of its own after stage 5. Done in
  [plan 100](100-tablet-pages-and-images.md), 26 November 2026: five
  pages, each tablet flat and as pyramids in the Golden Dawn's version
  only, since the other versions differ in at most 12 squares.
- The angels' telesmatic images (the name's letters as head, body and
  limbs, with AL added, p.311), from the Order's telesmatic attributions.
- The Golden Dawn's pronunciation of the names (vol. 4 pp.297–298).
- The Keys that call each part (vol. 4 pp.330–331), linked both ways
  with `/enochian/keys`.
- Enochian chess (vol. 4 pp.346–368), whose boards are the tablets and
  whose pieces are the gods above.
