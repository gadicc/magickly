# Modernization status

Updated 15 September 2026. This page supersedes older pending-acceptance notes;
the [closeout checkpoint](025-pause-checkpoint.md) records preservation and
continuation boundaries.

Production is live on `4d9d10d37b5a3877d0f9230c5e75ff5a969c7e37`, deployment
`dpl_HHLsAXCa7vopfkqwiyVuqETkaaL2`, in London (`lhr1`) on Node 24.
[CI/release run 34994058815](https://github.com/gadicc/magick.ly/actions/runs/34994058815)
succeeded, including migrations, artifact checks, staged acceptance and promotion.
The final read-only receipt verified the exact deployment, Production target,
stable `magick.ly` alias and ten legacy images on both the public alias and fresh
deployment requests, preserving bytes, MIME and size. All twenty responses were
cache misses. The eight reviewed legacy environment changes were verified.

| Area | Completed evidence |
| --- | --- |
| Data and files | Fenced SQL import, unchanged completed replay, ten file relocations and exact retained-public-link checks |
| Product acceptance | Existing-account Google sign-in/navigation; publication of all five imported rituals with zero stops; private online reading and offline reload with text/images; new private upload confirmed |
| Runtime cleanup | Final Production deployment works without its retired settings; two shared credential records retain Development only and six obsolete records were deleted |
| Old credentials | Vercel release-token removal independently verified, preserving its replacement and unrelated identities; operator confirmed deletion of R2 token `magickly` and Atlas database user `magickli@admin` |

The product journeys above passed on the accepted `8ad3a978` deployment; the
final `4d9d10d` release adds the verified cleanup and retains that evidence within
its recorded scope. Mongo/R2 deletions are operator confirmations, not independent
provider inventories.

Final release receipt SHA-256:
`bfce8ec354712b9beac6d7a168b039f69b60540349af2a9bc470b61b32cf8aab`.
Vercel retirement receipt SHA-256:
`07d23afc8fb2bbcbd2469786ad7873d9ebb610bdc0e31d5171496be8f11c435d`.

Post-retirement verification passed on 15 September at 16:39–16:41 UTC:
20 live public/deployment responses preserved byte/hash/MIME parity, the exact
Production identity remained unchanged, and the uncached canonical Files API
returned the expected 400/404 responses. Cached image responses were explicitly
not treated as fresh storage proof. Ten direct GETs using the replacement R2
credential then verified all 7,790,234 migrated bytes and MIME types.

- Live parity receipt: `76ea55ef3be8ea2a2cc612036a6c55085b6f6fe692da15aff9eae3ae35cb4a46`.
- Direct R2 receipt: `9bf747d58d80284cecda401e66c47bca82a71133135aaa98427fa5ade6bf175a`.
- The three temporary credential handoff files were removed after verification;
  provider settings and backups were preserved. Cleanup receipt:
  `cc54da299fab7458b1b54b10d23ea117f2a2e6586d917db5e911e2c378936c8c`.

The reusable Loom `modernize-app` skill is committed locally as
`b3460006a8482270c4cb9427b6a6bd4af7c2d51e`. The full Deno suite passed
(64 tests, 634 steps), as did formatting/lint, skill validation and the npm build.
All six emitted skill resources match source and their references resolve.
The source commit is not yet pushed or published; Magickly remains pinned to
Loom 1.27.0. This documentation closeout is separate from the deployed code.

Normal SQL writes are open. The persistent legacy-upload write denial remains;
public reads remain available. The old database, old bucket/object bodies and
backups are retained. Do not rerun imports or make an old store authoritative
over acknowledged SQL writes.

Earlier release history remains distinct: run `34973396659`, attempt 2, promoted
successfully but failed its final checker; separate recovery evidence verified
the promotion (receipt prefix `d675bc3501d3`). Run `34992906681` failed a large SVG
test and never deployed. The final fix uses exact native byte comparisons and
excludes saved deployment test copies; validator behavior and deadlines remain
unchanged. Neither earlier failed run is relabeled successful.

Follow-ups are separate from the completed migration work:

- The current release token expires **2026-12-14T14:17:03.165Z**. Plan deliberate
  replacement before expiry; no automatic rotation is configured.
- Keep the separate `vector-dev` experiment paused until its unconfirmed
  credential is reviewed before any future unpause.
- Retain JRT source editing and format compatibility. WYSIWYG/editor evaluation,
  further JRT development and realtime collaboration are deferred product work.
  Pinecone remains the chat vector authority; pgvector is a future option.
- The 15 September push banner reported 60 dependency alerts (2 critical, 27 high,
  26 moderate, 5 low). The [dependency upgrade ledger](026-dependency-upgrades.md)
  records the 16 September reconciliation: the reachable alerts were resolved by
  upgrades and removals, four audit findings remain unreachable through the
  verified current paths, and the deferred majors list their revisit conditions.
  Dependabot re-evaluates its list after the push; this is not a complete audit.

- TODO: rate limiting for the public component image routes
  (`/api/render/*`, `/api/treeOfLife`). Each distinct query renders through
  WASM on request, and `/api/render/rose-sigil` adds up to about 330 ms of CPU
  for a 32-letter text, so the edge cache offers no protection against varied
  requests. Nothing in the app rate-limits today; see
  [plan 027](027-component-exports.md#adversarial-review).
- TODO: after the SEO release, resubmit `/sitemap.xml` in Search Console and
  remove `/sitemap-0.xml` if it was submitted directly (it is now a 404); see
  [plan 028](028-seo.md#follow-ups).
- TODO: SEO content follow-ups from [plan 028](028-seo.md#follow-ups):
  compute `/astrology/moon` dates only in the browser, replace the raw JSON
  rows on planet and grade pages, prerender the `/study` set list, consider
  public SQL rituals for the sitemap, and give the short app bar titles fuller
  names. The archangel data fix (17 September) moved the Tree image identity
  to `magickli-tree-image-outlines-v2`; see
  [plan 028](028-seo.md#archangel-data).
- Development runs on Turbopack since 17 September (`pnpm dev`;
  `pnpm dev:webpack` for parity), and production still builds with webpack;
  see [plan 029](029-turbopack-development.md). TODO: move production builds
  to Turbopack when relevant. The service worker must first leave
  `@serwist/next`'s webpack plugin; the steps and revisit conditions are in
  [plan 029](029-turbopack-development.md#production-builds-on-turbopack-deferred).
- TODO: drop the `webpack` devDependency once Serwist's webpack plugin is gone;
  it settles that plugin's optional peer
  ([plan 029](029-turbopack-development.md#choices)).
- The Tree image identity moved to `magickli-tree-image-outlines-v3` on
  19 September, when the Tree's path data began rounding to three decimals to
  stop a hydration mismatch; the drawing is unchanged, within 0.000633 px. See
  [plan 030](030-tree-coordinate-rounding.md), including what it means for
  rituals published across the deploy.
- The data layer is being rebuilt: `data/` keeps plain JSON tables, one
  declared graph describes every relation, and an eager `assemble()` replaces
  the barrel's in-place linking. See [plan 032](032-data-layer.md). Steps 0
  to 2 have landed. Step 0 pinned the pages the data changes touch, step 1
  repaired the links, sentinels and field names the audit found (Luna's god
  name and the rulers of Cancer and Scorpio changed with it), and step 2
  built the layer itself: JSON emitted from the JSON5 sources into gitignored
  `data/dist`, a declared graph over all 26 tables, row types derived from
  the JSON rather than copied by hand, `assemble()` over the 23 tables the
  graph links in place of the mutation, and a check that the data says what
  the graph says. Nothing a reader sees changed with step 2, no rendered
  image moved, and what a barrel route loads is within 5 KB of what it was.
  Step 3 is three gated branches, decided on 20 September; see
  [plan 032](032-data-layer.md#decided-on-20-september). Step 3a, types and
  checks, has landed with it: the three spheres of the Tree in the planet
  table say so in their own `kind`, so `PlanetId` is a declared fact rather
  than "the row has a symbol"; the row types are `readonly`, as the rows
  themselves have been frozen all along; every row the barrel hands out is a
  named interface rather than a mapped type, without which a package cannot
  emit a `.d.ts` for one at all; the reciprocal-`mirrors` check and a
  duplicate-key lint over the JSON5 sources run under `pnpm data:check`, so
  `pnpm build` rejects both; `dictionary.BIA` no longer carries `BIAB`'s
  meaning, which `BIAB` now holds from its own source; and `pnpm dev` builds
  the tables before the server starts and watches the sources after, so an
  edit reaches the running server. The whole branch type-checks 55,608
  instantiations *below* `main`. Two things a reader sees: a `kind` row in the
  field dump on `/astrology/planet/<id>`, and BIA's meaning on
  `/enochian/dictionary` and `/enochian/keys`.
- TODO: step 3b, render identity. `resolvedInputsHash`, which hashes the
  fields an image actually reads rather than whole tables, and with it the
  accepted one-time re-identification of every data-dependent component
  image; then Manasseh's Hebrew, whose fix moves the Table of Shewbread.
- TODO: step 3c, consumers. Typed `get(id)` lookups on the `[id]` routes,
  Server Components passing ids, `/enochian/keys` resolving its dictionary
  subset on the server with the dictionary out of the JSON imports, that
  page's lookup normalisation and its literal `0`, the `TableOfShewbread`
  hand-join, `pathTarget()` with its field-path test, and the JSON5 loaders
  once nothing imports JSON5. The dump-page redesign, and `decycle` with it,
  comes after. The two `gdGrade` accessor collisions and the drifted id
  unions were settled in step 2.
- TODO: two small ones left by step 3a
  ([plan 032](032-data-layer.md#follow-ups)): what `pnpm dev` does not pick up
  until it restarts — a source directory added while it runs, since the watch
  is one watcher per directory, and `dist/graph.json` after a `graph.ts` edit,
  since only the build writes it; and a build emitting `as const` TypeScript
  modules rather than JSON, which would make `kind` and the other closed
  fields literal types and let `PlanetId` be derived rather than written out —
  that one belongs with step 4's package.
- TODO: seventy-six Enochian dictionary entries repeat a meaning object
  verbatim (same text, source and citation); dedupe them and add a check, per
  [plan 032](032-data-layer.md#follow-ups).
- Not yet released: from the next release, anonymous `/api/session` checks
  return 200 with a null user instead of 401 (changed 17 September). An
  anonymous tab left open across that release shows a study load error until
  it reloads; see
  [plan 013](013-sql-auth-runtime.md#runtime-entrypoints-prepared).

- The 72 angels of the Shem HaMephorash are complete as of 19 September:
  all seventy-two entries restored from the 1823 scan and translated, with the
  prose split by language and loaded only when a reader opens one. See
  [plan 031](031-seventy-two-angels.md). TODO: the Hebrew names are absent,
  because the scan cannot supply them and a wrong one passes every check we
  have; they want deriving from Exodus 14:19-21, or a named source. TODO: the
  twenty-second entry's name comes from the model rather than the scan, whose
  heading is gone. TODO: thirty-five disagreements between the entries and
  Lenain's own tables are recorded but not resolved, and telling the scan's
  errors from the book's is per-entry work against the plates.
- TODO: the sigils the 72 angels page has promised since 2023. The plates in
  the public-domain scan would serve, but only the OCR sidecar is in the repo,
  not the PDF. Vaughan's blog images are his own work.
- TODO: `public/docs/Lenain - La Science Cabalistique (1823) - Google.txt`
  ships the book twice, byte for byte, at a cost of about 264 kB. Trimming it
  changes the contents of a URL the page links, so it wants its own decision.
- TODO: several GitHub links in the about page and `OpenSource.tsx` name a
  `master` branch this repository does not have. The 72 angels page's own two
  were fixed on 19 September.

Majou2 and MyReiki were read-only skill-evaluation fixtures. Neither was migrated.
