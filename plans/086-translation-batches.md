# Remaining Hebrew translation batches

Companion to [plan 086](086-internationalization.md), inventoried on
18 November 2026 against main at `bf4db692`. This is an implementation plan,
not a claim that the batches below have been translated or browser-verified.

Hebrew search discovery stays disabled throughout these batches:
`LOCALIZED_SEO_ENABLED = false`. Available Hebrew editions remain usable,
`noindex, follow`, and absent from the sitemap and hreflang alternates.
Enabling discovery needs a separate, explicit final launch request.

## Baseline and inventory method

- There are **73 page route templates**: 53 public, 14 private, three localized,
  one mixed ritual reader, one anonymous offline shell, and one research page.
  A dynamic template represents a family, not one rendered URL. API routes,
  layouts, loading/error boundaries and imported components need separate review;
  they are not counted as additional pages.
- The three available Hebrew public editions are `/he`, `/he/about` and
  `/he/books`. Together with their English originals, these occupy six of the
  73 templates (C0 below). Availability does not imply SEO activation.
- Each current catalog has **337 active messages**, with no empty or fuzzy
  entries at the inventory snapshot. That measures extracted messages only;
  it does not measure page translation coverage or linguistic quality.
- There are **41 explicit `EnglishText` JSX blocks across 16 production files**.
  These are a known backlog, not the entire backlog. Unmarked JSX, attributes,
  message builders, validation results, table data and SVG labels also contain
  English. Repeated fragments are not independent translation units.
- Every existing page template is assigned exactly once in the route ledger.
  Of the 50 public templates without Hebrew editions, 43 are assigned to T2–T11;
  seven source-work templates have a separate S1 decision.
  All 14 private templates, the reader and offline shell also have assignments.
  Research is intentionally excluded as X1.

The inventory used TypeScript syntax inspection of production TS/TSX, manual
inspection of route entrypoints and their presentation imports, the existing
[route inventory helper](../scripts/i18n/inventory.ts),
[route placement registry](../src/i18n/routePlacement.ts), and
[available editions](../src/i18n/publications.ts). Catalog counts were read using
the installed Lingui PO formatter. No app modules, database rows, private content
or translation provider were evaluated to make this inventory.

This is a source-based baseline, not an exhaustive runtime text crawl. At the
start of each batch, inspect its reachable components and exercise its loading,
empty, success, failure and permission states. Record any newly found copy in
that batch before calling it complete. Do not equate a zero-candidate catalog
or removal of `EnglishText` imports with a fully translated screen.

## Scope and language boundaries

Translate first-party interface text, explanatory prose, labels, status messages,
accessible names, alt text, captions, page titles/descriptions, share metadata,
and app-owned descriptions of data. Translate complete messages with named
interpolations and ICU plurals; keep links and formatting code-owned.

Do not translate IDs, URLs, slugs, API status codes, query-state values, source
syntax, property names, licence identifiers, author names, or the authoritative
source spelling of names. Present localized labels beside stable IDs. Reuse
reviewed Hebrew in the catalog, including the established terms for magick,
Golden Dawn and ritual; maintain translator comments for ambiguous terms.

Source titles, quotations, French Lenain text, Enochian/Latin/Hebrew originals,
dictionary glosses, machine-generated English analysis and stored rituals have
their own language and provenance. Give them accurate language/direction labels
and explanations. Do not disguise untranslated first-party prose as a quotation
or declare a whole unreviewed data table exempt. For data-backed pages, list
which fields are source material, which already have Hebrew, and which need
curated Hebrew presentation values before publishing the route.

Keep reusable packages independent of app Lingui. Where a drawing or widget
needs translated text, first use an existing label/value input. If insufficient,
design a small optional label contract with unchanged English defaults and
package tests; do not copy package internals into the app or rewrite canonical
data. This work belongs to the first batch that needs the capability.

## Ordered batches

All T batches are pending. Route counts refer to the existing templates in the
ledger, not the future Hebrew entrypoints. Each sub-batch is a reviewable unit;
do not turn a whole reference section into one large translation commit.

