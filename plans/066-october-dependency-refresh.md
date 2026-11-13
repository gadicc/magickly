# October dependency refresh

Updated 31 October 2026. This clears the Dependabot alerts open on that date
and brings the rest of the tree up to the newest releases the seven-day
`minimumReleaseAge` allows, on branch `gate/deps-upgrade` from `8c536103`. It
is a reconciliation of the alert list and the outdated inventory, not a
complete security audit.

## Method

The baseline on `8c536103` passed the full gate: frozen offline install,
`biome check`, typecheck, `vitest run --coverage` (358 files, 6,900 tests),
`next build --webpack`, `loom check`, the `magick-data` smoke test and
`next build --turbopack`. Every commit below then passed the same gate on its
own exported tree, Node 24.18, and the tip passed the full form. Each unit was
applied with targeted `pnpm add`/`pnpm update` commands, and the lockfile diff
was read for unintended moves and duplicate copies. Release notes were read
for Next, React, MUI, better-auth, drizzle and Loom.

`src/doc/semantic.ts`, `semanticCompilerImpl.ts` and `ritualNodeIds.ts` are
byte-identical to `main`, and no package in `RITUAL_COMPILER_COMPONENTS` or
the ritual image validation identity moved, so compiled ritual output and both
identities are unchanged.

## Results

