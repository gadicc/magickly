# Interface languages and public editions

Plan [086](../../plans/086-internationalization.md) records the decisions and
independent review. English public URLs stay unchanged. The available
Hebrew pages are `/he`, `/he/about` and `/he/books`; `publications.ts` is the
closed list of available static editions. A UI catalog never publishes a translated ritual.

## Rendering boundaries

`src/app/Document.tsx` supplies the shared document. Route groups select fixed
English, URL-selected Hebrew, cookie-aware private, mixed ritual-reader,
anonymous offline, or isolated research rendering. There is no common root
layout above them. Technical/API routes remain at their original URLs.

Private roots read the validated language cookie, then `Accept-Language`, then
English. They never query account preferences to pick a language. The mixed
reader shares its nonthrowing anonymous public lookup with metadata and the
page: public content keeps English controls; other outcomes keep the private
or downloaded-reader fallback. A deleted public ritual is rejected inside the
page. The offline root reads no request cookies/headers and stays prerendered
English. Its browser provider restores the preference before revealing private
content. Research deployments and the research root mount no locale/account
provider, recovery graph, analytics or worker.

Multiple roots require a document navigation between reader/editor/reference
screens. `doc/draftDeparture.ts` guards all controlled anchor departures, awaits
local durability and leaves the editor open on failure. Pending fields flush
before that check. `beforeunload` warnings and lifecycle writes cover the
remaining in-memory window; asynchronous page-unload writes are best effort.

## Catalog workflow

Use the pinned project pnpm on Node 24:

```sh
pnpm i18n:extract
# Review/edit src/locales/{en,he}/messages.po.
pnpm i18n:check
pnpm typecheck
pnpm test --maxWorkers=4
pnpm build
pnpm check:turbopack
```

After a matching production build, `pnpm i18n:verify-app webpack` or
`pnpm i18n:verify-app turbopack` runs the real app on a free loopback port with
synthetic credentials and an unreachable synthetic database. It refuses a
worktree containing `.env` files, since Next would load them itself. The gate
checks locale/cache/404 behavior and browser navigation, captures Hebrew
mobile/desktop light/dark views, and (webpack) exercises the installed worker's
real offline UUID fallback. It does not prove an authenticated account save
against a deployed database; the API, SQL upsert and migration have separate
route/controller/PGlite tests. Reports/screenshots stay under ignored
`output/i18n/`.

Loom owns extraction/compilation wiring in precompile mode. Generated
`messages.js` catalogs are ignored. Build, dev, typecheck and app test tasks
compile before importing them. The tested compiler versions are recorded in
`scripts/i18n/README.md`; both Next bundlers load the Lingui SWC plugin.

Production presentation currently uses Lingui's explicit core/React API and
`/*i18n*/` literal extraction, which also works in Vitest. UI messages use
complete source strings as IDs. `UiText` accepts a message or literal children
and optional ICU values. Literal children preserve the existing public JSX
search extraction for shared reader labels; do not teach search to read
arbitrary props or evaluate private modules. Public metadata extraction has a
parity test against the established English SEO copy.

Every mounted provider and server translator has its own Lingui instance.
Never activate a process-global locale. `LocaleTheme.tsx` preserves MUI's
streamed initial Emotion cache and CSS layer, and switches between stable
LTR/RTL caches without remounting editors. Stored source, diagrams and ritual
text never take their language from UI preference. Legacy ritual revisions
lack a content-language field; their content boundary declares an unknown
language and preserves the original reading direction until the other project
supplies an explicit edition locale. Hebrew headings/short labels use Frank
Ruhl Libre; running text uses the existing self-hosted Noto Sans Hebrew.

The initial catalog covers navigation and core sign-in, temple, editor and
offline controls. Untranslated explanatory and advanced recovery copy remains
explicitly English through `EnglishText`/`UiText` fallbacks. Translate complete
sentences with ICU interpolation/plurals in later batches, rather than
assembling translated sentence fragments. Public pages share their components and whole-message Lingui copy between
English and Hebrew. `UiRichText` keeps links/formatting in code-owned React
components; translations may reorder placeholders but cannot set their URLs or
attributes. Streamed React elements are normalized through the public children
API before Lingui clones them. `PublicLink` retains the selected language where a destination has an
available edition, otherwise it keeps the original destination. Source works
linked from the Books index retain their own language.