| Batch | Existing templates | Concrete delivery | Dependencies |
| --- | ---: | --- | --- |
| T1 | 6 | Shared shell/search, sign-in, memberships, temple administration and forum copy | Current foundation |
| T2 | 7 | Ritual list, access/deletion, editors, uploads, reader/offline and recovery copy | T1 shared messages |
| T3 | 2 | Temple help and Ritual Pug guide, with matching localized screenshots | T1–T2 terminology and UI |
| T4 | 3 | Study list, quiz, set information, progress and scheduling labels | T1 shared states |
| T5 | 6 | Astrology prose, tools, location picker and planet entities | Shared presentation adapters |
| T6 | 7 | Kabbalah prose, tree controls, entity fields and 72-angels interface | T5 entity/data-label conventions |
| T7 | 3 | Geomancy prose, casting workflow and reference interface | T4/T5 plurals, dates and controls |
| T8 | 12 | Golden Dawn reference, symbols, sigils, halls and hall editor | T2 editor and T6 drawing conventions |
| T9 | 5 | Enochian site prose and dictionary, Keys, tablets and translator interfaces | Shared source-language rules |
| T10 | 5 | Open-source pages, table documentation and component explorer | Drawing/data presentation contracts |
| T11 | 3 | Public chat interface and ordinary admin/training screens | T1 errors and T2 upload conventions |

### T1 — Shared shell, sign-in and temples

Split into T1a (shared shell/search/sign-in), T1b (join/create/leave and member
editing), and T1c (invitations, forum settings and sync feedback).

Primary code: `src/app/MyAppBar.tsx`, `pathnames.ts`, `siteNav.ts`,
`src/search/SearchDialog.tsx`, `src/i18n/AccountLocaleSync.tsx`,
`src/app/signin/SignInButton.tsx`, the six private route entrypoints, and
`src/app/temples/` components/actions. Existing translated buttons and recovery
banners are retained; finish their surrounding sentences and missing states.

- Replace the sign-in and membership sentence fragments with complete rich
  messages. Include temple/member interpolation, grade counts, confirmation
  titles, accessible table/action labels and the forum explanation.
- Review server-action and result messages displayed by forms or `error` query
  parameters. Map app-owned failures at the presentation boundary using stable
  outcomes; do not translate arbitrary URL text or change authorization logic.
- Finish search title, loading/failure/no-result/count feedback and any missing
  shell actions. Search results and the current index remain English; explain
  the content language accurately. This batch does not build multilingual
  embeddings or change the search provider.
- Verify anonymous/member/admin views, revoked access, account preference save
  failure/retry, form failures, long names and Hebrew mobile confirmations.
  Ordinary private routes keep their URLs and cookie/account language choice.

### T2 — Ritual work, safety messages and offline recovery

Split into T2a (catalog/access/delete/restore/purge), T2b (source and semantic
editor messages, visual/task controls), and T2c (uploads, reader and offline
recovery). Translate safety copy before polishing secondary editor controls.

Primary code: the ledger's seven entrypoints; `src/app/gd/rituals/SqlDocAdmin.tsx`,
`DeletedRitualUndo.tsx` and `deleted/{RecentlyDeletedList,PurgeRitualDialog,format}`;
`src/app/doc/[_id]/edit/{SqlDocEdit,semantic/*}`;
`src/doc/{RitualVisualControls,TaskSettings,ritualBlocks/renderForEditing}.tsx`;
`src/doc/gdHallEditor/`; `src/lib/upload.tsx`;
`src/app/doc/[_id]/{DocRender,PrivateRitualReader}.tsx`; and
`src/app/offline/ritual/`. Include dependent status/validation builders, not just
the components rendering their strings.

- Translate full access/publication/revocation and deletion/retention warnings,
  including the 14-day offline boundary, purge states and recovery choices.
  Preserve exact policy meaning, dates/time zones and irreversible-action scope.
- Review unmarked `UiText` inputs, dynamic strings, direct alerts, parser/import
  reports, line-number actions, attachment failures, save/publication results,
  download status and recovery/export instructions. Keep diagnostic codes,
  Ritual Pug, file contents and stored document text intact. Localize app-owned
  explanations; label any retained raw technical diagnostic separately.
- Use locale-aware formatting for displayed dates/counts; keep persisted
  timestamps and protocol values unchanged. In particular, `deleted/format.ts`
  currently builds English sentences with `en-GB` dates.
- `/gd/rituals` is publicly addressed but personalized and request-scoped.
  Its Hebrew edition must preserve authenticated SQL grants and dynamic/cache
  behavior. Translate its UI without translating ritual titles or claiming
  Hebrew ritual editions. Never statically export private catalog rows.
- The mixed `/doc/[_id]` reader retains its current public/private language
  policy. This batch translates its control messages under the existing
  provider; it does not make a public ritual follow a cookie or add `/he/doc`.
- Keep `/offline/ritual` anonymously prerendered. Its browser provider restores
  preference; do not read cookies/headers in its server root or create prefixed
  offline/private aliases. Essential controls must work after cold offline load.
- Verify same-document language changes preserve editor DOM, unsaved work,
  pending fields and selection. Exercise failed saves, legacy conversion,
  restore/purge, lost access, attachment retry, offline/reconnect and download
  expiry with synthetic fixtures. Retain durability/identity fences.

