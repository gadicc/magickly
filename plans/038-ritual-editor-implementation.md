# Ritual editor implementation — 1 October 2026

The operator approved implementation after the [editor decision](037-ritual-editor-decision.md), with a preference for a purpose-built ritual text format rather than overloaded Markdown or HTML. This work remains in the isolated `ritual-editor-research` worktree. No production ritual or database row has been changed.

## Implemented contract

- `src/doc/semantic.ts` defines `magickli-ritual` v1 with UUIDv7 element IDs, bounded validation, JRT profile-1 import/export, and opaque legacy nodes. All three built-in rituals round-trip through the importer without a changed JRT tree. Their 1,163 known elements and 3,053 text nodes map directly; four empty nodes in `2=9` remain opaque.
- `src/doc/ritualText.ts` prints and parses a line-oriented ritual tree. It is a **derived authoring projection**, not the SQL source format and not Markdown/HTML. Existing IDs are printed; newly typed shortcuts get IDs on apply. Canonical print/parse is stable for all three built-in rituals. Examples:

  ```text
  ritual 1
  Hiero: Speak to the candidate.
  * Keryx Open the door
  @summary "Pronunciation":
    = "The note text."
  @var candidateName
  ```

  Canonical output includes `~<UUIDv7>` after structural commands. The `@tag {"attribute":"value"}:` form covers other supported nodes; `?~<UUIDv7> {…}` preserves opaque legacy payloads. Quoted `= "text"` lines preserve exact whitespace and Unicode. Shortcut spelling and layout are not stored: after applying source, the semantic tree is authoritative and future source views are regenerated. A semantic save stores exact submitted JSON bytes, tagged `magickli-semantic-json` v1.
- `src/doc/tiptapRitual.ts` adapts the semantic tree to an editor-only Tiptap schema. Task containers are isolating. Inline text segment marks prevent ProseMirror from silently merging imported JRT text fragments. The adapter has been checked against the actual ProseMirror schema for all three built-in rituals and normalizes duplicate IDs after paste/copy.
- SQL write protocol v3 accepts semantic JSON for create/save by default. It uses the same parent CAS, operation receipt, transaction, permission checks, and JRT profile-1 reader selection as v2. The legacy v2 compiler and its identity are unchanged. The v3 compiler has its own source format and fingerprinted implementation identity. The existing SQL columns already store source format/version, so no schema migration was needed. The operation lock namespace remains shared with v2, preventing concurrent reuse of an operation ID across protocols.
- The old Pug source delivery excludes semantic revisions, preventing it from loading JSON as Pug. Historical Pug revisions and artifacts remain intact.
- `/doc/<id>/edit` opens `/edit/semantic` by default, with the Tiptap client bundle loaded dynamically. A legacy import checks that the source revision stayed current across the separate source and artifact reads. Lossless conversion opens automatically, with an opaque-node warning where needed; incompatible visual shapes remain editable in ritual source. Conversion failures retain a Pug fallback, also accessible at `/edit?legacy=1` for Pug revisions. Visual, ritual-source, and split layouts share one semantic document. If both panels diverge, save stays disabled until the source is applied or discarded. A separate IndexedDB draft store retains the last valid semantic document, the source buffer, title, base revision/version, and exact pending request. Unknown save outcomes retry the same request, including after a reload observes a newer server revision. Older or invalid local drafts require explicit download/discard before editing. A draft-store load failure blocks editing. Account changes hide editor content; a fresh source grant is checked before display, on focus and every minute, and a denial hides it. Transient verification conceals dialogs and nested menu portals while retaining their state.
- The creation form starts in the visual composer. Shared controls support task/note insertion, bold/italic, titles, summaries, to-dos, links, variable references/declarations/options, common property editing, and scoped image upload after creation. Footnotes and unusual structures use ritual source. The schema excludes unsupported rich-text marks. Delayed uploads retain their original position and refuse insertion after the document changes.
- Confirmed saves atomically retain an owner-scoped publication request and clear only the matching pending draft. Automatic publication retains the exact request across uncertain outcomes. A delayed acknowledgement cannot replace a newer publication or delete a newer draft. Expired attempts can be renewed; a server-stale revision requires draft recovery and reload.

