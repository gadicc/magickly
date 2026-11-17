# 086 — Internationalization and translated public rituals

Date: 17 November 2026. Base: `main` at `5cb48ea9`.
Status: foundation and initial Hebrew UI/public pages implemented in the
`codex/i18n-plan` worktree; local code verification and all documentation
screenshots passed. Translated ritual activation depends on the other project.
See the implementation record below.

## Product decisions

1. English public URLs stay where they are: `/`, `/about`, `/doc/<id>`.
   Existing public ritual URLs also remain valid, regardless of their original
   content language. New published language versions use a prefix: `/he`, `/he/about`,
   `/he/doc/<id>`. Keep existing slugs initially. No English URL migration.
2. Private working screens keep their current URLs. Their interface follows
   the user's saved preference, not a locale segment. Examples: `/temples`,
   `/doc/<id>/edit`, `/offline/ritual`.
3. New localized public reading URLs select an actual published language
   edition, and their surrounding interface uses that locale. Existing
   unprefixed public ritual URLs retain English controls and their actual
   content language; preserving them takes precedence over imposing a new
   language convention on old links. A private reader/editor can use
   Hebrew controls around English ritual text. Interface and content locales
   are separate values; a preference change never translates stored content.
4. Public URLs are authoritative even when they disagree with a preference.
   Opening an English public URL remains English. Do not redirect it based on
   cookies, browser language, country, or sign-in. An explicit language-switcher
   choice also saves the preference used on private screens; merely opening a
   localized link does not overwrite it.
5. Use Lingui through the installed Loom adoption workflow. Loom owns catalog
   tooling, not routing, locale policy, content or translation identities.
6. Begin with `en` and `he` as the supported UI locales. This is a rollout
   default, not a restriction on future languages. Publishing a translated
   page requires reviewed content and metadata; no blanket Hebrew copy of
   every English page with fallback text.
7. Preserve the existing privacy, access, offline, research-shell, diagram
   export and font contracts. This work creates no new translation grants,
   publication operations or automatic translation provider.

The ritual-translation project is being designed in another chat. This plan
owns its routing/SEO integration contract, not its storage or editorial model.
Foundation work can start independently; enabling translated ritual routes
requires that contract to be connected and verified.

During this planning pass, the concurrent draft
`plans/085-ritual-participants-and-localization.md` appeared in the shared main
checkout. Its decision 8/stage 4 proposes shared ritual structure, immutable
locale-specific message revisions and translation bundles identified by locale,
revision, source applicability and runtime capability. That is compatible with
this plan: the public adapter can resolve a localized view of shared structure,
not necessarily a separate ritual record. Return its compiled profile/runtime
capability and applicable source/translation revisions with the rendered view.
The draft is not yet an implemented or finalized dependency. The snapshot read
here has SHA-256
`02dceda0059fa5a4160ba93c1ec54e5a40f7184c2160b4488191c454afc9371d`.
This plan was renumbered from 085 to 086 to avoid that concurrent allocation;
the independent reviews refer to its earlier temporary number. App UI starts
with Hebrew; the other project's ritual translation pilot remains its own
choice, not an implicit commission of Hebrew ritual translations here.

## Planning baseline and constraints

- `loom.json`: Next App Router under `src/app`; pnpm tasks and dependencies
  in `package.json`; Loom 2.3.1, Next 16.4.3, MUI 9; Lingui is not active.
  The installed `node_modules/@gadicc/loom/skills/loom-lingui/SKILL.md` leaves
  locales, routing, fallbacks and content app-owned.
- `src/app/layout.tsx` supplies one `html lang="en" dir="ltr"` root and shared
  metadata. `RoutedSiteShell.tsx` and `SiteChromeLoader.tsx` isolate research
  from app navigation, recovery, analytics and worker registration. Preserve
  that isolation, including the deployment-wide research environment modes.
- `src/app/doc/[_id]/page.tsx` performs one anonymous public lookup, reused by
  metadata and rendering, and otherwise renders `PrivateRitualReader`. Deleted
  public rituals 404 before streaming; private/unknown identities share the
  generic shell. Legacy aliases and canonical UUIDs already have a resolver.
  The three bundled rituals have explicit static routes under `src/app/doc`;
  inspect these separately from the dynamic SQL reader.
- `src/seo/pages.ts`, `routeClasses.ts` and `metadata.ts` describe public,
  private and entity pages. Tests require every route to be classified. The
  root deliberately sets no canonical. `sitemap.ts` covers registry/entity
  pages and halls; public SQL rituals currently have no sitemap enumeration
  (recorded in plan 028).
- `src/analytics/insightsUrl.ts` allows public paths and redacts private IDs,
  invite passwords, queries and fragments. `VercelInsights.tsx` explicitly
  sets both path and route, and blocks research telemetry. Arbitrary public
  SQL ritual IDs are deliberately redacted too. Keep that boundary.
- `src/offline/privateRequests.ts` puts dynamic `/doc/...` responses ahead of
  Serwist's general cache. `src/doc/publicShells.ts` warms only allowlisted,
  anonymous, build-pinned HTML. It rejects cookie-varying/private responses.
  Locale prefixes currently bypass those path recognizers.
- `src/db/schema/userProfile.ts` is app-owned and currently has displayName,
  with no language setting. No preference storage or auth change is made by
  this planning task.
- MUI theme, app bar titles, breadcrumbs, date pickers, reader actions,
  recovery banners, errors and confirmations currently contain English UI.
  Search extraction and hardcoded links also assume current paths.

## URL and availability contract