### T3 — Help and screenshots

T3a translates `/help/temples`; T3b translates `/help/ritual-pug` after the editor
terms settle. Extract shared page bodies and use complete rich messages for
steps, warnings, captions and metadata. Keep code samples literal and LTR.

The temple guide currently imports 19 English screenshots. Add an explicit
locale-aware capture/asset selection through
[the existing screenshot workflow](../scripts/docs-screenshots/README.md),
then generate synthetic Hebrew screenshots matching the translated interface.
Preserve English assets for the English guide. If the capture helper changes,
its reviewed installed version must match before worktree captures are run.
Do not hand-edit text into images or reuse real temple/member data.

Verify both guides' navigation, linked actions, phone layouts, screenshots and
alt text. Publish `/he/help/temples` and `/he/help/ritual-pug` only when their
instructions and screenshots describe the actual Hebrew UI.

### T4 — Study

T4a covers the list and set information; T4b covers quiz controls and state
messages. Inspect `src/app/study/study.tsx`, `src/app/study/[_id]/studySet.tsx`,
`src/app/study/[_id]/StudyQuiz.tsx`, `src/app/study/info/[_id]/info.tsx`,
and `src/study/sets.tsx`.

Translate filters, headings, cards/counts, relative due dates, scores and
anonymous/account synchronization warnings. Keep set/card IDs, answer matching,
scheduling and stored progress unchanged. Question/answer content needs an
explicit per-set language decision: translate interface labels and descriptive
set names, but do not silently change what a vocabulary drill tests.
Keep a stable display-label map separate from IDs/data. Check date-fns locale
selection and complete sentences such as “in {duration}”, rather than English
prefix concatenation.

`/study` has a public root and needs a real `/he/study` edition for Hebrew there;
the quiz and information routes remain private at their current URLs. Verify
cross-root links, anonymous/account separation, offline progress, save failures,
zero due cards, plurals and a language switch during a question.

### T5 — Astrology

T5a covers the hub, Moon and planetary hours, including `AstrologyText`,
`moon/MoonText`, `planetary-hours/PlanetaryHoursText`, their interactive bodies
and `src/geo/PlacePicker.tsx`. T5b covers planet/zodiac lists and the planet
entity template (`planet/[id]/Planet.tsx` and `planet/Intelligence.tsx`).

Translate time/location/loading/failure labels, prose and app-owned table fields.
Audit `magick-data` values and widget labels: use existing Hebrew fields where
appropriate and record any missing display mappings. Preserve planetary IDs,
source names, sigils and calculations. Location names and attributions keep
their source identity. Verify hemisphere, polar/no-sunrise states, timezone/date
formatting, detected/selected place, mobile tables and accessible SVG text.

### T6 — Kabbalah

T6a covers the hub/tree and Sephirah/path entities; T6b covers YHVH, the angels
list and angel entities. Primary code: `KabbalahText`, `tree/{TreeText,tree,
treeSettings}`, `sephirah/[id]/Sephirah`, `path/[id]/Path`,
`yhvh/72angels/{AngelsText,angels}`, and `angel/[slug]/Angel` under
`src/app/kabbalah/`, plus shared `src/ui/entity/` navigation/table labels.

Translate complete explanations, controls, field labels, date names and
app-owned derived descriptions. Inspect rendered `.en` fields, ordinals,
colour names, correspondences and labels emitted by reusable drawings. A page
is not ready merely because its table headings are Hebrew. Reuse existing
Hebrew names; supply reviewed mappings for remaining translatable display
values. Preserve IDs, transliterations, sacred text and cited French/English
source excerpts with explicit language boundaries and localized captions.
Source-derived translations need provenance, not a blanket UI-catalog rewrite.

Verify one normal and one exceptional/optional-data entity per family, all
tree modes, long names, source links, previous/next links and mixed-script
diagrams. Keep existing English rendering and source-book destinations intact.

### T7 — Geomancy

T7a covers the hub/reference (`GeomancyText`, `reference/{ReferenceText,
reference}`); T7b covers `reading/{ReadingText,reading}` and its dialogs/results.

Translate first-party explanations, form prompts, cast instructions, house/figure
display labels and generated reading/status sentences. Classify the quoted
reference table and its source-derived meanings separately; a translated
caption does not make an English interpretation Hebrew. Keep Latin figure
names available as source identifiers and supply Hebrew explanations where
needed. Preserve stored/share URL values, random/casting rules and diagram
orientation. Verify every casting mode, validation, incomplete/read-only/shared
states, counts and narrow-screen reading layouts.

### T8 — Golden Dawn reference and halls

