# Data package

Plan, 3 October 2026, for step 4 of
[plan 032](032-data-layer.md#migration). It was drafted as 048; 047 to 051
went to the editor work the same day. `data/` becomes
`magick-data`, a pnpm workspace package in this repository,
consumed by the app exactly as anyone else would consume it and publishable
as a projection of it. Read [current status](000-current-status.md) and
plan 032 first. The design was settled between 22 September and 3 October
and is recorded here rather than argued again; a measurement spike on
1 October tested it and its structural findings stand, but every number
below was taken again at `main` = `dc6f732` and is labelled with that SHA.
Nothing is implemented yet, and nothing is published by this plan.

## Where it stands at `dc6f732`

`data/` holds **29 tables and 378 rows**, three tables more than the spike
saw: `bodyPart` (12 rows, in a new `body/`) and `stone` (12) and `scent`
(11), in a new `materia/` ([plan 039](039-correspondence-tables.md)). Beside
the tables it holds texts that are not tables — the Enochian dictionary
(1,911 words) and Keys, Lenain's edition (`lenain/pages`, `evidence`,
`apparatus` and the two translations of the seventy-two) — and the modules
that read them: `seventyTwoAngelsDerived.ts`, `angelSlugs.ts` and
`lenain/{volume,notes,pieces,firstTable}.ts`.

Twenty-three tables have a typed module (`kabbalah/Sephirot.ts` and the
like); six do not, and each needs one for its subpath: `gdDegree`, `soul`,
`chakra`, `bodyPart`, `stone` and `scent`.

The app reaches into `data/` from **58 files on 105 import lines**: 86 as
`@/../data/…`, 15 as a relative `../…/data/…` (the five
`scripts/seventyTwoAngels/` files among them) and 4, in three files, through
the `@magick-data/*` alias. Beyond imports, `tests/renderWithTables.ts` reads
`data/dist` by path, five `scripts/seventyTwoAngels/` files read or write
JSON5 sources by path, five links on the site point at `data/` on GitHub
(two on `/about`, two on the seventy-two angels page, and the
`/data/enochian/tablets.json5` that `tablets.tsx:71` hands to
`OpenSource`), and 28 Markdown links
in `plans/` point at `../data/…` (21 in plan 032, 6 in plan 036, 1 in
plan 039).

What the data layer costs the type checker today, each run twice with
identical results (`tsc --noEmit --incremental false --extendedDiagnostics`,
TypeScript 6.0.3, Node 24.18.0):

| At `dc6f732` | Files | Instantiations |
| --- | ---: | ---: |
| The whole repository, after `next typegen` (8.4–8.8 s check, 0 errors) | 5,636 | 2,079,002 |
| `data/rows.ts` alone | 130 | 62,087 |
| The barrel, `data/data.ts`, alone | 132 | 66,096 |

The 29 tables are 172,165 bytes of JSON. Plan 032's "55,608 instantiations
*below* `main`" for step 3a was a saving, not a total; the barrel's own cost
was 58,736 at `d25f8d9` and is 66,096 now, the three new tables and their
links accounting for the difference. The last two rows were taken again at
`e42c3cf`, where `data/` is unchanged, and matched.

### Corrections to what was carried into this plan

Found while writing it, each checked against the tree rather than taken from
the spike or the brief:

- **The `@magick-data/*` alias is used on four lines in three files**, not
  two: `planet/[id]/page.tsx` (twice), `planet/[id]/Planet.tsx` and
  `planetary-hours/page.tsx`. All four become `magick-data/…`.