| Kind | Example | Locale source | Search policy |
| --- | --- | --- | --- |
| English public page | `/about` | URL implies `en` | Existing canonical |
| Published Hebrew page | `/he/about` | URL `he` | Own canonical, language alternates |
| Existing public ritual / English edition | `/doc/<id>` | English UI; existing public edition keeps actual content language | Preserve existing public canonical |
| Hebrew public ritual edition | `/he/doc/<id>` | Public edition resolver requests `he` | Own canonical if published and anonymous |
| Private ritual read | `/doc/<id>` | Saved UI preference; content keeps its own language | Generic `noindex` shell |
| Private editor | `/doc/<id>/edit` | Saved UI preference | `noindex` |
| Indexed, personalized ritual list | `/gd/rituals` | Public English URL fixes UI to English | Existing index policy; network-only |
| Offline library and fallback shell | `/offline/ritual` | Static anonymous English shell, then browser preference | `noindex`; explicitly cacheable anonymous HTML |
| APIs, files, images, callbacks | Existing paths | Existing transport contract | No locale prefix |
| Research/operator routes | Existing paths | Existing isolated shell | No localization aliases in this rollout |

- Register supported locales centrally, with direction and catalog imports.
  Validate exact locale segments. Do not infer locales by stripping any
  two-letter first segment. Reject unsupported, doubled or malformed prefixes.
- `/en/...` was never published and is not introduced as an alias: 404.
  Reserve existing top-level segments against locale-code collisions (notably
  `gd`, which is also Scottish Gaelic). Add an explicit collision test; a future
  colliding language needs a separately agreed namespace.
  `/he/temples`, `/he/signin`, `/he/api/...`, `/he/chat/research` and prefixed
  editor routes do not become private/API aliases: 404 without metadata leaks.
- Missing, draft, withheld or inaccessible translations are not alternate
  pages. Return a real 404 with generic copy and links to publicly available
  editions where safe. Do not answer 200 with English under a Hebrew URL.
  A prefixed public-only lookup failure is a retryable 5xx, not a permanent
  404. Unprefixed mixed readers preserve the generic private/offline shell on
  lookup failure so downloaded rituals remain readable.
- The public language switcher links directly to available canonical editions,
  preserving query/hash state only where meaningful. Same-page private UI
  switches do not navigate or reset unsaved form/editor state. Do not blindly
  carry a translated heading fragment into an edition with different anchors;
  use stable block mapping if the translation project provides it, otherwise
  drop that fragment and explain the navigation in the switcher behavior.
- Do not add `?uiLang=` now. The switcher and saved preference cover the normal
  flow; a temporary per-tab override can be added later if support needs it.

### Ritual identity boundary with the other project

Do not assume the same ID belongs to every translation. The other project
must provide a server-only public-edition resolver with the equivalent of:

- Input: existing route identity (canonical or supported legacy alias) plus
  requested content locale.
- Output: a published anonymous edition with its canonical URL, actual content
  locale, title/rendered document, and an optional stable translation-family
  key; publicly visible alternate editions with their canonical URLs/locales.
- Distinct result cases: found edition; canonical redirect; not public;
  deleted public; unavailable due to a transient lookup failure. The resolver
  returns these outcomes without throwing from a root layout.
- A single request-scoped result shared by document language, page content,
  metadata and alternates. No global cache of per-request authorization.

Map these outcomes explicitly:

| Result | Unprefixed mixed reader | Prefixed public-only reader |
| --- | --- | --- |
| Found | Existing public edition, or mapped English edition | Requested published edition |
| Canonical redirect | Only a genuine existing public alias; preserve locale/content | Public resolver's canonical localized URL |
| Not public / missing | Generic private/offline reader, `noindex` | Generic real HTTP 404 |
| Deleted public | Real HTTP 404 before streaming | Real HTTP 404 before streaming |
| Unavailable | Generic private/offline reader, `noindex` | Retryable HTTP 5xx |

Do not add loading/Suspense boundaries that stream a successful response before
the prefixed reader's missing/private/deleted outcome is known. Infrastructure
errors must not prevent the unprefixed downloaded-reader fallback.

The output can use family IDs or distinct edition IDs; URL helpers consume
its canonical URLs instead of constructing sibling URLs by swapping prefixes.
Aliases redirect only after an anonymous public result exists. No lookup may
expose a private sibling's ID, title, existence or language. Preserve all
existing public `/doc/<id>` URLs, including any non-English originals, with
English controls and an accurate content-language boundary. For new editions,
non-English canonical URLs carry the locale prefix. Do not automatically move
old non-English public rituals to prefixed canonicals. Any later migration is
a separate product decision, outside this plan.

For a grandfathered Hebrew original at `/doc/<old-id>`, a request to
`/he/doc/<old-id>` either redirects to that existing public canonical or 404s;
it never creates a second self-canonical page for the same edition. An English
translation of that original needs its own stable unprefixed public route
identity, such as `/doc/<english-public-id>`. That identity can address a locale
revision of shared structure; it does not require a duplicated ritual record.
The translation project must supply this identity mapping before activation.
Test both cases explicitly; do not invent a generic `/en` exception.

Private edition selection belongs to the translation project. Its integration
contract must identify which editions the verified viewer may read, their
content locales and a distinct offline bundle identity per edition. This plan
only keeps UI switching independent of that selection. A database-backed public
ritual sitemap is deferred to plan 028/the translation project; it is not a
dependency for language routing or page-level alternate links.

## Rendering and routing architecture

Use concrete App Router routes and shared page/rendering modules. Do not add
an all-path locale proxy, a catch-all HTML renderer, or a second routing library.
A central publication registry associates a logical public page with its
available locales and canonical URLs; existing English URLs remain unchanged.
Thin localized route entrypoints reuse that page's renderer/data. Private,
technical and research routes stay outside that registry.

Correct `html` language/direction must be server-rendered, while English public
pages must not start reading preferences from cookies or sessions. Prefer
separate root layouts via route groups, sharing the existing metadata,
viewport, head assets and shell implementation:

