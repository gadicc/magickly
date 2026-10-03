# Visual commands and future shared editor — 3 October 2026

Status: proposal and future extraction notes. No slash commands, keyboard
bindings, shared package changes or Markdown migration are implemented by this
note. The current ritual authoring/storage contracts remain in place.

## Visual typing commands

Proposed fast path: typing `/say hiero ` or `/do keryx ` at the start of a fresh
paragraph converts the command into a speech/action card on the final space,
places the caret in its empty body, and lets the author continue typing. The
command text is an editing gesture: saved JSON/Pug contain an ordinary task,
with the usual generated node ID. Source keeps its existing `Hiero:` and
`* Keryx` shortcuts.

Recommend a small `/` menu for discoverability: Speech and Action initially,
then their role choices using the existing catalog and assignment picker.
Arrow keys, Enter and Escape should work, with clickable/tappable choices.
Menus and typing shortcuts should run the same validated document command as
the toolbar. Additional commands such as Note can follow demonstrated demand.
No dedicated modifier-key bindings are chosen yet; avoid browser/OS conflicts.

### Behavior to resolve and verify before implementing

- Match a complete command paragraph, not a slash in existing prose. Preserve
  literal text on Escape, incomplete input or an unavailable command.
- Accept standard role keys/aliases and declared or already-used custom keys. Preserve exact
  case-sensitive custom identities before matching standard names/aliases.
  Unknown custom keys and ambiguous labels should require explicit choice
  rather than quietly converting a typo into a new assignment. Decide how
  much of the existing group/exclusion grammar belongs in the first fast path.
- A role label containing spaces should be chosen from the menu; the inline
  fast path uses a role key as its argument. Reuse semantic role validation.
- Never create nested tasks. At a paragraph outside a task, insert only where
  the parent schema accepts a task. At the end of an existing task, consider
  removing the command paragraph and inserting a sibling task. Mid-task
  paragraphs need an explicit split policy; do not silently redistribute the
  remaining content. Handle notes, lists and footnote projections deliberately.
- One undo restores the literal command; immediate Backspace should undo the
  automatic conversion. Continuing body typing has normal history behavior.
  Verify this in canonical parent history for collected footnotes too.
- Commands must respect source synchronization, read-only/access locks and IME
  composition, preserve existing content/selection, and avoid conversion on
  pasted literal command text by default. Test native typing and mobile IME.

Tiptap input rules support typed-pattern transformations and undo. Our installed
3.31.3 core exposes `InputRule`, `addInputRules()` and `undoInputRule()`; its rule
runner skips active composition. The app still needs its own schema-aware
transaction, role resolution and footnote/history integration.

References: [input rules](https://tiptap.dev/docs/editor/api/input-rules) and
[undoInputRule](https://tiptap.dev/docs/editor/api/commands/nodes-and-marks/undo-input-rule).
Relevant app code: `src/doc/tiptapRitualClient.ts`, `tiptapRitual.ts`,
`RitualVisualControls.tsx`, `TaskSettings.tsx`, `ritualRoles.ts`, and
`ritualBlocks/FootnotesForEditing.tsx`.

## Future Loom editor: intended scope

The user anticipates a later reusable editor for other apps. Its minimum scope
is comfortable basic rich text (bold/italic, lists, images); optional tables
and a few custom blocks may be added. Markdown is the likely source format for
those apps. This is a separate project from ritual authoring.

### Candidate shared responsibilities

- A small Tiptap-based editing foundation with optional extensions, toolbar
  hooks, keyboard/input-rule support, and accessible slash-menu interactions.
- A command registry with labels/search aliases, availability checks and an
  execution callback. Apps register their own commands, argument pickers and
  document transformations; the shared layer knows nothing about ritual roles.
- Optional visual/source/split presentation with a pluggable source adapter,
  diagnostics, composition handling, selection/history contracts and view
  preferences. Simple editors should not need a source panel or CodeMirror.
- Presentation hooks for custom reader/editor blocks so shared formatting can
  remain colocated while editing adds controls. Keep reader bundles free of
  editor dependencies.
- Image insertion hooks with app-provided upload/read authorization. Tables,
  source editing and heavier/custom features stay opt-in for small bundles.

### Magickli responsibilities

Keep ritual task/role/group semantics, Pug shortcuts, comments/blank separators,
ritual node IDs, variables, grades, collected footnote projections, legacy
conversion and corpus audits in Magickli or an explicit ritual adapter. The
ritual SQL revision/CAS/operation-receipt protocol, permissions, drafts,
publication and protected assets also remain app-owned. A reusable editor must
not pull these into the minimum feature set.

### Storage and extraction boundaries

Slash commands are editing UI; they do not determine a source format or become
stored command strings. A future Markdown adapter must explicitly define how
custom blocks and unsupported syntax round-trip, and must not silently discard
content that Markdown cannot represent. The canonical storage model for other
apps remains a future decision; Magickli continues to save semantic ritual JSON
and project it to Pug. Do not change its storage during an editor extraction.

Extract proven, independently usable pieces when a second app provides a real
consumer and its requirements are known. Start with that app's small feature
set, then add opt-in adapters. Evaluate actual mobile behavior, reader bundle
cost and round-trip fidelity before calling an extraction complete. Consult
Loom repository instructions and feature/API contracts when that work starts.
Shared package publication or deployment requires separate approval.
