# Data layer

Assessment, adversarial review, type spike and decisions, 17–19 September
2026. Read [current status](000-current-status.md) first. Steps 0 to 3 have
landed ([Commits](#commits)), 3c with them; step 4 is not yet implemented.
The long-term goal is to publish `data/` as its own npm package.

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

### Decided on 20 September

Taken by the owner on the step-2 tree, before step 3 was started. They are
recorded here rather than argued again:

13. **Step 3 is three gated branches, not one.** *3a* is types and checks: the
    explicit `kind` below, `Readonly<>` on the row types, a per-table wrapper
    interface, the three gaps the step-2 re-check left in the checks, a
    duplicate-key lint over the JSON5 sources, the run-together `BIA` entry,
    and a watcher for the sources in `pnpm dev`. *3b* is render identity:
    `resolvedInputsHash` (decision 10), and Manasseh's Hebrew once it is in,
    in that order, so that only the shewbread's own identity moves. *3c* is
    the consumers, which is what [step 3 below](#migration) describes: typed
    `get(id)` lookups on the `[id]` routes, Server Components passing ids,
    `/enochian/keys` resolving its dictionary subset on the server with the
    dictionary out of the JSON imports, that page's lookup normalisation and
    its literal `0`, the `TableOfShewbread` hand-join, `pathTarget()` with its
    field-path test, and the JSON5 loaders once nothing imports JSON5. The
    dump-page redesign ([plan 028](028-seo.md#follow-ups)) stays separate and
    comes after 3c with a design pass of its own, so `decycle` stays until
    then.
14. **The three spheres declare a kind, in the planet table.** `primum-mobile`,
    `zodiac` and `olam-yesodot` take `kind: "sphere"` and the twelve planets
    `kind: "planet"`, rather than moving to a table of their own: the sephirot
    reach them through `planetId`, and splitting the table would need a
    polymorphic link the graph format does not have (deferred, below).
15. **The one-time image-identity change decision 10 implies is accepted.**
    Hashing resolved inputs rather than whole tables re-identifies every
    data-dependent component image once, by construction. It happens in 3b;
    published rituals keep their stored bytes, as they always have.
16. **Step 4's package lives in this repository**, as a pnpm workspace package,
    until there is a reason to move it out. The names lean `magick-data` and
    `magick-components` or `magick-react-components` (all three free on npm on
    20 September); it ships the JSON, `graph.json`, the `assemble()` runtime
    and the types, with the dictionary as an entry point of its own, and
    starts at 0.x. The data is CC BY 4.0
    ([data/LICENSE.txt](../data/LICENSE.txt)); the app stays AGPL.

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
| **Step 3b, not step 1:** `tribesOfIsrael.manasseh` → `he: "מנשה"`, `en: "Manasseh"` | The Table of Shewbread's Gemini label changes ([TableOfShewbread.tsx:49](../src/components/gd/TableOfShewbread.tsx)), so its golden bytes move. It waited for the resolved-inputs hash (decision 10) so that only the shewbread's identity would change, not the shared `magickli-component-image-outlines-v1` profile that every registry component publishes under. Done ([below](#step-3b-1)) |

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
3. **Types, identity and consumers**, in three gated branches
   ([decision 13](#decided-on-20-september)):
   - **3a, types and checks.** `kind` on the planet rows, with `PLANET_IDS`
     and an integrity check replacing the "has a symbol" pin;
     `Readonly<>` on `Row` and `Table`; a per-table wrapper interface so the
     name survives a hover; the reciprocal-`mirrors` check moved into
     `integrity.ts`; inventory failures naming an array row by `id` or `no`;
     a duplicate-key lint over the JSON5 sources; `BIA`'s meaning split from
     `BIAB`'s; and a watcher for the sources in `pnpm dev`.
   - **3b, render identity.** `resolvedInputsHash` (decision 10), then
     Manasseh's Hebrew, in that order.
   - **3c, consumers.** Typed-module importers move to the JSON tables or a
     scoped `assemble`; `[id]` routes use the typed lookup helpers; Server
     Components pass ids; `/enochian/keys` resolves its dictionary subset on
     the server, normalises its lookup and drops the `0`, and the dictionary
     stops being a JSON import; `pathTarget()` and its test over
     `TREE_IMAGE_FIELDS`, the study sets and the ritual documents; the
     `TableOfShewbread` hand-join and the `Array.isArray` branches go. The
     JSON5 loaders in `next.config.ts` and `vitest.config.mts` are removed
     once nothing imports JSON5. `decycle` leaves with the dump-page redesign
     ([plan 028 follow-ups](028-seo.md#follow-ups)), not before.
4. **Package extraction** — a separate plan: a pnpm workspace package in this
   repository ([decision 16](#decided-on-20-september)) emitting JSON, ESM and
   `.d.ts` with `graph.json`; semver (rename or remove an id or field: major;
   new rows or fields: minor; corrected values: patch); `resolvedInputsHash`;
   table renames.

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

### Step 3a

Step 3a — types and checks, the first of the three branches
[decision 13](#decided-on-20-september) splits step 3 into — on
`gate/data-layer-3a` from `b0d8d74`. Each commit was checked on its own tree
with `pnpm check`, `pnpm typecheck` and `pnpm test`, `data/dist` wiped before
each so that the wiring is proved rather than assumed; the branch was then
gated as [below](#step-3a-1).

| Commit | Change | Tests |
| --- | --- | --- |
| `a1508b7` docs(plan): Record the owner's decisions for step 3 | Decisions 13 to 16 above, the step-3 split under Migration, and the status page's TODOs regrouped as 3a, 3b and 3c | 4,657 |
| `dbdc7d8` feat(data): Let the planet rows say which they are | `kind: "planet"` or `"sphere"` on all fifteen rows, required by the schema as that enum; `PLANET_IDS` in `Planets.ts` with a check that the list and the data agree in both directions; `sets.tsx` reads the field instead of asking for a `symbol`, and step 0's key-surface pin gains it | 4,659 |
| `e579dac` feat(data): Say in the types that the rows are frozen | `readonly` through `Row`, `Table`, the nested blocks and the arrays, with eight `@ts-expect-error` assertions each paired with the `TypeError` the same line raises | 4,660 |
| `066f5f0` feat(data): Give every table's rows a name of their own | `rows.ts`, one interface per table, and `types.ts` resolving a row through them wherever the scope leaves no link out — the barrel included, which is what makes a `.d.ts` for a row possible at all | 4,662 |
| `a796822` test(data): Close the last two gaps in the checks | The reciprocal-`mirrors` check moves from `graph.test.ts` into `integrity.ts`; an array row is named by `id`, then `no`, then its index | 4,662 |
| `2e2a0aa` test(data): Lint the JSON5 sources for a repeated key | `duplicateKeys.ts`, a scan of the source text rather than the parse, run by `data:check` over every `*.json5` under `data/`; the check takes the directory to read them from, so a planted duplicate walks the wiring the clean sources never do | 4,672 |
| `bcae1f9` fix(enochian): Part BIA's meaning from BIAB's | "voices, yourBIAB stand" becomes "voices, your", and `BIAB` gains the WE attestation that string carried | 4,672 |
| `cfe677b` build(data): Watch the JSON5 sources while dev runs | `build.mts --watch`, one watcher per directory, and `data/dev.mts` building the tables before it starts the watcher and `next dev` beside each other, so that both stop together | 4,672 |

An adversarial review of the eight, at xhigh, found the branch sound and one
thing wrong: the wrapper interfaces did not reach the barrel, only a full
`assemble()`, so the one object that needed a name still had none
([below](#the-wrapper-interfaces-work-and-reach-the-barrel)). Each of its
findings was amended into the commit that introduced the thing rather than
appended, so each commit stands on its own: the scope rule and its assertion
into the interfaces, the awaited first build and the `'error'` handler into
the watcher, the injectable source directory and a planted duplicate into the
lint, `BIAB`'s WE meaning into the parting, and the moved key-surface pin into
`kind`'s message.

A ninth commit, `docs(plan): Record the data layer's third step`, adds the
sections below; as in the earlier steps it is not in the table, which it would
have to predict.

### Step 3b

Step 3b — render identity, the second of the three branches — on
`gate/data-layer-3b` from `0049677`. Each commit was checked on its own tree
with `pnpm check`, `pnpm typecheck` and `pnpm test`, `data/dist` wiped before
each; the branch was then gated as [below](#step-3b-1).

| Commit | Change | Tests |
| --- | --- | --- |
| `74aa199` feat(render): Hash the data an image draws into its identity | `dataInputs.ts`, an inputs spec on every registry entry, `identity.inputs` on every rendered image, and the three tests that bound the specs from both sides. No image's bytes move | 4,696 |
| `8fdf0f1` feat(offline): Bind the image inputs hash into catalogs and plans | Where the hash is recorded, said out loud and held there by tests; neither profile string bumped, with the reason written down beside each | 4,698 |
| `d419f9d` fix(kabbalah): Give Manasseh his own Hebrew name | The data fix step 3b was waiting for. One image's bytes and one image's inputs hash move | 4,698 |

A fourth commit, `docs(plan): Record the data layer's third step, part b`,
adds the sections below; as in the earlier steps it is not in the table, which
it would have to predict.

### Step 3c

Step 3c — consumers, the last of the three branches — on
`gate/data-layer-3c` from `827cf5e`. Each commit was checked on its own tree
with `pnpm check`, `pnpm typecheck` and `pnpm test`, `data/dist` wiped before
each; the branch was then gated as [below](#step-3c-1).

| Commit | Change | Tests |
| --- | --- | --- |
| `40272a5` feat(data): Look rows up by a string id without losing the type | `rowOf(table, id)`, the four `[id]` routes and the two client components behind them, and `entities.ts`'s local `own()` with the four casts that went with it; a route-level test pins which ids render and which 404 | 4,711 |
| `d13b76c` feat(data): Validate dotted field paths against the graph | `pathTarget(table, path)`, walking the graph rather than a row, and the test that reads every public path from the file that owns it | 4,726 |
| `a6c9fea` refactor(gd): Read the tribes through the zodiac's link | The Table of Shewbread's hand-join, over a scoped `assemble()` of the two tables it draws | 4,726 |
| `6b641af` refactor(geomancy): Read a figure's sign and planets off the row | The chart's two raw table imports and the judge's three lookups; a figure is typed as what it is, `TetragramRow` | 4,726 |
| `88724fa` build(data): Emit the Enochian dictionary as a typed module | `data/dist/enochian/dictionary.mjs`, with a generated `.d.mts` naming one hand-written type: 19 types where a JSON import costs 19,300 | 4,726 |
| `4fddfb9` feat(enochian): Resolve the keys' dictionary entries on the server | 180 entries for the 181 words the Keys use, the U↔V and hyphen normalisation, and the literal `0` | 4,732 |
| `d35f69e` refactor(kabbalah): Load the angels' text from the emitted JSON | The last JSON5 import; dynamic and one per language, as before | 4,732 |
| `f818eff` build: Retire the JSON5 loaders | The webpack rule, the Turbopack rule and the loader it named, vitest's transform, and `*.json5` in `types/global.d.ts` | 4,732 |

A ninth commit, `docs(plan): Record the data layer's third step, part c`,
adds the sections below; as in the earlier steps it is not in the table, which
it would have to predict.

### The dictionary, after step 3

The two dictionary findings step 3 left, on a branch from `a6a4c7f`
fast-forwarded into `main`, checked commit by commit the same way and gated
as [below](#the-dictionary-after-step-3-1):

| Commit | Change | Tests |
| --- | --- | --- |
| `96f9fa9` fix(enochian): Drop the dictionary's 128 repeats | Every meaning or pronunciation object identical to an earlier one in its entry: 81 meanings and 47 pronunciations across 77 entries, 513 lines deleted and none added. Whatever differs in its source, citation or note stays | 4,743 |
| `c5855df` test(data): Check the dictionary for repeats | `checkDictionary()` in `integrity.ts`, over the one source that is no table, read from the module the build emits; a `repeat` failure kind; the dictionary is an argument to `checkIntegrity()` as the sources directory is, so that the test can plant one | 4,744 |
| `34a8fb9` fix(enochian): File the numerals as strings | The twenty-two numbers among the meanings become the strings the type says they are; they are the Enochian numerals, not gematria | 4,744 |
| `8646f0a` test(data): Hold the dictionary to its type | A strict valibot schema for an entry beside the tables', parsed by the check; `source2` and `note` declared on a pronunciation; a test that the schema and the type agree both ways | 4,745 |
| `c47d6cc` docs(data): Say why build.mts is .mts, correctly | The header's claim about `import.meta.url` under tsx, which a probe refuted | 4,745 |

A sixth, `docs(plan): Record the dictionary's repeats and numerals`, adds
this table and that section.

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
  criterion explicit was a follow-up, and is step 3a's `kind`
  ([below](#kind-is-data-the-types-cannot-read)).
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

### Step 3a

The gate ran on the final tree in the `gate/data-layer-3a` worktree with the
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
| `pnpm test:coverage` | 4,672 passed, 16 skipped, thresholds met; `data/` covers 99.65 % of statements and 98.42 % of branches |
| `pnpm build` | webpack, 215 pages prerendered |
| `pnpm check:turbopack` | Turbopack, 215 pages prerendered |

What a reader sees change is two things, both small:

- `/astrology/planet/<id>` tables every key of the row it does not lay out
  itself, so each of the fifteen now shows a `kind` row. The dump is plan
  028's to replace.
- `/enochian/dictionary` gives `BIA` the meaning "voices, your" rather than
  "voices, yourBIAB stand", and `BIAB` reads "stand" twice, once for the Keys
  and once for WE, whose attestation the run-together string was carrying.
  `/enochian/keys` shows `BIA` under the second key and `BIAB` under the third.

Nothing else. Both geomancy pages are byte-identical — they are pinned by
`renderToStaticMarkup` snapshots — and every one of the six pinned component
images was re-rendered at the tip and compared:

| Image | Bytes | SHA-256 |
| --- | ---: | --- |
| `tree-of-life`, the 2=9 ritual's query | 150,736 | `96516a75ce13374a234de855bf596ce1a50d1e9adf7340b398e4b3a2b7e4858a` |
| `table-of-shewbread` | 136,294 | `df3c37911f14c3e81040d62d74892b97fdb0c72027ef390323f907e795ceb516` |
| `astro-geomancy-chart` | 52,476 | `eb2f1b6fe2fef2f563ee164de6e403ca9f398ec4706c9ad331195bc34286bffa` |
| `astro-geomancy-chart?m=2222111122221111&width=256` | 56,498 | `18ecbf9feea69d75bb979319087b74d12d04a7399e3051f685893d6fbf328821` |
| `seven-branched-candlestick` | 52,363 | `5d8b637f7ceb159014b1bf7322b51456a8bd2b730bdb699883288ed6bf063331` |
| `enochian-tablet` | 120,471 | `a35f3c18a3a61d17c48d81e7e7b27def96fc43b896837297039a6ab8c20024e8` |

Byte for byte what steps 1 and 2 left, under the unchanged
`magickli-tree-image-outlines-v3` and `magickli-component-image-outlines-v1`,
so published rituals are untouched. The one-time move every data-dependent
identity takes is 3b's ([decision 15](#decided-on-20-september)).

#### The wrapper interfaces work, and reach the barrel

`interface SephirahRow extends Row<"*", "sephirah"> {}` is legal — the
instantiated mapped type has statically known members, so there is no TS2312 —
and [types.ts](../data/types.ts) resolves a row through
[rows.ts](../data/rows.ts)'s map, so the links inside a row are named too.

Which rows those are is the part that had to be got right. The barrel is not a
full `assemble()`: it holds 23 of the 26 tables
([above](#the-three-tables-the-barrel-does-not-hold)), so a rule that named
rows only where the scope is `"*"` would have named the rows of
`assemble(tables)`, which nothing but the test suite builds, and left
[data.ts](../data/data.ts) — the object step 4's package emits a declaration
for — printing the whole expansion. The rule is instead that a scope is
*complete* when it holds every table a link names at either end: a table
outside such a scope declares no link into the scope and derives no back-link
on it, so its absence changes no row, and `Row<I, T>` is `Row<"*", T>` member
for member. The three the barrel leaves out are named in no link in either
direction — which is why they are left out — so the barrel is complete and its
rows are named. A narrower `assemble()` keeps the mapped type, since its rows
really do have fewer links than the name would promise.

`tsc --declaration` over the barrel, with a probe beside it exporting one of
its rows, emitting to a scratch directory:

| | Before | After |
| --- | --- | --- |
| `data/data.d.ts` | not emitted at all: TS4023, `tetragram` "has or is using name 'Simplify' from external module … but cannot be named" | `readonly acquisitio: import("./rows").TetragramRow;` through both tables it exports by name |
| `export const keter = data.sephirah.keter` | the same TS4023, on `keter` | `export declare const keter: import("./rows").SephirahRow;` |
| An assignment error on a link | `Type 'Simplify<{ readonly id: string; … } & { readonly planetId?: … } & Links<...>> \| undefined' is not assignable…` | `Type 'ArchangelRow \| undefined' is not assignable to type 'ArchangelRow'` |

The first two lines are what matters for step 4: a package cannot emit a
`.d.ts` for the barrel at all without either these interfaces or exporting
`Simplify`. Because a link declared to one of the three left-out tables would
narrow the barrel's scope and quietly take the names away again,
[types.test.ts](../data/types.test.ts) asserts that `data.sephirah.keter` off
the barrel is `SephirahRow` exactly — type equality, not assignability — while
the scoped `@ts-expect-error`s on the other side keep the mapped-type branch
live.

The name is `<Table>Row` and not `<Table>` because the typed modules beside
each JSON file already export `Sephirah`, `Planet` and the rest as
`Raw & Partial<Links>`, the shape that accepts a raw row and an assembled one
alike; that meaning is kept.

#### `kind` is data the types cannot read

A JSON import widens `"planet"` to `string`, so no literal type survives the
import and `PlanetId` cannot be an `Extract` over `kind` the way it could be
over a field of an `as const` TypeScript module. The twelve are therefore
written out in [Planets.ts](../data/astrology/Planets.ts) —
`as const satisfies readonly PlanetKey[]`, which checks every member against
the table's keys — and the other direction, that they are exactly the rows of
kind `"planet"`, is an integrity check, so `pnpm data:check` and `pnpm build`
reject a drift rather than a test alone.

A later build could emit `as const` TypeScript modules instead of JSON and
make `kind`, `category`, `quadruplicity` and the other closed fields literal
types. It was not done now because the JSON is the thing other languages and
step 4's package read, `resolveJsonModule` costs nothing to keep, and an
emitted `.ts` per table would have to be type-checked on every build; it is
worth revisiting when the package is built.

#### Cost

`tsc --noEmit --incremental false --extendedDiagnostics` over the whole
repository, after `data:build` and `next typegen`, each tree measured in the
same worktree on the same machine:

| Tree | Types | Instantiations | Check |
| --- | ---: | ---: | ---: |
| `main` at `4a29f41` | 396,700 | 1,893,175 | 6.60 s |
| `dbdc7d8`, `kind` | 396,759 | 1,893,406 | 6.73 s |
| `e579dac`, `readonly` | 396,643 | 1,866,069 | 6.65 s |
| `066f5f0`, the wrapper interfaces | 395,564 | 1,837,250 | 6.75 s |
| `cfe677b`, the tip | 395,990 | 1,837,567 | 6.54 s |

The branch rows were measured before the rebases that followed, on the trees
as they stood on `4a29f41`; `main`'s later commits shift every row by the same
small constant (86 types and 481 instantiations at `6224bca`), so the delta of
55,608 is unchanged and a re-measurement of a row on today's base will not
reproduce its number exactly.

The whole branch is 55,608 instantiations *below* `main`, which was not the
expectation: `readonly` was assumed to cost and the interfaces to save, and in
fact both saved — the modifiers by 27,337 and the interfaces, which give
TypeScript one named target to resolve a row to rather than an intersection to
rebuild at every link, by a further 28,819. Most of that second figure is the
barrel: the names reach it only because the scope rule above asks whether the
scope is complete rather than whether it is `"*"`, and that alone is 22,052 of
it. `kind` costs 231 and the checks, the lint and the watcher 317 between them.

#### The watcher, and what Linux does with a rename

`fs.watch(dir, { recursive: true })` over `data/` was written first and is
wrong here: on Linux it follows the file, so an editor that saves by writing a
new file and renaming it over the old one — `sed -i`, vim, VS Code — is
invisible to it from the *second* save on. Measured with a scratch script: the
first save raised three events and every save after it none. One watcher per
directory, non-recursively, keeps firing, because the directory is what it
watches; that is what [build.mts](../data/build.mts) does, over the nine
directories that hold sources. A directory added later is not watched until
the task restarts, which is one of the two things given up. The other is
`dist/graph.json`: the watch is over the JSON5 and nothing else, so an edit to
[graph.ts](../data/graph.ts) leaves that file as the first build wrote it.
Nothing under `src/` reads it — it is there for a reader that is not
TypeScript — and the graph itself reaches the app as a module, which Next
reloads on its own, so nothing stale is ever served.

`pnpm dev` and `pnpm dev:webpack` run through [dev.mts](../data/dev.mts),
which builds the tables, *awaits* that, and only then spawns the watcher and
`next dev`, stopping both together. `data/dist` is gitignored, so without the
await a fresh checkout has `next dev` racing the first build: with the
directory emptied and a stub in `next`'s place, the concurrent version's
server started on nothing and this one's on all 31 files.

Verified by hand on the webpack dev server (Turbopack refuses the worktree's
symlinked `node_modules`, "points out of the filesystem root"), on a fresh
port: three consecutive `sed -i` saves of `planets.json5` each logged one
rebuild and each reached `/astrology/planets` in the markup — "Sol" to "Sol
Invictus" to "Sol Invictus II" and back to "Sol". A syntax error mid-save is
reported and the watch goes on. SIGINT to the process group (Ctrl-C), SIGTERM
to the wrapper alone, either child exiting, and `next` missing from PATH —
which raises `'error'` and never `'exit'`, so without a handler it would take
the wrapper down and leave the watcher running — each left nothing behind in
`ps`.

### Step 3b

The gate ran on the final tree in the `gate/data-layer-3b` worktree with the
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
| `pnpm test:coverage` | 4,698 passed, 17 skipped, thresholds met; `dataInputs.ts` joins the coverage list and covers 100 % of statements, branches, functions and lines, as do `registry.tsx`, `outlineTreeImage.ts` and `componentImage.tsx` beside it |
| `pnpm build` | webpack, 215 pages prerendered |
| `pnpm check:turbopack` | Turbopack, 215 pages prerendered |

What a reader sees change is one label: the Gemini position on
[/gd/symbols/shewbread](../src/app/gd/symbols/shewbread/shewbread.tsx) reads
מנשה, where it read בנימין — the same name Sagittarius carries, since
Manasseh's Hebrew was Benjamin's byte for byte ([data fixes](#data-fixes)).
Nothing else: the tribes are in no search description, no study set and no
other component.

Every pinned component image was re-rendered at the tip. One moved:

| Image | Bytes | SHA-256 | Inputs |
| --- | ---: | --- | --- |
| `tree-of-life`, the 2=9 ritual's query | 150,736 | `96516a75ce13374a234de855bf596ce1a50d1e9adf7340b398e4b3a2b7e4858a` | `2591a504…` |
| `table-of-shewbread` | 136,643 | `34e0fce138e4b50930aac5b226e71fbe452eb1ba7db5a9bb1929e0300e106e1b` | `dfd57ffb…` |
| `astro-geomancy-chart` | 52,476 | `eb2f1b6fe2fef2f563ee164de6e403ca9f398ec4706c9ad331195bc34286bffa` | `c89a608f…` |
| `astro-geomancy-chart?m=2222111122221111&width=256` | 56,498 | `18ecbf9feea69d75bb979319087b74d12d04a7399e3051f685893d6fbf328821` | `c89a608f…` |
| `seven-branched-candlestick` | 52,363 | `5d8b637f7ceb159014b1bf7322b51456a8bd2b730bdb699883288ed6bf063331` | `a8a08155…` |
| `enochian-tablet` | 120,471 | `a35f3c18a3a61d17c48d81e7e7b27def96fc43b896837297039a6ab8c20024e8` | `63b83840…` |
| `rose-sigil?text=גדי` | 13,454 | `6edd6bd2b48b513facf72cd6a9d5e036338f4d698df6f24967163e5ee340e137` | `f88d8766…` |

The shewbread was 136,294 bytes, SHA-256
`df3c37911f14c3e81040d62d74892b97fdb0c72027ef390323f907e795ceb516`, inputs
`9b1eb246…`, through steps 1, 2 and 3a, and both of its figures moved with
Manasseh's name. The other six are byte for byte what step 3a left, and their
inputs hashes did not move either — which is the whole of decision 10 in one
table, and is asserted rather than observed for all six inputs hashes and
five of the seven byte figures, pinned in
[registry.test.tsx](../src/render/registry.test.tsx); the earth tablet, the
chart at `m=2222…` and the rose sigil at `text=גדי` are recorded from the
gate's own renders and pinned nowhere. A data edit that reached further than
it should would still fail the suite, through the hashes.

One social card draws that art, and no other:
`/og/gd/symbols/shewbread.png` goes from 48,416 bytes, SHA-256
`783f0cc120381106aba2297e85fe8a7a22e82836e9b6e6ffd1e241674468fa72`, to
46,691 bytes,
`f7c94fbfc5e1f8eaca151ce903639e527b2be9acd9c152c7a4645f4b4d2fe5ac`. The card
art alone — the PNG fitted to the frame — goes from 61,755 bytes,
`e7886ce3…`, to 61,793, `e7cd4b33…`. As in step 1, no card's section or title
moved, so nothing else on any card did.

#### Render identities and the data they draw

An image's identity named its renderer: the outline profile, the resvg
version, the WASM digest, the font digests and the default font size. The
data it drew was not in it, so publishing a data fix meant bumping the profile
by hand — and the profile is shared, so plan 028's archangel fix moved
`magickli-tree-image-outlines-v1` to `v2` and with it every Tree ever
published. Decision 10 replaces that with a second half:

```
identity.inputs = { spec: "magickli-image-inputs-v1", sha256 }
```

`sha256` is over the *resolved* value of every field the component's render
reads. Each registry entry declares those fields as groups of
`{ table, rows, fields }` — the same dotted paths the render passes to
`readFieldPath` — and [dataInputs.ts](../src/render/dataInputs.ts) resolves
them over the barrel, writes them in a canonical form (object keys sorted,
array and row order kept because both are drawn, `undefined` distinct from
absent and from the string `"undefined"`, every row named so a rename counts)
and hashes that. The rule the profiles now stand under is that **bytes must
not change under (profile, inputs hash, query)**; the profile moves when the
renderer moves, and nothing else. [Plan 027](027-component-exports.md)'s
"do not bump the outline profile unless bytes change" is superseded there.

Resolving before hashing is what makes the spec short and complete at once.
The Tree's spec names two tables, `sephirah` and `tolPath`, but the labels it
draws reach nine more through links, and an edit in any of them moves the
resolved value and so the hash: renaming Metatron, or repointing Keter's
`godNameId`, moves the Tree's hash and no other image's. The rose sigil is the
other end of the same idea — its letters are geometry in
[roseSigilGeometry.ts](../src/components/gd/roseSigilGeometry.ts), not a
table, so its spec is empty and no data edit can ever move it.

What each component declares:

| Image | Tables, rows and fields |
| --- | --- |
| `tree-of-life` | `sephirah`, every row in the table's own order (it is drawn by position), `id`, the four web colours and their text colours, `color.strokeColor`, `color.strokeDasharray`, and all thirty of `TREE_IMAGE_FIELDS`; `tolPath`, the twenty-four of `TREE_PATHS`, `id`, `hermetic.hebrewLetter.letter.he`, `hebrew.hebrewLetter.letter.he`, `hermetic.pathNo`, `hermetic.tarotId` |
| `table-of-shewbread` | `zodiac`, every row in order, `symbol`, `tetragrammatonPermutation`, `tribeOfIsraelId`; `tribeOfIsrael`, every row, `name.he` |
| `astro-geomancy-chart` | `tetragram`, every row, `rows`, `zodiacId`, `planetIds`; `zodiac`, every row, `symbol`; `planet`, every row, `symbol` |
| `seven-branched-candlestick` | `planet`, the seven branches in drawing order, `symbol`, `archangel.name.he`, `hebrewLetter.letter.he`, `name.he.he` |
| `enochian-tablet` | `enochianTablet`, `earth` and `air`, `grid` |
| `rose-sigil` | nothing |

`id`, `hermetic.pathNo` and `hermetic.tarotId` reach the source SVG — element
ids, `<a>` hrefs and a `<title>` — and not the outlined bytes, which strip all
three. They are hashed anyway: `sourceSha256` is recorded per capture too, and
an identity that did not move with it would be a smaller version of the same
problem.

#### Proving the specs, both ways

A spec is wrong in two directions, and each has its own test.

- **Nothing listed is unread.** Every `(component, table, row, field)` the six
  specs name — 682 of them — is changed in a copy of the data and must move
  that component's hash
  ([dataInputs.test.ts](../src/render/dataInputs.test.ts)). `setProperty`
  builds intermediate objects, so a field a row lacks today (Da'at's soul,
  Keter's dash pattern) is proved to be read rather than skipped.
- **Nothing drawn is unlisted.** `RENDER_INPUT_SWEEP=1` changes every field of
  every row of every one of the 26 tables in turn, redraws all six components
  at every query that draws anything different, and requires a component whose
  drawing moved to have moved its hash
  ([dataInputs.sweep.test.ts](../src/render/dataInputs.sweep.test.ts)). It
  takes minutes, so the normal suite skips it; it was run once on this branch
  ([below](#the-sweep)).

Both run the real pipeline over changed tables rather than a mock of it. The
tables are JSON modules and `assemble()` freezes its clones, so a changed
table has to arrive as a different module:
[renderWithTables.ts](../tests/renderWithTables.ts) mocks each emitted JSON
file and re-imports the registry, the contracts and `dataInputs` on top of it.
What it compares is the JSX the outliner is handed rather than the outlined
bytes. That is the same claim made more strictly — the outliner is a pure
function of that string, so equal source is equal bytes, while the source can
move when the bytes do not — and it is milliseconds rather than a full
render, which is what makes a sweep of this size possible at all.

Four named cases sit between the two
([dataInputs.mutation.test.ts](../src/render/dataInputs.mutation.test.ts)): a
tribe's Hebrew name reaches the shewbread and nothing else, an archangel's
Hebrew name reaches the Tree through a link the spec never names, a repointed
`godNameId` does the same, and four fields no component draws —
`sephirah.tenHeavens`, `zodiac.emoji`, `tribeOfIsrael.name.en`,
`planet.scent` — move neither bytes nor hash.

#### The sweep

Run on the branch tip, `RENDER_INPUT_SWEEP=1 vitest run
src/render/dataInputs.sweep.test.ts`, on Node 24.18.0: **3,721 changes,
1,001 redrawn images, 99 seconds, no failure.** Every change that moved a
component's drawing had moved that component's inputs hash.

Every one of those changes is to a leaf value: the sweep adds, removes,
renames and reorders no row, and fills no empty array. The spec covers those
by other means, since rows are named, key order is kept and links are
resolved, and probing them by hand moved source and hash together: a
sephirah reorder, a tribe rename, a `hermetic` block removed. An unlinked
archangel row added moved neither.

| Image | Changes that redrew it |
| --- | ---: |
| `tree-of-life` | 531 |
| `enochian-tablet` | 312 |
| `astro-geomancy-chart` | 68 |
| `table-of-shewbread` | 48 |
| `seven-branched-candlestick` | 42 |
| `rose-sigil` | 0 |

The counts are the mechanism written out. The tablet's 312 are exactly its two
grids, 13 by 12 each, and nothing else in that table — not even the row's own
`id`. The shewbread's 48 are twelve signs times three fields plus the twelve
tribes the signs point at; the two tribes no sign names, Joseph and Levi,
redrew nothing, which is the over-inclusion `rows: "*"` buys and the reason it
is worth buying. The candlestick's 42 are seven planets times four own fields
plus the seven archangels' and seven letters' Hebrew, reached through links
its spec never names. The rose sigil's zero is the point: 3,721 changes to the
data and not one of them can move it.

Two more over-inclusions of the same kind: the tablet hashes both grids for
either slug's render, so an air-grid edit re-identifies the earth image; and
the chart hashes every planet and sign symbol and their key order although it
looks them up by key, so reordering `tetragram` or `planet` moves its hash
with the source unchanged. Each is a re-identification that could have been
avoided, never a missed one.

The other 2,720 changes moved nothing anywhere, which is the everyday case
decision 10 exists for — a `scent` typo, a meaning reworded, an angel of the
seventy-two corrected — and none of them now re-identifies a published image.

#### Effects on publications

As in [plan 028](028-seo.md#archangel-data), and for the same reasons:

- Offline bundles already published keep their stored bytes. Each ritual's
  next publication draws its images and builds its own manifest.
- Every data-dependent image's identity changes once with the first of these
  commits, bytes unchanged, which is the one-time cost
  [decision 15](#decided-on-20-september) accepts. From here on only the
  images an edit can reach are re-identified.
- A publication that starts before the deploy and is retried after it is
  replayed, not refused: since 16 September a retry is matched on manifest and
  policy rather than on the plan digest, so its stored plan keeps the identity
  it was validated under, and only a manifest change, which means bytes moved,
  is an operation conflict. The first two commits move no bytes. The plan has
  always carried the renderer identity; the digest moves, and nothing keys on
  it.

#### What was decided while building it

- **Neither the catalog nor the plan profile is bumped.**
  `magickli-generated-image-catalog-v1` and `magickli-ritual-asset-plan-v5`
  name their own envelopes, and every key of both is where it was and means
  what it did; what 3b adds sits inside `renderer`, which the catalog copies
  verbatim, which no reader keys on, and which carries its own version string.
  Bumping the plan would also need a migration of the check constraint in
  [ritualBundles.ts](../src/db/schema/ritualBundles.ts) for a change no reader
  can see. The Tree's own move from `v2` to `v3` (plan 030) bumped neither.
- **`rows: "*"` where the drawn set is data, a list where the code names it.**
  The candlestick's seven planets and the two tablets are named in code, so
  the spec names them; the twelve signs and the sixteen figures are drawn from
  whatever the table holds, in the order it holds them, so the spec takes the
  table. Being exact would have meant deriving the row set from the data — for
  instance the twelve tribes the signs point at, rather than all fourteen —
  and a derived row set goes stale silently, which is the failure that
  matters. Two tribes' Hebrew names are therefore hashed by an image that does
  not draw them; the cost is a re-identification that could have been avoided,
  never a missed one.
- **The spec lives on the registry entry.** The registry is what "binds the
  renderer identity" ([plan 027](027-component-exports.md)), and a component
  that starts reading a new field is edited next to the entry that declares
  it. `dataInputs.ts` holds only the resolver and the encoding.
- **`enochianTablet` is not in the barrel**, being named in no link
  ([above](#the-three-tables-the-barrel-does-not-hold)), so the source a spec
  resolves against is the barrel plus that one table. Its rows are the raw
  JSON either way.
- **The hash is resolved once per process.** The data is frozen for the life
  of the process, so `componentInputsHash(slug)` memoises; the tests that hash
  changed data call `resolvedInputsHash` with tables of their own.
- **The encoder refuses what it cannot write down.** A function, a symbol or a
  cycle throws rather than hashing to something arbitrary. A spec names leaf
  fields, so nothing reaches it today — but a spec that named a whole
  assembled row would otherwise walk the entire graph.

Browsers were not opened. The one visible change is a label inside a component
pinned by server-rendered bytes, and its card is pinned the same way.

### Step 3c

The gate ran on the final tree in the `gate/data-layer-3c` worktree with the
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
| `pnpm test:coverage` | 4,732 passed, 17 skipped, thresholds met; the three new modules join the coverage list — `rowOf.ts` and `keyEntries.ts` at 100 % of statements, branches, functions and lines, `pathTarget.ts` at 98.30 %, 98.03 %, 100 % and 100 %, its one uncovered line the `as` accessor name no link in this graph uses |
| `pnpm build` | webpack, 215 pages prerendered |
| `pnpm check:turbopack` | Turbopack, 215 pages prerendered |

What a reader sees change is on one page. `/enochian/keys` gives `URBS`,
`GIUI` and `GRSAM` their dictionary meanings, which it never found before
([below](#casarma-is-not-a-lookup-problem)), and the pronunciation cell of a
word with no pronunciation is empty where it printed a literal `0`:
`{dict.pronounciations.length && …}` renders the zero. Nothing else. The four
`[id]` routes render the same pages and refuse the same ids, the Table of
Shewbread and the geomancy pages are byte-identical, and every pinned image
keeps its bytes and its inputs hash:

| Image | Bytes | SHA-256 | Inputs |
| --- | ---: | --- | --- |
| `tree-of-life`, the 2=9 ritual's query | 150,736 | `96516a75ce13374a234de855bf596ce1a50d1e9adf7340b398e4b3a2b7e4858a` | `2591a504…` |
| `table-of-shewbread` | 136,643 | `34e0fce138e4b50930aac5b226e71fbe452eb1ba7db5a9bb1929e0300e106e1b` | `dfd57ffb…` |
| `astro-geomancy-chart` | 52,476 | `eb2f1b6fe2fef2f563ee164de6e403ca9f398ec4706c9ad331195bc34286bffa` | `c89a608f…` |
| `astro-geomancy-chart?m=2222111122221111&width=256` | 56,498 | `18ecbf9feea69d75bb979319087b74d12d04a7399e3051f685893d6fbf328821` | `c89a608f…` |
| `seven-branched-candlestick` | 52,363 | `5d8b637f7ceb159014b1bf7322b51456a8bd2b730bdb699883288ed6bf063331` | `a8a08155…` |
| `enochian-tablet` | 120,471 | `a35f3c18a3a61d17c48d81e7e7b27def96fc43b896837297039a6ab8c20024e8` | `63b83840…` |
| `rose-sigil?text=גדי` | 13,454 | `6edd6bd2b48b513facf72cd6a9d5e036338f4d698df6f24967163e5ee340e137` | `f88d8766…` |

Byte for byte what step 3b left, under the unchanged
`magickli-tree-image-outlines-v3` and `magickli-component-image-outlines-v1`.
The shewbread is the sharp one here: its component stopped joining the tribes
by hand and reads the link instead, and the same bytes mean the same join.

#### Typed lookups, and the hole they close

`data.sephirah[someId]` with a `string` id is `any` under the repository's
`strict: false`: the fields, the links and their optionality are all erased at
the one place a dynamic route reaches the data, and an unknown id reads as a
row rather than as `undefined`. [rowOf.ts](../data/rowOf.ts) is an
`Object.hasOwn` lookup returning `Row | undefined`, and decision 9 is closed
with it.

It takes the table rather than living on it, because a table is a frozen plain
object that crosses the Server → Client boundary and a method would not
([alternatives](#alternatives-considered)). The four `[id]` routes now 404 on
its `undefined` rather than on a search description rebuilt to test
existence — the same condition, since `planetPage(id)` was `own(Data.planet,
id)` — and the sephirah and path client components look their row up by key
instead of scanning `Object.values(...)` for it.
[entityRoutes.test.tsx](../src/app/entityRoutes.test.tsx) renders all four and
asserts the 404 for `missing`, `constructor` and `__proto__`, which is the
inherited-property hole `Object.hasOwn` is there for.

#### `pathTarget`, and what it covers

[pathTarget.ts](../data/pathTarget.ts) is the static half of decision 8.
Given a table and a dotted path it walks [the graph](../data/graph.ts) — a
segment that is a link's accessor is a hop, including one declared inside a
nested block such as `hermetic.hebrewLetterId`, and a list is walked through
only by an index, as dot-prop would — and answers the table and field the path
lands on, or `undefined`. A segment that is no accessor must be a field some
row of the current table has, so the walk reads the tables as well as the
graph; that is also why it is a build-time and test-time helper rather than
something a page imports, since it brings the tables with it.
`readFieldPath` is untouched: the runtime stays dot-prop.

[fieldPaths.test.ts](../src/fieldPaths.test.ts) reads each list from the file
that owns it rather than copying it, so a path added anywhere is a path it
checks. What it covers, and all of it resolves:

| Where the paths come from | How many | Read from |
| --- | ---: | --- |
| `TREE_IMAGE_FIELDS`, from `sephirah` | 30 | [treeOfLife.ts](../src/render/contracts/treeOfLife.ts) |
| `GradeTree`'s `field`, `topText` and `bottomText` | 5 | the component's source |
| `field=`, `topText=` and `bottomText=` in the ritual documents | 5 | `src/doc/*.jade` |
| Both blocks `letterAttr=` can name, from `tolPath` | 2 | the Tree's contract |
| The study sets' string `question` and `answer` | 45 | [sets.tsx](../src/study/sets.tsx) |

The five the documents ask for are `name.roman`, `godName.name.he`,
`angelicOrder.name.he`, `index` and `archangel.name.he`, all in the 2=9
ritual's one `/api/treeOfLife` query; no document names a `letterAttr`, so
both values the contract allows are checked instead. Each study set is matched
to its table by the identity of the rows it holds — `filter()` and
`omit()` keep the barrel's own row objects — and the three sets that build
their cards rather than take a table (`alchemy-basic-terms`, `kerubim-face`,
`kerubim-zodiac`) are named in the test and have their two fields checked on
the objects instead. A set whose `question` or `answer` is a function
(`ten-heavens`, and `geomancy-symbol-names`'s question) reads its fields in
code and has no path to check; that is the one gap.

Nothing is rejected today. The negatives are asserted in
[pathTarget.test.ts](../data/pathTarget.test.ts) instead: an unknown field, a
field under a link that has none, an id used where its accessor belongs
(`godNameId.name`), a list without an index (`planets.symbol`), the accessor
of a nested link read at the top level (`tolPath.hebrewLetter`), an empty
path, and a link whose target the caller did not hand over.

#### The dictionary leaves the JSON imports

A JSON import of the dictionary costs TypeScript about 19,300 types, because
it infers the literal type of a 1,903-key object, and a cast after the import
does not undo an inference that has already happened (decision 1). So it is
the one source the build emits as a module rather than as JSON:
`data/dist/enochian/dictionary.mjs`, with `dictionary.d.mts` beside it naming
`EnochianDictionary` from the hand-written
[dictionaryEntry.ts](../data/enochian/dictionaryEntry.ts) and nothing else.
`tsc --listFiles` reads the declaration and never the module, and the whole
file costs 19 types and 21 instantiations ([below](#cost-2)).

The value is written as `JSON.parse` of a string literal, which is what a
bundler makes of a JSON import anyway and what an engine parses fastest at
this size, so the page that wants the whole of it pays nothing for the
change: `/enochian/dictionary` loads 1,547,045 bytes of client chunks at the
tip where `main` loaded 1,547,250, and 451,464 gzipped where `main` was
450,069 — the 1.4 KB is chunk splitting, since the module is now reached from
one route rather than two.

The build owns three kinds of output under `data/dist` now — `.json`, `.mjs`
and `.d.mts` — and prunes all three; the watcher picks the dictionary up as it
picks up a table, which it did not before, since the file was skipped outright.

#### What the keys page ships

`/enochian/keys` reads 181 words and shipped all 1,903, because the lookup was
in the client component. The page is a Server Component, so it resolves them
there ([keyEntries.ts](../src/app/enochian/keys/keyEntries.ts)) and hands the
client a map of word to entry. `next build --webpack` under
[ci.yml](../.github/workflows/ci.yml)'s environment, the chunks read from the
prerendered HTML under `.next/server/app`, raw bytes and then gzipped:

| `/enochian/keys` | Client chunks | Flight payload | Prerendered HTML |
| --- | ---: | ---: | ---: |
| `main` at `d769d56` | 1,565,433 / 455,391 | 16,208 / 2,863 | 109,468 / 15,343 |
| The tip | 1,322,020 / 423,623 | 42,582 / 7,387 | 140,203 / 20,166 |

The chunk that goes is the dictionary's own, 243,702 bytes raw and 31,896
gzipped, which is the figure the assessment recorded. What replaces it is the
180 entries in the route's Flight payload, 26 KB raw and about 4.5 KB gzipped,
which the prerendered HTML carries too. Taking the HTML and the chunks
together, a first visit is 212,678 bytes lighter, 25,944 of them gzipped. (The
two commits that made the change quote their own trees' figures, which are
within a hundred bytes of these; the chunk hashes move as the later commits
land.)

The Table of Shewbread's scoped `assemble()` is the other side of the ledger,
and is what the scope is for: `/gd/symbols/shewbread` grows by 4,346 bytes
raw and 2,592 gzipped — `assemble()` and the graph literal — where importing
the barrel would have added its 55,842 raw and 16,099 gzipped. `/gd/symbols`
is unchanged either way, being within 76 bytes: the candlestick on that page
reads the barrel already.

#### CASARMA is not a lookup problem

The lookup tries the exact key, then U for V and V for U, then the
dictionary's keys with their hyphens stripped — the normalisation decided in
step 1 ([data fixes](#data-fixes)). Three of the four words that decision
named are found by it: `URBS` is filed as `VRBS`, `GIUI` as `GIVI`, `GRSAM` as
`G-RSAM`. The fourth is not, and no normalisation would find it. The plan read
`CASARMA` as filed under `CASARM`; what is actually there is `CASARM`'s second
meaning with `CASARMA`'s entry run into the text —

```
{ "meaning": "whom, unto whomCASARMA whom", "source": "WE" }
```

— which is the transcription fault step 3a parted `BIA` and `BIAB` on. It is
one of a family: `G-RSAM`'s meaning reads "ADMIRATION, WITHGRU DEED, FACT",
with `GRU`'s entry run into it the same way. The dictionary's contents are
another session's to fix ([follow-ups](#follow-ups)), so the words are
recorded here and nothing in `dictionary.json5` was touched. Of the seven
words the assessment found missing, three were added as data in step 1
(`IZAZAZ`, `BIAB`, `VOMZARG`), three are found by the normalisation, and
`CASARMA` is the one still missing: the page ships 180 entries for 181 words.

#### Cost

`tsc --noEmit --incremental false --extendedDiagnostics` over the whole
repository, after `data:build` and `next typegen`, each tree measured in the
same worktree on the same machine:

| Tree | Files | Types | Instantiations | Check |
| --- | ---: | ---: | ---: | ---: |
| `main` at `d769d56` | 5,560 | 408,304 | 1,867,325 | 6.73 s |
| `6b641af`, through the two refactors | 5,566 | 408,957 | 1,869,060 | 6.64 s |
| `88724fa`, the dictionary module | 5,568 | 408,976 | 1,869,081 | 6.49 s |
| `d35f69e`, through the angels' text | 5,572 | 409,385 | 1,869,176 | 6.68 s |
| `f818eff`, the tip | 5,572 | 408,979 | 1,868,770 | 6.71 s |

The branch is 675 types and 1,445 instantiations above `main`, against a
budget of 5,000,000. The row this step existed to watch is the third: the
dictionary as an emitted module costs **19 types**, where the JSON import the
spike measured cost 19,300. The 409 types on the row after it are the keys
page and the angels' text as JSON — a `string[]`, which is cheap for 88 kB of
prose — and the tip gives 406 of them back by deleting the `*.json5` module
declaration.

#### What was decided while building it

- **The shewbread assembles two tables; the chart uses the barrel.** The Table
  of Shewbread is drawn on `/gd/symbols` and `/gd/symbols/shewbread`, neither
  of which reads the barrel, so importing it would have put all 23 tables in
  those routes' chunk for the sake of one link. It calls `assemble()` on the
  two tables it draws instead, and keeps the two JSON imports it always had.
  The astro-geomancy chart is the other way round: every figure it is handed
  already comes from the barrel, so reading `tetragram.zodiac` and
  `tetragram.planets` removes two raw imports and adds nothing.
- **The four routes 404 on the row, not on the description.** `planetPage(id)`
  built a whole search snippet to answer whether the id existed. The condition
  is the same either way, since that function's first act was the same
  own-property lookup.
- **The emitted declaration is generated, not committed.** `data/dist` is
  gitignored, so the `.d.mts` is written by the build beside the module it
  describes, and the hand-written type it names lives with the sources. A
  checkout without `data/dist` fails to resolve it, exactly as it fails to
  resolve the tables; every task that type-checks runs `data:build` first.
- **The entries cross as a prop, not as a fetch.** The page is prerendered, so
  the 180 entries are in the Flight payload and the HTML that carries it, and
  there is no second request and nothing to load. A word the dictionary does
  not have is simply absent from the map, and the component renders the same
  blank for it as for an entry with nothing in it.
- **The keys page's gematria cell is left as it was.** `{dict.gematria ? …}`
  prints "Gematria " with nothing after it for a word whose gematria is an
  empty array, which is most of them; `/enochian/dictionary` guards the same
  cell with `?.length`. It is the same family of blemish as the `0`, and is
  not what this step was asked for ([follow-ups](#follow-ups)).
- **`SevenBranchedCandleStick` and `Tablet` keep their raw imports.** The
  candlestick names its seven planets in code and reads them off the barrel by
  a typed `PlanetId`, so there is no join to remove; the Enochian tablets are
  in no link in either direction and are not in the barrel at all, which is why
  [dataInputs.ts](../src/render/dataInputs.ts) imports that one table beside it.

#### Both bundlers, in development

Browsers were not opened; the dev servers were driven with `curl`, on a fresh
port each (a reused port keeps its Serwist caches). This is the step that
takes the JSON5 rules out of both bundlers, so both were run with a real
`node_modules` in the worktree rather than the symlink, which is what
Turbopack needs — it refuses a symlinked one, "points out of the filesystem
root", which is why step 3a could only check webpack. `pnpm dev` on Turbopack
and `pnpm dev:webpack` each served `/enochian/dictionary` with a word only the
emitted module can supply, `/enochian/keys` with a meaning only the
server-side normalisation finds, and `/gd/symbols/shewbread` with Manasseh's
Hebrew; Turbopack also served the four `[id]` routes.

The watcher covers the dictionary now, where the file used to be skipped
outright. A key added to `dictionary.json5` while the Turbopack server ran was
logged as `data: enochian/dictionary.mjs`, was in the next render of
`/enochian/dictionary`, and left the emitted module byte for byte as it was
when the edit was reverted.

### The dictionary, after step 3

Step 3a's re-check left one finding of the dictionary's own, seventy-six
entries listing one meaning twice with the same source and citation, and
3c's left another, twenty-one entries with a number for a meaning
([follow-ups](#follow-ups)). Both are done, on a branch of five commits
from `a6a4c7f` ([above](#the-dictionary-after-step-3)), with a check that
holds the dictionary to its type from now on.

Enumerated by a script over the parse and cross-checked against a scan of
the file's lines, the file had 1,903 entries, 93 of them listing one meaning
text more than once: 13 from two different sources, 9 differing only in a
`source2` or a `note`, and 75 groups in which every repeat was the same
object — 43 from EMPM, 32 from WE, none more than twice. The seventy-sixth
was ZON, whose second "form" carries a note. Six of the thirteen mixed
groups held an identical pair inside them as well, and 47 entries repeated
a pronunciation object the same way.

Where they came from is in the file's shape. Every one of the 43 EMPM groups
has exactly two gematria values, 42 of them repeat the pronunciation object
verbatim, and ZON's note says the book lists the word once per gematria
value: the file was typed one row of its sources at a time, and a word the
book prints twice came through as two objects saying the same thing, with
only the gematria merged into a list. The 32 WE groups carry no WE
pronunciation, and gematria only where EMPM has the word too, and BAGLE
repeats three of its four glosses, so WE too lists those words in two
places. Both pages map the array straight to rows, so a reader saw "motion
(EMPM)" twice; the pronunciation cell shows only the first, so the 47 were
invisible.

The owner's decision, 20 September: an identical repeat is an artefact of
the transcription, not a second attestation — the file records attestation
by source, not by row, and the gematria list already holds what the second
row said — so both kinds go, and the check goes in now. `96f9fa9` drops
every meaning or pronunciation object identical to an earlier one in its
entry: 81 meanings and 47 pronunciations, 128 objects across 77 entries,
513 lines and nothing else, verified by parsing both files and comparing
the new to the old with identical objects dropped. Whatever differs in
anything stays: the 13 words two sources gloss alike keep one object per
source, the 9 whose repeat carries a citation or a note keep both, and so
does ZON.

`c5855df` asks the question in `integrity.ts`, as the one check the graph
has no part in: `checkDictionary()` reads the module the build emits, as the
tables are read from the JSON it emits, so that what ships is what is
checked, and compares whole objects with their keys sorted, so that the
order they were written in is not a difference while a `source2` or a `note`
is. `pnpm data:check`, and with it `pnpm build`, now rejects a repeat; the
test proves it on ZON and BIAB, which pass, and on a repeat planted after
APOPHRASZ's real objects, which does not.

The numbers were not what 3c's re-check took them for. The twenty-two —
OS twice, OL, OP, OX, P, NI, PD, VX, AF, CLA, EMOD, QUAR, MIAN, DAOX, ERAN,
DARG, FAXS, ACAM, MAPM, CIAI and PEOAL — are the Enochian numerals, and the
number is what WE says the word means: nineteen of the twenty-one have no
other meaning and no gematria at all, OL's own gematria is 38, and P's is
unfiled. They are not gematria values in the wrong list, so they do not
move into `gematria`; the owner's decision, 21 September, was strings, and
`34a8fb9` makes them so, "12" for 12. `/enochian/keys` shows OL as
"24 (WE)" as before.

What let both sit there is that `EnochianEntry` was a type and not a
schema: the dictionary is emitted as a module, and nothing checked the
shipped entries against it. An audit of the whole file against the type,
made before the numerals were touched, found the twenty-two, seven
pronunciations carrying a `source2` the type did not declare (AKELE, AZDOBN,
E, ESE, IANA, ME, STIMCUL: page citations), ZON's pronunciation carrying a
note, and entry `I` giving two of its objects — "(name of an angel, sol)"
and the pronunciation "Ee" — an empty `source`. `8646f0a` gives the
dictionary a strict valibot schema beside the tables' in
[schemas.ts](../data/schemas.ts), which `checkDictionary()` parses every
entry with, so that a `schema` failure names the entry and the field as it
does for a row; the type gains the citation and the note a pronunciation
may carry, and the test proves the schema and the type say the same thing
in both directions before planting a number, a stray key and a `null`
entry, which the loop threw on until the second review found it. The empty
sources pass the schema, since a string is what the type asks for, and are
listed as a follow-up: what they should say is not in the repository.

`c47d6cc` is a comment. The review of the dedupe found
[build.mts](../data/build.mts) saying tsx compiles a `.ts` here to CJS
where neither `import.meta.url` nor top-level await exists; a two-line
probe run both ways showed the second half true and the first not — tsx
shims `import.meta.url` into the CJS it emits, which is what
`duplicateKeys.ts` relies on under `pnpm data:check` — and the header now
says so.

The series was built on `f0cfe74`, step 3a's tip, and rebased twice as
`main` moved under it — onto `b170693`, then onto `a6a4c7f` once steps 3b and
3c had landed, where the check's type import moved to `dictionaryEntry.ts`
and the three later commits were added. Each commit was checked on its own
tree with `pnpm check`, `typecheck`, `data:check` and `test`, `data/dist`
wiped before each: 4,743 tests on the first, 4,744 on the second and third,
4,745 on the last two, all passing; the first commit's only failure, a
five-second timeout in `readRitualBundleAsset.test.ts` while three suites
ran at once under a load average of 45, passed alone.

The gate ran on `c47d6cc` in a sibling worktree with a fresh
`pnpm install --frozen-lockfile`, on Node 24.18.0 and pnpm 10.18.0, under
CI's placeholder environment, in [ci.yml](../.github/workflows/ci.yml)'s
order:

| Step | Outcome |
| --- | --- |
| `pnpm install --frozen-lockfile` | clean; no dependency was added |
| `loom init` | already matches the bootstrap defaults |
| `loom check` | good, with the standing pnpm 11 advisory |
| `loom check --production` | good, same advisory |
| `pnpm check` | no errors, and the same 35 warnings as `main` |
| `pnpm typecheck` | clean |
| `pnpm test:coverage` | 4,745 passed, 17 skipped; `data/` covers 99.73 % of statements and 99.05 % of branches. **The step fails**, on the functions threshold of `src/seo/entities.ts` — 87.5 % against 95 %, lines 191–193, `angelPages()` — which `22ca738` added to `main` this morning without a test; `main` fails it identically, at 4,743 tests, and nothing here touches that file |
| `pnpm build` | webpack, 386 pages prerendered |
| `pnpm check:turbopack` | Turbopack, 386 pages prerendered |

The two builds ran by hand after the coverage step stopped the script, in
the same worktree and environment.

What a reader sees change: on `/enochian/dictionary` and `/enochian/keys`,
each meaning once where seventy-seven entries printed one twice, and the
numerals as they were. Both pages render the meanings on the client once a
word is chosen, so the prerendered HTML holds only the word list and cannot
show it; in a browser against `pnpm dev`, APOPHRASZ shows one "motion
(EMPM)" row under "ah-poh-peh-rah-seh-zod" with "Gematria 171, 177", and
ZON still shows "form (EMPM)" twice, the second with its note. Nothing
else: no image reads the dictionary, and the registry test that pins four
of the six component images — the Tree, the shewbread, the geomancy chart
and the candlestick — passed unchanged.

Two adversarial reviews, both at xhigh. The first, on the dedupe and the
repeat check as they stood on `f0cfe74`, ran every checkable claim — the
patch parses and equals the old file with identical objects dropped; the
check bites on a repeat in either key order and passes one that differs in
`source`, `source2` or `note`; nothing client-side imports it — and found
five things, each amended in: the first message counted the seventy-five
groups where the patch counts objects; the check threw on an entry with no
list; the test pinned ZON's wording and APOPHRASZ's literal objects; the
key allowlist `JSON.stringify(item, keys)` would have ignored a difference
below the top level; and the plans were still open. The second, on the five
commits as rebased onto `a6a4c7f`, confirmed the numerals reading from the
data — PEOAL's 69636 cannot be a gematria of a five-letter word, and OL's
own 38 is filed — and that the schema and the type are equal in both
directions, and found no blocker and five things: a `null` entry still threw
past the schema's report, guarded now; the plans said the opposite of what
shipped, which is this commit; the check re-parsed the JSON5 where the
module the build emits is what ships, and reads the module now, which also
took `JSON5`, `readFileSync` and `import.meta.url` out of `integrity.ts`;
the `where` doc named a shape the schema failures do not take, reworded; and
`I`'s empty sources, which are the follow-up above. It left the third
positional argument to `checkIntegrity()` as it is, and noted that the tables'
schemas accept an empty string too, so the dictionary's does the same.


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
- **Package publishing** (step 4). A pnpm workspace package inside this
  repository to begin with, leaning on the names `magick-data` and
  `magick-components` or `magick-react-components`, at 0.x
  ([decision 16](#decided-on-20-september)).

## Follow-ups

Everything step 3a was given is done ([above](#step-3a)): `readonly` row
types, the per-table wrapper interfaces, the explicit `kind` with
`PLANET_IDS`, the three gaps in the checks, the duplicate-key lint, `BIA`,
and the watcher. So is everything step 3b was given ([above](#step-3b-1)):
`resolvedInputsHash` with a spec on every registry entry, the inputs hash in
every image identity and through the catalogs and plans, and Manasseh's
Hebrew. So is everything step 3c was given ([above](#step-3c-1)): the typed
lookups, `pathTarget()` with its field-path test, the hand-joins, the
dictionary out of the JSON imports and off the keys page, that page's
normalisation and its literal `0`, and the JSON5 loaders. Step 3 is done;
step 4 is [a plan of its own](#migration). The rest:

- **New, from step 3c.** `CASARMA` has no dictionary entry and no spelling
  finds one: `CASARM`'s second meaning carries it run into the text, as
  `G-RSAM`'s carries `GRU`'s, which is the fault step 3a parted `BIA` and
  `BIAB` on ([above](#casarma-is-not-a-lookup-problem)). Both belong with the
  dictionary contents below. `/enochian/keys` still prints "Gematria " with
  nothing after it for a word whose gematria is empty, where
  `/enochian/dictionary` guards the same cell with `?.length`. A study set
  whose `question` or `answer` is a function has no dotted path for
  `pathTarget()` to check, which is the one gap in that test's coverage. And
  the dump-page redesign ([plan 028](028-seo.md#follow-ups)) is what `decycle`
  is still waiting for: four pages import it to print a row, and 3c left them
  alone by [decision 13](#decided-on-20-september).
- **Done, after step 3: the twenty-one entries with a number for a meaning.**
  The re-check found `meanings[].meaning` holding a number in 21 entries —
  ACAM, AF, CIAI, CLA, DAOX, DARG, EMOD, ERAN, FAXS, MAPM, MIAN, NI, OL (its
  fifth), OP, OS (twice), OX, P (its second), PD, PEOAL, QUAR and VX — and took
  them for `WE` gematria values filed as meanings. They are the Enochian
  numerals, and the number is the meaning: nineteen of the twenty-one have no
  other meaning and no gematria, and OL's own gematria is 38. They are strings
  since `34a8fb9`, and `8646f0a` is the shape assertion the bullet asked for
  ([above](#the-dictionary-after-step-3-1)).
- **Entry `I` gives two objects an empty source.** "(name of an angel, sol)"
  and the pronunciation "Ee" carry `source: ""`, since the 2023 transcription;
  the schema passes them, a string being what the type asks for, and the page
  prints "()" after the meaning. What they should say is not in the
  repository.

- **Done in step 2.** [Plan 031](031-seventy-two-angels.md)'s
  `seventyTwoAngelsDerived.ts` still imports `PlanetId` and `ZodiacId`, which
  are derived now and compile unchanged; `PlanetId` was the rows with a
  symbol, and is the rows of kind `"planet"` since 3a. The two `gdGrade`
  collisions are not collisions: `alchemySymbol` and `alchemyTerm` carry a
  numeric field named after a table they do not link to, and the check is
  about accessors, not names, with a test saying so. The `hermetic` block is
  typed as absent on the two paths that have none, and `GDGradeId` has its
  Portal.
- **New, from step 3b.** Two tribes' Hebrew names are hashed into the Table of
  Shewbread's identity although no sign points at them, because `rows: "*"`
  takes the whole table rather than the set the data selects
  ([above](#what-was-decided-while-building-it-1)). A row selector that followed
  a link would be exact; it is not worth the machinery until a spec needs it.
  And the sweep compares the JSX handed to the outliner rather than the
  outlined bytes, which is stricter but not the published artefact; a slower
  variant that outlines would close the last gap between the two.
- **New, from step 3a.** Two things `pnpm dev` does not pick up until the task
  restarts: a source directory added while it runs, because the watch is one
  watcher per directory, and `dist/graph.json` after an edit to `graph.ts`,
  because only the build writes it
  ([above](#the-watcher-and-what-linux-does-with-a-rename)). Neither is visible
  anywhere a reader can see. And a build that emitted `as const` TypeScript
  modules rather than JSON would make `kind` and the other closed fields
  literal types, which is what would let `PlanetId` be derived rather than
  written down; it belongs with step 4's package, where the emit is being
  designed anyway ([above](#kind-is-data-the-types-cannot-read)).
- **Done, after step 3: the seventy-six entries that repeat a meaning
  verbatim.** The re-check counted 92 entries that list one meaning text twice
  — 12 from two different sources, 8 differing only in `source2`, and 76 exact
  duplicate objects — which the duplicate-key lint cannot see, since they are
  array elements rather than keys. Counted again, the 76 were 75: ZON's second
  "form" carries a note, and stays. Six more identical pairs sat inside the
  groups two sources share, and 47 pronunciations were repeated the same way,
  so 128 objects across 77 entries went in `96f9fa9`, and `c5855df` is the
  check that none returns ([above](#the-dictionary-after-step-3-1)).
- Pinning implementation subagents at xhigh needs a `.claude/agents/`
  definition; the session itself runs at xhigh and built-in agents inherit
  it, so none was added.