- English public group: fixed `en/ltr`, preserving static generation.
- Localized public group: root under `[locale]`, allowlisted locale params,
  fixed URL locale; only registered translated routes exist.
- Private group: cookie-aware root, personalized/non-shared-cache output.
  Server rendering reads only the validated locale cookie/header, not an
  account/session lookup. Account synchronization happens in the browser.
- Offline-library shell: retain static anonymous English output in a root
  that never reads cookies, headers or sessions. `/offline/ritual` is both a
  library page and the response served at offline `/doc/<uuid>` URLs.
- Mixed unprefixed ritual reader: its own root at a point with ritual params,
  using the same non-throwing anonymous edition outcome as its page. Existing
  public renders remain cookie-free; the generic private shell may read only
  the preference cookie/header. Unknown and unavailable outcomes must not
  throw from this root or disable the downloaded-reader fallback.
  Keep the more-specific bundled English ritual routes static and cookie-free.

There is no common `src/app/layout.tsx` above these roots. Move only route
placement, extract one shared document shell, and preserve URLs and metadata.
Research gets an explicitly isolated root/shell; do not casually reuse the
ordinary site provider. Keep the deployment-wide research environment-mode
check in the shared document implementation, before ordinary theme/provider
side effects, so it applies to every root. Keep API route handlers, metadata
routes, static files, render endpoints and auth callbacks in their current
locations. Inventory their behavior without moving them. Prefer app aliases
for new shared modules.

Do not derive root placement from `PRIVATE_ROUTES`: it means search exclusion,
not authentication or rendering policy. `/gd/rituals` is indexed but personal
and remains English at its public URL, with its current network-only behavior.
Public unindexed pages such as the full Lenain text and `/gd/components` also
remain public English. The offline page is static, not cookie-personalized.
Slice 1 produces an explicit per-page placement manifest.

Without a shared root, unmatched URLs require Next's experimental
`global-not-found.tsx`/`experimental.globalNotFound`. This is a known design
risk, not assumed stable framework behavior. The proof must exercise it in
both bundlers. Share minimal document assets, fonts and theme initialization,
but mount no analytics, recovery graph or worker there. Each normal root also
gets not-found handling, and errors from roots get a minimal global-error
boundary without protected details. Validate `[locale]` against the publication
registry before content lookup. The proof revised this detail: roots return a
safe document and concrete pages call `notFound()` for unsupported values.
Use `generateStaticParams`/`dynamicParams = false` only on static localized
pages, not the locale root or dynamic ritual route: in installed Next 16.4.3 a
false value on any segment would also close runtime ritual IDs. Dynamic public
ritual pages stay open for request-time publication/access lookup. Prove a
supported-locale synthetic ritual returning 200, a missing/private one returning
404, and transient failure returning 5xx, while unsupported locales 404 before
any ritual lookup. Do not use an undocumented per-parameter fallback. If the
experimental dependency fails our compatibility gate, revise the root strategy
before doing the English-only route relocation.

Multiple root layouts cause full document navigations across those boundaries.
Keep the public reader and private editor in separate roots so public HTML can
be cookie-free and private HTML can render its preference correctly. This
tradeoff must pass the measured proof; do not silently accept broken drafts
or a recovery banner on every ordinary edit/read cycle.

| Navigation | Expected boundary | Required evidence |
| --- | --- | --- |
| English reference page to English reference page | Same root | Existing client navigation |
| `/gd/rituals` to dynamic `/doc/<id>` | Public to mixed-reader root | Document reload, recovery/session/worker startup measured |
| Dynamic reader to `/doc/<id>/edit` and editor View ritual link | Reader/private roots | Await durable draft flush before controlled departure |
| Private editor to another private working page | Same private root | State/draft preservation |
| Public English to Hebrew edition | Different public roots | One intentional navigation, correct server document locale |
| Private interface-language switch | Same route/root | No document reload; work preserved; server copy refreshed online |

Before any route split, make drafts safe across full document departures.
Current visual-editor saves debounce 400 ms and React unmount cleanup does not
run on a page unload. The recovery queue is memory-only. On app-controlled
cross-root departures, flush pending fields, await durable draft/recovery
persistence and only then navigate; keep the editor open with a recovery action
if persistence fails. Use one navigation helper driven by the placement manifest
for every app-controlled exit: View ritual, app-bar, breadcrumb, footer and
other links. Do not special-case only the editor's own button. Browser history,
reload and close also need the lifecycle protection below. While work exists
only in memory or a write is pending,
register a `beforeunload` warning and flush promptly on visibility changes or
`pagehide`. Those lifecycle writes are best effort, not guaranteed async saves;
do not claim they replace the controlled awaited flush. Cover source/split/
visual editors and browser back/reload/close. Accept browser limitations on
unload prompts, and minimize the at-risk window through durable edit writes.

The first implementation slice proves this layout split and draft protection
against installed Next under both bundlers, including `/offline/ritual` served
at `/doc/<uuid>`, database failure, 404s and global errors. Also prove Lingui's
SWC macro plugin against this Next/compiler version and a Hebrew/LTR Emotion
switch that retains editor work. If the plugin fails, use Lingui's supported
explicit message descriptors/core React API without macros until compatibility
is fixed; do not silently change Next or add a second translation library.
Record static/dynamic output, response headers and navigation timings before
moving the route tree. Cookie reads in public roots or blanket locale rewrites
are not fallback fixes. The installed Loom check currently requires the SWC
plugin in Next config even in precompile mode; a macro-free fallback therefore
also needs supported Loom configuration/additive upstream support. Do not fake
the plugin's presence or suppress a failing Loom check. If neither a compatible
plugin nor supported macro-free Loom wiring exists, report that proof gate as
blocked and propose the small shared-package change separately.

