# Temple halls index — 8 November 2026

Status: draft, from `main` at 951eff85. Adversarially reviewed (Fable)
and revised the same day; see "The review" at the end. Spiked the same
day and revised again; see "The spike". Not yet built. The number is provisional: claim it from `ls plans` and every
branch's `plans/` at the moment of committing (067 and 068 are taken on
branches today). Read [current status](000-current-status.md),
[plan 061](061-gd-hall.md) (halls), [plan 062](062-gd-hall-seo.md)
(`/gd/halls`), [plan 006](006-private-offline.md) (the offline lease)
and [plan 057](057-temple-administration.md) (temples) first.

Gadi noticed that a page of every hall with thumbnails is handy, and
asked for the same for a temple's private halls, then for editing halls
outside the ritual editor, then for rituals to link to a shared hall.
The assessment (8 November 2026, not in the repository; its facts are
below) split this into three steps and recommended building the first
alone: an index of the halls that already sit inside the rituals a
member can read. Gadi agreed the same day, with mock-ups (A–F, kept
outside the repository) settling the layout.

Gadi's decisions, 8 November 2026:

1. **Step 1 only: an index of the halls inside rituals.** No hall is
   stored on its own, nothing new is edited, rituals keep their copies.
   - Why: a hall is almost always unique to a grade ritual; the need is
     quick access, which an index meets without new storage or access
     rules. A member sees exactly the halls of the rituals they may
     read.
   - Deferred: steps 2 and 3 (Follow-ups). Gadi would like a hall edited
     once to update every ritual that uses it; that is to be weighed
     then, against live references, which the assessment advised
     against.
2. **Two ways in: inside a ritual, and across rituals.** The reader's
   floating button gains Halls (mock-ups A–D); `/gd/halls` gains a tab
   per temple (E–F).