## Historical pilot verification (25–26 September)

- `pnpm test --configLoader runner`: 244 files passed, 4,898 tests passed, 17 skipped on 26 September. The runner option avoids Vite's temporary config write under the isolated worktree's read-only `node_modules`. The standalone research trial's six Node tests also pass with their own runner and are excluded from Vitest. The SQL writer tests use disposable PGlite through the existing `tests/memory-pglite.ts` harness.
- `pnpm typecheck`: passed.
- `pnpm exec loom check`: passed with existing pnpm-11 advisory warnings.
- `pnpm build`: production webpack build, TypeScript, page-data collection, and all 386 static pages passed on 26 September using an owner-only regular `.env.local` copy in the isolated worktree.
- The production `react-loadable-manifest.json` lists 15 files for the lazy semantic editor import: 706 KB raw, 226 KB gzip, or 197 KB Brotli when each file is compressed independently. Five of those files are absent from the route's client-reference manifest and total 438 KB raw or 122 KB Brotli. These are static artifact sizes, not measured network transfer or device interaction cost; cache overlap and server compression can change the bytes actually fetched.
- `pnpm exec biome check` passes for the changed editor files. The repository-wide `pnpm check` still fails on existing unformatted research files under `editor-trial/` (28 errors, 44 warnings); this pilot did not rewrite that research fixture.
- Targeted tests cover complete legacy import, actual ProseMirror schema round-trip, compact text round-trip, v3 SQL source/artifact binding and replay, invalid saves, protocol collision, feature flag, old-source fence, UI source application, immutable retry, and account switch hiding.
- A local Chromium check of `editor-trial/production.html` loaded the production Tiptap adapter on synthetic tasks. Backspace at the start of the second speech kept `hiero` and `keryx` as separate tasks and left reader JSON unchanged. The Vite fixture had to resolve the root Tiptap packages to avoid duplicate ProseMirror plugin instances; the app route uses one root dependency graph.
- The actual Next route was exercised against the opt-in local acceptance PostgreSQL database and Loom's local Creator login at `localhost:3004`. A disposable ritual was created through the existing UI, imported, edited with a source shortcut and visual typing, saved through v3, and reloaded. SQL shows a current `magickli-semantic-json` v1 revision with a matching `json-rich-text` reader artifact. The editor reloaded both tasks and no longer recreated a local draft after successful save. A 390px Chromium viewport showed the visual controls and stacked split panels. The old Pug editor withheld source for the semantic revision and linked to the new editor.
- In the same Next route, divergent source and visual edits disabled save, reload restored both drafts, and discarding the source kept the visual change for a successful save. The disposable ritual's semantic revision was published through the authorized publication API using the ordinary local MinIO configuration; the reader then rendered its current content. A separate browser journey uploaded a synthetic image through `/upload`, verified byte-for-byte authorized retrieval and anonymous denial, and exercised conditional presigned PUT rejection on replay. Those synthetic upload rows and objects were removed after verification.
- This local acceptance database had 17 migrations already applied and needed no new migration for this work. Loom's `LOOM_LOCAL_TEST_LOGIN` path supplied the Creator login without Google.
- On 26 September, the ordinary local development database and Files checks passed in the isolated worktree. A disposable temple and ritual exercised the actual Next route in Chromium. Backspace at an action boundary kept adjacent tasks separate. Whole-document copy/paste exposed a defect: copied tasks nested inside the last task and could trigger a ProseMirror render error. The editor now gives tasks a schema node that cannot contain another task, retains semantic attributes in clipboard HTML, and replaces duplicate IDs in the live ProseMirror document. The browser then showed 12 sibling tasks with 12 unique IDs; a semantic save and reload kept all 12.
- A simulated offline save retained the exact pending request across a reload, then succeeded when retried online. A second defect made a saved revision appear as a recovered draft because delayed persistence and unstable pasted IDs rewrote it locally. The live-ID normalization, delayed-write guard, and identical-draft cleanup now leave no recovery banner after a confirmed save and reload. The new clipboard and draft tests pass. The synthetic ritual, temple, receipts, revisions, artifacts and publication rows were removed after verifying that no file or bundle asset objects belonged to them; Creator and Reader seed identities remain.
- The visual task schema cannot safely edit a task directly inside another task. The page now refuses that shape with a clear notice while the semantic source remains unchanged. Clipboard tests also cover large opaque legacy nodes and a single-step paste undo.
- Legacy Pug revisions now show a count-only conversion report before mounting the semantic editor. Import checks exact JRT tree equality, refuses a changed reader tree, and warns about opaque nodes; the author must explicitly choose to start editing. A browser check on a synthetic two-task ritual verified that simply opening the route and accepting the report caused no write: SQL remained at version 1 with one revision and artifact. The synthetic ritual and its temple were removed after the check.
- The existing authorized creation form now offers ritual text when the pilot flag is enabled. It parses compact shortcuts to semantic JSON and submits a v3 create through the same retained-operation and publication-handoff path as legacy creation. An uncertain result retries the exact request; a success opens the visual editor. A real Chromium journey created a private two-task semantic ritual in the ordinary local development database. SQL showed one `magickli-semantic-json` revision and a two-task `json-rich-text` artifact. The synthetic ritual and temple were removed after verification.
- The visual toolbar can now insert section titles, summaries, to-dos and inline variable references using a labelled dialog. A Chromium journey inserted a summary inside a task, saw the ritual-source projection update, saved a new semantic revision and reloaded it without draft recovery. SQL showed two revisions and matching artifacts; the synthetic ritual and temple were then removed.

