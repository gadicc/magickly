# Data layer

Assessment, adversarial review, type spike and decisions, 17–19 September
2026. Read [current status](000-current-status.md) first. Nothing here is
implemented yet; this is the record the implementation works against. The
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
not correctness, and nothing below claims otherwise. They need the owner's
call, not a script: `zodiac.cancer.planetId` is `sol` and `scorpio`'s is
`jupiter` (the traditional rulers are Luna and Mars; Leo is also `sol`), and
`tribesOfIsrael.manasseh.name.he` is `בנימין`, byte-identical to Benjamin's.

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
   `planet ↔ archangel`, and to `nextId ↔ prevId` on sephirot and grades
   (`next`/`prev` renamed to `nextId`/`prevId`; the nav arrows use
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
data with the renames applied; the spike files are in the session scratchpad
(`scratchpad/spike/`: `graph.ts`, `types.ts`, `assemble.ts`,
`assertions.ts`, `run.ts`, `report.md`) and the implementation lifts them.

The recursive `Assembled` type worked in the first form tried: one flat
mapped type per row over a pre-computed key union, so the key set never
recurses and the cycle is only ever in property positions, which TypeScript
instantiates lazily. 12-hop chains, an 11-deep `sephirah → archangel →
sephirah` cycle and an 8-table walk pass without a depth error. Every
negative is a live error, proved by `TS2578` on a deliberately wrong
`@ts-expect-error`: a link whose table was not assembled, a many-link used as
single, an optional without `?.`, a wrong table name, an unknown id, a
pending target, an enum, an external. The resolved type is a concrete object
— the hover is `Row<"*", "sephirah">` with
`archangel: Row<"*", "archangel"> | undefined` — so completion and `.d.ts`
emit are usable.

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
| Tetragram `planetIds`/`rulerIds` arrays; `albus` ruler → `taphthartharath` | Caput and Cauda Draconis show their planets (blank today) |
| `next`/`prev` → `nextId`/`prevId` (sephirot, grades); two pages | None |
| Drop `""` sentinels; delete the `""` angelic-order row | None: every consumer uses `?.`, and the Tree joins `undefined` as `""` |
| Geomancy houses and `meanings` keyed `"1"`–`"12"`; two pages | None, pinned by snapshots |
| `enochian/letters.json5` `pesces` → `pisces` | None today (polymorphic field, external) |
| Delete the hand-written id unions; derive from JSON (code, step 2) | `typeof data.hebrewLetter.aleph` in [sets.tsx](../src/study/sets.tsx) becomes a type error (it is `alef`); fix the four references |

Not fixed here, listed for the owner: the Cancer/Scorpio rulers and
Manasseh's Hebrew above; seven Enochian key words missing from the dictionary
(URBS, GRSAM, IZAZAZ, CASARMA, GIUI, BIAB, VOMZARG — the page already falls
back); and the dead `prev`/`next` arrows on
[path.tsx:62](../src/app/kabbalah/path/[id]/path.tsx), which test
`"prev" in path` although paths have no such fields and never render.

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
   pass ids; `/enochian/keys` resolves its dictionary subset on the server
   and the dictionary stops being a JSON import; `pathTarget()` and its test
   over `TREE_IMAGE_FIELDS`, the study sets and the ritual documents; the
   `TableOfShewbread` hand-join and the `Array.isArray` branches go. The
   JSON5 loaders in `next.config.ts` and `vitest.config.mts` are removed once
   nothing imports JSON5. `decycle` leaves with the dump-page redesign
   ([plan 028 follow-ups](028-seo.md#follow-ups)), not before.
4. **Package extraction** — a separate plan: a workspace package emitting
   JSON, ESM and `.d.ts` with `graph.json`; semver (rename or remove an id or
   field: major; new rows or fields: minor; corrected values: patch);
   `resolvedInputsHash`; table renames.

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

- Add this plan's pointer to [current status](000-current-status.md) with the
  first landing commit; its working copy has uncommitted edits at the time of
  writing.
- [Plan 031](031-seventy-two-angels.md) is in progress alongside this one and
  touches the same directory: it fills `seventyTwoAngels.json5` (an array
  table whose rows link `angelicOrderId`) and adds
  `data/kabbalah/seventyTwoAngelsDerived.ts`, which imports `PlanetId` and
  `ZodiacId` from the typed wrappers. It lands first. Step 2 here deletes the
  hand-written unions, so it must keep exporting those names from the
  JSON-derived ones.
- The owner's calls on Cancer, Scorpio and Manasseh; the seven missing
  dictionary words; the path page's dead arrows.
- Pinning implementation subagents at xhigh needs a `.claude/agents/`
  definition; the session itself runs at xhigh and built-in agents inherit
  it, so none was added.