## Lingui, catalogs and content

Use `loom add lingui` during implementation and record the feature's actual
managed config. Prefer precompiled catalogs, because production builds use
webpack while development and the parity build use Turbopack. Inspect what
Loom scaffolds and preserve existing build steps; compile before framework
builds, typecheck and tests that import compiled catalogs. Keep generated JS
ignored and commit reviewed `.po` files. Use v6 package-specific macros.

- Use request-local Lingui instances for server rendering; never activate a
  process-global singleton across concurrent locale requests. Initialize every
  affected async RSC boundary explicitly as Lingui's current RSC guide requires.
- Provide the client locale/catalog from the server and scope private catalog
  activation to the mounted app. Switching must not lose work. Keep the editor,
  auth and offline providers stable where possible; if a subtree must remount,
  persist and restore its document, selection and scroll rather than discard
  them. Refresh server-rendered private copy online after changing the cookie,
  and invalidate stale locale-dependent router data; verify work survives
  `router.refresh()`. Offline, switch client-rendered UI only and refresh
  server-only copy on reconnect. Load the selected client catalog, not all future
  languages. Switching failed catalog loads keeps the old UI and offers retry.
- Extract UI strings and metadata with translator context, plurals and ICU
  interpolation. Do not concatenate translated sentence fragments or translate
  stored rituals, source code, Pug tags, IDs or schema keys as UI strings.
- UI-message fallback may use English with an appropriate local `lang/dir`
  boundary; content fallback never creates a published localized page.
  Launch-page UI and metadata must be complete before publication. A locale
  can be enabled for private UI before every public reference page is translated.
- Date/number formatting and MUI/MUI X locale text follow UI locale, while
  time zone, geographic location and astronomical calculations keep their
  existing independent settings. Locale alone does not choose a country.
- Keep reusable `magick-data` and `magick-components` packages free of an app
  Lingui runtime dependency. Add app presentation labels or an explicit package
  localization contract if a shared component needs translated text; never
  rename machine-readable values or change exported diagrams as a side effect.

Read the installed Lingui skill and Next docs before implementation. Macros,
loader and RSC APIs must be verified against the versions actually adopted.

## Private preference lifecycle

Add a nullable, validated `uiLocale` preference in app-owned user data through
an additive Drizzle migration, not in Loom-managed/auth tables. A null value
means no explicit choice. The exact column/table placement should follow the
current user repository; regenerate Valibot through `pnpm schema:gen`.

Private server rendering reads the validated browser preference cookie, then a
supported match from `Accept-Language`, then English. The static offline/client
resolver uses the same order with `navigator.languages`: cookie, released
browser-language match, English. Negotiate only among released private UI
locales; Hebrew joins that set after its private UI readiness check, not merely
when a synthetic catalog is added. This retains the browser-language default
already proposed in this chat, without selecting an unfinished UI automatically. It does not query the
account on every page. Cookie/browser state is the baseline; preference-aware
SSR is an online improvement over the static offline shell.

Account sync uses the existing settled identity flow and a separate
`/api/ui-locale` endpoint. The implementation proof found that old offline
clients require `/api/session`’s exact keys, so its response stays unchanged.
Never expose it through a public profile query, and never change auth grants
or allow locale sync to unlock the browser recovery gate. Copy a saved account
choice to the browser when identity settles, except while a newer explicit
choice for that same verified identity is still pending synchronization.
Null account preference leaves the browser choice alone; it does not write it
back. Only an explicit switcher action writes the account preference.

- A switch updates the browser immediately, then persists an authenticated
  account change through a same-origin authorized mutation. Only the current
  user's supported locale can be written. Upsert the app-owned preference row
  because not every user has a `user_profile` row. A failed save is visible;
  keep the browser choice and offer retry without claiming account sync.
- Serialize/coalesce rapid changes for the current verified identity so an
  older save cannot win after a newer one. Preserve a bounded pending locale
  marker scoped to that identity, separate from the locale-only cookie, so a
  reload does not overwrite an unsynced choice. Clear it after acknowledgement,
  sign-out or identity change. Do not retain or queue account mutations across
  identities; a late response from the previous identity cannot update the UI.
  Storage failure keeps the live tab choice and reports that persistence is
  unavailable instead of claiming reload durability.
- A browser choice inherited from a previous account must never initialize a
  new account automatically. On sign-in, a non-null account value wins unless
  that same account has a newer explicit unsynced choice. A null value keeps
  device behavior without creating an account setting.
- Store only a bounded locale value in the cookie, with `Path=/`, `SameSite=Lax`
  and Secure in HTTPS deployments, for one year. It is a preference, not an
  authorization token. A client-readable cookie permits offline UI switching;
  validate it everywhere. No secret or user identifier goes in the cookie.
- Keep the locale cookie on sign-out as a device preference; discard pending
  account sync state. Network absence keeps browser-only UI switching
  available, and sync retries only after the same identity is verified online.
  No language-setting operation initiates legacy recovery or account access.
- SSR and hydration start from the same locale/direction. Online private
  switches update the cookie and client catalog, refresh server-rendered text
  without a document reload, and invalidate stale router language output.
  Offline, the static English shell declares English until browser catalogs
  initialize; restore the browser locale before revealing private content.
  Never cache personalized HTML to eliminate that transition. If no client
  catalog is available offline, keep accurately labelled English fallback UI.

Use Loom auth/db skills for this implementation slice. Do not change Better
Auth session cookies, provider redirects, callback URLs or signing keys.

## Hebrew and bidirectional presentation

