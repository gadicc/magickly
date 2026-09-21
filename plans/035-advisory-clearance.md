# Advisory clearance and dependency refresh

Updated 21 September 2026. This closes the three advisories left open by the
[dependency upgrade ledger](026-dependency-upgrades.md), whose "Remaining
advisories" section predicted they would wait for upstream range changes. They
did not need to: two overrides and one upstream-vestigial dependency cleared
all three. It is a reconciliation of reachable dependency paths, not a complete
security audit.

## Method

Every unit passed the CI-equivalent gate on Node 24 before the next one
started: `pnpm install --frozen-lockfile`, `loom check`, `loom check
--production`, `biome check`, `next typegen && tsc --noEmit`, `vitest run
--coverage` and `next build --webpack`, then `next build --turbopack`, all with
the CI placeholder environment from `.github/workflows/ci.yml`. Registry data
and the packages' own source were read for every change.

The baseline on `81d89b1` **failed** its own gate, on the coverage threshold
rather than on anything this work touched; the first unit below fixes that.

## Results

| Unit | Change | Result | Verification beyond the gate |
| --- | --- | --- | --- |
| `src/seo/entities.ts` | removed the unused `angelPages()` | removed | Repo-wide search found no caller in `src`, `data`, `scripts`, `tests`, configs or workflows. `entityPages()` already maps the same `angelSlugs()`, and `src/app/sitemap.ts` reads only that. The one other `angelPages` mention, in `scripts/seventyTwoAngels/pages.ts`, is a comment about a different reader removed with plan 033 |
| `browserslist` override | `^4.29.0`, replacing the 4.28.6 that `@serwist/next` 9.5.12 pins exactly | migration-free | The compiled service worker is byte-identical: 40,834 characters before the precache manifest and 4,926 after, across an A/B pair of `next build --webpack` runs. 304 precache entries both ways, with all 85 `public/` revisions equal. `browserslistToEsbuild` returns the same `["chrome111","edge111","firefox111","safari16.4"]` under both versions on the same `caniuse-lite` 1.0.30001810 |
| `@esbuild-kit/core-utils>esbuild` override | `^0.25.12`, replacing 0.18.20 under `drizzle-kit` | clean | `@esbuild-kit/esm-loader` appears **only** in `drizzle-kit`'s `package.json`, in both text and binary searches of the installed package; its code loads `tsx`, which it also depends on. Both `@esbuild-kit` packages are deprecated upstream as "Merged into tsx". The override reuses the 0.25.12 already in the tree rather than adding a version |
| `@gadicc/loom` 1.29.0 → 1.30.0 | additive client-data identity fence | clean | The release's only change to a module this app consumes, `src/next/auth/client.ts`, is a JSDoc comment; `createSettledSessionHook`, which `src/auth/client.ts` wraps, is untouched. No new transitive dependency |
| `file-type` 21.3.2 → 22.1.1 | 21.3.3/21.3.4 parser hardening, plus the current major | migration | See the parser hardening and validation identity sections |

`pnpm audit` reports **no known vulnerabilities** on the final tree, against
three findings (two high, one moderate) on the baseline. The lockfile lost 268
lines: overriding the two duplicated versions collapsed whole peer-variant
subtrees, including esbuild 0.18.20's platform packages.

## Parser hardening

`file-type` parses bytes the public cannot be trusted to have produced, through
`fileTypeFromBuffer` in `src/files/validateRitualImage.ts`. The 21.3.3 and
21.3.4 releases, both titled "Harden parser more", tighten the bounds that work
runs under: `maximumPngChunkSizeInBytes` and `maximumEbmlElementPayloadSizeInBytes`
drop from the 16 MB untrusted-skip bound to the ZIP entry bound, a new
`maximumPngStreamScanBudgetInBytes` caps PNG scanning, and new
`maximumAsfHeaderPayloadSizeInBytes` and `maximumTiffStreamIfdOffsetInBytes`
bound two more formats. 22.x carries all of it.

22.0's breaking changes do not reach this app: it calls only
`fileTypeFromBuffer`, never the stream functions that dropped Node
`stream.Readable`, never a removed sub-export such as `file-type/core`, and
never the removed `ReadableStreamWithFileType` type. The corrected MIME types
(`lz`, `lnk`, Apple Alias, `fbx`, Draco) and the added detections (Apple iWork,
ISO 9660) are not image types, so `isRitualImageType` rejects them exactly as
before. `engines` moved to Node 22 and the project is on Node 24.

Detection was compared between 21.3.2 and 22.1.1 on the same inputs:

- All 87 raster and vector files under `public/`, `src/` and `tests/`:
  identical results, including the `null` and `image/x-icon` cases.
- Synthetic magic bytes for each accepted type — PNG, JPEG, GIF and WebP:
  identical.
