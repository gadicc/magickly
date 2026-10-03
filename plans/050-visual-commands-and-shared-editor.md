# Visual commands and future shared editor — 3 October 2026

Status: visual Say/Do commands and task deletion implemented locally. Future
Loom extraction, dedicated modifier bindings, duplicate/move actions and drag
reordering remain follow-ups. The ritual authoring/storage contracts remain in
place; no shared package changes or Markdown migration.

The follow-up structure for block-owned commands, editor registries and research
is recorded separately in [Block editor registry](051-block-editor-registry.md).

## Visual typing commands

Implemented fast path: typing `/say hiero ` or `/do keryx ` at the start of a fresh
paragraph converts the command into a speech/action card on the final space,
places the caret in its empty body, and lets the author continue typing. The
command text is an editing gesture: saved JSON/Pug contain an ordinary task,
with the usual generated node ID. Source keeps its existing `Hiero:` and
`* Keryx` shortcuts.

The small `/` menu offers Speech and Action, then role choices from the
existing catalog. Arrow keys, Enter and Escape work, with clickable/tappable
choices. Menus and typing shortcuts share validated task construction with the
toolbar; slash insertion additionally checks its paragraph and container. Additional commands such as Note can follow demonstrated demand.
No dedicated modifier-key bindings are chosen yet; avoid browser/OS conflicts.

### Interaction contract and implementation boundaries

- Match a complete command paragraph, not a slash in existing prose. Preserve
  literal text on Escape, incomplete input or an unavailable command.
- Accept standard role keys/aliases and declared or already-used custom keys. Preserve exact
  case-sensitive custom identities before matching standard names/aliases.
  Unknown custom keys stay literal. The fast path supports one known role,
  `all`, or `all-officers`; detailed include/exclude assignments use the cog.
- A role label containing spaces should be chosen from the menu; the inline
  fast path uses a role key as its argument. Reuse semantic role validation.
- Never create nested tasks. At a paragraph outside a task, insert only where
  the parent schema accepts a task. A final direct task paragraph is removed
  and replaced with a sibling task. Mid-task
  paragraphs need an explicit split policy; do not silently redistribute the
  remaining content. Handle notes, lists and footnote projections deliberately.
- One undo restores the literal command; immediate Backspace should undo the
  automatic conversion. Continuing body typing has normal history behavior.
  Verify this in canonical parent history for collected footnotes too.
- Commands must respect source synchronization, read-only/access locks and IME
  composition, preserve existing content/selection, and avoid conversion on
  pasted literal command text by default. Test native typing and mobile IME.

The implementation uses a visual-only ProseMirror plugin for the menu and
native single-space typing, and the same validated task constructor as toolbar
insertion. Conversion gets a separate canonical history step; immediate
Backspace invokes that step's Undo only while the canonical document has not
changed. Selection mirrors that leave the cursor unchanged retain recovery.
Mid-task splitting and list insertion are deliberately deferred. Within a
collected footnote, ancestry outside the projected note also constrains task
insertion. Pasted command strings and composition do not trigger conversion.

Delete task lives at the bottom of the cog, separate from Apply. It locates the
current task by ID, deletes its complete subtree, places the cursor nearby and
creates one canonical undo step. A six-second notification offers Undo only
while that deletion remains the latest edit. No confirmation is needed for this
recoverable edit; deletion does not remove stored assets. Source synchronization
and access locks gate both actions.

Tiptap input rules support typed-pattern transformations and undo. Our installed
3.31.3 core exposes `InputRule`, `addInputRules()` and `undoInputRule()`; its rule
runner skips active composition. This app uses an explicit plugin transaction
instead, to control role resolution, container boundaries and canonical
footnote history together.

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

## Block actions follow-up

Add Duplicate and Move actions when needed, likely in a block actions overflow
menu shared with Delete. Duplicate must allocate fresh identities throughout
the copied subtree and define how references/footnotes follow the copy. Move
must retain IDs and annotations and be one undoable operation.

Explore visual drag reordering at paragraph/top-block level first. Provide
keyboard Move up/down and accessible touch alternatives; do not rely solely on
a small drag handle. Respect container schemas and canonical footnote locations,
prevent accidental nesting, and preserve source annotations and selection.
Nested moves, collaborative ordering and cross-document moves require separate
scope. Keep these app-level semantics out of the future minimal Loom editor;
a shared layer may provide handles/commands while apps validate transformations.


## Verification

193 relevant tests pass across the editor, task controls, Pug/clipboard adapters
and shared rendering. Typecheck, scoped Biome checks, Loom checks and the
production build pass. The sandbox build's TypeScript subprocess returned
empty output; the same project build outside the sandbox completed normally.

Desktop browser checks with a synthetic, unsaved fixture cover native slash
typing, continued body typing, immediate Backspace, trailing task sibling
insertion, keyboard/click menu choices, deletion, keyboard and notification
Undo (including restored IDs and focus), and collected-footnote sibling
conversion/Backspace. Test-only route and browser tab are removed. No database
fixtures, uploads or production records were changed. Real mobile keyboards,
IME interaction and assistive technology remain manual follow-ups.

Independent Sol xhigh and final/adversarial Astra xhigh reviews are clear after
fixing projected/local ancestor boundaries, canonical footnote history recovery,
reserved group labels, stale notification clicks, and menu scroll retention.


## Empty task caret slots — 3 October 2026

A follow-up fixed empty Say/Do cards that could not receive a mouse caret.
Imported empty semantic tasks now receive one empty paragraph in the editor;
that slot projects back to the original empty semantic children. Empty body
slots override inline reader formatting with a full clickable line and a quiet
CSS-only speech/action hint. Populated cards retain their reader-like layout.

Pointer entry can also repair a raw zero-child task from clipboard/history,
without recording a content edit. The collected-footnote bridge forwards that
nonhistory policy to its canonical owner. Current task identity and root/owner
editability are checked before changing selection or materializing the slot.

79 relevant tests pass, including semantic equivalence, Say/Do click/typing,
Undo to empty, raw-zero/read-only behavior and collected-footnote repair without
an extra canonical Undo step. Native desktop browser clicks and typing into
both empty body types succeed without modifying the following populated task;
Undo restores the empty hint. Temporary fixture and tab are removed.