## Launch verification (1 October)

### Agreed launch scope (1 October)

- Launch online first with durable drafts and exact interrupted-save retries.
  Full offline authoring is follow-up work; it is not a flag-removal gate.
- Complete practical visual authoring: visual-first creation, image uploads,
  links, variable declarations/options, and editing common existing properties.
  Footnotes and unusual structures may use ritual source.
- Convert legacy rituals automatically on open, preserve Pug history on save,
  surface limitations clearly, and provide source/Pug fallback as appropriate.
- Audit a private production ritual/source corpus once before launch. Keep
  private exports outside Git and production access read-only.
- Run broad browser, performance, accessibility and adversarial review checks
  before launch. Subsequent changes use affected regression checks; physical
  mobile testing and further mobile polish are follow-up work. Do not rerun the
  entire acceptance matrix on every production push.

- The unchanged production Mongo backup supplied by the operator contains five current rituals and 59 revision records. All five current rituals passed exact stored-JRT conversion, ritual-text round-trip and actual visual-schema round-trip. The audit preserved 189 opaque blocks; none required source-only fallback or failed conversion. The backup was read-only and only `docs.bson` and `docRevisions.bson` were decoded. Private exports/audits are owner-only and ignored by Git. A current PostgreSQL export is an optional additional migration check, not evidence already obtained.
- Private audit commands: `node --import tsx scripts/export-legacy-ritual-corpus.ts <backup-dir> <private-output.json>`, then `node --import tsx scripts/audit-ritual-corpus.ts <private-output.json>`. For a current SQL snapshot use `pnpm exec loom env -- node --conditions=react-server --import tsx scripts/export-ritual-corpus.ts --output <private-output.json> [--production]`; the production option rejects local hosts before querying. Exports never print source content or credentials.
- Final full regression suite: 248 files passed, 4,920 tests passed and 17 skipped in 24.47s. Production webpack build, TypeScript and all 386 static pages passed. Changed TypeScript/TSX files passed Biome; `loom check --production` passed with existing pnpm-11 advisories. The host has Node 25.2.1 rather than the package's declared Node 24 range; production build/test results here use that existing host runtime.
- Real Chromium journeys exercised visual-first creation, select-variable options, selected-text links, scoped synthetic PNG upload/finalization, save/reload, authorized reader rendering and bundle publication against the ordinary development DB/bucket. The local production build also performed an automatic save/publication, withheld authoring from the Reader identity, rendered its 16px image from downloaded bundle bytes, and returned 404 to an anonymous finalized-file request.
- A synthetic long ritual based on the public Neophyte text has 136,143 semantic source bytes. The real production editor loaded it, accepted Hebrew text and undid the edit correctly. The automation input acknowledgement took 187ms including browser-control overhead; this is a desktop smoke measurement, not a keystroke or IME benchmark. A 390px viewport had no document horizontal overflow and kept the visual panel within the viewport; physical mobile typing remains unproven.
- The browser observed 49 Next script resources in the production long-editor page. Fetching those exact resources from the local production server with gzip negotiation returned 943,006 body bytes (2,999,277 decoded; 47 gzip, two identity). This includes shared application code and is not an editor-only increment or measured mobile transfer. Browser timing APIs were unavailable to the automation environment.
- Independent Astra High review and final Astra xhigh adversarial review found and reproduced delayed-upload, account-concealment, unsupported-mark, source-projection, publication retry, stale acknowledgement and undo/save defects. Fixes have targeted regressions; final review found no residual actionable defects in its scoped recheck.
- The final production build repeated keyboard access to the upload menu, split-mode authoring, save and automatic publication. Both synthetic rituals, their temple, dependent SQL history/receipts, attachment metadata and all five owned MinIO keys were removed after testing. External test-utility sessions were retired; seeded development identities remain. Production/Preview configuration and the supplied backup were untouched.

