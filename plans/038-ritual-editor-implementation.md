# Ritual editor pilot implementation — 25 September 2026

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
- SQL write protocol v3 accepts semantic JSON for create/save when `RITUAL_SEMANTIC_EDITOR=1`. It uses the same parent CAS, operation receipt, transaction, permission checks, and JRT profile-1 reader selection as v2. The legacy v2 compiler and its identity are unchanged. The v3 compiler has its own source format and fingerprinted implementation identity. The existing SQL columns already store source format/version, so no schema migration was needed. The operation lock namespace remains shared with v2, preventing concurrent reuse of an operation ID across protocols.
- The old Pug source delivery excludes semantic revisions, preventing it from loading JSON as Pug. Historical Pug revisions and artifacts remain intact.
- `/doc/<id>/edit/semantic` is a separate Next route behind `RITUAL_SEMANTIC_EDITOR=1`, with the Tiptap client bundle loaded dynamically. A legacy import checks that the source revision stayed current across the separate source and artifact reads. Visual, ritual-source, and split layouts share one semantic document. If both panels diverge, save stays disabled until the source is applied or discarded. A separate IndexedDB draft store retains the last valid semantic document, the source buffer, title, base revision/version, and exact pending request. Unknown save outcomes retry the same request, including after a reload observes a newer server revision. Older or invalid local drafts require explicit download/discard before editing. A draft-store load failure blocks editing. Account changes hide editor content; a fresh source grant is checked before display, on focus and every minute, and a denial hides it.

## Verification so far

- `pnpm test --configLoader runner`: 230 files passed, 4,788 tests passed, 17 skipped. The runner option avoids Vite's temporary config write under the isolated worktree's read-only `node_modules`. The standalone research trial's six Node tests also pass with their own runner and are excluded from Vitest. The SQL writer tests use disposable PGlite through the existing `tests/memory-pglite.ts` harness.
- `pnpm typecheck`: passed.
- `pnpm exec loom check`: passed with existing pnpm-11 advisory warnings.
- `pnpm build`: production webpack build, TypeScript, page-data collection, and all 386 static pages passed with the authorized `.env.local` linked into the isolated worktree.
- `pnpm exec biome check` passes for the six files changed during the live-browser fixes. The repository-wide `pnpm check` still fails on existing unformatted research files under `editor-trial/` (28 errors, 44 warnings); this pilot did not rewrite that research fixture.
- Targeted tests cover complete legacy import, actual ProseMirror schema round-trip, compact text round-trip, v3 SQL source/artifact binding and replay, invalid saves, protocol collision, feature flag, old-source fence, UI source application, immutable retry, and account switch hiding.
- A local Chromium check of `editor-trial/production.html` loaded the production Tiptap adapter on synthetic tasks. Backspace at the start of the second speech kept `hiero` and `keryx` as separate tasks and left reader JSON unchanged. The Vite fixture had to resolve the root Tiptap packages to avoid duplicate ProseMirror plugin instances; the app route uses one root dependency graph.
- The actual Next route was exercised against the opt-in local acceptance PostgreSQL database and Loom's local Creator login at `localhost:3004`. A disposable ritual was created through the existing UI, imported, edited with a source shortcut and visual typing, saved through v3, and reloaded. SQL shows a current `magickli-semantic-json` v1 revision with a matching `json-rich-text` reader artifact. The editor reloaded both tasks and no longer recreated a local draft after successful save. A 390px Chromium viewport showed the visual controls and stacked split panels. The old Pug editor withheld source for the semantic revision and linked to the new editor.
- In the same Next route, divergent source and visual edits disabled save, reload restored both drafts, and discarding the source kept the visual change for a successful save. The disposable ritual's semantic revision was published through the authorized publication API using the ordinary local MinIO configuration; the reader then rendered its current content. A separate browser journey uploaded a synthetic image through `/upload`, verified byte-for-byte authorized retrieval and anonymous denial, and exercised conditional presigned PUT rejection on replay. Those synthetic upload rows and objects were removed after verification.
- This local acceptance database had 17 migrations already applied and needed no new migration for this work. Loom's `LOOM_LOCAL_TEST_LOGIN` path supplied the Creator login without Google.

## Pilot gates still open

1. Complete the actual Next route browser matrix: copy/paste, task-boundary deletion, and offline draft recovery. Source/visual conflict resolution, reload recovery, publication, and reader delivery have been exercised. The local browser also logged an existing app-shell `MyAppBar` hydration mismatch unrelated to the editor.
2. Check physical iOS and Android keyboards, Hebrew/other IME composition, screen reader navigation, and nontechnical author tasks. The CSS stacks panels on narrow screens, but mobile usability is unproven.
3. Add author controls for the less common node attributes, variable declarations/options, images, notes, summaries, links and footnotes, plus a new-ritual creation flow. The complete source tree can represent these nodes and the v3 writer accepts creation, but the visual toolbar only exposes speech, action, note, role, bold and italic and the pilot page edits existing rituals.
4. Integrate the new draft store with the full offline lifecycle before widening the pilot. The pilot fails closed when its fresh permission check is unavailable, so it does not yet provide the old editor's offline authoring behavior. The writer independently rechecks permissions at save.
5. Review opaque legacy fallback and an opt-in import report before offering automatic conversion of arbitrary rituals. The built-in corpus and synthetic fixture do not prove every stored ritual can be edited safely.
6. Measure production Next route chunks and long-document interaction on target devices. The trial's Vite measurements do not establish production performance.

Keep `RITUAL_SEMANTIC_EDITOR` unset until these gates are complete. Once the editor is ready for everyone, remove the flag and its conditional branches and enable the route and v3 writer by default. Turning the flag off before the first semantic write is straightforward. After a semantic revision exists, the current reader can still render its JRT profile-1 artifact, but the semantic editing route is disabled with the flag; re-enabling the route or exporting the semantic source is required for recovery. No Loom extraction or deployment is part of this pilot.
