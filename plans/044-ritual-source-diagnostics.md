# Ritual source diagnostics

Implemented October 2026, extending the shared source editor from plans 042–043.

## Behavior

- Both new and existing rituals show CodeMirror red underlines, error gutter
  markers and hover details. The existing last-valid visual document behavior
  remains intact.
- Go to error and F8 navigate to the reported range; Shift+F8 goes backwards.
  Problems opens the native lint list, also available through Ctrl+Shift+M or
  Cmd+Shift+M. Selecting an error reveals its folded ID, including clicks and
  arrow navigation inside Problems.
- Problems stays open during ordinary typing, ID visibility changes and
  read-only reconfiguration. Corrected or superseded diagnostics clear.
- Diagnostics belong to the exact buffer that produced them. Typing clears old
  markers while validation catches up; IME continues to defer application until
  composition ends. Error messages remain sanitized.

## Location contract

Pug lexer coordinates map back through shortcut expansion and multiline comment
compaction. Parser-owned WeakMaps retain node/ID locations while resolving the
existing semantic validator's paths. Ritual Text semantic errors also resolve
their source lines. This metadata is never persisted in semantic JSON.

Tokens are underlined when their column is known. Line-only errors underline
the line's content, and end-of-line errors use CodeMirror's point marker.
Semantic attribute validation identifies a node rather than a specific invalid
attribute key; those errors therefore mark the node's line. Document-level
resource errors remain document-level diagnostics. Parsing validity and the
semantic compiler version are unchanged; no migration is needed.

## Evidence

- 692 affected codec/editor/persistence tests passed; 14 existing opt-in tests
  skipped. The final folding/navigation change separately passed all 12 real
  CodeMirror component tests, including Problems clicks and F8.
- Independent review found and prompted fixes for locationless semantic errors,
  a Problems panel lost during reconfiguration, and folded errors selected from
  Problems. Its broader rerun passed 108 tests and 20 extra coordinate checks.
  Final review confirmed repeated navigation also reveals a selected error
  after refolding, with no residual actionable findings.
- TypeScript, changed-file formatting, Loom production validation and an
  isolated production webpack build passed. Existing Loom pnpm migration
  advisories remain unchanged.
- A temporary browser page using the actual creation editor verified unknown-tag
  underlines, gutter markers, tooltip, error navigation, Problems persistence
  and recovery after source correction. It created no database/storage objects;
  the page and browser tab were removed afterward.

Native mobile keyboards, physical IME input and device-specific F8 handling are
not covered by the browser fixture; the visible navigation buttons remain
available without keyboard shortcuts.
