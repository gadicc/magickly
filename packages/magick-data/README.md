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
  they compile to.
- **The data is [CC BY 4.0](./LICENSE-DATA.txt):** the JSON5 sources,
  everything the build emits from them, and the Enochian Keys, a text
  written as TypeScript. Use it anywhere, including commercially, as long as
  you credit [magick.ly](https://magick.ly).

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

It is not published yet. When it is:

```sh
npm install magick-data
```

It has no runtime dependencies.

A maintainer publishing it must make the tarball with `pnpm pack` or
`pnpm publish`, never `npm publish` from this directory: the published
`exports` come from `publishConfig.exports`, which only pnpm applies, and
npm would publish the `exports` that point at `./src/*.ts`. A tarball pnpm
has packed can then be published by either.

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
| `enochianTablet` | 2 | `./enochian/tablets` |
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

## Texts that are not tables

- `magick-data/enochian/keys`: the Enochian Keys, word by word, in the
  original, transliterated and in English.
- `magick-data/kabbalah/seventyTwoAngels/text`: Lenain's entries on the
  seventy-two genii in full, in French and in English, loaded on demand.
- `magick-data/kabbalah/seventyTwoAngels/derived`: what Lenain's four tables
  compute for each genius: degrees, days, minutes, sign, planet and choir.
- `magick-data/kabbalah/lenain/volume`, `…/notes`, `…/pieces` and
  `…/firstTable`: Lenain's *La Science Cabalistique* leaf by leaf, the
  editorial apparatus, the text folded into paragraphs that run across
  leaves, and his first table reconstructed.
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

Most of this is correspondences, which belong to nobody. Two sets are derived
from identified works and are worth naming:

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

**`keyOfSolomon` in `astrology/planets.json5`**, on the seven classical
planets, is what *The Key of Solomon the King* says each planet's days and
hours serve for, in S. L. MacGregor Mathers' translation (London, 1888),
Book I, chapter II, p. 12: his sentences verbatim, checked against
sacred-texts' transcription of his edition. Mathers died in 1918, so the
translation is in the public domain and **no rights are asserted over the
text**. See
[plan 039](https://github.com/gadicc/magickly/blob/main/plans/039-correspondence-tables.md).