T8a covers the hub, grades, grade entities and components; T8b covers symbols
and sigils; T8c covers hall index/entities; T8d covers the public hall editor.
Primary code: `src/app/gd/GoldenDawnText.tsx`, `grade/[id]/Grade.tsx`,
`symbols/`, `sigils/`, and `halls/{HallsText,HallIndex,TempleHallTabs,
TempleHallsPanel,[slug]/HallPage,editor/HallPlayground}`.

Translate prose, grade/officer display labels, source notes, drawing titles,
exports, editor warnings and controls. Follow the shared drawing-label contract;
do not mutate authored hall source, names, composable tags, enum values or
source-citation identities. Localize human-facing diagnostics at the app
boundary and keep their machine values stable. T2 covers embedded ritual hall
editor safety controls; T8 completes broader reference/drawing vocabulary.

Verify public and authorized temple hall views, offline hall selection, share
URLs, invalid source, all export formats, translated attribution sentences with
unchanged licence/credit requirements, mixed text and diagram orientation.
Downloaded SVG/PNG labels and accessibility text need review as well as HTML.

### T9 — Enochian interface and site prose

T9a covers the hub and dictionary; T9b covers Keys/tablets; T9c covers the
translator. Inspect `src/app/enochian/{EnochianText,dictionary/DictionaryText,
keys/KeysText,tablets/TabletsText,translate/TranslatorText}`, their interactive
components, and both `dictionary/labels.ts` and `translate/labels.ts`.

Those label modules intentionally keep controls out of searchable prose.
Preserve that separation while converting message functions, result counts,
accessible labels, warnings and the new “Related by meaning” explanation into
whole translatable messages. Include dynamic `ruleNotes.server` descriptions
and other app-authored rule explanations, not only literal JSX.

The translator and dictionary still operate on **English and Enochian**.
A Hebrew interface must name that language pair accurately; it does not add
Hebrew translation, Hebrew dictionary search, new model output languages or
retranslate English lexical glosses/benchmark evidence. Source spellings, Keys
alignments, citations and raw corpus excerpts retain their own languages.
Keep Enochian/script controls and Hebrew layout direction independent.

Verify both translation directions, keypad/copy/share actions, no results,
unknown words, partial/failure states, plurals, related-word notes, variant
tablets and script changes on phone and desktop. The Oration source reader is
assigned to S1, not silently bulk-translated here.

### T10 — Open-source documentation and explorer

T10a covers the overview and data pages; T10b covers component pages and the
interactive explorer. Primary code: `src/app/open-source/{OpenSourceText,
data/DataText,data/[table]/TablePage,components/ComponentsText,
components/[name]/ComponentPage}`, `src/explorer/`, `src/export/ExportControls.tsx`,
`src/sources/SourceDialog.tsx`, and `src/OpenSource.tsx`.

Translate explanations, descriptions, table chrome, empty/invalid states,
prop controls and export/source dialogs. Preserve npm package names, schema
keys, raw table rows, commands, import paths, JSX examples and licence text.
Descriptions embedded in schema/example registries need classification too;
introduce display mappings without adding app Lingui to published packages.
Verify copied code and exports remain valid, and English docs/search output
remain unchanged. Source tables stay explicitly identified as source data.

### T11 — Public chat and ordinary administration

T11a covers `src/app/chat/chat.tsx` and the `/chat` entrypoint. Translate input,
send/stop/loading/failure controls and source/citation chrome. User messages,
model answers and retrieved source text are content; preserve them. Changing
the model's response-language policy is a separate decision, not a hidden
consequence of UI preference.

T11b covers `/admin`, `src/app/admin/AdminForms.tsx`, `/chat/train` and
`src/app/chat/train/TrainingUpload.tsx`: forms, permissions, progress and
validation results. Keep training data, identifiers and server diagnostics
distinct. Verify unauthorized/admin views and failed/retried operations without
changing grants. Do not include private research or send training material to
the site-copy translation task.

## Source works, ritual editions and intentionally isolated documents

### S1 — Seven source-work route templates

The three Lenain book templates serve a French source edition, the Oration
serves an English source text, and the three bundled ritual routes serve their
existing authored documents. They remain explicitly accounted for, rather than
being marked “translated” after their navigation changes.

There are two separate deliverables:

1. Localize site-authored introductions, reading controls, editorial-note
   chrome, captions and source links, preserving the originals' language.
   Before offering a prefixed source-reader view, explicitly decide its page
   identity and metadata: a Hebrew interface around a named French/English
   original must say so, and must not claim a Hebrew edition of that work.
   Do not add these seven paths to the normal completed-translation allowlist
   during T batches without that decision.
