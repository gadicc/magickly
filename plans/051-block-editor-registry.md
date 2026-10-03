# Block editor registry — 3 October 2026

Status: agreed direction for a future follow-up; no implementation started.
Introduce a small app-local registry when adding the next block command, then
evaluate reuse in Loom when a second app provides concrete requirements.

Related: [visual commands and future shared editor](050-visual-commands-and-shared-editor.md)
and [shared ritual presentation](046-shared-ritual-presentation.md).

## Goal

Let each block colocate its reader/editor presentation, commands, shortcuts and
actions. Adding a Note command should not require extending a central plugin's
Say/Do branches. Preserve shared formatting and the existing semantic JSON/Pug
contract while keeping reader bundles free of editor dependencies.

## Current structure

- `src/doc/blocks.jsx`: JRT reader block definitions and `render()` adapters.
- `src/doc/ritualBlocks/Frames.tsx`: shared reader/editor appearance.
- `src/doc/ritualBlocks/renderForEditing.tsx`: central editor renderer dispatch.
- `src/doc/ritualSlashCommands.ts`: explicit Say/Do choices, matching, role
  arguments, menu, insertion policy, keyboard handling and history recovery.
- `src/doc/ritualTaskCommands.ts`: validated task construction shared with the
  toolbar, plus deletion by stable identity.
- `src/doc/ritualRoleCatalog.ts`: role choices shared by commands and settings.
- `src/doc/tiptapRitualClient.ts`: installs client renderers and slash extension.
- `src/doc/ritualPugSurface.ts` and `ritualPug.ts`: source shortcuts and printing.

The editor schema groups semantic tags into a few Tiptap node types. A block
registry need not introduce one new Tiptap node type per semantic tag. Say and
Do are two commands for the same Task block.

## Proposed organization

Illustrative layout, to refine during implementation:

```text
ritualBlocks/task/
  definition.ts          semantic metadata; editor-free
  Frame.tsx              shared appearance
  render.tsx             reader adapter
  renderForEditing.tsx   editor adapter and controls
  commands.ts            Say/Do insertion and task actions

ritualBlocks/readerRegistry.ts
ritualBlocks/editorRegistry.ts
editorCommands/registry.ts
editorCommands/slashMenu.ts
```

Use explicit registration through separate entry points. Keep editor rendering,
Tiptap imports, menus and shortcut handlers out of the reader import graph.
Colocation does not require a single runtime object importing every adapter.
Existing Frames can stay shared until moving them provides a clear benefit.

## Registry responsibilities

Each block's editor contribution may supply:

- Stable command IDs independent of labels, plus labels and search aliases.
- Slash names and optional typed-pattern or keyboard bindings.
- Argument resolution and picker contributions; Task supplies the role catalog.
- Availability checks, preparation and execution for each action.
- Toolbar and block-menu placement metadata, plus its editing renderer.

Start with the smallest types needed for Task and one additional block. Commands
may insert, update or delete; do not require every action to be a paragraph
replacement. Avoid a general grammar or plugin framework before it is needed.

The shared engine handles menu/navigation/focus, composition, editability and
transaction/history integration. Blocks supply semantic construction and
container policy. A Task must become a sibling rather than nest; a Note may
allow nesting. Schema acceptance alone does not enforce all ritual rules.

Slash, toolbar and keyboard entry points should invoke the same underlying
action. An entry point may have additional eligibility rules: typed conversion
still requires a complete eligible command paragraph. Keep availability checks
side-effect free; revalidate against current selection, identity and permissions
when executing. Do not retain stale positions while an argument picker is open.

## Contracts to preserve

- Commands remain editing gestures; saved JSON/Pug contain semantic nodes.
- Source shortcuts use a separate parser/printer adapter, with source locations,
  comments, blank separators and round-trip fidelity intact. Share domain
  validation and construction where useful without coupling source parsing to
  editor UI. Source and visual shortcuts need not have identical syntax.
