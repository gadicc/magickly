# Open source: the packages and their pages — 11 November 2026

Status: stages A and A′ done, `magick-data` 0.1.0 on npm
([below](#010-12-and-13-november-2026)); stages B and E merged
([below](#stage-b-13-november-2026), [below](#stage-e-13-november-2026));
the hardening before publishing built on `gate/components-hardening`
([below](#before-publishing-13-november-2026)), and stage C on
`gate/open-source-data` on top of it, its review applied
([below](#stage-c-13-november-2026)), and stage F on
`gate/open-source-components` on top of stage C
([below](#stage-f-13-november-2026)); none merged. Reviewed on 11 November 2026 and
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

## Stage B (13 November 2026)

Built on `gate/open-source-hub` from `ed66f81c`; not merged.

| Commit | What |
| --- | --- |
| `47b3bbf8` | `feat(open-source): Add the open-source hub` |
| `965b6c5a` | `docs(plans): Record stage B, the open-source hub` |
| `53a637e4` | `fix(open-source): Apply the stage B review` ([below](#stage-b-review-13-november-2026)) |
| (this commit) | `docs(plans): Record the stage B review` |

Each was gated on its own tree in a clean worktree with a fresh install and Node
24.18.0: `loom init`, both `loom check`s, `pnpm check`, `pnpm
typecheck`, the data smoke test, `pnpm test:coverage` (no re-run),
`pnpm build`, `pnpm check:turbopack`, the tree clean after each; every
step exit 0. A first gate, of the commit before an amend, failed
`src/analytics/insightsUrl.test.ts`, which requires every top-level
section to be public or private for Web Analytics; `open-source` was
added to its public sections.

- **`/open-source`** (`src/app/open-source/`), as first built (the
  [review](#stage-b-review-13-november-2026) changed its licence
  wording): a paragraph, then "Licences" and "The packages". The
  licences, each checked against the
  repository: the app AGPL-3.0-or-later (`LICENSE.txt`); the packages'
  code MIT, the drawings the components make included, path data and
  all ([the licence note](#the-licence-of-a-drawing-that-is-code)); the
  data and the site's hand-drawn images CC BY 4.0, with the images the
  site serves CC BY too but a component's drawing to be credited "drawn
  by magick-components (MIT)"; the halls' font subsets (Noto Serif,
  Frank Ruhl Libre) OFL 1.1, linking `public/fonts/*-OFL.txt`; others'
  work under its own licence, credited at `/about#credits`; and the
  Enochian dictionary under none (`packages/magick-data/LICENSE.txt`).
  The Enochian font is not mentioned: it has no licence text and the
  page names only the halls' subsets.
- **The cards** (`PackageCard`): name (also the anchor, `#magick-data`,
  `#magick-components`), what the package is, then `npm i` and a usage
  sample only when one is given, and links to npm (only then) and to
  its directory on GitHub. `magick-data`'s sample is the README's, run
  against the workspace package (`Tiferet ☉`). `magick-components` has
  no sample, says "It is not on npm yet" and links `src/components`;
  stage G gives it a `usage` and its `directory` becomes
  `packages/magick-components`, and the card then shows the install
  and the npm link by itself.
- **Pages that do not exist yet.** The cards link no site page of their
  own: `/open-source/data` and `/open-source/components` are stages C
  and F, and each adds its link to its card then (a prop, or a line in
  the card's text). The components' card links the pages that show
  them today (the Tree, the tablets, the sigils, the candlestick, the
  shewbread, the halls). A test fails on any internal link outside the
  sitemap.
- **Around it:** `/about`'s licence section is two sentences and a link
  here, plus its existing line linking the running version's source,
  which the AGPL asks for and which stays; its design goals link
  `/open-source#magick-data` and `#magick-components`. `OpenSource.tsx`
  links "open-source" here before the file. The home page's "Open
  source, open data" links here, and now says the components are MIT
  rather than that the images they draw are CC BY.
- **Navigation:** `pathnames.ts` gains `"open-source": { "/": "Open
  source" }`, a section with no pages yet, so stage C adds `data:
  "Data"` and the bar shows "Open source › Data". The drawer now shows
  a section with at most one page as a single link (it showed an empty
  list). The page is in `PUBLIC_PAGES`, hence in the sitemap, site
  search and the social cards, which draw the Tree of Life for the
  section. The footer's "Open source" column holds "Source code" (the
  repository), moved from the Magick.ly column, as no page of the
  section exists yet; stages C and F add Data and Components from
  `pathnames.ts`. Web Analytics reports its paths in full, as a public
  section (`src/analytics/insightsUrl.ts`).
- **Tests:** `pageTexts.test.tsx` checks the hub's text like the other
  sections' (one section per heading, no skipped level, links only to
  pages that exist); its link check now admits https links to five
  named hosts (creativecommons.org, github.com, opensource.org,
  www.gnu.org, www.npmjs.com) and fails any other. `page.test.tsx`
  checks the metadata and sitemap entry, each licence named, the data
  card's install and links, and that the components' card offers no
  install and no npm link. siteNav, footer, app bar and social card
  tests cover the section.
- **Search:** the vectors were refreshed in the same commit.
  `search:compare` embedded 24 Gemini passages and 245 of the Qwen
  comparison profile (caches copied from two other worktrees first);
  `search:publish` requested nothing.
- **Checked in a browser:** `next dev` on port 3117 from this worktree
  with `ci.yml`'s placeholder environment, headless Chromium over CDP,
  at 1280 and 390 px in light and dark: `/open-source`, `/about`, the
  candlestick page's line, and the drawer. No sideways scroll at 390 px
  (`scrollWidth` 390); the usage sample scrolls inside its box.

### Stage B review (13 November 2026)

An independent review of `47b3bbf8` and `965b6c5a` found no critical
issue but licence wording that claimed more than the repository bears
out. The coordinator decided each finding, following [the licence
note](#the-licence-of-a-drawing-that-is-code); applied in `53a637e4`,
on top of `965b6c5a` because stage C had branched from it.

| # | Finding | Disposition |
| --- | --- | --- |
| H1 | The root README and `src/components/LICENSE.txt` said the images the app draws are CC BY 4.0 | Fixed now: component code is MIT, path data and the drawings it makes included; CC BY covers the images the site draws and serves, its hand-drawn images and the data. The README names `importBoundary.test.ts` as the list of files still importing app code ("that file" listed none) |
| M1 | "The images the site serves … are CC BY 4.0" took in photographs that are not ours (credited CC BY-SA) and images whose source is not recorded; the credits sentence promised every item; the fonts bullet left out fonts the site serves | Fixed: CC BY is claimed for "the images the site draws or makes itself"; others' work keeps its own licence, with the credits on About; the fonts bullet names every OFL font whose notice is in the repository (Roboto in `src/fonts/roboto`, Frank Ruhl Libre, the halls' Noto Serif subsets, Noto Sans, Noto Sans Hebrew, Noto Sans Symbols, Noto Sans Devanagari in `public/fonts`) and links those directories. The Enochian webfont is not named |
| M2 | "Credit it as drawn by magick-components (MIT)" disagreed with the hall pages and the halls' embedded credit (`GD_HALL_LICENCE.creditText`, "Magick.ly, CC BY 4.0") and named a package not on npm | Held back: until stage G the hub says the drawn images are CC BY 4.0 with credit to Magick.ly and their code MIT. **Stage G switches the hub, the hall pages and `GD_HALL_LICENCE`'s `creditText` together**, which moves the hall images' bytes then, not now. A test fails if the hub says "drawn by magick-components" early |
| M3 | `/about#licence` is the halls' `acquireLicensePage` (XMP and JSON-LD) and no longer said what the images are under | Fixed: one sentence there says the data and the site's drawn images are CC BY 4.0, with credit, and the code MIT, linking `/open-source#licences`; the hall pages' "see About" for MIT links there too. No image bytes change (`GD_HALL_LICENCE` untouched) |
| M4 | The components' MIT was unqualified for today's `src/components`, and "take the drawing from the package" implied a published package | Fixed: "apart from a few component files that still import code from the app", pointing to the README; the drawing sentence names no package, and the card says the components may be copied from `src/components` under MIT |
| Low | "Out of the data package" (it is in the workspace); "the app reads them as anyone else would" (not true of the components); the data's CC BY ignored what its README asserts no rights over; licence files unlinked; font links named the fonts; "the npm packages" in the snippet; "open-source" predicatively, two copyright forms, "set out under Open source"; `published` inferred from `usage`; cards not landmarks, two identical "Source on GitHub" links | Fixed: "not in the published data package"; the data card alone says the site reads it as anyone else would; "except where its README says no rights are asserted"; both packages' `LICENSE.txt` and `LICENSE-DATA.txt` linked; font links name the directories; "and the packages"; "is open source" (also on the 72 angels page, whose line now links the hub), "Copyright (c) 2020–2026" on both pages; an explicit `published` prop, an `<article>` labelled by its heading, and `aria-label`s naming the package |
| Tests | — | Added: each licence item's coverage; the usage sample equal to the README's; the anchors `/about` and the hall pages link exist; `OpenSource.tsx` links the hub; every link into this repository names a path that exists, which also catches the components' card when they move (stage E) |

The prose changed, so the vectors were refreshed again in `53a637e4`:
`search:compare` embedded 9 Gemini and 9 Qwen passages and
`search:publish` requested nothing. `53a637e4`'s gate passed every
step, coverage without a re-run. Checked again in headless Chromium
(`next dev` on port 3118, a fresh profile) at 1280 and 390 px, light
and dark; no sideways scroll at 390 px.

**Left for Gadi:**

- The licence wording as revised.
- "Source code" moving into the Open source column.

**Follow-ups:**

- **No recorded source or licence** for `public/night-sky.jpg`,
  `public/pics/mercury.webp`, `public/pics/30aethyrs.jpg` and the
  Enochian webfont (`src/components/enochian/font`; the TTF's notice,
  `assets/fonts/EnochianPlain-NOTICE.txt`, records it as freeware of
  unknown terms). The hub claims nothing for them; Gadi to say where
  they come from.
- **The fonts are not in `/about`'s credits** (Roboto, Frank Ruhl
  Libre, the Noto families); the hub names them and their licence.
- **Stage G** switches the hub's served-image credit, the hall pages
  and `GD_HALL_LICENCE.creditText` to "drawn by magick-components
  (MIT)" together, regenerating the hall images (M2).
- **Stage E:** the components' card's `directory="src/components"`
  becomes `packages/magick-components` (the repository-link test fails
  until it does), and `src/components/LICENSE.txt`'s second paragraph
  ("which import no app code") is still untrue for the files
  `importBoundary.test.ts` lists; stage E removes them.

## Stage E (13 November 2026)

Built on `gate/magick-components`, on top of stage B
(`gate/open-source-hub` at `a0c290c1`); not merged.
Each code commit was gated on its own tree, as stage A's were
([above](#stage-a-11-november-2026)); the last also ran the package's own
smoke test, which CI now runs in a job of its own. The imports were
rewritten by throwaway scripts, not committed, which can be run again
after a rebase: a rewrite for the first two commits and a codemod for the
third.

| Commit | What |
| --- | --- |
| `86a41a5e` | `refactor(components): Bring the boundary to zero` |
| `5cc5d608` | `build(components): Move components into a package` |
| `9189e246` | `refactor(components): Name every file imported` |
| `9089b41b` | `refactor(components): Type the package strictly` |
| `1cc885b3` | `refactor(components): Draw the client boundaries` |
| `ba1906ae` | `build(components): Prove the published shape` |

- **The boundary.** `Link.tsx`, `Tiles.tsx` and `entity/` moved to
  `src/ui/`, and the Enochian webfont with its `next/font/local` wrapper
  to `src/fonts/enochian.ts` and `src/fonts/enochian/`; `Tablet` already
  took the font's style as `enochianStyle`. `Mercury` takes `background`
  and `image` and draws an `<img>`. The plan said the image is passed as a
  URL; `image` also takes `<img>` props, so that the planets page can pass
  `next/image`'s `getImageProps()` and still serve the optimised picture
  (a plain URL would load the 52 kB original), which a test holds. The seven seals are TSX, from SVGR's output for
  `svg/astrology/spirits/` as `next.config.ts` ran it: each renders to
  the markup the SVG import did, which was checked for all seven. The
  Inkscape files stay as their sources. The known-violations list is
  gone.
- **The move.** `src/components` is `packages/magick-components/src`,
  `workspace:*` in the app, compiled through `transpilePackages`; 164
  specifiers in 99 files became `magick-components/…`, the alias left
  `tsconfig.json` and `vitest.config.mts`, and the boundary tests, the
  font script, `OpenSource`'s `url()` and the GitHub links followed.
- **Extensions.** All 290 relative specifiers name their file, and
  `fontMetrics.json` is imported `with { type: "json" }`; the boundary
  test refuses anything else. Both bundlers build them.
- **Strict.** The package's `tsconfig.json` is strict and `pnpm
  typecheck` runs it. On the package's files it reported 64 errors (45
  in `TreeOfLife.tsx`); it reports none. `TreeOfLifeProps` describes
  every prop, `colorScale` is `TreeColorScale` and `letterAttr`
  `TreePathAttribution`, both read from magick-data's types, and
  `vendor.d.ts` types what the package calls of `lune` and `nlopt-js`.
  Two things beyond the plan's list turned up: the fylfot cross used
  Next's styled-jsx, which only Next compiles (elsewhere it would restyle
  every table on the page), and is now a plain `<style>` scoped by a
  class; and Da'at in the King scale, which has no colour, threw. The
  Tree now leaves it out in that scale, as the app does, and refuses an
  unknown scale by name ([review](#stage-e-review-13-november-2026), 4).
- **Client boundaries.** `forwardRef` is gone; the optimiser is
  `gd/roseSigilOptimizer`, which `RoseSigil` catches failures from;
  `RoseSigil` is split from `RoseSigilImage` and alone of the two is
  `"use client"`; `RoseSigilImage` draws final forms as their base
  letters and leaves out anything else (`roseLetters()`); `Moon` is
  marked, its path and inclination moved to `astrology/moonPath`. A
  test holds the client modules to Mercury, Moon and RoseSigil.
- **The published shape.** 35 entries, each mapped to `lib/` by
  `publishConfig.exports`, and `./fonts/*`; `license` is
  `(MIT AND OFL-1.1)`, `sideEffects: ["*.css"]`, react a peer and
  `@types/react` an optional one, magick-data `workspace:^` (packed as
  `^0.1.0`) and `@types/luxon` a dependency because the declarations
  name luxon. `fonts/` holds the three subsets and two notices, byte for
  byte `public/fonts` (the font script writes both), `SOURCES.md` and
  `gd-hall.css`, each held by a test. The tarball had 159 files, 187,052
  bytes packed and 553,802 unpacked at this stage ([161, 192,411 and
  569,542 after the hardening](#before-publishing-13-november-2026)) (the spike's had 138 and 159,803 and
  486,836, before the seals, the fonts' notices and sources, and the
  README). `private` stays, at 0.0.0, until stage G.
- **The smoke test** (`pnpm --filter magick-components smoke`, about a
  minute here) packs both packages, checks the listing, the packed
  manifest and the directives, installs the tarballs with npm
  (`--before` a week back) into a fixture outside the repository, loads
  every entry and renders the Tree, a hall and the sigil in plain Node,
  type-checks a strict consumer under `bundler` and `nodenext`, and
  builds a Next app with webpack and with Turbopack: every entry but the
  live sigil with no `fs` stub, then `RoseSigil` with the README's stub.
  Without the stub, that second app fails under both bundlers with
  `Can't resolve 'fs'`, which was checked by hand.

Nothing a reader sees moved: every pinned render hash, byte count and
snapshot passed unchanged in each gate, and the hashed compiler identity
was not touched. The documentation screenshots show none of the changed
screens and were not regenerated.

**Deferred:**

- **`isolatedDeclarations`.** On the publish emit it asks for 131
  annotations, most of them return types on the hall's art; magick-data
  has it, this package does not yet.
- **The `prepack` and `prepublishOnly` guards** and a kept tarball, with
  `publish.yml`, in stage G; `private` refuses a publish until then.
- **The Tree page's query** is passed to `TreeOfLife` unchecked, as it
  always was, now through a cast: an unknown `colorScale` throws the
  Tree's own error, and an unknown `letterAttr` throws as before.
  Validating both in `treeSettings()` is a small follow-up.
- **Which edition Gadi's seals follow.** `planetarySpirits.tsx` cites the
  seals as the traditional ones printed in the Library of Congress copy
  of the 1533 edition, by page and leaf, without claiming the Inkscape
  drawings were traced from that printing. Gadi to confirm which edition
  he drew from, and the citation to name it if it is another.
- `actionlint` is not installed here, so the new CI job was not linted.

### Stage E review (13 November 2026)

An independent review of the six commits found nothing critical or high.
Its findings, with the coordinator's decisions, were applied on the same
branch before the rebase onto `gate/open-source-hub`.

| # | Finding | Disposition |
| --- | --- | --- |
| 1 (medium) | The fylfot cross passed a click handler to every square even without `onClick`, so a Server Component page could not prerender it | Fixed: no handler without `onClick`, and `cells` and `showColors` optional. The smoke test's Next page now renders every server-capable component (twelve) under both bundlers, and a unit test checks the cross without `onClick` |
| 2 (medium) | The seals' citation had no stable reference | Fixed: archive.org `DeOccultaPhilosophiaLoc1533`, a page and leaf for each spirit's seal (pp. CXLIX–CLIII, leaves n164–n168), read from the scans; Gadi to confirm his source (Deferred) |
| 3 (low) | The misplaced-directive test's pattern could never match | Fixed, with cases that a directive below the first line is caught and one in a comment is not |
| 4 (low) | Da'at in the King scale was drawn unfilled where the app treats it as invalid, and an unknown scale drew silently | Fixed: the King scale leaves Da'at out; an unknown scale throws by name; tests for both |
| 5 (low) | The optimiser, `RoseSigilImage` and `moonPath` were outside coverage | Fixed: in coverage at 95/90/95/95; tests for the optimiser's Node and browser loading bring all three to 100 % |
| 6 (low) | "The marked components are MIT" on `/about` and the root README | Taken from stage B's rewrite in the rebase |
| 7 (low) | `dataInputs.ts` linked the old path | Fixed |
| 8 (low) | The README called the Tree's default links magick.ly's, and did not say a click sets `location.href`; no `engines` | Fixed: root-relative links in the site's scheme, the click, and `engines` (`node >=22`) |
| 9 (low) | The strict consumer imported a few entries; nothing held the planets page to the optimised image | Fixed: the consumer imports all 35, and a test checks the `/_next/image` source |
| 10 (low) | `ref` takes no callback ref, undocumented; Mercury's `url()` unquoted | Fixed: documented in the props and the README; the URL is a quoted, escaped CSS string |
| — | The seals' TSX and their Inkscape files could drift | Fixed: a test runs SVGR as the build did on each file and compares |
## Before publishing (13 November 2026)

A final adversarial review of stage E found nine things to settle before
`magick-components` is published. They were fixed on
`gate/components-hardening`, from `gate/magick-components` at
`15b1370f`, one or two gated commits each, in the order below; not
merged. Every commit passed stage E's gate (the gate with the package's
smoke test) on its own tree. Twice the coverage step and its rerun failed
on 5-second timeouts in tests the commit does not touch, on a machine at
a load of 40 to 60: at `79c9258d` (the legacy SQL import, the Enochian
keypad) and at the first version of this record (eight files, from the
hall editor to the import). Each time the failing files passed alone,
and the next full gate passed. The Tree's first version failed the
gate's build, which the tests had not caught: see 9.

| Commit | What |
| --- | --- |
| `e276898e` | `fix(components): Carry moon-phase's BSD notice` |
| `1c6d8c92` | `fix(components): Take the Moon's background as a prop` |
| `ef0cdbaa` | `fix(components): Name unknown Tree ids and letters` |
| `f2f3e122` | `chore(components): Remove two unused Inkscape trees` |
| `7e75d587` | `fix(components): Take the fylfot cross's ink as a prop` |
| `79c9258d` | `test(components): Smoke-test against registry data` |
| `d63c32e5` | `fix(components): Scope the Tree's ids and stylesheet` |

| # | Finding | What was done |
| --- | --- | --- |
| 1 (high) | `moonPath` and the Moon's disc are a near line-for-line port of `phase_junk()` in [tingletech/moon-phase](https://github.com/tingletech/moon-phase/blob/643015a83509ca6a662d1af6e1ac14661852cedb/moon-phase.js), which is BSD 3-Clause, Copyright © 2012, Regents of the University of California (every file but its background image), while the package said MIT and OFL only and cited the source by its `gh-pages` branch | The package's `LICENSE.txt` carries the BSD notice in full and names the two files it covers, by path; `license` is `(MIT AND OFL-1.1 AND BSD-3-Clause)`. Both files open with a `/*!` attribution pinned to `643015a8`, the commit that last changed `moon-phase.js` (checked against the repository's history on 13 November; `gh-pages` has moved since, in April 2026, without touching that file), which `tsc` keeps in `lib/` and minifiers keep in bundles. Mercury lost a commented-out copy of the same drawing. A test and the smoke test hold the notice, the headers, the SPDX expression and the packed `lib/` files. The root README says so. The app's own credit is not yet made: see below |
| 1 (high) | `treeOfLifeFigure.tsx` credits [a CodePen](https://codepen.io/hari_shanx/pen/NRyPBz) for Malkuth's wedges | Judged to need no licence, recorded beside the code: what was taken (8f38b96d, June 2022) is the method, a line from the centre to the arc's start, an arc to its end, and back, with the ends found by polar-to-Cartesian arithmetic; a few lines of trigonometry with no expression of their own. CodePen makes public Pens MIT besides ([its licensing page](https://blog.codepen.io/documentation/licensing/)). The pen itself sits behind a bot check and no archived copy exists, so it was not compared line by line. The credit stays |
| 2 (medium) | The Moon drew `url(/night-sky.jpg)`, a 404 off magick.ly, and its glow filter had the fixed id `glow` | `MoonWidget` takes `background` as Mercury does (a URL drawn to cover, quoted and escaped, none if omitted; the escaping is a shared internal module); the filter's id comes from `useId`. The planets page and the Moon page pass the night sky; the README's "What you supply" says so |
| 3 (low) | An unknown `letterAttr` or `activePath`, or a letter the rose lacks given to `letterPoint()`, failed inside render with a TypeError | Each throws by name with what it takes, as `colorScale` does, checked as own keys; tests. A path of the other tradition's Tree is still drawn, as the image API always has. The Tree page still passes its query through unchecked ([stage E](#stage-e-13-november-2026), deferred) |
| 4 (low) | `Tree_of_life_gadi.svg` and `Tree_of_life_gadi 2.svg` sat unused under the MIT `src/`, without a recorded source | Deleted, not moved: nothing used them. History: the first came with `TreeOfLife2.js` on 17 June 2020 (`aaf4d4bd`), both were redone in December 2020 (`f305b4ee`, "not actually used in app"; `4eb256b3`, "not used in site"). The second's `dc:title` is the Wikimedia Commons description of [File:Tree_of_life_bahir_Hebrew.svg](https://commons.wikimedia.org/wiki/File:Tree_of_life_bahir_Hebrew.svg) by User:AnonMoos, public domain, which `/about` credits as the Tree glyph's inspiration. A test now holds `src/` to code, the hall's metrics and test snapshots |
| 5 (low) | The fylfot cross bordered its squares in `var(--mui-palette-ink, black)`, an app token; the README said every figure is an inline SVG | The cross takes `ink`, a CSS colour, set on the table as a custom property its stylesheet reads, black without it; the app passes its token. (`currentColor` would not do: a coloured square sets its own text colour.) The README says which figures wrap their drawing in HTML: the fylfot's table, the Moon's and Mercury's tiles, the spirit's `<div>` |
| 6 (low) | Stage E's tarball numbers were stale | At `d63c32e5`: 161 files, 192,411 bytes packed and 569,542 unpacked (`pnpm pack` after the build; the two new files are `lib/cssString.js` and its declaration) |
| 7 (medium) | The smoke test never took magick-data from the registry, so a component using something magick-data gained after its last publish would pass it and fail for a stranger | A second fixture installs the components' tarball alone, so npm resolves the packed `^x.y.z` from the registry; it checks the lockfile says so, loads every entry, renders the three drawings and type-checks the strict consumer. While the registry lacks the version the components were built with, the leg is skipped with a line saying why. It runs today against 0.1.0, which the workspace's magick-data already differs from (its README and a data fix), and passes |
| 8 (low) | `npm install --before` a week back failed for any pin, or floor of a range, younger than a week, which `--config.minimumReleaseAge=0` allows | `--before` is a week back or, if later, the newest publish time among the exact pins and the floors of the components' ranges, read with `npm view <name> time`. By hand, `magick-data@0.1.0` (published 12 November) fails with `ETARGET` under a week-old cutoff and installs under its own publish time, which the registry leg needs |
| 9 (high) | TreeOfLife wrote fixed ids (`TreeOfLife`, `paths`, `sephirot`, `keter`…, `topTextPath0`…), so two Trees repeated them and shared each other's label curves; its stylesheet fetched Noto Sans and Noto Sans Hebrew (about 480 kB) from magick.ly for every consumer and redefined both families page-wide; `a:visited *` was unscoped; `flip` turned every Tree on the page | The root's id is the new `id` prop or one from `useId`; every inner id begins with it and a hyphen, and every rule names `svg#<id>`. Fonts come from the new `fontBaseUrl` prop, as GdHall's do; without it the Tree names the families and loads nothing; the app passes `https://magick.ly/fonts` (`src/fonts/tree.ts`). The three layers carry documented classes (`TREE_LAYER_CLASSES`: `magick-tree-paths`, `magick-tree-path-letters`, `magick-tree-sephirot`), which the app's dark ink now selects on. The drawing itself is `TreeOfLifeSvg`, which takes its id and calls no hook, and `TreeOfLife` adds `useId` and the browser's link handling, as `GdHall` wraps `GdHallSvg`: the image registry's `renderToStaticMarkup` in the `/og` and `/api/render` handlers runs under React's server build, where `useId` has no dispatcher, and the first version failed the build's prerender of the social cards on it (tests now call the registry's Tree as a plain function). The registry draws `TreeOfLifeSvg` with `id="TreeOfLife"`, the root its published images have; the outliner strips every other id |

Gadi approved the Tree's markup changing before publishing (13 November:
"Yes, change it"), on the conditions that it stay visually identical,
that every pinned hash or snapshot that moves be named, that the dark
ink keep working and that the documentation screenshots follow any
screen they show. Nothing a reader sees moved with the Tree's change,
which was the commit expected to move render hashes. Every pinned render
hash, byte count and snapshot passed unchanged, the published ritual Tree's 150,785 bytes
included, because the registry keeps the old root and outlining drops the
ids and the stylesheet (the tests that moved read the old ids, not
hashes: three in the package's Tree tests, two path pages', one grade
page's); eleven more image API queries (flip, the King
scale with the Hebrew letters, Da'at, active paths and spheres, other
fields, PNGs) gave byte-identical output before and after. Ten Tree
variants (the default, Hebrew names, flipped, Da'at, King, an active path
and sphere, the grades, the stones) rendered to HTML and rasterised by
headless Chromium, in light and with the dark ink rules, are
pixel-identical before and after; two Trees on one page differ only in
that the unflipped one is no longer mirrored. The markup's differences,
read line by line, are the prefixed ids, the scoped selectors, the three
classes and a quote in `local('Noto Sans Hebrew')`. The documentation
screenshots show no Tree and were not regenerated.

Names that changed, for stage F's rebase: `MoonWidgetProps` (new, with
`background`); `FylfotCrossProps.ink`; `TreeOfLifeProps.id` and
`.fontBaseUrl` (which `GradeTree` passes through); the exports
`TreeOfLifeSvg`, `TreeOfLifeSvgProps` and `TREE_LAYER_CLASSES`; `letterPoint()` now throws for a letter the rose
lacks; the Tree's ids are prefixed and `id="TreeOfLife"` is gone unless
passed.

**Not done, for Gadi:**

- **The app's credit for moon-phase** (done in stage F's last commit,
  [below](#after-the-rebase-onto-stage-c-13-november-2026)). The BSD licence asks that a
  binary redistribution reproduce the notice in its documentation or
  other materials; the app serves the Moon's code to browsers. A credit
  in `/about#credits` (moon-phase, its copyright line and the licence,
  linking the components' `LICENSE.txt`) and a sentence after
  `/open-source`'s MIT line were written, but they change page prose,
  and refreshing the search vectors (`pnpm search:publish`) was refused
  by the session's permission check, so both were left out, to land
  with a vector refresh. Whether that credit should quote the notice in
  full or link it is Gadi's call.
- `public/night-sky.jpg` is not moon-phase's background (different
  bytes); its own source is not recorded here.

## Stage C (13 November 2026)

Built on `gate/open-source-data`, branched from stage B, rebased three
times as stage B moved, then onto stage E (`15b1370f`, its review
applied) and last onto the components hardening (`80ea484a`), so that
the merge order is a chain: B, E, the hardening, C; not merged. The
rebase onto E ran E's import rewrite on each commit, so the data pages
import `@/ui/Link`, with their imports sorted.

| Commit | What |
| --- | --- |
| `4ba903e0` | `feat(magick-data): Emit the field manifest` |
| `d2d18981` | `docs(magick-data): Describe every table and field` |
| `e9ea6c53` | `feat(open-source): Add the data pages` |

Each was gated on its own tree after the rebase onto the hardening, with
stage E's gate, in a clean worktree with a fresh install and Node
24.18.0: `loom init`, both `loom check`s, `pnpm check`, `pnpm
typecheck`, the data smoke test, `pnpm test:coverage`, `pnpm build`,
`pnpm check:turbopack`, the components' smoke test, the tree clean
after each; every step passed. Earlier gates of the same commits on
stage B had passed too. On this machine, gates run while the load
average was above 50 (several agents gating at once) timed out in
unrelated suites (`sqlLegacyImport`, `legacyImportMigrations`, the
hall editor, the dictionary keypad), different ones each run; such
runs were discarded and the commits gated again at a lower load.

- **The field manifest** (`src/fieldManifest.ts`, typed by
  `src/fields.ts`): the build writes `dist/fields.json` (with a module
  and an `unknown` declaration) after every source, and again after a
  source rebuilt alone in `--watch`, so the row counts and the texts'
  sizes are those of the JSON beside it. Per table: `description`,
  `subpath`, `source`, `shape`, `rows`, `rowKey` (`{ field }`, or
  `{ key: true }` for `angelicOrder` and `godName`; the build refuses a
  key that does not name each row once), `rules` (the schema's `v.check`
  messages: `enochianTablet`'s four) and `fields`. Per field: `path`,
  structured `type` (`string`, `number` with `constraints`, `boolean`,
  `picklist` with `values`, `object` with `keys`, `map` with `keys` and
  `of`, `array` and `tuple` with `of`), `optional`, `nullable`, `link`
  (`{ kind, to, many }` for links, pending and external ids, all from
  `graph.ts`), `columns` (from `v.metadata`), `display` and
  `description`. The graph's `enum` is a picklist, not a link. The map
  rule: the same schema object under every key, four keys or more, by
  identity, so an object whose keys merely share a type (a sephirah's
  colours) is not one; it finds `tetragram.meanings` and
  `enochianTablet.readings`, listed once at `*`. A schema kind the
  generator does not read throws. `TEXTS`, in `fieldManifest.ts` rather
  than `build.ts`, lists the nine text subpaths and one JSON-only text
  (`json/kabbalah/lenain/evidence.json`, which no module exports) with
  their sources, sizes, descriptions and pages; a test holds it to the
  published exports and to every non-table data file bar the
  dictionary. `ids()` takes `{ absent, nulled, about }`, typed by the
  graph's field names. The app reads it as `magick-data/fields`, a
  workspace export only, as the dictionary is.
- **Not published yet.** `!dist/fields.*` keeps it out of the tarball:
  as a published data file it needs a row in the README's Sources, and
  the "Signed off" date is Gadi's to give. Stage C changes the tarball
  only by that line of the packed `package.json`'s `files` (checked by
  packing the trees before and after it and comparing them file by
  file); the declarations in `dist/` are unchanged. The base itself now
  differs from 0.1.0 in `zodiac.json5` and the README, through main's
  `1ce38ab0`, not through stage C. To ship it as
  `magick-data/json/fields.json`, which `./json/*.json` already
  exports: drop the exclusion, add a Sources row (ours, built from
  `schemas.ts` and `graph.ts`) for Gadi to sign, say so in the README
  (and in its JSON section), have the smoke test load it, and bump the
  version: a new published file is a minor change under the README's
  rules, 0.2.0. A typed `./fields` subpath would also need
  `publishConfig.exports` and `tsconfig.build.json`.
- **The descriptions**: all 29 tables and all 272 field paths, 233
  distinct, written from the data files and their headers in our own
  words. The shared `{ en }` text is described once ("The text in
  English."). `fieldManifest.test.ts` fails on a table or field without
  one, or one that is not a sentence. Where the plan says 199 paths:
  that was the spike's count before `magickTypes` went (157 top-level
  fields now, not 158), under a narrower definition; this one counts
  every key of every object, a map's value once and an array of
  objects' keys at `[]`. Table descriptions were not asked for; the
  data page's one line per table needed them.
- **`marks[].doubt` stays a string** with a check whose message names
  `low`, `medium` and `high`, not a picklist as decision 6 said: a
  picklist would state the value literally in `tablets.d.ts`, which is
  published, and the schema's own comment gives that as the reason it
  is not one.
- **`/open-source/data`** (indexed; in the sitemap and site search):
  the three ways in, every table with its row count, subpath,
  description and the tables it links to and from, the texts with
  their size and the page that shows each, the five helpers documented
  by hand, the JSON, and the dictionary as not in the package. Its
  counts (the barrel's 26 of 29) are read from the package.
- **`/open-source/data/[table]`** (`noindex,follow`, an entity route for
  `routes.test.ts`, out of the sitemap and search): the heading names
  the table, then its description, import line and counts; the rows;
  then the fields, nested ones indented, a long object type shown as
  its kind. Columns per decision 4, with `sephirah.color` showing
  `queen` and `king` with swatches from the `*Web` values (Malchut's
  four); maps and arrays of objects only in the detail. The key column
  is sticky, each row is an anchor (`:target` highlights it), each link
  field links to its row on its table's page, each header to its
  field's entry. Hebrew values are set in Frank Ruhl Libre, which also
  draws Lenain's marks in `name.hePointed` (the system font showed
  them as missing glyphs).
- **The detail pane**, the one client island: an expanded row whose
  content is held to the frame's width by a container query (`100cqi`),
  with the row's JSON in `react-json-view-lite` 2.5.0 (two levels open)
  styled from the theme's CSS variables, "Copy JSON", "Link to row" and,
  for the planets, grades, sephirot, paths and genii, "Its page".
- **Navigation**: `pathnames.ts` has `data` as a section, `{ "/": "Data"
  }`, rather than the string stage B foresaw, so a table's page names
  itself under "Open source › Data" as an entity page does, and the
  index's bar title is the h1. The drawer still shows Open source as
  one link (a section with one page). The footer's Open source column
  lists Data before Source code; the hub's data card links the index.
- **Checked in a browser**: `next dev` on 127.0.0.1:3118 from the
  worktree with `ci.yml`'s placeholder environment, headless Chromium
  over CDP, 1280 and 390 px, light and dark: the index, `sephirah` with
  a detail open, `seventyTwoAngel`, `enochianTablet` at 390 px,
  `godName#ehiyeh` and the hub. No sideways scroll at 390 px; a first
  pass found the texts' long subpaths overflowing, now wrapped.
- **Search**: the vectors were refreshed in `e9ea6c53` on stage E
  (caches copied from four worktrees): `search:compare` embedded 4 Qwen
  passages and the changed Gemini ones (a first run, cut short by a
  gateway error, embedded those; the count was not kept), and
  `search:publish` requested nothing. On stage B it had been 95 Qwen
  passages. They still match on the hardening, which changed no prose.

**Left for Gadi:**

- The wording of the descriptions, above all where they say where a
  value comes from (Agrippa for the intelligences and spirits, the
  Golden Dawn for the double letters and the tribes, Lilly for the
  houses).
- Whether to ship the field manifest, with its Sources row and a bump
  (above).
- The index's title, "Open Data: the magick-data Tables", and the
  table pages' layout at 390 px, where only the key and two or three
  columns show before scrolling.

**Follow-ups:**

- npm's 0.1.0 still has "Bullm" for `zodiac.taurus.meaning.en`; the
  source reads "Bull" since main's `1ce38ab0`, and the next patch
  release ships it.
- The bar on a table's page links Data; the drawer does not list Data
  until the section has a second page (stage F).
- **Stage E's import rewrite:** the data pages import
  `@magick-components/Link` in `data/page.tsx`, `DataText.tsx`,
  `[table]/TablePage.tsx` and `[table]/RowDetail.tsx`; whichever of C
  and E lands second re-runs the rewrite over them.

### Stage C review (13 November 2026)

An independent review of `4ba903e0` to `9193b8ea` found no critical or
high issue. It confirmed that the tarball changes only by the `files`
line, that the field manifest is right, and that the descriptions it
sampled (about fifty) are accurate and in our own words. Applied in
`c8af8b1f`, gated on its own tree like the rest: every step exit 0,
coverage without a re-run.

| # | Finding | Disposition |
| --- | --- | --- |
| M1 | A row a link leads to was not marked: the highlight was `:target`, which the app router's `pushState` never sets | Fixed: the table reads the fragment on mount, on `hashchange` and `popstate`, and just after any click, and marks the row with `aria-current="location"`; links to the same table's rows and the page's own `#field-` links are plain anchors. Tested in jsdom, and in headless Chromium by clicking `gdGrade`'s `nextId` (`#1=10`) and its `sephirahId` to `sephirah#malchut`, and by loading `sephirah#malchut` |
| M2 | "The data is under CC BY 4.0" left out the exception the hub states | Fixed: "except where the package's README says no rights are asserted", linking the README's Sources, and the hub's licences |
| Low | "Each is shown on a page of the site", though two texts have none | Fixed: "Most are" |
| Low | "an id of a intelligence", "an id of a tarot-deck" | Fixed: "an id of an intelligence"; "an id from `tarot-deck`, outside the package" |
| Low | Lenain's pointed Hebrew drew missing glyphs in the JSON viewer; a lone Hebrew letter in a description was not in Frank Ruhl Libre | Fixed: the viewer's font list starts with Frank Ruhl Libre, which covers only Hebrew (its `unicode-range`); descriptions set Hebrew runs in it |
| Low | The marked row's sticky key cell let the scrolled cells show through | Fixed: the tint is a layer over the paper |
| Low | Descriptions: the intelligences' and spirits' source was not in the data file; `tetragram.meaning` understated the edits; code marks in `christianChoir`'s meta description | Fixed: `planets.json5`'s header cites Agrippa, *De occulta philosophia* II.22, for six intelligences and all seven spirits, and says the Moon's Shelachel is not his (a comment: `dist/` is unchanged); the description says so too; `tetragram.meaning` lists the changes its header records; meta descriptions drop code marks, and `christianChoir`'s has none. The README's Sources row is left as it is, for Gadi (below) |
| Low | `problemsOf` left out inverses that are not unique | Fixed |
| Low | This plan's "Bullm" follow-up was stale; "differs from 0.1.0 only in that line" | Fixed above |
| Low | `--watch` did not rebuild for `fieldManifest.ts`, wrote the manifest once per source, and wrote files in place | Fixed: a build input; once per burst; every output written to a temporary file and renamed, a stale `.tmp` pruned by the next build. No test runs the watcher: it would rewrite real sources under a running suite; `rebuildFor` is tested |
| Low | `constraintsOf` passed over validations it does not read | Fixed: any such step throws, on any kind (`max_value`, `length` tested) |
| Low | The index gave a text's subpath, not its import line (decision 4) | Fixed: `import * as keys from "magick-data/enochian/keys";`, and a JSON import for `evidence.json` |
| Low | The RSC payload carries every row's JSON | Measured, not changed: in `next dev`, `/open-source/data/seventyTwoAngel` is 878 kB of HTML, 483 kB of it flight data, of which the rows' JSON is 66 kB raw (about 84 kB escaped). Loading a row's JSON when its detail opens, from a static JSON route, would remove it, at the cost of a request and an offline failure; deferred |
| Low | Accessibility: the key cell, the status region, "Copied" | Fixed: `<th scope="row">`; the detail row is always in the DOM, hidden when closed, so `aria-controls` names an element; the status region exists before its message; "Copied" reverts after three seconds |
| Tests | — | Added: the island in jsdom (row header, toggle, JSON, both copy outcomes and the reset, the links, the marked row four ways); ids unique and no row named like a `field-`, `detail-` or frame id; the barrel's left-out tables link to none and from none; the articles, the Hebrew, the links; refused validations |

The prose changed, so the search vectors were refreshed again in
`c8af8b1f`: `search:compare` embedded the changed Gemini passages (the
count was not kept) and 4 Qwen ones, and `search:publish` requested
nothing. Checked again in headless Chromium at 1280 and 390 px, light
and dark; no sideways scroll at 390 px.

**Left for Gadi:**

- The README's Sources row for `astrology/planets.json5` does not name
  Agrippa for the intelligences and spirits; its sign-off is yours.
  Where the Moon's intelligence, Shelachel, comes from is not recorded.

## Stage F (13 November 2026)

Built on `gate/open-source-components`, first on top of stage E
(`gate/magick-components` at `15b1370f`), then rebased onto stage C
(`gate/open-source-data` at `1c77eb49`, which carries the components
hardening); not merged. The SHAs below are the rebased ones. Each code commit
was gated on its own tree with stage E's gate, which adds the
components' smoke test.

| Commit | What |
| --- | --- |
| `e9bee9b7` | `feat(components): Add examples and a props manifest` |
| `aeebe7c1` | `feat(open-source): Add the component explorer` |
| `0b1a2fbf` | `docs(plans): Record stage F, the component explorer` |
| `8647932e` | `fix(open-source): Apply the stage F review` ([below](#stage-f-review-13-november-2026)) |
| (this commit) | `docs(plans): Record the stage F review` |

Before the rebase, as `7d4ce30f`, `6b391ade`, `b281653a`, `8270c9eb`
and `c9d513fa`, every step of every gate passed, coverage aside as
follows. The first commit's coverage run failed once, on
`TempleHallTabs.test.tsx`'s timing test ("draws thumbnails only in
view, a few per frame") on a loaded machine, and the gate's re-run
passed every test. The first gate of `8270c9eb` ran at a load average
near 58: coverage and its re-run each failed on 5-second timeouts in
nine unrelated files (the legacy import, the semantic and hall editors,
the dictionary, R2 storage, the tablets); those nine passed run alone
(364 tests), and a second whole gate passed every step, coverage first
time. `c9d513fa`'s coverage failed once on the same timing test and
passed on its re-run; the second commit's passed first time.

- **The examples** (`packages/magick-components/examples`): a module
  per component, `<Name>.examples.tsx`, each exporting its entry, its
  export and one to seven examples of `{ title, props }`, typed against
  the component's props by the package's strict check (its `tsconfig`
  now includes `examples/`). `examples/index.ts` is the component list
  (decision 5), and a test holds it to the files, checks that each
  entry is in the package's `exports`, imports nothing but types,
  `../src/` and React, and renders every example. They are not in the
  tarball. Fourteen components: `TreeOfLife`, `GradeTree`, `GdHall`,
  `Lamen`, `RoseSigil`, `SevenBranchedCandleStick`, `TableOfShewbread`,
  `FylfotCross`, `Tablet`, `Kamea`, `PlanetarySpirit`, `Chakras`,
  `Moon`, `Mercury`. The plan's optional `imageHref` is not in the
  examples: the contracts are app code, which MIT examples cannot
  import, so the image links are the explorer's (below).
- **The props manifest:** `scripts/component-props.ts` (`pnpm
  components:props`) runs `react-docgen-typescript` 2.4.0 (a pinned dev
  dependency) with the options and prop filter decision 6 names, and
  writes `src/explorer/componentProps.json`, 26 kB, formatted by Biome:
  each component's JSDoc, and each prop's type, `required`, a default
  of 80 characters or less, its JSDoc and its control, required props
  first, then by name. docgen names a default export after its file or
  its function, so the script finds the default export's declaration
  with its own TypeScript program and passes it to docgen. docgen
  gives a string default without quotes, so the script quotes a
  default when the prop takes strings and the value is not another
  kind of literal. A test re-runs the script and compares (about a
  second), and fails on a component or prop without a description.
- **Descriptions:** Chakras, the candlestick, the shewbread and the
  Tree had no component description, and 19 props none (Kamea's
  `className` and `style`, the Moon's two, Chakras' three, Tablet's
  `id`, `width` and `height`, four of `GdHall`'s, five of `Lamen`'s).
  All are written; `ChakrasProps` and `MoonWidgetProps` are exported,
  and `Lamen`'s `width` and `height` are `number | string`, which is
  what `CSSProperties["width"]` let through, so that they get a
  control. Two defaults set in the Tree's function body
  (`colorScale`, `field`) are stated in their descriptions instead of
  moved, since `||` there also catches an empty string. No drawing
  changed.
- **The explorer** (`src/explorer`, app code): `Explorer.tsx`, a client
  island, holds the chosen example and the current props: a select of
  the examples, a control per prop from the manifest (decision 5's
  mapping; a button unsets a prop, a choice offers "not set"), the
  drawing in an error boundary, the JSX for the current props with a
  copy button (data too long to show is written `hall={hall}` and the
  example module linked), and the image route's SVG where it draws the
  same thing. `images.ts` maps the Tree's, the tablet's and the
  sigil's props to their contracts' queries and gives no image for a
  drawing the image cannot show (the tablet's second letters or
  highlights, the sigil's debug circles); the halls link their
  published SVG by example. `live.tsx` loads each component through
  its own `next/dynamic` import, which a test holds to the examples'
  entries, so the page's HTML has the first example drawn and only
  the chosen component's chunk loads.
- **The pages:** `/open-source/components`, a public page, has a tile
  per component and a text ("About the components"); the tiles use
  `/api/render` for the Tree, the tablet, the sigil, the candlestick
  and the shewbread, the Neophyte hall's small PNG for the halls,
  Mercury's picture without its dates, and draw the other seven on the
  server (the Grade Tree without its links, which would nest in the
  tile's). `/open-source/components/<slug>` (`tree-of-life`, …), an
  entity route, has the name as its heading, the JSDoc, the import
  line, a note that the package is not on npm yet with no install, the
  explorer and the props table, which is a list on a phone. Dark mode
  re-inks or plates each drawing as its own page on the site does.
- **Around them:** `pathnames.ts` makes Components a section under
  Open source, so the bar reads "Open source › Components" and a
  component's page names itself; the footer's column lists Components
  before Source code; the hub's components card links the index. The
  index and each component have a title and a description of 110–160
  characters (the rule `1ce38ab0` set, held by `pages.test.ts` and a
  new `components.test.ts`), and are in the sitemap, the social cards
  and site search (the JSDoc and the examples' titles). Web Analytics
  reports the new dynamic route in full, reviewed in its test. The
  search vectors were refreshed in the second commit:
  `search:compare` requested 321 passages of the Qwen comparison
  profile after the caches were copied, and `search:publish` nothing.
- **Tests:** the examples and the manifest above; the controls, the
  JSX writer, the image mapping, the component list; the explorer in
  jsdom, where a text field and a switch redraw the component and
  unsetting a prop restores it; the index (a tile each, its pictures,
  no nested link, no install) and the component pages; the page text,
  footer, bar, sitemap and route tests.
- **Checked in a browser:** `next dev` (Turbopack) on port 3119 from
  this worktree with `ci.yml`'s placeholder environment, headless
  Chromium over CDP, at 1280 and 390 px in light and dark: the index
  and the Tree's, the hall's, the sigil's and the tablet's pages, no
  sideways scroll at 390 px. Every component's page drew with no
  console error but the shewbread's hydration warning (below). On the
  Tree's page a switch, a text field and a second text field each
  changed the drawing, the JSX and the image link. `nlopt-js`'s chunks
  were requested on the sigil's page only, and `mercuryRetrograde` (with
  `astronomy-engine`) on Mercury's only; the index requested neither.
  The same held in production: `next start` of the gate's Turbopack
  build of `6b391ade` (before the rebase) on port 3120, with each page's scripts searched
  for the two libraries' own strings and constants, since production
  chunk names say nothing. The index prefetched all fourteen pages'
  payloads and loaded neither library; the sigil's page loaded
  `nlopt-js`, and only Mercury's (as `/astrology/planets` already did)
  `astronomy-engine`.

**Deferred:**

- **The data inputs** decision 5 lists for the page ("the component's
  data inputs where the registry declares them"): the specs live in the
  server-only `src/render/registry.tsx`, beside the renderers, and
  would need moving to a module of their own first. Not done here.
- **Components without examples:** `RoseSigilImage` (the sigil's
  server half, whose `points` the optimiser computes), `KameaFigure` and
  `GdHallSvg` (building blocks that the drawn components wrap), and the
  helpers, none of which has a page.
- **String ids get text fields:** `Tablet`'s `id`, `Lamen`'s `officer`,
  `Chakras`' `active` and `PlanetarySpirit`'s `id` are `string` in their
  types, so the explorer offers a text field, not a choice. Narrowing
  them to unions from magick-data would give choices, and would ask the
  app's callers, which pass route params, to narrow too.
- **The Moon** still sets its background to `/night-sky.jpg`, a path of
  the app's, as Mercury did before stage E; it should take a
  `background` prop as Mercury does.
- **A hydration warning** on the Table of Shewbread, in the explorer and
  on `/gd/symbols/shewbread` alike, from before this stage: React
  reports server attributes, coordinates among them, that the browser's
  render does not match.

### Stage F review (13 November 2026)

An independent review of `7d4ce30f`, `6b391ade` and `b281653a` (now
`e9bee9b7`, `aeebe7c1` and `0b1a2fbf`) found
nothing critical or high; the controls, the image links, the freshness
test and the tarball held up. The coordinator decided each finding;
applied in `8647932e` (`8270c9eb` before the rebase).

| # | Finding | Disposition |
| --- | --- | --- |
| 1 (medium) | The example picker could not reapply the chosen example, and kept its title after the props were edited | Fixed: each item applies its example on click, the chosen one included, and the picker reads "(edited)" while the props differ from the example's (compared whatever the keys' order). jsdom tests switch, edit and reapply |
| 2 (medium) | `SevenBranchedCandleStick` in a heading overflowed a 390 px screen | Fixed: `BreakableName` breaks a name between its words, in the heading and the tiles. All fourteen pages checked at 390 px in a browser (no sideways scroll, no heading wider than its box), and a test holds the break |
| 3 (medium) | JSDoc written for the app (plans, "this app", app files) was shown on the pages, in site search and in the published declarations | Fixed in doc comments only: `GdHall`, its `art`, `GdHallSvg`, `Lamen` and its `grade`, the Moon, Mercury, the tablet's `frame`, both `idPrefix`s, `RoseSigilImage`, the Grade Tree, and the Tree, whose default links are said to be root-relative and changeable. History moved to `//` comments; Kamea's file comment stops being JSDoc. The internal hall modules' comments, which no page shows, are left |
| 4 (low) | A description starting with a code span gave two parts the same React key | Fixed: empty parts are dropped; a test checks the keys |
| 5 (low) | `seven-branched-candle-stick` | Fixed: `seven-branched-candlestick`; the other thirteen slugs split where English does |
| 6 (low) | The Tree's first example drew numbers, not the Tree page's names | Fixed: Roman names, English below, size 10, as `/kabbalah/tree` draws by default; the comment says so |
| 7 (low) | A cleared text field set `""`; placeholders showed JSON quotes | Fixed: clearing unsets, as for numbers; placeholders show the text |
| 8 (low) | `aria-labelledby` on `<pre>`; "Copied" not announced; the phone's props list lost its table semantics | Fixed: removed; a status region; explicit table, row, header and cell roles |
| 9 (low) | The tiles prefetched all fourteen pages | Fixed: `prefetch={false}`, as the menus since `7ced7fa1` |
| 10 (low) | Tests missing for the choice, number and parsed controls, switching, the image link; no parity between the image and the live drawing; `live.tsx`'s export unchecked; the examples' import check too loose; examples not tied to their entry's component | Fixed: jsdom tests for each; `imageParity.test.tsx` renders every Tree, tablet, candlestick and shewbread example that links an image both through the route's registry from the parsed query and as the component, and compares the markup (the Tree's flip, which the route applies after outlining, and the tablet's border and accessible name, which no image carries, aside); the export is checked; the import pattern refuses `react-dom` and `..` past `src/`; each module types its examples by `ComponentProps` of the component imported from its entry's file, which a test holds |
| 11 (low) | Props sorted with `localeCompare` | Fixed: code-point order |

The prose changed, so the vectors were refreshed in `8647932e`: before
the rebase `search:compare` requested 6 Gemini and 6 Qwen passages, and
on the rebased tree 1 of each (the rest cached); `search:publish`
requested none either time. On the rebase the Moon's examples took the
hardening's new `background` prop (`/night-sky.jpg`, as the app's pages
pass it), and the parity test gives the Tree the fixed root id the
image route renders it with. Checked again with `next dev` on port 3119 in
headless Chromium: all fourteen component pages and the index at
390 px in light; the Tree's, the hall's, the sigil's and the tablet's
pages and the index at 1280 px in light and dark; the candlestick at
390 px in dark. No console error on any of them. On the Tree's page, a
switch redrew the drawing, updated the image link and marked the
picker "(edited)".

### After the rebase onto stage C (13 November 2026)

| Commit | What |
| --- | --- |
| `24e98b60` | `fix(open-source): Offer no control for a font URL` |
| (this commit) | `feat(open-source): Lead with the packages` |

- **Rebased gates.** Each rebased commit was gated again on its own
  tree. `e9bee9b7`, `aeebe7c1` and `8647932e` passed every step,
  coverage first time, and so did `24e98b60`. The two plans-only
  commits, `0b1a2fbf` and `fde5591d`, whose code is byte for byte that
  of `aeebe7c1` and `8647932e`, passed every other step twice, but
  coverage and its re-run failed in both of their gates at load
  averages of 35–58: 5-second timeouts in the legacy import, the hall
  and semantic editors, the dictionary and a few others, and once
  `TempleHallTabs.test.tsx`'s timing test. Every file that failed passed
  run alone (410 tests, then 194).
- **The hardening's new props.** The manifest was regenerated on each
  rebased commit; the Tree's `id` and `fontBaseUrl`, the Moon's
  `background` and the fylfot's `ink` came described. The Moon's
  examples pass the night sky as `background`, as the app's pages do.
  `24e98b60` gives `fontBaseUrl` (the Tree's and the hall's) no control:
  it points the drawing at fonts and declares their families for the
  whole page, which the page, serving the fonts itself, does not need.
  The Tree's `id` keeps a text field; an id it refuses shows in the
  drawing's error boundary.
- **The drawer.** With Data and Components, Open source has two pages,
  so the drawer lists it as a section like the others, and the hub
  itself is reached from the bar and the footer; the drawer test that
  took it for a one-page section now takes Books.
- **`/open-source` leads with the packages** (Gadi, 13 November: "on
  /open-source, let's move the packages above the license section"):
  "The packages" comes before "Licences", which keeps its `#licences`
  anchor for `/about` and the hall pages; a test holds the order.
- **The moon-phase credit** ([above](#before-publishing-13-november-2026),
  "Not done, for Gadi"), approved by Gadi with a vector refresh: a
  credit in `/about#credits` (moon-phase, its copyright line, the BSD
  3-Clause licence, linking the components' `LICENSE.txt`) and a
  sentence after `/open-source`'s MIT line, each held by a test. The
  vectors were refreshed: `search:compare` requested 5 Gemini and 5
  Qwen passages, `search:publish` none.
- **Checked in a browser** (`next dev` on port 3119, headless
  Chromium): `/open-source` at 390 and 1280 px in light and dark, the
  packages first and no sideways scroll; the credit on `/about`; the
  Tree's, the Moon's, the fylfot's and the hall's pages after the
  rebase, each drawn with no error and no `fontBaseUrl` control, and the
  Tree's and the Moon's at 390 px in dark.

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
