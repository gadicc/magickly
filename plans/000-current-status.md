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
  compute `/astrology/moon` dates only in the browser, prerender the
  `/study` set list, consider public SQL rituals for the sitemap, and give
  the short app bar titles fuller names. The raw JSON rows on the entity
  pages are done ([plan 036](036-entity-pages.md)). The archangel data fix
  (17 September) moved the Tree image identity to
  `magickli-tree-image-outlines-v2`; see
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
  rituals published across the deploy. Since 20 September that profile names
  the renderer alone: the data an image draws is hashed beside it, so a data
  fix no longer bumps it (step 3b of [plan 032](032-data-layer.md#step-3b-1)).
- The data layer is being rebuilt: `data/` keeps plain JSON tables, one
  declared graph describes every relation, and an eager `assemble()` replaces
  the barrel's in-place linking. See [plan 032](032-data-layer.md). Steps 0
  to 3 have landed. Step 0 pinned the pages the data changes touch, step 1
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
  Step 3b, render identity, has landed too. A rendered image's identity named
  its renderer alone, so a data fix had to be published by bumping a shared
  profile string by hand, which re-identified every image under it. Each
  registered component now declares the fields of the data its render reads,
  and the resolved values of exactly those fields are hashed into
  `identity.inputs.sha256`; the profiles from here on name the renderer and
  move only when it does, and the rule they stand under is that bytes must not
  change under (profile, inputs hash, query). Links are resolved before they
  are hashed, so an edit two hops away is covered without a spec naming the
  table it is in. With that in place, `tribesOfIsrael.manasseh.name.he` stopped
  being Benjamin's, byte for byte, and became מנשה: the Table of Shewbread's
  bytes and inputs hash moved, every other image's bytes *and* hash did not,
  and that is asserted rather than observed. A reader sees the Gemini position
  on `/gd/symbols/shewbread` read מנשה. Every data-dependent image's identity
  changed once, bytes unchanged, which is the accepted one-time cost; published
  rituals keep their stored bytes and re-render at their next publication, and
  a publication begun before the deploy and retried after it is replayed,
  matched on manifest and policy, with its stored plan keeping the identity it
  was validated under; only a manifest change is refused. The
  `RENDER_INPUT_SWEEP=1` test behind it changed all 3,721 fields of the data in
  turn and found no image that could be redrawn without its hash moving.
  Step 3c, the consumers, has landed, and with it step 3. A row is looked up
  by a string id through a helper that keeps its type, so the four `[id]`
  routes no longer cast an id into `keyof` and 404 on a typed `undefined`
  instead; a dotted field path can be checked against the graph without
  rendering anything, and every path the app treats as public — the Tree's
  thirty fields, the grade tree's, the ritual documents' and the study sets'
  forty-five — is checked by a test that reads each list from the file that
  owns it; the Table of Shewbread and the geomancy chart read their links
  rather than indexing another table by hand; and nothing imports a `.json5`
  any more, so the webpack rule, the Turbopack rule and its loader, vitest's
  transform and the `*.json5` declaration that started all this are gone. The
  Enochian dictionary is emitted as a module with a hand-written type beside
  it, 19 types where a JSON import cost 19,300, and `/enochian/keys` resolves
  the 180 entries its 181 words need on the server: that page loads 243,702
  fewer bytes of JavaScript, 31,896 of them gzipped, and is 212,678 bytes
  lighter over the whole first visit. What a reader sees is on that page:
  `URBS`, `GIUI` and `GRSAM` gain the meanings the dictionary files under
  other spellings, and the pronunciation cell of a word with none is empty
  where it printed a literal `0`. Nothing else moved — every pinned image
  keeps its bytes and its inputs hash. See
  [plan 032](032-data-layer.md#step-3c-1).
- After step 3, the two dictionary findings it left are done: the 128
  repeated meaning and pronunciation objects are gone, the twenty-two
  numerals filed as numbers are strings, and the dictionary is held to its
  type — a strict schema beside the tables', and a check for a repeat — under
  `pnpm data:check`, so `pnpm build` rejects either returning. What a reader
  sees: on `/enochian/dictionary` and `/enochian/keys`, each meaning once
  where seventy-seven entries printed one twice. See
  [plan 032](032-data-layer.md#the-dictionary-after-step-3-1).
- Both entries step 3c found run together are parted: `CASARM`'s second
  meaning carried the whole of `CASARMA`'s entry and `G-RSAM`'s carried
  `GRU`'s — the fault step 3a parted `BIA` and `BIAB` on — and both are
  parted, so `CASARMA` and `GRU` are words of their own, `CASARMA` with the
  second Key's "whome" beside the meaning the string held. What a reader
  sees: on `/enochian/dictionary`, `CASARM`'s second meaning reads "whom,
  unto whom" and `CASARMA` and `GRU` are rows of their own; on
  `/enochian/keys`, `CASARMA` shows its meanings where it showed none — the
  page resolves all 181 of the words its Keys use, where it resolved 180 —
  and the gematria cell no longer prints "Gematria " with nothing after it
  for the 130 of those words that have none. See
  [plan 032](032-data-layer.md#the-dictionarys-run-together-entries).
- The eleven more that a scan of the whole file found while those two were
  parted are parted in their turn: ten `WE` glosses carried the entry after
  them run into the end — `BAMS`, `ES`, `ICZHIHAL`, `IZAZAS`, `LONDOH`,
  `MOMAO`, `NOR`, `ORMN`, `PI` and `ZIRDO` — and `THAHEBIOBEE` was the
  opposite fault, a key cut short with its own tail at the head of its
  gloss. What a reader sees: on `/enochian/dictionary`, each of the eleven
  reads as its own word, `BANAA`, `ICZHIHL`, `IZED`, `MOMAR`, `PIAD` and
  `ZIRENAIAD` are rows of their own, `ESE`, `LONSA` and `ORO` gain the
  meaning the string carried, and the key `THAHEBIOBEE` is
  `THAHEBIOBEEATAN`; on `/enochian/keys`, where `LONDOH`, `LONSA` and
  `ZIRDO` are words the Keys say, `LONDOH` loses the run-on row, `LONSA`
  gains "POWER" and `ZIRDO` reads "I AM". See
  [plan 032](032-data-layer.md#the-eleven-partings).
- TODO: one small one left by step 3c
  ([plan 032](032-data-layer.md#follow-ups)): a study set whose question or
  answer is a function has no dotted path for the new field-path test to
  check.
- TODO: the Enochian dictionary's entry `I` gives two of its objects an
  empty source, "(name of an angel, sol)" and the pronunciation "Ee", so the
  page prints "()" after the meaning; what they should cite is not in the
  repository. See [plan 032](032-data-layer.md#follow-ups).
- Done on 25 September: the four entity pages that printed a row as JSON
  — planet, grade, sephirah and path — lay out their correspondences, as
  Server Components, with seven back-links and each path's two sephirot
  added to the graph for them and a test holding each page to its whole
  row; `decycle` and the `cycle` dependency are gone, the angel page shares
  the pieces, and the grade, sephirah and path routes stop shipping the
  data barrel to the browser. Da'at's description calls it the hidden
  Sephirah and Ketu's title reads Cauda Draconis. Netzach's and Hod's god
  names spell Tzva'ot צבאות, which moved the Tree's inputs hash and the
  Theoricus ritual's Tree bytes under the same profile. See
  [plan 036](036-entity-pages.md#results). TODO: the Tree's `flip`
  stylesheet fix, which waits on a render-identity decision; Hesed's
  "saphire" and the other data the new pages set side by side; the search
  descriptions' trump names; the source of `magickTypes`. See
  [plan 036](036-entity-pages.md#follow-ups).
- TODO: two small ones left by step 3b
  ([plan 032](032-data-layer.md#follow-ups)): two tribes' Hebrew names are
  hashed into the Table of Shewbread's identity although no sign points at
  them, because an inputs spec takes a whole table rather than the set the
  data selects; and the `RENDER_INPUT_SWEEP=1` sweep compares the JSX handed
  to the outliner rather than the outlined bytes, which is stricter but not
  the published artefact.
- TODO: two small ones left by step 3a
  ([plan 032](032-data-layer.md#follow-ups)): what `pnpm dev` does not pick up
  until it restarts — a source directory added while it runs, since the watch
  is one watcher per directory, and `dist/graph.json` after a `graph.ts` edit,
  since only the build writes it; and a build emitting `as const` TypeScript
  modules rather than JSON, which would make `kind` and the other closed
  fields literal types and let `PlanetId` be derived rather than written out —
  that one belongs with step 4's package.
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
