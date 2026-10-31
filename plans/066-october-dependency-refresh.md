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
- Decide whether to override Serwist's and `@vercel/cli-config`'s exact zod
  pins, or wait for upstream releases.
- After 3 November, check whether Serwist moves to glob 14; otherwise decide
  on an override.
- Adopt Biome 2.6 with a decision on Markdown and YAML formatting and on
  `noComponentHookFactories`.
- `loom check` now advises replacing the local OIDC token acquisition in
  `scripts/release-checks.mjs` with Loom's `createGithubActionsOidcFetch`.