- Keep source synchronization and access locks effective at execution time.
- Preserve literal text for incomplete/unknown commands, Escape and unavailable
  contexts. Pasted command strings do not automatically convert.
- Preserve native IME behavior, empty task caret slots and continued typing.
- Conversion remains one separate canonical undo step; immediate Backspace can
  restore the literal command. Selection and later edits invalidate recovery
  appropriately. Other actions need explicit history policy.
- Collected footnotes retain canonical ownership, ancestor constraints, selection
  mapping and history. Do not make the generic engine assume local editor state
  is always the canonical document.
- Preserve IDs on updates/moves and allocate fresh IDs on insertion/duplication.
  Source annotations and footnote references require deliberate handling.
- Keep deletion Undo valid only for the matching latest edit; retain read-only
  and source synchronization guards.

## Research before implementation

1. Compare the installed Tiptap extension commands, input rules, keyboard
   bindings and suggestion facilities with our custom plugin. Consult current
   official Tiptap/ProseMirror documentation and installed code. Choose based
   on canonical footnote history, typed-space conversion, Escape and Backspace
   requirements; retain the custom engine if alternatives complicate them.
2. Prototype Task plus a simple Note command. Determine whether pure content
   constructors and a few placement policies suffice, or transaction callbacks
   are needed. Specify how commands query availability without allocating IDs
   or dispatching changes, and how execution reports a rejected action.
3. Specify argument-picker lifetime, cancellation and stale-selection behavior.
   Check multiword labels, exact custom role identities, aliases and reserved
   groups. Keep detailed include/exclude assignments in settings unless demand
   justifies richer slash arguments.
4. Define duplicate command-name/binding detection, deterministic ordering and
   precedence. Check browser/OS conflicts before assigning modifier shortcuts.
   Consider configurable bindings only when there is a demonstrated need.
5. Check keyboard, screen-reader, touch and real mobile IME behavior against
   relevant accessibility guidance. Decide whether slash menus remain distinct
   from future block actions such as Duplicate/Move.
6. Inspect reader and minimal-editor import graphs and build output. Measure the
   cost of the registry/menu and optional argument pickers. Do not make basic
   rich-text consumers load ritual code, CodeMirror or a source panel.
7. Assess future collaboration without implementing it here: command actions
   should produce normal document transactions, use stable identities and avoid
   position-based delayed writes. Collaborative Undo and footnote projections
   need their own design; a registry alone does not solve them.

Produce a short decision note and the smallest useful prototype before fixing
the public interface. This list is future research, not completed validation.

## Incremental implementation and acceptance

1. Reconstruct current code/tests and record existing command behavior.
2. Extract Task contributions behind an app-local registry, preserving behavior.
3. Route slash and toolbar task insertion through the shared action boundary.
   Keep contextual differences explicit; migrate cog actions where useful.
4. Add the next requested block command as proof the registry generalizes.
5. Move renderer dispatch into block contributions incrementally if worthwhile;
   a wholesale JRT/schema/source rewrite is unnecessary for this follow-up.

Verify native typing, menu keyboard/click/tap, argument selection, Escape,
unknown/pasted commands, Undo/Redo and immediate Backspace. Cover root/nested
containers, trailing task siblings, forbidden mid-task/list insertion and
canonical collected footnotes. Check stale pickers, locks, empty bodies, source
equivalence, ID preservation and reader bundle boundaries. Run relevant tests,
typecheck, Loom checks and build, plus real browser checks of changed gestures.
Use independent and final/adversarial review for the eventual implementation.

## Future Loom boundary

Potential shared pieces: registry types, menu/navigation, optional shortcut
handling and editor presentation hooks. Magickli retains ritual roles/groups,
Task placement, Pug, annotations, IDs, footnote projection, persistence and
authorization. A generic engine can accept ownership/history adapters rather
than importing those policies.

Extract after testing with a real second consumer using basic rich text and
optional custom blocks. Source adapters, tables and menus stay opt-in. Read the
Loom checkout's instructions and evaluate its existing APIs before changing it;
shared package publication and deployment require separate approval.