| Commit | Unit | Alerts or advisories |
| --- | --- | --- |
| `836f7dd2` | undici 7.30.1 and 8.12.3, fast-uri 3.1.9 (transitive) | GHSA-xjj6-f33q-929c, GHSA-f72v-6w45-q472, GHSA-4qv8-2p9j-2685, GHSA-wjr9-j795-jxcr |
| `794752ae` | vite 8.3.5, vitest and @vitest/coverage-v8 5.0.5 | the six vite advisories (root) and @vitest/mocker GHSA-qxg6-89mg-rqv8, GHSA-xp26-3454-mjgp |
| `d0ef965f` | `editor-trial` vite 8.3.5, with its own pnpm 10.18.0 | the six vite advisories (`editor-trial`) |
| `ada84f22` | next 16.4.3 | LTS backports on the 16.4.1 security release |
| `25eb50a0` | react, react-dom 19.3.1 | RSC transport protocol fix |
| `b85bbab2` | MUI 9.5.0, x-date-pickers 9.16.0 | — |
| `bf0112bc` | Tiptap 3.32.0 and one copy of each ProseMirror package | — |
| `69b560c1` | CodeMirror, Lezer and @uiw/react-codemirror | — |
| `dcf5b7dc` | better-auth 1.7.12 | upstream fixes listed in the commit |
| `10f7c997` | drizzle-orm 0.45.4, drizzle-kit 0.31.11 | — |
| `ac2bb428` | ai 7.0.152, @ai-sdk/react 4.0.156, LangChain, Pinecone | — |
| `c4e3fc61` | AWS S3 SDK 3.1156.0, one @smithy/core and @smithy/types | — |
| `9f1fdfde` | serwist 9.5.13 | — |
| `1be25659` | drop the `browserslist` override (plan 035's exit condition) | — |
| `71f065f1` | Biome 2.5.15 | — |
| `bb29d756` | runtime patch and minor releases | zod 4.6.7 for the app: GHSA-mrhx-c7xc-m3w5 |
| `ee1b643c` | build and test tooling, @types/node 24.19.2 | — |
| `55a3e84e` | @gadicc/loom 2.2.1 | — |

Notes beyond the commit messages:

- **vite and rolldown.** Dependabot's PR #31 failed because it resolved
  rolldown 1.2.16, published 29 October. vite 8.3.5 asks for rolldown
  `~1.2.14`, and pnpm picks 1.2.15 (21 October), so no exclusion was needed.
- **fast-uri.** A plain `pnpm update fast-uri` kept 3.1.8: the root's
  peer-resolved `ajv` held its locked child. It was moved with a temporary
  `fast-uri@^3` override, removed before the final `--lockfile-only` install,
  so the lockfile records none.
- **Geomancy page digests.** `src/app/geomancy/reading/reading.test.tsx` pins
  the rendered page's size and SHA-256. MUI 9.5 regenerates Button's Emotion
  styles; a tag-by-tag diff of house 1 showed only those style blocks and
  class names changed, so the three digests were updated in the MUI commit.
- **Browserslist.** With the override gone, browserslist is 4.29.4 and
  caniuse-lite 1.0.30001819 for every dependent, Next included. The app sets
  no browserslist query of its own. The gate builds' `public/sw.js`, with the
  precache manifest cut out, is identical between `9f1fdfde` and `1be25659`.
  Serwist 9.5.13 itself changes the worker: compared with `c4e3fc61`, only its
  minified parallel-map helper is rewritten.

## Stale alerts

On 31 October the open list still held alerts #318 (sharp below 0.35.5),
#317 and #310 (source-map-js below 1.2.2) and the next 16.4.0 alerts. Both
lockfiles on `main` already hold only sharp 0.35.5 and source-map-js 1.2.2
(commits `72a2f355` and `ff34c9dd`, 21 October), and GitHub's own dependency
graph for `main` lists sharp 0.35.5, source-map-js 1.2.2 and next 16.4.1. The
alerts were last updated on 14 October; they should close on Dependabot's next
evaluation, or can be dismissed as fixed.

## Remaining advisories

`pnpm audit` on the tip reports four findings, all in exact pins of upstream
packages and not reachable through the verified current paths:

- **zod GHSA-mrhx-c7xc-m3w5** (high, memory exhaustion validating oversized
  constrained collections, fixed in 4.6.6). `@serwist/build`,
  `@serwist/webpack-plugin` and `@serwist/next` 9.5.13 pin zod at exactly
  4.6.5, to validate the Serwist build options in `next.config`; every
  `@vercel/cli-config` release, reached through `@vercel/functions` and
  `@vercel/oidc`, pins exactly 4.1.11, as 0.2.7 on `main` already did, to read
  the local Vercel CLI configuration. Neither validates request data. Clearing
  them needs an override per pin, which is a separate decision.
- **glob GHSA-3g3m-2fjr-6pw4 and minimatch GHSA-g3hv-75wg-m249** (moderate,
  published 30 October). Serwist pins glob at exactly 13.0.6, which uses
  minimatch 10.2.6, to find the build's own precache files. The fixes are
  glob 14.0.2 and minimatch 11.0.1, new majors published 27 October and
  allowed by the release-age policy from 3 November.
- **deepmerge GHSA-gcqx-w48m-w2h4** (low, no patched release), through
  `@svgr/plugin-svgo` at build time.

Resolved on 13 November: zod, glob and minimatch are fixed and deepmerge is
shown unused; see [13 November 2026: Dependabot
alerts](#13-november-2026-dependabot-alerts). `@vercel/cli-config` 0.3.6 and
later ask for zod ^4.6.6, so "every release" above held only until then.

## Deferred

| Package | Available | Reason |
| --- | --- | --- |
| Biome 2.6 | 2.6.2 | Formats Markdown and YAML by default (about fifty plans and READMEs and `pnpm-lock.yaml`) and adds the error-level `noComponentHookFactories` (38 errors, mostly tests); needs a configuration decision |
| `file-type` | 22.2.0 | In `STATIC_RASTER_VALIDATION_COMPONENTS`; rotates the ritual image validation identity, so it wants its own parity check |
| `magic-string` | 0.30.21, 1.4.3 | In `RITUAL_COMPILER_COMPONENTS`; changes the compiler identity |
| `mongodb` / `bson` | 6.21.0, 7.7.0 / 7.3.3 | `gongo-server-db-mongo` pins 6.2.0; plan 035's reasoning holds |
| `@hookform/resolvers` | 6.0.0 | New major with no pressing need; review its migration notes first |
| `@types/node` | 26.6.5 | Follows the Node 24 runtime in `engines` |
| TypeScript | 7.0.2 | As plan 035: Next still needs the JavaScript compiler API |
| `suncalc` 2, `pdf-parse` 2 | 2.1.1, 2.4.5 | As plan 035 |
| Younger than seven days | — | ai and @ai-sdk/react patches, Tiptap 3.32.1–2, Biome 2.6.3–4, `@mui/x-date-pickers` 9.17, `file-type` 22.3, `@vercel/functions` 3.10.4–5 |

`editor-trial` keeps Tiptap 3.31.3 and its other pins; its Vite config aliases
the `@tiptap` packages to the root `node_modules`.

## Release-age policy

`pnpm-workspace.yaml` keeps `minimumReleaseAge: 10080` with only
`@gadicc/loom` excluded, and no install here relaxed it; `editor-trial`, which
the root workspace settings do not reach, was resolved with an explicit
`--config.minimumReleaseAge=10080`.

## Follow-ups

- Re-read the Dependabot list after the push and confirm the stale sharp,
  source-map-js and next alerts close.
- Resolved 13 November ([below](#13-november-2026-dependabot-alerts)):
  decide whether to override Serwist's and `@vercel/cli-config`'s exact zod
  pins, or wait for upstream releases.
- Resolved 13 November ([below](#13-november-2026-dependabot-alerts)):
  after 3 November, check whether Serwist moves to glob 14; otherwise decide
  on an override.
- Adopt Biome 2.6 with a decision on Markdown and YAML formatting and on
  `noComponentHookFactories`.
- `loom check` now advises replacing the local OIDC token acquisition in
  `scripts/release-checks.mjs` with Loom's `createGithubActionsOidcFetch`.

## 13 November 2026: Dependabot alerts

Four alerts were open on `main` at `ed66f81c`, all in `pnpm-lock.yaml`. Work
on branch `gate/dependabot`; each commit passed the full gate (install,
`loom check --production`, `pnpm check`, typecheck, smoke, coverage, webpack
and Turbopack builds) on its own tree. No install relaxed
`minimumReleaseAge`. `pnpm why -r` gave the paths below; none reaches
`magick-data`, which has no runtime dependencies.

| Alert | Path before | Fix | Commit |
| --- | --- | --- | --- |
| #362 zod GHSA-mrhx-c7xc-m3w5 (high), fixed in 4.6.6 | 4.1.11: `@vercel/functions` 3.10.3 → `@vercel/oidc` 4.0.3 → `@vercel/cli-config` 0.3.3 (exact pin), which reads the local Vercel CLI configuration for OIDC token refresh; in 3.10.3 neither the package root nor `/headers` loads `@vercel/oidc`, so the app's imports never loaded it | `@vercel/functions` ^3.11.0 (3.11.1 and 3.11.2 are under seven days old, so 3.11.0 resolved): `@vercel/oidc` 4.0.7 → `@vercel/cli-config` 0.3.7, which asks for zod ^4.6.6 and shares the app's 4.6.7. 3.11.0's root adds an eager `require("./affinity")`, so importing `@vercel/functions` now loads `@vercel/oidc` and `@vercel/cli-config` at module load (checked with `require.cache`; zod itself is not loaded until a token refresh). The app imports the root only from `src/api-lib/ipCheck.ts`, which nothing imports; `src/geo/vercelGeo.ts` imports `/headers`, which loads neither | `810f60b0` |
| #362, second copy | 4.6.5: `@serwist/build`, `@serwist/next`, `@serwist/webpack-plugin` 9.5.13 (exact pins, build time only); 9.5.13 is the newest 9.x | `"<serwist package>>zod": ^4.6.6` overrides in `pnpm-workspace.yaml`, a patch move; one zod (4.6.7) remains in the lockfile | `0cd92782` |
| #364 glob GHSA-3g3m-2fjr-6pw4 (moderate), fixed in 14.0.2; #366 minimatch GHSA-g3hv-75wg-m249 (moderate), fixed in 11.0.1 | glob 13.0.6 → minimatch 10.2.6, exact pin of `@serwist/build` and `@serwist/next` 9.5.13, build time only | `"@serwist/build>glob"` and `"@serwist/next>glob"`: ^14.0.2, resolving glob 14.0.4, minimatch 11.0.5, path-scurry 3.0.0 and a new transitive `@isaacs/nonrecursive-glob-match` 1.1.0 (BlueOak-1.0.0, no install scripts); `lru-cache` 11.5.2 dropped out, deduped to 11.5.3 | `eb06fe39` |
| #363 deepmerge GHSA-gcqx-w48m-w2h4 (low), no fix released | `@svgr/webpack` 8.1.0 (devDependency) → `@svgr/plugin-svgo` 8.1.0 → deepmerge 4.3.1 | none; see below | — |

**Glob 14 compatibility.** Serwist imports only `globSync` and passes `cwd`,
`follow`, `ignore`, `nodir` and `absolute`, with relative ignore patterns.
The breaking items in the glob 14 and minimatch 11 changelogs are ignore
patterns that start with `/`, `ignore` patterns following
`windowsPathsNoEscape`, an aborted async walk now stopping instead of
rejecting and carrying on, the removed `debug` option, walker and
`Minimatch` internals, empty trailing path portions and Windows UNC roots.
None touches those calls (`globSync` only, POSIX paths, no signal), and
`globSync` still returns `string[]`. In our
build only `@serwist/next`'s clean-up of old worker files globs, since
`next.config.ts` supplies `additionalPrecacheEntries`. Serwist's four call
shapes, run with glob 13.0.6 and 14.0.4 on a copy of `public/` with worker
files, `node_modules` folders and symlinks added, returned identical lists.
The advisories need an aborted async walk (Serwist never passes a signal) or
a hostile pattern (Serwist's are fixed in its code and our config).

**deepmerge.** `@svgr/plugin-svgo` 8.1.0 declares deepmerge but its
`dist/index.js`, its only code, never requires it, and no other package in
the tree imports it, so `mergeObject()` is never called. It runs only when
webpack or Turbopack load our own SVG files. The alert can be dismissed as
"vulnerable code not actually used"; the remaining risk is not reachable
through the verified current paths. Revisit if a release of
`@svgr/plugin-svgo` starts using deepmerge, or when deepmerge publishes a fix.

**Remaining risk.** None of the four advisories is reachable through the
verified current paths after these commits; that is not a claim of no risk.
The overrides run Serwist 9.5.13 against newer zod and glob releases than
it was published with; the gate's production build runs its worker build.
The gate builds' `public/sw.js` for `0cd92782` (glob 13) and `eb06fe39`
(glob 14) differ only in `/_next/` chunk names and the build ID in the
precache manifest; the worker code and every `public/` entry are
identical.

**Revisit.** Drop the five Serwist overrides when Serwist ships a release
whose dependencies ask for zod ^4.6.6 and glob ^14.0.2 (9.x after 9.5.13,
or 10.0 when it leaves preview); `pnpm why -r glob zod` shows when they have
become no-ops. If Serwist moves to glob 15, the ^14.0.2 override would force
it back down, so drop or widen the overrides whenever Serwist updates.
