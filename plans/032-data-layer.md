# Data layer

Assessment, adversarial review, type spike and decisions, 17–19 September
2026. Read [current status](000-current-status.md) first. Steps 0, 1 and 2
have landed ([Commits](#commits)); steps 3 and 4 are not yet implemented. The
long-term goal is to publish `data/` as its own npm package.

Decision taken on 19 September: keep the data as plain JSON tables, describe
every relation in one declared graph, and materialise links with an eager,
scoped, non-mutating `assemble()` whose types make an unlinked table a compile
error. `view()` (lazy getters) is deferred ([below](#deferred)).

## Assessment (before)

`data/` holds ~25 hand-edited JSON5 datasets (668 KB, of which 394 KB is the
Enochian dictionary), each with a hand-written TypeScript wrapper that casts
the JSON5 (`_sephirot as Sephirot`). [data/data.ts](../data/data.ts) imports
21 of them and, at module load, mutates every row in place: for each key ending
in `Id`, if a table of that name exists in the barrel, it assigns the linked
row. It recurses into nested objects, skips top-level arrays, and sets
`window.magickData`. Nineteen files import the barrel (eight of them
`"use client"`), about ten import typed modules directly, and
[TableOfShewbread.tsx:49](../src/components/gd/TableOfShewbread.tsx) joins
by hand.

Found by comparing each hand-written id union with the JSON keys, and by
walking every linked field in the data:

- **Types assert rather than check, and have drifted.** `HebrewLetterId` has
  9 of 22 members that do not exist (`aleph`, `beth`, `daleth`, `vau`… where
  the data spells `alef`, `bet`, `dalet`, `vav`) and lacks 14 real keys
  including every final form. `ArchangelId` has `kassiel` (data: `cassiel`)
  and lacks eight rows. `PlanetId` lacks `primum-mobile`, `zodiac` and
  `olam-yesodot`, which the sephirot reference; `SephirahId` lacks `daat`;
  `ElementId` lacks `spirit`; `GDGradeId` lacks `portal`; `TribeOfIsraelId`
  has `zabulon` (data: `zebulun`) and lacks `ephraim` and `manasseh`.
  The root cause is [types/global.d.ts](../types/global.d.ts), which types
  every `*.json5` import as `unknown`, so every union and interface is copied
  by hand.
- **Broken links fail silently.** `planets.luna.godNameId` is
  `"shaddai-el-chai"`; the key is `shadai-el-chai`. `archangels.raphael
  .sephirahId` is `"raphael"` (should be `tiferet`) and `tzadkiel`'s is
  `"chesed"` (the key is `hesed`); both are hand-kept back-links of
  `sephirot.*.archangelId`. `tetragrams.caput_draconis.planetId` is
  `["venus","jupiter"]` (and `cauda_draconis` `["saturn","mars"]`); the
  linker indexes the table with the array, so four links never resolve.
  `zodiac.tribeOfIsrael` and `House.zodiac` (astrology houses, an array the
  barrel skips) are typed but never populated. Commit `1cfdb0c` fixed a row
  that spelled its key `archangelIdId`; nothing could have caught it.
- **Ids that are not links, and links with no table.** `gdGrade.orderId` and
  `degreeId` are `"1st" | "2nd" | "3rd"`. `intelligenceId`, `spiritId`,
  `rulerId`, `tarotId` and `pillarId` point at tables that do not exist;
  `tetragram.rulerId` values are the planetary spirits, the same namespace as
  `planet.spiritId`, and already disagree (`taphtatharath` in `albus`,
  `taphthartharath` in `conjunctio` and in Mercury).
- **"No link" is spelled two ways:** `null` (`soulId`, `zodiacId`) and `""`
  (Da'at's `chakraId`, `archangelId`, `soulId`, `angelicOrderId`;
  `elements.spirit.elementalId`). `angelicOrders.json5` has a row keyed `""`
  so that Da'at's resolves.
- **The in-place mutation is order-dependent** (a typed module yields linked
  rows only if `data.ts` evaluated first, which is why every link field is
  optional), creates cycles (four pages import `decycle` to print a row), and
  is guessed from field names.
- **Bundles.** The barrel's graph is one shared client chunk
  (`991-*.js`, 49 KB, 14 KB gzipped) on 20 routes; any page drawing the Tree
  needs the whole sephirah closure. The dictionary is its own chunk
  (`9576-*.js`, 243 KB, 31 KB gzipped) on `/enochian/dictionary` and
  `/enochian/keys`, both client components, although the keys page needs
  only the entries for words in the keys.
- **Dotted field paths that traverse links are a public contract.**
  `TREE_IMAGE_FIELDS` in
  [treeOfLife.ts](../src/render/contracts/treeOfLife.ts) includes two-hop
  paths such as `gdGrade.planet.symbol`; they arrive from query strings
  (`field=`), from the ritual documents (`1=10.jade`, `2=9.jade`) and from
  the study sets (`answer: "godName.name.he"`), and are read through dot-prop
  in [fieldPath.ts](../src/components/kabbalah/fieldPath.ts).
- **Data edits change published bytes.** [Plan 028](028-seo.md#archangel-data)
  records a data fix moving the Tree image identity to
  `magickli-tree-image-outlines-v2`; offline bundles keep their stored bytes.

Three rows resolve correctly and are still wrong; referential integrity is
not correctness, and nothing below claims otherwise. They needed the owner's
call, not a script: `zodiac.cancer.planetId` is `sol` and `scorpio`'s is
`jupiter` (the traditional rulers are Luna and Mars; Luna rules nothing in
the data, and Sol and Jupiter each rule two signs), and
`tribesOfIsrael.manasseh.name.he` is `בנימין`, byte-identical to Benjamin's,
so the Table of Shewbread prints Benjamin twice. Decided on 19 September
([data fixes](#data-fixes)).

## Alternatives considered

Links were the real decision; source of truth and loading follow from it.

| Option | Why not |
| --- | --- |
| Classes (`Sephirah.get("keter").archangel`) | Instances fail the Server → Client boundary (verified: Flight throws in dev and prod), `structuredClone` drops their methods, and methods do not tree-shake |
| Lazy `view()` with non-enumerable getters | Verified against Flight's `isSimpleObject`: a non-enumerable own property logs an error in development and is silently dropped in production, so a view passed as a prop renders every link blank with nothing failing. Also needs table identity per call, memoisation for identity, and hides links from `Object.keys` |
| `link(row, field)` alone, with a registry | Rows do not carry their table (ten tables have rows with no `id`), so every call must name it; the registry must hold all 21 tables, so nothing tree-shakes; every two-hop read needs a path resolver |
| Keep the barrel, add an integrity test | Keeps the mutation, the cycles and the order dependence; not publishable |
| GraphQL / JSON-LD, Postgres | An export format at most; reference data belongs in git |

`assemble()` is the eager form of the same typed object `view()` would have
produced lazily, and the review's findings were about the laziness, not the
object: plain rows cross the boundary, `Object.keys` shows links, dot-prop
works unchanged, and the caller imports exactly the tables it assembles.
Cycles remain, and the only cycle-sensitive consumers are the four dump pages,
which already `decycle`; `structuredClone` and Flight both handle cycles.

## Decisions

Settled between 18 and 19 September:

1. **Plain JSON tables, authored as JSON5.** The build converts to JSON; ids
   are `keyof typeof <table>`, exact by construction, and the hand-written
   unions are deleted. The dictionary stays out of the graph *and* out of
   imported JSON (as a JSON import it costs 19,300 types, 4.5× every other
   table combined; casting after import does not avoid it): it is loaded
   through a declared `Record<string, EnochianEntry>`.
2. **One declared graph** ([format below](#the-graph)). Every id-shaped field
   in the data must be a link, a mirror, pending, external or an enum, or the
   check fails. This is what turns `archangelIdId`, luna's typo and the
   next drift into build failures.
3. **Naming carries arity:** `fooId` is one link with accessor `foo`;
   `fooIds` is a list with accessor `foos`. `tetragrams.json5` renames
   `planetId` → `planetIds` and `rulerId` → `rulerIds`, every value an array
   (`"mercury"` → `["mercury"]`); 14 of 16 rows are single-element. The three
   `Array.isArray` branches ([reference.tsx:170](../src/app/geomancy/reference/reference.tsx),
   [reading.tsx:672](../src/app/geomancy/reading/reading.tsx),
   [AstroGeomancyChart.tsx:178](../src/app/geomancy/reading/AstroGeomancyChart.tsx))
   become `t.planets.map(...)`. The `Array.isArray(tetragram.zodiacId)`
   branch at reference.tsx:161 is dead (never an array) and goes.
4. **1:1 pairs are stored in both directions and verified** (`mirrors`), so
   the raw JSON stays self-contained for non-JS consumers. This applies to
   `sephirah ↔ archangel`, `sephirah ↔ gdGrade`, `element ↔ elemental`,
   `planet ↔ archangel`, and to `nextId ↔ prevId` on sephirot, grades and
   paths (`next`/`prev` renamed to `nextId`/`prevId`; the nav arrows use
   `href={sephirah.nextId}`, today's code with the field renamed). The two
   broken archangel back-links are *fixed*, not deleted; symmetry is asserted
   per row. **1:many back-links are derived** (`inverse`): `element.zodiacs`,
   `element.tetragrams`, `planet.sephirot`. Nobody hand-maintains those.
5. **No `""` sentinels.** Da'at and `elements.spirit` omit the key instead;
   the `""` row in `angelicOrders.json5` (unreachable once `""` means
   nothing) is deleted. Optionality is then derived from the data (absent key
   or `null`), and the format has no `optional` flag.
6. **Geomancy houses are keyed `"1"`–`"12"`**, not a padded array; so is
   `tetragram.meanings`, which used the same `{}`-at-index-0 trick and is
   joined positionally at reading.tsx:295. Consumers lose `.slice(1)` and the
   index arithmetic; the reading page's `meanings[parseInt(houseNoStr)]`
   becomes `meanings[houseNoStr]`. Render snapshots of both geomancy pages
   are committed on the current data first and must be byte-identical after.
7. **Server Components pass ids, not rows.** The house style already
   ([sephirah/[id]/page.tsx:26](../src/app/kabbalah/sephirah/[id]/page.tsx)):
   the data ships in both bundles, so the id is the DTO. Passing an assembled
   row works but ships its reachable closure.
8. **Paths stay dot-prop.** `readFieldPath` is already the wrapper. The
   package adds only the static half, `pathTarget(table, path)`, which walks
   the graph rather than a row, so a test validates `TREE_IMAGE_FIELDS`, the
   study sets' paths and the ritual documents' fields without rendering.
9. **Dynamic id lookups go through `keyof`-typed helpers.** The repo's
   `strict: false` makes `data.sephirah[someId]` silently `any`, erasing
   every guarantee beneath it; `sephirah.get(id)` returning `Row | undefined`
   closes that without changing strictness.
10. **Render identities hash resolved inputs, not tables.** A per-table hash
    would re-render every published ritual's Tree when a `scent` typo is
    fixed. `resolvedInputsHash(table, fieldPaths)` over `TREE_IMAGE_FIELDS`
    changes only when a visible label could. Semver is orthogonal to bytes:
    `1cfdb0c` was a patch-level fix that changed bytes.
11. **Table names keep today's barrel keys** (`tolPath`, `geomanicHouse`,
    `house`) through the migration; renaming is a package-extraction task.
12. **`gd/degrees.json5` becomes a table** (`gdDegree`); `gdGrade.degreeId`
    links to it and `orderId` stays an enum. Its `pillarId` is pending.

## The graph

Authored as a typed literal in `data/graph.ts`; the build emits `graph.json`
so the runtime, other languages and tests read one plain object.

```ts
export const graph = {
  sephirah: {
    links: {
      archangelId:    { to: "archangel", mirrors: "sephirahId" },
      gdGradeId:      { to: "gdGrade",   mirrors: "sephirahId" },
      godNameId:      { to: "godName" },
      chakraId:       { to: "chakra" },            // absent on Da'at → X | undefined
      soulId:         { to: "soul" },              // null on four rows → X | undefined
      angelicOrderId: { to: "angelicOrder" },
      planetId:       { to: "planet", inverse: "sephirot", inverseMany: true },
      nextId:         { to: "sephirah", mirrors: "prevId" },
      prevId:         { to: "sephirah", mirrors: "nextId" },
    },
  },
  archangel: {
    links: {
      sephirahId: { to: "sephirah", mirrors: "archangelId" },
      planetId:   { to: "planet",   mirrors: "archangelId" },
    },
  },
  tetragram: {
    links: {
      planetIds: { to: "planet", many: true },
      zodiacId:  { to: "zodiac" },                 // null for the dragon's head and tail
      elementId: { to: "element", inverse: "tetragrams", inverseMany: true },
    },
    pending: { rulerIds: "spirit" },
  },
  tolPath: {
    links: {
      "hermetic.hebrewLetterId": { to: "hebrewLetter" },   // accessor at hermetic.hebrewLetter
      "hebrew.hebrewLetterId":   { to: "hebrewLetter" },
    },
    external: { "hermetic.tarotId": "tarot-deck" },
  },
  gdGrade: {
    links: { /* elementId, planetId, sephirahId (mirrors gdGradeId), degreeId, nextId, prevId */ },
    enum:  { orderId: ["1st", "2nd", "3rd"] },
  },
  planet: {
    links: { /* hebrewLetterId, godNameId, archangelId (mirrors planetId) */ },
    pending: { intelligenceId: "intelligence", spiritId: "spirit" },
  },
  // …
} as const satisfies GraphSpec;
```

Rules the format carries:

- `to` names the target table; the accessor comes from the field name, or
  from `as` (implemented, unused by this data).
- `many: true` matches the `Ids` suffix and returns `Row[]`.
- `mirrors` names the field on the target row that must point back; the check
  asserts symmetry both ways, row by row.
- `inverse` adds a derived accessor on the target; with `inverseMany` it is a
  list, without it the check asserts uniqueness.
- A nested key is the full dotted path; the accessor lands at the same
  nesting level. One level is implemented; the data has one.
- `pending` and `external` are id-shaped fields that produce no accessor and
  must be listed so the inventory is complete; `enum` likewise.
- Not expressible, parked as `external`: polymorphic targets
  (`enochianLetter["planet/element"]` holds `taurus`, `fire`, `spirit`) and
  links inside arrays of objects. Nothing needs either today.
- Array tables (`seventyTwoAngel`, astrology `house`) are `Row[]`; they can be
  link sources, and targets only if rows carry an `id`.

The integrity check (a vitest test, and a script the `build` task runs first;
`pnpm dev` does not run it) asserts: every `*Id`/`*Ids` field in every table
is accounted for; every link resolves; declared arity matches the data;
every `mirrors` pair is symmetric; every singular `inverse` is unique; no
accessor shadows an own field (`seventyTwoAngel` already has a string
`godName`); and each table's rows pass a valibot `strictObject` schema
derived from the graph — plain `object()` silently strips undeclared keys,
which is the class of silence this removes.

## Types (spike, 19 September)

Run at xhigh by Opus 5 against the repo's TypeScript 6.0.3 and tsconfig
(`strict: false`, `strictNullChecks: true`), on JSON converted from the real
data with the renames applied. The spike itself was not kept; the form that
worked is recorded here and step 2 rebuilds from it.

```ts
// One flat mapped type per row. The key set comes from the JSON and the
// graph literal only — it never recurses — so the recursion lives in
// property positions, which TypeScript instantiates lazily.
type RowKeys<I, T extends TableName> =
  | UnionKeys<Rows<Tables[T]>>            // own fields, unioned across rows
  | (keyof TopLinks<T, I> & string)       // link accessors whose target is in I
  | (keyof Inverses<T, I> & string);      // derived back-links whose source is in I

export type Row<I, T extends TableName> = {
  [K in RowKeys<I, T>]: K extends keyof TopLinks<T, I>
    ? LinkValue<I, T, Lookup<TopLinks<T, I>, K>>
    : K extends keyof Inverses<T, I>
      ? InverseValue<I, Lookup<Inverses<T, I>, K>>
      : K extends NestKey<T>
        ? NestValue<I, T, K>
        : Simplify<UnionField<Rows<Tables[T]>, K>>;
};

// Uniform rows per table: union the keys, `undefined` where a row lacks one.
type UnionKeys<RU> = RU extends unknown ? keyof RU & string : never;
type UnionField<RU, K> = RU extends unknown ? (K extends keyof RU ? RU[K] : undefined) : never;

// TS refuses to index a deferred key-remapped mapped type with a constrained
// key (TS2536); inside a one-parameter helper the key is naked and it works.
type Lookup<M, K> = K extends keyof M ? M[K] : never;

// Accessor from the field name; anchored at the end, so `Ids` never matches `Id`.
type AccessorName<F extends string, D> = D extends { as: infer A extends string } ? A
  : F extends `${infer B}Ids` ? `${B}s`
  : F extends `${infer B}Id` ? B
  : never;

export type Assembled<I extends TableName | "*"> = { [T in Included<I>]: Table<I, T> };
export function assemble(t: Tables): Assembled<"*">;
export function assemble<K extends TableName>(t: Pick<Tables, K>): Assembled<K>;
```

`Graph` and `Tables` are bound into the module, not passed as type
parameters, and `"*"` stands for "every table" — see below for why. The
runtime is ~130 lines: `structuredClone` each row, index by id, attach
accessors per the graph (nested paths, lists, absent | `null` → `undefined`),
fill inverses, deep-freeze through a `WeakSet`, cache by sorted table set,
and collect data problems (`dangling`, `inverse-not-unique`,
`accessor-collision`) rather than throw.

The recursive `Assembled` type worked in the first form tried: one flat
mapped type per row over a pre-computed key union, so the key set never
recurses and the cycle is only ever in property positions, which TypeScript
instantiates lazily. 12-hop chains, an 11-deep `sephirah → archangel →
sephirah` cycle and an 8-table walk pass without a depth error. Every
negative is a live error, proved by `TS2578` on a deliberately wrong
`@ts-expect-error`: a link whose table was not assembled, a many-link used as
single, an optional without `?.`, a wrong table name, an unknown id, a
pending target, an enum, an external. The resolved type is a concrete object,
so completion and `.d.ts` emit are usable — but it is not printed as the
alias: a hover or an error gives the expanded `Simplify<…>` intersection of
the row's own fields with its links, a screenful per row, and
`archangel` reads as that expansion rather than as `Row<"*", "archangel">`.
A wrapper that keeps the name is a follow-up ([below](#follow-ups)).

| Configuration | Types | Instantiations | Check |
| --- | ---: | ---: | ---: |
| Baseline, `assemble()` typed `any` | 4,362 | 191 | 0.04 s |
| Full graph, 41 multi-hop reads over 25 tables | 10,166 | 52,701 | 0.17 s |
| 12 hops, deep cycle, cross-graph walk | 9,815 | 36,411 | 0.16 s |

Re-run on 19 September: clean, 47,420 instantiations, 0.22 s. The budget is
5,000,000. Scoping saves ~30 % of instantiations, not more; it is for
semantics and bundles, not the compiler.

Two things the spike forced, both kept:

- **Row types are uniform per table.** Per-row precision (Da'at simply
  lacking `planet`) is free and kills hop 2: a link's target is the union of
  the target table's rows, and if their key sets differ, `.planet` on the
  union is an error. Keys are unioned across rows and absent ones typed
  `undefined`, so a partial relation is `X | undefined` table-wide and a
  four-hop read is `hod.gdGrade?.planet?.hebrewLetter?.letter.he`.
- **The graph is bound into the module, with a `"*"` sentinel for "all
  tables".** The fully generic form type-checks identically and prints the
  8 KB graph literal in every hover and error.

The runtime (`assemble.ts`, ~130 lines) `structuredClone`s each row, attaches
accessors from the graph, fills inverses, deep-freezes through a `WeakSet`
(the cycles need it) and caches by sorted table set. On the real data it
reported exactly one dangling link (luna) and no inverse collisions.

## Data fixes

All in step 1 below; each is a data patch unless marked.

| Fix | Visible effect |
| --- | --- |
| `planets.luna.godNameId` → `shadai-el-chai` | `/astrology/planet/luna` gains its god name; its search description ([entities.ts](../src/seo/entities.ts)) changes; check the card list |
| `archangels.raphael.sephirahId` → `tiferet`; `tzadkiel` → `hesed` | None rendered today; `archangel.sephirah` is not a Tree field |
| Tetragram `planetIds`/`rulerIds` arrays; `albus` ruler → `taphthartharath` | None: the pages read the ids directly and always showed both planets |
| `next`/`prev` → `nextId`/`prevId` (sephirot, grades); two pages | The sephirah page's field table loses its Next/Prev rows (the arrows are the same links); the grade page's two dump rows are relabelled `prevId`/`nextId` |
| Drop `""` sentinels; delete the `""` angelic-order row | `/kabbalah/sephirah/daat` drops its two empty `ArchangelId`/`SoulId` rows; nothing else, since every other consumer uses `?.` and the Tree joins `undefined` as `""` |
| Geomancy houses and `meanings` keyed `"1"`–`"12"`; two pages | None, pinned by snapshots |
| `enochian/letters.json5` `pesces` → `pisces` | None today (polymorphic field, external) |
| `zodiac.cancer.planetId` → `luna`; `scorpio` → `mars` | The "ruled by" links on `/astrology/zodiac` ([zodiac.tsx:44](../src/app/astrology/zodiac/zodiac.tsx)) change; no image contract reads `zodiac.planet` |
| Three dictionary entries: IZAZAZ (Key 2, "have framed"), BIAB (Key 3, "stand"), VOMZARG (Key 3, "unto every one of you"), with `source: "Keys"` and `source2: "Key N"`, the file's own provenance pattern | Those rows on `/enochian/keys` gain their meaning |
| `paths.json5` gains mirrored `nextId`/`prevId` in hermetic `pathNo` order 11–32, then `2_5` and `3_4`, which have no number; the path page's arrows read `nextId`/`prevId` | The arrows on `/kabbalah/path/<id>` render for the first time: they test `"prev" in path` today ([path.tsx:62](../src/app/kabbalah/path/[id]/path.tsx)), and paths have no such fields |
| Delete the hand-written id unions; derive from JSON (code, step 2) | `typeof data.hebrewLetter.aleph` in [sets.tsx](../src/study/sets.tsx) becomes a type error (it is `alef`); fix the four references |
| **Step 3, not step 1:** `tribesOfIsrael.manasseh` → `he: "מנשה"`, `en: "Manasseh"` | The Table of Shewbread's Gemini label changes ([TableOfShewbread.tsx:49](../src/components/gd/TableOfShewbread.tsx)), so its golden bytes move. It waits for `resolvedInputsHash` (decision 10) so that only the shewbread's identity changes, not the shared `magickli-component-image-outlines-v1` profile that every registry component publishes under |

Also decided on 19 September, code rather than data: the keys page's
dictionary lookup ([keys.tsx:37](../src/app/enochian/keys/keys.tsx))
normalises U↔V and strips hyphens, which finds four more of the seven missing
words (`URBS` is filed as `VRBS`, `GIUI` as `GIVI`, `CASARMA` as `CASARM`,
`GRSAM` as `G-RSAM`), and it stops rendering a literal `0` in the
pronunciation cell for a word with none (`{dict.pronounciations.length && …}`).
Both land in step 3 with the rest of that page.

The Tree image identity must **not** move: none of these changes a sephirah
field in `TREE_IMAGE_FIELDS`. If a golden moves, something else changed.

## Migration

Each step is its own commit or short series, gated as in
[current status](000-current-status.md) (`pnpm check`, `typecheck`,
`test:coverage`, `build`, `loom check`, `loom check --production`, in a clean
worktree with a fresh install), with an adversarial review on the exact
final tree. Commit footers name every model that worked on the change.

0. **Pin current behaviour, tests only.** `renderToStaticMarkup` snapshots of
   the geomancy reference page and the reading page at three house numbers;
   a snapshot of `Object.keys` of one row per barrel table; the integrity
   audit as a test whose current failures are listed explicitly, so step 1
   turns them green rather than deleting them.
1. **Data fixes** (table above), with the two consumer edits each needs.
   Nothing about the barrel changes.
2. **Build step, graph, types, `assemble()`.** `data/build.ts` writes
   `data/dist/*.json`, `graph.json` and the id-union `.d.ts` (gitignored; the
   `dev`, `typecheck`, `test` and `build` tasks run it first). `graph.ts`,
   `types.ts` and `assemble.ts` come in from the spike. The integrity check
   lands here. [data/data.ts](../data/data.ts) becomes
   `assemble(allTables)` with the same table keys, so the nineteen importers
   compile unchanged; the mutation and `window.magickData` go. The step-0
   `Object.keys` snapshot must show only the expected delta (links now
   include `next`, `prev` and the derived inverses); the goldens must not
   move.
3. **Consumers.** Typed-module importers move to the JSON tables or a scoped
   `assemble`; `[id]` routes use the typed lookup helpers; Server Components
   pass ids; `/enochian/keys` resolves its dictionary subset on the server,
   normalises its lookup and drops the `0`, and the dictionary stops being a
   JSON import; `resolvedInputsHash` (decision 10) lands, and Manasseh's
   Hebrew is fixed once it has; `pathTarget()` and its test
   over `TREE_IMAGE_FIELDS`, the study sets and the ritual documents; the
   `TableOfShewbread` hand-join and the `Array.isArray` branches go. The
   JSON5 loaders in `next.config.ts` and `vitest.config.mts` are removed once
   nothing imports JSON5. `decycle` leaves with the dump-page redesign
   ([plan 028 follow-ups](028-seo.md#follow-ups)), not before.
4. **Package extraction** — a separate plan: a workspace package emitting
   JSON, ESM and `.d.ts` with `graph.json`; semver (rename or remove an id or
   field: major; new rows or fields: minor; corrected values: patch);
   `resolvedInputsHash`; table renames.

## Commits

### Steps 0 and 1

Steps 0 and 1, on `gate/data-layer` from `112562f`. Each was checked on its
own tree with `pnpm check`, `pnpm typecheck` and `pnpm test`; the whole
branch was then gated as [below](#results).

| Commit | Change | Tests |
| --- | --- | --- |
| `67258be` docs(plan): Renumber the data layer plan to 032 | This plan takes 032, since the Tree rounding note reached `main` with 030 first, and the status page gains its pointer. The plan file itself arrived in `f681f10` and last grew in `424342e`, both swept in with the seventy-two angels work | 4,599 |
| `3eaf185` test(data): Pin the data pages before the data changes | Step 0. Render snapshots of both geomancy pages, the barrel's key surface, the integrity audit and its expected failures | 4,611 |
| `8a549f8` fix(data): Repair the links that never resolved | Luna's god name, Raphael's and Tzadkiel's sephirot, Cancer's and Scorpio's rulers, the letter R's `pisces`, Albus's ruler | 4,611 |
| `ee6722f` fix(enochian): Add the three key words the dictionary lacks | IZAZAZ, BIAB and VOMZARG, sourced to Keys 2 and 3 | 4,611 |
| `a92b108` refactor(data): Name list ids in the plural | `planetIds` and `rulerIds`, always arrays; three consumers lose `Array.isArray` | 4,612 |
| `875d6d9` refactor(data): Name the chain links nextId and prevId | Sephirot, grades and, for the first time, paths; three nav pages; a chain test | 4,615 |
| `416c7b3` fix(data): Omit ids that point nowhere instead of storing "" | Da'at's four, `elements.spirit`, and the `""` angelic order that existed for them | 4,615 |
| `577d71a` refactor(geomancy): Key the houses and meanings by house number | Houses and `tetragram.meanings` keyed `"1"`–`"12"`; both pages lose the index arithmetic | 4,615 |
| `86895ad` fix(geomancy): Drop amissio's dead duplicate title | The first of the row's two `title` keys, which JSON5 had already discarded | 4,615 |

A tenth commit, `docs(plan): Record the data layer's first steps`, adds this
section and the next; it is not in the table, which it would have to predict.

### Step 2

Step 2, on `gate/data-layer-2` from `8e982ef`, checked the same way and gated
as [below](#step-2-1).

| Commit | Change | Tests |
| --- | --- | --- |
| `eada83f` build(data): Emit JSON tables from the JSON5 sources | `data/build.mts` converts all 28 sources into gitignored `data/dist`, and `data:build` chains ahead of `dev`, `typecheck`, `build`, `check:turbopack` and the test scripts; it is also vitest's globalSetup, so a lone `vitest run <file>` builds what it needs. Nothing imports `data/dist` yet | 4,615 |
| `e79fa81` feat(data): Declare the graph | `graph.ts` and its `GraphSpec`, over all 26 tables — five of which the barrel never had — with `tables.ts` as the registry it is typed against, and a test that walks the data for the inventory both ways | 4,670 |
| `9b23046` feat(data): Type rows from the JSON and assemble links | `types.ts` and `assemble.ts` with their unit tests and the `@ts-expect-error` assertions. Nothing uses them yet | 4,698 |
| `aa51292` test(data): Check the graph against the data | `integrity.ts`, `schemas.ts` and `check.ts` replace the step-0 audit; `chains.test.ts` folds in; `pnpm build` runs the check | 4,648 |
| `ad144ce` refactor(data): Build the barrel with assemble() | The typed modules derive their types from the JSON, `data.ts` becomes `assemble(tables)`, the mutation and `window.magickData` go, and eight consumers follow | 4,650 |
| `591e8e6` fix(data): Keep unlinked tables out of the barrel | The barrel assembles 23 tables rather than 26: `seventyTwoAngel`, `enochianTablet` and `christianChoir` appear in no link, and carrying them cost every barrel route about 69 KB raw and 19 KB gzipped ([below](#cost)) | 4,650 |
| `af48cca` test(data): Tighten the graph checks | An inventory failure names the row it is on; `mirrors` is asserted reciprocal at the graph level, before any data is walked; an id-shaped `external` field must still be in the data; the twelve planets `PlanetId` means are written down; and `check:turbopack` runs `data:check`, as `build` does | 4,657 |

The last two came from the adversarial review on the first five. An eighth
commit, `docs(plan): Record the data layer's second step`, adds the sections
below; as in step 1 it is not in the table, which it would have to predict.

## Results

### Steps 0 and 1

The gate ran on the final tree in the `gate/data-layer` worktree with the
symlinked `node_modules` removed and a fresh `pnpm install --frozen-lockfile`,
on Node 24.18.0 and pnpm 10.18.0, under CI's placeholder environment (no
database or network). It is [ci.yml](../.github/workflows/ci.yml)'s sequence:

| Step | Outcome |
| --- | --- |
| `pnpm install --frozen-lockfile` | clean |
| `loom init` | already matches the bootstrap defaults |
| `loom check` | good, with the standing pnpm 11 advisory |
| `loom check --production` | good, same advisory |
| `pnpm check` | no errors, and 37 warnings: the repository stood at 39, and the geomancy rekey removed the two `key={i}` array-index keys in `reference.tsx` |
| `pnpm typecheck` | clean |
| `pnpm test:coverage` | 4,615 passed, 16 skipped, thresholds met |
| `pnpm build` | webpack, 215 pages prerendered |
| `pnpm check:turbopack` | Turbopack, 215 pages prerendered |

What a reader sees change:

- `/astrology/planet/luna` gains its god name, Shaddai El Chai, in the page
  and in the search description [entities.ts](../src/seo/entities.ts) builds.
- `/astrology/zodiac` rules Cancer by Luna and Scorpio by Mars.
- `/enochian/keys` gives IZAZAZ, BIAB and VOMZARG their meaning instead of
  the Dee translation alone.
- `/kabbalah/path/<id>` draws its previous and next arrows for the first
  time; the page also gained the three nav rules its siblings already had.
- `/kabbalah/sephirah/<id>` no longer lists Next and Prev among its
  remaining fields, since the arrows above are the same two links, and
  `/gd/grade/<id>`, which dumps every field it has, now shows `prevId` and
  `nextId` there.
- `/kabbalah/sephirah/daat` drops two empty rows, `ArchangelId:` and
  `SoulId:`. That page tables every key it does not lay out itself, and
  those two were not in its exclusion list, so their `""` printed as empty
  rows; `chakraId` and `angelicOrderId` were excluded and never showed.
- Nothing else. The two geomancy pages are byte-identical, and Caput and
  Cauda Draconis show both their planets exactly as before: the barrel's
  `tetragram.planet` link never resolved for those two rows, and no page
  read it.

The social cards draw a section, a title and their art, and no title moved,
so no card's bytes moved; `/og/astrology/planet/luna.png` in particular is
unchanged, because the description is not on the card.

No rendered image moved. Every component image was rendered from `efe97ce`,
the branch point at the time, and from the final tree and compared; the
registry test pins the same bytes on the rebased tip:

| Image | Bytes | SHA-256 |
| --- | ---: | --- |
| `tree-of-life`, the 2=9 ritual's query | 150,736 | `96516a75ce13374a234de855bf596ce1a50d1e9adf7340b398e4b3a2b7e4858a` |
| `table-of-shewbread` | 136,294 | `df3c37911f14c3e81040d62d74892b97fdb0c72027ef390323f907e795ceb516` |
| `astro-geomancy-chart` | 52,476 | `eb2f1b6fe2fef2f563ee164de6e403ca9f398ec4706c9ad331195bc34286bffa` |
| `astro-geomancy-chart?m=2222111122221111&width=256` | 56,498 | `18ecbf9feea69d75bb979319087b74d12d04a7399e3051f685893d6fbf328821` |
| `seven-branched-candlestick` | 52,363 | `5d8b637f7ceb159014b1bf7322b51456a8bd2b730bdb699883288ed6bf063331` |
| `enochian-tablet` | 120,471 | `a35f3c18a3a61d17c48d81e7e7b27def96fc43b896837297039a6ab8c20024e8` |

The Tree keeps `magickli-tree-image-outlines-v3` and the rest
`magickli-component-image-outlines-v1`; neither identity moved, so published
rituals are untouched. The Tree image is the sharpest of these: the 2=9
ritual draws `angelicOrder.name.he`, which is exactly the field Da'at read
from the deleted `""` row, and its bytes are the same either way because
`Array.join` writes `undefined` and `""` alike.

The step-0 snapshots did their job. The reference page is 62,119 bytes,
SHA-256 `863e323249bc2ba11753bf0ba7b675bc0aaebff526d5d343b451657d4374d161`,
and the reading page 80,698, 80,649 and 80,630 bytes in the first, seventh
and twelfth houses, through all seven data commits. They pin MUI's and
styled-jsx's markup along with the data, so a dependency upgrade will move
them; re-render and read the diff before accepting one.

Browsers were not opened. Both pages are pinned by server-rendered bytes,
which is what the rekey could have changed; the path page's new arrows were
read from the markup and the CSS they need was copied from the sephirah
page, not verified in a browser.

### Step 2

The gate ran on the final tree in the `gate/data-layer-2` worktree with the
symlinked `node_modules` removed and a fresh `pnpm install --frozen-lockfile`,
on Node 24.18.0 and pnpm 10.18.0, under CI's placeholder environment (no
database or network), in [ci.yml](../.github/workflows/ci.yml)'s order:

| Step | Outcome |
| --- | --- |
| `pnpm install --frozen-lockfile` | clean; no dependency was added |
| `loom init` | already matches the bootstrap defaults |
| `loom check` | good, with the standing pnpm 11 advisory |
| `loom check --production` | good, same advisory |
| `pnpm check` | no errors, and the same 37 warnings as before |
| `pnpm typecheck` | clean |
| `pnpm test:coverage` | 4,657 passed, 16 skipped, thresholds met |
| `pnpm build` | webpack, 215 pages prerendered |
| `pnpm check:turbopack` | Turbopack, 215 pages prerendered, and the data check first |

Nothing a reader sees changed. Both geomancy pages are byte-identical, the
`/kabbalah/path/<id>` markup is the same (the Tarot block is drawn when the
hermetic block resolves, as before), and every one of the six pinned component
images was re-rendered and compared:

| Image | Bytes | SHA-256 |
| --- | ---: | --- |
| `tree-of-life`, the 2=9 ritual's query | 150,736 | `96516a75ce13374a234de855bf596ce1a50d1e9adf7340b398e4b3a2b7e4858a` |
| `table-of-shewbread` | 136,294 | `df3c37911f14c3e81040d62d74892b97fdb0c72027ef390323f907e795ceb516` |
| `astro-geomancy-chart` | 52,476 | `eb2f1b6fe2fef2f563ee164de6e403ca9f398ec4706c9ad331195bc34286bffa` |
| `astro-geomancy-chart?m=2222111122221111&width=256` | 56,498 | `18ecbf9feea69d75bb979319087b74d12d04a7399e3051f685893d6fbf328821` |
| `seven-branched-candlestick` | 52,363 | `5d8b637f7ceb159014b1bf7322b51456a8bd2b730bdb699883288ed6bf063331` |
| `enochian-tablet` | 120,471 | `a35f3c18a3a61d17c48d81e7e7b27def96fc43b896837297039a6ab8c20024e8` |

Byte for byte what step 1 left, and both render identities are unchanged, so
published rituals are untouched. The Tree is the sharp one again: the 2=9
ritual draws `angelicOrder.name.he`, `godName.name.he` and
`archangel.name.he`, all of them through the barrel, so the same bytes mean
the same joins.

#### What the barrel's rows gained

The step-0 `Object.keys` snapshot moved deliberately, and
[barrel.keys.test.ts](../data/barrel.keys.test.ts) carries the same list. Two
tables are new, `gdDegree` and `tribeOfIsrael`, both of them link targets the
barrel never held; the barrel is 23 of the 26, for the reason
[below](#the-three-tables-the-barrel-does-not-hold).

The old `insertRefs` did recurse into nested blocks, and `gdGrade`,
`archangel` and the rest of the tables the barrel already had were walked like
any other, so much of what looks new is not. These accessors were all made
before, for the rows that carried the id, and are now an own key of every row
of the table:

| Table | Was already made |
| --- | --- |
| `planet` | `hebrewLetter`, `godName`, `archangel` |
| `gdGrade` | `element`, `planet`, `sephirah` |
| `archangel` | `sephirah` |
| `alchemySymbol` | `planet` |
| `tolPath.hermetic`, `tolPath.hebrew` | `hebrewLetter`, inside the block |

What is genuinely new is this, and nothing else:

| Table | Gained | Why it was missing |
| --- | --- | --- |
| `planet` | `sephirot` | Derived, and nobody hand-maintains it |
| `element` | `zodiacs`, `tetragrams` | Derived, the same way |
| `zodiac` | `tribeOfIsrael` | Typed since 2023 and never made: the tribes were not in the barrel |
| `house` | `zodiac` | The astrology houses are an array, which `insertRefs` skipped |
| `tetragram` | `planets` | A list of ids, which the `Id` rule could not see |
| `gdGrade` | `degree` | `degrees.json5` is a table now |
| `gdGrade`, `sephirah`, `tolPath` | `next`, `prev` | A field naming its own table is invisible to a rule that reads field names |

Nothing was lost, and every accessor is an own key of every row of its table,
holding `undefined` where that row has no id: Keter has a `prev`, Da'at has
all eight of its links, and the two are what make `Object.keys` honest.

#### The three tables the barrel does not hold

`data.ts` first assembled all 26 tables, which was wrong and measurable.
`seventyTwoAngel`, `enochianTablet` and `christianChoir` appear in no link in
the graph, in either direction, so assembling them adds no accessor to any
row, and the one page that reads the seventy-two imports the typed module
directly. All it did was put their JSON — 62,671 bytes once minified, for the
seventy-two alone — in the shared client chunk of every route that reads the
barrel. `591e8e6` leaves them out; `gdDegree` and `tribeOfIsrael` stay,
because they are link targets.

The barrel imports its 23 tables itself rather than taking them from
[tables.ts](../data/tables.ts), and never reaches that module at runtime.
`const { seventyTwoAngel, ...linked } = tables` was tried and measured first
and changed nothing: a module brings every JSON it imports into every bundle
that reaches it, whether or not the value is used, and the repository declares
no `sideEffects`. The registry still holds all 26, for the graph, the schemas
and the check, and `satisfies Omit<Tables, …>` keeps the two lists from
drifting.

#### Cost

`tsc --noEmit --incremental false --extendedDiagnostics` over the whole
repository, after `data:build` and `next typegen`, each tree measured in the
same worktree on the same machine:

| Tree | Types | Instantiations | Check |
| --- | ---: | ---: | ---: |
| `main` at `8e982ef` | 389,184 | 1,751,879 | 6.45 s |
| `ad144ce` | 406,085 | 1,895,956 | 6.67 s |
| `591e8e6` | 406,933 | 1,919,250 | 6.83 s |
| `af48cca` | 407,204 | 1,919,962 | 6.73 s |

144,077 instantiations for the whole layer, against a budget of 5,000,000 and
the spike's ~50,000 for the graph in isolation; the rest is the uniform row
types over every row of every table, which the spike did not have to build.
Of the 24,006 on top of that, 23,294 are `591e8e6`'s
`satisfies Omit<Tables, …>`, which holds the barrel's list of tables to the
registry's by instantiating every row type once more; the checks `af48cca`
adds cost 712. `pnpm check` and the test suite are unchanged in cost.

The bundles are the cost the step got wrong at first. `next build --webpack`
under [ci.yml](../.github/workflows/ci.yml)'s environment, the chunks read
from the prerendered HTML under `.next/server/app`, raw bytes and then
gzipped:

| Tree | Barrel chunk | Also loaded | `/kabbalah/tree` total |
| --- | ---: | ---: | ---: |
| `main` at `8e982ef` | 50,856 / 14,366 | — | 1,355,571 / 434,388 |
| `ad144ce` | 54,031 / 15,753 | 67,338 / 18,394 | 1,426,089 / 454,171 |
| `591e8e6` | 55,842 / 16,099 | — | 1,360,557 / 436,123 |

The barrel's chunk is on the same 56 routes in all three; the second chunk
`ad144ce` added was on those 56 and on the seventy-two's own page. So step 2
as first built grew what every barrel route loads by about 69 KB raw and
19 KB gzipped, and `591e8e6` gave 64 KB and 18 KB of that back. The route
total is every client chunk `/kabbalah/tree` loads, and the 5 KB still above
`main` is the graph literal, `assemble()` and the two tables the barrel
gained. The seventy-two's JSON is back in its own page's chunk, 79,207 bytes,
where `main` had it.

#### What was decided while building it

- **`build.mts` and `check.ts`, not `build.ts`.** The repository's packages
  are CommonJS, so tsx compiles a `.ts` to CJS, where neither
  `import.meta.url` nor top-level await exists. The build wants both and is
  `.mts`; the check needs neither and stays `.ts`. Both run under
  `node --import tsx`.
- **No `.d.ts` is emitted.** The plan has the build write "the id-union
  `.d.ts`", and there is none: the build writes the JSON and `graph.json`
  only, and an id is `keyof typeof <table>` off the JSON import (decision 1),
  which is exact by construction and costs no generated file to keep in step.
  The `.d.ts` comes back with step 4, where the package emits one.
- **There is no `retrograde` table.** Mercury's stations are computed in
  [mercuryRetrograde.ts](../src/components/astrology/mercuryRetrograde.ts) from
  `astronomy-engine`, not stored. `christianChoir` is a table instead, and the
  72 angels page imports it; that is 26 in the registry, of which the barrel
  assembles 23 ([above](#the-three-tables-the-barrel-does-not-hold)).
- **`PlanetId` is the rows with a symbol, not every key.** The planet table
  also holds `primum-mobile`, `zodiac` and `olam-yesodot`, which the sephirot
  point at but which are spheres of the Tree with a name and nothing else.
  Everything that uses `PlanetId` means a planet — the geomancy pages, the
  candlestick, the decades of the 72 angels, and
  `scripts/seventyTwoAngels/validate.ts`, whose `Record<PlanetId, string[]>`
  names exactly those twelve. `PlanetKey` is every row. The twelve are written
  out in [integrity.test.ts](../data/integrity.test.ts) and asserted against
  the table, so the derivation cannot quietly pick up a thirteenth; making the
  criterion explicit is a follow-up.
- **Rows are uniform at every depth, and a key some rows lack is optional.**
  The spike only unioned the top-level keys; this data needs more, because the
  sephirot have four shapes of `color` between them and five planets have no
  Hebrew name. Optional rather than required-and-undefined so that a row of
  the raw JSON is still assignable to the type its table exports, which
  `/kabbalah/yhvh/72angels` relies on.
- **The schemas derive their id fields from the graph and declare the rest by
  hand.** Optionality is the data's, so it cannot be derived without making
  the check tautological; it is read off the sources and written down.
- **The typed modules export the raw rows unfrozen.** `assemble()` freezes its
  own clones; nothing mutates the sources any more, and freezing twenty
  modules at import would cost startup for a guarantee no test needs.
- **`ChristianChoirId` is gone.** An array table has no key union to derive
  and nothing imported it. Every other id union and row interface kept its
  name.

Browsers were not opened. Both geomancy pages and every component image are
pinned by server-rendered bytes, which is what this step could have changed,
and the two markup edits (the path page's Tarot block, the reading page's
archangel) are covered by those pins.

## Adversarial review

Run on 18 September at xhigh by Fable 5.1 against the design as it stood
(with `view()`), using `loom-torvalds-review`, five scratch scripts and
Next's bundled Flight server. Its findings and their disposition:

| Finding | Disposition |
| --- | --- |
| Non-enumerable getters fail the Server → Client boundary (dev error, prod silent drop) | `view()` deferred; `assemble()` yields plain rows; decision 7 |
| `link(row, field)` cannot know the table | Superseded: `assemble()` knows it |
| `sideEffects: false` and a graph registry cannot both hold; the win is the dictionary | Tree-shaking dropped as a goal for the core; the caller's imports scope the bundle; dictionary handled in step 3 |
| Step 2 with views silently degrades the four dump pages and turns `prev` into `[object Object]` | Moot with enumerable links and `nextId` hrefs; step-0 snapshot pins the surface anyway |
| Four relations stored both ways; two inverses (`godNameId`, `chakraId`) are not 1:1 | `mirrors` for 1:1 pairs with symmetry asserted; `inverse` only where derived, with uniqueness asserted; the non-1:1 ones are not declared as inverses |
| The `*Id` rule misses value-shaped joins (`dictionary[sub.enochianLatin]`, seven words missing), polymorphic targets, positional joins | Rule scoped to `*Id` fields; `meanings` keyed by house; polymorphic parked as external; the seven words listed for the owner |
| Per-table content hash over-invalidates render identities | Decision 10 |
| `optional` must cover absent keys | Sentinels removed; optionality derived |
| `oneOrMany` gives one accessor name two shapes across tables | Plural ids (decision 3) |
| valibot `object()` strips undeclared keys | `strictObject` in the check |
| "The build fails" is a script; Turbopack dev runs no whole-graph hook; `Keys.ts` is TS-authored | Stated as such; the walker imports modules |
| The design is larger than the defects; the smaller version | Adopted in substance: JSON-derived unions, one graph, plain tables, a check; `view()` deferred |
| `in` sees non-enumerable getters; `sets.tsx` references `aleph` as a type; three rows resolve but are wrong | Noted above |

It also refuted three claims made in the assessment: cycles are not a
problem for Flight (it emits back-references); class instances are
structured-cloneable (they lose their methods); and `generateCards` compares
answer strings, not row identity, so nothing depends on identity surviving
the migration.

## Deferred

- **`view()`**, the lazy form of the same typed object, if bundle or startup
  cost ever wants it. An *enumerable*, memoised getter passes Flight's check
  (verified in the source), so a lazy form that crosses the boundary is
  possible; there is no reason to build it now.
- **Spirit and intelligence tables**, which would turn `rulerIds` and the
  planet fields from pending into links and let the geomancy pages show the
  rulers their `{/* tetragram.rulerId */}` comments intended.
- **Polymorphic links** (`enochianLetter["planet/element"]`), which need a
  `to: [...]` form with a tagged-union accessor.
- **Package publishing** (step 4).

## Follow-ups

Four of these are step 3's, and each came out of the adversarial review on
step 2:

- **`Readonly<>` on `Row` and `Table`.** `assemble()` deep-freezes what it
  returns, and the types say nothing about it, so `data.sephirah.keter.scent
  = "x"` compiles and throws at runtime. A `Readonly` mapped type through
  `Row`, `Table` and the nested blocks makes the freeze a compile error
  instead, and a test that the assignment no longer type-checks says so.
- **A per-table wrapper interface, so the name survives.** `Row<I, T>` is a
  `Simplify<…>` intersection, so a hover, an error and step 4's `.d.ts` all
  print the whole expansion rather than `Row<"*", "sephirah">`. An interface
  per table extending it would keep the name in every position that matters,
  at the cost of one declaration per table, generated or written by hand.
- **An explicit kind on the three spheres.** `PlanetId` is "a planet row has
  a symbol", which is a fact about the data doing the work of a declared one.
  A `kind: "planet" | "sphere"` (or the equivalent) on `primum-mobile`,
  `zodiac` and `olam-yesodot` makes the criterion the data's own statement,
  turns the derivation into `Extract` on that field, and lets
  [sets.tsx](../src/study/sets.tsx)'s `"symbol" in planet` filter say what it
  means. The twelve are pinned by a test until then.
- **Three small gaps in the checks, from the re-check.** The graph-level test
  that `mirrors` is declared on both sides lives only in `graph.test.ts`, so
  `pnpm data:check`, and with it `pnpm build` on its own, accepts a one-sided
  declaration the test suite rejects; it belongs in `integrity.ts` as a
  `mirror` kind, so the script and the test share it. The twelve-planet pin
  types its list as `PlanetId[]`, which constrains only one direction at
  compile time; `Record<PlanetId, true>` would make both exact. And an
  inventory failure on an array row names it by `id` or index, while the
  seventy-two carry `no`, so a fault there reads `seventyTwoAngel.0.…`.
- **A watcher for the JSON5 sources.** `pnpm dev` builds `data/dist` once, at
  start; editing a JSON5 while the server is running changes nothing until
  `pnpm data:build` runs again. The build is a few milliseconds over all 28
  files, so watching them and rebuilding is small work, and Turbopack picks
  the JSON up from there on its own.
- **Done in step 2.** [Plan 031](031-seventy-two-angels.md)'s
  `seventyTwoAngelsDerived.ts` still imports `PlanetId` and `ZodiacId`, which
  are derived now and compile unchanged; `PlanetId` is the rows with a symbol
  (see [above](#what-was-decided-while-building-it)). The two `gdGrade`
  collisions are not collisions: `alchemySymbol` and `alchemyTerm` carry a
  numeric field named after a table they do not link to, and the check is
  about accessors, not names, with a test saying so. The `hermetic` block is
  typed as absent on the two paths that have none, and `GDGradeId` has its
  Portal.
- `dictionary.BIAB` was written as part of its neighbour's meaning: `BIA`
  reads "voices, yourBIAB stand", two entries run together in the WE source.
  The new `BIAB` row makes the join visible; fixing `BIA` belongs with the
  rest of the keys page in step 3.
- A duplicate key is invisible to the valibot schemas, which see the
  parsed object and never the source. `amissio`'s first `title`, dead
  because JSON5 keeps the last, was found by hand and is gone in the table
  above; the sources still want a lint of their own.
- Pinning implementation subagents at xhigh needs a `.claude/agents/`
  definition; the session itself runs at xhigh and built-in agents inherit
  it, so none was added.
