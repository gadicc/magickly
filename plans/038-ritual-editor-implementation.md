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

- `pnpm test`: 229 files passed, 4,783 tests passed, 17 skipped. The standalone research trial's six Node tests also pass with their own runner and are excluded from Vitest.
- `pnpm typecheck`: passed.
- `pnpm exec loom check`: passed with existing pnpm-11 advisory warnings.
- `pnpm build`: webpack compilation and production TypeScript passed. Next page-data collection stopped because the isolated worktree has no `DATABASE_URL_DIRECT`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING`, or `DATABASE_URL`; no deployment or database connection was attempted.
- Targeted tests cover complete legacy import, actual ProseMirror schema round-trip, compact text round-trip, v3 SQL source/artifact binding and replay, invalid saves, protocol collision, feature flag, old-source fence, UI source application, immutable retry, and account switch hiding.
- A local Chromium check of `editor-trial/production.html` loaded the production Tiptap adapter on synthetic tasks. Backspace at the start of the second speech kept `hiero` and `keryx` as separate tasks and left reader JSON unchanged. The Vite fixture had to resolve the root Tiptap packages to avoid duplicate ProseMirror plugin instances; the app route uses one root dependency graph.

## Pilot gates still open

1. Test the actual Next route in a browser with a disposable SQL ritual and an authenticated account. Confirm save, reload, conflicts, source/visual switching, copy/paste, task-boundary deletion, reader output and offline draft recovery. The component test does not establish real contenteditable behavior.
2. Check physical iOS and Android keyboards, Hebrew/other IME composition, screen reader navigation, and nontechnical author tasks. The CSS stacks panels on narrow screens, but mobile usability is unproven.
3. Add author controls for the less common node attributes, variable declarations/options, images, notes, summaries, links and footnotes, plus a new-ritual creation flow. The complete source tree can represent these nodes and the v3 writer accepts creation, but the visual toolbar only exposes speech, action, note, role, bold and italic and the pilot page edits existing rituals.
4. Integrate the new draft store with the full offline lifecycle before widening the pilot. The pilot fails closed when its fresh permission check is unavailable, so it does not yet provide the old editor's offline authoring behavior. The writer independently rechecks permissions at save.
5. Review opaque legacy fallback and an opt-in import report before offering automatic conversion of arbitrary rituals. The built-in corpus and synthetic fixture do not prove every stored ritual can be edited safely.
6. Measure production Next route chunks and long-document interaction on target devices. The trial's Vite measurements do not establish production performance.

Keep `RITUAL_SEMANTIC_EDITOR` unset until these gates are reviewed. Turning the flag off before the first semantic write is straightforward. After a semantic revision exists, the current reader can still render its JRT profile-1 artifact, but the semantic editing route is disabled with the flag; re-enabling the route or exporting the semantic source is required for recovery. No Loom extraction or deployment is part of this pilot.