Set document `lang`, `dir`, MUI theme direction and the Emotion RTL cache
consistently. Use distinct stable cache keys for LTR/RTL, retain MUI's CSS layer
and server style integration, and test switching without hydration errors.
Portal dialogs/menus need direction too. Prefer logical CSS properties in
changed UI. Keep Ritual Pug/code/IDs and domain diagrams explicitly LTR where
appropriate; mirroring UI must not mirror temple east/west or exported art.
Ritual text has its own language/direction boundary, independent of controls.

Follow plan 079: Frank Ruhl Libre for standalone Hebrew letters/names/short or
large words; Noto Sans Hebrew for running Hebrew; no Noto Serif Hebrew. Reuse
self-hosted fonts and inspect fallback, wrapping, focus order, mobile menus,
forms, editor selection, reader role bubbles and print/export output in both
light and dark mode. Do not broaden the standalone font to all Hebrew text.

## Public SEO and publication

Extend current SEO helpers with explicit locale, canonical URL and public
alternate URLs. Keep one publication source of truth for routing, switcher,
metadata and sitemap so they cannot advertise different availability.

- Each actual edition has a self canonical, localized title/description,
  `og:url`, appropriate `og:locale`, sharing text and document language.
  Keep canonical metadata out of shared roots. Original-language source quotes
  and works keep accurate local language annotations.
- Reciprocal `hreflang` includes the page itself and all available published
  siblings, using absolute canonical URLs. Use language codes `en`, `he`, etc.
  Do not invent `en-US` or `he-IL`. Omit `x-default` initially; it is optional.
- Extend existing static sitemap rows with only available translations and
  alternates. Database-backed ritual enumeration remains deferred as noted in
  plan 028; it is not introduced by this work. When that project supplies it,
  enumerate only anonymous published editions, with a public revision field,
  paging and explicit failure behavior. Do not add production DB reads to
  builds. Publication/access/deletion changes must invalidate the affected
  public page metadata and alternate sets together now; future sitemap
  integration must use the same publication source.
- Missing/private translations have generic `noindex` metadata, no public
  canonical/alternates or title leaks. Existing deleted-public behavior stays.
  Do not block these routes in robots.txt in a way that hides their `noindex`.
- Existing social-image URLs may be shared where art is language-neutral;
  localized alt/text must be accurate. Add translated cards only when needed,
  not automatic image-path prefixing. API/file/render paths remain stable.

Translations are not published merely because a Lingui catalog exists. For a
long reference page, translation readiness includes body copy, headings,
metadata, meaningful link labels and necessary help images/captions.

## Analytics across languages

Keep page popularity independent of locale URLs. At the reporting boundary,
resolve through the publication registry to a stable language-independent
logical page path, then apply the existing privacy classifier/redactor. Exact
allowlisted prefix parsing is the fallback for untranslated or private paths;
never normalize arbitrary first segments. Check research exclusion both before
and after parsing, including prefixed attempts at research routes. Configure both Analytics `path`/`route` and `beforeSend`
URL consistently: `/about` and `/he/about` report `/about`. This preserves
historical English page series. Private paths keep current coarse buckets;
never add dynamic ritual IDs/family IDs to telemetry just because they are
public or useful for translation grouping. Research remains entirely excluded.

This deliberately combines the language versions in the standard page report.
It does not retain a per-language dimension. For launch, that is sufficient
for the requested combined popularity metric. If language readership is also
needed, add a low-cardinality `PublicPageViewed` custom event with an allowlisted
logical static page key and locale, after confirming the project's Vercel plan
supports custom events (Pro/Enterprise) and the data works in its dashboard.
Do not emit one custom event per private ritual or include names, IDs, query
values or invitation secrets. No plan upgrade is implied by this work.

Keep Speed Insights per-language for public pages, after applying the same
privacy/research classification and redaction. This preserves evidence of
Hebrew font and RTL performance differences; content popularity aggregation
belongs to Web Analytics. Preserve Speed Insights' sticky stop-after-private-
page behavior and research exclusion. Measure each navigation once; don't double count after catalog
activation or private preference changes. A real public language-switcher
navigation legitimately adds a second page view, even if both normalize to
the same logical page. Verify actual dashboard grouping on
a preview before claiming cross-language reporting works.

## Offline, service worker and site search

Before enabling any prefixed URL, teach the worker's privacy matcher to parse
supported locales, then classify the underlying path. Treat all dynamic SQL
ritual HTML/RSC, including public editions, as network-only as today; a public
ritual can later become private. Unsupported or malformed locale-shaped
private paths also fail closed rather than enter a generic page cache.
Update activation cleanup to remove any prefixed private entries from known
old caches; do not touch user bundles/recovery databases. No generic prefix
rewrite may turn a private response into an allowlisted public shell.

- Warm only explicitly bundled, published static ritual editions when their
  translated shell/assets exist in the same build. Cache identity includes
  locale and catalog/build revisions. Start with the existing English shells;
  do not make worker installation depend on unpublished translated content.
- Keep private offline bundle identities/authorization unchanged. UI catalogs
  required by offline controls must be available offline as static assets.
  Translated content bundles come from the translation project and are not
  synthesized from English. Preserve account/epoch revocation and blob cleanup.
- Review `ritualRouteIdentity`, `publicRituals`, early location path allowlists,
  app-bar/breadcrumb path logic and all hardcoded internal links for locale
  assumptions. Canonical identity parsing and HTTP URL parsing stay separate.
- Update search catalogue/build extraction and link generation deliberately.
  Launch can keep English search with a visible language label; Hebrew results
  must come from real translated content, use canonical localized URLs and
  never include private/draft text. Do not silently republish paid vector
  indexes or change search provider settings during i18n implementation.

## Implementation sequence and gates

Each slice is independently reviewable. No bulk translation or schema model
for ritual editions is authorized by this plan alone.