### Focus/resume follow-up (1 October)

- The reported Production revision `d25f8d92beff56b1f506fca2a40aac28b029fdc3`
  uses a closing focus/visibility refresh, which unmounts the legacy editor and
  preview. The fallback now restores CodeMirror state, cursor, Undo history,
  both pane positions and root position only after authorization confirms the
  same owner, account epoch, ritual, draft and exact source. Hard locks discard
  the presentation on sign-out, expiry, clock or storage failure; private
  source, title, preview and script access still disappear while access is
  uncertain. The locked shell keeps its height.
- Resume retains the last displayed preview while compilation catches up,
  restores expanded summaries before scroll, and retries when unsized images
  load. User scrolling, touch, pointer or keyboard input stops those retries.
  Observers/listeners are removed on lock or unmount. Repeated focus events
  cannot discard a pending replacement-view, CodeMirror measurement or
  image-scroll restoration. Same-owner account verification and cross-tab
  broadcasts can retain opaque presentation in memory; they cannot reveal it
  without a fresh capability and matching owner/epoch/draft/source.
- Real Chromium checks dispatched the window focus event through a temporary
  development-only control restricted to the synthetic fixtures. A second
  pass simulated visibility hide/return plus focus, exercising the application's
  account verification too: root scroll 72.5px, source scroll 6,086.5px,
  horizontal scroll 212.5px and preview scroll 2,160px all survived, and Undo
  returned the draft to clean. Source scroll and Undo survived actual
  CodeMirror recreation; an expanded summary stayed
  open at preview scroll 2,160px. Focus immediately after an edit also retained
  both positions. Semantic split kept page scroll 14,275px, source scroll
  3,161.5px and source selection, and visual Undo removed the inserted note.
  This exercises the actual browser lifecycle, not a physical OS window switch
  or the deployed revision. The temporary controls were removed; test-owned
  drafts and SQL fixtures were cleaned up.
- Focused regressions cover delayed remounts, precompile blur, expired/revoked
  capability locks, new account epochs, expanded summaries, delayed image
  geometry, user interaction cancellation and semantic split state. Final
  Astra xhigh review found no remaining actionable defect after the timing
  fixes. All 59 affected regressions passed; changed-file Biome, TypeScript and
  the production build passed. A brief authorization concealment remains
  intentional; manually switching real windows is still a useful release
  smoke check.

## Follow-up scope

- Full offline authoring needs a versioned semantic source envelope, repository storage tagged with its format, lifecycle recovery and a draft adapter. Fresh permission checks remain required; weakening them would bypass existing lease/account protections. Reader offline bundles remain supported.
- Physical iOS/Android keyboards, real IME composition, assistive-technology usability and further mobile polish need hands-on checks. Keyboard controls, dialog labels, account concealment and the narrow layout have automated/browser coverage.
- Future collaboration can use the stable semantic element IDs and Tiptap/ProseMirror model, but revision CAS is currently the concurrency policy; no CRDT merge or simultaneous collaborative authoring is promised.

`RITUAL_SEMANTIC_EDITOR` and runtime conditional branches have been removed. No migration is required. Start normal local development with `./dev`; use `./dev --init` for first-time initialization. See [local development](../scripts/local-development/README.md). No shared-package publication or deployment is included.
