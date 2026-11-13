# Modernization status

Updated 2 November 2026. This page supersedes older pending-acceptance notes;
the [closeout checkpoint](025-pause-checkpoint.md) records preservation and
continuation boundaries.

Production is live on `41c6e3717fc8fde947268ea3f422de794995ae20`, deployment
`dpl_E3tWBJUHYdHzcqLRoQkbzpUmEwrx`, in London (`lhr1`) on Node 24, promoted on
1 November 2026 by
[Production release run 41293750989](https://github.com/gadicc/magickly/actions/runs/41293750989),
which passed its quality job (including `pnpm check:turbopack`), migrations,
staged checks and promotion. Every change this page records as built, up
to and including ritual deletion ([plan 065](065-ritual-deletion.md)), is in
it.

The SQL migration's final release, on 15 September 2026, was
`4d9d10d37b5a3877d0f9230c5e75ff5a969c7e37`, deployment
`dpl_HHLsAXCa7vopfkqwiyVuqETkaaL2`.
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

The reusable Loom `modernize-app` skill was committed locally on 15 September as
`b3460006a8482270c4cb9427b6a6bd4af7c2d51e`. The full Deno suite passed
(64 tests, 634 steps), as did formatting/lint, skill validation and the npm build.
All six emitted skill resources match source and their references resolve.
It has since been published: Magickly moved to Loom 2.0.0 on 17 October and
is on 2.2.1 since 31 October, whose skills include `modernize-app`.

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
- 31 October 2026: the open Dependabot alerts (undici, fast-uri, vite in
  both lockfiles, @vitest/mocker) cleared and the tree refreshed within the
  release-age policy; the sharp, source-map-js and next alerts were already
  stale. Recorded in the
  [October dependency refresh](066-october-dependency-refresh.md), with the
  remaining exact-pin zod, glob and minimatch advisories, the deferred Biome
  2.6 and identity-bound packages, and their follow-ups.
- 13 November 2026: Dependabot alerts #362 (zod), #364 (glob) and #366
  (minimatch) fixed by a `@vercel/functions` bump and parent-scoped
  overrides of Serwist's exact zod and glob pins (glob 14 checked against
  Serwist's calls); #363 (deepmerge, no fix) is declared by
  `@svgr/plugin-svgo` but never imported, for Gadi to dismiss. Recorded in
  [plan 066](066-october-dependency-refresh.md#13-november-2026-dependabot-alerts),
  with when to drop the overrides.

- TODO: rate limiting for the public component image routes
  (`/api/render/*`, `/api/treeOfLife`). Each distinct query renders through
  WASM on request, and `/api/render/rose-sigil` adds up to about 330 ms of CPU
  for a 32-letter text, so the edge cache offers no protection against varied
  requests. Nothing in the app rate-limits today; see
  [plan 027](027-component-exports.md#adversarial-review).
- 10 November 2026: Bing Webmaster Tools has magick.ly (and the old
  magick.li); each production release tells IndexNow (Bing, Yandex and
  the other participating engines; not Google) which pages changed:
  `scripts/indexnow.mjs` fingerprints every sitemap page before promotion
  and after, and submits the changed, new and removed ones. The key file
  is `public/<key>.txt`; the key is public by design. A failed snapshot or
  submission never fails the release.
- 11 November 2026: the planet pages ([plan 078](078-planet-pages.md)).
  Search Console had `/astrology/planet/sol` as "Discovered – currently
  not indexed", and the fifteen pages 4 impressions since August. They
  now lead with the names readers search for ("Sun (Sol) ☉", "North Node
  (Caput Draconis) ☊"), the seven planets have a Day row, the eight thin
  rows have texts in our own words from public-domain sources, the
  spheres list the ten heavens, and every planet description is 110 to
  160 characters. TODO: two weeks after release, read the planet pages'
  indexing state again; the grades and sephirot share the problem and
  wait on that measurement.
- 13 November 2026: no page in the sitemap has a meta description under
  110 characters, which Bing reports as too short. The planets were done in plan 078; the other
  13 short pages are fixed. Four hubs (`/astrology/zodiac`, `/gd/grades`,
  `/help/ritual-pug`, `/kabbalah/yhvh`) have new texts, accepted by Gadi.
  The grades now name their order and, where they fit, the grades on
  either side; the paths give their letter's glyph and meaning; the
  angels give their degrees of the zodiac; a Lenain chapter with no
  subtitle takes its English title. 94 descriptions change, and the tests
  hold every public, entity and chapter page to 110–160 characters. Found
  on the way: the zodiac table printed its dates as raw data and called
  Taurus "Bullm"; both fixed, the second in `magick-data` (a patch for
  the next npm release). The ten heavens on the sphere pages have row
  headers and a name. Not covered: a public SQL ritual's description
  (`src/app/doc/[_id]/page.tsx`) is its title and 85 characters, so a
  short title gives under 110; those pages are indexed but not in the
  sitemap.
- Done by 9 November 2026: Search Console lists only `/sitemap.xml`
  (197 pages, 28 images), last read 6 November with no errors;
  `/sitemap-0.xml` is gone ([plan 028](028-seo.md#follow-ups)).
- 9 November 2026: SEO and speed are measured with Vercel Web Analytics
  and Speed Insights (`src/analytics/`), next to Search Console. Public
  pages report their path; any other page reports only its section
  (`/temples/*`), unknown paths `/*`, and no query string, because private
  rituals, temples and invite passwords live in paths. After any private
  page, Speed Insights sends nothing until a full load, since its vitals
  carry CSS selectors from the measured page. Accepted limits: repeat
  views of one private section count once; an outside site's referrer
  is sent as its browser exposes it (its origin, under the default
  policy). Web Analytics was turned on in the Vercel project on
  9 November. On 13 November Speed Insights was checked: on, and a live
  page sends its vitals. Its scores are read in the Vercel dashboard
  only, and from 9 to 13 November the site had about 130 visitors, 9 of
  them from search, so they will be thin for a while.
- 13 November 2026: Lighthouse (mobile, three runs a page) found pages
  quick to load (LCP about 1 s, CLS 0, server about 60 ms) but the main
  thread blocked for up to 17 s. The closed drawer and title menu are
  kept mounted: the menu hidden with `visibility: hidden` in the
  viewport, the drawer just off its edge. Next 16 prefetches every link
  within 200 px of the viewport, hidden or not, so every page fetched
  and parsed the code of every page they list,
  among them the chat's 1 MB chunk (the AI SDK, zod, react-markdown and
  every Prism language). Blocking that chunk took the angel page from
  69 to 93-96. Their links now prefetch only while their menu is open
  (`src/app/MyAppBar.tsx`), which halves the JavaScript a page downloads
  (about 2.7 MB to 1.4 MB unzipped on the planet, angel, 72 angels and
  hall pages). Timings re-measured on a loaded machine were too noisy to
  report; re-measure the live site after release. TODO: visible links
  to `/chat` still prefetch that chunk: the home page's first screen,
  and the footer's on any short page or once a reader nears the end.
  Only a lighter chat page closes this: load its Markdown and
  highlighter lazily, or use Prism's light build with a few languages. TODO: the hall page draws
  for 2-7 s on a phone CPU even without the chat chunk; profile it. TODO,
  from Lighthouse: no page has a `<main>` landmark; the 72 angels page
  logs React hydration error 418 and has a link whose text is "here",
  and its 72 header links are small touch targets; the angel pages'
  trail link is low in contrast.
- 9 November 2026: on-site search work (breadcrumbs, a footer, section
  and tool text) in [plan 071](071-on-site-search.md), from a Search
  Console audit: 3 clicks in 28 days, most sitemap pages unseen. Stages
  1 to 4 are released; stage 5, the section and tool text, was built
  10 November on `gate/onsite-texts`, stacked on `gate/enochian-keys`.
  TODO: other American spellings in the data (such as "favor",
  "fulfill", "savior") stay until the language packs; Gadi chose
  "Splendour" alone for now.
- 10 November 2026: the geomancy credits checked against Gadi's copy of
  *The Golden Dawn Journal, Book 1: Divination*, edited by Chic Cicero and
  Sandra Tabatha Cicero (Llewellyn, 1994). The essay is Mitch and Gail
  Henson's "By the Signs of the Earth: Geomancy in the Golden Dawn",
  pp. 145-175; the reading's invocation is on p. 155, and the data's
  pages (147, 162, 164) fall in it. Both pages and the data files named
  it until plan 075 replaced its wording the same day. The other slips
  the stage 5 review found were fixed the same day: "ofThe", "Geomanic",
  the reference's and the reading's headings (now `h2`s) and the two
  `h1`s on `/books` and the book's own page.
- 10 November 2026: the geomancy texts no longer use the Hensons'
  wording ([plan 075](075-geomancy-own-words.md)). The figures' meanings
  and the house table are the Golden Dawn's, from Crowley's "A Handbook
  of Geomancy" (*The Equinox* I(2), 1909), abbreviations spelled out and
  "evil" read "unfavourable"; the houses and the reading's invocation
  are in our own words, from Agrippa's *Fourth Book* (Turner, 1655) and
  *Liber O*. Both pages credit those sources.
- 10 November 2026: the Enochian Keys complete and checked in
  [plan 073](073-enochian-keys.md): most Keys lack their Enochian (676 of
  1,014 rows), the 2023 text's source is unknown, so all of it is
  re-derived from Casaubon (1659) and Crowley (1912), with both
  traditions' readings and the nineteenth Call. Built 10 November on
  `gate/enochian-keys`. TODO: Dee's own copy, Sloane MS 3191, when the
  British Library's images return: his accents, the words Casaubon's
  print lost (Keys 14–16) and his Aethyr spellings.
- 10 November 2026: English search in the Enochian dictionary, with a
  revamp of its page, in [plan 074](074-enochian-dictionary-search.md).
  The two boxes (Latin, and Enochian right to left) hold one query,
  searched both ways at once and grouped. Every row carries a meaning,
  in the prerendered HTML too. An Enochian keypad types by glyph. The
  entry opens beside the list or in a sheet, with where the Keys use
  the word. Links keep the search (`?q=`, `?w=`). Built 10 November on
  `gate/enochian-dictionary-search`. Its dark mode came with
  [plan 076](076-dark-mode.md) (step 4 checked the page in dark);
  TODO: the keypad is unchecked on iOS Safari (no device).
- 11 November 2026: dark mode, built on `gate/dark-mode`
  ([plan 076](076-dark-mode.md)). Pages follow the device's setting,
  with a Light / System / Dark switch at the foot of the menu drawer; the
  "Midnight" palette; black line art re-inked and dense drawings on a
  light plate, while downloads, server images, OG cards, help
  screenshots and print stay light. The ritual reader's dark colours and
  role names are Gadi's choice of 11 November. MUI's CSS variables and
  its inline colour-scheme script keep prerendered pages static with no
  flash. Light mode is pixel-identical to `main` on every page checked,
  and every commit passed the CI-equivalent gate. TODOs in the plan's
  follow-ups (account-wide choice, dark help screenshots, PWA splash);
  Safari and iOS are unverified (no device).
- 11 November 2026: FrankRuehl CLM, which is plain GPL-2, replaced by
  Frank Ruhl Libre (SIL OFL 1.1) in [plan 079](079-frank-ruhl-libre.md):
  the Hebrew text font is one self-hosted variable subset with an added
  upper dot (U+05C4) for Lenain and the angels' pointed names, and the
  halls' Hebrew is Frank Ruhl Libre Bold, which moves every hall image's
  identity (profile v2). Built on `gate/frank-ruhl-libre`. TODO: the
  double precache of the text font and a doubled dagesh in one angel
  name ([plan 079](079-frank-ruhl-libre.md#follow-ups)); Safari unchecked.
- 11 November 2026: publishing `magick-data` and `magick-components`, and
  an `/open-source` section, planned in
  [plan 080](080-open-source-packages.md), not built. The hub states the
  licences and introduces both packages; each table has a page with its
  rows, relations as links and a field list generated by the data build;
  each component has an explorer page whose controls come from its props
  types through `react-docgen-typescript`. `magick-data` publishes first,
  by hand as a release candidate, then from CI with provenance;
  `src/components` becomes `packages/magick-components`. Reviewed by
  Fable, spiked (field manifest, docgen, a packed package in a Next
  fixture, the registry) and mocked up. Both npm names were free on
  11 November. Stage A (the package ready to publish, `publish.yml` with
  the packument rule, CI's dry run of the verified tarball) is built on
  `gate/data-publish` (rebased onto `c768e5b1`) and both its reviews
  applied: `id-token` only in a publish job that installs nothing, CI's
  registry check off the deploy path, CI publishing directly with
  provenance (Gadi); then a `prepack` guard npm under pnpm cannot pass,
  a dated sign-off column in the README's Sources, and registry
  refusals that check what npm has. Merged on 12 November, after the
  `npm` environment was created. The provenance clean-up (the copied
  planet and house texts replaced, the Enochian letters in both
  traditions, citations) is merged too
  ([plan 080](080-open-source-packages.md#the-provenance-clean-up-12-november-2026)),
  and Gadi signed off every Sources row the same day
  ([plan 080](080-open-source-packages.md#the-sign-off-12-november-2026)).
  `0.1.0-rc.0` was published by hand the same day and `0.1.0` from CI
  with provenance through the trusted publisher; on 13 November `next`
  was removed and tokens disallowed, which completes stage A′
  ([plan 080](080-open-source-packages.md#010-12-and-13-november-2026)).
  Stage B, the `/open-source` hub (the licences, a card per package,
  `/about` and the pages' open-source line linking it, its place in the
  bar, footer, sitemap and search), is built on `gate/open-source-hub`,
  not merged, with its review applied (the licence wording narrowed to
  what the repository bears out)
  ([plan 080](080-open-source-packages.md#stage-b-13-november-2026)).
  Stage E (13 November) is built on `gate/magick-components`, on top of
  stage B, not merged: `src/components` is the workspace package
  `packages/magick-components`, with no app imports left, explicit
  extensions, a strict check (64 errors to none), `ref` as a prop, the
  nlopt optimiser in its own module, `RoseSigilImage` drawing any text,
  `"use client"` on Mercury, Moon and RoseSigil only, the hall fonts with
  `gd-hall.css`, a README and a smoke test that builds a Next fixture
  under both bundlers; still private at 0.0.0. No render hash moved
  ([plan 080](080-open-source-packages.md#stage-e-13-november-2026)).
  A final review's nine findings are fixed on
  `gate/components-hardening`, not merged: moon-phase's BSD notice for
  the Moon's paths, the Moon's background as a prop, named errors for
  unknown Tree ids and rose letters, two stray Inkscape trees deleted,
  the fylfot's ink as a prop, a smoke-test leg against the registry's
  magick-data with a robust `--before`, and the Tree's ids and
  stylesheet scoped per instance with its fonts a prop. No render hash
  or pixel moved
  ([plan 080](080-open-source-packages.md#before-publishing-13-november-2026)).
  Gadi approved the Tree's markup change. TODO: the app's own credit
  for moon-phase, with a search-vector refresh.
  Stage C, the field manifest from the data build, a description for
  every table and all 272 field paths with a test that requires them,
  `/open-source/data` and a page per table (rows as anchors, links
  between them, the fields, a JSON detail pane; not indexed), is built
  on `gate/open-source-data` on top of the components hardening, with
  its review applied, not merged; the manifest stays out of the
  published tarball until Gadi signs off its Sources row
  ([plan 080](080-open-source-packages.md#stage-c-13-november-2026)).
  Stage F (13 November) is built on `gate/open-source-components`, on
  top of stage C, not merged: an example module for each of fourteen
  components, the `react-docgen-typescript` props manifest committed
  with a freshness test, a description for every component and prop,
  `/open-source/components` (a tile each, from `/api/render` where a
  contract exists) and an explorer page per component (drawn live,
  controls from the props types, the JSX, the props table), which load
  `nlopt-js` and `astronomy-engine` only on the sigil's and Mercury's
  pages, with its review applied (the picker, long names on a phone,
  JSDoc written for the package's readers, an image parity test)
  ([plan 080](080-open-source-packages.md#stage-f-13-november-2026)).
  TODO: with Gadi's go-ahead, stage G; stage E's and F's deferred
  items. Follow-ups:
  [plan 080](080-open-source-packages.md#follow-ups),
  [stage B's](080-open-source-packages.md#stage-b-13-november-2026),
  [stage E's](080-open-source-packages.md#stage-e-13-november-2026) and
  [stage C's](080-open-source-packages.md#stage-c-13-november-2026).
- 12 November 2026: the Enochian dictionary's and Keys' gematria named as
  Gerald Schueler's (EMPM, 1985), Gadi choosing a label over removal. All
  190 entries that carry it cite EMPM (a test keeps it so). Each value
  is marked EMPM with a note that it is his modern system, from Hebrew
  letter values through the Golden Dawn's attributions, and that
  neither Dee's angels nor the Golden Dawn assigned the letters number
  values (Leitch, *The Angelical Language* vol. I ch. 5; Laycock, *The
  Complete Enochian Dictionary* pp. 43–44); the pages' copy and the
  dictionary's meta description agree, and the search vectors are
  republished. Built on `gate/enochian-gematria`, on top of the
  provenance clean-up.
  TODO: the few number-words in the Keys that Dee's English gives as
  numbers (inconsistent, Leitch notes) could be shown as Dee's own
  numbers, if Gadi wants them. TODO: two values are no sum of their
  letters (BAEQUIB 186, the letters 196; BASM 110, perhaps BAZM's);
  check them against EMPM.
- Released on 10 November 2026: location for the planetary hours, the
  moon and the geomancy reading comes from Vercel's request headers
  through `/api/geo` instead of get.geojs.io, and the reader can choose
  a place ([plan 072](072-reader-location.md)). Production's
  `/api/geo` was checked after release.
- TODO: show a chosen place's hours on that place's own clock, not the
  device's ([plan 072](072-reader-location.md), decision 2).
- TODO: between the place's solar midnight and sunrise, the planetary
  hours page's first day is the coming one, so the night hour in progress
  isn't shown (`src/app/astrology/planetary-hours/planetaryHours.tsx`);
  it behaved the same before [plan 072](072-reader-location.md).
- TODO: SEO content follow-ups from [plan 028](028-seo.md#follow-ups):
  public SQL rituals in the sitemap wait for a "list in search engines"
  option on the ritual (Gadi, 10 November 2026): marking a ritual public
  makes it readable by link, which is not the same as asking for it to be
  advertised, so only rituals whose owner ticks the option would be listed.
  The built-in rituals (`/doc/neophyte`, `/doc/zelator`,
  `/doc/theoricus`) are in the sitemap and indexable. `/study` prerenders its
  set list for the default filters, each set linked, as its Suspense
  fallback (10 November 2026). `/astrology/moon` already computes its
  dates only in the browser (`74fe9a51`, "Draw moon phases after
  hydration"). The
  app bar's fuller titles are done ([plan 071](071-on-site-search.md)). The raw
  JSON rows on the entity
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
- The data layer is rebuilt: `data/` keeps plain JSON tables, one
  declared graph describes every relation, and an eager `assemble()` replaces
  the barrel's in-place linking. See [plan 032](032-data-layer.md). Steps 0
  to 3 are recorded here; step 4, the `magick-data` package, further down.
  Step 0 pinned the pages the data changes touch, step 1 repaired the links,
  sentinels and field names the audit found (Luna's god name and the rulers
  of Cancer and Scorpio changed with it), and step 2 built the layer itself:
  JSON emitted from the JSON5 sources into gitignored `data/dist`, a
  declared graph over all 26 tables, row types derived from the JSON
  rather than copied by hand, `assemble()` over the 23 tables the
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
  `magickTypes` was removed on 12 November 2026: it was copied from a 2020
  Llewellyn book
  ([plan 080](080-open-source-packages.md#the-provenance-clean-up-12-november-2026)).
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
- `magick-data` 0.1.0 is on npm (plan 080, stages A and A′, 12 and 13
  November), published from CI with provenance; see the 11 November
  entry above. The Enochian dictionary stays out of the tarball: its
  entries come from Schueler's *Enochian Magic: A Practical Manual* and
  *The Whole Enochian Dictionary*, whose rights are not ours to give.
- The component explorer under `/open-source/components`, our own
  rather than Storybook, first raised in
  [plan 052](052-data-package.md#follow-ups), is built as plan 080's
  stage F, not merged; see the 11 November entry above.
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
- Released on 18 September 2026 (run 35369283455): anonymous
  `/api/session` checks return 200 with a null user instead of 401 (changed
  17 September); see
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
  rituals; see [plan 061](061-gd-hall.md). Each stage below was built on
  its own gate branch and is on `main`: stages A to F and F's follow-ups
  were released on 22 October 2026 (run 39843512728), stages G and H, the
  tablet versions and stage I on 31 October (run 41182234108).
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
  the Adeptus Minor Vault, original Enochian letterforms, embedded fonts in the Tree
  of Life exports, Firefox and Safari checks of PNG export with embedded fonts,
  a credit for the RWS tarot images and the Pinterest hotlink in `2=9.pug`,
  single-word labels wider than their cell, which the layout cannot keep
  inside the walls, a hook-free id scheme for `GdHall` before halls are
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
  capture, and an import-boundary gap:
  `src/components/entity/entityFields.test.ts` reaches app code through
  `import.meta.glob("../../app/**/fields.ts")`, which the test cannot see
  ([plan 061](061-gd-hall.md#follow-ups)). `pnpm check:turbopack`, which
  failed on `main` on 18 October 2026 (`next/font/google` in Turbopack),
  passes again in the 1 November release run.
- Search pages for the temple halls: designed and built on 26 October
  2026 on `gate/hall-seo` ([plan 062](062-gd-hall-seo.md)), every commit
  gated; released on 31 October 2026. Each preset hall has a page under
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
  involvement. TODO now that it is released: the hall pages in Google's
  Rich Results Test, the sitemap resubmitted, whether Vercel answers the
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
  October 2026 on `gate/halls-i`, every commit gated; released on 31
  October 2026. Gadi chose a routed index (`/gd/halls`), hall pages with a
  rail of every hall (a "Jump to hall" select on phones) and the editor
  alone at `/gd/halls/editor`, with permanent redirects from `/gd/hall`
  ([plan 062's amendment](062-gd-hall-seo.md#amendment-the-halls-under-gdhalls-28-october-2026)).
  The built-in rituals draw the presets and link each hall's page; the
  ritual reader now opens links to this site; the five old drawings in
  `public/pics` are gone, no longer cited as sources, and redirect to
  their halls' SVGs; their `/about` credits are removed
  ([plan 061](061-gd-hall.md#stage-i-plan-28-october-2026)). TODO for
  Gadi, due since the 31 October deploy: edit the production "0=0 Grade of the
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
- Linked selection in the hall editor: planned and built on 29 October
  2026 on `gate/hall-sync` ([plan 063](063-hall-selection-link.md)),
  reviewed and answered by Gadi the same day, every commit gated;
  released on 31 October 2026. In `/gd/halls/editor`'s split view,
  selecting an item in the drawing moves the source caret to its tag,
  and moving the caret selects the item. The same link in the ritual
  editor's split view, between a hall item and its line in the whole
  ritual's source, while Edit hall is open: planned, built and
  code-reviewed on 30 October 2026 on `gate/ritual-hall-link`, every
  commit gated; released on 31 October 2026
  ([plan 064](064-ritual-hall-selection-link.md)). The install
  holds one `@codemirror/view` again (6.43.15) and one
  `@codemirror/commands` (6.11.1), since 30 October 2026.
- Deleting rituals: planned on 31 October 2026 on `gate/ritual-deletion`
  ([plan 065](065-ritual-deletion.md)); Gadi took all fourteen
  decisions. Delete hides a ritual and Recently deleted restores it for
  30 days, after which a nightly Vercel cron purges its rows and R2
  objects; administrators can delete permanently at once. It adds the
  `audit_events` table that plan 057's audit log can reuse. Neon's
  point-in-time restore window is 6 hours (free plan) and is not relied
  on; `CRON_SECRET` is in Vercel Production (31 October 2026). Gadi
  skipped both spikes (no Vercel cron rehearsal, no preview-bucket
  delete). Built on 1 November 2026 on the same branch and released that
  day (run 41293750989), commits 3 and 4 in one push. Spike 1(d), the
  cron's only test, passed: the first nightly run, on 2 November 2026 at
  03:17:25 UTC, reached deployment `dpl_E3tWBJUHYdHzcqLRoQkbzpUmEwrx`
  and returned 200 with no `purge` log line, so nothing was purged,
  deferred or failed (plan 065, "The first nightly run"); Gadi saw its
  heartbeat line, "(ok)", on Recently deleted. **Never roll
  production back past this release**
  without first purging what should go: the older code shows every
  soft-deleted ritual again and stops purging (plan 065, risk 12).
- 2 November 2026, on `gate/check-only-recheck`, awaiting release: a
  check-only mode for `/api/rituals/permission`. The Downloaded rituals
  recheck and the reader's refresh send a version 2 check, which returns
  the permission and the bundle's identity without the manifest (up to
  16 MB); the reader asks for the full version 1 delivery only when its
  copy is out of date or missing, and a server without version 2 gets
  one version 1 retry. Version 1 is unchanged
  ([plan 068](068-check-only-permission.md)).
- 1 November 2026, on `gate/mui-colour-status`, awaiting release: fifteen
  `Typography` colours that MUI 9 silently dropped are restored. Palette
  paths such as `color="warning.main"` and `color="text.secondary"` were
  system props, which MUI 9 removed (the app moved from MUI 7 to 9 on
  12 September 2026, `458225ce`), so the study sync warnings, the temple
  pages' confirmations and several notes rendered in the body colour; they
  now use the palette keys `warning`, `success` and `textSecondary`, and
  `src/muiColorProps.test.ts` fails on a palette path in a component's
  `color` prop, or in a `color` key passed outside `sx`. The
  `create-ritual` and `forum-settings` help screenshots were recaptured
  with them. TODO: the worktree capture (`magickli-docs-capture`) cannot
  take `forum-settings`, because it gives the server no secrets key and
  the forum form only renders when keys can be stored; it also starts
  `next dev` without building `magick-data`, so a fresh worktree needs
  `pnpm data:build` first. That shot was taken with `capture.mts` against
  a 127.0.0.1 dev server holding the same local settings and a throwaway
  secrets key.
- Temple halls index: planned, reviewed (Fable), spiked and built on
  8 November 2026 on `gate/temple-halls`
  ([plan 069](069-temple-halls-index.md)), every commit gated and
  reviewed, the whole branch reviewed by Fable; awaiting release. The
  branch sits on plan 068's `gate/check-only-recheck`, so releasing it
  releases plan 068 too. A Halls action in the reader lists and opens a
  ritual's halls full screen; `/gd/halls` gains a tab per temple the
  member belongs to, listing the halls in its published rituals they
  may read, fetched to the device; offline they are on the Downloaded
  rituals page. Editing halls outside rituals and shared halls are
  later steps. Not checked on Safari, on a real phone or with the
  network off in a production build (plan 069, "The build").
- TODO: a hydration mismatch in the Table of Shewbread art inside the
  Zelator and Theoricus halls, on `main` too (seen 8 November 2026):
  path coordinates differ in their last digits between server and
  client, so React warns and keeps the server's attributes. The drawing
  is the same; round the coordinates as plan 030 did for the Tree,
  which there moved the image identity: here the hall snapshots and
  the published hall images would change too.

Majou2 and MyReiki were read-only skill-evaluation fixtures. Neither was migrated.

## Long-term goals

Ideas the owner wants kept in view, far beyond current work:

- A small neural network for translating between Enochian and English
  (Gadi, 10 November 2026), after the dictionary's English search.
- Language packs: the site and the data in other languages, beyond the
  French already given for Lenain (Gadi, 10 November 2026).