1. **Technical proof and placement inventory.** Produce the explicit per-page
   root manifest; do not reuse SEO privacy categories for placement. Prototype
   root routing/global 404s, macro-plugin compatibility and in-place RTL/catalog
   switching without losing editor work. Prove the static offline shell at both
   its own URL and a dynamic reader URL, including a DB outage. Measure the
   navigation table above, recovery banner/session/worker startup and static
   headers/build output under both bundlers. Record the experimental global
   not-found dependency and reject the split if these contracts cannot be met.
2. **Draft durability before route relocation.** Land controlled cross-root
   awaited flushes, durable recovery and lifecycle warnings/persistence. Test
   immediate navigation during the 400 ms visual-editor debounce, in-focus
   pending fields, failed storage, reload/back/close and restored source/visual
   state. No route split ships before this prerequisite passes.
3. **English-only root relocation and path boundaries.** Move pages into the
   proven groups, preserving English output/URLs and existing technical route
   locations. Update route-classification tests to ignore route groups and
   understand allowlisted `[locale]` templates. Land worker locale parsing and
   analytics privacy/research handling here, before any localized production
   route exists. Compare each route's static/dynamic classification and headers
   to baseline, anonymous bundled ritual shell headers and worker install. Test
   every root with each research environment flag and the research route.
4. **Lingui runtime and locale primitives.** Adopt via Loom, wire the proven
   macro or explicit-message path, catalog compile ordering, request/client
   runtime and publication registry. Extract shared shell/UI while preserving
   English. Synthetic Hebrew fixtures remain non-production until reviewed
   translations are ready. Preserve task runner and pinned tool policy.
5. **Browser language choice and RTL.** Implement cookie/client preference,
   direction/theme/cache switching, client catalogs and online server-copy
   refresh. Preserve editor/auth/offline state; test cached navigation and
   offline fallback. Account sync is not required for this slice.
6. **Account synchronization.** Add the nullable app-owned preference migration,
   separate current-user preference endpoint and authorized upsert. Test pending-save
   precedence, rapid changes, stale responses, missing profile rows, sign-out,
   reload, offline/reconnect and shared devices without adding per-page DB reads.
7. **UI strings and first public Hebrew pages.** Translate shared/private UI in
   bounded batches. Add reviewed `/he` and `/he/about`, switcher, localized
   metadata/static sitemap and combined Web Analytics. Keep English paths,
   indexing/cache policy and Speed Insights' per-language measurements. Enable
   additional pages only when their content and metadata are ready.
8. **Public ritual translation adapter.** Connect the other chat's distinct
   resolver outcomes, canonical edition mapping, publication/access/deletion
   invalidation and private edition/bundle identities. Test with synthetic en/he
   editions, distinct IDs, missing English, legacy non-English URLs, the prefixed duplicate of a grandfathered original,
   its English translation's distinct public identity, and private sibling isolation. Add localized public readers and alternates; no database
   ritual sitemap in this slice. Activate only after that project's real
   publication/access behavior exists.
9. **Broaden and release.** Translate remaining public pages in bounded batches.
   Review RTL/mixed scripts, original works, search labels, offline readiness
   and screenshots. Deploy through the existing workflow only when separately
   requested; monitor Search Console and Vercel reporting then.

Slices 1–7 can proceed without ritual translation storage. Slice 8 remains
blocked on the separate project's edition mapping and publication/access
contract. The first proof is implementation work, not evidence already obtained
by this planning task; it precedes any broad relocation.

### Acceptance evidence

- Unit tests for URL/locale validation, availability, canonical/alternate
  generation, preference precedence and redaction; no DB startup for pure code.
- Integration tests for preference authorization, null/default migration,
  concurrent identities, missing profile upserts and edition visibility. Use the Loom DB test boundary
  guidance; no production services or real user data.
- Render/navigation matrix: English/Hebrew × public/private/mixed reader;
  anonymous/signed-in; cookie/header disagreement; missing/draft/deleted/private
  editions; distinct edition IDs and legacy aliases; no-JS first HTML; RSC and
  prefetch; concurrent locales; real HTTP 404s before streaming; prefixed 5xx
  versus unprefixed downloaded-reader fallback on lookup failure; unmatched
  global 404s and errors; existing non-English canonicals. Assert correct text,
  `html lang/dir`, canonical/hreflang and no hydration mismatch.
- Browser flows: unsaved editor remains intact during UI switch; sign-in,
  sign-out, account switch and stale save; browser storage unavailable; offline
  reload/update, including the static shell served at `/doc/<uuid>`;
  controlled cross-root draft flush and `beforeunload` warnings; server-copy
  refresh and stale router locale data; original and translated content selection; query/hash links;
  mobile, dialogs, light/dark, keyboard and screen-reader language boundaries.
- Worker regressions: localized private HTML/RSC is never stored, public-shell
  warm-up remains anonymous/build-pinned and install succeeds with English
  alone, old cache cleanup preserves bundles, research mounts no telemetry or
  service worker even after localized navigation attempts.
- Analytics transport assertions: English/Hebrew same safe logical page;
  dynamic/private IDs and invite passwords absent; no query/fragment leakage;
  research absent; preference changes do not add page views. Preview dashboard
  check for the aggregation, separate from production release permission.
- Run formatting and reference checks for this plan only. For implementation:
  affected tests, `pnpm check`, `pnpm typecheck`, full tests/coverage, `pnpm build`
  and `pnpm check:turbopack`; preserve the existing CI package smoke gates.
  Run `pnpm exec loom check`, `pnpm exec loom skills check` and production
  wiring checks before release. Follow recorded task/env loading conventions.
- Regenerate affected documentation screenshots using
  `/usr/local/bin/magickli-docs-capture <worktree> <shots...>` and synthetic
  fixtures per `scripts/docs-screenshots/README.md`; commit them with each
  changed help/temple/list/editor/reader screen. Do not start a worktree server
  with the main checkout's `.env.local`.

