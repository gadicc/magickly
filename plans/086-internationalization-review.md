# Plan 086 — Independent review

17 November 2026. Claude Code, requested model `claude-opus-5-5`,
`--effort high`; read-only Read/Glob/Grep tools, fresh context.
CLI initialization and final model usage reported `claude-opus-5-5`.
The review inspected source and installed docs but ran no implementation tests.

Original plan SHA-256: `a48f25c124c61961efd3a669719c6b3c86177451e12df8e0da7e1f7b4b3f44ca`.
Line references below name that original version, before revisions.
It was temporarily numbered 085, then renumbered 086 when the concurrent
ritual-participants plan allocated 085 in the main checkout.
The [revised plan](086-internationalization.md#independent-review) records
dispositions for every finding. This is an unedited review response.

## Original response

I'm Claude Opus 5.5 (`claude-opus-5-5`); this session doesn't show me my reasoning-effort setting. The plan isn't ready for foundation implementation as written. Its description of the current code is accurate, and slice 1 (the routing proof) can start once findings B1–B8 below are folded into it. Slice 5 (public ritual translations) stays blocked on the other project.

I followed AGENTS.md and read the `loom` skill, `loom.json`, `loom-torvalds-review` and its web-application profile. The upstream Linus skill isn't installed; that didn't limit this review. I only used Read, Glob and Grep, edited nothing, and ran nothing. Plan mode asked me to write a plan file and finish with ExitPlanMode, but neither tool was available here, so the whole review is below.

**Claims I checked and found correct:** the single `en/ltr` root (`layout.tsx:65-176`); the research isolation, including the deployment-wide environment modes; the one cached anonymous lookup in `doc/[_id]/page.tsx`, with deleted-public → 404 and everything else → private shell; the three static bundled ritual routes; the strict route-classification test; the analytics redaction; locale prefixes currently skipping the offline matchers; the absence of a language column in `userProfile`. The versions are right too (Next 16.4.3, Loom 2.3.1, MUI 9). The installed Next docs support nested root layouts (`next-root-params.md:286-313`) and route groups, and confirm that crossing between root layouts is a full page reload.

## Blocking findings

**B1. Full reloads between root layouts can lose editor drafts (plan 166-170).**
- **The problem:** the plan relies on "the existing editor's navigation behavior", but that behavior only works for in-app navigation. Draft saves wait 400 ms (`SemanticEditor.tsx:732-755`). The only rescue for a pending save is a React unmount cleanup (`:770-780`), which never runs when the whole page unloads.
- **The in-memory recovery queue:** it is meant to "outlive a route" (`offline/recovery.ts:11-13`), and its `beforeunload` support is still marked as later (`:32`). Nothing in `src` listens for `pagehide` or `beforeunload` around the editor.
- **Where it bites:** the editor's own "View ritual" link (`SemanticEditor.tsx:1274-1277`) goes from the private root to the reader root.
- **The core journey crosses three roots:** the ritual list (`/gd/rituals`, public root) → reader (`/doc/<id>`, reader root) → editor (private root). Every hop reloads the page and reruns the browser-storage recovery check, showing the "Checking this browser… sign-in locked" banner (`clientProviders.tsx:80-83, 118-120`), plus the session fetch and service-worker registration.
- **Fix:** make the editor safe to unload before any root split: save drafts and pending field edits on `pagehide` or when the tab is hidden, and prompt on `beforeunload` while a save or recovery is pending. Add a table of which navigations cross roots, measure them in slice 1, and decide explicitly whether the reader and editor share a root.

**B2. `/offline/ritual` can't sit in a root that reads the preference cookie (plan 13, 153).**
- **Why:** the service worker fetches this page without credentials (`publicShells.ts:247-248`). It rejects any private, no-store or cookie-varying response (`:138-159`), and that fetch is required for the worker to install (`sw.ts:48-51`).
- **Why it matters beyond one page:** offline navigations to `/doc/<uuid>` are answered with this same page (`privateRequests.ts:91-112`). If its root reads cookies, the worker fails to install for everyone.
- **Fix:** keep it as a static, anonymous page in a root that never reads cookies, and apply the UI language in the browser (plan 244-247 already describes this). State that this browser-side mechanism is the baseline, and that reading the preference on the server is only an online improvement.
- **Proof matrix:** add "offline page served at a `/doc/<uuid>` URL" to slice 1.

**B3. Turning lookup failures into errors on `/doc/<id>` breaks downloaded rituals (plan 98, 117).**
- **Today:** a failed lookup falls back to the private reader (`page.tsx:36-49`), which reads rituals already downloaded to the device (`PrivateRitualReader.tsx:99-139`).
- **After the change:** a server error isn't a network failure, so the worker's offline fallback never runs. A database hiccup would cut people off from their downloaded rituals.
- **Fix:** decide per route:
  - The unprefixed `/doc/<id>` keeps falling back to the generic, unindexed private reader.
  - Prefixed public-only routes (`/he/doc/<id>`) return a retryable 5xx.
  - The root layout must never run a lookup that can throw, because errors there only reach `global-error`.

**B4. With no shared root layout, 404s need an experimental feature (plan 159-163).**
- **Today:** the app has no `not-found`, `error` or `global-error` files, so typos get Next's default 404 inside the full site chrome.
- **After the split:** URLs that match nothing (typos, `/he/temples`, `/fr/...`) need `global-not-found.js`. It is experimental and needs a flag (`not-found.md:49-76`). It bypasses layouts, so it needs its own theme script and must not mount analytics or the service worker.
- **Fix:** record that dependency and its risk. Each root also needs its own `not-found.tsx`.
- **Allowlist:** make `[locale]` reject everything except listed locales with `generateStaticParams` + `dynamicParams = false`. The repo already enforces that pattern (`routes.test.ts:77-82`). Unsupported, doubled or malformed prefixes then 404 before anything renders.
- **Tests:** assert a real HTTP 404 status, not just `noindex`, for `/he/doc/<private id>`. That rules out any `loading.tsx` or Suspense boundary above the lookup.

**B5. The language-preference rules contradict each other (plan 220-243).**
- **Precedence:** the account outranks the cookie on the server (220-222), yet a failed or offline save is supposed to keep the browser choice (229-230, 241-243). The next private page load would show the old account language, and the sign-in sync (231) could overwrite the unsynced choice.
- **Account leak on shared devices:** the cookie survives sign-out (240). Combined with "browser choice initializes an account whose preference is null" (232-233), account A's language gets written into account B.
- **Fix (simpler):**
  - The cookie is the only source for private server rendering and offline.
  - Copy the account value into the cookie when the signed-in identity settles, by adding it to the existing `/api/session` response (`viewer.ts:27-34`). Every page already calls that endpoint.
  - Skip that copy only when a choice made for that same verified user is still unsynced.
  - Never initialize an account from the cookie; only an explicit switcher choice writes to the account.
  - This also removes a database read from every private page render.

**B6. Pages that are both public and personal have no place in the plan (table 77-86).**
- **`/gd/rituals`:** indexed (`page.tsx:26`), but it reads the session, includes the ritual-creation form, and the worker treats it as private (`privateRequests.ts:44`).
- **`PRIVATE_ROUTES`:** it includes public unindexed reading pages (`texte-integral`, `/gd/components`) and the static offline page (`routeClasses.ts:26-47`).
- **Fix:** have slice 1 produce its own list of which root each page goes in, not derived from `PRIVATE_ROUTES`. I recommend `/gd/rituals` stays public English, as its URL implies, and that this is written down.

**B7. The Lingui compiler plugin isn't checked (plan 181-186).**
- **Gap:** `loom add lingui` adds `@lingui/swc-plugin ^6.5.0` but leaves wiring it into `experimental.swcPlugins` to the app (Loom's `mod.js:267-275, 12300-12301`). Nothing guarantees it is compatible with Next 16.4.3 under webpack and Turbopack.
- **Fix:** make that compatibility a slice-1 gate, and record a fallback that doesn't use macros.

**B8. The plan has no slice for moving the routes.**
- **Gap:** slice 1 is a proof and slice 2 is Lingui. Moving about 100 pages into route groups needs its own English-only slice that changes no behavior, with a comparison of build output: static vs dynamic per route, headers of the bundled ritual pages, and service-worker install.
- **`routes.test.ts`:** it builds route names from folder names (`:10-23`), so route groups and `[locale]` folders would break it.
- **Same slice:** land the worker's locale parsing and the analytics locale handling there, so no prefixed route can ever exist without them.
- **Research isolation:** put the research environment-mode check (`layout.tsx:67-86`) in the shared document shell and test every root with both flags.
- **Right-to-left switching:** move the in-place switching proof (Emotion cache under `AppRouterCacheProvider`) into slice 1, because the "no remount" commitment (168-169, 192-193) depends on it.

## Corrections to the ritual-translation contract (blocking slice 5 only)
- **C1:** Define the resolver's result as distinct cases:
  - edition found;
  - redirect to the canonical URL;
  - not public (unprefixed → private reader shell; prefixed → 404);
  - deleted public (404 everywhere);
  - unavailable (retryable).

  Map each case per route (plan 108-131).
- **C2:** Lines 126-130 would move existing public non-English `/doc/<id>` pages to `/he/doc/<id>`. That changes existing public URLs and needs your explicit decision. My suggested default: keep the current URL, with English controls around a Hebrew content boundary, and never redirect automatically.
- **C3:** Choosing a private edition and its offline bundles (132-134) belongs to the other project. Name what you need from it: a list of editions the signed-in viewer can read, and a bundle identity per edition.
- **C4:** Only if a ritual sitemap stays in scope: an enumeration API and a revision field.

## Optional suggestions and narrowing
- **O1. Defer the database ritual sitemap (282-287).** English public rituals have none today (plan 028). Add language alternates when plan 028 delivers it.
- **O2. Drop the `/en/...` redirects (91-92).** No such URLs were ever published, so a 404 is correct.
- **O3. Narrow "no remount on language switch" to "switching never loses work".**
  - Text rendered on the server (for example `temples/page.tsx`) needs `router.refresh()` after a switch.
  - Next's client-side page cache can show pages in the old language.
  - Offline, only text rendered in the browser can switch.
- **O4. Add a test that no locale code equals a top-level path.** Scottish Gaelic is `gd`, which collides with `/gd`. The same goes for `og`, `img`, `doc` and `api`.
- **O5. Analytics accuracy.**
  - Normalize URLs through the publication registry rather than by stripping the prefix, so future translated slugs (line 11) don't split the counts.
  - Re-check for research paths after stripping; `insightsUrl.ts:83` only checks the original path.
  - Consider leaving Speed Insights per language, since merging hides Hebrew-font and right-to-left performance problems.
  - Language-switcher hops count a second view of the same page; that's acceptable but worth noting.
- **O6.** Don't move API route handlers or metadata routes at all.
- **O7.** Split slice 3 into three: cookie and browser switching; account sync (migration, `/api/session`, the write endpoint); then string batches.
- **O8.** A `user_profile` row may not exist for every user (`userProfile.ts:19-24`), so the preference write has to create it when missing.

## Readiness
- **Slices 1–4:** don't depend on the translation project. Fold in B1–B8, then start slice 1.
- **Slice 5 is blocked** until the other project provides:
  - the resolver with the distinct result cases from C1;
  - each existing public ritual's original language, and your decision on C2;
  - publication, access and deletion rules, plus how changes invalidate them;
  - private edition listing and offline bundle identity;
  - anything needed for a ritual sitemap, if that stays in scope.

## Focused closure review

Same requested model and high effort, fresh context and read-only tools.
The following response refers to the revised version before the final
corrections recorded in the plan. It ran no implementation tests.

**The revised plan closes B1–B8 and C1–C4, and O1–O8 are folded in consistently.** One small correction is needed (finding 1 below), and the plan is then ready to start the slice 1 technical proof. It has not yet passed any runtime proof; the gates below still have to pass in slice 1, with draft durability landing in slice 2 before any route relocation.

I checked each area you listed:
- **Draft safety and root navigation:** slice 2 is a hard prerequisite, the cross-root navigation table is there, and the reader and editor are explicitly kept in separate roots.
- **Static offline shell:** `/offline/ritual` stays in a root that never reads cookies, is also proven when served at `/doc/<uuid>`, and the browser-side language is the baseline.
- **Typed outcomes:** the outcome table matches what I asked for, including the downloaded-reader fallback on unprefixed `/doc/<id>` and a retryable 5xx on prefixed routes.
- **Preferences:** private server rendering reads only the cookie, account sync goes through `/api/session`, a pending choice wins only for the same identity, and the cookie never initializes an account.
- **Other gates:** the experimental global 404 and the SWC/RTL compatibility checks are gates that can reject the design, and slice 3 moves routes in English only.
- **URLs and sitemap:** existing non-English public URLs are kept, the database sitemap is deferred, and translated-ritual activation stays gated on the other project.

## Findings

1. **Fix before slice 1: the `[locale]` allowlist would 404 every prefixed ritual.** This comes from my own original B4 suggestion. In Next 16.4.3, `dynamicParams = false` on any segment closes the whole route, not just that segment (`next/dist/build/static-paths/app.js:708-713`, `build/index.js:1876-1883`). So `[locale]/doc/[_id]` would return 404 for any ritual ID not generated at build time. That conflicts with plan lines 107-108, 143 and 219-220.
   - **Fix:** use `generateStaticParams` with `dynamicParams = false` only on the static localized pages. In the `[locale]` root layout, check the locale against the registry and call `notFound()` if it isn't listed. Leave the dynamic ritual page open.
   - **Proof:** add `/he/doc/<synthetic id>` returning 200, 404 and 5xx to slice 1.
   - The installed Next has an undocumented per-parameter alternative; don't rely on it.

2. **Product decision, not blocking: `Accept-Language` as the private fallback.** My B5 fix said "cookie only". The revision adds the browser's language as a fallback when no cookie is set (plan line 308). That means users who never chose a language would get Hebrew private screens once `he` is enabled, even with English filling the gaps (lines 288-289). Decide whether that is wanted at launch. If it stays, the static offline shell needs the same order (cookie → `navigator.languages` → English). Otherwise one user sees Hebrew online and English offline. Settle this in slice 5.

3. **Clarification for slice 2: how cross-root departures are detected.** The table names only the editor's "View ritual" link. App-bar, breadcrumb and other internal links out of the editor also leave its root. Have slice 2 work out which links cross roots from the slice 1 placement manifest, through one shared navigation helper, rather than handling each link by hand. The general rule in line 242 already requires this; only the mechanism is missing.

4. **Slice 8 contract detail, not blocking now: old non-English originals.** Say a ritual whose original public page at `/doc/<id>` is in Hebrew. Then `/he/doc/<id>` must redirect to that existing page or 404. It must not become a second page for the same edition with its own canonical URL. An English translation of such a ritual needs its own edition ID, because `/en` is never used. The rule that URL helpers use the resolver's canonical URLs (line 149) allows both; add these two cases to the slice 8 tests.

Separately, line 631 ("Focused re-review … pending") needs updating once you record this review.

## What's left

- **Technical proof gates (slices 1–3):**
  - routing across separate root layouts, plus the experimental global 404, under webpack and Turbopack;
  - Lingui's compiler plugin, or the fallback without macros;
  - switching between left-to-right and right-to-left in place without losing editor work;
  - the offline shell at its own URL and at `/doc/<uuid>`, including during a database outage;
  - navigation timings and the recovery-banner cost;
  - draft durability across full page reloads (slice 2);
  - matching English build output and headers after the move (slice 3).
- **Product decisions:** none block the proof. Still open: the browser-language default in finding 2, the optional per-language analytics event, and any future move of old non-English URLs, which the plan excludes.
