# Kameas and their sigils — 19 November 2026

Status: accepted 20 November 2026; the twelve decisions stand as
recommended. K1, K6, K2, K5 and K3's package half built on
`gate/kameas` (see Stages); K3's contracts, generator route and release
next. The draft was
reviewed adversarially (Fable 5.2, high, 19 November); its three
blockers and eight majors are answered below
([Review](#review-19-november-2026)).
Follows [plan 088](088-rose-sigil-oracle.md), whose S5 ("Kamea profile
and layout on `Kamea`") said "its own plan". Read 088's
[Design](088-rose-sigil-oracle.md#design) and
`packages/magick-components/src/sigil/types.ts` first.

## Why

The seven planetary squares are among the most searched-for pieces of
Western magic, and the site has nearly everything but the pages:

- **Data.** magick-data computes Agrippa's seven squares and tests that
  they are magic and his (`astrology/kameas`, with two 1533 misprints
  recorded). The planets carry an `intelligenceId` and a `spiritId`, and
  the tetragrams' `rulerIds` name the same spirits, but none of these
  points at a table (`graph.ts`'s `pending`). Only the Moon's
  intelligence of intelligences has its Hebrew and witnesses
  (`planets.json5`).
- **Drawing.** `Kamea` and `KameaFigure` draw the squares; the halls draw
  the Moon's and Venus' seals after Agrippa, the other five are
  placeholders.
- **Sigils.** Plan 088 made the sigil engine layout-agnostic and ran a
  test-only kamea stub (`sigil/oracle/kameaLayout.ts`) with vol. 4's two
  worked examples.
- **Pages.** None. The planet pages name the intelligence and draw the
  spirit's geomantic sigil (after Heydon), not the square.

A reader who searches "kamea of Saturn", "magic square of Jupiter" or
"sigil of Agiel" should land on a page that shows the square, its
numbers, the names that carry them in each witness, the sigil traced on
the square, and Agrippa's own character beside it, every reading linked
to its page.

## Sources

"n" is the archive.org BookReader leaf, `archive.org/details/<id>/page/n<N>`.
Read by eye on the scans by Claude, 19 November 2026 (a research agent,
then the reviewer); sums computed. These are one pass's readings, made
knowing what to expect; K6 redoes the figures blind. The names by
witness are in [the appendix](#appendix-the-names-by-witness); K1 moves
them into data.

| Witness | Item | Leaves | Status |
| --- | --- | --- | --- |
| Agrippa, *De occulta philosophia*, Cologne 1533, II.22 | `DeOccultaPhilosophiaLoc1533` | names n163 (Saturn–Mercury), n164 (Moon); squares, Hebrew tables and "Signacula sive characteres": n164 Saturn, Jupiter; n165 Mars, Sun; n166 Venus; n167 Mercury; n168 Moon | Public domain everywhere; n164 already mirrored (`agrippa149`) |
| *Three Books of Occult Philosophy*, London 1651 | `b30335231`; the EEBO copy `bim_early-english-books-1641-1700_three-books-of-occult-ph_agrippa-henricus-cornel_1651` at n+15 | names p. 243 (n256; complete at n271); plates pp. 244–252 (n257–n265) | Public domain |
| Barrett, *The Magus*, London 1801, I.ii.28 | `b22006795` (Wellcome) | names pp. 146–147 (n181–n182); plates n171, n174, n176, n178 | Public domain |
| Crowley, *777 Revised* (1955), Celephaïs e-text | `aleister-crowley-liber-777` | Table III, p. 20 (n27) | In copyright; spellings and numbers taken as facts, as `planets.json5` already does. No scan of 1909 found |
| Regardie, *The Golden Dawn* vol. 4, Chicago 1940 | `IsraelRegardie-TheGoldenDawn-Vol4-1940` | method pp. 78–80 (n72–n74), the Aiq Bekar table p. 79 (n73); squares, seals and characters pp. 81–86 (n75–n80); names in roman capitals only, no Hebrew | Facts only, nothing quoted ([plan 091](091-regardie-golden-dawn-copyright.md)) |

### The Golden Dawn's method (vol. 4, n72–n74; facts, our words)

- Letters are reduced by the Aiq Bekar table to tens or units, as the
  text says in general (n73), and only when the square lacks the number:
  Zazel on Saturn's square keeps 7, 1, 7 and takes Lamed's 30 as 3;
  Taphthartharath on Mercury's (64 cells) takes 400 as 40, 80 as 8, 200
  as 20.
- The table puts the final forms in the 500–900 chambers; neither
  example has a final letter.
- The line follows the numbers in order; a repeated letter returns to
  its cell; a small circle marks the start. The text names no end mark.
- A planet's seal is a figure whose lines pass through every number of
  its square.

### What the characters show (one pass, to be redone in K6)

K6 redid this blind; its findings, in Stages, replace the list below
where they differ (Tiriel and Graphiel are traces with departures;
Iophiel's geometry is its trace with י and א as one turn).

- **The two printings differ.** Agrippa 1533 (n164) draws a circle at
  both ends of Agiel, Zazel, Iophiel and Hismael, and 1651 (n257) and
  Barrett (n171) follow him. Vol. 4 (n75) redraws them: a circle at the
  start, and at the end a circle (Zazel), a short bar (Yophiel) or
  nothing (Hismael, Agiel), with the angles turned towards the square's.
  Vol. 4's plates follow Agrippa's paths, not his marks.
- **Returns** are drawn as a narrow U in Zazel and Taphthartharath and
  as a pointed wedge in vol. 4's Agiel and Yophiel.
- **Agiel**'s double cusp sits where the trace lands on 1 twice (Yod
  reduced, then Aleph): the rose's crook (R3).
- **Matches.** Hismael follows 5, 6, 4, 1, 3 stroke by stroke; Zazel,
  Nachiel, Sorath and Taphthartharath fit their traces.
- **Mismatches.** Iophiel has five vertices to the trace's six (in 1533
  and vol. 4 alike); its geometry fits 10, 5, 8, 10, 3, which is neither
  יהפיאל nor 777's יופיל. Tiriel has five vertices with a notch, where
  the trace has six. Graphiel is a closed figure of five strokes, the
  trace six.

So Agrippa's characters are at least largely traces of the names on the
squares, drawn freely, but not all of them are the traces this plan's
reduction gives. That is a finding for the pages, not something to
paper over.

### Discrepancies, and whose (checked by sum)

1. **Barzabel**: 1533's ברצאבאל sums to 326 against the 325 printed
   beside it (n163); 1651 and Barrett copy it; 777's ברצבאל gives 325.
2. **Kedemel**: 1533 prints 157 for 175 (n163), kept by 1651, corrected
   by Barrett (n182) and 777.
3. **Bne Seraphim**: 1533 prints 1225, Venus' total; the Hebrew gives
   692, or 1252 with final Mem as 600, which is what 1651 prints.
4. **1651's compositor**, copied by Barrett: Sorath סורה (271), Hasmodai
   השמודאי (366), the Moon's two long names; Eloh 56 for 36 (1651 only).
   Not settled: 1651's Taphthartharath, whose sixth letter is a dalet in
   the EEBO copy (n271, תפתרתדת, 1884) and unclear in b30335231 (n256);
   Barrett has the resh. Reading that letter in another copy settles
   whether the edition or one copy has it (found in K1's review).
5. **The Moon's long names** reach 3321 in 1533 only with final Mem as
   600 and final Nun as 700.
6. **777's e-text** reads Tiriel with Tav (651 against its printed 260)
   and spells the Moon's intelligence of intelligences so that no count
   gives 3321; whether the e-text's or Crowley's needs the printed book.
7. **Jupiter's intelligence**: Agrippa's יהפיאל and 777's יופיל both sum
   to 136; the GD's Yophiel follows 777.
8. **Vol. 4's squares**: Venus prints 43 for 48 (row 2, column 3, so 43
   twice); Mercury swaps three pairs of cells (45 and 48 in row 3; 35
   and 38, 25 and 28 in row 4: rows still 260, columns not); the Moon
   prints 54, correcting 1533's 45.
9. **1533's squares beyond `kameas.ts`'s two**: Mars row 1, column 2 is
   a damaged 24 (the Hebrew table confirms); the Hebrew Mercury table
   leaves 10's cell blank.

### Not settled

- The GD's own Hebrew spellings (vol. 4 prints none): the other volumes
  and the manuscripts. Until then the GD's names are 777's.
- 777's printed readings (Tiriel, the Moon): a scan of 1909 or 1955.
- Barrett's and 1651's squares, located but not read cell by cell;
  vol. 4's Venus and Moon squares and 1533's n166 and n168 were read
  once.
- Every character beyond the nine read (K6).

## Design

### Data: the names, in magick-data

A new table, `astrology/planetaryNames` (name open), one row per name:

| Field | What |
| --- | --- |
| `id` | The ids in use (`agiel`, `zazel`, `bartzabel`, …), and new ones for the Moon's intelligence of intelligences and spirit of spirits, the Bne Seraphim and the squares' divine names |
| `planetId` | A `KameaPlanetId` (the graph's naming: "naming carries arity") |
| `role` | `intelligence`, `intelligences` (the Bne Seraphim, plural in 1533's caption), `spirit`, `intelligenceOfIntelligences`, `spiritOfSpirits`, `divineName` |
| `witnesses` | Per witness, every field optional: Hebrew as printed, romanisation as printed, the number printed beside it, leaf |
| `godNameId` | For a divine name that is already a `godName` row (`yah`, `el`, …) |

Shelachel, the Moon's present-day intelligence, is a row with no
witness and nothing to trace, as `planets.json5` explains it.

**Exceptions are rows**, not comments: `{ nameId, witness, printed,
expected, whose, leaf, note }`. The test holds every printed number to
its spelling's sum (with or without final values, as the row says) or to
an exception row; the page renders the same rows, so the page and the
test cannot drift (AGENTS.md, "show the evidence", 2 and 3).

**Graph.** The planets' `intelligenceId` and `spiritId` and the
tetragrams' `rulerIds` become edges into the table (`graph.ts`'s three
pending entries resolved), with an integrity test that an
`intelligenceId` reaches a row whose role is an intelligence and so on.
`planets.json5`'s `intelligenceOfIntelligences` stays, deprecated, held
equal to its row, until a major.

**Display names.** Today the planet page, the page descriptions
(`src/seo/entities.ts`), `Intelligence.tsx`, the geomancy pages and the
package's `PlanetarySpiritId` print `capitalize(id)`. They read the
table instead, so every page names a spirit one way: the GD's form
(Bartzabel, Chasmodai), which the ids already are, with Agrippa's
(Barzabel, Hasmodai) beside it where they differ.

`astrology/aiqBekar`: the nine chambers as data and `aiqBekar(value,
cells)`: a value kept if the square has it, otherwise divided by 10
until it fits. Final forms count at their ordinary values unless asked
for the table's (decision 3).

magick-data 0.3.0 → 0.4.0 (additive). Main released 0.3.0 on 20
November (`9ae9b486`) from other work while this plan was being built,
so its release is the next minor, with magick-components 0.6.0.

### Engine: a kamea layout under the rose's rules

As built (K2, in Stages), the scale is 28 units a cell, not 10, and some
names do make an exact straight pass (item 4).

The kamea uses the rose's marks: a start circle (R1), straight strokes
(R2), a crook for a repeat in one cell (R3, which Agrippa's Agiel shows),
a noose for a straight pass (R4), the end bar (R5), and returns as the
rose's wedge (F1). No new marks and no new profile options: the U
returns and both-ends circles are features of Agrippa's printing, shown
by his characters on the pages, not reproduced by the engine (decision
4). This keeps the planner, placement, renderer and oracle as they are;
a U would need a vertex that is not a point and a stroke that is not
straight, which the plan types, the ink grammar and read-back all rule
out (`types.ts`, `oracle/figure.ts`, `oracle/readBack.ts`).

What the engine does need:

1. **A layout over letters.** `kameaLayout(planet, { finals })` takes
   Hebrew letters and reduces inside `place` (magick-data's `aiqBekar`),
   so the tokens are strings and `sigilFigure`, `SigilImage` and the
   contracts keep their signatures. Places are cells, so two letters that
   reduce to one cell repeat. It moves out of `sigil/oracle/` into
   `sigil/kameaLayout.ts`, exported, with `kameaGeometry` moved into a
   plain module so the layout no longer imports a React file.
2. **A layout's own frame.** `sigilFrame` is a disc round the anchors:
   on a square, a circumscribed circle of a different radius per planet,
   letting ink out past the square's edge where `Kamea` clips it. A
   layout may give a frame (a square bound and a word pitch); the rose's
   is unchanged.
3. **A stroke weight that does not scale with the cell.** The stroke is
   `layout.unit` wide: 3.2 on Saturn's square, 1.07 on the Moon's.
   `SigilImage` takes a stroke width; the kamea's is fixed against the
   square, chosen from a mock-up at real size.
4. **The R4 tolerance** is ours: no name in the table makes a straight
   pass at any tolerance, so no witness can settle it. A pass is exact
   collinearity on a grid, so the kamea profile takes 0.05 cell; the
   stub's 1 unit catches near-diagonals on the Moon's square (offsets
   from 0.094 cell). An explicit flag, not a negative tolerance, if R4 is
   ever to be off.
5. **The Moon's column.** On the Moon's square 10 to 80 lie in one
   column, so every letter from Yod to Tav traces there. בתרשיתים clears
   only at about 3.6 times the placement budget, 777's בתרשישים not at
   all, and the 14-letter spirit of spirits not at all; random words of
   4–8 letters fail 7% of the time on the Moon's square, 4% on Mercury's.
   K2 makes every name the pages trace place without failure (a kamea
   placement setting, a larger budget for the kamea profile, or a
   drawing rule for a run along one line), and the Moon's page says that
   the method folds most letters onto one column, which is a fact about
   the method worth showing.

`KameaSigil` (new): the square under `SigilImage`'s `backdrop`, once per
word, the words as separate figures that wrap on a narrow screen, with
the one-row SVG as the download.

Invariant: **the rose's figures do not change.** Gate: a path digest
over the whole report corpus on both roses, before and after, not only
the 87 texts the registry pins (best-effort figures depend on the work
count, which a changed element list would move).

### Oracle

O1–O3 run on the kamea profile unchanged (no new marks), plus:

- **Corpus from letters.** A letter reaches 9 cells on Saturn's square
  up to 17 on the Moon's; every letter-reachable triple on all seven
  squares is 15,273 figures, about 4 s of placement (the reviewer's run:
  46 failures, 20 on Mercury's, 26 on the Moon's). All of them in CI;
  every name in the table; seeded random words of 4–12 letters per square.
- **Templates for the grid**: A‑B‑A‑B(‑A), a row walked back and forth,
  runs along the Moon's column, a closed path (Graphiel ends at its
  start), a doubled first cell (Sorath), a repeat at the end.
- **Fixtures** from vol. 4's two worked examples, as plans: Zazel 7, 1,
  7, 3 and Taphthartharath 40, 8, 40, 20, 40, 20, 40, with their returns.
  Agrippa's characters are not fixtures: they are drawn freely and some
  are not this method's traces. K6 compares them, and its verdicts live
  in data, not in the oracle.

### Pages

| URL | What |
| --- | --- |
| `/astrology/kamea` | The hub: the seven squares, what a kamea is, Agrippa and the GD in a paragraph each, the method in brief, the generator |
| `/astrology/kamea/<planet>` | One per planet, by the planet table's id (`saturn` … `sol`, `luna`), titled with the common name and "magic square" ("Kamea of the Sun: the magic square of Sol") |
| `/astrology/intelligence/<id>`, `/astrology/spirit/<id>` | One per name that has a sigil (about 17), the graph's own namespaces (decision 8) |
| `/astrology/kamea/sigils` | The kamea sigil generator (decision 9) |

A planet's page: the square, large, with its order, line sum and total
and how Agrippa built it; its names (divine names, intelligences,
spirits) with Hebrew in Frank Ruhl Libre, the number each carries and
which constant it is, linking each name's page; the seal (decision 11);
the Moon's note on the column; links to the planet page and to the
halls that draw this square (Theoricus' Moon, Philosophus' Venus).

A name's page: its Hebrew and romanisations by witness, with leaf links;
its number and the square's constant; the exceptions as rows say them;
the sigil traced on the square, with the reduction (letter, value,
cell), linked to the generator; Agrippa's character, linked to its leaf
(n164 is mirrored already; decision 7), and K6's verdict on it, labelled
as our reading.

SEO as for the angels and halls (plans 062, 088 S4): static PNG and SVG
beside each page, built at deploy (the square alone, which needs its own
`kamea` image contract with its profile, digest pins and inputs, and each
name's sigil); `ImageObject`s in the JSON-LD; sitemap entries;
`isBasedOn` Agrippa 1533 for the squares, seals and names and vol. 4 for
the method. A new public route enters `src/seo/pages.ts`,
`routeClasses.ts`, `src/i18n/routePlacement.ts`, the social cards, the
breadcrumbs, the astrology hub's links and the English search
extraction adapter. The planet pages gain a "Kamea" row.

Translation: copy marked for Lingui with Hebrew in
`src/locales/he/messages.po`; English-only routes until a Hebrew edition
is registered; `LOCALIZED_SEO_ENABLED` stays false.

Search: new indexed pages and changed copy on indexed ones (the planet
pages' row, the generator's text) move the catalogue's digest, so each
such commit waits for Gadi's `pnpm search:publish`, as 088 S4's link did.

Docs screenshots: none of these screens is captured today.

### The generator

Its own route, `/astrology/kamea/sigils`, sharing the sigil components
with `/gd/sigils` (whose metadata and state belong to the rose): a
planet, a Hebrew name, the sigil over the square and a table of the
reduction. A `kamea-sigil` contract (personal, `indexed: false`, as
`rose-sigil` is) with its own `finals` parameter, since the rose
contract's respelling of final forms cannot carry it. `/gd/sigils` links
it.

### Seals

The five seals still placeholders (Saturn, Jupiter, Mars, the Sun,
Mercury) are drawn after Agrippa's woodcuts as the Moon's and Venus' were
(geometry read from the leaf, made clean, no image copied), reviewed by
Gadi from side-by-side renders. They move out of hall art into a public
component keyed by magick-data's planet ids, drawn on the bare page for
the reference pages and on the silver plate in the halls. Only two
presets draw a seal, so no hall pin moves.

### Agrippa's characters (K6)

Each of Agrippa's characters (1533, and vol. 4's redrawings as a second
witness) is read blind by two readers, as S0 read Vaughan's figures:
vertices in order, marks at each, closed or open. The readings are
reconciled and compared with the trace of every spelling the witnesses
give under the reduction, with and without final values. The verdict per
figure (matches which trace; or the nearest, and where it departs), with
who read it and how, goes into a committed data file beside
`planetaryNames`, and the name pages show it.

## Decisions

Accepted by Gadi on 20 November 2026 as recommended (the first option
in each). Alternatives are kept for the record.

1. **Which names get sigils**: intelligences, spirits, the Bne Seraphim
   and the Moon's two long names; divine names listed with their numbers
   and traceable in the generator only.
2. **One table** for every name, the three pending fields resolved into
   it, exceptions as rows; display names read from it everywhere.
3. **Reduction**: kept if the square has it, otherwise divided by 10
   until it fits (vol. 4, n73). Finals trace at ordinary values; the
   generator offers the table's finals as an option.
4. **The rose's marks on the kamea** (start circle, crook, noose, wedge
   return, end bar), no new profile options. *Alternatives*: an engine
   extension for U returns and an end circle (a new vertex kind, ink
   grammar and read-back; an end circle also makes a figure read both
   ways, which O3 rejects), or an "Agrippa style" renderer later, in its
   own plan.
5. **Agrippa's square** for every planet; vol. 4's variants noted on the
   pages (Mercury's swaps touch no cell Taphthartharath uses).
6. **Which spelling is traced**: Agrippa 1533's Hebrew, and where
   another witness spells a name with a different trace (Jupiter's
   יופיל, Mars' ברצבאל, 777's Moon), that trace too, labelled.
7. **Agrippa's characters on the pages**: n164 is mirrored already
   (regions per citation added); mirror n163 too, the leaf six planets'
   names rest on (headroom about 719 KB under the 4.5 MB cap); link the
   rest. *Alternative*: raise the cap, or plan 080's storage.
8. **Pages**: a hub, seven kamea pages, and one page per name at
   `/astrology/intelligence/<id>` and `/astrology/spirit/<id>` (about
   17), since "sigil of Agiel" is the search and the angels' one entity a
   page is the site's best performer. *Alternative*: anchored sections on
   the kamea pages only, which cannot carry a title per name.
9. **The generator** at `/astrology/kamea/sigils`, its own page and
   contract, sharing components with `/gd/sigils`.
10. **Multi-word names**: each word its own figure, wrapping, the
    one-row SVG for download. The spirit of spirits, one word of 14
    letters in 1533, is divided as its romanisation divides it
    (Schedbarschemoth | Schartathan), and the page says the division is
    ours; undivided it is beyond the tested domain and fails placement.
11. **Seals on the reference pages** only once drawn (K5); no
    placeholder on a reference page.
12. **Search**: the commits that change indexed text wait for Gadi's
    `search:publish`.

## Stages

| Stage | What | Gate |
| --- | --- | --- |
| K0 | Sources (this plan's Sources and appendix) | Gadi; the figure readings are K6's |
| K1 | magick-data: `planetaryNames` with exceptions as rows, `aiqBekar`, graph edges (planets and tetragrams), display names; released with K3 | Every printed number explained by a sum or a row; integrity tests |
| K6 | Agrippa's characters read blind by two readers, reconciled, compared with every spelling's trace; verdicts in data | Gadi reviews a side-by-side sheet; decision 4 confirmed or revisited |
| K2 | Engine: the letter layout, layout frames, stroke width, R4's tolerance, the Moon's column; corpus from letters, grid templates, vol. 4's fixtures | O1–O3 green on the kamea corpus; every traced name places without failure; the rose's path digest over the whole report corpus unchanged |
| K5 | The five seals, as a public component | Gadi reviews side-by-side renders |
| K3 | `KameaSigil` (mock-up of stroke weights first), the `kamea` and `kamea-sigil` contracts, the generator route, README and explorer entries; magick-components 0.6.0 with magick-data 0.4.0 | Contract tests; browser check |
| K4 | Hub, seven kamea pages, name pages; images, JSON-LD, sitemap, route registries; planet-page row, hall links; Lingui and Hebrew | Gate; Gadi's `search:publish` |

**K1 built 20 November 2026** (`794e407b`). magick-data's next release adds
`planetaryName` (38 rows), `planetaryNameException` (19 rows) and
`astrology/aiqBekar` (`AIQ_BEKAR`, `hebrewValue`, `aiqBekar`,
`traceHebrew`); the planets' `intelligenceId` and `spiritId` and the
tetragrams' `rulerIds` are links, checked by a new `role` integrity
check; `intelligenceOfIntelligences` is deprecated and held equal to its
row. Where it departs from or adds to the design above:

- Ids: the fourteen in use; divine names `<planet>-<slug>`
  (`saturn-hod-9`, `mercury-asboga`); `bne-seraphim`,
  `malcha-betharsisim`, `schedbarschemoth-schartathan`. Exception rows
  are keyed `<name>-<witness>`, and link by `planetaryNameId`.
- A reading has `he`, `roman`, `caption` (public-domain witnesses only),
  `number`, `count`, `item`, `leaf` and `note`. `count` is `finals` only
  where final values make the printed number (1533's two Moon names,
  1651's Bne Seraphim), and `pairs` for Asboga, the eight extended,
  tested pair by pair. `item` names another copy where a reading was
  made in it (1651's EEBO copy for Taphthartharath and the Moon's
  intelligence of intelligences), so a leaf links the page that shows
  the reading.
- Decision 10's division of the spirit of spirits is a row field,
  `division`, held equal to 1533's word; `tracedSpelling` returns it.
- Display names: `name.roman`, today's text for the fourteen
  (Iophiel, Bartzabel), so no visible text changed and search needs no
  republish; Agrippa's forms beside them wait for K4. Three divine names
  no witness romanises are our consonant transcriptions (HVH, AHY, YHY),
  said so in their notes.
- `graph.planet.pending` and `graph.tetragram.pending` are gone, a
  type-level change a 0.x minor allows.
- `/open-source/data` now counts 31 tables and lists the two new ones
  (noindex, not in search).

Verification: every printed number is its sum or an exception row, and
a stale row fails; every hand trace in the appendix matches in both
finals modes. A fresh Opus review (high) found no critical or high
issue; fixed before the gate: two 1651 readings that linked a leaf
where the reading cannot be seen (now `item`), 1651's Taphthartharath
recorded in 1533's spelling (now as read, with an `unsettled` row),
Barrett's Malcha note, and the README's Regardie wording. The gate
(check, typecheck, i18n:check, test:coverage, build with ci.yml's
placeholder env) passed on the committed tree. Left for Gadi: the
README's sign-off date 2026-11-20 on the two new Sources rows.

**K6 built 20 November 2026** (`0f008ef2`). `planetaryNameCharacter`
(32 rows) holds a verdict on each of the sixteen characters in Agrippa
1533 (n164–n168) and Regardie 1940 (n75–n80): 11 match, 19 partial, 2
no. How it was made:

- Each figure was cropped from archive.org's full-size page image and
  given an opaque id. Four 1940 crops cut a vertex off; they were
  widened and both readers re-read those four.
- Two readers, Opus 5.5 (high) and Fable 5.2 (high), apart and blind to
  the names, recorded strokes, vertices and end marks. They agree on
  the vertex count of 25 of 32 figures; the rest differ in small
  details (a cap read as one vertex or several, a tail, an end mark).
- A comparison script fitted each reading to every spelling's trace by
  similarity. Its thresholds were fixed before it ran, it matched every
  synthetic figure made from the traces, and no wrong name ever
  matched (4 or 5 of 32 came out close). It could not judge figures
  that draw returns as parallel lines or lift the pen, so it is
  support, not the verdict.
- Two judges, the same two models apart, compared each figure and both
  readings with every spelling's trace, with and without finals. They
  agree on 25 verdicts; the orchestrator settled the 7 others (both
  Bartzabels, both Tiriels, Regardie's Kedemel, both spirits of
  spirits), each with a `note`.

Findings:

- **Matches**: Agiel, Zazel, Hismael, Taphthartharath and the Bne
  Seraphim in both printings (the Bne Seraphim with final ם as 600, on
  cell 6), and Agrippa's Kedemel.
- **Departures recur, in both printings**: ר on cell 2, not 20
  (Graphiel, Bartzabel, Sorath); ל on 3, not 30 (Nakhiel, Hagiel);
  י and א as one capped turn, nearer cell 11 (Iophiel, Hagiel,
  Tiriel); a letter with no vertex (Chasmodai's מ, Graphiel's second
  א). They are not uniform: ל stays on 30 in Kedemel and Tiriel, ר on
  20 in Taphthartharath. So Agrippa's characters are traces on his
  squares, but not under one reduction rule.
- **Bartzabel** follows the six-letter ברצבאל, whose sum is the 325
  Agrippa prints beside his seven-letter Hebrew (discrepancy 1).
- **Malcha** follows four of its five words, and counts ם as 40 in one
  word and 600 in another. **Schedbarschemoth Schartathan** is not
  recognisably any trace.
- **1940 keeps 1533's paths and departures.** It lays the small squares'
  figures on the cells more exactly, moves Kedemel's start and the
  joined turn of Iophiel and Hagiel to cell 10, and copies Mercury's
  and the Moon's as shapes, turned.
- **Marks**: 1533 puts a circle at both ends of most figures, a hook
  or curl where the first cell is doubled, and no mark on a closed
  outline. 1940 mostly has a circle at the start and a bar or nothing
  at the end, which is the rose's marks.

Decision 4 stands: the departures are in the reduction, not the marks,
and 1940's habit is the rose's start circle and end bar. Decision 3
stands for the generator (vol. 4's rule), and the name pages show where
each character departs from it. The table carries Agrippa's two readings
so that K4 can draw his characters; the crops, sheets, 1940 readings and
judges' notes are in `~/Documents/Magick/Kameas/k6-2026-11-20/`, with
the side-by-side sheet for Gadi (`side-by-side.html`). The gate
(check, typecheck, i18n:check, test:coverage, build) passed on the
committed tree.

**K2 built 20 November 2026** (`f75b0d23`). magick-components gains
`kameaLayout(planet, { finals })` (exported, React-free, reducing in
`place` with `aiqBekar`), a layout's own frame (a square bound, radius
48, pitch 100, `Kamea`'s viewBox; the rose's disc unchanged), a
`strokeWidth` on `SigilImage` and the profile, and `laneStarts`, an
opt-in placement setting the rose never sets. Where it departs from the
design above:

- **Scale and slack.** 28 units a cell and slack 0.46, not the stub's
  10 and 0.46: at 10 units 3,000 random starts found no figure for some
  Moon names, so a larger budget alone could not clear them. A sweep of
  20, 22, 24 and 28 units by slack 0.44, 0.46 and 0.48 (with lane
  starts and 8 budgets) found 28/0.46 the only setting with no name
  failing at the rose's slack; the 0.48 settings place every name too
  but halve the clearance from the grid lines. The cost: the Moon's unit
  is 0.381 of the square's 96, so a Moon sigil meets the grammar's
  1.25 px a unit only from about 328 px across (22/0.48: 258 px).
- **Grid lines.** A vertex may sit 0.042 cell from a cell line, 0.445
  units on the Moon's square, where half the stroke and half a 0.6 rule
  make 0.49: the inks can just touch, though read-back is exact. Only
  slack 0.44 clears it, and no 0.44 setting places every name. K3's
  mock-up judges it at real size.
- **Straight passes** do occur: through the Moon's 10 in 1651's and
  Barrett's Malcha, and in 1533's Malcha and Elim with finals. R4's
  0.05 cell holds (a near miss is at least 0.094 cell off).
- **Stroke width** is one unit of the Moon's square, 0.381, provisional
  for K3.

Oracle: O1–O3 over every letter-reachable triple (15,273), the 60 name
cases (every witness's spelling, the divided and undivided spirit of
spirits, the divine names, both finals modes; pinned), 1,260 seeded
random words, 10 grid templates and vol. 4's Zazel and Taphthartharath
traced from letters; 26 s in CI. No name fails. 70 known failures (46
triples, 24 random words; 35 on Mercury's square, 35 on the Moon's): 69
are returns of 7.6 to 9.9 cells or turns between neighbouring cells,
where F1's wedge opens at most 0.92 cell, and one is a clearance
failure. The rose: `scripts/sigil-oracle/roseDigest.mts` hashes the SVG
of 31,074 rose figures (the report corpus and collinear runs on both
roses) and gives `d122e18e…c256` before and after; the registry digest
is unchanged. A fresh Opus review (high) checked the digest on a clean
worktree of the base and found the one exception the first build listed
(777's Malcha with finals) to be a setting, not a limit, which the sweep
then removed. The gate passed on the committed tree.

**K5 built 21 November 2026** (`cd487445`). `PlanetarySeal` draws the
seven seals after Agrippa's 1533 woodcuts (n164–n168), keyed by
magick-data's planet ids: a page look in currentColor and the halls'
silver plate. Saturn, Jupiter, Mars, the Sun and Mercury are new, read
from the leaves and regularised where the woodcut is a hand's wobble.
Two judgement calls, accepted by Gadi from the side-by-side renders:
Mercury is drawn square where the woodcut is about 6% wide, and Mars'
great arc ends in a serif where the woodcut has a wedge. The Moon's and
Venus' plates are byte-identical, so no hall pin moved. Built on its own
branch alongside K3 and brought onto `gate/kameas` in the rebase below.

**K3's package half built 21 November 2026** (`f48c8693`). A mock-up at
real size (Chromium, both themes; kept outside the repository) settled
three things with Gadi:

- **Stroke 0.6** square units, the grid rule's width, on every square:
  0.381 left the Moon's marks faint at 240 px and lost in dark theme;
  0.9 and up filled them in. No casing: a paper-coloured halo did not
  move a stroke off a rule and cut the numbers it crossed.
- **A line-run rule** (kamea only): a stroke may lie within touching
  distance of a cell rule or of the frame (half the stroke plus half the
  line) for at most one cell. Before it, 1651's בתרשיסים ran along a
  Moon column rule for 7 cells; after, no name exceeds 0.99 cell. O2
  checks it independently.
- **A minimum size per square** keeping the grammar's 1.25 px a unit:
  Saturn to the Sun 240 px, Venus 256, Mercury 292, the Moon 329.

The review then found that the grammar's distance limits assumed a
one-unit stroke, while 0.6 is 1.58 units on the Moon: separate strokes'
inks touched while the checks passed (8 names). Gadi chose to count the
kamea's limits in stroke widths. Counting only the gaps broke 14 Moon
names (their column returns' wedges no longer fit), so overlap length
counts in stroke widths too, keeping the wedge's 7°. A seeded random-start
fallback (kamea only, deterministic, one shared budget a text) places
Barrett's Malcha. Result: 59 of the 60 traced names place; 777's Malcha
with finals, a generator-only spelling, is a listed failure, drawn best
effort and flagged. Known corpus failures: 87 (69 long returns or tight
turns, one clearance, and 17 one-letter triples on the Moon, אאא and the
like, whose marks cannot stand apart at this stroke). `KameaSigil` draws
the square under the sigil, a figure per word that wraps right to left,
with `KameaSigilImage` for the one-row download and `kameaSigil()` for
pages. The rose digest is unchanged (`d122e18e…c256`). For K4: a word
that fails costs about 4 s of synchronous placement, so the pages draw
their figures on the server and the generator debounces or places off
the main thread.

**Rebased onto main 21 November 2026.** Main had released magick-data
0.3.0 and magick-components 0.5.0 (`9ae9b486`) and moved on; the branch
was replayed onto `a1d3f22b` without conflict and K5 added on top (its
README, package.json and smoke-script conflicts kept both sides). The
commit hashes above are the rebased ones. K1's version line is dropped:
these tables ship in K3's release, magick-data 0.4.0 with
magick-components 0.6.0.

K1 first; K6 needs K1; K2 needs K6 (decision 4 may move); K5 runs
alongside; K3 needs K2; K4 needs K3 and K5.

## Verification

- magick-data: every square magic and Agrippa's (existing); every
  printed number a sum or an exception row; `aiqBekar` against hand
  tables for every name; graph integrity.
- magick-components: the rose's O1–O3 and its whole-corpus path digest
  unchanged; the kamea's O1–O3 on the corpus; no failure on any name.
- App: the gate (check, typecheck, i18n:check, test:coverage, build);
  the pages in the browser, light and dark, at phone width.

## Risks

- **The method is thin.** Two worked examples; the rest is our choice,
  labelled on the generator's page as 088 does for the rose.
- **Agrippa's characters do not all fit the method.** The pages say so,
  per figure, rather than presenting the traced sigil as his.
- **Reading freely drawn figures is judgement.** Two blind readers,
  reconciled, as S0.
- **The Moon's square.** If no placement rule makes its names legible,
  its page shows the trace as best effort with the note, and the gate
  records the known failures as 088 records its own.
- **Search costs.** About 26 new indexed pages need a paid publish.

## Review (19 November 2026)

Fable 5.2 (high) reviewed the first draft against the code and the
scans. What changed:

- **B1, B2.** The draft read three characters and called Agrippa's
  figures traces with no end mark. 1533 has a circle at both ends of
  every Saturn and Jupiter character, vol. 4 changes the marks, and
  three of nine characters read do not have the trace's vertex count.
  The Sources section now says so, and K6 reads every character blind
  before anything is built on them.
- **B3, M1.** `returnShape: "loop"` and `endMark` are dropped (decision
  4): a U is not expressible in the engine's plan, ink grammar or
  read-back, the evidence for it is mixed, and an end circle reads both
  ways.
- **M2, M3.** The Moon's column and the letter-reachable corpus come
  from the reviewer's runs on the engine as it stands; K2's gate covers
  both.
- **M4.** The layout takes letters; layouts may give a frame; the stroke
  width is fixed against the square.
- **M5.** K6 before K2, the seals before the pages, a `kamea` contract
  for the bare square, one package release, a whole-corpus rose digest.
- **M6.** `planetId`, the plural role, Shelachel's empty row,
  tetragrams' `rulerIds`, `godName` links, exception rows, display names.
- **M7.** Name pages, a generator route of its own, the route
  registries, "magic square" in titles.
- **M8.** The spirit of spirits is one word in 1533; dividing it is ours
  and labelled.
- Minors taken: Mercury's three pairs; the general statement of the
  reduction on n73; R4 as our choice; n163 to mirror; no vol. 4 caption
  quoted; 777's status; the seals' component; the plain geometry module;
  the `finals` parameter; the README and explorer entries for the new
  component.

The reviewer's own figure readings were one reader's, made knowing the
expected traces; they show the draft's readings were wrong, not what the
right ones are.
## Appendix: the names by witness

From the K0 research (19 November 2026): spelling as printed / Hebrew /
printed number / leaf; "=" as 1533; gem computed with final forms at
their base values, "fin" with ך500 ם600 ן700 ף800 ץ900.

### Constants of the squares

| planet | n | n² | line n(n²+1)/2 | total n²(n²+1)/2 |
|---|---|---|---|---|
| Saturn | 3 | 9 | 15 | 45 |
| Jupiter | 4 | 16 | 34 | 136 |
| Mars | 5 | 25 | 65 | 325 |
| Sun | 6 | 36 | 111 | 666 |
| Venus | 7 | 49 | 175 | 1225 |
| Mercury | 8 | 64 | 260 | 2080 |
| Moon | 9 | 81 | 369 | 3321 |

### Per planet

Cells: spelling as printed / Hebrew / printed number / leaf. "=" means same
as agrippa1533. Gem = computed with standard values (finals as base
letters); "fin" = with ך500 ם600 ן700 ף800 ץ900. 777 and Regardie give no
divine names; Regardie prints names only in roman capitals as captions
(no Hebrew on n72–n80).

#### Saturn (agrippa1533 n163; 1651 n256/n271; Barrett n181; 777 n27; Regardie n75)

| name | agrippa1533 | 1651 (a, b) | barrett1801 | crowley777 | regardie1940 | gem | constant |
|---|---|---|---|---|---|---|---|
| divine | Ab / אב / 3 | = | = | — | — | 3 | n |
| divine | Hod / הד (looks הר) / 9 | = | = | — | — | 9 | n² |
| divine | Iah / יה / 15 | = | Jah / = | — | — | 15 | line |
| divine | Hod / הוד / 15 | = | = | — | — | 15 | line |
| divine | Tetragrammaton extensum / יוד הא ואו הא / 45 | "Jehovah extended" / = | "Jehovah extended" / run together / 45 | — | — | 45 | total |
| intelligence | Agiel / אגיאל / 45 | Agiel / אגיאל (gimel faint, reads אניאל) / 45 | Agiel / אגיאל / 45 | Agiel / אגיאל (45) | AGIEL | 45 | total |
| spirit | Zazel / זאזל / 45 ("Daemonium") | Zazel / = / 45 ("spirit") | = | Zazel / זאזל (45) | ZAZEL | 45 | total |

#### Jupiter (n163 / n256, n271 / n181 / n27 / n75)

| name | agrippa1533 | 1651 | barrett1801 | crowley777 | regardie1940 | gem | constant |
|---|---|---|---|---|---|---|---|
| divine | Abba / אבא / 4 | **Abab** / אבא / 4 | Aba / אבא / 4 | — | — | 4 | n |
| divine | (no roman) / הוה / 16 | = | = | — | — | 16 | n² |
| divine | (no roman) / אהי / 16 | = | = (heth/he unclear) | — | — | 16 | n² |
| divine | El Ab / אל אב / 34 | / אלאב / 34 | / אלאב / 34 | — | — | 34 | line |
| intelligence | Iohphiel / יהפיאל / 136 | Johphiel / = / 136 | Johphiel / = / 136 | Yophiel / **יופיל** (136) | YOPHIEL | 136 (both spellings) | total |
| spirit | Hismaël / הסמאל / 136 | Hismael / = | Hismæl / = | Hismael / הסמאל (136) | HISMAEL | 136 | total |

#### Mars (n163 / n256, n271 / n181–n182 / n27 / n76)

| name | agrippa1533 | 1651 | barrett1801 | crowley777 | regardie1940 | gem | constant |
|---|---|---|---|---|---|---|---|
| divine | He, litera nominis sancti / ה / 5 | = | = | — | — | 5 | n |
| divine | — / יהי / 25 | = | = | — | — | 25 | n² |
| divine | Adonai / אדני (d/r unclear) / 65 | = | אדני / 65 | — | — | 65 | line |
| intelligence | Graphiel / גראפיאל / 325 | = | = | Graphiel / גראפיאל (325) | GRAPHIEL | 325 | total |
| spirit | Barzabel / ברצאבאל / 325 | Barzabel / ברצאבאל / 325 | Barzabel / ברצאבאל / 325 | Bartzabel / **ברצבאל** (325) | BARTZABEL | 1533 spelling **326**; 777 spelling 325 | 777's = total |

#### Sun (n163 / n256, n271 / n182 / n27 / n77)

| name | agrippa1533 | 1651 | barrett1801 | crowley777 | regardie1940 | gem | constant |
|---|---|---|---|---|---|---|---|
| divine | Vau, litera nominis sancti / ו / 6 | = | = | — | — | 6 | n |
| divine | He extensum / הא / 6 | = | = | — | — | 6 | n |
| divine | Eloh / אלה / 36 | Eloh / = / **56** (a; b's number cropped at margin) | 36 | — | — | 36 | n² |
| intelligence | Nachiel / נכיאל / 111 | = | = | Nakhiel / נכיאל (111) | NAKHIEL | 111 | line |
| spirit | Sorath / סורת / 666 | Sorath / **סורה** / 666 (both copies) | Sorath / **סורה** / 666 | Sorath / סורת (666) | SORATH | סורת 666; סורה 271 | total |

#### Venus (n163; square n166 / n256, n271 / n182 / n27 / n78)

| name | agrippa1533 | 1651 | barrett1801 | crowley777 | regardie1940 | gem | constant |
|---|---|---|---|---|---|---|---|
| divine | — / אהא / 7 | = | Aha / = / 7 | — | — | 7 | n |
| intelligence | Hagiel / הגיאל / 49 | = | = | Hagiel / הגיאל (49) | HAGIEL | 49 | n² |
| spirit | Kedemel / קדמאל (d/r unclear) / **157** | Kedemel / = / **157** | Kedemel / קדמאל / **175** | Qedemel / קדמאל (175) | KEDEMEL | 175 (קרמאל would be 371) | line |
| intelligences (plural) | Bne Seraphim, "Intelligentiae Veneris" / בני שרפים / 1225 | "The Intelligencies of Venus" / = / **1252** | "the Intelligence of Venus" / = / 1225 | — | BENI SERAPHIM, as a choir of angels | **692**; fin **1252** | 1225 = total; neither spelling-value is 1225 |

Plate n166 labels the Bne Seraphim sigil "Intelligentiarum Veneris".

#### Mercury (n163; square n167 / n256, n271 / n182 / n27 / n79)

| name | agrippa1533 | 1651 | barrett1801 | crowley777 | regardie1940 | gem | constant |
|---|---|---|---|---|---|---|---|
| divine | Asboga, "Octonarius extensus" / אזבוגה / 8 | "eight extended" / = | = | — | — | 24 (pairs אז, בו, גה each = 8) | n (as 8 "extended") |
| divine | Din / דין / 64 | = | = | — | — | 64 (fin 714) | n² |
| divine | Doni / דני / 64 | = | = | — | — | 64 | n² |
| intelligence | Tiriel / טיריאל / 260 | = | = | Tiriel / **תיריאל** (260) as read in the e-text | TIRIEL | טיריאל 260; תיריאל 651 | line |
| spirit | Taphthartharath / תפתרתרת / 2080 | = / a: 6th letter unclear; b: reads **תפתרתדת** / 2080 | Tapthartharath / תפתרתרת / 2080 | Taphthartharath / תפתרתרת (2080) | TAPHTHARTHARATH | 2080 (תפתרתדת 1884) | total |

#### Moon (n164; square n168 / n256 (cut), n271 / n182 / n27 / n80)

| name | agrippa1533 | 1651 | barrett1801 | crowley777 | regardie1940 | gem | constant |
|---|---|---|---|---|---|---|---|
| divine | Hod / הד / 9 | = | = | — | — | 9 | n |
| divine | Elim / אלים / 81 | = | = | — | — | 81 (fin 641) | n² |
| spirit | Hasmodai, "Daemonium Lunae" / חשמודאי / 369 | Hasmodai / **השמודאי** / 369 | Hasmodai / **השמודאי** / 369 | Chasmodai / חשמודאי (369) | CHASHMODAI | 369 (השמודאי 366) | line |
| spirit of spirits | Schedbarschemoth Schartathan, "Daemonium daemoniorum Lunae" / שדברשהמעתשרתתן / 3321 | "the spirit of the spirits of the Moon" / reads שדברשהמעה שרתתו (a, b alike) / 3321 | "the Spirit of the Spirits" / reads שדברשהמעחשרתתו / 3321 | — | SHAD BARSCHEMOTH HA-SCHARTATHAN | 2671; **fin 3321** (ן=700); 1651 2232; Barrett 2235 | total |
| intelligence of intelligences | Malcha betharsisim hed beruah schehakim, "Intelligentia intelligentiarum Lunae" / מלכא בתרשיתים עד ברוח שחקים / 3321 | "The Intelligency of the Intelligence of the Moon" / Malcha betharsisim hed beruah **schehalim** / מלכא בתרשיסים עד ברוה שהקים (b) / 3321 | "the Intelligence of the Intelligences" / Malcha … schehalim / one run-together word, reads מלכאבתרשיסים ער/עד ברוהשהקים / 3321 | Malkah Be Tarshishim va A'ad Be Ruah Shehaqim / מלכא בתרשישים ועד ברוח שחקים (3321) | MALCAH BETARSHISIM VE-AD RUACHOTH HA-SCHECHALIM | 1533: 2201, **fin 3321** (ם=600 ×2); 1651: 1855 / fin 2975; 777: 2107 / fin 3227 (3427 if ם=700) | total (1533 only) |

### Aiq Bekar reductions (computed, GD rule as established above)

Each letter's ordinary value, kept if ≤ n², else divided by 10 until it fits.
"|" = word break. ⚠ = same cell twice in a row (no rule given for it).

| planet | name (spelling) | cells |
|---|---|---|
| Saturn (9) | Agiel אגיאל | 1, 3, 1, 1 ⚠, 3 |
| Saturn | Zazel זאזל | 7, 1, 7, 3 (matches Regardie) |
| Jupiter (16) | Iohphiel יהפיאל | 10, 5, 8, 10, 1, 3 |
| Jupiter | Yophiel יופיל (777) | 10, 6, 8, 10, 3 |
| Jupiter | Hismael הסמאל | 5, 6, 4, 1, 3 |
| Mars (25) | Graphiel גראפיאל | 3, 20, 1, 8, 10, 1, 3 |
| Mars | Barzabel ברצאבאל (Agrippa) | 2, 20, 9, 1, 2, 1, 3 |
| Mars | Bartzabel ברצבאל (777) | 2, 20, 9, 2, 1, 3 |
| Sun (36) | Nachiel נכיאל | 5, 20, 10, 1, 30 |
| Sun | Sorath סורת | 6, 6 ⚠, 20, 4 |
| Venus (49) | Hagiel הגיאל | 5, 3, 10, 1, 30 |
| Venus | Kedemel קדמאל | 10, 4, 40, 1, 30 |
| Venus | Bne Seraphim בני שרפים | 2, 5, 10, \| 30, 20, 8, 10, 40 (final ם as 600: last 6) |
| Mercury (64) | Tiriel טיריאל | 9, 10, 20, 10, 1, 30 |
| Mercury | Taphthartharath תפתרתרת | 40, 8, 40, 20, 40, 20, 40 (matches Regardie) |
| Moon (81) | Hasmodai חשמודאי | 8, 30, 40, 6, 4, 1, 10 |
| Moon | Schedbarschemoth שדברשהמעתשרתתן (1533) | 30, 4, 2, 20, 30, 5, 40, 70, 40, 30, 20, 40, 40 ⚠, 50 (final ן as 700: last 70) |
| Moon | Malcha (1533) מלכא בתרשיתים עד ברוח שחקים | 40, 30, 20, 1, \| 2, 40, 20, 30, 10, 40, 10, 40, \| 70, 4, \| 2, 20, 6, 8, \| 30, 8, 10, 10 ⚠, 40 (finals as 600: the two last-of-word 40s become 60) |
| Moon | Malkah (777) מלכא בתרשישים ועד ברוח שחקים | as 1533 but ש 30 for the 2nd ת 40 in word 2, and 6 before 70 in word 3 |

Ambiguities: (1) final letters: Aiq Bekar puts ם ן in the 600/700 chambers,
so a tracer must choose 40 vs 60/6 for ם and 50 vs 70/7 for ן (affects
Elim, Din, Bne Seraphim and both Moon names); the GD text uses no final
letter in its examples. (2) Same cell twice in a row (Agiel, Sorath, both
long Moon names): no rule in Regardie. (3) Word breaks in multi-word names:
no rule. (4) The "largest that fits" reading rests on one case
(400 → 40 on 64); for ק 100 on the Moon square (→ 10, not 1) and י 10 on
Saturn's (→ 1) it is the only reading consistent with that case and Zazel.
(5) The traditional figures (Agrippa n164–n168, Regardie n75–n80) are
stylised and do not always follow these traces; whether they were made by
this method is not shown by any witness read.

