# Open source: the packages and their pages — 11 November 2026

Status: plan; stage A built and reviewed on `gate/data-publish`, not
merged ([below](#stage-a-11-november-2026)). Reviewed on 11 November 2026 and
revised (see [Review](#review-11-november-2026)), then spiked and mocked up the same day
(see [Before any code](#before-any-code)). Decisions 1–4, the table page's
layout, the sigils, the fonts and the licence note were settled by Gadi on
11 November 2026. The rest are recommendations he has not objected to. Read [current status](000-current-status.md),
[plan 052](052-data-package.md) (the data package) and
[plan 061](061-gd-hall.md#1-one-hall-model-two-hosts) (the MIT boundary of
`src/components`) first. The number was free on every branch on
11 November 2026 (077 is `gate/enochian-translator`, 078
`gate/planet-pages`, 079 Frank Ruhl Libre); this plan was drafted as 078
and renumbered when that was taken.

## Background

What was asked and decided before this plan:

- **20 September – 3 October** (plan 032 decision 16, plan 052 decisions
  2, 3, 9 and 10): two unscoped packages, `magick-data` and
  `magick-components`. Package code is MIT, data is CC BY 4.0, and the app
  stays AGPL-3.0-or-later. The app always consumes the workspace copy; the
  tarball is a projection for others. CI publishes when a package's
  `version` changes on `main`. The names were to be reserved "at the moment
  it is ready to do", with Gadi asked first.
- **22 September**, Gadi: "a component explorer / demo, maybe something
  along the lines of storybook (but with our own code) … host that in the
  app, maybe under a new open-source section". Plan 052 recorded it as a
  follow-up, to be generated from `src/render/registry.tsx`.
- **3 October** (plan 052): the Enochian dictionary stays in the package
  for the app and out of the tarball, because its entries come from
  Schueler's *Enochian Magic: A Practical Manual* and *The Whole Enochian
  Dictionary*, whose rights are not ours to give.
- **17–23 October** (plan 061): `src/components/importBoundary.test.ts`
  makes "imports no app code" a test, with six files listed as known
  violations. `gd/hall` may import only React and `magick-data`.

What was found on 11 November at `6243ba95`:

- **`magick-data` is mechanically ready.** `publishConfig.exports` points
  at `lib/` and `dist/`, and CI packs the tarball, installs it into a
  fixture and type-checks a consumer (`pnpm --filter magick-data smoke`).
  The README is written and its counts are tested. What is missing is the
  publish job, `private: true`, the 0.0.0 version and the owner's go-ahead.
- **The names are still free.** `magick-data`, `magick-components`,
  `magick-react-components`, `@magickly/data` and `@magickly/components`
  all returned 404 from the npm registry.
- **The registry covers seven components, not the set.** Those are the
  ones with server image contracts (Tree of Life, Enochian tablet, rose
  sigil, candlestick, shewbread, temple hall), plus `AstroGeomancyChart`,
  which is app code. Kamea, Moon, Mercury, planetary spirits, Chakras,
  GradeTree, Lamen and the fylfot cross have no entry. An explorer
  generated from the registry alone would show fewer than half.
- **`src/components` is close to a package, but not there.**
  - Six files are known boundary violations: `Link.tsx` and `Tiles.tsx`
    (MUI, Next), `astrology/Mercury.tsx` (`next/image`),
    `astrology/planetarySpirits.tsx` (seven SVGs from the app's `svg/`),
    `enochian/enochianFont.ts` (`next/font/local`) and `entity/index.tsx`
    (MUI, the site frame).
  - `TreeOfLife`, `GdHall` and `RoseSigil` use hooks without
    `"use client"`. The first draft read that as a defect; the review
    showed that the first two are built to run as Server Components
    (decision 7).
  - The app compiles with `strict: false`. Under `strict: true` the
    components have 50–65 errors, 45 of them in `TreeOfLife.tsx`
    (decision 7).
  - The Enochian font has no licence text (plan 061, "Fonts"), so it
    cannot ship in an MIT package.
- **Its third-party runtime imports are few:** `astronomy-engine`, `lune`
  and `luxon` (Moon, Mercury), `nlopt-js` (rose sigil, loaded on demand)
  and `dot-prop` (Tree of Life).
- **The largest published table has 72 rows** (the seventy-two angels).
  Only the unpublished dictionary is large (1,911 entries).
- **Dark mode ([plan 076](076-dark-mode.md), on main since 11 November)** edits
  `Tiles.tsx`, `SevenBranchedCandleStick`, `TableOfShewbread`, `RoseSigil`,
  `planetarySpirits` and the hall palette. It styles drawings by page CSS
  around them, not inside the `<svg>`, so it does not change what the
  components export.

The tool research (11 November, versions from `npm view` that day) is
summarised where each decision uses it. Its sources are listed
[at the end](#sources).

## Decisions

### 1. One `/open-source` section (Gadi, 11 November)

| Route | What it holds | Indexed |
| --- | --- | --- |
| `/open-source` | The policy (app AGPL; package code MIT, the drawings the components make included; data and the site's hand-drawn images CC BY 4.0; the hall fonts OFL; third-party work under its own licence with a link to `/about#credits`), then one card per package: what it is, `npm i`, a short usage sample and links to its pages, npm and GitHub | yes |
| `/open-source/data` | Every published table: its subpath, row count, one line on what it is, and the relations `graph.json` gives it; the three ways in (barrel, one table, scoped `assemble()`) | yes |
| `/open-source/data/[table]` | The table's rows (decision 4), its fields (decision 6) and the import line | no, for now (decision 4) |
| `/open-source/components` | One tile per component, drawn live at thumbnail size | yes |
| `/open-source/components/[name]` | The explorer (decision 5) | yes |

- `/about`'s licence section shrinks to two sentences and a link here; its
  "Design goals" list links here instead of to GitHub directories.
- `OpenSource.tsx`, the "Magick.ly is open-source…" line under pages, links
  to `/open-source` as well as to the file.
- The pages join `siteNav`, the sitemap and site search like any section,
  except the table pages (decision 4). The footer gains an "Open source"
  column (Data, Components), and the app bar names the section ("Open
  source › Data") while the page heading names the item, as on entity
  pages. They are written in the house voice
  and checked by the page-text tests.
- A table that has an entity page (sephirot, planets, grades, paths, the
  seventy-two) links each row to it. Rows are anchors on the table page,
  not routes of their own, so no second page competes with the entity
  pages for the same entity.

### 2. `magick-data` ships first (Gadi, 11 November)

It is ready. The hub and the data pages follow it, and `magick-components`
follows them ([stages](#stages)). Nothing about the data waits for the
components.

### 3. Releases: published by CI when the version changes (Gadi, 11 November)

Plan 052's deferred design, as a workflow of its own (as 052 said), with
the constraints the research and the review found. npm publishes are
permanent (unpublishing is restricted), so every step below is about not
shipping the wrong bytes.

- **The manifest gains `repository`** (`url`, and `directory:
  "packages/magick-data"`), without which npm's provenance check is
  expected to reject a CI publish, and a **`prepublishOnly` guard** that
  fails `npm publish` run from the package directory (plan 052's final
  review: it would ship `exports` that point into `src/`).
- **The tarball published is the one the smoke test verified.**
  `scripts/smoke.mjs` gains an option to keep its packed tarball. `lib/`
  and `dist/` are git-ignored and nothing runs a build before `pnpm
  pack`, so packing on its own would ship whatever happens to be on disk.
- **The first publish is by hand, as a pre-release.** npm cannot configure
  a trusted publisher for a package that does not exist yet, and its
  dispute policy forbids publishing "simply for the purposes of reserving"
  a name. Gadi publishes **`0.1.0-rc.0` under `--tag next`** with his own
  npm login, from a clean checkout of the `main` commit, using the
  smoke-verified tarball. He then configures the trusted publisher,
  allowing `npm publish` explicitly (a configuration made after
  3 September 2026 allows only `npm stage publish` unless told
  otherwise). CI publishes **0.1.0 itself, with provenance**, inside the
  two days that, since 2 October 2026, an unvalidated configuration has
  before it expires. An expired configuration can be neither used nor
  edited; it is deleted and made again. No throwaway 0.1.1 is needed.
- **Published directly, not staged** (Gadi, 11 November): CI runs `npm
  publish --provenance`, not `npm stage publish` with a human approving
  each release on npmjs.com with 2FA. With `publish.yml` split as below,
  the publish credential (the OIDC `id-token`) exists only in a job that
  runs no third-party code: no install, no cache, no package script,
  only checkout, Node and npm, the decision script and the verified
  tarball. What remains is someone with push access to `main` editing
  `publish.yml`, and that is only Gadi. Staged publishing stays
  [deferred](#deferred); required reviewers on the `npm` environment
  are the cheaper hardening if that ever changes.
- **`publish.yml`, a workflow of its own** on pushes to `main`, in three
  stages (the [stage A review](#stage-a-review-11-november-2026), H1).
  `decide` checks out and runs the decision on the source manifest, with
  no install; on most pushes it skips and nothing else runs. When it says
  publish, `quality` (`ci.yml`, for that exact commit) and `build`
  (install, smoke keeping the tarball, its SHA-256 and integrity, an
  artifact) run without `id-token`. Then `publish`, alone in the `npm`
  GitHub environment with `id-token: write`, downloads the tarball,
  checks its SHA-256, decides again and publishes. The trusted publisher
  names `gadicc/magickly`, `publish.yml` and that environment, and the
  job declares the environment so the OIDC claim matches. Not in
  `release.yml`: its deploy job already holds `id-token: write` in
  `Production`, and everything the Vercel build runs could then mint an
  npm publish token.
- **What triggers a publish.** For each package the job fetches the npm
  packument; `npm view` exits 1 with E404 for a missing package, a missing
  version and some registry failures alike, so it is not used.
  - A 404 for the package skips it (the first publish is by hand). From
    the bump to 0.1.0, `--expect-exists` makes a 404 fail instead.
  - Otherwise the job publishes only if the manifest's version is absent
    from the packument and greater than `latest`, and a pre-release also
    greater than `next`, so `next` never moves backwards.
  - Any other registry error fails the job.

  Re-runs are therefore no-ops, and merging stage A before the first
  manual publish does nothing.
- **The bump is a human edit** in the commit that changes the package, per
  the README's semver rules. CI cannot tell a rename from a correction.
- **A provenance sign-off gates the first publish.** The CC BY grant
  cannot be withdrawn. Before stage A′, every published data file is
  listed with its source, and the README's "Sources" names every set
  derived from an identified work. It names five today; the geomancy texts
  from the Equinox and Agrippa ([plan 075](075-geomancy-own-words.md)) are
  a sixth. A test then keeps the list and the files in step. Each row
  has a "Signed off" column, empty until the owner signs that row off
  with a date, and the README test and the smoke test refuse any version
  past 0.0.0 while a row is empty (the second stage A review; matching
  "not recorded" in the source text could be dodged by rewording).

Deferred, at Gadi's request: change detection and automated bumps
([below](#deferred)).

### 4. The data browser: a table per table, relations as links (Gadi, 11 November)

- **Rows in an MUI `Table`, rendered on the server.** No DataGrid and no
  virtualisation: 72 rows is the most any published *table* holds. The
  page is plain HTML and theme-aware (dark mode included), with no client
  bundle beyond the detail pane.
- **Texts are not tables.** About ten published subpaths are texts or
  derived values: the Lenain volume (168 pages), its notes and apparatus,
  the Enochian Keys (920 kB) and others. `/open-source/data` lists them
  with what each holds, its size and its import line, and links to the
  page on the site that presents it. They get no grid.
- **Columns come from the field manifest** (decision 6), not hand-written
  lists. A field whose value is an object with named keys, such as
  localised text (`name.en`, `name.he`), gets one column per key, read from
  the manifest's `keys` rather than parsed from its display string. Maps
  (`tetragram.meanings`, `enochianTablet.readings`) and arrays of objects
  (`marks`) get no columns; they are left to the detail pane (spike,
  11 November).
- **Each row is an anchor**, named by the table's `rowKey` from the
  manifest. That is `id` for most tables, the object key for `angelicOrder`
  and `godName` (which have no `id` field), `index` for
  `astrologicalHouse` and `no` for `seventyTwoAngel`.
- **Search engines.** The table pages are `noindex,follow` and stay out of
  the sitemap and site search for now: a full dump of the seventy-two
  would compete with the angel pages. `/open-source` and
  `/open-source/data` are indexed. Revisit with Search Console data.
- **Relations become links.** A field `graph.json` declares as a link
  (`planetId`, `nextId`, …) renders as a link to that row's anchor on its
  own table's page, so the cycle in the assembled graph becomes
  navigation, not something a viewer has to draw.
- **The row detail pane** shows the row's JSON with `react-json-view-lite`
  (2.5.0: React 18 and 19, no dependencies, 117 kB unpacked, styled by CSS
  classes mapped to the theme), with "Copy JSON", "Link to row" and, where
  one exists, the entity page. It opens as an expanded row under the
  selected one (MUI's collapsible-table pattern), held to the visible
  width so it does not scroll sideways with the table; a drawer would
  cover the rows and a side column would squeeze them. It is a client
  island on the table page.
- **The layout (Gadi, 11 November, from mock-ups of three):** the import
  line and counts, then the rows, then the field list, all on one page.
  A "Fields" link in the rows' heading jumps down, and each column header
  links to its field's entry. The rows come first because they are the
  content; the page stays plain HTML that works with find-in-page and
  print. Fields above the rows pushed the data off the first screen (25
  field rows for `sephirah`), and tabs hid each column's description from
  the rows and needed client code. Wide tables scroll sideways inside
  their frame, with the row-key column sticky.
- **A field may name its columns.** Following the one-column-per-key rule,
  `sephirah.color` would take eight columns. The field's schema carries a
  `v.metadata({ columns: ["queen", "king"] })` hint, read into the
  manifest, and the table shows those keys (with a swatch from the
  matching `*Web` value); the rest stay in the detail pane and the field
  list.
- **Not `@uiw/react-json-view`.** Its `latest` is still 2.0.0-alpha.44,
  and nothing documents how it handles cyclic input.
  **Not `@textea/json-viewer`:** its peers are MUI 6 and React 18.
- **The dictionary** is not in the browser, since it is not in the
  package. `/open-source/data` says so and links to `/enochian/dictionary`.

### 5. The component explorer: our own, in the app

The 22 September preference, confirmed by the research:

- **Not Storybook.** Storybook 10.6 supports Next 16 and React 19, but it
  is a separate app with its own builder and UI. It cannot be a Next route,
  and it needs its own mocks of `next/image` and `next/font`. Its story
  files drift from the components ("stories rot"), and its look is not the
  site's. Ladle has stalled (last release November 2025); React Cosmos is
  active but is also a separate server. Revisit only if visual-regression
  testing (Chromatic) becomes a goal.
- **Each component gets an example module in the package**,
  `examples/<Name>.examples.tsx`. It exports one or more named examples,
  each holding only `{ title, props }` and, optionally,
  `imageHref(props)`, a link to the server image. Examples are
  type-checked against the component's own props type and rendered by a
  test, so an example that no longer fits fails the build. They hold no
  control metadata, which is what keeps them from becoming stories by
  another name. They ship in the repository, not in the tarball.
- **The example modules are the component list**, not docgen. Docgen
  reports every export of a file as a component: 126 across
  `src/components`, among them `labelLines`, `CANDLESTICK_PLANETS` and
  internal hall art such as `Rod` (spike, 11 November). A component appears
  on `/open-source/components` when it has an example module, and its name
  comes from the module rather than from docgen's `displayName`, which for
  default exports is the file name.
- **Controls come from one place: the props types**, as
  `react-docgen-typescript` reads them (decision 6). A union of literals
  becomes a choice, a boolean a switch, a number or a string a field, and
  `string | number` or `string | boolean` a text field whose value is
  parsed. Literal unions imported from `magick-data` expand to their
  members (`PlanetId`, `ZodiacId`, `PathId` and `GDGradeId` were checked);
  arrays of them do not, and get no control. Callbacks, `ref`, `ReactNode`,
  `CSSProperties` and registries get no control and appear only in the
  props table. Subject data (`hall`, `highlights`) is chosen through a
  picker over the component's examples. There is no JSON editor. The server
  contracts cannot drive controls, as the review found: they expose only
  `keys` and an opaque `parse`, and their query names are not the
  components' props (`text` → `sigilText`, `font` → `enochianStyle`), with
  the mapping in the server-only registry.
- **The page** shows the live render, the controls, the JSX for the
  current props (copyable), the props table (decision 6), the component's
  data inputs where the registry declares them, and links to the source
  (through `OpenSource`) and, where a server contract exists, to the image
  URL for the current props.
- **The explorer is app code (AGPL)**; the examples are MIT with the
  package.

### 6. API reference generated at build, rendered by us

- **Row fields: a field manifest the data build emits**, not TypeDoc.
  The row types are generated (`rows.ts`: `interface PlanetRow extends
  Row<"*", "planet"> {}` over literal declarations in `dist/*.d.ts`), so
  no hand-written field exists to carry JSDoc, and TypeDoc would not
  expand the mapped type. `src/build.ts` already reads `schemas.ts` and
  `graph.ts`; it also writes `dist/fields.json`, shipped and importable as
  `magick-data/json/fields.json` (about 60–65 kB with descriptions). The
  spike's prototype typed every field of all 29 tables (158 fields, 199
  paths, 41 links, all from `graph.ts` with none missing); the schemas use
  only object, string, number, boolean, picklist, array, tuple, optional
  and nullable, which `build.ts` already walks (`picklistPaths`).
  - **Per table:** `rowKey` (decision 4), the field list, and the table's
    `check` messages as a list of rules (`enochianTablet` has four).
  - **Per field:** the path; structured type data (`kind`, `of`, `keys`,
    `values`, `constraints`, `optional`, `nullable`, and
    `link {to, many, kind}`); a display string; the description. The pages
    read the structured data, never the display string.
  - **Maps** are recognised by rule and the rule is written in the build:
    the same schema under every key, four keys or more
    (`tetragram.meanings`, keys 1–12; `enochianTablet.readings`, five
    sources), shown as `readings.*.rows`.
  - **Texts** have no schema (`build.ts` types them `unknown`). A `texts`
    section lists each text subpath with its sources, its size (computed),
    a description and the site page that presents it, from a small `TEXTS`
    record in `build.ts`. A test holds that record equal to the package's
    non-table exports.
  - **Descriptions are authored in `schemas.ts`** with valibot 1.5's
    `v.description()`, in one form, `v.optional(v.pipe(x,
    v.description("…")))`, with the wrapper outermost; the generator looks
    through `.wrapped`. Fields made by `ids()` (49 of them: links, pending
    or external ids, and the one enum) take theirs through an `about` map,
    `ids(table, { absent, about: { field: "…" } })`. That keeps the text
    out of `graph.js`, which ships. `v.pipe` keeps the schema's `.type`,
    parsing is unchanged, and the schemas never reach consumers (valibot is
    a dev dependency). Fields that look like links but are not
    (`alchemySymbol.gdGrade`, `seventyTwoAngel.godName`) say so in their
    descriptions. `marks[].doubt` becomes a picklist, so its values show.
  - The table pages render columns, links and the field list from this
    manifest, so stage C needs no TypeDoc at all. The few helpers
    (`assemble()`, `rowOf()`, `pathTarget()`, …) are documented by hand on
    `/open-source/data`, from their JSDoc.
- **Component props: `react-docgen-typescript` 2.4.0**, behind a script
  (spike, 11 November). It resolved the aliases with the repo's tsconfig and
  read all three probe components; a run over `src/components` takes about
  a second and is byte-stable.
  - **Options:** `shouldExtractLiteralValuesFromEnum`,
    `shouldRemoveUndefinedFromOptional`, `savePropValueAsString`. Not
    `shouldExtractValuesFromUnion`, which turns `string` and `boolean` into
    enums.
  - **The prop filter** drops a prop only when *every* declaration is in
    `node_modules`. Dropping on *any* loses a component's own props that
    share an SVG attribute's name (`LineOutline`'s `x1`…`offset`);
    no filter at all gives `LineOutline` 486 props.
  - **`ref` and `key` are always dropped.** Parsing the package in one call
    gives five components `Ref<HTMLAnchorElement>`, leaked from `Link`
    through docgen's cache.
  - **Defaults longer than about 80 characters are dropped** (`GdHall`'s
    `art` default is 1.1 kB of source). Defaults set in a function body
    are invisible to any static tool; move them to the destructuring.
  - **The output committed is the trimmed manifest** the explorer needs
    (type, required, short default, description, control), sorted: about
    30 kB. A freshness test re-runs the script and compares (about a
    second), as the README's counts are tested. That avoids wiring a
    generated file into six `package.json` scripts, `pnpm dev` and the
    Vercel build.
  - **Not `react-docgen` 8** (Babel): it does not resolve imported types,
    so `magick-data` ids would get no choices, and it drops untyped props
    silently. react-docgen-typescript has had no release since June 2025;
    if TypeScript 7 breaks it, the fallback is a small extractor on the
    compiler API.
- **Descriptions are required.** Every table field (in `schemas.ts`), and
  every component with an example module and each of its props (JSDoc),
  has one. A test fails on any that is missing, so the reference cannot
  thin out over time. Loom's JSDoc rule covers the rest of what the
  packages export. The measured backlog: no table field has a description
  yet (199 paths, 120 distinct, about 4–6 hours of writing); 73 of 109
  component props and 8 of 43 components have none.
- **No TypeDoc.** With rows covered by the manifest and props by docgen,
  it would document a handful of helpers. That's not worth a dependency
  pinned to TypeScript 6 when TypeScript 7 is `latest`.
- **Not API Extractor**, which is built for rolled-up declarations and API
  review and is heavier than two packages need. **JSR** would generate
  hosted docs for free, but that is a second registry; deferred.

### 7. `magick-components`: a workspace package like `magick-data`

- **It moves to `packages/magick-components/`.** The app depends on it as
  `workspace:*` and imports bare `magick-components/…` specifiers. The
  `@magick-components/*` alias goes from `tsconfig.json`,
  `vitest.config.mts` and `OpenSource.tsx`'s `url()`, as `@magick-data/*`
  went in plan 052. The imports are rewritten mechanically: 100 files use
  `@magick-components/`, 45 use `@/components/` and 3 use relative paths.
  `biome.json`, four boundary tests and `scripts/gd-hall-fonts/build.py`
  also name the path.
- **The six violations leave or are fixed.** Known violations go to zero
  and the list in `importBoundary.test.ts` is deleted.

  | File | Becomes |
  | --- | --- |
  | `Link.tsx`, `Tiles.tsx`, `entity/` | App code, moved to `src/app/` (or `src/ui/`); they are the site's frame, not drawings |
  | `astrology/Mercury.tsx` | `<img>` in place of `next/image`, with the two images it hard-codes (`/night-sky.jpg`, `/pics/mercury.webp`) passed in as props |
  | `astrology/planetarySpirits.tsx` | The seven sigils become TSX components in the package (`tsc` cannot ship svgr `.svg` imports). The SVGs in `svg/astrology/spirits/` are Gadi's own drawings, made in Inkscape (Gadi, 11 November 2026), of the traditional seals of the planetary spirits (Agrippa, *De occulta philosophia*, Book II, 1533). Each records the public-domain edition it follows. Copyright Gadi Cohen, MIT like every component (see [the licence note](#the-licence-of-a-drawing-that-is-code)) |
  | `enochian/enochianFont.ts` | Stays in the app. `Tablet` takes a font family prop, and the README says the consumer supplies an Enochian font |

- **It is strict.** The package's `tsconfig.json` has `strict: true`.
  That was measured at 50–65 errors depending on the file set (65 in
  10 files by the review, 50 in 2 by ours; `TreeOfLife.tsx` holds 45),
  mostly indexing (TS7053) and untyped parameters, not the 16 first
  counted. `lune` and `nlopt-js` have no types and need declarations.
  `isolatedDeclarations` adds annotations on top. The app's own
  `strict: false` is out of scope. Typing `TreeOfLife` is also what gives
  it controls: 10 of its 15 props are implicit `any` today, and
  `letterAttr` (a `string`) and `colorScale` (untyped) become literal
  unions from `magick-data` (docgen spike).
- **Explicit file extensions.** `tsc` emits relative imports as written,
  and 216 in the package have no extension. Next's bundlers accept them,
  but plain Node, Jest and other strict ESM tools fail on every entry
  (packed-package spike, 11 November). A codemod names every file
  (`./layout.ts`, `./art/index.ts`) and the build sets
  `rewriteRelativeImportExtensions`; the declarations keep `.ts`
  specifiers, as `magick-data`'s do, and a strict consumer type-checks
  them under `bundler` and `nodenext`. `fontMetrics.json` is imported
  `with { type: "json" }` or becomes a `.ts` module. A test forbids
  extensionless relative imports.
- **`forwardRef` goes.** `SevenBranchedCandleStick`, `Tablet`, `RoseSigil`
  and `TableOfShewbread` take `ref` as a prop, as `TreeOfLife` and `GdHall`
  already do; docgen misses the defaults of an
  `export default forwardRef(function …)`.
- **`"use client"` only where a module cannot run on the server**, which
  corrects this plan's first draft. `TreeOfLife` and `GdHall` are built to
  be Server Components: the Tree guards its one effect with
  `"useEffect" in React`, the hall uses only `useId` and `useMemo`, which
  React's server build exports, and `GradeTree` records that marking the
  Tree `"use client"` pulled the data barrel into client chunks (plan 036,
  decision 10). The server-only render registry also imports `TreeOfLife`
  and `RoseSigilImage` for `renderToStaticMarkup`, where a directive would
  turn them into client references.
  - `RoseSigil` (hooks) is split from `RoseSigilImage`, and only
    `RoseSigil` is marked. Every export of a `"use client"` file becomes a
    client reference, so `RoseSigil.tsx` exports only the component;
    `letterIJ` and the rest come from `RoseSigilImage`.
  - `Moon` and `Mercury` are marked, each itself (marking `useHydrated`
    alone does not make its importers client modules).
  - The spike confirmed that the directives survive `tsc` as the first
    statement, and that a packed tarball renders `TreeOfLife`, `GdHall`
    and `RoseSigilImage` from a Server Component and hydrates `RoseSigil`,
    under `next build --webpack`, `next build` (Turbopack) and `next dev`
    with each.
- **`RoseSigilImage` handles any letter.** Today a letter outside the 22
  (a final form such as ם, or Latin text) throws during render
  (`ROSE_LETTERS[-1].length`). Final forms are normalised to their base
  letters and anything else is skipped, with the behaviour documented and
  tested.
- **The smoke test covers the published shape**, beyond magick-data's
  pack-install-type-check: it loads every entry in plain Node,
  `renderToStaticMarkup`s the Tree and a hall without a bundler, asserts
  which built files carry `"use client"` and which do not, and builds a
  Next fixture under both webpack and Turbopack, rendering from a Server
  and a Client Component.
- **Dependencies:**
  - Peer dependencies: `react` ^19, and `@types/react` ^19 as an optional
    peer.
  - Dependencies: `magick-data`, plus `astronomy-engine`, `lune`, `luxon`
    and `dot-prop`. `magick-data` is a dependency, not a peer: under its
    semver rules new rows are a minor bump, and a `^0.x` peer range would
    orphan every published components version at each one. Data
    publishes first, and the smoke test checks the range.
  - `nlopt-js`: **a regular dependency** (spike). It is one 909 kB
    CommonJS file with its WASM inlined as base64, so no bundler has a
    `.wasm` file to find; webpack puts it in a lazy chunk, outside the
    server bundle. As an optional peer left uninstalled, both bundlers
    fail on any page that reaches `RoseSigil` *or* `RoseSigilImage`,
    because the `import()` sits in the shared `roseSigilGeometry.ts`.
    So the optimiser (`loadNlopt`, `optimizeSigilPoints`) moves to its own
    module, which the server-capable `RoseSigilImage` never imports, and
    gains the catch it lacks around that import. A fresh consumer fails on
    `Can't resolve 'fs'` from nlopt's Emscripten glue under both bundlers;
    the package cannot fix that for a dependency's `require`, so the README
    gives both fixes: webpack's client `resolve.fallback { fs: false }`
    (the app's `next.config.ts` has it) and Turbopack's
    `resolveAlias { fs: { browser: "./empty.ts" } }`.
    **Only consumers of the live `RoseSigil` need it** (Gadi's question,
    11 November). The error arises only in browser bundles, and only when
    `nlopt-js` is in the module graph. With the optimiser in its own
    module, only `RoseSigil` reaches it: the spike's pages with just the
    Tree and the hall built with `nlopt-js` not installed at all. So no
    barrel or shared entry re-exports `RoseSigil` (bundlers resolve a
    re-export's imports even when tree-shaking drops it later), and the
    smoke fixture has a page that imports every other entry and builds
    *without* the alias. The README puts the alias under `RoseSigil`, not
    under installation. `nlopt-js` (MIT, last release 0.1.1, November
    2020) declares no `browser` field; a `"browser": { "fs": false }` in
    its own `package.json` would remove the need everywhere, since bundlers
    honour a package's own field. That is worth a pull request upstream,
    or a small maintained fork if it stays unmerged.
- **Fonts (Gadi, 11 November).** The hall's three WOFF2 subsets ship in
  the package under `fonts/`, about 17 kB together:
  - Noto Serif Italic, Latin-1, for the labels;
  - Noto Serif Bold Italic, the letters of East, West, North and South;
  - the 22 Hebrew letters, for the banners, in **Frank Ruhl Libre Bold**
    (OFL 1.1, no reserved name). Gadi chose it on 11 November after a
    side-by-side mock-up, and plan 079 made the change, on main since
    `9c120dbb`. Plan 079 also replaced FrankRuehl CLM everywhere in the
    app: its Frank-Ruehl family is plain GPL-2, with no document-embedding
    exception, contrary to plan 061 decision 7.

  The packed spike measured the three at 16,960 bytes.

  Reasons:
  - **Measurements.** `fontMetrics.json` measures the labels with exactly
    these files, and another version of Noto Serif can measure
    differently. That is why the hall names its own families.
  - **No setup.** The hall renders correctly offline and without loading
    fonts from anywhere.
  - **Nothing new is redistributed.** The app already serves the same
    files from `public/fonts`, from the public repository.

  The licence is SIL OFL 1.1 (Copyright 2022 The Noto Project Authors), and
  it declares no reserved font names, so the subsets may keep "Noto" in
  their names. The package's `LICENSE.txt` says `fonts/` is OFL rather than
  MIT, by path, as `magick-data`'s says which files are data. The two
  upstream `OFL.txt` notices ship beside the files, with the sources and
  hashes from `public/fonts/hall-font-sources.md`. The subsetting script
  and the TrueType copies resvg uses (`assets/fonts`) stay in the app.

  How a consumer gets them (spike, both tested under both bundlers from a
  Server Component):
  - **`import "magick-components/fonts/gd-hall.css"`**, the
    zero-configuration route: a CSS file with relative `url()`s, generated
    from `GD_HALL_FONT_FILES` and held equal to it by a test. The bundler
    emits and hashes the fonts. `sideEffects: ["*.css"]` keeps the import
    under any bundler.
  - **`fontBaseUrl`**, unchanged: the consumer serves the files from
    wherever they like.
  - A `fontUrls` module built on `new URL(…, import.meta.url)` also works,
    but needs a per-file URL prop since hashed names defeat a base URL.
    Added only if the explorer needs it.
- **The rest follows plan 052:**
  - `exports` pointing at the TypeScript sources, and `publishConfig`
    swapping them for `lib/` on publish;
  - `transpilePackages`;
  - a pack-install-type-check smoke test in CI;
  - a README whose counts are tested;
  - `sideEffects: ["*.css"]` (no CSS modules remain once `entity/`
    leaves);
  - MIT `LICENSE.txt`, with `fonts/` under OFL by path
    ([the licence note](#the-licence-of-a-drawing-that-is-code) says what
    MIT means for the drawings);
  - `magick-components` unscoped (plan 052 decision 2);
  - 0.x while the props settle;
  - the render identities pinned by tests unchanged by the move, as a
    stage E gate: moving files must not move a hash.
- **The fonts in two places** (`public/fonts` and the package's `fonts/`)
  are held equal by a test, byte for byte.

### The licence of a drawing that is code

The review raised this, and it is a consequence of a policy already in
force, not a new one. A component whose JSX *is* the drawing (the sigils,
the lamens, the hall art since stage H of plan 061) is MIT as code, path
data included. Anyone may take the drawing from the package under MIT. The
CC BY 4.0 statement covers the images magick.ly serves (pages, downloads,
`/api/render`), and the READMEs and `/open-source` say exactly that,
rather than claiming that "images the components draw" are CC BY. A
drawing meant to stay CC BY only would have to live outside the MIT
package.

In practice CC BY adds little to a served image of a component's drawing,
since anyone can render the same drawing from the package under MIT. So
`/open-source` and the image pages credit those as "drawn by
magick-components (MIT)"; CC BY keeps its weight for the hand-drawn images
in `public/` and for the data. Gadi confirmed this note on 11 November.

Two consequences, both checks rather than new policy:
- **A traced drawing records its source.** Gadi's tracings are his own, but
  a tracing of a modern edition's redrawing could carry that edition's
  rights. Each drawing in the package names the public-domain edition it
  follows (Agrippa, 1533, for the planetary seals), per the house rule on
  outside sources. Drawings from Regardie stay what they are today: facts
  such as a layout, drawn in our own art.
- **CC BY on the data cannot relicense text we do not own.** The packaged
  texts (Lenain's 1823 volume, the Keys, the seventy-two angels in English
  and French) must be public domain or our own work, translations and
  apparatus included. That is what A′'s provenance sign-off checks, and it
  is the item to take most seriously before the first publish.

### 8. Order against dark mode

The move in decision 7 waited for dark mode (plan 076) and Frank Ruhl
Libre (plan 079), which touch the same component files. Both are on main
since 11 November, so nothing now holds stage E back.

## Stages

Each stage is gated commits on a `gate/<name>` branch, in a clean
worktree, per the house rules.

| Stage | What | Depends on |
| --- | --- | --- |
| A | `magick-data` ready to publish: `private` off, `repository`, the `prepublishOnly` and `prepack` guards, the smoke test keeping its tarball, the README's install section and complete Sources with its tests; `publish.yml` with the packument rule, in three jobs with `id-token` only in the last, and its own `npm` environment (inert until the first manual publish), with a `--dry-run` of the verified tarball in CI on pull requests | — |
| A′ | The provenance sign-off; Gadi publishes `0.1.0-rc.0 --tag next` by hand and configures the trusted publisher; a version bump to 0.1.0 publishes from CI with provenance within two days; then `next` removed and tokens disallowed | the `npm` environment, before A merges |
| B | `/open-source` hub; `/about` and `OpenSource.tsx` link to it; nav, sitemap, search | — |
| C | The field manifest from the data build (`rowKey`, structured types, the map rule, the `texts` section, `ids()`'s `about` map), descriptions for all 199 field paths in `schemas.ts` (about 4–6 hours of writing) and their completeness test; `/open-source/data` (tables, texts and helpers) and the table pages with rows, links and the detail pane | B |
| E | `packages/magick-components`: move, violations to zero, explicit extensions, strict (typing `TreeOfLife`), ref as a prop, the nlopt optimiser in its own module, `RoseSigilImage` taking any letter, directives where needed, dependencies, fonts with `gd-hall.css`, smoke test (Node load, static render, directives, both bundlers), README; hashes unchanged | — (dark mode and Frank Ruhl Libre are merged) |
| F | Examples, the committed and trimmed `react-docgen-typescript` manifest with its freshness test, `/open-source/components` and the explorer pages; descriptions and their completeness test for every component with examples | E |
| G | `magick-components`, published as in A′ | F |

Stage D (TypeDoc) is gone: the field manifest replaced it (decision 6).
Thumbnails on `/open-source/components` use the `/api/render` image where a
component has a contract, so the index does not load nlopt's WASM or
astronomy-engine. Only the explorer page renders live. Help pages with
screenshots are not affected; none show these routes.

## Before any code

Per Gadi's workflow (assess → discuss → review → spike → plan → build):

1. **Adversarial review of this plan:** done 11 November
   ([below](#review-11-november-2026)).
2. **Spikes:** done 11 November, all throwaway, nothing committed. Their
   findings are folded into decisions 4 to 7 and the stages.
   - **The field manifest: feasible, with changes.** A prototype generator
     typed every field of all 29 tables from `schemas.ts` and `graph.ts`;
     the changes are the structured types, `rowKey`, the map rule, the
     `texts` section and `ids()`'s `about` map (decision 6).
   - **`react-docgen-typescript`: fit, behind a script.** It read
     `TreeOfLife`, `SevenBranchedCandleStick` and `GdHall` and expanded
     `magick-data` unions. It cannot be the component list, leaks a `ref`
     type across files, and misses `forwardRef` defaults; our own sources
     need typing (decisions 5 to 7).
   - **A packed `magick-components`: works, nothing blocks it.** Directives
     survive `tsc`; the tarball renders from Server and Client Components
     under both bundlers. Needed: explicit extensions, the optimiser split,
     `nlopt-js` as a regular dependency with the `fs` alias documented for
     both bundlers, and `gd-hall.css` for the fonts (decision 7).
   - **The publish rule against the live registry (read-only):** the
     packument tells the cases apart (404 for a missing package; 200 with
     the version present or absent), where `npm view` exits 1 with E404 for
     both a missing package and a missing version. Any other status fails
     the job. `magick-data` and `magick-components` are both free, and so
     are the forms npm's similarity check compares (`magickdata`,
     `magick_data`, `magick.data`, `magickcomponents`).
   - Provenance through `publish.yml` in its own environment is proved by
     the first CI publish itself (A′), the rc having gone out by hand.
3. **Visual mock-ups:** done 11 November. Static pages copying the site's
   shell and both palettes, at 1280 px and 390 px, with the real Tree from
   `/api/render`, the spike's field manifest and docgen output, and
   descriptions written for the occasion. They settled the table page's
   layout (decision 4) and showed the hub's licence wording needed the
   distinction the licence note draws. The images were throwaway and are
   not committed.

## Stage A (11 November 2026)

Built on `gate/data-publish`, rebased onto `main` at `c768e5b1`; not
merged. Each code commit was gated on its own tree in a clean worktree
with a fresh install, after the rebase.

| Commit | What |
| --- | --- |
| `093ad7a2` | `feat(magick-data): Make the package publishable` |
| `bcc5dc36` | `ci(publish): Publish magick-data from CI` |
| `fc3bedd4` | `fix(publish): Apply the stage A review` ([below](#stage-a-review-11-november-2026)) |
| `9d34b8d2` | `fix(publish): Apply the second stage A review` ([below](#second-stage-a-review-11-november-2026)) |

Every gate ran, one at a time with the Node 24.18.0 of `nvm`: a `git
clean -ffdx` of the worktree, `pnpm install --frozen-lockfile`, `loom
init`, `loom check` and `loom check --production` (the tree still
clean), `pnpm check`, `pnpm typecheck`, the smoke test, the registry
steps that commit's `ci.yml` runs, `pnpm test:coverage`, `pnpm build`
and `pnpm check:turbopack`, with `ci.yml`'s placeholder environment and
no `.env` file. Every step passed on each of these four trees, coverage
without a re-run, and left the tree clean:

| Commit | Registry steps | Tests |
| --- | --- | --- |
| `093ad7a2` | none (the smoke test without `--keep-tarball`, as its `ci.yml`) | 8141 |
| `bcc5dc36` | the rule on the kept tarball, then `npm publish --dry-run` with its tag, using the local npm 11.18.0, the version its `pnpm dlx` pinned | 8181 |
| `fc3bedd4` | the `registry` job as on a pull request that leaves the version alone (`--advisory all`), the rule on the manifest as `decide` runs it, the dry run, and `npm pack --dry-run` in the package, refused | 8201 |
| `9d34b8d2` | as `fc3bedd4`, and `pnpm --filter magick-data exec npm pack --dry-run` and `npm pack` with a `pnpm/` user agent, both refused | 8215 |

The rule said `skip: magick-data@0.0.0: magick-data is not on the
registry; its first publish is by hand` each time. From `fc3bedd4` CI's
dry run uses npm 11.19.1 (Node 24.22.2); neither is installed here, so
the gates used npm 11.19.0 (Node 24.21.0), the nearest. A first gate of
the second review's commit failed `pnpm typecheck` on a test's `env`
type; the commit was amended and gated again from scratch. `actionlint`
1.7.12 found nothing in the three workflows at `bcc5dc36`, `fc3bedd4`
and `9d34b8d2` (without shellcheck, which is not installed here).

- **The manifest:** `private` gone; `repository` (with `directory`),
  `homepage`, `bugs`, `description` and `keywords` added; `license` is
  the SPDX expression `(MIT AND CC-BY-4.0)`, the files split by path as
  `LICENSE.txt` says; the version still 0.0.0.
- **The guard:** `prepublishOnly` runs `scripts/prepublishGuard.mjs`,
  which refuses a manifest whose `exports` point into `./src/`. Run in the
  package directory, `npm publish --dry-run` (the local npm, 11.18.0)
  and `pnpm publish --dry-run` both exit 1 with its message; `npm publish
  <tarball> --dry-run` passes. Neither tool runs lifecycle scripts for a
  tarball, and `pnpm pack` drops `prepublishOnly` (with `prepack`,
  `prepare`, `postpack` and `publish`) from the manifest it packs, which
  the smoke test checks. A `prepack` guard, the same script with
  `--pack`, refuses to pack under anything but pnpm, so `npm pack` cannot
  make a tarball whose exports point into `./src/` (review, L1). It asks
  `npm_execpath`, which npm always sets to its own `npm-cli.js`, as well
  as the user agent, which npm passes on when it inherits one: `pnpm
  exec npm pack` packed until the second review. A missing
  `npm_execpath` refuses; `pnpm install` never runs `prepack`.
  `--ignore-scripts` would skip both guards.
- **The verified tarball:** `pnpm --filter magick-data smoke
  --keep-tarball <path>` copies the tarball it verified to `<path>` and
  prints its SHA-256 and npm's `sha512-…` integrity. `publish.yml`
  publishes that file. The smoke test also holds the README's Sources to
  the tarball's `dist/**/*.json`.
- **The README:** an install and usage section; a sentence on releases
  under "Versions"; and a Sources table of every published data file
  (36 JSON5 sources and `graph.json`) with where each comes from, with a
  heading per work and a new Geomancy section (plan 075). `readme.test.ts`
  holds the table to the JSON5 sources the manifest's `files` publish and
  checks every in-page link in it, so a new data file without a row fails.
  Rows whose source is not recorded say so; they are the sign-off's
  questions below. A "Signed off" column holds the date the owner signed
  each row off; every row is empty until stage A′ step 3.
- **The packument rule:** `scripts/npm-publish-decision.mjs <tarball>`
  reads the name and version from the tarball, fetches the abbreviated
  packument (15-second timeout, two retries on network errors, 429 and
  5xx) and decides: 404 skip; listed skip; absent and above `latest` (or
  no `latest`) publish; absent and not above fail; anything else fail. A
  pre-release publishes under `next`, a release under `latest`; the tag
  is reported whatever the action, so a dry run can use it. Tested with a
  mocked `fetch` for every branch. Against the live registry on
  11 November: `skip: magick-data@0.0.0: magick-data is not on the
  registry; its first publish is by hand`.
- **`publish.yml`:** on pushes to `main`, as decision 3 describes:
  `decide` (no install), then `quality` and `build` only when it says
  publish, then `publish` in the `npm` environment, the only job with
  `id-token: write`: `npm publish <tarball> --provenance --access public
  --tag <tag> --loglevel verbose` (npm reports a failed OIDC exchange
  only at verbose, and otherwise says ENEEDAUTH). Every job requires
  `github.repository == 'gadicc/magickly'`. Actions are pinned by SHA; no
  `NPM_TOKEN`. npm's refusal to publish over a listed version, which a
  packument cached for up to five minutes can lead to on a re-run, makes
  the job read the registry again (`--expect-published
  --same-content`): the verified tarball's integrity there is a skip
  with a warning, other bytes or no listing fail. The job's second
  decision fails the same way on a version listed with other bytes,
  and it checks the downloaded tarball's integrity against `build`'s.
  The tarball artifact is kept three days and overwritten when all jobs
  are re-run.
- **npm itself:** `actions/setup-node`, pinned by SHA, installs Node
  24.22.2 exactly, whose bundled npm (11.19.1) publishes; the job fails
  clearly if `npm --version` is below 11.5.1, which trusted publishing
  needs. Not `pnpm dlx npm@…`, which the lockfile does not pin by
  integrity, and not whatever `npm` is on the runner's `PATH` after
  `pnpm/setup`, whose `runtime: node@24` floats. The publish job needs
  no pnpm at all. `ci.yml`'s dry run uses the same Node.
- **CI's dry run:** `ci.yml`'s `registry` job downloads the smoke
  tarball from `checks`, runs the rule and dry-runs `npm publish` of
  it with the rule's tag. It runs on pull requests and `codex/**`
  pushes only, and is not among `verify`'s needs, so neither
  `release.yml` nor `publish.yml` (both call `ci.yml` on a push to
  `main`) waits on registry state the repository does not control: a
  squatter at a higher version, an older commit after the rc, an
  outage (review, M2). On a pull request that changes the package's
  version (compared with the merge commit's first parent), a bump not
  above the registry's, or to a version it already lists
  (`--changed`), fails; otherwise, and for any registry error, the rule
  warns (`--advisory`). When the version
  is already published, the rule compares the tarball's integrity with
  the registry's and warns on a difference: content changed without a
  bump (L3). npm 11 refuses even a dry run of a version the registry
  lists and of a pre-release without `--tag`, so the dry run takes the
  rule's tag and is skipped once the version is published or the rule
  could not decide.

### Stage A′: the owner's steps

In this order. Commands run with Node 24, whose npm must be 11.5.1 or
later (11.15.0 or later for `npm trust`).

1. **Before merging stage A, create the `npm` environment** in the
   repository's settings (Settings › Environments › New environment,
   `npm`), with a deployment branch rule: "Selected branches and tags",
   `main` only. A job that names an environment the repository lacks
   creates it, with no rule, and merging stage A runs `publish.yml`;
   its `publish` job runs only when there is something to publish, but
   the rule should exist before anything can name the environment.
   `main` has no branch protection, so the rule guards against
   accidents (a workflow on another branch reaching the environment),
   not against anyone with write access. Optional, later: required
   reviewers on the environment, which would hold every CI publish for
   an approval.
2. **Turn on two-factor authentication** for the npm account, if it is
   not on. `npm trust` requires it, and step 9 relies on it.
3. **The provenance sign-off.** Settle each question below, edit the
   README's Sources table to match, and decide whether a file whose
   answer is not satisfactory leaves the tarball (a `!dist/…` entry in
   `files`, as the dictionary has) or its field is removed. Then sign
   off every row of the table, all 37 and not only the eight below, by
   putting the date (`YYYY-MM-DD`) in its "Signed off" column. Every
   row is empty until then, and the README test and the smoke test fail
   any version past 0.0.0 while one is; the date is the only thing they
   check, so it is the owner's word that the row is right.
4. **Bump to `0.1.0-rc.0`** in `packages/magick-data/package.json` and
   merge to `main`. `publish.yml`'s `decide` finds no package on the
   registry and skips; nothing else runs.
5. **Publish the release candidate by hand**, from a clean checkout of
   exactly the commit step 4 put on `main` (`<sha>`):

   ```sh
   git clone https://github.com/gadicc/magickly.git && cd magickly
   git checkout <sha>
   pnpm install --frozen-lockfile
   pnpm --filter magick-data smoke --keep-tarball "$PWD/magick-data.tgz"
   npm whoami
   npm publish ./magick-data.tgz --tag next --access public
   npm view magick-data@0.1.0-rc.0 dist.integrity
   ```

   with your own npm login. The smoke test builds the package itself;
   publish only the file it kept. It prints the tarball's SHA-256 and
   `integrity sha512-…`, and `npm view` should print the same integrity.
6. **Configure the trusted publisher, allowing `npm publish`.** On
   npmjs.com, the package's Settings › Trusted publishing › GitHub
   Actions: organization or user `gadicc`, repository `magickly`,
   workflow filename `publish.yml`, environment name `npm`, and under
   the allowed actions, **`npm publish`** ticked. A configuration made
   after 3 September 2026 otherwise allows only `npm stage publish`,
   and CI's publish would be refused. Or, from the command line:

   ```sh
   npm trust github magick-data --file publish.yml --repo gadicc/magickly --env npm --allow-publish
   ```

   The two days start here: a configuration that no publish validates
   within two days expires, and can then be neither used nor edited.
   This is also the moment to create the `magickly` organisation on npm
   ([Risks](#risks)).
7. **Bump to `0.1.0` within the two days**, and in the same commit set
   `DECISION_FLAGS: "--expect-exists"` in `publish.yml`, so that from
   then on a 404 fails instead of skipping. Merge to `main`. The rule
   finds `0.1.0` absent and above `latest` (the registry points
   `latest` at the release candidate), and the `publish` job publishes
   it under `latest` with provenance. Compare the integrity the `build`
   job printed with `npm view magick-data@0.1.0 dist.integrity`. If the
   publish fails with ENEEDAUTH, the verbose log shows the OIDC
   exchange. If the two days have lapsed, delete the expired
   configuration and create it again (step 6), then re-run the
   workflow: **Re-run all jobs** if the run is more than three days
   old, since the `build` job's tarball artifact is kept three days;
   within them, re-running only the failed `publish` job is enough.
8. **Retire the `next` tag:** `npm dist-tag rm magick-data next`, so
   that `npm install magick-data@next` no longer installs the release
   candidate.
9. **Disallow tokens:** once CI's publish has succeeded, set the
   package's Settings › Publishing access to "Require two-factor
   authentication and disallow tokens". Trusted publishing uses OIDC
   and keeps working; no token can publish the package any more.

### The sign-off's questions

Found while listing every published file; none is decided here.

| File | Question |
| --- | --- |
| `astrology/houses.json5` | `interpretation.en`, twelve sentences of up to 24 words, has no recorded source. It was added on 22 September 2024 with the first geomancy reading, the same work whose geomancy texts plan 075 found to follow the Hensons' essay. Check it against that essay and other modern sources, or rewrite it. |
| `astrology/planets.json5` | `magickTypes` is a modern, unsourced summary (plan 039), and its source was deferred indefinitely on 2 October. Publishing it grants CC BY on text whose author is unknown. |
| `enochian/letters.json5` | Added on 9 July 2023 in the commit that added the dictionary (`a1653a30`), whose entries come from Schueler and *The Whole Enochian Dictionary*. The names, English equivalents and Golden Dawn attributions are facts; `pronounciation` and `gematria` may follow Schueler's scheme. Confirm where they come from. |
| `alchemy/terms.json5` | `terms` holds short Golden Dawn phrases (Zelator grade, added 16 January 2023) with no recorded printing. If they are from a modern edition of Regardie, check that the wording is the Order's own and public domain. |
| `kabbalah/seventyTwoAngels.json5`, `seventyTwoAngelsText/en.json5` | The English is a language model's translation of the repaired French (plan 031). No third party has rights in it, but whether a machine translation carries the copyright that CC BY grants is unsettled; the README says the English is offered under CC BY. Decide whether to keep that claim or offer it as is. |
| `chakras.json5` | The file's comment cites Wikipedia's "Chakra" article (CC BY-SA). The fields are short facts (names, places, petals, colours, seed syllables); confirm nothing longer was copied. |
| `geomancy/tetragrams.json5` | Its first line cites Wikipedia's "Geomantic figures"; plan 075 replaced the texts, so the link may only cover the figures' names and dots. Confirm, or drop the link. |
| `enochian/tablets.json5` | Greer's edition (Llewellyn, in copyright) is one of the readings. The letters are facts and the README says no rights are asserted over them; confirm that reading letters from its redrawn plates is acceptable for a CC BY package. |

### The provenance clean-up (12 November 2026)

Research on 11 November answered the questions above (Gadi's answers the
same day: source the copied texts afresh, separate the Golden Dawn's
Enochian from Dee's, trust Leitch over Schueler, keep Greer's readings
if they are only facts). Built on `gate/provenance`; every row is still
Gadi's to sign off.

| File | Found | Done |
| --- | --- | --- |
| `astrology/planets.json5` | `magickTypes` is verbatim, all 136 words, from David Rankine's "Planetary Magic" in *Llewellyn's Complete Book of Ceremonial Magick* (2020), and was live on the planet pages | Removed from the data, the schema, the planet pages and the geomancy reading, whose planet hint now quotes the Key of Solomon (Mathers, 1888). No replacement: the Key of Solomon row already says what each planet serves for. The text stays in the repository's history since July 2024 |
| `astrology/houses.json5` | `interpretation.en`, the "House of …" names and the mottos' English are verbatim from Wikipedia's "House (astrology)" table (revision 1245488398, CC BY-SA) | Rewritten in our own words from Lilly, *Christian Astrology* (1647), I.vii, pp. 50–56 (archive.org `b30338724`, leaves n84–n90); no five-word run in common with either revision of the article. The mottos' Latin is the verse as usually quoted, so the ninth is *Pietas* ("Piety") where the table had `Iter` (Gadi, 12 November); their English is translated afresh; `name` is dropped |
| `enochian/letters.json5` | `pronounciation`, `gematria`, `tarot` and `planet/element` are Schueler's (1985); the gematria and tarot are his own derivations, given by neither Dee nor the Order | `names` and `sounds`, each `gd` and `dee`: the Order's from Regardie vol. 4 (1940) pp. 297–300 and Crowley's Keys in the *Equinox* I(8), Dee's from Sloane MS 3188, his notes in Casaubon (1659), Leitch vol. II and Laycock (facts only). `gematria` and `tarot` dropped. `tetragramId` links the sixteen letters the Order gives the geomantic figures (Regardie vol. 4 p. 77, read by image): Schueler differs for E, G, P, S and T, and our old data followed him |
| `alchemy/terms.json5` | The Second Knowledge Lecture as printed in Regardie vol. 1 (1937), pp. 119–120; vol. 1 was renewed (R341660) and is in US copyright until the end of 2032 | Cited; the Order's own short phrases, with no rights asserted, outside the CC BY grant |
| `enochian/tablets.json5` | Greer's plates differ from the 1940 and 1912 prints' letters in one square only, giving Dee's and Raphael's letter; the rest is typography | The `greer` reading stays, with that note; the Seniors are cited from Regardie vol. 3 (1939) p. 73 instead of Greer; Sloane MS 3191 ff. 52r–80v added for when the British Library's images return |
| `chakras.json5` | Facts only: the longest string is 29 characters | Said so in the README; the Wikipedia link is a reference |
| `kabbalah/seventyTwoAngels…` | Machine translation of a public-domain text | Unchanged: Gadi keeps the CC BY claim |
| `geomancy/tetragrams.json5` | The Wikipedia link covers only the names and dots | Unchanged |

Removing `magickTypes` changed the site search catalogue, so the search
vectors were refreshed with it: `search:compare` embedded the nine
changed passages with Gemini (29 requests) and the whole Qwen comparison
profile (3038 requests, whose cache had not been copied), under the
scripts' conservative input estimate of at most $0.71; `search:publish`
then requested nothing.

**Commits:**

| Commit | What |
| --- | --- |
| `0215209e` | `magickTypes` removed, the search vectors refreshed |
| `5b207e84` | The houses from Lilly |
| `ce8d9301` | The alchemy terms and chakras cited |
| `3c1dba15` | The Enochian letters in both traditions |
| `438953df` | The tablets' Seniors cited in print, the Greer note |

**Left for Gadi:**

- Vol. 3 p. 73 spells three Seniors unusually (Alphctga, Saiinor,
  Aaetpoi); nothing reads them.

### The sign-off (12 November 2026)

Gadi signed off all 37 Sources rows on 12 November (A′ step 3), after
one last check. The paragraphs `c768e5b1` had added to
`astrology/planets.json5` for the three spheres, Earth, Uranus, Neptune
and the nodes (sixteen strings, written the day before from
public-domain sources) were compared with 25 Wikipedia articles on
their subjects, five-word runs as for the houses. None shares more
than seven words in a row, and the eleven runs of five to seven are
stock phrases or facts: "the sphere of the fixed stars and", "fire,
water, air and earth", "Uranus on 13 March 1781". The other long
strings in the correspondence files are the Key of Solomon (Mathers,
1888), the geomancy houses in our words from Agrippa and Crowley (plan
075) and Dee's Keys; the rest hold only short facts. Every row reads
2026-11-12. Step 4, the bump to `0.1.0-rc.0`, followed the same day.

### The release candidate (12 November 2026)

Step 4 is `6a62106f`; on `main`, `publish.yml`'s `decide` found no
package and skipped. Gadi published `0.1.0-rc.0` by hand from that
commit (step 5): 209 files, the registry's integrity
`sha512-xUaZF6fLuNEwHz3/I6tL9LAWA4eDHj6N30r+c2koFJ+MwVyZVkqpmBN8WlwS9VDDSPpu4rSANOM6NQvUrphIFA==`.
The registry points both `latest` and `next` at it. Four minutes
before, npm had created `0.0.0-stage`, its own two-file "temporary
package placeholder for staged publishing", on no tag; it sorts below
every real version and the publish rule ignores it. The trusted
publisher is to allow `npm publish` only: CI sets the tag through
`npm publish --tag`, and removing `next` (step 8) is Gadi's, by hand.
Step 7's bump to `0.1.0` with `--expect-exists` followed; run against
the registry before merging, the rule answered "magick-data@0.1.0 is
new (latest is 0.1.0-rc.0); publish under latest".

### 0.1.0 (12 and 13 November 2026)

Step 7 is `f630052b`. Its `publish.yml` run (43250783458) passed every
job; `publish` exchanged GitHub's OIDC token for npm's, decided
"magick-data@0.1.0 is new (latest is 0.1.0-rc.0); publish under
latest", and published with a signed SLSA v1 provenance statement
(Sigstore log index 3835347336). npm answered 202 and listed the
version about five minutes later, under `latest`, with the integrity
the `build` job printed,
`sha512-2J5UoTwFOjXniUFw9N/8NoYQH3U7nzUbCz1ZJd8Oaze12fzvgYwczBNt/2qZbqwJKTkLV1xT1LOyIbXDICXSNQ==`.
On 13 November Gadi removed `next` (step 8; the registry's only tag is
now `latest`) and set publishing access to require two-factor
authentication and disallow tokens (step 9, his word; the setting is
not visible from outside). Stage A′ is done; stages B to G wait for
his go-ahead.

### Stage A review (11 November 2026)

An adversarial review of stage A's commits found the following; each was
checked against the code before it was changed. Gadi decided the
publishing model the same day: directly with provenance, not staged
(decision 3). Applied in `fc3bedd4`.

| # | Finding | Disposition |
| --- | --- | --- |
| H1 | The publish job held `id-token: write` through install, build, smoke and a run-time npm download, on every push to `main` | Fixed: `decide`, then `quality` and `build` without `id-token`, then `publish` alone in `npm` (decision 3) |
| H1, L12 | `pnpm dlx npm@11.18.0` is not pinned by integrity | Fixed: `actions/setup-node` by SHA at Node 24.22.2, npm 11.19.1, asserted at 11.5.1 or later; the same Node for CI's dry run |
| H2 | A′ missed allowing `npm publish` on the trusted publisher, 2FA, disallowing tokens, and re-creating an expired configuration | Fixed in the steps above, with the UI route and `npm trust github … --allow-publish` |
| M1 | The `npm` environment was created after merging; no repository guard | Fixed: step 1 creates it, limited to `main`, before the merge; every `publish.yml` job requires `gadicc/magickly` (L11) |
| M2 | `ci.yml`, which `release.yml` reuses, failed on registry state the repository does not control | Fixed: a `registry` job on pull requests and `codex/**` pushes only, outside `verify`'s needs; fatal only for a pull request's own bump |
| M3 | The provenance sign-off was not enforced | Fixed: the README test and the smoke test refused a version past 0.0.0 while a Sources row said "not recorded" or "not known". Replaced by the "Signed off" column ([second review](#second-stage-a-review-11-november-2026), 3) |
| M4 | CI ran twice on every push to `main` | Fixed: `publish.yml` runs `ci.yml` only when publishing, for that exact commit. Depending on `release.yml`'s run instead would tie npm to the deploy's success |
| L1 | `npm pack` then `npm publish <tgz>` bypassed the guard | Fixed: a `prepack` guard refuses to pack under anything but pnpm; tested both ways, and `npm pack --dry-run` exits 1. `--ignore-scripts` still bypasses it |
| L2 | A 404 skipped forever | Fixed: `--expect-exists`, switched on with the bump to 0.1.0 (step 7) |
| L3 | "Published, skip" could not see changed content | Fixed where a tarball exists: the rule warns when the registry's `dist.integrity` differs. See the follow-ups |
| L4 | Pre-releases were compared with `latest` only; `next` was left on the rc | Fixed: a pre-release must also be above `next`; step 8 removes `next` |
| L5 | The README said a pre-release is never `latest` | Fixed |
| L6 | A re-run within the packument's five-minute cache decides "publish" and npm refuses | Fixed: npm's "cannot publish over" refusal is a skip with a warning; the second review (5) has it check what npm has first |
| L7 | The command line was untested; the registry fixed; a body timeout read as "not JSON" | Fixed: tests run the script against a local registry (`--registry`) and check its outputs; a body timeout is retried and named |
| L8 | Nothing held the Sources table to the tarball itself | Fixed: the smoke test compares it with the tarball's `dist/**/*.json` |
| L9 | A′ step 3 cloned `main`'s tip; no integrity to compare | Fixed: `git checkout <sha>`; the smoke test prints the `sha512-…` integrity |
| L10 | The manifest lacked `description` and `keywords`; `license` was not SPDX | Fixed: both added, and `license` is `(MIT AND CC-BY-4.0)`, which npm accepts. `scripts` and `devDependencies` stay in the packed manifest: `pnpm pack` has no way to drop them short of rewriting the tarball, and neither does anything for a consumer (no install hook) |
| L13, L14 | Wording on the expiry, 2FA and "disallow tokens" | Fixed in decision 3 and the steps |

### Second stage A review (11 November 2026)

A second review of stage A, after the rebase onto `c768e5b1`. Each
finding was checked against the code first; findings 1 and 3 were
reproduced. Applied in `9d34b8d2`.

| # | Finding | Disposition |
| --- | --- | --- |
| 1 (medium) | The `prepack` guard keyed on `npm_config_user_agent`, which npm passes on when it inherits one, so `pnpm --filter magick-data exec npm pack --dry-run`, or `npm pack` with a `pnpm/` agent in the environment, packed `exports` into `./src/` | Fixed, reproduced first: the guard also needs `npm_execpath` to be pnpm's (npm always sets its own `npm-cli.js`). A missing one refuses; no install hook runs the guard, which a test holds. Tests for plain npm, npm under pnpm, pnpm, another tool and a missing variable; the smoke test runs three of them, and the gate ran npm itself |
| 2 (low) | A pull request that bumps to a version the registry lists passed, and on `main` would skip and never publish | Fixed: `--changed`, from the `registry` job when the version changed; a listed version fails |
| 3 (low) | Matching "not recorded" and "not known" could be dodged by rewording, and four of the eight questions said neither | Fixed: a "Signed off" column, a date or empty, read strictly; every row empty today. Step 3 above says so |
| 4 (low) | A re-run after a failed publish: the `build` upload had no `overwrite`, and a one-day artifact could lapse before a re-created trusted publisher | Fixed: `overwrite: true` and three days; step 7 says when to re-run all jobs |
| 5 (low) | The "cannot publish over" skip did not check what npm had | Fixed: the decision script reads again with `--expect-published --same-content`; the same integrity skips with a warning, anything else fails. `--same-content` also makes the second decision fail on a listed version with other bytes, where it warned |
| 6 (low) | The `registry` job compared with `pull_request.base.sha`, which can be older than the merge commit's base | Fixed: `HEAD^1` of the merge checkout, `fetch-depth: 2` |
| 7 (low) | The plan recorded hashes and gates from before the rebase, and a dry run with npm 11.18.0 where CI uses 11.19.1 | Fixed: the hashes above, and every code commit gated again after the rebase |

#### Follow-ups

- **Changed content on `main`.** The integrity warning (L3) needs a
  tarball, so it runs in CI's `registry` job, on pull requests and
  `codex/**` pushes. A commit pushed straight to `main` that changes the
  data without a bump is not warned about; `publish.yml`'s `decide` reads
  only the manifest. If that happens, run the rule on the tarball in a
  job outside `release.yml`'s path.
- **Required reviewers on the `npm` environment**, if anyone but Gadi
  ever gets push access to `main` (decision 3).

## Review (11 November 2026)

Fable 5.2 at high effort, fresh context, `loom-torvalds-review`, on the
first draft and `main` at `0ef4e33f`. Read-only; it did not run builds.
Findings 1, 2, 5 and 6 were checked against the code before they were
accepted.

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | `"use client"` on `TreeOfLife` and `GdHall` would break their server use (plan 036 decision 10, the render registry) | Accepted; decision 7 rewritten, `RoseSigil` split |
| 2 | Packing alone can ship stale `lib/`/`dist/`; no `repository` field | Accepted; decision 3 (verified tarball, `repository`, `prepublishOnly`) |
| 3 | `npm view` E404 cannot tell a missing package from a missing version; stage A was not inert | Accepted; the packument rule |
| 4 | Publishing from `release.yml`/`Production` lets the deploy's OIDC token mint npm tokens | Accepted; `publish.yml` with its own environment |
| 5 | Row fields carry no JSDoc and TypeDoc would not expand them | Accepted; the field manifest, TypeDoc dropped, stage D gone |
| 6 | Contracts cannot drive controls | Accepted; controls from docgen, examples hold props only |
| 7 | Strict is 50–65 errors, not 16 | Accepted; re-estimated |
| 8 | README Sources omits plan 075's geomancy texts; no test | Accepted; sign-off gates A′ |
| 9 | Texts are not tables; the table pages compete with entity pages | Accepted; texts listed, table pages `noindex,follow` |
| 10 | A `^0.x` peer on `magick-data` orphans components at each minor | Accepted; a dependency |
| Low | Import counts; `nlopt-js` as an optional peer; Mercury's hard-coded images; live thumbnails; generated JSON wiring; the sigil licence; a throwaway 0.1.1; render identities | All accepted, in decisions 3, 6 and 7, the licence note and the stages |

## Open questions

None. Gadi settled the last ones on 11 November: the planetary-spirit
sigils are his own drawings and join the package (decision 7), the hall
fonts ship in it (decision 7, "Fonts"), the licence note stands, and the
table page puts its fields below its rows (decision 4).

## Deferred

- **Change detection and automated version bumps** (Gadi, 11 November):
  decide from the commits whether a package changed and by how much
  (semantic-release, or changesets once outside contributors arrive), in
  place of the hand bump in decision 3. Revisit after a few hand releases
  show how often they are wrong or forgotten.
- **Staged publishing** (`npm stage publish`, each release approved by
  a human with 2FA on npmjs.com; Gadi, 11 November), if an unattended
  release ever goes wrong or someone else gains push access to `main`
  ([decision 3](#3-releases-published-by-ci-when-the-version-changes-gadi-11-november)).
- **JSR** as a second registry, for its generated documentation.
- **A view of the assembled graph** (`react-inspector` 9, which handles
  cycles), if anyone asks to see `assemble()`'s output rather than the
  tables.
- **`magick-data/check`** (plan 052 follow-up) and **publishing the
  dictionary** (plan 052, deferred): unchanged.
- **Visual-regression testing** of the components, the one reason to
  reconsider Storybook.
- **A separate package of plain SVG files** (raised by Gadi, 11 November).
  Almost every drawing is procedural, drawn from the data, so there is
  little that is a static file. The seven sigils become components. The
  site already serves every contract-backed drawing as an SVG or PNG URL,
  and that is the channel for consumers who don't use React. Revisit when
  one asks for files. Since the server renderer exists, a package of
  pre-rendered SVGs (defaults and presets) could then be generated at build
  from `magick-components`, rather than a second source of drawings.

## Risks

- **A name is taken before it is published.** `magick-components` cannot
  be reserved without breaking npm's policy, and it ships last. Both names
  were free on 11 November, as were their punctuation-free forms. Low
  likelihood for a niche name. If it happens, the fallback is
  `@magickly/components`, which needs the `magickly` npm organisation;
  creating that organisation is worth doing at stage A′ either way.
- **The two-day window lapses.** Then the expired trusted publisher,
  which can no longer be edited, is deleted and configured again;
  nothing is lost.
- **TypeScript 7.** `react-docgen-typescript` uses the TypeScript compiler
  API, which TypeScript 7 (the Go port) changes, and it has had no release
  since June 2025. If the app moves first, the docgen script pins its own
  TypeScript 6; if that stops working, a small extractor on the compiler
  API replaces it, writing the same trimmed manifest.
- **Consumer setup for `nlopt-js`.** Every consumer that renders the
  live `RoseSigil` needs the `fs` alias. The README states it for both
  bundlers, and the smoke fixture carries it, so a change in nlopt or Next
  shows up in CI.
- **The example modules become stories by another name.** They hold only
  a title and props (and optionally an image link), are type-checked and
  are rendered by tests. Anything more is a smell.
- **An npm publish is permanent.** Hence the verified tarball, the guard,
  the rc under `next` and the packument rule (decision 3).

## Sources

- Storybook 10 and Next 16: https://storybook.js.org/blog/storybook-10/
- `@uiw/react-json-view` (2.0.0-alpha.44 on 11 November 2026):
  https://github.com/uiwjs/react-json-view
- `@textea/json-viewer` 4.0.1's MUI 6 peer:
  https://unpkg.com/@textea/json-viewer@4.0.1/README.md
- npm trusted publishers: https://docs.npmjs.com/trusted-publishers
  (read 11 November 2026: allowed actions, `npm stage publish` alone by
  default after 3 September 2026, the two-day expiry, deleting an expired
  configuration, "disallow tokens")
- `npm trust`: https://docs.npmjs.com/cli/v11/commands/npm-trust (npm
  11.15.0 or later, account 2FA, `--allow-publish`)
- Unvalidated trusted publishers expire after two days (2 October 2026):
  https://github.blog/changelog/2026-10-02-unvalidated-npm-trusted-publishing-configurations-now-expire
- npm dispute policy on name reservation:
  https://docs.npmjs.com/policies/disputes
- pnpm publish and provenance: https://pnpm.io/cli/publish
- Versions, peer dependencies and sizes: `npm view <package> version
  dist-tags peerDependencies dist.unpackedSize`, 11 November 2026.