2. Translate an actual work/ritual only through its content-specific editorial
   process. `/he/doc/<id>` depends on plan 086's public-edition resolver and the
   separate ritual translation project's applicability, revision, publication,
   access and deletion contracts. UI catalog completeness is insufficient.
   Preserve old canonical URLs and original content; never create aliases that
   masquerade as distinct translations or expose private siblings.

The separate ritual design is still an owner-maintained draft; this plan does
not modify it or infer that its runtime contract is implemented.

### X1 — Research and standalone failure documents

`/chat/research` and `src/chat-research/` stay out of this rollout. Their isolated
root intentionally mounts no ordinary locale/account provider, analytics or
worker. Do not import shell translation components into it to remove English.

`src/app/global-error.tsx` and `global-not-found.tsx` also remain intentional,
minimal English documents, accurately labelled `lang="en"`. They can serve
research failures/unmatched requests and must not acquire ordinary providers,
storage/account reads or app telemetry. Review route-scoped error/loading/not-found
boundaries within each T batch. Any later localization of the standalone
documents needs a separate isolation-preserving design, not a blanket hook.

## Common acceptance criteria for each T sub-batch

- Maintain a short list of touched screens, source components, remaining
  deliberate foreign-language blocks and supported states. Review rendered
  values and imported message builders as well as literal text.
- Reuse shared public bodies under English and explicit Hebrew entrypoints.
  Add a route to `PUBLIC_TRANSLATIONS` only after body, data labels, metadata,
  alt text, navigation and expected error/empty states are ready. Keep every
  new Hebrew route `noindex` with no sitemap/hreflang entries. Update route
  inventory/tests as entrypoints are added; unknown/unsupported aliases stay 404.
- Preserve canonical IDs/slugs, stable form/query values, draft durability,
  account boundaries and private no-store behavior. In-page private switching
  must not remount editors, quizzes or other stateful tools. Public switches
  navigate to real available editions; missing editions remain unavailable.
- Use `PublicLink` or equivalent existing policy for translated destinations;
  retain original-language source destinations where no edition exists. Include
  localized visible and structured breadcrumbs, entity navigation and sharing
  metadata without falsely declaring source excerpts to be Hebrew.
- Run `pnpm i18n:extract`; translate/review the delta in PO sources; run
  `pnpm i18n:check`, formatting, typecheck and affected tests. Before a
  code-changing commit, pass the full local suite and existing coverage gates.
  Run `loom check` and `loom skills check`. Build both supported bundlers and
  extend/run real-app verification when a sub-batch adds public routes or changes
  server/client, search-extraction, shared-package or offline boundaries.
- Browser-review Hebrew mobile/desktop, light/dark, LTR/RTL transitions, keyboard
  navigation, long strings, complete ICU plural cases and screen-reader labels.
  Use Frank Ruhl Libre for standalone Hebrew and Noto Sans Hebrew for running
  text. Source/code/diagrams keep their intended direction.
- Preserve English prose extraction and existing search artifacts through the
  explicit presentation adapter. Labels intended to stay out of search remain
  separate. Do not evaluate page modules or follow private imports to build
  search text; do not change remote indexes/provider settings as a side effect.
- Follow the repository screenshot rule for affected documented screens;
  regenerate through the installed helper with synthetic data and inspect the
  affected images. Commit PO sources and required image changes with the code;
  leave generated catalog JavaScript ignored.

## Maintenance after a batch lands