3. **Rituals not on this device are fetched automatically** for the
   temple whose tab is open, so the index fills itself and then works
   offline (E's "Fetching this ritual to this device…"). After the
   review, Gadi chose to fetch **all** of them, not a first few
   (decision 8).
4. **Offline, halls are on the Downloaded rituals page** (decision 9,
   not on `/gd/halls`.
5. **The open temple tab is remembered per account** (decision 7),
   cleared on sign-out.

## What exists (read for this plan)

- **Halls carry a caption.** Every preset has a `caption(text=…)` child
  ("Zelator Temple 1", `src/components/gd/hall/presets/*.ts`), drawn
  under the plan, and inserting a preset copies it; the built-in
  rituals' five halls all have one. Nothing else names a hall:
  `gdHall` has no title attribute.
- **Headings are top-level rows** `{type: "title", text}`. Halls sit
  nested, usually in a `note` (`1=10.pug` lines 60–61). A hall usually
  follows its section's title, but not always: Theoricus's first hall
  (`2=9.pug` line 47, its `note` at 45) comes before the first title
  (line 102).
- **Where a hall may sit.** `HALL_PARENT_TAGS` (`semantic.ts` lines
  148–153: `note`, `summary`, `li`, `todo`) checks only the immediate
  parent, so `footnote > note > gdHall` is valid. A footnote's body is
  drawn at its host (a `footnotes` block or a task's footer), later
  than its place in the document, and a footnote with no reachable host
  is never drawn (`planRitualFootnotes`, `ritualFootnotes.ts` lines
  10–83, `host: null` at 55–58).
- **A hall can be drawn twice.** The reader draws a task's children once
  for `say` and once for `do` (`blocks.jsx` lines 214–230). The SQL
  validator refuses a task with both (`semantic.ts` lines 475–476), so
  only imported legacy rituals can do it.
- **Readers get the published version only.** A ritual whose current
  revision has no bundle gives a member nothing to read or fetch: the
  permission reply carries no bundle, and an older bundle is refused
  (`manifest.renderedJson` must equal the selected content). Locally on
  8 November, 3 of 9 temple rituals had their current revision
  published.
- **The reader's tree.** `DocRender` receives the compiled JRT tree for
  every route: built-in rituals compiled in the client (`DocLoader`),
  public SQL rituals rendered on the server (`page.tsx` lines 83–93),
  private rituals read from the device (`PrivateRitualReader`, which
  parses `bundle.renderedJson`). A hall row keeps all its attributes and
  children (`semanticToJrt`, `semantic.ts` lines 498–516).
- **No node IDs in published rituals.** `semanticToJrt` drops `id`;
  `GdHallBlock` (`blocks.jsx` line 291) renders `GdHallFrame` with no
  id or anchor, and has no document context. The Table of Contents
  lists top-level titles only and jumps with `location.hash = title` to
  `TitleFrame`'s anchor; Jump to Next uses refs that only task blocks
  set; Jump Back is a ref (`DocRender.tsx` line 433), shown after the
  next render. The editor's footnotes render `<Render>` too
  (`FootnotesForEditing.tsx` line 99).
- **Private rituals are read only from the device.** Opening one calls
  `refreshOfflineRitual` (`ritualDownload.ts` line 29), which asks
  `/api/rituals/permission` and stores the bundle (title, rendered
  JSON, assets) in the Dexie database `magickli-ritual-offline`, keyed
  by owner and ritual. Every read goes through the lease-gated
  repository (`readBundle`, `listDownloadedRitualIds`), registered with
  the coordinator, inside an operation, and dropped on `hide()`; an
  expired (14 days) or denied lease purges the copy, and nothing else
  does. `OfflineRitualCatalog.tsx` (lines 137–190) already enumerates
  downloaded rituals this way. **The stored bundle has no temple**:
  `RitualBundle` (`storage.ts` lines 50–65) and the grant carry neither
  scope nor temple.
- **Every fetch disturbs every tab.** `refreshOfflineRitual` calls
  `coordinator.changed()` after each accepted permission
  (`ritualDownload.ts` line 77), which posts "changed" to every tab and
  invalidates: every operation aborts and every registered view hides,
  here and in other tabs (`lifecycle.ts` lines 263–283, 559–562,
  576–595). A second fetch aborts the first's asset download (lines
  95–104). The Downloaded list avoids this with
  `recheckOfflineRitual` (lines 185–244), which downloads nothing, and
  broadcasts once per round, for denials only
  (`OfflineRitualCatalog.tsx` lines 130–133).
- **Account activation.** `PrivateRitualReader` calls
  `runtime.refreshVerifiedAccount()` (line 199, `/api/session`);
  without it a member who never opened a private ritual on this device
  has no active account, and permission checks return null
  (`lifecycle.ts` lines 485–491).
- **The ritual list.** `sqlRitualReader.listMetadata()` (`sqlReads.ts`
  line 190) returns `{id, title, createdAt, updatedAt, canEdit,
  templeSlug}` for every ritual the caller may read, filtered with
  `getRitualAccess`; `templeSlug` is set exactly for temple-scoped
  rituals (`schema/rituals.ts` lines 84–86). Only server pages call it
  (`/gd/rituals`, `/upload`). No client endpoint lists rituals.
  Compiled content is in the database (`ritual_compiled_artifacts.
  content_json`), not object storage.
- **Offline navigation.** The service worker serves private routes from
  one warmed anonymous shell, `/offline/ritual`, and the built-in
  rituals from their own shells (`sw.ts` lines 48–52). Warming is
  strict: `assertShell` (`publicShells.ts` lines 134–200) requires a
  public, `s-maxage` response, no `Vary: cookie`, and every script and
  stylesheet in this build's precache, and a failed required warm fails
  installation for everyone. A warmed shell is then served from its
  cache even online. RSC and prefetch requests are excluded, so an
  in-app link to a shell offline fails; a full navigation works.
  `/gd/halls` is not warmed. An ordinary page visit lands in Serwist's
  catch-all `others` cache (network first, 32 entries, 24 hours;
  `defaultCache` in `@serwist/next` 9.5.13): its HTML rule matches a
  request `Content-Type`, which navigations do not send. So `/gd/halls`
  opens offline only if visited within a day and not pushed out. Every `/api/` path except three public
  ones is private and network-only (`isPrivateRuntimeUrl`,
  `privateRequests.ts` lines 28–32), so a new endpoint is never cached
  by default.
- **`/gd/halls` is static** (plan 062): server-rendered, in the sitemap,
  its thumbnails PNGs made at build time, no client code. Its test
  renders it with `renderToString` and no providers (`page.test.tsx`),
  and `src/seo/routes.test.ts` (line 101) forbids `"use client"` in page
  files. Its app bar title already has a menu ("Temple Halls ▾").
- **Titles.** The seed's are "Zelator 1=10 (sample)", "Adeptus Minor
  5=6 (sample)" (`scripts/docs-screenshots/fixtures.ts` lines 117–138);
  the built-in headings write "1 = 10"; Golden Dawn notation often
  writes `1°=10□`.
- **No pan/zoom component** exists, and no dependency provides one.
- **Sizes**, measured by script on the built-ins: a compiled ritual is
  70–102 KB of JSON, a compiled hall 1.9–2.2 KB.

## Decisions

### 4. A hall's name and context

`ritualHalls(tree)`, a pure function, lists the halls **in the order
the reader draws them**: it calls `planRitualFootnotes` with the
reader's own `rendersBody` (shared with `Render`, not copied) and walks
as `Render` draws, so a hall in a footnote comes at its host's place,
one in a footnote with no host is left out, and a row drawn twice (a
legacy task with `say` and `do`) is listed once. Per hall: its ordinal
(1-based), its name, its context, and the row itself. The spike's
prototype matched the drawn order exactly (S3).

- **Name**: the hall's first non-empty `caption` text; else "Hall N".
- **Context**: the text of the last top-level `title` before the hall
  (before its host, for a footnote's hall); if there is none, the first
  after it (Theoricus's case); else none.
- Rejected: a new `gdHall(title=…)` attribute. Every hall already has
  a caption, and a new attribute is a vocabulary change in the
  validator and the editor for no reader gain. Kept as a follow-up if a
  caption ever proves wrong as a name.
- Rejected (review): forbidding halls under footnotes. It would refuse
  saved revisions that validate today.

### 5. Addressing a hall: by its place

`DocRender` computes `ritualHalls(doc)` once and passes a
`WeakMap<row, ordinal>` through `DocContext`; `GdHallBlock` gives
`GdHallFrame` an `id` prop, `hall-N`, set on its `<figure>` (present
before the drawing's chunk loads), only when the row is in the map. So
the editor, which renders without the map, gets no ids, and ids stay
unique. "Go to it in the ritual" sets the hash to it.

- Why: published rituals have no node IDs, and the ordinal is computed
  from the same tree the reader draws.
- Limit: a copied link to `#hall-2` may name another hall after the
  ritual is edited. Accepted.
- Limit: a legacy hall drawn twice carries its id twice; the hash finds
  the first. Accepted, as SQL rituals cannot do this.
- Rejected: carrying node IDs into the compiled output. It changes every
  compiled ritual and bundle, touches the compiler identity, and is a
  larger change than this feature.

### 6. Inside a ritual (mock-ups A–D)

- **Halls on the floating button**, between Jump to Next and Table of
  Contents, shown only when `ritualHalls(doc)` is not empty. With one
  hall it opens the viewer directly; with several, a bottom sheet lists
  them (thumbnail, name, context).
- **The viewer**: a full-screen dialog drawing the hall with the
  reader's `GdHallFrame`, its name and context in the bar, "N of M",
  previous and next, and "Go to it in the ritual", which closes it,
  scrolls to the hall and arms Jump Back (shown on the render that
  closing the dialog causes).
- **Pan and zoom**: our own small component around the SVG, with
  `touch-action: none` on its surface (else iOS Safari zooms the page):
  two-finger pinch and drag; Ctrl+wheel on desktop (a non-passive
  listener); keys +, − and 0, and visible zoom buttons; double-tap
  resets. Swiping to the next hall works only at 1×; zoomed in, a drag
  pans. No dependency.
- **The Table of Contents** lists each hall, indented under the title
  before it, and jumps to its anchor.
- Works on every reader route, offline included, because it walks the
  `doc` that `DocRender` already holds. No new chunk: the reader already
  loads `GdHall`.

### 7. Across rituals: temple tabs on `/gd/halls` (mock-ups E–F)

- The page stays as it is, static and searchable; its content becomes
  the **Standard** tab. The tabs are a client component imported by the
  page, which renders nothing on the server and reads the session, hash
  and catalog only in effects, so the page's static render and its
  tests are unchanged.
- **Who sees the tabs**: only a signed-in visitor (`useSession`). For
  anyone else the island does nothing and calls no endpoint, so
  crawlers and anonymous visitors never reach `/api/rituals/catalog`
  or `/api/session`.
- **The open tab**: in the hash, `#temple=<slug>`, written with
  `history.replaceState` so Back leaves the page rather than cycling
  tabs. Opening `/gd/halls` with no hash opens, in order: the tab
  remembered for this account, if that temple is still in the catalog;
  else the only temple, when there is one; else Standard.
- **Remembered per account, in the offline database** (Gadi's decision
  5): a record in the existing `device` table under the key
  `hallsTab:<ownerId>`, holding the slug, written when the member picks
  a tab and read only for the active account. `resumeCleanup` deletes
  it with the account's other stores on sign-out, and a remembered slug
  missing from the catalog is deleted. `DeviceState` widens to a union
  for it.
  - Why the `device` table: it needs no new database version. Nothing
    in `src/offline` handles `versionchange`, so a version 2 would
    close the database under a tab still running the previous deploy,
    mid-use.
  - Rejected: `localStorage`. A private temple's slug is membership
    metadata; it would outlive sign-out and show to the next account on
    a shared device.
  - The switch to a remembered tab happens after hydration, so the
    Standard content may show for a moment first; the tab row keeps its
    space, so nothing below it jumps until the content swaps.
  - Why the hash: the page stays static and cacheable, and the hash
    never reaches the server or the service worker.
  - Rejected: `/temples/<slug>/halls` (no member-facing temple page
    exists); a query string (makes the page dynamic, or misses the
    shell matching, which requires an empty search).
  - Links that know the temple, such as the ritual list's, may point
    straight at `#temple=<slug>`.
- A temple tab groups halls by ritual: grade rituals first, then the
  others by title; halls in the order of decision 4. One helper reads a
  grade from a title, allowing spaces, ° and □ around the `=`
  (`0=0`, `1 = 10`, `1°=10□`), and "Portal" as a word; it sorts by the
  first number (0, 1, 2, 3, 4, Portal, 5…), never by string. Each group
  heading links to the ritual; each card opens the viewer of decision 6
  with that ritual's halls.
- Thumbnails are drawn on the client with `GdHall` at 120 px (106 on a
  phone), only when they scroll into view, and a few per frame. The
  spike drew 16 halls at once in 1.4 s on a CPU slowed 4×, with one
  task blocking for 560 ms (S4), too long to do in one go.
- Help: `/help/temples` gains a short section with one screenshot of a
  temple tab, from the Example temple's seed (synthetic data only).

### 8. Which rituals, and where their halls come from

- A new uncached endpoint, `GET /api/rituals/catalog`, returns
  `{id, title, templeSlug, updatedAt, hallCount}` for the caller's
  readable **temple** rituals **whose current revision is published**
  (a member can fetch nothing else), from `listMetadata`'s selection.
  A count is metadata on a par with the title. Signed out: 401.
  `Cache-Control: private, no-store`. The temple tabs are the distinct
  temples in it with at least one hall.
- **`hallCount` is counted in Postgres**, so no ritual content leaves
  the database: occurrences of `"type":"gdHall"` in the selected
  `content_json`. It matched a full parse on all 9 local rituals and
  took 1.5 ms (S4); text or attributes containing the marker are
  escaped in the stored JSON and cannot match. It relies on the
  compiler's compact JSON with `type` first, which a test pins against
  `semanticToJrt`. A ritual on the legacy archive is parsed instead.
- The island checks the client session first and, only when signed in,
  activates the account, as the reader does (`refreshVerifiedAccount`).
  The spike showed that activation calls `/api/session` even signed
  out, which anonymous visitors and crawlers must not trigger (S2).
- For each ritual of the open tab with `hallCount > 0`, halls are read
  from the device copy through the repository, as
  `OfflineRitualCatalog` reads them: one registration per ritual, reads
  inside an operation, parsed halls in memory only and dropped on
  `hide()`. The catalog's titles are cleared when the account changes,
  as `OfflineRitualCatalog` does (lines 191–205).
- **Fetching what is missing**:
  - Only rituals with halls, one at a time, for the open tab only.
  - **All of them automatically** (Gadi's decision 3), in the order
    the tab shows them, so the first cards fill first. None
    automatically when the browser asks to save data
    (`navigator.connection.saveData`) or is offline; then a "Fetch N
    rituals" button. Leaving the tab or the page stops the round after
    the ritual in progress.
  - **One broadcast per round.** A bulk form of `refreshOfflineRitual`
    keeps the immediate broadcast for denials and downgrades (the reason
    in its comment, lines 24–27) and sends the grants' broadcast once,
    after the round, so the open tab and other tabs' readers are not
    hidden once per ritual. Measured (S2), eight fetches: today's call
    hid every view in the tab 11 times and a reader in another tab 10
    times; a prototype deferring the grants' broadcast, 4 and 3, of
    which opening a tab alone causes 1.
  - **Retry when interrupted**, as the reader does (`onInterrupted`):
    the round's first fetch was interrupted in every spike run, by the
    tab's own start-up.
  - Why fetch at all: halls stay inside the lease model of plan 006,
    and the result works offline. Cost: each fetch brings the ritual's
    images and a 14-day lease, and adds it to Downloaded rituals.
  - Rejected: a server route returning hall subtrees. It would be the
    first private content served outside the lease model, plan 006
    rules out caching private server output, and it would not work
    offline.
- **Removal**: a ritual on the device but absent from the catalog is
  rechecked with `recheckOfflineRitual`, so a validated denial purges
  it at once. Offline, a copy legitimately stays until its lease ends
  (plan 006), and its halls with it.
- Out of step 1: group-scoped rituals, and public SQL rituals (public
  halls are the Standard tab; the built-in rituals' halls are copies of
  presets).

### 9. Offline

With no network there is no catalog, and the device copies record no
temple, so offline shows one list: **Halls on this device**, every
downloaded ritual's halls, grouped by ritual.

- **Where** (Gadi's decision 4): a Halls view in the Downloaded
  rituals page, `/offline/ritual`, whose anonymous shell is already
  warmed and proven. Its halls come from the same lease-gated reads as
  its list, and open the viewer of decision 6.
- Rejected: warming `/gd/halls` as a second shell. Its response would
  have to pass `assertShell` (public `s-maxage`, no `Vary: cookie`,
  every asset in the precache) or installation fails for everyone; it
  would then be served from the shell cache even online until the next
  deploy; the Standard tab's PNGs would show offline only if seen
  before; and an in-app link to it would fail offline. Kept as a
  follow-up if one place for halls proves worth it. `/gd/halls` opens
  offline only from the ordinary page cache, within a day of a visit
  (What exists); when it does, its temple tabs say "Offline: see Halls
  on this device" with a full-navigation link (an in-app link to the
  shell fails offline).
- Rejected for step 1: storing each ritual's temple on the device. It
  changes the strict bundle format or adds a table that must be purged
  with the leases; one list is enough for a member of one temple, which
  is the common case.

### 10. Privacy

- Nothing from a private ritual is stored outside the offline database;
  hall rows and catalog titles live in memory and go on `hide()` or an
  account change.
- The URL may hold a temple slug, in the hash, which enters the
  browser's history (and history sync). It is never sent to a server.
  The remembered tab is in the offline database, per account, deleted
  on sign-out; nothing is in `localStorage`.
- The viewer offers no export or share in step 1, so the CC BY credit
  of public exports never meets a private hall.

## The spike, 8 November 2026

Run in a throwaway worktree with throwaway code, against the local
database (read-only queries) and a dev server on 127.0.0.1; nothing was
kept. Dev-mode timings overstate production.

- **S3, order of halls.** A prototype `ritualHalls` matched the halls
  the reader drew, in order, for a hall in a footnote drawn at a later
  `footnotes` host, one in a footnote with no host (not drawn, not
  listed), and one in a task's footer. A document-order walk would have
  been wrong in each. `footnote > note > gdHall` and `task > note >
  gdHall` validate; a hall directly in a footnote does not. A legacy
  task with `say` and `do` drew its hall twice (decision 4).
- **S4, cost.** Server: the largest local temple (5 rituals, 103 KB)
  fetched in 1.7 ms and parsed and counted in 0.7 ms; counting in
  Postgres, 1.5 ms for all 9 rituals, matching the parse (decision 8).
  Phone, ten rituals (860 KB, 16 halls) at 390 px:

  | CPU | Parse | Draw all 16 at once | Longest task |
  | --- | --- | --- | --- |
  | normal | 3 ms | 0.33–0.37 s | 146 ms |
  | 4× slower | 8–11 ms | 1.4 s | 560 ms |
  | 6× slower | 13 ms | 2.1–2.2 s | 857 ms |

  Parsing is negligible; drawing goes lazily (decision 7).
- **S2, fetching outside the reader.** Two browser tabs as the local
  test creator (a member of two temples): one held a downloaded ritual
  open, the other fetched eight rituals, one from a temple it is not
  in. The broadcast counts are in decision 8. All eight calls returned
  success, but only published rituals arrived (hence the catalog's
  filter). The non-member ritual was refused and not stored; the prototype
  deferred its broadcast too, so the real bulk form must tell denials
  apart (decision 8). A downloaded copy read back through a
  registration, an operation and `readBundle`, as the index will.
  Signed out, nothing was fetched, but `/api/session` was called
  (decision 8). Not exercised: leaving the page mid-round, and the
  remembered tab's record (a small `device` write and delete).
- **S1, offline.** From the code, not a production build: the
  Downloaded rituals page reads copies the same way S2 read them back,
  and its shell is already warmed. `/gd/halls` opens offline only from
  the `others` cache (What exists), confirming decision 9.

A process note: the spike first shared the main checkout's
`node_modules` through a symlink. `pnpm exec` relinked `magick-data`
through it, the main checkout's dev server hung, and it was restarted;
the spike then installed its own. Agents implementing this plan install
their own `node_modules` in their worktrees.

## Stages

Each a gated commit on `gate/temple-halls`, implemented by Opus
subagents per the model policy, reviewed fresh.

Stage 3's bulk fetch changes `src/offline/ritualDownload.ts`, which
[plan 068](068-check-only-permission.md) rewrites (check-only
rechecks; built on `gate/check-only-recheck` on 2 November 2026,
awaiting release). Stages 1 and 2 touch only the reader and are built
from `main`; stage 3 is built on plan 068's code, after its release or
on its branch, as Gadi decides.

1. `ritualHalls`, the ordinal map and the anchors (decisions 4, 5),
   with tests over the built-in rituals and footnotes.
2. The reader: Halls action, sheet, viewer with pan and zoom, Table of
   Contents (decision 6).
3. The catalog endpoint, the bulk fetch, the temple tabs and the
   remembered tab (decisions 7, 8).
4. Offline: Halls on this device in the Downloaded rituals page
   (decision 9).
5. Help section and screenshots (`scripts/docs-screenshots`). The
   existing reader shot opens the seeded Neophyte ritual, which has a
   hall, with the floating button closed, so it changes only if the
   help page changes; check, and regenerate if it does.

## Verification

`pnpm check`, `pnpm typecheck`, the full coverage run and `loom check`
on each commit. Tests beyond each stage's own: `isPrivateRuntimeUrl`
does not match `/gd/halls`; the catalog excludes group and public
rituals and unpublished ones, answers 401 signed out, and its SQL hall
count equals a parsed count, with the marker pinned against
`semanticToJrt`; `ritualHalls` over the spike's footnote and `say`/`do`
cases; no `/api/session` call from `/gd/halls` signed out; the grade helper over the titles
above; recheck on omission; `/gd/halls`'s static render and tests
unchanged. Browser checks at phone and desktop sizes: the reader's
Halls on a built-in, a public SQL and a private ritual; the temple tab
signed in as a member of one temple (opens by itself) and of two (the
choice remembered across visits, gone after sign-out, not shown to
another account); fetching a temple's every ritual; a reader open in
another tab during a fetch; offline (Halls on this device); removal
from a temple empties its tab and, online, purges its copies.

## The review, 8 November 2026

Fable reviewed the draft against the code and found no blocker. Folded
in:

- **Each fetch hid every view in every tab** (`changed()` per grant):
  a bulk fetch with one broadcast per round (decision 8). Many
  registrations per page are fine (`lifecycle.ts` lines 203–229).
- **Removal did not purge**: recheck rituals the catalog no longer
  lists (decision 8).
- **The temple slug in `localStorage` and history**: not in
  `localStorage`; one temple opens by itself; `replaceState`
  (decisions 7, 10). Gadi then asked for the tab to be remembered, which
  is now per account in the offline database.
- **Ordinals in document order disagreed with what the reader draws**
  for halls in footnotes, and `GdHallBlock` had no way to know its
  ordinal: render order, an ordinal map in `DocContext`, ids only from
  it (decisions 4, 5).
- **Warming `/gd/halls` could fail installation**, and changes its
  caching: the offline home is now a spike choice, with the proven
  `/offline/ritual` shell recommended (decision 9).
- **Fetching every ritual**: `hallCount` in the catalog, so rituals
  without halls are never fetched, and none on Save-Data (decision 8).
  The review proposed stopping after a few; Gadi chose all.
- Account activation, session gating of the island, the static render
  and its tests, the grade helper, empty captions, the figure's id,
  pan/zoom details, Jump Back, two line numbers, and test gaps.

Its answers to the draft's questions: the hash is right for the shell
matching; fetching should stop after a few; and the coordinator takes
many registrations per page, but not a broadcast per fetch.

Gadi's calls on the revised draft, the same day (decisions 3–5 at the
top): fetch every ritual with halls automatically, not the first four;
offline halls on the Downloaded rituals page; remember the tab per
account. The last is stored in the `device` table rather than a new
table, because a new database version would close the database under
a tab still running the previous deploy.

## Follow-ups

- Step 2: halls saved outside rituals, for temples that reuse a hall
  across rituals, likely as a document kind of
  [plan 058](058-temple-documents.md).
- Step 3: rituals using a shared hall. Gadi would like edits to reach
  every ritual automatically. Options to weigh: a live reference
  (advised against: published and offline copies change without a
  publish); a copy that records its source, updated automatically as a
  new revision, with or without publishing it.
- Temple per downloaded ritual, so offline keeps the temple tabs.
- `/gd/halls` as the one place for halls, offline too (a second warmed
  shell), if the Downloaded rituals page proves the wrong home.
- Handle `versionchange` in the offline database, before any change
  that needs a new version.
- Group-scoped rituals in the index.
- Export from the viewer, without the public credit.