- The APNG case that `validateRitualImage.test.ts` asserts, a still PNG with an
  `acTL` chunk inserted after `IHDR`: `{ext: "apng", mime: "image/apng"}` under
  both, at 0, 8,192 and 65,536 bytes of preceding `tEXt` padding. The test
  itself covers 0 and 8,192; the third is beyond it.

## Validation identity

`file-type` is part of `STATIC_RASTER_VALIDATION_COMPONENTS`, so its version is
a ritual-image validation identity and this upgrade rotates that identity, as
the 19 → 21.3.2 move did in plan 026. The transition path that plan built is
unchanged and still covered by `src/offline/ritualPublicationTransition.test.ts`:
`initiate` treats a rebuilt request as the same operation when its manifest and
policy are unchanged and only the server-side plan provenance differs.

Only the pinned string in `src/files/ritualImageValidationIdentity.ts` changed.
No committed catalog or fixture embeds the digest — every catalog computes it
through `getRitualImageValidationSha256()` at runtime — so nothing needed
regenerating, and the assertion in `staticRitualImageCatalog.test.ts` that binds
the pin to the installed package's `package.json` keeps the two honest.
Historical receipts, imports and the backfill were not rerun.

## Pre-existing conditions, not caused by this work

- **The baseline gate failed.** `src/seo/entities.ts` covered 87.5 % of its
  functions against a 95 % per-file threshold, on lines 191–193, `angelPages()`.
  Commit `22ca738` added that function on 21 September without a test or a
  caller. CI run 35603332807 failed on `main` for exactly this, and plan 032
  recorded the same reading independently. The first unit above removes the
  function, which takes the file to 100 % of functions and lines.
- **A load-sensitive test flake**, unrelated to any dependency here.
  `src/offline/readRitualBundleAsset.test.ts`'s "delivers published PNG/SVG
  through actual SQL and R2 adapters, then wipes after revocation during GET"
  has no explicit timeout, so it races Vitest's 5,000 ms default while doing
  real PGlite and R2 adapter work; observed durations when it fails are 5,018 ms
  and 5,163 ms. At `81d89b1` with a clean tree it failed one of two full-suite
  runs; in isolation it passed three of three. The failures track a machine load
  average of 15–25. It has not broken CI. Left alone here because it is neither
  a dependency question nor the CI failure above; it wants an explicit timeout.
- `biome check` reports the same 35 warnings as the baseline.
- The peer warnings are unchanged: `gongo-server-db-mongo` and
  `mongodb-rest-relay` declaring `bson` 6.2.0, and `json-rich-text` and
  `react-select` declaring React 18.
- `loom check` still advises on pnpm 11 preparation (`onlyBuiltDependencies` to
  `allowBuilds`, `pnpm/setup` in the workflows). Out of scope here.

## Release-age policy

`pnpm-workspace.yaml` keeps `minimumReleaseAge: 10080` (seven days) with only
`@gadicc/loom` excluded. Editing `resolutions` re-resolves every range, so each
install here ran with `--config.minimumReleaseAge=0`: without it resolution
fails on `@codemirror/state` 6.7.5, which the project already pins exactly and
which was published six days earlier. The lockfile diffs were read after every
install; no resolution moved except the ones named above. Frozen installs of the
committed lockfile are unaffected either way.

## Deferred

Plan 026's deferrals were re-checked against current registry data. All five
still hold, for the reasons recorded there.

- `mongodb` 7 / `bson` 7: `gongo-server-db-mongo` is still 3.3.1 and still
  pins `bson` and `mongodb` at exactly 6.2.0 in its peers. Remove these
  packages with the legacy path instead of upgrading them.
- `suncalc` 2.0.2: still no default export — its ESM entry exposes only the
  seven named functions — and the rewritten solar model still moves
  sunrise/sunset by about 75 s. Upgrade when that change in planetary-hour
  times is accepted.
- `pdf-parse` 2.4.5: still a pdf.js migration rather than a version bump.
- `magic-string` 1.x: part of the reviewed ritual compiler identity; needs its
  own parity review.
- TypeScript 7.0.2: still reachable only through Next's
  `experimental.useTypeScriptCli`, because TypeScript 7 ships the Go compiler
  without the JavaScript compiler API, and the editor plugin is still
  unsupported. Revisit when Next supports it outside an experimental flag.

## Follow-ups

- Give `readRitualBundleAsset.test.ts`'s SQL/R2 delivery test an explicit
  timeout, and check the other `createMemoryPgliteHarness` users for the same
  thin margin.
- Re-read the Dependabot alert list once this reaches the default branch and
  confirm it reconciles to zero against the new lockfile.
- Both overrides are maintenance debt with an exit condition: drop the
  `browserslist` entry when `@serwist/next` moves its exact pin past 4.28.6, and
  the `@esbuild-kit/core-utils>esbuild` entry when `drizzle-kit` drops the
  `@esbuild-kit/esm-loader` declaration its own code no longer uses.
