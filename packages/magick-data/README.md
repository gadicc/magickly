# magick-data

Magickal correspondences and reference data — the sephirot, the planets, the
zodiac, the Hebrew and Enochian letters, the Golden Dawn grades, the
geomantic figures and the rest — as 29 tables of plain rows, a graph that
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
  ([Sources](#sources) says what of the Keys is ours to license). Use it
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
  loads the same 93 files, the lib's included.
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

It holds 26 of the 29 tables: `enochianTablet`, `christianChoir` and
`seventyTwoAngel` link to nothing and nothing links to them, so they are
left out and read through their own subpaths. Reading one field costs 7,824
instantiations, and a four-hop read 17,621 (smoke test); the bundle is
17,290 bytes gzipped (`dc6f732`). Whatever imports it carries all 26
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
| `hebrewLetter` | 27 | `./hebrewLetters` |
| `enochianLetter` | 21 | `./enochian/letters` |
| `enochianTablet` | 5 | `./enochian/tablets` |
| `tetragram` | 16 | `./geomancy/tetragrams` |
| `geomanticHouse` | 12 | `./geomancy/houses` |
| `gdGrade` | 12 | `./gd/grades` |
| `gdDegree` | 3 | `./gd/degrees` |
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
`magick-data/tables` exports all 29 raw, with the `Tables` and `TableName`
types, and `magick-data/types` and `magick-data/rows` the row types derived
from the tables and the graph.

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
  planet's `spiritId`.
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
  leaves, and his first table reconstructed.
- `magick-data/astrology/kameas`: the planetary kameas (magic squares),
  Saturn's 3 × 3 to the Moon's 9 × 9, keyed by the planet table's ids
  (`kameas.luna`) and frozen, row by row from the top. They are computed
  rather than written out, except the Sun's ([Sources](#sources)), so there
  is no JSON for them; `oddKamea(n)` and `doublyEvenKamea(n)` are the
  constructions, for an odd order from 3 or a multiple of 4, up to
  `MAX_KAMEA_ORDER` (100). Any other order is a `RangeError`.
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
- `magick-data/enochian/tabletNotes`: notes on the Enochian tablets: each
  version, where it comes from and how it differs from each of the others
  (`versionNote(id)`), how the versions differ in general, each tablet,
  and particular squares, by row and column from 0 as the readings count
  them (`squareNote(id, row, column)`), with `sourceText` and `sourceUrl`
  for the works cited. The prose is ours, under CC BY 4.0 like the tables;
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
under `latest`. The first version, a release candidate published by hand
under `next`, may still be what `latest` names until 0.1.0 replaces it:
the registry points `latest` at a package's only version.

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
| `alchemy/elementals.json5` | [Correspondences](#correspondences) |  |
| `alchemy/elements.json5` | [Correspondences](#correspondences) |  |
| `alchemy/symbols.json5` | [Correspondences](#correspondences) |  |
| `alchemy/terms.json5` | [Correspondences](#correspondences); the source of `terms` is not recorded |  |
| `astrology/houses.json5` | [Correspondences](#correspondences); `interpretation` is ours, following [Lilly](#lillys-houses); `motto.la` is the mnemonic verse as usually quoted, not from Lilly, and `motto.en` our rendering of it ([Lilly's houses](#lillys-houses)) |  |
| `astrology/planets.json5` | [Correspondences](#correspondences); `keyOfSolomon` from [the Key of Solomon](#the-key-of-solomon) |  |
| `astrology/zodiac.json5` | [Correspondences](#correspondences) |  |
| `body/parts.json5` | [Correspondences](#correspondences) |  |
| `chakras.json5` | [Correspondences](#correspondences) of the seven-chakra system; the file cites Wikipedia's "Chakra" article |  |
| `enochian/keys.json5` | [The Enochian Keys](#the-enochian-keys) |  |
| `enochian/letters.json5` | [Correspondences](#correspondences); the source of `pronounciation` and `gematria` is not recorded |  |
| `enochian/tabletNotes.json5` | Ours: notes on [the Enochian tablets](#the-enochian-tablets), citing their sources |  |
| `enochian/tablets.json5` | [The Enochian tablets](#the-enochian-tablets) |  |
| `gd/degrees.json5` | [Correspondences](#correspondences) |  |
| `gd/grades.json5` | [Correspondences](#correspondences) |  |
| `geomancy/houses.json5` | [Geomancy](#geomancy) |  |
| `geomancy/tetragrams.json5` | [Geomancy](#geomancy) |  |
| `hebrewLetters.json5` | [Correspondences](#correspondences) |  |
| `kabbalah/angelicOrders.json5` | [Correspondences](#correspondences) |  |
| `kabbalah/archangels.json5` | [Correspondences](#correspondences) |  |
| `kabbalah/christianChoirs.json5` | [Lenain](#lenain): the nine choirs of Pseudo-Dionysius, in his order and with his French |  |
| `kabbalah/fourWorlds.json5` | [Correspondences](#correspondences) |  |
| `kabbalah/godNames.json5` | [Correspondences](#correspondences) |  |
| `kabbalah/kerubim.json5` | [Correspondences](#correspondences) |  |
| `kabbalah/lenain/apparatus.json5` | [Lenain](#lenain) |  |
| `kabbalah/lenain/evidence.json5` | [Lenain](#lenain) |  |
| `kabbalah/lenain/pages.json5` | [Lenain](#lenain) |  |
| `kabbalah/paths.json5` | [Correspondences](#correspondences) |  |
| `kabbalah/sephirot.json5` | [Correspondences](#correspondences) |  |
| `kabbalah/seventyTwoAngels.json5` | [Lenain](#lenain) |  |
| `kabbalah/seventyTwoAngelsText/en.json5` | [Lenain](#lenain) |  |
| `kabbalah/seventyTwoAngelsText/fr.json5` | [Lenain](#lenain) |  |
| `kabbalah/souls.json5` | [Correspondences](#correspondences) |  |
| `kabbalah/tribesOfIsrael.json5` | [Correspondences](#correspondences) |  |
| `materia/scents.json5` | [Correspondences](#correspondences) |  |
| `materia/stones.json5` | [Correspondences](#correspondences) |  |
| `graph.json` | Ours: how the tables link, built from `src/graph.ts` |  |

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
1909. Lenain died in 1877 and Papus in 1916, so **no rights are asserted
over either text**.

What is offered under CC BY 4.0 is the work done on top: the English translated
from that French, the choice and arrangement of fields, the editorial apparatus,
and the corrections. No rights are claimed where none subsist. Nothing in it
draws on any modern published translation of the work — the point of the
exercise was a copyright-free rendering of the same public-domain material.

The Hebrew names are given both as Lenain points them and as bare letters.
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
the standard constructions, which give exactly his squares, and the Sun's,
of order 6, is written out; the tests check that every square is magic,
that each starts with his first row, and that Saturn's and Jupiter's are
his row by row. See
[plan 061](https://github.com/gadicc/magickly/blob/main/plans/061-gd-hall.md).

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
in Sloane MS 3191 could not be read: the Library's images have been
offline since its cyber-attack of 2023 (plan 061 says what to check when
they return). The file's comment says where each square comes from. The
letters are facts, and **no rights are asserted over them**. See
[plan 061](https://github.com/gadicc/magickly/blob/main/plans/061-gd-hall.md),
"Tablet versions".

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
