# magick-data

Magickal correspondences and reference data — the sephirot, the planets, the
zodiac, the Hebrew and Enochian letters, the Golden Dawn grades, the
geomantic figures and the rest — as 33 tables of plain rows, a graph that
says how they link, and the code that joins them. It is the data layer of
[magick.ly](https://magick.ly), which consumes it as anyone else would.

The tables are written as JSON5, which lives in the package's `src/` in
[the repository](https://github.com/gadicc/magickly/tree/main/packages/magick-data)
and is not published, and each is built into a JavaScript module, a
declaration and a JSON file. A row is a plain object; a link between tables
is an id, and `assemble()` turns ids into the rows they name.

## Licences

Copyright (c) 2020-2026 Gadi Cohen. The package is under two licences, by
path, and [LICENSE.txt](./LICENSE.txt) says which file is which:

- **The code is [MIT](./LICENSE.txt):** the hand-written modules and what
  they compile to. Among them is `astrology/kameas`, which is code, not
  data: it computes the planetary squares, and writes out only the Sun's,
  a fact from Agrippa ([Sources](#sources)).
- **The data is [CC BY 4.0](./LICENSE-DATA.txt):** the JSON5 sources and
  everything the build emits from them, the Enochian Keys among them
  ([Sources](#sources) says, file by file, what is ours to license). Use it
  anywhere, including commercially, as long as you credit
  [magick.ly](https://magick.ly).

The app that reads it is
[AGPL-3.0-or-later](https://github.com/gadicc/magickly/blob/main/LICENSE.txt);
this package is deliberately freer, so that it can travel.

The Enochian dictionary is neither. Its entries cite two works whose rights
are not ours to give:

- `EMPM`: Gerald J. Schueler, *Enochian Magic: A Practical Manual*
  (Llewellyn, 1985; second edition 1995), which is in copyright;
- `WE`: *The Whole Enochian Dictionary*, an online compilation whose author
  and status are unknown.

So no rights are claimed in its entries, it is offered under neither
licence, and it is not in the published package. It stays here for the app,
at `./enochian/dictionary`, which the published exports leave out.

Facts themselves belong to nobody. What is licensed here is the collecting,
wording and arrangement.

## Installing

```sh
npm install magick-data
```

It has no runtime dependencies, and it is ES modules only
([Requirements](#requirements)). In Node, or anything that bundles:

```js
import data from "magick-data";

const tiferet = data.sephirah.tiferet;
console.log(tiferet.name.roman, tiferet.planet?.symbol); // Tiferet ☉
```

TypeScript needs no setup: the declarations ship with the package, and
every id is a literal type, so a misspelt one is an error. The
[three ways in](#three-ways-in) below say what each kind of import costs,
[the tables](#the-tables) list every subpath, and a reader that is not
JavaScript can take [the JSON](#json). Wherever you use the data, credit
[magick.ly](https://magick.ly) ([Licences](#licences)).

## Three ways in

There are three ways to read the tables, and each costs something
different. Two kinds of figure are given, and each says where it came from:

- **Type instantiations measured by the smoke test**
  (`pnpm --filter magick-data smoke`, which prints them): the packed
  tarball, read by a consumer compiled with TypeScript 6.0.3 under
  `bundler`, with `lib: ["es2022"]` and `skipLibCheck`. Each of its reads
  loads the same 97 files, the lib's included.
- **Measured on the prototype at `dc6f732`**: the bundle sizes, minified
  and gzipped by esbuild 0.28.2 (webpack 5.111.0 came within a few per
  cent), and the instantiations of a scoped `assemble()`, in a consumer
  compiled with TypeScript 6.0.3. These have not been measured on the
  shipped package.

**The barrel**, assembled, with every link resolved:

```ts
import data from "magick-data";

data.sephirah.tiferet.planet?.symbol; // "☉"
```

It holds 30 of the 33 tables: `enochianTablet`, `christianChoir` and
`seventyTwoAngel` link to nothing and nothing links to them, so they are
left out and read through their own subpaths. Reading one field costs 8,505
instantiations, and a four-hop read 19,325 (smoke test); the bundle is
17,290 bytes gzipped (`dc6f732`). Whatever imports it carries all 30
tables.

**One raw table**, by its subpath:

```ts
import sephirot, { type SephirahId } from "magick-data/kabbalah/sephirot";

sephirot.tiferet.planetId; // "sol", an id rather than a row
```

The rows are as authored, with no links. Reading a field costs no
instantiations (smoke test), and `sephirot` is 1,650 bytes gzipped
(`dc6f732`).

**A scoped `assemble()`**, over the tables you name:

```ts
import planet from "magick-data/astrology/planets";
import sephirah from "magick-data/kabbalah/sephirot";
import { assemble } from "magick-data/tools";

const scoped = assemble({ planet, sephirah });
scoped.sephirah.tiferet.planet?.symbol; // "☉"
```

Only the links between the named tables are made, and reading one that
leads outside them is a type error. At `dc6f732`, two tables cost 5,637
instantiations, and sephirah and everything one hop from it, twelve tables,
cost 11,588 instantiations and 8,838 bytes gzipped: more types than the
barrel, because a partial scope's rows are a mapped type where the barrel's
are named interfaces, and about half its bytes. A scoped `assemble()` is a
bundle saving, not a type saving.

`assemble()` cannot be tree-shaken, since it is one call over the tables it
is given; what bounds a bundle is which subpaths are imported. Calling it
twice with the same tables returns the same object, and its rows are
frozen.

## The tables

Every table, by the name that `assemble()`, `magick-data/tables` and the
graph use, with its rows and the subpath that exports it raw. A subpath is
named after its file, so that it reads as the subject does; the table name
is what a link's `to` names.

| Table | Rows | Subpath |
| --- | ---: | --- |
| `planet` | 15 | `./astrology/planets` |
| `zodiac` | 12 | `./astrology/zodiac` |
| `astrologicalHouse` | 12 | `./astrology/houses` |
| `planetaryName` | 38 | `./astrology/planetaryNames` |
| `planetaryNameException` | 19 | `./astrology/planetaryNameExceptions` |
| `planetaryNameCharacter` | 32 | `./astrology/planetaryNameCharacters` |
| `hebrewLetter` | 27 | `./hebrewLetters` |
| `enochianLetter` | 21 | `./enochian/letters` |
| `enochianTablet` | 5 | `./enochian/tablets` |
| `tetragram` | 16 | `./geomancy/tetragrams` |
| `geomanticHouse` | 12 | `./geomancy/houses` |
| `gdGrade` | 12 | `./gd/grades` |
| `gdDegree` | 3 | `./gd/degrees` |
| `gdGodForm` | 15 | `./gd/godForms` |
| `archangel` | 15 | `./kabbalah/archangels` |
| `angelicOrder` | 10 | `./kabbalah/angelicOrders` |
| `christianChoir` | 9 | `./kabbalah/christianChoirs` |
| `fourWorlds` | 4 | `./kabbalah/fourWorlds` |
| `godName` | 10 | `./kabbalah/godNames` |
| `kerub` | 4 | `./kabbalah/kerubim` |
| `sephirah` | 11 | `./kabbalah/sephirot` |
| `treeOfLifePath` | 24 | `./kabbalah/paths` |
| `soul` | 6 | `./kabbalah/souls` |
| `tribeOfIsrael` | 14 | `./kabbalah/tribesOfIsrael` |
| `seventyTwoAngel` | 72 | `./kabbalah/seventyTwoAngels` |
| `chakra` | 7 | `./chakras` |
| `bodyPart` | 12 | `./body/parts` |
| `stone` | 12 | `./materia/stones` |
| `scent` | 11 | `./materia/scents` |
| `alchemySymbol` | 10 | `./alchemy/symbols` |
| `alchemyTerm` | 6 | `./alchemy/terms` |
| `element` | 5 | `./alchemy/elements` |
| `elemental` | 4 | `./alchemy/elementals` |

Most tables are objects keyed by id; `astrologicalHouse`, `christianChoir`
and `seventyTwoAngel` are arrays. Each subpath's default export is the rows,
and it exports the row's type and the table's by name (`Sephirah`,
`Sephirot`). An object table's module exports its id's type as well, mostly
as the row's name with `Id` (`SephirahId`). The exceptions are
`TetragramID`, `AlchemySymbolID`, `AlchemyTermID` and `EnochianTabletID`;
`LetterId` for `enochianLetter`; and `planet`, whose `PlanetKey` is every
row's id while `PlanetId` names only the twelve whose `kind` is
`"planet"`. The three array tables' modules export no id type.
`magick-data/tables` exports all 33 raw, with the `Tables` and `TableName`
types, and `magick-data/types` and `magick-data/rows` the row types derived
from the tables and the graph.

`planetaryName` holds the names that go with the planetary squares: each
square's divine names, the planets' intelligences and spirits (which a
planet's `intelligenceId` and `spiritId`, and a geomantic figure's
`rulerIds`, name), Venus' Bne Seraphim and the Moon's intelligence of
intelligences and spirit of spirits. A row has the name the site shows
(`name.roman`), its `role` and each witness's reading (`witnesses`: the
Hebrew, the romanisation, the number printed beside it and the archive.org
leaf), from Agrippa's 1533 printing to Regardie's of 1940. Where a printed
number is not the sum of the printed Hebrew, `planetaryNameException` has a
row saying so and whose the difference is, and a test holds every number to
one or the other. Its module also exports `PLANETARY_NAME_WITNESSES`, the
witnesses in order, and `tracedSpelling(name)`, the Hebrew a name is traced
in. The planet's `intelligenceOfIntelligences` is deprecated: it is the
Moon's `malcha-betharsisim` row, which a test holds it equal to, and it stays
until a major version.

`planetaryNameCharacter` holds Agrippa's characters of the sixteen names he
draws one for, a row a figure: as his 1533 printing draws it and as
Regardie's vol. 4 (1940) redraws it, each with the figure's box on the
archive.org page image and our `verdict` on whether it is the name traced on
its planet's square (`traceHebrew`): `match`, `partial`, with the cells the
figure reads and where it departs, or `no`. Each judge's verdict is kept
beside ours, and the 1533 figures carry two blind readers' records of their
strokes. A name's `characters` are its rows.

`gdGodForm` holds the Golden Dawn's table of gods for the mixes of elements
on a servient square's four sides (Regardie, *The Golden Dawn*, vol. 4,
1940, p.315): a row a god, with the mix (`mix`: one side of each element,
one element on three or four sides, two pairs, or three elements), its
`elements`, the god's name in Coptic letters as the table draws them
(`coptic`, read by hand from the page image, with `copticNote` where a
letter's shape and its sound part or the reading is in doubt, and `st` for
the sign the table adds to five names), its Neophyte station in our words,
and `vol3` where the Z documents in vol. 3 differ. An element's
`gdGodForms` are its rows. `enochian/tabletPyramids` gives each servient
square its god from here.

The signs and three of the elements carry the Hebrew letter the Golden Dawn
gives them (`hebrewLetterId`, p.298 of the same volume), as the planets do:
the twelve simple letters for the signs, and Aleph, Mem and Shin for Air,
Water and Fire. Earth has none of its own: that table gives Earth Saturn's
Tav. A letter's `zodiac` and `element` are the rows that name it.

## The graph

`magick-data/graph` declares every id-shaped field of every table, and
`magick-data/graph.json` is the same for a reader that is not JavaScript. A
field is one of:

- **`links`**: it names a row of the table in `to`, or with `many` a list of
  them. `mirrors` names the field on the target row that must name this row
  back; both directions are stored, so that the JSON stands on its own, and
  the check holds the pair row by row. `inverse` derives an accessor on the
  target row pointing back here, which must be unique unless `inverseMany`
  makes it a list. `as` names the accessor where the field's name would give
  the wrong one.
- **`pending`**: it names a table that does not exist yet, such as a
  Golden Dawn degree's `pillarId`.
- **`external`**: it names something outside the package, such as a tarot
  trump.
- **`enum`**: its value is one of a fixed set, not a reference.

An accessor is named after its field: `planetId` gives `planet`, and
`planetIds` gives `planets`, unless `as` says otherwise. A nested field is
named by its dotted path, and its accessor lands at the same depth:
`treeOfLifePath`'s `hermetic.hebrewLetterId` gives `hermetic.hebrewLetter`.
Optionality is never declared; a link a row does not have is an absent key
or `null`.

## Helpers

`magick-data/tools` exports all five, and `assemble`, `rowOf` and
`pathTarget` have subpaths of their own as well:

- `assemble(tables)` joins the named tables, as above
  (`magick-data/assemble`).
- `problemsOf(assembled)` lists what the data says that the graph says it
  should not: a link that resolves to nothing, a mirror that does not
  answer, an inverse that is not unique, an accessor that would hide a
  field. `assemble()` never throws; it records problems instead.
- `accessorName(field, link)` is the naming rule above, as a function.
- `rowOf(table, id)` is one row by an id that is only a string, or
  `undefined`, so that an unknown id is a value the caller must handle
  (`magick-data/rowOf`).
- `pathTarget(table, path)` says which table and field a dotted path such as
  `gdGrade.planet.symbol` ends at, by walking the graph, or `undefined`
  (`magick-data/pathTarget`). It imports every table, so it is for builds
  and tests rather than pages; a bundler drops it from a `tools` import that
  does not use it.

## Texts and values that are not tables

- `magick-data/enochian/keys`: the Enochian Keys, one row per word as
  Dee received it, with its English. A row holds each work's reading of
  the word (`readings`: Casaubon's print, with the word as dictated and
  his pronunciation column; the Golden Dawn's form in *The Equinox* I(8);
  room for Dee's own copy, Sloane MS 3191), where it is printed, and any
  note or doubt (`uncertain`). A version is a
  rule over the readings, as the tablets' are: `keyVersion(key, version)`
  gives each word in `dee`, the default (Dee's own copy when it can be
  read, else Casaubon's, else for a word his print lost Crowley's form,
  marked `from`), or `gd`, the Equinox's form, with a `marker` where
  Crowley joins a word to an earlier one, splits it, leaves it out or
  runs it into the word before. Both give Dee's English, and a word is
  always looked up by Dee's spelling (`lookup`). Key 19, the Call of the
  Thirty Aethyrs, marks the rows that change with the Aethyr as slots:
  `aethyrCall(n, version)` gives the Call for Aethyr n, and `aethyrs`
  holds the thirty with each work's spelling. Each Key has a `checked`
  record, the date, the works compared, the fields covered and what was
  not, and `checkedText` says it in a sentence, so that no page restates
  it. Where the Keys come from is in [Sources](#sources).
- `magick-data/kabbalah/seventyTwoAngels/text`: Lenain's entries on the
  seventy-two genii in full, in French and in English, loaded on demand.
- `magick-data/kabbalah/seventyTwoAngels/derived`: what Lenain's four tables
  compute for each genius: degrees, days, minutes, sign, planet and choir.
- `magick-data/kabbalah/lenain/volume`, `…/notes`, `…/pieces` and
  `…/firstTable`: Lenain's *La Science Cabalistique* leaf by leaf, the
  editorial apparatus, the text folded into paragraphs that run across
  leaves, and his first table reconstructed, each row beside its source on
  Kircher's plate of the names of God by nation.
- `magick-data/astrology/kameas`: the planetary kameas (magic squares),
  Saturn's 3 × 3 to the Moon's 9 × 9, keyed by the planet table's ids
  (`kameas.luna`) and frozen, row by row from the top. They are computed
  rather than written out, except the Sun's ([Sources](#sources)), so there
  is no JSON for them; `oddKamea(n)` and `doublyEvenKamea(n)` are the
  constructions, for an odd order from 3 or a multiple of 4, up to
  `MAX_KAMEA_ORDER` (100). Any other order is a `RangeError`.
- `magick-data/astrology/decans`: the 36 decans of the zodiac in the
  Golden Dawn's sequence, computed: `DECANS`, from the first of Aries,
  each with its sign, its number within the sign, its planet (the Chaldean
  order, `CHALDEAN_ORDER`, from Mars round to Mars) and its small card of
  the Tarot, of the sign's suit, 2 to 4 cardinal, 5 to 7 kerubic and 8 to
  10 mutable (Regardie, *The Golden Dawn*, vol. 4, 1940, pp.285–286;
  *The Equinox* I(7), p.237). `decansOf(sign)` gives a sign's three and
  `decanById(id)` one (`aries-1`). Lenain's decades take their planets
  from here.
- `magick-data/tarot/minorCards`: the Tarot's 56 minor cards as the
  Golden Dawn names them, ids and English names only (`MINOR_CARDS`,
  `minorCard(id)`, `minorCardId(suit, rank)`): the Aces, the small cards
  and the court cards in the Order's ranks, King, Queen, Prince and
  Princess (vol. 4, p.288), with each suit's and court rank's element
  (`SUIT_ELEMENTS`, `COURT_ELEMENTS`). The Order's titles of the cards are
  not here.
- `magick-data/astrology/aiqBekar`: Aiq Bekar, the nine chambers of the
  Hebrew letters (`AIQ_BEKAR`), and the Golden Dawn's reduction of a
  letter to a cell of a kamea (Regardie, *The Golden Dawn*, vol. 4, 1940,
  pp. 78–80). `aiqBekar(value, cells)` keeps a letter's value if the square
  has a cell of that number, and otherwise divides it by ten until it has;
  `traceHebrew(hebrew, planet)` gives the cells a name's letters fall on,
  word by word, on that planet's square. `letterValue` and `hebrewValue`
  count a letter and a name, the final forms at their ordinary letters'
  values unless `{ finals: true }` asks for the table's 500 to 900. A value
  that is not a letter's, or that no division brings within the square, is
  a `RangeError`.
- `magick-data/enochian/tablets`: besides its rows, the tablets'
  versions. A row holds each source's reading of the tablet, square by
  square (`readings`: Regardie 1940, the Equinox 1912, Greer's edition,
  Dee's table of 1584 and Raphael's of 1587), and a version is a rule over
  them, not a copy: `tabletVersion(tablet, version)` gives its letters
  (`null` for an empty square) and the squares that hold more (`alt`,
  `reversed`, `doubt`), for `gd`, the Golden Dawn's and the default,
  `regardie`, `equinox`, `dee` and `raphael` (`TABLET_VERSIONS`), or
  `undefined` where a version has no such tablet: Dee and Raphael have no
  Tablet of Union. `tabletDifferences(a, b)` lists the squares where two
  versions differ, and how. A new source or version is a new key; no id
  moves.
- `magick-data/enochian/tabletNames`: the names read off the tablets,
  computed rather than written out, as the kameas are. `tabletNames(view)`
  reads a version's letters (`tabletVersion`) along fixed paths. A
  Watchtower has 38 in every version: the three holy names, the King, the
  six Seniors and, in each quarter, the Calvary cross's column and row,
  the top row and the four servient rows. In the Golden Dawn's versions
  it has 20 more, built with a letter of the Tablet of Union: each
  quarter's Kerubic archangel (the top row with the first letter of the
  tablet's line of the Union before it) and its four servient rows with
  the line's letter for the quarter's element; those letters are read from
  the Tablet of Union in the view's own version, so the one view is all
  the call takes. The Tablet of Union, in the versions that have it, has
  5: its four lines and its first column. A name (`TabletName`) has a
  positional `id` (`TabletNameId`) that is the same in every version that
  has it (`holy-1`, `king`, `senior-row-left`, `top-left-servient-1`,
  `top-left-kerubic-archangel`, `union-row-1`), its `kind`, `quarter`,
  `squares` in reading order on its own tablet and `spelling` (an empty
  square as `?`). An archangel also has its `unionLetter`, the letter
  that starts its spelling and that letter's square on the Union. A top
  row has its `rotations`, each one letter further left, in every
  version, a servient row in the Golden Dawn's versions only, and an
  archangel its row's with its letter first; in Dee's and Raphael's
  versions the King has two `spellings`, the six squares of the whirl
  with either centre letter, as Dee's record gives it; and the Golden
  Dawn's versions carry its `attribution`, a quarter's element, a
  Senior's or the King's planet, or a line of the Union's element. The
  module also exports `findTabletName(view, id)`, one name;
  `isTabletNameId(id)`; `TABLET_NAME_IDS`, all 63 ids in order (a view
  gives those of its tablet and tradition); `TABLET_QUARTERS` and
  `TABLET_QUARTER_ID_PREFIXES`, the quarters and their prefixes in the ids
  (`topLeft`, `top-left`); `TABLET_NAME_TRADITIONS`, which tradition each
  version's names follow; `tabletNameVariants(tablet, id, version)`, the
  other versions' whole readings for display, hiding differences of case
  or of u for v alone; and `tabletNameSpellings(tablet, id, version)`,
  every version's spelling, the given version's first, unfolded, to look
  a name up by. Where each path and attribution comes from, and the
  spellings sources print that no path gives, are in `tabletNotes`. It
  also exports `TABLET_QUARTER_ELEMENTS`, each quarter's element.
- `magick-data/enochian/tabletPyramids`: the Golden Dawn's truncated
  pyramids on the tablets, computed square by square from their
  positions, as the names are from theirs. `tabletPyramids(view)` gives
  every square of a tablet in one of the Golden Dawn's versions (`gd`,
  `regardie`, `equinox`), a Watchtower's 156 and the Tablet of Union's 20,
  and `tabletPyramid(view, square)` one, by row and column from 0; Dee's
  and Raphael's versions have none, their tables carrying no elements. A
  square (`TabletPyramid`) has its `region` (`greatCross`,
  `calvaryCross`, `kerubic`, `servient` or `union`), its `quarter`, the
  `letters` of the Name that govern it (its block on the Great Cross; its
  column and rank in a lesser angle) and its four `sides`, numbered as
  vol. 4 numbers them (1 left, 2 top, 3 right, 4 bottom), each with its
  `elementId` (an element or Spirit; none on a Calvary square's fourth,
  which carries its Sephirah) and its `attribution`, ids of the package's
  tables and modules: a sign and decan, a planet, an element, a Sephirah,
  a trump (as its path), a Hebrew letter, a minor card, a geomantic
  figure, a Kerub. A servient square also has its `angel` and
  `greatAngel`, the rotations of its servient row from that square that
  `tabletNames` reads, its god (`godFormId`, of `gd/godForms`) and its
  `sphinx`, the Kerub of each side. Ids, not colours or glyphs. The
  constants the rules use are exported with their pages:
  `TABLET_NAME_LETTERS`, `KERUBIC_RANKS`, `GREAT_CROSS_QUALITIES`,
  `RANK_QUALITIES`, `PLANET_ELEMENTS`, `CALVARY_PLANETS`,
  `CALVARY_COLUMN`, `CALVARY_BARS` (the bar, which the witnesses dispute,
  per version), `COURT_BY_LETTER`, `UNION_COLUMNS`, `UNION_LINES` and
  `GEOMANTIC_FIGURES`; so is the region rule, `tabletRegion(row, column)`
  (nothing outside a Watchtower's 13 rows and 12 columns), which the
  components' drawing is held to. The Name's letters are ids of their own,
  `yod`, `he`, `vav` and `heFinal` (`NAME_LETTERS`), not Hebrew letters'
  ids: the Name's two He's are told apart, and `NAME_LETTER_HEBREW` maps
  each to its Hebrew letter, both He's to `he`. Where each rule comes from,
  and where the witnesses depart from it, are in `tabletNotes`.
- `magick-data/enochian/tabletNotes`: notes on the Enochian tablets: each
  version, where it comes from and how it differs from each of the others
  (`versionNote(id)`), how the versions differ in general, each tablet,
  and particular squares, by row and column from 0 as the readings count
  them (`squareNote(id, row, column)`), with `sourceText` and `sourceUrl`
  for the works cited. For the names (`tabletNames`), where each kind is
  read in a version (`nameRules(kind, version)`), where the Golden Dawn's
  attributions come from (`attributionNote`), the spellings sources
  print that no path gives (`citedSpellings(tablet, id)`), and the
  dictionary's own spellings of the Kerubic archangels, with a letter of
  the Union the Golden Dawn's rule does not give
  (`dictionarySpellings(tablet, id)`). For the pyramids
  (`tabletPyramids`), each rule as vol. 4 and the Equinox give it
  (`pyramidRules(topic)`), where a witness departs from the rules and
  whose slip it is (`pyramidExceptions(tablet)`), and the readings that
  are ours, among them the Calvary bar per version
  (`pyramidReading(id)`). The prose is ours, under CC BY 4.0 like the tables;
  the counts and squares where versions differ are the readings', never
  written into the prose.
- `magick-data/enochian/dictionary`: for the app only, and not published
  ([above](#licences)).

## JSON

For a reader that is not JavaScript, every table and text is plain JSON as
well: `magick-data/json/<path>.json`, at its source's path (for example
`magick-data/json/kabbalah/sephirot.json`), and the graph at
`magick-data/graph.json`. The JSON holds the rows as authored. Nothing
assembled is shipped, since an assembled result is cyclic and JSON cannot
hold it.

## Requirements

- **ES modules only.** A CommonJS consumer under `node16` resolution cannot
  import it; one under `nodenext`, and every bundler, can.
- **`structuredClone`**, which `assemble()` uses: Node 17 and later, and
  every browser since 2022. The declarations do not mention it, so a
  consumer's `lib` needs nothing for it.
- **`skipLibCheck: false`** costs about 64,000 instantiations, on a clean
  `es2022` lib, whichever way in is used.
- **TypeScript 6.0.3** is what the package's smoke test checks a consumer
  with, under `bundler` and `nodenext`. The declarations carry `.ts` relative
  specifiers, which it resolves; a much older compiler may not.

## Versions

Semantic versioning, applied to the data as well as the code:

- renaming or removing a table, a field or a row's id is **major**;
- new rows, fields or tables are **minor**;
- a corrected value is a **patch**.

While the version is 0.x, a breaking change bumps the minor instead. The
version says nothing about whether anything drawn from the data renders the
same: a corrected value can change a picture, and a rename can leave every
picture as it was.

From 0.1.0, each release is published by the repository's CI when the
version changes on `main`, with npm provenance naming the commit it was
built from. CI publishes a pre-release under the `next` tag and a release
under `latest`. The first version, the release candidate 0.1.0-rc.0, was
published by hand.

0.4.0 adds the names that go with the planetary squares (plan 093 in the
repository): the tables `planetaryName`, `planetaryNameException` and
`planetaryNameCharacter` (see [The planetary names](#the-planetary-names)
and [Agrippa's characters](#agrippas-characters)), and
`astrology/aiqBekar`. A planet's `intelligenceId` and `spiritId`, and a
geomantic figure's `rulerIds`, keep their ids and are now links to
`planetaryName` rows, which the graph follows; a planet lists its
`planetaryNames`. `magick-data/graph`'s `graph.planet.pending` and
`graph.tetragram.pending`, which listed them as links still to come, are
gone, which only code that reads those keys notices.
`intelligenceOfIntelligences` is deprecated for the Moon's
`malcha-betharsisim` row, and stays until a major version. No existing
value changed.

0.5.0 holds the 72 genii's verses to the Vulgate and corrects nine of them
(plan 096 in the repository), and gives the planetary names' readings more
of what their readers recorded (plan 093). In `seventyTwoAngel`, `psalm.la`
changes for the 2nd, 11th, 14th, 17th, 37th, 43rd, 54th and 64th genii and
`psalm` for the 47th (104 to 103). Two of the ten fixes mend our
misreadings of æ as œ (43, 54), five the reissue's misprints, which the
1823 printing does not have (2, 17, 37's "ad", 47, 64), and three Lenain's
own slips that are not Latin as they stand (11, 14, 37's "virtutem"), given
the psalter's word as the 45th's "adjuvebat" always was. The misreadings of
æ are mended in the transcription too: `lenain/pages` (generated from it)
and both entries' French and English in `seventyTwoAngelsText` read
"præveniet" and "cælo". The entries' French otherwise keeps what the reissue
prints where the slip is the printer's or Lenain's, and `lenain/apparatus`
notes each, with the 1823 printing's reading in `lenain/witnesses` and, for
11, 14 and 37, Kircher's (a new witness `source`, `kircherVerses`, the leaf
of his table of the verses). `lenain/apparatus` also notes that the 33rd's
verse is the Vulgate's Psalm 93:11, which Lenain cites as Psalm 33; the field
keeps his number. In `planetaryNameCharacter`, a stroke may
give `rings`, and a vertex `via`, `hook` and `bar`, points the reader
recorded; `planetaryName` gives more of its witnesses' captions, read again
from the leaves. No field or table is renamed or removed. The Vulgate's
verses the corrections were checked against are published beside them,
in `lenain/vulgate/verses` and `lenain/vulgate/differences`.
0.5.0 is also the first release with the decans
(`astrology/decans`), the minor cards (`tarot/minorCards`), the
tablets' truncated pyramids (`enochian/tabletPyramids`) and the gods of
the pyramids (`gd/godForms`, the table `gdGodForm`), all new and
additive (plan 095).

## Romanised Hebrew

A romanised Hebrew name writes its prefixes as Israel's official
romanisation does, the Academy of the Hebrew Language's system that BGN/PCGN
adopted in 2018: the article, the conjunction and the prepositions written
as prefixes in Hebrew are capitalised and joined to their word, "Roshit
HaGilgulim", "Chayot HaKodesh", "YHVH Eloah VeDa'at". Where that word begins
with an aleph, its vowel is capitalised in the same way, "Adonai HaAretz".
The library standard, ALA-LC, writes prefixes in lower case with a hyphen
instead; the data keeps to one of the two.

## Sources

Most of this is correspondences, which belong to nobody. Every data file
the package publishes is below, by its source in `src/` (each is
published as `magick-data/json/<path>.json`, beside its module and
declaration), with where it comes from; the sections after the table name
the works. A test holds the table to the files, so no data file ships
without a row. "Signed off" is the date the owner checked the row's
provenance, and no version past 0.0.0 ships while a row has none.

| Data file | Source | Signed off |
| --- | --- | --- |
| `alchemy/elementals.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `alchemy/elements.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `alchemy/symbols.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `alchemy/terms.json5` | [Correspondences](#correspondences); `terms` from [the Second Knowledge Lecture](#the-second-knowledge-lecture), with no rights asserted over them | 2026-11-12 |
| `astrology/houses.json5` | [Correspondences](#correspondences); `interpretation` is ours, following [Lilly](#lillys-houses); `motto.la` is the mnemonic verse as usually quoted, not from Lilly, and `motto.en` our rendering of it ([Lilly's houses](#lillys-houses)) | 2026-11-12 |
| `astrology/planetaryNameCharacters.json5` | Ours: verdicts on [Agrippa's characters](#agrippas-characters) of the planetary names, as his 1533 printing and Regardie's vol. 4 (1940) draw them, with each figure's box on archive.org's page image, in our words; the blind readings are of Agrippa's 1533 figures, which are public domain, and none of Regardie's is given | 2026-11-20 |
| `astrology/planetaryNameExceptions.json5` | Ours: where a witness's printed number departs from the [planetary names](#the-planetary-names)' Hebrew, and whose the difference is, in our words | 2026-11-20 |
| `astrology/planetaryNames.json5` | [The planetary names](#the-planetary-names): the names, their Hebrew, romanisations, captions and numbers as each witness prints them, with the archive.org leaf; Agrippa's, the 1651 English's and Barrett's are public domain, 777's names and numbers, and Regardie's names, are taken as facts | 2026-11-20 |
| `astrology/planets.json5` | [Correspondences](#correspondences); `keyOfSolomon` from [the Key of Solomon](#the-key-of-solomon); `about` and `description` are ours, written from public-domain works the file's header cites; `intelligenceOfIntelligences`, the Moon's, is the name and its Hebrew from [Agrippa](#agrippas-kameas)'s table of the Moon, with 777's and Regardie's spellings of it beside his, names only, as the header cites them | 2026-11-14 |
| `astrology/zodiac.json5` | [Correspondences](#correspondences); `tetragrammatonPermutation` is the Twelve Banners of the Name, Crowley's *777* (1909), col. CXL, as the file's header cites it: the twelve orders of YHVH's letters, one to a sign | 2026-11-14 |
| `body/parts.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `chakras.json5` | [Correspondences](#correspondences) of the seven-chakra system, facts only: names, places, petals, colours, seed syllables and their elements, and one-to-five-word glosses of the Sanskrit names. The Wikipedia "Chakra" article the file cites is a reference; no share-alike text is copied | 2026-11-12 |
| `enochian/keys.json5` | [The Enochian Keys](#the-enochian-keys) | 2026-11-12 |
| `enochian/letters.json5` | [The Enochian letters](#the-enochian-letters) | 2026-11-12 |
| `enochian/tabletNotes.json5` | Ours: notes on [the Enochian tablets](#the-enochian-tablets), citing their sources, with the rules by which `enochian/tabletNames` reads the names, the spellings the sources print that no path gives, and the dictionary's own spellings, and the rules by which `enochian/tabletPyramids` computes the pyramids, where the witnesses depart from them and our readings, each cited | 2026-11-23 |
| `enochian/tablets.json5` | [The Enochian tablets](#the-enochian-tablets) | 2026-11-12 |
| `gd/degrees.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `gd/godForms.json5` | [The gods of the pyramids](#the-gods-of-the-pyramids): the table of gods in Regardie's vol. 4 (1940), p.315, taken as facts: each god's mix of elements, name, Coptic spelling and Neophyte station, the stations and every note in our words, the Coptic read by hand from archive.org's page image, with vol. 3's differing readings | 2026-11-23 |
| `gd/grades.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `geomancy/houses.json5` | [Geomancy](#geomancy) | 2026-11-12 |
| `geomancy/tetragrams.json5` | [Geomancy](#geomancy) | 2026-11-12 |
| `hebrewLetters.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `kabbalah/angelicOrders.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `kabbalah/archangels.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `kabbalah/christianChoirs.json5` | [Lenain](#lenain): the nine choirs of Pseudo-Dionysius, in his order and with his French | 2026-11-12 |
| `kabbalah/fourWorlds.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `kabbalah/godNames.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `kabbalah/kerubim.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `kabbalah/lenain/apparatus.json5` | [Lenain](#lenain) | 2026-11-23 |
| `kabbalah/lenain/evidence.json5` | [Lenain](#lenain) | 2026-11-12 |
| `kabbalah/lenain/kircherPlate.json5` | [Lenain](#lenain): Kircher's plate of the seventy-two names of God by nation (1653), the source of Lenain's first table's last two columns, read from the National Library of Poland's copy on Wikimedia Commons; and where Lenain's entries depart from it | 2026-11-19 |
| `kabbalah/lenain/pages.json5` | [Lenain](#lenain) | 2026-11-23 |
| `kabbalah/lenain/vulgate/differences.json5` | [Lenain](#lenain): ours, every place Lenain's Latin verse differs from the Vulgate's, with what the 1823 printing and Kircher read and whose the difference is | 2026-11-23 |
| `kabbalah/lenain/vulgate/verses.json5` | [Lenain](#lenain): the Clementine Vulgate's text of the 72 genii's verses, from the Clementine Vulgate Project (public domain), each with the page of Hetzenauer's Clementine (Innsbruck, 1914) that prints it | 2026-11-23 |
| `kabbalah/lenain/witnesses.json5` | [Lenain](#lenain): what the 1823 printing and the manuscript copy of it print where a note turns on a value, read from their page images, and what Kircher's table of the verses prints where a note on a verse turns on it | 2026-11-23 |
| `kabbalah/paths.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `kabbalah/sephirot.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `kabbalah/seventyTwoAngels.json5` | [Lenain](#lenain) | 2026-11-23 |
| `kabbalah/seventyTwoAngelsText/en.json5` | [Lenain](#lenain) | 2026-11-23 |
| `kabbalah/seventyTwoAngelsText/fr.json5` | [Lenain](#lenain) | 2026-11-23 |
| `kabbalah/souls.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `kabbalah/tribesOfIsrael.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `materia/scents.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `materia/stones.json5` | [Correspondences](#correspondences) | 2026-11-12 |
| `graph.json` | Ours: how the tables link, built from `src/graph.ts` | 2026-11-12 |

### Correspondences

The correspondences are traditional, the Golden Dawn's above all, and are
facts: no one work is their source. What is ours is the collecting,
wording and arrangement, which is what CC BY 4.0 covers. Where a file also
holds text from an identified work, its row says so.

### Lenain

**`seventyTwoAngels.json5`, `seventyTwoAngelsText/` and `lenain/`** come from
Lazare Lenain, *La Science Cabalistique* (Amiens, 1823), read page by page from
the Google Books scan in the repository's
[`public/docs/`](https://github.com/gadicc/magickly/tree/main/public/docs).
That scan is of a later reissue: it reproduces the 1823 title page and adds
a preface by Papus for the Ordre Kabbalistique de la Rose-Croix. The volume
does not date itself; the first reprint is recorded as Dujols and Thomas,
1909. It is not a facsimile: the reissue was reset, with its own page
contents and modernised spelling, so its page numbers are not Lenain's.
Lenain died in 1877 and Papus in 1916, so **no rights are asserted over
either text**.

Where the apparatus turns on what is printed, **`lenain/witnesses.json5`**
records what two other copies have there: the 1823 printing itself, the
Koninklijke Bibliotheek's copy
([Google Books qt9SAAAAcAAJ](https://books.google.com/books?id=qt9SAAAAcAAJ)),
and Ms 5365 of the Bibliothèque interuniversitaire de santé, an undated
handwritten copy of it
([archive.org BIUSante_ms05365](https://archive.org/details/BIUSante_ms05365),
Licence ouverte). Each reading is a short value with its page or leaf, read
from the page image: the 1823 printing is public domain, and the manuscript's
images are offered under the Licence ouverte. Where a note on a verse turns
on Kircher's table of the 72 verses, which Lenain cites for them
(*Oedipus Aegyptiacus*, vol. II part 1, Rome 1653, pp. 275–280), it
records what the table prints there too, with its leaf in the Complutense
copy ([archive.org bub_gb_XjfzMnomDQoC](https://archive.org/details/bub_gb_XjfzMnomDQoC));
Kircher died in 1680.

**`lenain/kircherPlate.json5`** is the plate Lenain names as the source of
his first table's last two columns: Athanasius Kircher, *Oedipus
Aegyptiacus*, vol. II part 1 (Rome, 1653), the fold-out after p. 287, its
seventy-two names of God and their nations as engraved, read from the
National Library of Poland's copy
([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Kircher-Diagram_of_the_names_of_God_(22593924).jpg),
marked public domain; SHA-256 of the image read in the file's header).
Kircher died in 1680, the names are facts, and **no rights are asserted
over them**. The file also records, as ours, where Lenain's entries depart
from the plate.

**`lenain/vulgate/verses.json5`** is the Vulgate's text of each genius's
verse, the 71 psalm verses and the 70th's Genesis 1:1, from the Clementine
Vulgate Project's plain-text files of the Sixto-Clementine Vulgate of 1592,
which the project released into the public domain; each verse gives the
page of Hetzenauer's printed Clementine (Innsbruck, 1914, archive.org
`biblia_sacra_vulgatae_etitionis_1914`) that has it. The files read, their
hashes and how to rebuild it are in `src/kabbalah/lenain/vulgate/README.md`
in the repository. **No rights are asserted over the Latin.**
**`lenain/vulgate/differences.json5`** is ours: every place Lenain's Latin
differs from it, with what the 1823 printing and Kircher read and whose the
difference is.

What is offered under CC BY 4.0 is the work done on top: the English translated
from that French, the choice and arrangement of fields, the editorial apparatus,
and the corrections. No rights are claimed where none subsist. Nothing in it
draws on any modern published translation of the work — the point of the
exercise was a copyright-free rendering of the same public-domain material.

The Hebrew names are given both as the page points them and as bare letters;
for three, the thirty-seventh, the sixty-eighth and the sixty-ninth, the
reissue misprints the name and the bare letters follow the 1823 printing.
Forty-seven are there because two independent readings of the scan agree;
twenty-five were read by a person who reads Hebrew, and each of those carries a
note saying so. See
[plan 031](https://github.com/gadicc/magickly/blob/main/plans/031-seventy-two-angels.md).

### The Key of Solomon

**`keyOfSolomon` in `astrology/planets.json5`**, on the seven classical
planets, is what *The Key of Solomon the King* says each planet's days and
hours serve for, in S. L. MacGregor Mathers' translation (London, 1888),
Book I, chapter II, p. 12: his sentences verbatim, checked against
sacred-texts' transcription of his edition. Mathers died in 1918, so the
translation is in the public domain and **no rights are asserted over the
text**. See
[plan 039](https://github.com/gadicc/magickly/blob/main/plans/039-correspondence-tables.md).

### Agrippa's kameas

**`astrology/kameas.ts`**, which is code rather than a data file, gives the squares of Heinrich Cornelius Agrippa,
*De occulta philosophia libri tres* (Cologne, 1533), book II, chapter 22,
which the Golden Dawn's diagrams follow. Agrippa died in 1535, the squares
are facts, and **no rights are asserted over them**. Six are computed by
the standard constructions, which give his squares, and the Sun's, of
order 6, is written out. Two numbers of the 1533 printing are misprints,
corrected to make the squares magic: Venus, row 4, column 5, printed 45
for the 43 of his Hebrew table, and the Moon, row 1, column 8, printed 45
for 54 in both his tables (archive.org `DeOccultaPhilosophiaLoc1533`,
leaves n166 and n168). The tests check that every square is magic,
that each starts with his first row (the Moon's as corrected), and that
Saturn's and Jupiter's are his row by row. See
[plan 061](https://github.com/gadicc/magickly/blob/main/plans/061-gd-hall.md).

### The planetary names

**`astrology/planetaryNames.json5`** gives the names Agrippa sets with
the planetary squares, *De occulta philosophia libri tres* (Cologne,
1533), book II, chapter 22, as he prints them and as four later works do:
*Three Books of Occult Philosophy* (London, 1651), the English
translation; Francis Barrett, *The Magus* (London, 1801); Aleister
Crowley, *777 Revised* (London, 1955), Table III, read in Celephaïs
Press's electronic edition; and the Golden Dawn's papers in Israel
Regardie, *The Golden Dawn*, vol. 4 (Chicago, 1940), which prints the names
in capitals and no Hebrew. The file's header names the archive.org copy of
each, and every reading carries its leaf. Agrippa's, the 1651 English's and
Barrett's are in the public domain, and **no rights are asserted over the
names or their captions**. 777 and Regardie's volumes are in copyright, so
only their spellings and numbers are taken, as facts, and nothing of their
text. The readings are one pass by eye on the scans, made on 19 November
2026 by Claude knowing the values to expect, and the sums are computed.
`astrology/planetaryNameExceptions.json5` is ours: each number a witness
prints that its Hebrew does not add up to, what differs and whose it is.
See
[plan 093](https://github.com/gadicc/magickly/blob/main/plans/093-kameas-and-their-sigils.md).

### Agrippa's characters

**`astrology/planetaryNameCharacters.json5`** is ours: whether each of the
characters Agrippa prints with the planetary names (1533, archive.org
`DeOccultaPhilosophiaLoc1533`, n164–n168), and each of Regardie's
redrawings of them (vol. 4, 1940, `IsraelRegardie-TheGoldenDawn-Vol4-1940`,
n75–n80), is the name traced on its planet's square. On 20 November 2026
two readers, Claude Opus 5.5 and Claude Fable 5.2, recorded each figure
apart and blind to the names, from crops given opaque ids; two judges, the
same two models, compared each figure with the trace of every spelling the
witnesses give, with and without final values; and Claude reconciled their
verdicts, keeping both. The file's header gives the method and the verdicts'
meanings. Agrippa's figures are public domain, and the readers' records of
them are given; Regardie's are in copyright (plan 091), so for his only the
boxes, the verdicts and our words about the figures are given, and nothing
traced from them.

### The Enochian letters

**`enochian/letters.json5`** gives each letter in both traditions, as
the tablets do. `english` and the Golden Dawn's names (`names.gd`) are
the Order's table in Israel Regardie, *The Golden Dawn*, vol. 4 (Aries
Press, Chicago, 1940; archive.org `IsraelRegardie-TheGoldenDawn-Vol4-1940`,
p. 299). Dee's names (`names.dee`) are those of the action of 26 March
1583 in British Library, Sloane MS 3188, whose f. 104 shows the letters
as Dee drew them
([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Enochian_letters_(1583_manuscript).png)).
`sounds.gd` is how the Order says a letter on its own, by the rule and
examples of S. L. MacGregor Mathers and W. Wynn Westcott in the same
volume (pp. 297 and 300), with Aleister Crowley's Golden Dawn reading of
the Keys in *The Equinox*, vol. I no. 8 (London, 1912), where those
pages give no example of the letter on its own. `sounds.dee` is the sound a letter stands for in
Dee's spellings: his own notes beside the Keys, in Meric Casaubon's
*A True & Faithful Relation* (London, 1659; archive.org
`truefaithfulrela00deej`), with facts from Aaron Leitch, *The Angelical
Language*, vol. II (Llewellyn, 2010), and Donald Laycock, *The Complete
Enochian Dictionary* (1978), in our words. `tetragramId` is the
geomantic figure the Golden Dawn gives sixteen of the letters, in
Regardie, vol. 4, p. 77. The comment at the head of the repository's
source file
([`letters.json5`](https://github.com/gadicc/magickly/blob/main/packages/magick-data/src/enochian/letters.json5))
cites the page or leaf of each; comments do not ship in the package.

Until 2026 the file also gave each letter a number (`gematria`), a tarot
trump and a sign or element, all from Gerald J. Schueler, *Enochian
Magic: A Practical Manual* (Llewellyn, 1985). They were removed: the
numbers and trumps are his own derivation from the Hebrew letters, and
neither Dee nor the Golden Dawn numbered the Enochian letters. The names,
equivalents, sounds and figures are facts, and **no rights are asserted
over them**; the wording and arrangement are ours, under CC BY 4.0.

### The Enochian Keys

**`enochian/keys.json5`** gives the Enochian Keys as Dee received them
in Cracow from 13 April to 13 July 1584. Each Key is read word by word
from the page images of Meric Casaubon's printing of Dee's journal,
*A True & Faithful Relation* (London, 1659; archive.org
`truefaithfulrela00deej`), which comes from British Library, Cotton MS
Appendix XLVI: its Enochian with the pronunciation column beside it, and
its English, word by word for Keys 1 to 4 and as running text for the
rest, which we split into rows and say so. Each row and Key names its
pages and leaves, and each Key's `checked` record says what was compared
and what was not; Dee's own copy, Sloane MS 3191, whose images have been
offline since 2023, is not.

None of the text the app had from 2023, whose source was not known,
remains. Casaubon's print has lost the Enochian of parts of Keys 13 to
16 (damaged pages, pp. 133-138): two words of Key 13, most of Keys 14
and 15, and Key 16's third to fourteenth words. Those rows give Aleister Crowley's form from *The Equinox*, vol. I no. 8
(London, 1912), marked as his, until Dee's own copy can be read. The
Golden Dawn's reading of each Key is Crowley's in the same Equinox,
read word by word against Dee's rows. Key 19, the Call of the Thirty
Aethyrs, is Casaubon's (pp. 201-209, the misbound leaves noted), with
the thirty names as he prints them after it (p. 209) and as Crowley
gives them (I(8) p. 125; I(5)'s chapter headings).

The words and their English are facts from
public-domain prints, and **no rights are asserted over them**; the
arrangement into rows, the split of the English and the notes are ours,
under CC BY 4.0. Nothing in them comes from a modern edition or
transcription, which are in copyright. See
[plan 073](https://github.com/gadicc/magickly/blob/main/plans/073-enochian-keys.md).

### The Enochian tablets

**`enochian/tablets.json5`** gives the Enochian tablets as each source
prints them, so that both traditions are served. In the owner's words
(24 October 2026): "we want to accommodate Enochian practitioners from
both traditions; for gdHall we use the Regardie/GD version, but we also
accommodate Dee purists." The Golden Dawn's version is the default.
Its sources are Israel Regardie, *The Golden Dawn*, vol. 4 (Aries Press,
Chicago, 1940; archive.org `IsraelRegardie-TheGoldenDawn-Vol4-1940`,
pp. 270-275), *The Equinox*, vol. I no. 7 (London, 1912), Plates III and
VIII (archive.org `crowley-equinox_202110`, the file "The Equinox Vol. 1,
No. 7", leaves 241 and 246), and the redrawn colour plates of Regardie's
book in its seventh edition, edited by John Michael Greer (Llewellyn,
ISBN 978-0-7387-4399-8). Dee's table of 1584 and Raphael's reformed
table of 1587 are read from Meric Casaubon's printing of Dee's records,
*A True & Faithful Relation* (London, 1659; archive.org
`truefaithfulrela00deej`, pp. 175-188 and the "Actio Tertia", p. 15),
which comes from British Library, Cotton MS Appendix XLVI. Dee's own copy
is expected in Sloane MS 3191, ff. 52r-80v, which the Library catalogues
as the remainder of *Liber Scientiae*
([catalogue](https://searcharchives.bl.uk/catalog/040-002115575)); it
could not be read: the Library's images have been offline since its
cyber-attack of 2023 (plan 061 says what to check when they return). The
comment at the head of the repository's source file
([`tablets.json5`](https://github.com/gadicc/magickly/blob/main/packages/magick-data/src/enochian/tablets.json5))
says where each square comes from; comments do not ship in the package.

The `greer` reading is the letters as Greer's plates print them. Each is
a letter that the 1940 or the 1912 print gives in that square, as its
letter or as the smaller letter Regardie prints below it, except in one
square, Water's row 4, square 9, where Greer gives e, the letter of Dee's
1584 table and Raphael's of 1587. Greer's case and his mirrored letters
are typography. The Seniors' names, which settle some of the Golden
Dawn's choices, are cited from Regardie, *The Golden Dawn*, vol. 3 (Aries
Press, Chicago, 1939; archive.org `IsraelRegardie-TheGoldenDawn-Vol3-1939`,
p. 73), which names all twenty-four. The letters are facts, and **no
rights are asserted over them**, Greer's among them. See
[plan 061](https://github.com/gadicc/magickly/blob/main/plans/061-gd-hall.md),
"Tablet versions".

### The gods of the pyramids

**`gd/godForms.json5`** is the table of the Egyptian gods the Golden Dawn
gives each mix of elements on a servient square of the Enochian tablets, in
Israel Regardie, *The Golden Dawn*, vol. 4 (Aries Press, Chicago, 1940),
p.315 (archive.org `IsraelRegardie-TheGoldenDawn-Vol4-1940`, leaf n307):
the mix, the god, the god's name in Coptic letters and the god's station
in the Neophyte grade. Those are facts, and no rights are asserted over
them; the wording of the stations and every note are ours, under CC BY 4.0.
Nothing of the page's text is copied, and the book is treated as in
copyright ([plan 091](https://github.com/gadicc/magickly/blob/main/plans/091-regardie-golden-dawn-copyright.md)).
The Coptic was read by hand from archive.org's page image on 23 November
2026 and checked against the same gods' names in the Z documents, vol. 3
(1939; `IsraelRegardie-TheGoldenDawn-Vol3-1939`, pp.92–104), whose
differing readings `vol3` gives with their leaves. The file's header says
how the letters are given. See
[plan 095](https://github.com/gadicc/magickly/blob/main/plans/095-tablet-pyramids.md).

### Geomancy

**`geomancy/tetragrams.json5`**: what each figure means in each house
(`meanings`) is the Golden Dawn's table as Aleister Crowley printed it in
"A Handbook of Geomancy", *The Equinox*, vol. I no. 2 (London, 1909),
pp. 154-156 (archive.org `crowley-equinox_202110`, the file "The Equinox
Vol. 1, No. 2", leaves n158-n160), read from the page images. The changes
are editorial and listed cell by cell in plan 075: abbreviations spelled
out, "evil" and "ill" read "unfavourable" (or "bad" where the Equinox
pairs good with bad), and a full stop ending each entry. A figure's
`meaning` is the Equinox's where it gives one, and otherwise our own
words, from the Equinox's account or Agrippa's *Fourth Book*;
`translation` is the plain English of the figure's Latin name.

**`geomancy/houses.json5`** says what each house governs, in our own
words, from Agrippa's list in "Of Geomancy", *Henry Cornelius Agrippa
his Fourth Book of Occult Philosophy*, translated by Robert Turner
(London, 1655), pp. 9-10 (archive.org `b20458563`, leaves n34-n35), with
the matters Crowley ties to a house in the same Handbook (pp. 145, 153
and 159). The fifth and seventh houses follow Agrippa, not modern
astrology.

Both works are in the public domain, and **no rights are asserted over
the Equinox's table or anything quoted from either**; our own words and
the edits are under CC BY 4.0. Nothing in them comes from a modern
edition or essay. See
[plan 075](https://github.com/gadicc/magickly/blob/main/plans/075-geomancy-own-words.md).

### Lilly's houses

**`interpretation` in `astrology/houses.json5`** says what each of the
twelve astrological houses signifies, in our own words, from William
Lilly, *Christian Astrology* (London, 1647), Book I, chapter VII, "Of
the twelve Houses, their Nature and signification", pp. 50-56
(archive.org `b30338724`, leaves n84-n90). The houses follow Lilly, not
modern astrology: the father is the fourth house's and the mother the
tenth's. Lilly died in 1681 and his book is in the public domain; our
words are under CC BY 4.0, and nothing in them comes from a modern book
or website.

**`motto`** is not from Lilly. Its Latin is the mnemonic verse as
usually quoted, a word for each house: "Vita, lucrum, fratres, genitor,
nati, valetudo, uxor, mors, pietas, regnum, benefactaque, carcer". We
found no public-domain printing of it to cite. The table the file
replaced had *Iter* for the ninth. The English renderings are ours.

### The Second Knowledge Lecture

**`terms` in `alchemy/terms.json5`** are the Golden Dawn's own short
phrases for each alchemical term, from its Second Knowledge Lecture, one
of the Zelator (1=10) grade papers, as Israel Regardie printed it in
*The Golden Dawn*, vol. 1 (Aries Press, Chicago, 1937), pp. 119-120
(archive.org `IsraelRegardie-thegoldenDawn-vol1-1937`, leaves
n110-n111), with small changes of form. They are the Order's wording of
the 1880s and 1890s, not Regardie's, and each is a few words long.
**No rights are asserted over them**, so the CC BY 4.0 grant does not
cover them; the choice and arrangement of the table are ours.
