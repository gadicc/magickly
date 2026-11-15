# Composable JSX halls — 15 November 2026

Status: stage 1, the strict types, built on `gate/jsx-halls`, reviewed
and bumped to 0.2.0 ([below](#stage-1-built-15-november-2026)); stage 2,
the JSX tags, not built. Gadi settled the assessment's twelve decisions
on 14 November 2026, and on 15 November the seven changes (R1–R7) that
a Fable 5.2 review and the spikes led to
([Changes after the review](#changes-after-the-review)). Read
[current status](000-current-status.md),
[plan 061](061-gd-hall.md) (the hall format) and
[plan 080](080-open-source-packages.md) (the packages and their
conventions) first. The number was free on every branch on 15 November
2026.

## Background

`magick-components/gd/hall` draws Golden Dawn temple halls from a data
tree, `{type, …attributes, children}`, which rituals store as Pug and the
app's editor edits (plan 061). magick-components 0.1.0 has been on npm since
14 November 2026 (plan 080). Gadi asked for a composable, React-like way to
write halls. On 14 November an assessment (on `main` at `20d03cd1`, not
committed) listed the format's 26 tags, their roles and nesting rules,
and four ways to type it:

| Option | Checks nesting | Verdict |
| --- | --- | --- |
| (c) strict per-tag node types | yes | first, on its own |
| (a) JSX element tags, walked by `GdHall` | no (TypeScript gives every JSX expression one type) | second, on top of (c) |
| (d) a hall JSX runtime, where `<floor>` evaluates to data | no | not chosen: a file holds hall JSX or React JSX, never both |
| (b) typed builders, `floor(pillar({…}))` | yes | not chosen: a third syntax for little gain |

The assessment's own checks: the walk works in a Server Component under
Flight, conditionals, `.map` and Fragments included. Tags passed through
a client component's props are erased (the client receives `null`).
Strict node *interfaces* are not assignable to `HallNode`, which has an
index signature, but type aliases are.

## Decisions (Gadi, 14 November 2026)

As the assessment recommended:

1. **Strict types first.** Discriminated per-tag node types
   (`GdHallNode`, `FloorNode`, `PillarNode` …), **type aliases, not
   interfaces**, exported from `gd/hall`; the presets typed with them;
   `HallNode` stays the lenient input type.
2. **JSX element tags (a)**, not the data JSX runtime (d).
3. **A namespace entry**, `magick-components/gd/hall/tags`, documented as
   `import * as Hall`, with PascalCase names (`Hall.Floor`,
   `Hall.Officer`). `Lamen`, `Tablet` and `Kamea` already name
   components elsewhere in the package, and `Item`, `Label` and `Floor`
   are the generic names plan 080's decision 8 moved away from, hence the
   namespace.
4. **One `GdHall`**, taking `hall` or children, not both; root attributes
   (`wall`, `dais` …) are props in the children form.
5. **Wrapper components refused**: tags and Fragments only, as React
   Router's `<Routes>` does; shared pieces are plain functions called in
   braces (`{pillars()}`).
6. **Required where the data only warns**: in the typed forms `role`,
   `kind` (item, card), `planet`, `letter`, `n`, `text` (caption, label)
   and `element` are required, and `role` is the closed `HallRole` union.
   The data form stays lenient.
7. **Canonical spellings only** (`center`, `gray`) in the typed forms. The
   Neophyte preset moves from `centre` to `center` and `src/doc/0=0.pug`
   is regenerated (`BUILT_IN_HALLS=write`); readers still accept the old
   spellings in stored data.
8. **`Item` discriminated by `kind`**, so `form` is offered only on a
   cross and `light` only on a lamp or lantern.
9. **`defineHallTag<P>(type)`** for tags the app's own art adds.
10. **No text children**: `text` stays a prop.
11. **Diagnostics**: `hallFromTags` returns `{hall, diagnostics}`;
    `GdHall` warns in development about what the walk dropped; it never
    validates.
12. **Release**: 0.2.0 for the strict types, 0.3.0 for the JSX layer, or
    both in 0.2.0 if they land together.

## Review (15 November 2026)

A fresh Fable 5.2 reviewer (high effort) was given the assessment, the
decisions and the code, on `main` at `20d03cd1`, and ran its checks in a
throwaway worktree. It found no blocker. Five findings would change a
decision. Each was checked again before being recorded here.

- **The props union breaks wrappers (decision 4).** With `GdHallProps`
  itself the union `render props & ({hall} | {children} & root attributes)`,
  three ordinary 0.1.0 patterns stop compiling:
  `interface X extends GdHallProps` (TS2312),
  `({hall, ...rest}: GdHallProps) => <GdHall hall={hall} {...rest}/>`
  (TS2322), and forwarding `Omit<GdHallProps, "hall"> & {…}` (TS2322).
  `react-docgen-typescript` flattens the union, so the explorer's
  manifest makes `hall` optional and offers ten root attributes as
  controls that do nothing beside a `hall` example.
- **`n` and `element` do not warn (decision 6).** A `tarotKey` without
  `n` and a `tablet` without `element` are valid and silent with the art
  passed; they draw a deliberate blank (`art/tarotKey.tsx:176-177`,
  `art/symbols.tsx:105-121`). The other way round, a `marker` without
  `text` and a `door` without its coordinate along the wall do warn
  (`validate.ts:317-342`).
- **No route for the app's item kinds (decisions 1, 8, 9).**
  `defineHallTag` covers new tags, but registry item kinds
  (`item:<kind>`, `spec.ts:64-66`) have no typed route. The strict
  children unions are closed, so one custom node sends the whole tree
  back to `HallNode`. `hallFromTags` cannot honestly return `GdHallNode`,
  since JSX nesting is unchecked.
- **Erasure is silent (decision 11).** Across a client boundary the tags
  arrive as `null`, the walk skips `null`, and `GdHall` draws an empty
  hall with no diagnostic. Dropped children also have no path of their
  own: in a prototype a wrapper, a string and a `<div>` all reported the
  path of the pillar beside them.
- **`undefined` is an error (decisions 1, 10).** `{type: "pillar", x:
  undefined}` compiles against the strict types and against `HallNode`'s
  index signature (`types.ts:23`), but the validator reports an error
  (`validate.ts:109-120`; `children: undefined`, `:86-89`), while the
  layout reads it as absent (`attributes.ts:22-24`).

What it asked the plan to carry is in [the stages](#stages); its minor
points: `useMemo` keyed on `children` never hits, since JSX makes new
children each render (five re-renders, five resolves, about 0.1 ms each:
drop the claim, not the memo); `Pillar[HALL_TAG] = …` is a top-level side
effect that defeats tree shaking, so the tags are built by a
`/*#__PURE__*/` factory; strings and numbers as children can be compile
errors; `letter: string` accepts what the validator rejects; a lamp's
legacy `fill`, which `art/lights.tsx:31-32` still reads as its light,
is not in the strict types. It verified the assessment's counts and
citations, that aliases, the discriminated `Item` and `Board` and
`as const` data assign to `HallNode`, the react-server build's exports,
the walk under Flight, and the boundary tests with a walker module.

## Spikes (15 November 2026)

Run by an Opus 5.5 agent (high effort) on a throwaway prototype in its
own worktree, from `main` at `20d03cd1` (strict types, a walker, 25 tags,
`GdHall`'s children form, the presets typed strictly). S4 applied only to
option (d). None contradicts a settled decision.

| # | What | Result |
| --- | --- | --- |
| S1 | The real app: a Server Component page and a client page drawing Neophyte with tags, a page with `hall`, and a server page passing `hallFromTags`' data to a client component; Turbopack dev and the webpack build with `next start` | The same SVG from all four pages in both modes, in the served HTML and the hydrated DOM in headless Chromium; no hydration, key or other console errors; the tag marker survives Next's server and SSR layers; Fast Refresh updates the server and the client page without a reload. Development warnings from a Server Component reach the server's terminal only |
| S2 | `react-docgen-typescript` over the new props | Flattens any union: `hall` becomes optional, `children` and ten root attributes appear, and `scripts/component-props.test.ts` fails on their missing descriptions. The explorer still builds and draws, with ten dead controls |
| S3 | Errors and editor help | Short errors at the right attribute: `kind="cup" form="calvary"` says `form` does not exist on the cup's member; `kind="cupp"`, `role="hegemen"` and `at="centre"` each get "Did you mean"; a missing `role` is TS2741; a caption in a floor and an item in an officer name the allowed types. One unclear message: `hall` with children says "GdHallNode is not assignable to type 'undefined'". Completion is exact for `role`, `kind`, `at`, `light` and `wall`, and offers `form`, `fill` and `stroke` only on a cross. The package's type check: 50,557 → 51,337 types, 150,928 → 151,577 instantiations, check time 1.11–1.27 s → 1.17–1.41 s over five interleaved runs, within noise |
| S5 | Parity: the 14 presets printed as tags | Each walks to data deep-equal to the preset, with no diagnostics; `GdHall` draws the same SVG from children as from `hall`, and the same as `main`'s `GdHall` from `main`'s presets (`centre` included) |
| S6 | Keys | React 19.3.1 in development warns about no keyless tag array, on the server, the client or in hydration (the same arrays as DOM elements do warn); Next was silent too. Biome's `useJsxKeyInIterable` still asks for keys |

Two further checks by the orchestrating session the same day:

- **Overloads instead of a union** (the reviewer's fix for the first
  finding) keep the three wrapper patterns compiling, but every mistake
  on `GdHall` then reads "No overload matches this call" followed by both
  overloads' errors, and `ComponentProps<typeof GdHall>` follows the
  *last* overload, so whichever form comes last is what wrappers see.
- **Keeping the name `GdHallProps` for the data form** and typing the
  parameter as `GdHallProps | GdHallTagsProps` keeps all three patterns
  and `ComponentProps<typeof GdHall>` compiling, with the single short
  errors of S3 (`'wall' does not exist on type … GdHallProps`;
  `'widht' … Did you mean 'width'?`). Docgen still flattens it, so the
  explorer's manifest must be told which form to describe.

The prototype's walker also showed: `memo(Hall.Pillar)` and `lazy` are
refused as wrappers; a nested `<GdHall>` got the wrapper message, which
is wrong; a caption with a text child is reported and still kept; numbers
as children are reported as text; iterables such as a `Set` are walked;
data's `children: []` has no JSX spelling but `{[]}`, which no preset
needs.

## Changes after the review

Settled by Gadi on 15 November 2026, all seven as recommended. Each with
its before and after.

**R1. `GdHallProps` stays the data form's props** (decision 4, how it is
typed). One `GdHall`, `hall` xor children, as settled; only the names
change, so that 0.1.0 wrappers keep compiling and errors stay short.

```ts
// settled: GdHallProps becomes the union, and wrappers break
export type GdHallProps = GdHallRenderProps &
  ({ hall: HallNode; children?: never } |
   (GdHallAttributes & { hall?: never; children: ReactNode }));
export function GdHall(props: GdHallProps)

// recommended: GdHallProps keeps its 0.1.0 meaning
export interface GdHallProps extends GdHallRenderProps {
  hall: HallNode;
  children?: never;
}
export type GdHallTagsProps = GdHallRenderProps & GdHallAttributes & {
  hall?: never;
  children: ReactNode;
};
export function GdHall(props: GdHallProps | GdHallTagsProps)
```

The explorer's manifest keeps describing `GdHallProps` (a per-component
override in `scripts/component-props.ts`), so its page and
`componentProps.json` do not change. Not overloads, for the noisy errors
above.

**R2. Required exactly where the data warns** (decision 6). With the art
passed, `n` and `element` are silent, so they stay optional; a marker's
`text` and a door's coordinate along its wall warn, so they become
required. The door's coordinate depends on its wall:

```ts
// settled
type TarotKeyNode = Placed & { type: "tarotKey"; n: number };
type MarkerNode = Placed & { type: "marker"; text?: string; … };
type DoorNode = { type: "door"; side?: BannerSide; x?: number; y?: number; width?: number };

// recommended
type TarotKeyNode = Placed & { type: "tarotKey"; n?: number };   // blank card
type TabletNode = Placed & { type: "tablet"; element?: TabletElement; … };
type MarkerNode = Placed & { type: "marker"; text: string; … };
type DoorNode =
  | { type: "door"; side?: "east" | "west"; x: number; width?: number }
  | { type: "door"; side: "north" | "south"; y: number; width?: number };
```

`letter` stays `string` (a name such as `Tau`, or the letter): a union of
22 names and 27 letters would be exact, but the validator owns that list
and a test can hold the two together later if it is wanted.

**R3. The app's item kinds, and custom tags in data** (decisions 1, 8, 9).

```tsx
// settled: no route for an item kind of the app's own
<Hall.Item kind="sistrum" />                 // type error, no way out

// recommended
const Sistrum = defineHallItem<{ metal?: "gold" | "silver" }>("sistrum");
<Sistrum at="east" metal="gold" />          // → { type: "item", kind: "sistrum", … }
```

`hallFromTags` returns `hall: HallNode`, not `GdHallNode`, since JSX
nesting is unchecked. A data hall that uses custom tags is written as
`HallNode`, and the README says so; a type parameter
(`GdHallNode<Extra>`) threading custom node types through every child
union waits until someone needs it.

**R4. Erasure and dropped children are reported** (decision 11).

```tsx
// settled: a client component receives children: null; GdHall draws an empty hall, silently
// recommended, in development only:
//  - a tag that React renders (it was not walked: erased, or outside a GdHall) warns once:
//    "Hall.Pillar rendered outside GdHall: tags are read by GdHall, not rendered;
//     across a client boundary, pass hallFromTags(…).hall instead"
//  - GdHall's children form that yields no node at all warns once
//  - a dropped child's diagnostic carries its own path:
//    the parent's path and its index among the parent's raw children
```

The tags stay silent in production, as `GdHall` is today.

**R5. The validator reads `undefined` as absent** (decisions 1 and 10;
the data form becomes slightly more lenient, never stricter).

```ts
validateHall({ type: "gdHall", children: [{ type: "floor", children: undefined }] });
// before: error "floor: children must be a list"; after: []
validateHall({ type: "gdHall", children: [{ type: "floor", children: [{ type: "pillar", x: undefined }] }] });
// before: error "pillar: x must be a number, string or boolean"; after: []
```

The walker drops `undefined` props anyway, so the JSX form never meets it.

**R6. Text children are compile errors where they can be** (decision
10). Container tags type `children` as elements, booleans, `null`,
`undefined` and arrays of them, so `<Hall.Caption>Neophyte</Hall.Caption>`
and `<Hall.Floor>text</Hall.Floor>` fail to compile; the walker's
diagnostic stays for what types cannot see (a component returning a
string).

**R7. `hallFromTags` takes a `<GdHall>` element** (not specified before):

```tsx
const { hall, diagnostics } = hallFromTags(
  <GdHall wall="gradient"><Hall.Floor>…</Hall.Floor></GdHall>,
);
// render props (width, className …) are ignored; a GdHall given `hall` returns that hall
```

`GdHall` carries the same marker as the tags (as `gdHall`), so the
walker never imports `GdHall.tsx` and no import cycle forms.

## Stages

### Stage 1: strict types (0.2.0)

On `gate/jsx-halls`, each commit gated on its own tree.

1. **The validator reads `undefined` as absent** (R5), with tests for an
   attribute and for `children`.
2. **The strict node types**, `nodes.ts`, exported from `gd/hall`: one
   type alias per tag (decisions 1, 6, 7, 8 as amended by R2), every
   shared piece (`HallPlaced`, `GdHallAttributes`, the label's) an alias
   too, the unions spelled from the vocabulary's constants where those are
   arrays (`HALL_POINTS`, `CROSS_FORMS`, `BOARD_KINDS`, `CARD_KINDS`,
   `LIGHT_COLORS`, `HALL_PLANETS`, `TABLET_ELEMENTS`). Tests: every node
   type assignable to `HallNode`; one `@ts-expect-error` per rule (wrong
   nesting, wrong value, missing required value, `centre`, `grey`, a
   cross's `form` on a cup); `HallRole` and `HallColor` held to
   `HALL_ROLES` and `HALL_COLORS` by a test, since those are maps; and a
   note that a non-fresh object escapes `Item`'s excess-property check,
   as anywhere in TypeScript.
3. **The presets typed strictly**: `HallPreset.hall` is `GdHallNode`;
   `dais()` and Portal's `PATHS` take `as const`, Portal's shared `EAST`
   takes the row-child type; Neophyte's `centre` becomes `center`, and
   `src/doc/0=0.pug` is regenerated with `BUILT_IN_HALLS=write`. No
   drawing changes (S5 compared the SVGs): no render pin moves.
4. **README**: the strict types in the hall section; `validateHall` shown
   with `{art: DEFAULT_HALL_ART}` (without it, the seven tags the art adds
   are "unknown"); "Versions" says 0.2.0 narrows `HallPreset.hall` and
   changes Neophyte's `at`, both allowed in a 0.x minor.
5. **Review** by a fresh Opus 5.5 reviewer (high), then the final review
   of the exact tree by Fable 5.2 (high); fixes as their own commits.
6. **The bump to 0.2.0** and this plan's commits table, in a last
   `docs(plans)` commit beside `plans/000-current-status.md`. Gadi
   fast-forwards `main` and pushes; CI publishes. Then integrity on npm
   is compared with the build leg's.

### Stage 1 built (15 November 2026)

Built by an Opus 5.5 agent (high effort) on `gate/jsx-halls`, from
`main` at `20d03cd1`, each commit gated on its own tree.

- **The validator** skips a value that is `undefined` before any other
  check, so an `undefined` attribute of any name, and `children:
  undefined`, are absent (R5). A required value set to `undefined` still
  warns as missing.
- **`nodes.ts`**: a `<Tag>Node` and a `<Tag>Attributes` alias per tag
  (stage 2's tag props reuse the second), `HallPlaced`,
  `GdHallAttributes`, `ItemKind`, `HallRole`, `HallColor`, the child
  unions (`HallPlaceableNode`, `HallHostNode`, `HallContentNode`,
  `GdHallChildNode`) and `HallStrictNode`; the vocabulary's own types
  (`HallPoint`, `CrossForm`, `BannerSide` …) are re-exported from it.
  Beyond the plan: a board with a diagram rejects `w` and `h` (the
  validator warns); `grade` is typed only on the Hiereus and Hegemon,
  the roles that take it; caption, label and door accept
  `children: []`, which the validator accepts; a lamp's legacy `fill`
  is left out.
- **The type tests** are `nodes.test.ts`, a Vitest file whose
  `@ts-expect-error` lines and `expectTypeOf(…).toExtend<HallNode>()`
  the package's and the app's `tsc` check (`pnpm typecheck`); the
  package had no type tests before. Each directive was checked to hide
  the intended error. Runtime tests hold `HallRole`, `HallColor`,
  `ItemKind`, the tag list, the lamen grades' roles and each tag's
  attribute names to the vocabulary and `DEFAULT_HALL_ART`.
- **The presets** are typed `GdHallNode`; their JSON is unchanged but
  for Neophyte's `center`, and `src/doc/0=0.pug` changed in that line
  only. No pin, snapshot or drawing moved.
- **The app** leaves `undefined` values out of a hall's Pug source, as
  JSON does (`src/doc/gdHallRows.ts`), since the codec refuses them and
  the validator now passes them.
- **README**: a section "A hall on your page" (a preset, a typed hall,
  `validateHall` with `{art: DEFAULT_HALL_ART}`, and what the types leave
  to the validator: ranges, letter names, text length); "Versions" for
  0.2.0, naming the narrowed `HallPreset.hall` and how to widen it, the
  Neophyte change, and the validator's reading of `undefined`.

One cost, accepted: since the officer is a union (the `grade` rule), an
item inside an officer is reported against the floor's whole child union
rather than as "only labels".

### Stage 1 review (15 November 2026)

A fresh Opus 5.5 reviewer (high effort), given this plan, the diff and
the code, found nothing that had to be fixed before release, and
verified that every node type is an alias assignable to `HallNode`, the
nesting matches `spec.ts`, the unions match the vocabulary and the art,
R2 holds exactly, and the presets' data is unchanged but for Neophyte.
What it asked for, done in `6d1cc4c9`, `04a7f282` and `dc525442`:

- After R5 the validator passed a hall with an `undefined` value that
  the app's codec throws on; the app now drops such values.
- "Versions" understated the narrowing of `HallPreset.hall`.
- No test held `ItemKind`, the tag list or the attribute names to the
  runtime data.
- `grade` on every role, leaf nodes refusing `children: []`, "missing
  value" type tests anchored on a generic error, and a README that said
  the types check "what the validator would".

Kept as it was: the `*Attributes` aliases stay public, and the type
names keep the package's mixed prefixes (`BannerSide` and `CrossForm`
beside `HallPoint` and `HallPlanet`).

### Stage 2: JSX tags (0.3.0)

On the same branch after 0.2.0 is published, or a new one from `main`.

1. **The walk**, `walk.ts`: the marker
   `Symbol.for("magick-components.hallTag")`, the walk (Fragments and
   iterables descended; `null`, `undefined` and booleans skipped with a
   compacted index; `key`, `ref`, `children` and `undefined` props
   dropped; strings, numbers, DOM elements and other components
   reported with their own path, R4; `memo` and `lazy` reported as
   wrappers; a nested `GdHall` given its own message) and `hallFromTags`
   (R7). Tests: paths across Fragments, arrays, `Set`s and falsy
   children; every refused kind of child; parity with the 14 presets
   (S5's printer, kept as a test helper).
2. **The tags entry**, `gd/hall/tags`: 25 tags built by
   `/*#__PURE__*/ defineHallTag<P>(type)`, `defineHallItem<P>(kind)` (R3),
   container children typed as in R6, the development warning when a tag
   is rendered (R4), guarded `typeof process !== "undefined" &&
   process.env.NODE_ENV !== "production"` and once per message per
   process (the package's first `NODE_ENV` read). `package.json` `exports`
   and `publishConfig.exports`, `tsconfig.build.json` and the provenance
   sign-off list gain the entry. The tags module stays directive-free
   (`src/directives.test.ts`) and imports only React and the vocabulary
   (`src/importBoundary.test.ts`).
3. **`GdHall`'s children form** (R1): `GdHallTagsProps`; the walk in
   `useMemo`; root attributes read in the children form; the warning when
   the children yield no node; the manifest override so the explorer
   keeps describing `GdHallProps`. The reader keeps importing the walker
   only through `GdHall.tsx`
   (`src/doc/ritualBlocks/readerBoundary.test.ts`). Tests: hydration of a
   tags hall without mismatch, and the same SVG as the data form.
4. **The smoke test**: a Server Component page drawing a hall with tags
   in `smoke.mjs`' Next fixture (S1 for both bundlers on every gate),
   the entry's `.d.ts` under `nodenext` with `skipLibCheck` off, and the
   README's TSX example type-checked.
5. **README**: the entry's row; the Neophyte example; the rules (tags and
   Fragments only, functions in braces; build the hall where `GdHall`
   runs, and hand a client component `hallFromTags(…).hall`; development
   warnings from a Server Component appear in the server's terminal;
   keys optional, though Biome asks for them); "Versions" for 0.3.0. If
   `GdHall`'s JSDoc changes, the site-search vectors are refreshed in the
   same commit (`src/search/catalogue.ts` reads it).
6. **Reviews, bump to 0.3.0, publish**, as in stage 1.

The explorer keeps its `hall` examples (its examples are props objects,
which cannot hold children), so no page and no docs screenshot changes.

## Verification

Every commit: the CI-equivalent gate on its exact tree (install, Loom
checks, Biome, type check, both smoke tests, coverage, the webpack build
and Turbopack). Per stage: a fresh Opus 5.5 review (high) given only this
plan, the diff and the code; before each release, Fable 5.2 (high) on the
exact tree. After each publish, npm's `dist.integrity` against the
`build` job's.

## Not in scope

- A data JSX runtime (option d) and builders (option b).
- Wrapper components and a second render pass.
- `hallToJsx`, a printer from data to tags for the explorer or the
  editor (S5's printer could seed it).
- A type parameter for custom nodes in strict data (R3).
- Validation inside `GdHall`.

## Follow-ups

- `describe.ts:137-140` names `gong`, `brazier` and `candle` as node
  types, a dead branch since they are item kinds; delete it when the file
  is next touched.

## Commits

On `gate/jsx-halls`, each gated on its own tree (every step exit 0).

| Commit | What |
| --- | --- |
| `e3811104` | This plan; plan 080 records the 0.1.0 publish |
| `8ec9f8fd` | The validator reads `undefined` as absent (R5) |
| `abfe0f31` | The strict hall node types and their tests |
| `83ab0c02` | The presets typed strictly; Neophyte at `center`; `0=0.pug` |
| `e2e6b101` | README: the strict types, "Versions" |
| `6d1cc4c9` | The app leaves `undefined` out of a hall's source |
| `04a7f282` | Review fixes: `grade`, `children: []`, unions held to the data |
| `dc525442` | README: what the types leave to the validator |
| `3e29621a` | `main` merged (`412ebcf7`) |
| this commit | magick-components 0.2.0; this plan's stage 1 record |