- **There are 28 plan links into `data/`**, not about 26.
- **Renaming `tolPath` moves the Tree of Life's inputs hash.** Decision 8
  below holds that the renames touch keys, interfaces and call sites only,
  which is true of the data and not of the render identities
  ([below](#render-identities)).
- **The Shewbread inputs fix needs no new selector form.** A spec's fields
  are already dotted paths resolved through links ([below](#render-identities)).
- **`.js` specifiers break both bundlers when they compile the package from
  source**, which decision 9 has them do; the sources write `.ts` instead
  ([below](#specifiers)). Found by the review, reproduced here.
- **The dictionary's generated declaration imports its type from the
  sources**, across from `dist/`, which a published layout without `src/`
  cannot keep ([below](#what-the-generator-states)).
- **A scoped `assemble()` is a bundle saving, not a type saving**, and
  sephirah's one hop is 12 tables now, not 9
  ([below](#what-this-does-not-do)).
- **The Tree's profile is `magickli-tree-image-outlines-v4`**, since
  2 October, not v3.

## Decisions

Settled by the owner, 22 September to 3 October. The numbering is this
plan's; plan 032's decisions 1–16 stand beside them.

1. **The package lives at `packages/magick-data/`.** The 28 Markdown links
   into `data/` are rewritten so they resolve; prose describing what `data/`
   was is left as written, and plan 032 gains a line at its head saying where
   the layer went.
2. **It is named `magick-data`, unscoped** (unpublished on npm, checked). A
   later `magick-components` follows the same pattern; it is kept in view and
   not built here.
3. **Two licences:** MIT for the code and CC BY 4.0 for the data, both files
   shipped, `"license": "SEE LICENSE IN LICENSE.txt"`. An AGPL `assemble()`
   would make the package unusable to anyone who is not themselves AGPL,
   which is the whole audience. The app stays AGPL-3.0-or-later.
4. **The root export `"."` is the assembled barrel, default export only.**
   `export const { geomanicHouse, tetragram } = data` goes; its four call
   sites already alias on import. Named exports on a module that cannot be
   tree-shaken are the worst of both.
5. **`magick-data/tools` re-exports `assemble`, `problemsOf`,
   `accessorName`, `rowOf` and `pathTarget`**, and each keeps its own subpath
   too. `pathTarget` was first ruled out of the barrel because it imports every
   table; that was measured and found wrong, since both bundlers drop it
   entirely from a `tools` import that does not use it (0 bytes,
   0 instantiations). `graph`, `types` and `rows` stay on subpaths of their
   own: types in a value barrel invite `import { SephirahRow }` without
   `type`, which `isolatedModules` rejects.
6. **The JSON still ships, for consumers that are not JavaScript:**
   `"./json/*.json": "./dist/*.json"` and `"./graph.json"`. The wildcard is
   scoped to `.json` so the data files are reachable without every emitted
   module becoming public API.
7. **The build emits, per table, a generated `.js` and a generated
   `.d.ts`.** The module's value is `JSON.parse` of a string literal, as
   `data/build.mts` already emits the dictionary, and the declaration *states*
   the row type rather than deriving it from a `.json` import. No `.json` type
   import remains anywhere in the published artefact. This is the design, not
   a fallback ([below](#why-generated-declarations)). It also makes `kind` a
   literal union, so `PlanetId` is derived, which closes the `as const`
   follow-up plan 032 recorded.
8. **Three tables are renamed now, before anything is published,** since a
   rename is a major version afterwards: `geomanicHouse` → `geomanticHouse`
   (a misspelling), `house` → `astrologicalHouse`, `tolPath` →
   `treeOfLifePath`. No data field is named `tolPathId`, `houseId` or the
   like — the only links into these tables are `tolPath`'s own
   `nextId`/`prevId` mirrors — so the renames touch table keys, row
   interface names and call sites, and no JSON5. One consequence the decision
   did not name is [below](#render-identities): the Tree's inputs hash moves.
9. **The app depends on `magick-data` as `workspace:*` and imports bare
   `magick-data/…` specifiers**, exactly what an external consumer writes.
   The `@magick-data/*` alias goes from `tsconfig.json` and
   `vitest.config.mts`; `@magick-components/*` stays until that package
   exists; `src/OpenSource.tsx`'s `url()` maps the new specifier to its path
   on GitHub (no caller passes one today; the one `data/` path a caller does
   pass is rewritten by hand). The package's `exports` point at its
   TypeScript sources for development, compiled by Next through
   `transpilePackages`, and
   `publishConfig.exports` swaps them for the built output on publish. A gate
   step packs the tarball, installs it into a fixture and type-checks and
   loads a smoke import, so the published shape is proved on every run.
10. **The app never consumes the published package.** It is always
    `workspace:*`; the tarball is a projection for others. CI publishes when
    the package's `version` changes on `main`, by a human bump, because no
    diff can tell a rename from a correction. **Nothing is published in this
    plan.** The names `magick-data` and `magick-components` are to be
    reserved at 0.0.0, which is outward-facing and effectively irreversible,
    so the owner is asked at the moment it is ready to do.
11. **The README is rewritten:** what the package is; the licence split;
    installing it; the three doors (the barrel, one raw table, a scoped
    `assemble()`); a table of every table with its row count and subpath;
    the graph's vocabulary; the helpers; the texts that are not tables; the
    semver rules; and the Lenain provenance `data/README.md` already carries.
    Its counts are asserted by a test, so they cannot rot.
12. **`data/dev.mts` moves to the app**, since it spawns `next dev` and the
    package must not know Next exists. **`data/pentagram.svg` moves to
    `assets/`**; nothing references it and the app serves
    `public/pentagram.png`.
13. **The checks stay in the package directory but out of `exports` and
    `files`:** `integrity.ts`, `schemas.ts`, `coverage.ts`,
    `duplicateKeys.ts` and `check.ts`. They are what pull in valibot and
    json5, and leaving them unpublished keeps the package's published runtime
    dependencies at **zero**. Exposing them later as `magick-data/check`, with
    valibot as an optional peer, is a clean minor.
14. **One root vitest and one globalSetup.** The coverage `include` entries
    naming `data/*.ts` are repointed. `pnpm data:build` and `pnpm data:check`
    stay as root scripts that delegate to `pnpm --filter magick-data`.
15. **Turbopack is verified in the first gated commit.** Nothing has measured
    it, and webpack — the app's own production bundler — refused the spike's
    emit outright, so this is a real unknown.
16. **`magickli` → `magickly` goes no further than `package.json`'s `name`.**
    The cosmetic half is done, and `git grep` finds no `master` branch link
    left anywhere, so the status page's TODO about `master` links on the about
    page and in `OpenSource.tsx` is stale and is struck rather than acted on.
    Every other `magickli` is a persisted or externally provisioned
    identifier, and [below](#magickli-stays) says why each stays.

## Why generated declarations

A published `.d.ts` is not a resolved type: it is source the consumer's
compiler resolves again. The declaration `tsc` emits for today's
`kabbalah/Sephirot.ts` reads `import rows from
"../dist/kabbalah/sephirot.json"` and `type SephirahId = keyof typeof rows`.
A consumer whose own `tsconfig` lacks `resolveJsonModule: true` cannot
resolve that import; `skipLibCheck: true`, which is the Next default and
nearly everyone's, swallows the error; and every row type silently becomes
`any`. It was proved with genuinely wrong code and no `@ts-expect-error`
scaffolding, through the barrel and through one table's subpath alike: with
the flag, five errors, among them `possibly 'undefined'` on an optional link
chain; without it, `tsc` exits 0 with none. Nothing in a package can set a
consumer's compiler flags.

Declaring the type in the generated `.d.ts` removes the `.json` reference
and, with it, three problems at once: this hole; Node 24's refusal to load a
JSON import without `with { type: "json" }`, which made the spike's artefact
unloadable outside a bundler; and the hazard of a `.ts` resolving ahead of
its `.d.ts`. The spike measured one table this way: the same zero
instantiations for a field read as the JSON-import form, thirty fewer files
in the consumer's program, a smaller bundle, loadable by Node, and the
negatives still errors with `resolveJsonModule` on or off.

It was then built for all 29 tables at `dc6f732`: a throwaway generator
emitting the declarations [described below](#what-the-generator-states), the
six missing typed modules, `.js` on every relative specifier (the compiled
form; [below](#specifiers) for what the sources write), and the
compiled modules in `lib/` with no `.ts` beside them — 41 subpaths. The
generated type of every table was checked against its JSON import in both
directions: each is assignable to the other for all 29, and the key sets are
equal for the 26 object tables. The three array tables (`house`,
`christianChoir`, `seventyTwoAngel`) differ only in that a `readonly` array
lacks the mutating methods; nothing in the app or the scripts mutates them,
and commit 3's gate is what proves it. A consumer
compiled with the repository's options, each case run twice with identical
results:

| Consumer, at `dc6f732` | Files | Instantiations |
| --- | ---: | ---: |
| An empty file | 91 | 0 |
| One table's subpath, one field read | 125 | 0 |
| The same, and `rowOf` from `./tools` | 130 | 5 |
| The barrel, one field read | 125 | 7,740 |
| A four-hop read through the barrel | — | 17,537 |
| A scoped `assemble()` of sephirah's one hop, 12 tables | 141 | 11,588 |
| A scoped `assemble()` of two tables | — | 5,637 |
| `PlanetId` derived and checked against the twelve | — | 97 |
| The barrel with `skipLibCheck: false` and `lib: ["es2022"]` | 92 | 63,928 |
| One table and `rowOf` the same way | 97 | 63,229 |

Against the 66,096 the barrel costs the repository from source, a consumer
reading the published declarations pays 7,740. Nine negatives — a field no
row has, an unknown id, an optional link read without `?.`, an assignment
into a frozen row, a link outside a scoped `assemble()` and four more — are
all still errors with `resolveJsonModule` on **and** off, which is the hole
closed; stripped of their directives, both modes give exactly nine errors.
The artefact loads in Node 24 through the barrel, one table, `./tools` and
the dictionary, and a `nodenext` ESM consumer type-checks.

Three things a reader of the earlier spike should not carry forward. A
table's subpath now brings 125 files where the one-table prototype brought
92, because each typed module imports `types`, which reaches `tables` and so
every table's declaration; the instantiations stay at zero. The declarations
are 161,910 bytes over 71 files, 111,038 of them generated, against the
spike's 49,172: the row types are written out rather than read from JSON,
which is the point. And `skipLibCheck: false` costs about 64,000 on a clean
`es2022` lib whichever door is used; the spike's 88,758 was taken with
`["esnext", "dom"]` and is not comparable. One README line says so.

Bundles of the artefact, raw / minified / minified and gzipped, in bytes:

| At `dc6f732` | esbuild 0.28.2 | webpack 5.111.0 |
| --- | --- | --- |
| The barrel, one field | 71,693 / 63,309 / 17,290 | 85,478 / 60,838 / 17,216 |
| One table (`sephirot`) | 5,476 / 5,261 / 1,650 | 6,335 / 5,087 / 1,646 |
| Sephirah's one hop, scoped, 12 tables | 38,216 / 30,619 / 8,838 | 45,367 / 28,878 / 8,696 |
| `rowOf` from `./tools` | 190 / 87 / 101 | 1,310 / 74 / 90 |
| `pathTarget`, used | 140,696 / 133,095 / 35,690 | 166,428 / 128,049 / 35,497 |
| The dictionary | 238,944 / 238,712 / 29,931 | 276,170 / 238,541 / 30,010 |

One table is 1,650 bytes gzipped where the JSON-import form was 1,752, and
51 bytes larger minified: a string literal compresses better than an object
literal and minifies worse.

## Design

### Layout

```
packages/magick-data/
  package.json          exports → src/*.ts; publishConfig.exports → lib/, dist/
  README.md
  LICENSE.txt           the split, and the MIT licence for the code
  LICENSE-DATA.txt      CC BY 4.0, which is data/LICENSE.txt today
  tsconfig.json         the package's own check: every source and test
  tsconfig.build.json   the publish emit: the exported entry points only
  src/                  everything data/ holds now, JSON5 beside its module
  dist/    (generated)  per table .js + .d.ts + .json; graph.json; the texts
  lib/     (generated)  the compiled modules, publish only
```

`src/` and `lib/` sit at the same depth, so a relative specifier such as
`../../dist/kabbalah/sephirot.js` reaches the same file from
`src/kabbalah/Sephirot.ts` and from `lib/kabbalah/Sephirot.js`. That is the
spike's condition for emitting into an output directory at all; `dist/`
inside `src/` would not satisfy it. `files` is `lib`, `dist`, the README and
the two licences, so no `.ts` other than a `.d.ts` is ever in the tarball,
and `lib/` holds only what the exports reach: `tsconfig.build.json` lists
the entry points in `files` and `tsc` follows their imports, so the checks
and the tests are never compiled into it, while `tsconfig.json` includes
everything and emits nothing. `dist/` and `lib/` are both gitignored, which
`biome` honours through `vcs.useIgnoreFile`, and the root `tsconfig`
excludes both, so neither the app's program nor the linter reads generated
output.

The package is `"type": "module"`, so `build.mts` becomes `build.ts` (the
`.mts` was only ever there because the repository is CommonJS) and
`import.meta.url` is native rather than shimmed by tsx.

### The exports map

| Subpath | What it is |
| --- | --- |
| `.` | the assembled barrel, default export only |
| `./tools` | `assemble`, `problemsOf`, `accessorName`, `rowOf`, `pathTarget` |
| `./assemble`, `./rowOf`, `./pathTarget` | each helper on its own |
| `./tables` | every table raw, and the `Tables` and `TableName` types |
| `./graph`, `./types`, `./rows` | the graph as a module, with the `GraphSpec`, `TableSpec` and `LinkSpec` types its consumers need; the row types; the named row interfaces |
| one per table, 29 | the raw rows and their types: `./kabbalah/sephirot`, `./astrology/planets`, `./materia/stones` … |
| `./enochian/dictionary`, `./enochian/keys` | the two Enochian texts |
| `./kabbalah/seventyTwoAngels/derived`, `./kabbalah/seventyTwoAngels/text`, `./kabbalah/lenain/*` | Lenain's edition and what is derived from it |
| `./json/*.json`, `./graph.json` | the JSON, for a reader that is not JavaScript |

A per-table subpath is named after its file, not its table: the paths read
as the domain does (`./geomancy/houses`), and the renames in decision 8
leave them alone. The README's table pairs each subpath with its table name.

`./kabbalah/angelSlugs` is not in the map: a slug is the app's URL scheme,
a permalink of `magick.ly`'s, not a fact about the data, so `angelSlugs.ts`
moves to the app beside the routes that use it
([decided after the review](#decided-on-3-october-after-the-review)). The
Enochian dictionary's subpath is in the map for the app and absent from the
published one, for the reason given there.

### Specifiers

The spike found that `module: "esnext"` emits extensionless relative
specifiers, which Node and webpack both refuse in compiled output, so the
published JavaScript must carry `.js`. The first draft of this plan wrote
`.js` in the sources too, as TypeScript's documentation suggests. **The
adversarial review showed that cannot work here, and it was reproduced:** in
development the package's `exports` point at its TypeScript, which Next
compiles, and on Next 16.3.5 *neither* bundler resolves a `.js` specifier to
a `.ts` file. A minimal app whose `page.tsx` imports `./y.js` beside a
`y.ts` fails `next build --turbopack` and `next build --webpack` alike with
`Module not found: Can't resolve './y.js'`. webpack appends each extension
to the whole request (`y.js.ts`) rather than substituting it, and the only
remedy, `experimental.extensionAlias`, is webpack's alone: it is read once,
at `node_modules/next/dist/build/webpack-config.js:591`, and Turbopack
ignores it.

So the sources name the file they mean: **every relative specifier in the
package ends in `.ts`**, about 55 of them, and the package's `tsconfig` sets
`rewriteRelativeImportExtensions`, so `tsc` writes `.js` into the emitted
JavaScript. The same minimal app with `./y.ts` builds under both bundlers
with no resolver option at all, and the review found the same for a
workspace package compiled from source through `exports`. vitest and tsx
resolve `.ts` specifiers, from CommonJS and ES modules alike. The root
`tsconfig.json` type-checks the package's sources too, since the app imports
them, so it takes `allowImportingTsExtensions` (it is `noEmit` already);
without it Next's type-check stops at TS5097.

What the emit does not rewrite is the declarations: on TypeScript 6.0.3,
`lib/*.js` gets `./assemble.js` and `lib/*.d.ts` keeps `./assemble.ts`.
A consumer resolves those correctly under `bundler`, `node16` and
`nodenext` (measured on 6.0.3, with the real error reported rather than an
`any`), and Node loads the JavaScript through `exports`. It is unusual in a
published package, and a much older compiler may not follow it, so the
README states the TypeScript the smoke test runs; a post-emit rewrite of the
declarations to `.js` is the remedy if a consumer ever reports one, and is not
built speculatively.

The generated table modules are real `.js` files in `dist/`, so the typed
modules import them as `../../dist/kabbalah/sephirot.js` from commit 3 on,
which every tool resolves to that file without consulting an extension
order.

### What the generator states

A table's declaration is the type TypeScript would infer from its JSON —
each key with that row's own structural type, an array table as a
`readonly` array of the union of its element shapes, primitives widened —
with every property `readonly`, and **one** difference: a field whose
schema in `schemas.ts` is a `v.picklist` is stated as the row's literal
value. That is how `planet.kind` becomes `"planet"` on the twelve planets and
`"sphere"` on the three spheres, row by row, which is what lets

```ts
type PlanetId = {
  [K in PlanetKey]: (typeof rows)[K]["kind"] extends "planet" ? K : never;
}[PlanetKey];
```

replace the twelve written out by hand in `PLANET_IDS`, and the integrity
check that held that list to the data goes with it. `PLANET_IDS` itself
stays, derived at runtime from the rows, because `src/study/sets.test.ts`
reads it. `zodiac.quadruplicity`, `gdGrade.orderId`, `heSource` and the
other picklists become literals by the same rule.

The picklists are the source because they already are the closed fields:
`pnpm data:check` holds every row to them, so the literal a declaration
states cannot disagree with the data that passed. Literals everywhere — an
`as const` of the whole table — were not considered: they are what made a
JSON import of the dictionary cost 19,300 types. The generator reads the
schemas at build time, so valibot is a dependency of the build and of
nothing published.

`types.ts` and `rows.ts` are unchanged by this: they derive from
`typeof tables[T]`, whatever declared it.

The texts that are not tables — the dictionary, Lenain's pages, evidence and
apparatus, and the two translations — are emitted the same way, each declared
`unknown`, and the hand-written module that wraps each one states its type
with a cast, as `lenain/volume.ts` already does (`pages as Leaf[]`). Today's
dictionary declaration names `EnochianDictionary` by importing it across
from `dist/` into the sources, which the publish layout cannot keep, since
`src/` is not shipped. Casting `unknown` costs no types.

### `structuredClone`

`assemble()` clones with `structuredClone`, which TypeScript declares only
in `lib.dom.d.ts` and in `@types/node`. The package's `tsconfig` takes
`lib: ["es2022"]` and `types: ["node"]` — the build and the checks need
Node's types anyway, and `@types/node` declares `structuredClone` as a global
(`worker_threads.d.ts`) — and no DOM. The prototype at `dc6f732`, built
without Node's types, still needed `"dom"`; this is the setting that drops
it, and commit 4's emit proves it. The emitted declarations do not mention
`structuredClone`, so a consumer needs nothing; the README says the runtime
needs it, which is Node 17 and every browser since 2022.

### `isolatedDeclarations`

The package's emit configuration turns it on. Over the whole of `data/` at
`e42c3cf` (identical to `dc6f732`), tests aside, with the package's
`lib: ["es2022"]` and `types: ["node"]`, it reports **68 errors and nothing
else**:

| Where | Errors | What |
| --- | ---: | --- |
| `tables.ts` | 29 | TS9016, the inferred `tables` object; gone once `Tables` is a `type` alias |
| `seventyTwoAngelsDerived.ts` | 14 | missing return types (TS9007, TS9013) |
| `lenain/volume.ts`, `pieces.ts`, `notes.ts`, `firstTable.ts` | 12 | the same |
| `data.ts`, `graph.ts`, `assemble.ts`, `astrology/Planets.ts` | 6 | the barrel's inferred `data`, `as const satisfies` twice, `accessorName`'s return type |
| `angelSlugs.ts` | 2 | moves to the app |
| `build.mts`, `schemas.ts`, `coverage.ts` | 5 | not published; outside the emit configuration |

The first spike's "30, then 4" and the prototype's 3 covered the tables and
helpers only, not the texts' modules. Every one is an annotation, and the 26
in shipped modules are written in commit 4. The `as const satisfies` keeps
its check through a type-level assertion:

```ts
export const graph = { /* … */ } as const;
type Assert<T extends GraphSpec> = T;
export type _GraphIsSpec = Assert<typeof graph>;
```

The point is not a faster emitter. It is that the 91,210-byte `tables.d.ts`
the spike found — every table's structure written out inline because
`tables` was an inferred object — cannot come back: an inferred export is a
TS9016 error under this flag. `Tables` must be a `type` alias, not an
interface; an interface has no implicit index signature and breaks both
`assemble()`'s implementation signature (TS2394) and `pathTarget()`'s
default (TS2322).

### The licences

`LICENSE.txt` says which files are which, by path, and carries the MIT
licence; `LICENSE-DATA.txt` is CC BY 4.0, today's `data/LICENSE.txt`. Code
is the hand-written modules; data is the JSON5 sources, everything the build
emits from them, and the texts written as TypeScript (`enochian/Keys.ts`).
The repository's root `LICENSE.txt` stays AGPL, and the root README gains a
line that `packages/magick-data` is licensed by its own files.

### The checks and the watcher

`integrity.ts`, `schemas.ts`, `coverage.ts`, `duplicateKeys.ts`, `check.ts`
and `build.ts` move with the rest and are reached by nothing in `exports`.
The package declares `json5` and `valibot` as `devDependencies` at the
versions the root already resolves, so the lockfile gains the importer and
no new package.

`scripts/dev.mts` (from `data/dev.mts`) runs the package's build, waits for
it, and starts the package's watcher beside `next dev`, as before. It spawns
the watcher as `process.execPath --import tsx
packages/magick-data/src/build.ts --watch`, directly, not through
`pnpm --filter`: the wrapper exists so that the pair die together, and a
pnpm process between it and the watcher is one more parent whose signal
forwarding nobody has checked. The watcher now also watches
`graph.ts` and `schemas.ts`, and on a change to either re-runs the whole
build in a fresh child process: an ES module cannot be imported twice, and
with generated declarations the schemas decide what the declarations state,
so both are inputs to `dist/` now, not just the graph.

## What this does not do

- **No pre-assembled JSON.** The assembled result is a cyclic object graph
  (`sephirah → archangel → sephirah`), which JSON cannot hold; that is why
  `assemble()` is a function the consumer runs, and why the build cannot run
  it for them.
- **No tree-shaking of `assemble()`.** `sideEffects: false` is true of every
  module (audited by the spike: nothing writes a global, and
  `window.magickData` is gone), but `assemble()` over a set of tables is one
  call no bundler can split. What bounds a bundle is the subpath imported:
  one table, a scoped `assemble()`, or the barrel.
- **No scoping by closure.** At `dc6f732` the graph has one connected
  component of 22 tables and 7 tables linked to nothing (`alchemyTerm`,
  `christianChoir`, `enochianLetter`, `enochianTablet`, `fourWorlds`,
  `geomanicHouse`, `seventyTwoAngel`). Sixteen tables have a closure of one —
  those seven and nine sinks — and the other thirteen a closure of 20, or 21
  for `house` and `kerub`, against the barrel's 26. Scoping to a closure
  saves almost nothing. One hop is what a page that shows one entity reads:
  12 tables for `sephirah` (9 when the spike measured it, before the body
  parts, stones and scents), 9 for `planet`, 5 for `gdGrade`, 4 for
  `tetragram`, 3 for `tolPath`.
- **No claim that a scoped `assemble()` is cheaper to type.** It is cheaper
  to ship — sephirah's one hop is 8.7 KB gzipped against the barrel's
  17.2 KB, and two tables a fraction of that — but it costs the type checker
  *more* than the barrel, 11,588 instantiations against 7,740, because its
  rows are the mapped type a partial scope must be while the barrel's are
  named interfaces ([plan 032](032-data-layer.md#step-3a)). The spike's
  "7.4× smaller" and "about 25 % fewer types" were both a two-table scope,
  and the README says what each door costs rather than ranking them.
- **No published checks.** Decision 13.
- **No `magick-components`.** Decision 2; and the component explorer in
  [follow-ups](#follow-ups) argues for building it after that package.

## Render identities

Two images' identities move in this plan, and nothing else's. Both are
asserted in `src/render/registry.test.tsx`'s pinned inputs hashes, with a
comment in the style of the ones already there, and both leave every pinned
byte count and byte hash where it is.

- **The Tree of Life, from the rename.** `resolveDataInputs` writes each
  group's table name into the text it hashes, and the Tree's spec reads
  `tolPath`. Renaming the table to `treeOfLifePath` changes the Tree's
  `inputs.sha256` (`30011c0c…` at `dc6f732`) with no byte of the image
  changing. Keeping the old name in the hashed text through an alias would
  freeze a retired name into an encoding forever; the encoding's own profile,
  `magickli-image-inputs-v1`, is not bumped, since what changed is a name in
  the data, not how it is written down.
- **The Table of Shewbread, from the inputs follow-up.** Its spec hashes
  `name.he` for all fourteen tribes (`{ table: "tribeOfIsrael", rows: "*" }`)
  where the signs name twelve; Levi and Joseph are hashed and never drawn.
  Plan 032 thought exactness wanted a new selector form. It does not: a
  spec's fields are dotted paths read through `readFieldPath` over the
  assembled barrel, so the zodiac group can read
  `tribeOfIsrael.name.he` through the link, exactly as
  `TableOfShewbread.tsx` reads `zodiac.tribeOfIsrael?.name.he`, and the
  tribes' group goes. Its inputs hash (`dfd57ffb…`) moves; the bytes
  (`34e0fce1…`, 136,643) do not; and a test asserts that changing Levi's or
  Joseph's Hebrew name now moves no image's hash at all.

The effects on publications are those step 3b recorded
([plan 032](032-data-layer.md#effects-on-publications)): published bundles
keep their stored bytes; each ritual's next publication draws its images and
records the new identity; and a publication begun before the deploy and
retried after it is replayed, matched on manifest and policy, since no byte
moved.

## `magickli` stays

Only `package.json`'s `name` becomes `magickly`; nothing reads it. Every
other `magickli` names something that outlives a deploy, and renaming it
would orphan or invalidate what is already stored or provisioned:

| Kind | Examples | Why it stays |
| --- | --- | --- |
| Browser storage keys | `magickli:ritual-recovery:v1:`, `magickli:ritual-create:v2:`, `magickli:study:set:v1:` | readers' unsaved drafts, recovery state and study progress live under them |
| Database names and stored values | the Mongo database in `src/api-lib/db.ts`; `magickli-pug-shortcuts` and `magickli-ritual` as `sourceFormat`/`format` in SQL | rows already written carry them |
| SQL `CHECK` constraints | `magickli-ritual-asset-plan-v4`/`-v5`, `magickli-jrt-assets-v2`/`-v3`, `magickli-ritual-bundle-object-receipt-v1` in `src/db/schema/ritualBundles.ts` | the constraint admits exactly the stored plans and receipts; renaming is a migration that rewrites stored JSON |
| Render and catalog profiles | `magickli-image-inputs-v1`, `magickli-tree-image-outlines-v4`, `magickli-component-image-outlines-v1`, the image catalog profiles | part of every published image's identity; a rename re-identifies every image |
| Headers and object metadata | `x-magickli-expected-actor`; `x-amz-meta-magickli-file-id` and `-operation-id` | deployed clients send them, stored objects carry them, and R2's CORS policy names them in `loom.json` |
| Provisioned resources | the R2 buckets `magickli-files-production` and `-preview`; the Neon resource `magickli-db`; `loom.json`'s project name | they are the names of real accounts' resources |

The list is by kind, not exhaustive: at `dc6f732`, `src/` alone holds 67
distinct `magickli-…` identifiers and nine distinct `magickli:` key
prefixes. The rule is what
should be kept: an identifier that is stored, hashed, sent over the wire or
provisioned is not renamed for cosmetics.

## Migration

Gated commits on `gate/data-package`, which the owner fast-forwards. Each
commit is gated in a clean worktree on `/home`
(`magickli-gate-data-package`) with a fresh install, Node 24 and
`data/dist` (later `packages/magick-data/dist`) wiped:
`pnpm install --frozen-lockfile`, `loom check`, `loom check --production`,
`pnpm check`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm build` and
`pnpm check:turbopack`, from a script file with each step's status recorded;
from commit 4, the tarball smoke test as well. The first and fourth commits
also start `pnpm dev` (Turbopack) and `pnpm dev:webpack` on fresh ports in
the gate worktree and load a barrel route, a typed-module route and
`/enochian/keys`, checking for errors in the server log and the console.
An adversarial review runs on the final tree.

| # | Commit | What it does |
| --- | --- | --- |
| 1 | `build(data): Move the data layer into a package` | `git mv` of `data/` to `packages/magick-data/src/` (README and licence to the package root), `dev.mts` to `scripts/`, `angelSlugs.ts` to the app, `pentagram.svg` to `assets/`; `pnpm-workspace.yaml` gains `packages/*`; the root depends on `magick-data: workspace:*` (installed with `--config.minimumReleaseAge=0`, lockfile diff read); `exports` → the TypeScript sources, final subpath names; `transpilePackages`; all 105 import lines become `magick-data/…`; the `@magick-data` alias goes; vitest's globalSetup and coverage paths, `tests/renderWithTables.ts`, the seventy-two scripts' paths, `.gitignore`, `biome.json` and the root `tsconfig` excludes follow; `OpenSource.tsx`, the four GitHub links and `tablets.tsx`'s source path; the 28 plan links and plan 032's head line. Specifiers stay extensionless and the tables stay JSON imports: this commit moves and rewires, nothing else. **Turbopack is verified here**, dev and build |
| 2 | `refactor(data): Rename three tables before publishing` | `geomanticHouse`, `astrologicalHouse`, `treeOfLifePath`, their row interfaces and every call site; the barrel's named exports go; the Tree's pinned inputs hash moves, bytes unchanged |
| 3 | `build(data): Declare each table in a generated module` | Decision 7: `dist/` gains a `.js` and `.d.ts` per table, the typed modules import them, `Tables` becomes a `type` alias, the six missing typed modules are written, the typed modules import `../dist/….js` by its full name, the three array tables become `readonly`, `PlanetId` is derived, the texts are declared `unknown` and cast; `renderWithTables.ts` mocks the generated modules rather than the JSON. Measured before and after: the whole repository's instantiations and the barrel routes' first-load JavaScript |
| 4 | `build(data): Build the published shape and prove it` | `.ts` on every relative specifier, `rewriteRelativeImportExtensions` in the package and `allowImportingTsExtensions` at the root; the two package `tsconfig`s (`es2022`, `types: ["node"]`, `isolatedDeclarations` on the emit, with the 26 annotations it asks of shipped modules); `lib/` gitignored; `tools.ts`; `publishConfig.exports` and `files`; the two licences; the pack-and-smoke script and its CI step. Both bundlers verified again, build and dev |
| 5 | `docs(data): Rewrite the package README` | Decision 11, and the test that holds its counts and subpaths to the tables and the exports map |
| 6 | `fix(render): Hash only the tribes the signs name` | The Shewbread follow-up; its inputs hash moves, bytes unchanged, and Levi's and Joseph's names move nothing |
| 7 | `fix(data): Rebuild when the graph or schemas change` | The watcher follow-up |
| 8 | `test(study): Name the sets asked through a function` | The field-path follow-up: the sets whose `question` or `answer` is a function are written down, and the test asserts that exactly those are skipped |
| 9 | `chore: Name the app package magickly` | `package.json`'s `name`, and nothing else ([above](#magickli-stays)) |
| ~~10~~ | ~~`ci(data): Publish magick-data when its version moves`~~ (deferred, [above](#decided-on-3-october-after-the-review)) | Inert: the version stays `0.0.0`, which the reservation holds, so the job finds the version published and does nothing until a human bumps it. A workflow of its own, on pushes to `main` (`ci.yml` runs only on `codex/**` and pull requests), with `id-token: write`. It packs with `pnpm pack`, which applies `publishConfig` (verified), and publishes that tarball with `npm publish` — npm 11.18, bundled with Node 24.18, supports trusted publishing (OIDC), and pnpm 10.18's `publish` lists no such option — so no long-lived token exists. The owner configures the trusted publisher on npm once the names exist |
| 11 | `docs(plan): Record the data package` | This plan's commits and results; the status page: step 4's entry, the stale `master` TODO struck, the component explorer added as a TODO |

Commit 1 is large but mechanical; the risk in it is the wiring, which is why
it changes no emit and no specifier. Splitting the move from the import
rewrite would leave a commit that does not build.

Commit 10, the publishing workflow, is deferred and its row kept for the
record.

## Decided on 3 October, after the review

- **The sources write `.ts` specifiers** ([above](#specifiers)), accepted.
  Nothing publishes TypeScript: the tarball holds compiled JavaScript and
  declarations only, as before, and the `.ts` specifiers are what the app,
  which compiles the package from source, needs to resolve it.
- **`angelSlugs.ts` moves to the app**, accepted: a slug is `magick.ly`'s
  URL scheme, not a fact about the data. The rest of `data/`'s non-table
  modules ship, `lenain/pieces.ts` among them, since where the text's
  paragraphs run is a fact about the text.
- **Publishing from CI is settled after everything else.** Commit 10 leaves
  this plan; its design stays recorded under [deferred](#deferred).
- **The dictionary's two sources are named.** `EMPM` is Gerald J. Schueler,
  *Enochian Magic: A Practical Manual* (Llewellyn, 1985; second edition
  1995), whose Appendix C is an Enochian dictionary arranged by gematria:
  its pronunciation scheme ("ah" for A, "zod" for Z) is the one the `EMPM`
  pronunciations use, and an undated "Enochian Language Database" posted to
  Pastebin in 2012 carries the same pronunciations, meanings and gematria
  (`ADPHAHT`, "ah-deh-peh-ah-teh", "unspeakable", 36). `WE` is *The Whole
  Enochian Dictionary*, an online compilation, author unknown, found by the
  owner as a text file. Between them they are 2,418 of the 2,424 citations
  (`EMPM` 399, `WE` 2,019; four `Keys`, two empty).

  Schueler's book is in copyright, and *The Whole Enochian Dictionary*'s
  status is unknown, so the package claims no rights in either's entries
  and does not offer them under CC BY 4.0. The dictionary stays in the
  package for the app and **out of the published artefact**:
  `./enochian/dictionary` is absent from `publishConfig.exports`, its emitted
  module from `files`, and the README names both sources and says why. The
  app is unaffected, since it never consumes the tarball (decision 10).
  Whether and how it is ever published is the owner's call, not this plan's.

## Risks

- **Turbopack with a workspace package whose `exports` are TypeScript.**
  Reproduced only as `next build --turbopack` on a minimal app; `pnpm dev`
  on the real one is commit 1's to prove, and commit 4's again with `.ts`
  specifiers.
- **`.ts` specifiers in the published declarations.** Resolved correctly by
  TypeScript 6.0.3 under every module mode tried; older compilers are
  untested, and the README says which version the smoke test runs.
- **`loom check` and a workspace.** The review ran `loom check` and
  `loom check --production` on a copy with `packages/*`, the package and the
  `workspace:*` dependency, and both passed with only the existing pnpm 11
  advisories. Whether `loom init`, which CI also runs, touches a second
  importer is not yet known.
- **`publishConfig.exports`** is a pnpm feature; npm ignores it. The smoke
  test and commit 10 both pack with `pnpm pack`, so what is tested is the
  tarball that is published.
- **CommonJS consumers under `node16` resolution cannot import the
  package**, which is ESM only (TS1479; `nodenext` and bundlers are fine).
  The README says so; a CJS build is not planned.

## Adversarial review

Run on 3 October by Fable 5.1 at high effort with `loom-torvalds-review`,
against this plan as first drafted, the repository at `e42c3cf` and the
measurement fixtures; it built minimal Next apps in copies and wrote nothing
into the repository. Its findings, each checked here before it was relayed:

| Finding | Disposition |
| --- | --- |
| Turbopack does not resolve a `.js` specifier to a `.ts` file, and `extensionAlias` is webpack's alone, so commit 4 could pass neither `check:turbopack` nor `pnpm dev` (blocking) | Reproduced on a minimal app: both bundlers fail on `./y.js`, both build `./y.ts`. The sources write `.ts` ([specifiers](#specifiers)) |
| `isolatedDeclarations` reports 68 errors over the whole layer, not 3: the prototype left out the texts' modules | Reproduced (68, by file above); the 26 in shipped modules are commit 4's |
| A fifth link: `tablets.tsx:71` hands `OpenSource` a `/data/…` path | Confirmed; rewritten in commit 1 |
| The dictionary cites `EMPM` and `WE`, which no README names | Confirmed (2,418 citations); named, and held out of the tarball ([decided](#decided-on-3-october-after-the-review)) |
| `extensionAlias` would apply to every dependency | Moot: no alias is set |
| The key sets differ for the three array tables | Confirmed in the equivalence log; stated |
| `lib/` was not gitignored or excluded | Added to the layout and commit 4 |
| One `tsconfig` cannot both check everything and emit only the entry points | Two |
| Spawning the watcher through `pnpm --filter` puts an unverified parent between the wrapper and it | Spawned directly |
| Commit 10's mechanism unverified: pnpm 10.18 has no trusted-publishing option, and `ci.yml` does not run on `main` | `pnpm pack`, then `npm publish` of the tarball, in a workflow on `main`; deferred |
| "Eleven" `magickli:` prefixes | Nine; corrected |
| `GraphSpec`, `TableSpec` and `LinkSpec` were unreachable | Exported from `./graph` |
| Extensionless imports of `dist/` would meet `.js`, `.d.ts` and `.json` side by side | The typed modules name `….js` in full |

What it verified as stated: every count in
[Where it stands](#where-it-stands-at-dc6f732) but the links; decision 8's claim about the data; that only the Tree's and
the Shewbread's identities move; the consumer numbers, reproduced from the
logs; that `pnpm pack` applies `publishConfig.exports` and `files` and keeps
both licences; that nothing in the published modules imports a package; and
that with `types: ["node"]` nothing in `data/` needs the DOM.

## Deferred

- **Publishing from CI** (commit 10 as drafted): a workflow of its own on
  pushes to `main`, `id-token: write`, `pnpm pack` to apply
  `publishConfig`, then `npm publish` of that tarball through npm's trusted
  publishing (npm 11.18, bundled with Node 24.18, supports it; pnpm 10.18's
  `publish` has no such option), inert while the version is `0.0.0`.
- **Publishing the Enochian dictionary** ([above](#decided-on-3-october-after-the-review)).

## Follow-ups

- **A component explorer, hosted in the app under an open-source section.**
  Generate it from `src/render/registry.tsx` rather than adopting Storybook:
  every registry entry already declares its contract, its props and its
  `inputs` spec, so the explorer can enumerate the registry, render each
  component live, show its contract and the fields it reads, and link to its
  source through `OpenSource`, with no stories to write or let rot. It is
  also the natural demonstration site for `magick-components`, which argues
  for building it after that package rather than before.
- **`magick-data/check`**, the checks published with valibot as an optional
  peer (decision 13), when someone wants to validate data of their own.
- **A watcher for a source directory added while `pnpm dev` runs** (plan 032,
  step 3a), which commit 7 does not address.