### Rollout and rollback

English is the compatibility baseline. Use a small explicit publication
allowlist for localized public pages, not a global locale launch switch that
fabricates missing pages. The account migration is additive and nullable;
rolling back UI code ignores the new field. Keep old URLs and bundle formats.
Before launch, verify English canonical/sitemap output against the baseline.
After launch, roll back affected translations by removing them from publication
and alternates together; preserve appropriate redirects only for genuine moved
public editions and let withdrawn editions return the normal unavailable
status. Never redirect private links based on guessed public siblings.

## Outside references

Consulted 17 November 2026. These are references, not vendored copies; use the
installed framework/library version as the implementation authority.

- [Loom Lingui skill](../node_modules/@gadicc/loom/skills/loom-lingui/SKILL.md),
  [Loom review skill](../.agents/skills/loom-torvalds-review/SKILL.md),
  [auth skill](../.agents/skills/loom-auth/SKILL.md),
  [DB skill](../.agents/skills/loom-db/SKILL.md).
- [Installed Next internationalization guide](../node_modules/next/dist/docs/01-app/02-guides/internationalization.md)
  and [layout reference](../node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md).
  Its blanket locale-redirect example does not override our existing-English
  URL policy. Multiple roots reload the document between roots.
- [Lingui RSC guide](https://lingui.dev/tutorials/react-rsc): request-scoped
  instances and explicit server/client locale initialization.
- [MUI RTL guide](https://mui.com/material-ui/customization/right-to-left/):
  document direction, theme direction, RTL styling and portal boundaries.
- [Google multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
  and [localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions):
  distinct public URLs and reciprocal language annotations.
- [Vercel Analytics configuration](https://vercel.com/docs/analytics/package#beforesend)
  and [custom events](https://vercel.com/docs/analytics/custom-events): URL
  transformation and the optional Pro/Enterprise language-breakdown path.

## Independent review

Claude Code was invoked with `--model claude-opus-5-5 --effort high`, a fresh
context and only Read/Glob/Grep tools. Its initialization and final model usage
both reported `claude-opus-5-5`. It inspected the plan and actual source,
including installed Next/Loom docs, and ran no commands or implementation tests.
The [original review](086-internationalization-review.md) retains its original
line references; this revised plan has different line numbers.

| Finding | Disposition |
| --- | --- |
| B1 — document reloads can lose debounced drafts | Accepted: explicit navigation boundary table, awaited controlled flush, lifecycle warnings/durability, dedicated prerequisite slice before root relocation |
| B2 — cookie-aware offline shell breaks worker install | Accepted: static anonymous root exception; browser locale is baseline; test fallback served at a dynamic reader URL |
| B3 — lookup errors cut off downloaded readers | Accepted: typed non-throwing outcomes; unprefixed generic offline reader versus prefixed retryable 5xx |
| B4 — multiple roots need experimental global 404 handling | Accepted as an explicit technical proof gate, with local/global error handling, runtime root locale validation, static-only leaf generation and real pre-stream 404 tests |
| B5 — account/cookie precedence contradicts pending saves | Accepted: cookie-only private SSR, existing session-flow account sync, same-identity pending choice wins, no automatic account initialization from a shared cookie |
| B6 — SEO-private and rendering-private differ | Accepted: explicit placement manifest; indexed personalized `/gd/rituals` stays English/network-only; offline and public unindexed pages have separate policies |
| B7 — SWC macro compatibility unproven | Accepted: both-bundler compatibility proof first; supported explicit-message Lingui fallback if incompatible, subject to supported Loom wiring; never suppress Loom checks |
| B8 — missing English-only relocation slice | Accepted: separate gated relocation, route-test updates and worker/analytics classification before localized URLs; research flags tested in every root; early RTL proof |
| C1–C4 — edition outcomes, legacy URLs, private bundles, enumeration | Accepted: outcome matrix and private edition/bundle interface; existing public non-English URLs grandfathered; database sitemap deferred |
| O1–O8 — narrowing and edge cases | Accepted: no invented `/en` aliases; preserve work rather than prohibit every subtree remount; reserve locale names; registry analytics with research recheck; per-language Speed Insights; keep API/metadata handlers in place; separate browser/account/string slices; upsert absent preference rows |

The review's URL migration concern is resolved by retaining existing public
non-English URLs, consistent with the user's preference to preserve existing
paths. No new product decision or migration is required. The important technical
tradeoffs are explicit: document reloads across roots, an experimental global
404 dependency, and browser-only localization of static offline shells. These
must pass slice 1 before a route relocation ships.

The focused Opus 5.5 high re-review closed B1–B8, C1–C4 and O1–O8, then
corrected its own B4 recommendation: a locale-root `dynamicParams = false`
would incorrectly close all runtime ritual IDs. This plan now validates the
root locale at runtime and limits static-only generation to static pages,
with explicit 200/404/5xx dynamic-reader proof cases. Its other clarifications
are incorporated: one manifest-driven navigation helper covers all editor
exits; server/offline browser negotiation uses the same released-locale order;
and grandfathered non-English originals cannot gain duplicate canonicals.

The final editorial pass also recorded the concurrent translation draft and
clarified that a macro-free fallback must be supported by Loom's checker,
which currently expects the SWC plugin. These narrow the proof gates without
claiming runtime success or changing the chosen URL policy.

Ready to begin slice 1's technical proof. No product decision blocks that
work. Passing the architecture/compatibility proof is required before broad
route relocation; translated ritual activation still awaits the other
project's contract. No application code changed.



## Implementation record — 17 November 2026

The implementation lives in the existing worktree on `codex/i18n-plan`.
No deployment, provider configuration, remote index publication or production
migration has been performed.

- **Slices 1–2:** the isolated proof passed all six webpack/Turbopack normal,
  local-research and operator-research builds and browser checks. Both editors
  now guard controlled departures and wait for durable local drafts/recovery;
  lifecycle warnings remain best effort for browser unload. Synthetic screenshots
  and targeted editor tests cover the original editing modes.
- **Slice 3:** moved the explicit page inventory into independent roots, retaining
  technical handlers and UI modules at their original source locations. Search
  extraction understands route groups. The English-only prerender route sets
  matched the saved baseline, and public prose remained byte-identical. Added
  minimal global/root error and not-found documents.
- **Slices 4–6:** adopted Lingui through Loom in precompile mode, pinned the
  compatibility-tested versions, added request-local/client runtimes and stable
  MUI RTL caches, browser preferences, offline restoration and server refresh.
  The additive app-profile migration and private current-user endpoint are
  implemented; account saves serialize/coalesce and fence identity races.
- **Slice 7:** initial Hebrew catalogs cover navigation/core private controls;
  remaining explanatory/recovery copy retains explicit English boundaries.
  Published static home/About editions have their own metadata, reciprocal
  canonical alternates and sitemap entries. English Web Analytics aggregates
  translated editions; Speed Insights retains their language paths. Worker and
  analytics privacy parsing were updated before adding localized routes.
- **Slice 8 remains gated:** no translated ritual URL is published until the
  other project supplies actual edition mapping/publication/access behavior.
  `/he/doc/<id>` currently 404s. Existing public ritual URLs remain unchanged.

Implementation details and operating instructions are in
[`src/i18n/README.md`](../src/i18n/README.md). Verification evidence is kept under
ignored `output/i18n/`; the final results are recorded below after completion.

### Findings addressed during implementation

1. Installed Next cannot wrap a failure thrown by a root layout in that root's
   own not-found boundary. Safe roots now leave rejection inside concrete pages.
   Runtime 404 HTML can use Next's generic error shell; the fixture verifies the
   real 404/noindex and browser fallback, without claiming meaningful no-JS body
   content for that framework error response.
2. Installed offline clients parse `/api/session` with an exact-key check.
   Preferences therefore use a separate endpoint, preserving the old protocol.
3. MUI initializes its streamed Emotion cache once; changing options alone does
   not change direction. A context-aware cache provider retains the streamed
   cache and creates a distinct client cache on the first direction switch.
4. UI strings serialized in catalog scripts made screenshot `body.textContent`
   waits match before the intended screen existed. Capture waits now inspect
   visible `innerText`. The root-owned capture helper also needs ephemeral
   development-only sealing keys to show the forum form; its reviewed update
   does not read deployed keys.
5. The research migration rehearsal deliberately requires the old catalog to
   stay unchanged. It remains scoped through migration 0026; a separate installed
   migrator test proves populated profile preservation, nullable defaults, locale
   constraints, idempotent reapplication and the existing cascading foreign key.
6. Next 16.4.3 interrupts first production builds with existing dependency
   advisories. The exact build passes on retry; this does not remediate them.
   Official patch releases include fixes, e.g.
   [Next 16.4.5](https://github.com/vercel/next.js/releases/tag/v16.4.5).
   A framework upgrade is separate from the i18n parity check and should precede
   deployment.


### Final local verification

- Full suite: **622 files passed**, 3 skipped; **12,171 tests passed**, 18
  skipped. This includes real SQL repository and populated-profile migration
  tests, strict old-session compatibility, controller identity/write races,
  both editors' departure protection and semantic-editor language/refresh
  preservation of field nodes, source selection, scroll and unsaved content.
- `pnpm typecheck`, `pnpm check`, strict `pnpm i18n:check` (278 catalog entries),
  `loom check` and `loom skills check` passed. Existing lint/recommended-skill and
  protected-HTTP OIDC advisories remain; no unrelated adoption was performed.
- Final webpack and Turbopack production builds passed. Both retain all previous
  prerendered URLs and add only `/he` and `/he/about`. English JSX prose remains
  byte-identical, and the existing published embedding-manifest tests pass.
- `pnpm i18n:verify-app webpack` passed 17 HTTP/worker checks and actual Chromium
  navigation. Cookie disagreement leaves public documents URL-authoritative;
  private HTML is private/no-store; the offline shell is anonymous/cacheable;
  unsupported/prefixed private routes are real 404s. With Chromium offline, a
  synthetic dynamic UUID URL received the installed worker's anonymous fallback
  and restored Hebrew controls. No hydration errors were recorded.
- `pnpm i18n:verify-app turbopack` passed 15 HTTP checks and the same browser
  locale/navigation checks. The worker is built/validated through webpack;
  Turbopack remains a framework parity build. Hebrew desktop/mobile and light/
  dark screenshots were captured, inspected, and passed the mobile overflow
  assertion. Outputs are ignored local evidence, not published screenshots.
- The installed helper regenerated **all 19 synthetic documentation screenshots**;
  all were visually inspected. Twelve image files changed. The operator updated
  the root-owned helper to the reviewed version that creates its own ephemeral
  development-only sealing key. The forum form now captures successfully and
  its image is byte-identical to the existing one. Its readiness check targets
  the actual form input rather than button copy: visible `innerText` reflects
  CSS uppercase, and an existing connection can use Update instead of Connect.
  No deployed key was read or generated.

The branch is not deployed, migrations have not been applied to any deployed
or shared development database, and no remote analytics/search settings were
changed. The temporary docs capture only seeded the existing authorized local
synthetic fixtures. Translated ritual activation and broader translation
batches retain their separate dependencies. Existing Next patch advisories
remain a release prerequisite, not an i18n regression.