The drawer contains the native-name language setting; decorative emoji flags
appear in its choices. An unavailable public edition is disabled with an
explanation and a link to the Hebrew homepage. Private language changes still
preserve mounted editors and drafts.

## Account preference

Migration `0028_ui_locale` adds nullable `user_profile.ui_locale` with
an `en`/`he` check. It changes no auth table, session response or grants. Apply
it through the existing reviewed release migration workflow before activation;
implementation does not migrate any deployed database. The populated-profile
upgrade and repository upsert are covered with PGlite.

`/api/ui-locale` reads only the fresh current session, rechecks its identity,
and returns private/no-store responses. POST requires a same-origin bounded
JSON request and the expected current account. It upserts a missing profile,
preserving the display name. `/api/session` retains its exact old shape for
already-installed offline clients.

Only explicit choices write account state. A settled account can hydrate its
saved choice into this browser; null leaves device behavior alone. Serialized,
coalesced writes and identity/action generations fence delayed responses.
One bounded pending action is retained in session storage for the same account,
and discarded on sign-out/account change. Failed synchronization is visible
and retryable. Language settings never unlock legacy recovery or account data.

## Privacy, SEO and integration limits

Web Analytics merges the two published language URLs under their existing
logical English paths. Speed Insights retains the per-language public path.
Private IDs, invite secrets, queries/fragments and unsupported routes stay
redacted. Research URLs stay excluded even behind malformed/unknown prefixes.
The worker puts prefixed private/API/SQL-reader requests ahead of generic
caches, and never serves an English offline UUID fallback for a prefixed URL.

Hebrew routes currently carry `noindex, follow`, retain self-canonicals and
localized sharing metadata, and are excluded from sitemap and language alternates.
`LOCALIZED_SEO_ENABLED` in `publications.ts` gates search discovery independently
of route availability. Existing English indexing stays enabled. `/en` aliases and locale-prefixed
private/technical aliases return 404. No language/country-based public redirect
is installed. Existing English search and embedding artifacts remain unchanged;
no remote index or analytics provider configuration is changed.

`/he/doc/<id>` remains unpublished and returns 404 until the ritual translation
project supplies the public-edition resolver and publication/access/revision
contract in plan 086. Connecting that resolver and publishing additional page
translations are later bounded slices, not invented storage in this change.


## Routine maintenance and final SEO launch

Follow the translation workflow in `AGENTS.md` and
`scripts/i18n/README.md`: extract, translate the delta, review, check, compile and
verify the affected screens. CI runs `pnpm i18n:check` without AI credentials.
The homepage, About and Books index are the initial shared-component batch;
other public articles and advanced interface copy still need localization in
later batches. A translated navigation shell never implies a translated source
work or ritual.

Search launch is the final, separately requested step, after the intended page
batches are ready. Before enabling it:

- Review Hebrew prose, navigation, title/description, alt text and phone/desktop
  RTL views, including source-work language boundaries and unavailable links.
- Pass extraction sync, translation validation, tests, typechecking, both builds
  and real-browser switching/offline checks. Resolve remaining fallback copy on
  every route intended for indexing.
- Confirm each available route has accurate content, a self-canonical, reciprocal
  language alternates and an English `x-default`; private and unsupported aliases
  must still return 404/noindex.
- Enable `LOCALIZED_SEO_ENABLED` only in that final change, update the explicit
  SEO-gate tests/runtime assertions to verify the enabled behavior, and inspect
  rendered metadata plus sitemap. Do not block crawling in robots.txt: crawlers
  must be able to read the current noindex directive.
- After the reviewed deployment, verify the deployed HTML and sitemap before
  requesting search-engine discovery. No Search Console submission is automated.
