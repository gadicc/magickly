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
- 22 October 2026: sharp 0.35.5 (GHSA-wq5f-xc86-pv6w, librsvg) and
  source-map-js 1.2.2 in both lockfiles (GHSA-68fv-2mgg-jv7q); the image
  validation identity rotated with nothing to regenerate. Recorded in the
  [advisory clearance](035-advisory-clearance.md), with the open vite
  advisories and an upload-hardening idea as follow-ups.

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
  [plan 036](036-entity-pages.md#results). The Tree's stylesheet and the
  descriptions' trump names followed on 1 October, and so did
  [plan 039](039-correspondence-tables.md#results): body parts, stones and
  scents are tables linked by id, read through a `*` wildcard in field
  paths; the heavens are the planet rows; romanised Hebrew writes its
  prefixes as Israel's official romanisation does; and the planets quote
  the Key of Solomon verbatim from Mathers. On 2 October the Tree's labels
  were set closer, moving its profile to v4
  ([plan 039](039-correspondence-tables.md#after-the-owners-review)). The
  source of `magickTypes` is deferred indefinitely.
- TODO: one small one left by step 3b
  ([plan 032](032-data-layer.md#follow-ups)): the `RENDER_INPUT_SWEEP=1`
  sweep compares the JSX handed to the outliner rather than the outlined
  bytes, which is stricter but not the published artefact.
- Step 4 of the data layer is done, on 3 October
  ([plan 052](052-data-package.md#results)): `data/` is
  `packages/magick-data`, the `magick-data` workspace package, which the
  app depends on as `workspace:*` and imports as `magick-data/…`, exactly
  as anyone else would. Each table is emitted as a module with a generated
  declaration that states its type, so a consumer needs no
  `resolveJsonModule` and loses no type without it, `kind` is a literal and
  `PlanetId` is derived; three tables are renamed before anything is
  published (`geomanticHouse`, `astrologicalHouse`, `treeOfLifePath`); the
  code is MIT and the data CC BY 4.0, by path; and a smoke test in CI packs
  the tarball, installs it and type-checks and loads it. Nothing a reader
  sees changed. Two images' inputs hashes moved and no byte did: the Tree
  of Life's, by the rename, and the Table of Shewbread's, which no longer
  hashes the two tribes no sign names. With it, `pnpm dev` rebuilds when
  `graph.ts` or `schemas.ts` changes, and the field-path test names the
  study sets asked through a function. The app's `package.json` is named
  `magickly`; every other `magickli` is a stored, hashed, sent or
  provisioned identifier and stays
  ([plan 052](052-data-package.md#magickli-stays)).
- TODO: publishing `magick-data` is deferred until the owner settles it: the
  package is `private` at 0.0.0, the names `magick-data` and
  `magick-components` are not yet reserved, and the CI workflow is designed
  but not built ([plan 052](052-data-package.md#deferred)). The Enochian
  dictionary stays out of the tarball whatever is decided: its entries come
  from Schueler's *Enochian Magic: A Practical Manual* and *The Whole
  Enochian Dictionary*, whose rights are not ours to give.
- TODO: a component explorer under an open-source section of the app,
  generated from `src/render/registry.tsx` rather than Storybook — every
  entry already declares its contract, props and inputs — and built after
  `magick-components`, whose demonstration site it would be
  ([plan 052](052-data-package.md#follow-ups)).
- TODO: ritual editor follow-ups from
  [plan 055](055-ritual-editor-followups.md#follow-ups) (grade and variable
  shortcuts and empty-text normalization are done, see
  [plan 056](056-pug-grade-and-variable-shortcuts.md)): count footnotes
  inside source-only blocks when numbering, and
  harden the caret-follow scan for hand-typed multi-line attributes. Review
  later, deferred for now: real phones (the fixed-height editor with an
  on-screen keyboard, short landscape screens), Safari, IME and assistive
  technology.
- TODO: one small one left by step 3a
  ([plan 032](032-data-layer.md#follow-ups)): a source directory added while
  `pnpm dev` runs is not watched until it restarts, since the watch is one
  watcher per directory.
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

- Temple administration: a guide at `/help/temples`, member removal and
  leaving, editable ritual access and per-temple forums are done; see
  [plan 057](057-temple-administration.md). TODO from it: an audit log of
  access changes, the creator-rights gap when a ritual moves to a group, an
  opt-in for forum sharing of member emails, and a list of feature ideas
  ([plan 057](057-temple-administration.md#follow-ups)). Temple documents are a
  proposal with questions for the operator in
  [plan 058](058-temple-documents.md).

- Golden Dawn hall diagrams (`gdHall`): composable temple floor plans for the
  rituals, in progress on `gate/gd-hall`; see [plan 061](061-gd-hall.md).
  Stages A, B and C are done: rituals hold halls (at the top level or
  in a note, summary, list item or todo), drawn in the reader and as
  one atom in the visual editor, after the planned compiler change
  (stage B; fix forward once a hall is saved); the `/hall` command and
  the Insert… dialog insert presets, `/gd/hall` copies a preset's Pug,
  and the Pug source editor shows hall warnings (stage C, with its
  review fixes: text typed without a keypress over a selected block
  now replaces it, as a key press does, instead of landing in the
  title). Stage D is done: "Edit hall" opens a visual hall editor in
  place (select, drag, scale, keys, a properties panel, a palette and
  the hall's warnings; one undo step per gesture), with its review
  fixes: a drag no longer reverts a field written or an undo made
  during it, Ctrl+X there no longer cuts ritual text, undo waits while
  the ritual is locked, and Ctrl+S saves a field still being typed.
  Stage E is done on `gate/gd-hall-e` (19 October 2026): `/gd/hall` is a
  hall editor (source, visual and split views, presets, undo, a draft in
  the browser, share links in the URL fragment, export), and the visual
  editor reorders dais and banner rows, stands objects on altars,
  platforms and thrones, and badges a hall's warnings outside edit mode,
  as Gadi decided that day, with its review fixes: an idle tab no longer
  writes an old draft over another tab's newer one (a newer draft is
  offered, and both tabs' changes are kept until the author chooses),
  links and drafts are capped (1,000 nodes, 64 KB) and typed source is
  read at a rest, so a small link can no longer freeze the page, and
  the editor says when its code cannot load. Stage F is done on
  `gate/gd-hall-f` (19 October 2026): kameas computed and drawn from
  their numbers, placeholder seals, the Tree on the Flaming Sword and
  Minutum Mundum boards, the veil, the white altar, gong, brazier and
  candle, the Portal's adepts in the ritual roles, and nine presets for
  Practicus, Philosophus and the Portal from the 1938 layouts; the
  editors' layout switch reads Source, Split, Visual, and `/gd/hall` no
  longer compares presets with the old drawings. Two follow-ups Gadi
  decided on 20 October 2026 are done on `gate/gd-hall-f2`: the hall
  editor's properties panel beside the drawing whenever it fits (split
  `/gd/hall` at the full width, its columns 2:3), otherwise docked at the
  foot of the screen as a strip the author can hide; and the kameas in
  magick-data (`astrology/kameas`) with a shared `Kamea` component the
  hall wraps. Stage G is done on `gate/gd-hall-g` (21 October 2026),
  after Gadi's split ratios of that day (`/gd/hall` split 3:5; the
  ritual editor's split 2:3 while a hall is open for editing):
  magick-data has the Golden Dawn's Water and Fire Watchtowers and the
  Tablet of Union, from Regardie's 1940 vol. 4 checked against The
  Equinox (1912) and Greer, squares with second letters and reversed
  letters marked; `Tablet`, `/enochian/tablets` and the image route draw
  Water and Fire, `Tablet` and the hall the Tablet of Union, and the
  Philosophus and Portal presets draw the tablets they had as markers;
  after its reviews `Tablet` is named as an image, and a hall editor
  that cannot load ends the editing instead of taking down the ritual
  editor. At Gadi's request the research on the tablets' versions is
  kept in magick-data (`enochian/tabletNotes`) and shown on
  `/enochian/tablets`, square by square where the sources differ.
  The core of stage H is done on `gate/gd-hall-h` (23 October 2026), in
  the flat-emblem style Gadi chose that day: the cup, chalice, censer,
  lamp and lantern, rose, salt (a shaker), bread (a round loaf) and fan
  are original drawings in the MIT package, in the old boxes so no hall
  moves; lamps and lanterns take a `light` colour (red, yellow or white;
  a lamp red and a lantern yellow by default), checked, offered in the
  properties panel and carried in the Pug; the Keryx's caduceus and the
  Sentinel's Eye of Horus are redrawn, `Lamen` is in
  `src/components/gd` and the third-party art list is empty. Its
  second part (24 October 2026), after Gadi's decisions that day: Pan,
  the Devil, Death and Typhon are emblem cards (`card(kind)`) in Portal
  2; the adepts wear the Portal rubric's lamens and the Portal's Hiereus
  and Hegemon their own (`grade="portal"`); the Keryx's wings dip round
  the ball and its coils narrow downward; and the Moon's and Venus'
  seals are drawn after Agrippa's 1533 woodcuts (public domain, cited by
  archive.org item and leaf). Its follow-ups (26 October 2026, Gadi's
  decisions): the Keryx's caduceus is design V1 with two turns, the hall
  editor adds from one button per palette group ("+ Officer" …
  "+ Text"), each menu drawing its entries, and the code notes that a
  5=6 hall's Chief Adept wears the Rose-Cross (the other two probably)
  and why the Portal
  Hiereus' ring is red; `/gd/hall`'s source panel reaches the screen's
  foot in Source view and stays in view, sticky, in split view.
  The tablet versions Gadi decided on 24 October 2026 are done on
  `gate/enochian-versions`: magick-data holds each source's reading of
  every square (Regardie 1940, the Equinox 1912, Greer, Dee's table of
  1584 as he corrected it and Raphael's of 1587, from Casaubon's 1659
  printing of Dee's records), and a version is a rule over them: the
  Golden Dawn's (the default, Earth and Air now included), Regardie's,
  the Equinox's, Dee's and Raphael's. `Tablet` draws any of them, with
  reversed letters optional and second letters in the corners;
  `/enochian/tablets` chooses one and says how it differs from each
  other; the image route takes `version`; the hall's `tablet` takes
  `version`, the Golden Dawn's when absent. In Gadi's words: "we want to
  accommodate Enochian practitioners from both traditions; for gdHall we
  use the Regardie/GD version, but we also accommodate Dee purists"
  ([plan 061](061-gd-hall.md#tablet-versions)). On this merge every
  tablet image's identity (`inputs.sha256`) moves, though only Earth's
  and Air's bytes do, so a catalog comparing the images' metadata
  re-identifies and republishes all four tablet images once.
  Waiting for Gadi from stages G and H (decision renders outside the
  repository, plan 061; the colours at the end of the project): the
  Water and Fire letter choices (a variants table in plan 061), the
  tablets' colours, and the Union on the page and the image route; from
  the versions, what Dee's two empty Fire squares mean and Cotton's x
  against Sloane's p (both built as recommended), Dee's Black Cross in
  the data, and the 1587 print's v in Fire's row 6 square 8. TODO: the British Library follow-up: re-check the catalogue
  (searcharchives.bl.uk, Sloane MS 3191), whose images have been
  offline since the Rhysida attack of October 2023 ("Images currently
  unavailable" on 24 October 2026; Cotton MS Appendix XLVI was never
  digitised), and when they return check the reformed table's folios
  (Peterson ff.53v–54r, Vovina and Burford ff.55v–56r), the 1587
  capitals, the Black Cross's placement, the letters Dee struck through
  in 1584, the two Fire squares where Sloane and Cotton differ, and the
  images' licence. TODO from earlier: Gadi's call on the Chiefs on the new presets' daises
  (after the merge; he leans towards Greer's redraws), the stage F
  markers and placeholders Gadi has yet to decide on (Eden and the Fall,
  with a proposal to make the pictures shown to the candidate cards
  like the Portal's; the Tree markers; the Minutum Mundum's path
  colours), the Portal Hiereus' ring colour (red as built, reading the
  rubric's "Black Collar" as a misprint for "Black Cloak"; black would
  be a dark grey ring), whether the Third Adept's lamen (blue ring, orange
  octagram) needs telling apart from the Praemonstrator's at icon size,
  the other five seals (hand-drawn after Agrippa like the Moon's and
  Venus'), and name sigils traced over a kamea (adapt `/gd/sigils`: a
  planet's square, the name's letters as numbers with an Aiq Bekar
  reduction where a value exceeds the square, a path through
  `kameaGeometry`'s cell centres, start and end marks as on the rose;
  `Kamea` hosts it as an overlay through `children`) once the sigil
  system handles the hard cases; recording officer movement between stations, a `gdVault` for
  the Adeptus Minor Vault, original Enochian letterforms, moving
  `enochianFont.ts` and the other files the import-boundary test allows out
  of `src/components` (or off their app imports), embedded fonts in the Tree
  of Life exports, Firefox and Safari checks of PNG export with embedded fonts,
  a credit for the RWS tarot images and the Pinterest hotlink in `2=9.pug`,
  single-word labels wider than their cell, which the layout cannot keep
  inside the walls, the README's claim (lines 13–15) that
  `src/components/LICENSE.txt` lists the components importing app code
  (it lists none), a hook-free id scheme for `GdHall` before halls are
  rendered on the server or exported from the reader, resvg-wasm's
  fallback to Noto Sans for the hall's quoted font stacks, Gadi's call on
  whether a hall's PNG export embeds Enochian Plain for its tablets,
  `//-` comments inside the built-in docs' halls (stage I) against their
  parity test, the docked panel checked outside headless Chromium, a
  `/gd/symbols` page for `Kamea`, the stage E follow-ups (free labels on hosts, a drawing of
  `/gd/hall` for search engines, share links' format 0 and the hall
  editor's new gestures outside Chromium; an app-wide `error.tsx`; the
  two-tab draft handling and the editor's error boundary outside
  headless Chromium; halls typed beyond the limits still read whole at
  each rest), Firefox, Safari and real-device
  checks of the hall editor's pointer and touch handling, the reader
  and documentation screenshots unchecked
  after the stage D review fixes (no publication storage locally), the
  warnings' second parse of
  the source (now in idle time), Chromium moving a selected block's DOM
  selection before input (ProseMirror reads it; seen in 3 of 28 CDP
  key presses) and a composition without an IME keydown not ending
  cleanly over a block next to another, Firefox and Safari checks of
  that input handling,
  the order-dependent `members` documentation screenshot, a server
  error on the temple membership page seen during the screenshot
  capture, `pnpm check:turbopack` failing on `main` as well
  (`next/font/google` in Turbopack, 18 October 2026), and an
  import-boundary gap:
  `src/components/entity/entityFields.test.ts` reaches app code through
  `import.meta.glob("../../app/**/fields.ts")`, which the test cannot see
  ([plan 061](061-gd-hall.md#follow-ups)).
- Search pages for the temple halls: designed and built on 26 October
  2026 on `gate/hall-seo` ([plan 062](062-gd-hall-seo.md)), every commit
  gated; awaiting review and merge. Each preset hall has a page under
  `/gd/hall/<slug>` with its licensed PNG and SVG, the presets are
  listed below the editor, the sitemap lists the images, and the
  editor's exports credit the art. The plan was revised after its
  adversarial review and Gadi's answers. Gadi's decisions that day: the
  hall images are CC BY 4.0, credited to Magick.ly (an `Organization`,
  not a person); one statically generated page per preset under
  `/gd/hall/<slug>`, with numbered slugs (`neophyte`, `zelator-1` …
  `portal-2`) and descriptive titles; `/gd/hall` stays the editor with a
  gallery below it; the social card with the hall first, the PNG
  second; editor exports credit the art only. The plan adds a `gd-hall`
  image contract drawn hook-free, static image files named after the
  slugs, licence metadata in the files and in `ImageObject` JSON-LD,
  sitemap image entries and links from `/gd` and the grade pages.
  Gadi then chose the outliner admitting the halls' gradients,
  patterns and clips for `gd-hall` only, the SVG indexable beside the
  PNG, and a 750 px image for phones. TODO from it: Enochian Plain's unknown licence,
  now drawn in CC BY hall images (Gadi: fine), and the IPTC Digital
  Source Type, left out as ambiguous for code-drawn art that AI agents
  wrote; revisit if a platform asks or Gadi wants to disclose the AI
  involvement. After the release: the hall pages in Google's Rich
  Results Test, the sitemap resubmitted, whether Vercel answers the
  image files' conditional requests with a 304
  ([plan 062](062-gd-hall-seo.md#follow-ups)).
- TODO (Gadi, 26 October 2026; saved for after the current hall work):
  whether the hall editor gets "+ Image". The ritual renderer may
  already draw images, but offline bundles and rights need thought;
  options recorded, not decided: users upload images and assert their
  rights; rights may not matter for private temples; or an uploader
  consents to (donates under) CC BY 4.0, against keeping copyright for
  internal use ([plan 061](061-gd-hall.md#follow-ups)).
- Temple halls under `/gd/halls` and plan 061's stage I: built on 28
  October 2026 on `gate/halls-i`, every commit gated; awaiting review
  and merge. Gadi chose a routed index (`/gd/halls`), hall pages with a
  rail of every hall (a "Jump to hall" select on phones) and the editor
  alone at `/gd/halls/editor`, with permanent redirects from `/gd/hall`
  ([plan 062's amendment](062-gd-hall-seo.md#amendment-the-halls-under-gdhalls-28-october-2026)).
  The built-in rituals draw the presets and link each hall's page; the
  ritual reader now opens links to this site; the five old drawings in
  `public/pics` are gone, no longer cited as sources, and redirect to
  their halls' SVGs; their `/about` credits are removed
  ([plan 061](061-gd-hall.md#stage-i-plan-28-october-2026)). TODO for
  Gadi after the deploy: edit the production "0=0 Grade of the
  Neophyte" ritual once to draw the Neophyte hall (a read-only query
  of current revisions and of revisions with unfinished, unexpired
  publications, a local rehearsal, then save and publish at once; no
  publication backfill before; plan 061, I.3). TODO: reader export,
  deferred; plan 061's end-of-project review (prepared) and stage J
  (private hall sources) remain. TODO from the review of 28 October 2026: at 1,440 ×
  900 the hall pages' rail (804 px) scrolls within itself, leaving the
  Portal below the fold (smaller thumbnails, or two columns on short
  screens); on a phone the hall page's visual order differs from its
  DOM order (CSS `order` puts previous and next and the actions above
  the lede), so reorder the markup or accept it
  ([plan 062's amendment](062-gd-hall-seo.md#amendment-the-halls-under-gdhalls-28-october-2026), A4).

Majou2 and MyReiki were read-only skill-evaluation fixtures. Neither was migrated.
