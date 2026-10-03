# Closer ritual WYSIWYG — 3 October 2026

This completes the footnote, list, TODO and line-break follow-up to
[shared ritual presentation](046-shared-ritual-presentation.md).

## What changed

The reader and visual editor share list spacing/markers, TODO formatting,
footnote references and collection frames. Ordered editor lists use a scoped
counter because ProseMirror's DOM wrappers otherwise restart native numbering.
Inline `br` nodes display real breaks.

Footnote references now appear in the sentence; their bodies appear in the
reader's collection position. Click a reference or “Edit footnote” to edit its
body there. Direct collections under a task display outside speech/action
formatting. The reader keeps collapsible collections; authoring exposes them.

## Storage and editing contract

The semantic tree, Pug, node identities, clipboard HTML and server schema stay
unchanged. Each original footnote retains its stable, hidden ProseMirror
contentDOM at its canonical position. The collected editor is a lazy projection:
changes, forward/backward selections, atom selections and caret formatting are
bridged into that original node. The parent owns history, source updates and
saving. There is no independent footnote draft or undo stack.

The two editors have different ProseMirror NodeType/MarkType identities even
with equivalent schemas, so the bridge converts through the destination schema.
Activating an empty editable note materializes an empty paragraph in the parent
without adding history; it disappears from semantic JSON and does not change
source. First typing remains undoable to the original empty semantic note.
Creation editability changes now emit the normal editor update, allowing an
open footnote to follow disable/re-enable immediately without emitting a source
change.

A shared planner follows the existing reader order. Explicit collections gather
preceding references; a task's direct collection is rendered after its body.
Collections encountered too early, orphan references and unsupported recursive
notes retain their existing reader reachability. The editor exposes uncollected
notes with a labelled editable fallback. This does not grant new attachment
access or change offline asset inventory rules. Empty reader collections render
safely. Fresh plans also avoid stale numbering caused by JRT's cached parent
pointers when a reader document is updated immutably.

Inactive footnote previews omit author annotations and contain opaque legacy
content, arbitrary image URLs and unsafe image styling. Scoped images retain
bounded previews. Changed preview bodies remount the legacy reader component
because JRT invokes hookful block renders directly and cannot safely reuse that
component across a changing task count.

## Verification

- 772 relevant tests pass; 14 existing opt-in tests remain skipped. Coverage
  includes reader/editor/clipboard/source, attachment reachability, empty note
  activation/typing/undo, caret formatting, backward and atom selections,
  external replacement, deletion, explicit destinations, read-only lifecycle
  and structural preview changes.
- Independent GPT-6.1 Sol xhigh review and final GPT-6 Astra xhigh adversarial
  review completed; concrete findings were fixed and retested.
- A real local Chromium fixture compared reader/editor output and verified
  native typing, paste, keyboard undo, toolbar formatting at a range and caret,
  Pug output, and source-to-footer updates. No database writes or file uploads.
  The test route and browser tab were removed.
- Production build (including TypeScript) and Loom check pass. Loom reports
  existing advisory pnpm 11 migration warnings.

## Deliberate differences and later work

Authoring still exposes summaries, variable tokens and source annotations, and
uses neutral role cards. Unusual legacy content remains source-only. Exact
performance output remains available in the reader preview.

The planned closer-WYSIWYG work is complete. Full offline authoring,
collaborative editing, physical mobile/IME and assistive-technology testing
remain future work. No database migration, push or deployment is required for
this presentation change. The earlier full local database create/save journey
remains separate from the synthetic rendering verification.