The [existing AGENTS rules](../AGENTS.md#interface-and-site-copy-translations)
already require agents changing first-party text to mark complete messages,
extract, translate/review the Hebrew delta and commit it with the source change.
The coding agent can translate directly. `pnpm i18n:translate` is a dry run;
`pnpm i18n:update` requests provider-backed translation only with an explicitly
configured model/authentication. Neither build nor CI runs AI.

CI's `pnpm i18n:check` checks extraction sync, missing/fuzzy messages and ICU/tag
structure. It cannot find all unmarked raw copy or prove semantic accuracy.
Changing an extracted source message makes the catalog need synchronization;
review the new/missing/fuzzy entry as appropriate. Context-only changes and
reused wording still need a human/agent review even when Lingui sees no delta.

For each completed batch, record the commit, routes/fixtures reviewed and any
intentional English exceptions here. New pages inherit the same workflow and
must be added to the route ledger. Keep a completed screen free of newly
introduced English, rather than treating translation as a later cleanup task.

Adding a language is a deliberate onboarding task: update locale metadata and
validation, Lingui config/catalogs, explicit catalog loading, language/prefix
parsing, account preference constraints/migration, available editions, route
checks, worker/privacy/analytics handling and browser tests. The current
maintenance script defaults to Hebrew; explicitly translate each supported
target locale when there is more than one. Update AGENTS guidance to cover the
new locale too. Onboarding a locale does not publish every public page or enable
its SEO. No unattended translation service or provider credential is introduced
by this plan.

## Completion and launch boundary

- [x] Inventory current route templates and known explicit English fallbacks.
- [x] Assign remaining work to bounded batches with dependencies and acceptance.
- [ ] Complete T1–T11, recording each sub-batch's evidence and exceptions.
- [ ] Resolve S1 wrapper/edition decisions and connect ritual translations when
  their independent runtime contract is ready; do not block ordinary UI work.
- [ ] Review all routes actually intended for Hebrew indexing, including their
  data/source language boundaries, with the owner.
- [ ] Only on a separate explicit launch request, follow the
  [final SEO checklist](../src/i18n/README.md#routine-maintenance-and-final-seo-launch).

Translation batches can be reviewed and used while Hebrew discovery remains
off. No batch's completion, including the last one, automatically authorizes
flipping the SEO flag, a push, deployment or search-engine submission.

## Route ledger

Each row names one current route template. `public` means the existing document
root, not a claim of static rendering or anonymous-only data. `localized` rows
are the three implemented Hebrew templates; no future entrypoints are counted.
The source column identifies the exact page entrypoint; imported presentation
files are described in the batch scope above.

| Route template | Root | Batch | Page source |
| --- | --- | --- | --- |
| `/` | public | C0 | [page](<../src/app/(public)/page.tsx>) |
| `/about` | public | C0 | [page](<../src/app/(public)/about/page.tsx>) |
| `/books` | public | C0 | [page](<../src/app/(public)/books/page.tsx>) |
| `/[locale]` | localized | C0 | [page](<../src/app/(localized)/[locale]/page.tsx>) |
| `/[locale]/about` | localized | C0 | [page](<../src/app/(localized)/[locale]/about/page.tsx>) |
| `/[locale]/books` | localized | C0 | [page](<../src/app/(localized)/[locale]/books/page.tsx>) |
| `/signin` | private | T1 | [page](<../src/app/(private)/signin/page.tsx>) |
| `/temples` | private | T1 | [page](<../src/app/(private)/temples/page.tsx>) |
| `/temples/admin` | private | T1 | [page](<../src/app/(private)/temples/admin/page.tsx>) |
| `/temples/admin/[_id]` | private | T1 | [page](<../src/app/(private)/temples/admin/[_id]/page.tsx>) |
| `/temples/admin/[_id]/membership/[membershipId]` | private | T1 | [page](<../src/app/(private)/temples/admin/[_id]/membership/[membershipId]/page.tsx>) |
| `/temples/join/[slug]/[pass]` | private | T1 | [page](<../src/app/(private)/temples/join/[slug]/[pass]/page.tsx>) |
| `/gd/rituals` | public | T2 | [page](<../src/app/(public)/gd/rituals/page.tsx>) |
| `/gd/rituals/deleted` | private | T2 | [page](<../src/app/(private)/gd/rituals/deleted/page.tsx>) |
| `/doc/[_id]/edit` | private | T2 | [page](<../src/app/(private)/doc/[_id]/edit/page.tsx>) |
| `/doc/[_id]/edit/semantic` | private | T2 | [page](<../src/app/(private)/doc/[_id]/edit/semantic/page.tsx>) |
| `/upload` | private | T2 | [page](<../src/app/(private)/upload/page.tsx>) |
| `/doc/[_id]` | reader | T2 | [page](<../src/app/(reader)/doc/[_id]/page.tsx>) |
| `/offline/ritual` | offline | T2 | [page](<../src/app/(offline)/offline/ritual/page.tsx>) |
| `/help/temples` | public | T3 | [page](<../src/app/(public)/help/temples/page.tsx>) |
| `/help/ritual-pug` | public | T3 | [page](<../src/app/(public)/help/ritual-pug/page.tsx>) |
| `/study` | public | T4 | [page](<../src/app/(public)/study/page.tsx>) |
| `/study/[_id]` | private | T4 | [page](<../src/app/(private)/study/[_id]/page.tsx>) |
| `/study/info/[_id]` | private | T4 | [page](<../src/app/(private)/study/info/[_id]/page.tsx>) |
| `/astrology` | public | T5 | [page](<../src/app/(public)/astrology/page.tsx>) |
| `/astrology/moon` | public | T5 | [page](<../src/app/(public)/astrology/moon/page.tsx>) |
| `/astrology/planetary-hours` | public | T5 | [page](<../src/app/(public)/astrology/planetary-hours/page.tsx>) |
| `/astrology/planets` | public | T5 | [page](<../src/app/(public)/astrology/planets/page.tsx>) |
| `/astrology/planet/[id]` | public | T5 | [page](<../src/app/(public)/astrology/planet/[id]/page.tsx>) |
| `/astrology/zodiac` | public | T5 | [page](<../src/app/(public)/astrology/zodiac/page.tsx>) |
| `/kabbalah` | public | T6 | [page](<../src/app/(public)/kabbalah/page.tsx>) |
| `/kabbalah/tree` | public | T6 | [page](<../src/app/(public)/kabbalah/tree/page.tsx>) |
| `/kabbalah/sephirah/[id]` | public | T6 | [page](<../src/app/(public)/kabbalah/sephirah/[id]/page.tsx>) |
| `/kabbalah/path/[id]` | public | T6 | [page](<../src/app/(public)/kabbalah/path/[id]/page.tsx>) |
| `/kabbalah/yhvh` | public | T6 | [page](<../src/app/(public)/kabbalah/yhvh/page.tsx>) |
| `/kabbalah/yhvh/72angels` | public | T6 | [page](<../src/app/(public)/kabbalah/yhvh/72angels/page.tsx>) |
| `/kabbalah/angel/[slug]` | public | T6 | [page](<../src/app/(public)/kabbalah/angel/[slug]/page.tsx>) |
| `/geomancy` | public | T7 | [page](<../src/app/(public)/geomancy/page.tsx>) |
| `/geomancy/reference` | public | T7 | [page](<../src/app/(public)/geomancy/reference/page.tsx>) |
| `/geomancy/reading` | public | T7 | [page](<../src/app/(public)/geomancy/reading/page.tsx>) |
| `/gd` | public | T8 | [page](<../src/app/(public)/gd/page.tsx>) |
| `/gd/grades` | public | T8 | [page](<../src/app/(public)/gd/grades/page.tsx>) |
| `/gd/grade/[id]` | public | T8 | [page](<../src/app/(public)/gd/grade/[id]/page.tsx>) |
| `/gd/components` | public | T8 | [page](<../src/app/(public)/gd/components/page.tsx>) |
| `/gd/symbols` | public | T8 | [page](<../src/app/(public)/gd/symbols/page.tsx>) |
| `/gd/symbols/candlestick` | public | T8 | [page](<../src/app/(public)/gd/symbols/candlestick/page.tsx>) |
| `/gd/symbols/fylfot-cross` | public | T8 | [page](<../src/app/(public)/gd/symbols/fylfot-cross/page.tsx>) |
| `/gd/symbols/shewbread` | public | T8 | [page](<../src/app/(public)/gd/symbols/shewbread/page.tsx>) |
| `/gd/sigils` | public | T8 | [page](<../src/app/(public)/gd/sigils/page.tsx>) |
| `/gd/halls` | public | T8 | [page](<../src/app/(public)/gd/halls/page.tsx>) |
| `/gd/halls/[slug]` | public | T8 | [page](<../src/app/(public)/gd/halls/[slug]/page.tsx>) |
| `/gd/halls/editor` | public | T8 | [page](<../src/app/(public)/gd/halls/editor/page.tsx>) |
| `/enochian` | public | T9 | [page](<../src/app/(public)/enochian/page.tsx>) |
| `/enochian/dictionary` | public | T9 | [page](<../src/app/(public)/enochian/dictionary/page.tsx>) |
| `/enochian/keys` | public | T9 | [page](<../src/app/(public)/enochian/keys/page.tsx>) |
| `/enochian/tablets` | public | T9 | [page](<../src/app/(public)/enochian/tablets/page.tsx>) |
| `/enochian/translate` | public | T9 | [page](<../src/app/(public)/enochian/translate/page.tsx>) |
| `/open-source` | public | T10 | [page](<../src/app/(public)/open-source/page.tsx>) |
| `/open-source/data` | public | T10 | [page](<../src/app/(public)/open-source/data/page.tsx>) |
| `/open-source/data/[table]` | public | T10 | [page](<../src/app/(public)/open-source/data/[table]/page.tsx>) |
| `/open-source/components` | public | T10 | [page](<../src/app/(public)/open-source/components/page.tsx>) |
| `/open-source/components/[name]` | public | T10 | [page](<../src/app/(public)/open-source/components/[name]/page.tsx>) |
| `/chat` | public | T11 | [page](<../src/app/(public)/chat/page.tsx>) |
| `/admin` | private | T11 | [page](<../src/app/(private)/admin/page.tsx>) |
| `/chat/train` | private | T11 | [page](<../src/app/(private)/chat/train/page.tsx>) |
| `/books/la-science-cabalistique` | public | S1 | [page](<../src/app/(public)/books/la-science-cabalistique/page.tsx>) |
| `/books/la-science-cabalistique/[division]` | public | S1 | [page](<../src/app/(public)/books/la-science-cabalistique/[division]/page.tsx>) |
| `/books/la-science-cabalistique/texte-integral` | public | S1 | [page](<../src/app/(public)/books/la-science-cabalistique/texte-integral/page.tsx>) |
| `/enochian/oration` | public | S1 | [page](<../src/app/(public)/enochian/oration/page.tsx>) |
| `/doc/neophyte` | public | S1 | [page](<../src/app/(public)/doc/neophyte/page.tsx>) |
| `/doc/zelator` | public | S1 | [page](<../src/app/(public)/doc/zelator/page.tsx>) |
| `/doc/theoricus` | public | S1 | [page](<../src/app/(public)/doc/theoricus/page.tsx>) |
| `/chat/research` | research | X1 | [page](<../src/app/(research)/chat/research/page.tsx>) |

## Explicit English fallback ledger

Counts are `EnglishText` JSX instances at the baseline, not strings, messages
or a coverage target. Replace fragments with complete messages where suitable;
do not merely strip the wrapper. Other remaining text is described in the batch
scopes and still requires state-by-state review.

| Production file | Blocks | Batch |
| --- | ---: | --- |
| [app/(private)/chat/train/page.tsx](<../src/app/(private)/chat/train/page.tsx>) | 1 | T11 |
| [app/(private)/doc/[_id]/edit/semantic/page.tsx](<../src/app/(private)/doc/[_id]/edit/semantic/page.tsx>) | 2 | T2 |
| [app/(private)/gd/rituals/deleted/page.tsx](<../src/app/(private)/gd/rituals/deleted/page.tsx>) | 2 | T2 |
| [app/(private)/temples/admin/[_id]/membership/[membershipId]/page.tsx](<../src/app/(private)/temples/admin/[_id]/membership/[membershipId]/page.tsx>) | 5 | T1 |
| [app/(private)/temples/admin/[_id]/page.tsx](<../src/app/(private)/temples/admin/[_id]/page.tsx>) | 4 | T1 |
| [app/(private)/temples/admin/page.tsx](<../src/app/(private)/temples/admin/page.tsx>) | 2 | T1 |
| [app/(private)/temples/join/[slug]/[pass]/page.tsx](<../src/app/(private)/temples/join/[slug]/[pass]/page.tsx>) | 5 | T1 |
| [app/(private)/temples/page.tsx](<../src/app/(private)/temples/page.tsx>) | 4 | T1 |
| [app/(private)/upload/page.tsx](<../src/app/(private)/upload/page.tsx>) | 1 | T2 |
| [app/doc/[_id]/edit/semantic/DeleteRitualDialog.tsx](<../src/app/doc/[_id]/edit/semantic/DeleteRitualDialog.tsx>) | 2 | T2 |
| [app/doc/[_id]/edit/semantic/RitualAccessDialog.tsx](<../src/app/doc/[_id]/edit/semantic/RitualAccessDialog.tsx>) | 3 | T2 |
| [app/doc/[_id]/edit/semantic/SemanticEditor.tsx](<../src/app/doc/[_id]/edit/semantic/SemanticEditor.tsx>) | 5 | T2 |
| [app/doc/[_id]/edit/semantic/SemanticEditorShell.tsx](<../src/app/doc/[_id]/edit/semantic/SemanticEditorShell.tsx>) | 1 | T2 |
| [app/signin/SignInButton.tsx](<../src/app/signin/SignInButton.tsx>) | 1 | T1 |
| [app/temples/admin/[_id]/ForumSettings.tsx](<../src/app/temples/admin/[_id]/ForumSettings.tsx>) | 2 | T1 |
| [search/SearchDialog.tsx](<../src/search/SearchDialog.tsx>) | 1 | T1 |

## Planning verification

This change adds documentation only. Cross-check the route ledger against all
`src/app/**/page.tsx` files and `ROUTE_PLACEMENT`: no omissions or duplicates.
Check fallback counts and relative references, run catalog/wiring checks, and
confirm `LOCALIZED_SEO_ENABLED` stays false. Runtime tests, translation provider
calls, screenshot regeneration and production builds belong to implementation;
they are not needed merely to record this inventory.

Verified on 18 November 2026: all 73 ledger rows match the filesystem and route
placement registry with no duplicates; the fallback ledger totals 16 files and
41 blocks; relative Markdown references resolve. `pnpm i18n:check` passes
extraction sync, strict compilation and Hebrew ICU/component validation.
`loom check` passes with existing advisory recommendations, and
`loom skills check` reports consistent project skills. The runtime SEO flag
remains false. No application code, PO source, source work or screenshot changed.
