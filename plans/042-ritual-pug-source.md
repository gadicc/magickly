# Ritual Pug source projection

Implemented October 2026, following the source-format comparison in plan 040
and the identity contract in plan 041.

## Contract

Semantic JSON remains the saved revision authority. New authoring and existing
semantic editors default to an app-owned, bounded Pug projection with the header
`//- magickli-ritual-pug 1`. This changes neither the SQL write protocol nor the
reader compiler. No database migration or production data rewrite is required.
The retained semantic/reader tree supplies the projection; backup Pug does not
replace it. Existing legacy Pug editing remains available separately.

The projection supports indentation, literal JSON attributes, `say`/`do`
aliases, inline `#[…]`, and `#id` identity shorthand. Node identity is stripped
from reader attributes. Existing canonical UUIDv7 IDs remain unchanged; omitted
identities allocate the accepted secure 16-character alphanumeric IDs.
`ritualText` preserves exact whitespace and text boundaries. `ritualLegacy`
preserves opaque JSON. Absent and empty child collections remain distinct.
No JavaScript, include, mixin, template expression, or raw HTML is executed.
Diagnostics do not include private source excerpts.

Parser bounds cover source length, indentation, recursive inline lexing,
token count, and semantic depth/node count. The source limit allows indentation
expansion of a saveable semantic tree. Canonical printing switches complex
inline groups to indented children before the lexer recursion limit is reached.

## Editing and recovery

Source remains on the left in split mode. Valid source updates the visual panel
after the existing typing pause; incomplete source keeps the last valid tree.
The source component uses an owned CodeMirror view. External projections apply
synchronously, map selection through the changed span, and reset source history.
This prevents Undo restoring a different syntax and eliminates the installed
React wrapper's delayed-value overwrite after Discard. Ordinary typing Undo,
selection, folding, and full-source copy remain available.

Identities fold into `#…` widgets. One identity or all identities can be shown.
The underlying source and draft downloads retain complete IDs. Only lexer-owned
identity spans fold; text and quoted payload lookalikes do not. During incomplete
syntax, mapped folds remain only while their bytes are unchanged.

Drafts add an optional `sourceDialect` field without changing IndexedDB schema.
Older Ritual Text drafts recover in their original syntax, including incomplete
buffers, conflicts, and pending SQL requests. Dialect switching waits for source
changes to be applied/discarded and pending requests to be resolved. Pending
request bytes and operation IDs remain unchanged. Unsupported future dialects
use manual recovery.

New rituals have a Pug starter. `/help/ritual-pug` explains the syntax, identity
folding, literal preservation, comments, and compatibility. The original
implementation retained comments and chosen spacing only in the source buffer.
Plan 043 adds semantic annotations for comments and blank section separators,
preserving them through visual regeneration and syntax switching.

## Evidence

- Built-in ritual reader trees and node IDs round-trip exactly.
- All five approved private backup rituals preserve the archived reader tree
  and semantic document exactly. All 1,685 identity spans match their source.
  Only aggregate audit results were exposed.
- Independent Astra adversarial review included 8,000 awkward-text synthetic
  round trips and actual CodeMirror timing/history reproductions.
- 701 editor/source/SQL regression tests passed; 14 existing opt-in tests
  were skipped. TypeScript and formatting checks passed.
- Regression coverage includes source syntax switching, old incomplete draft
  recovery, pending request replay, copied full IDs, selection, read-only
  updates, malformed-source folds, inline resource bounds, and large indented
  projections.
- A production webpack build was run in an isolated temporary copy, preserving
  the running development server.
- Loom consumer validation passed with the existing pnpm 11 migration advisories.

The local browser journey verified creation, bidirectional split updates, full
ID copy, reveal, save/reopen, and syntax switching/Undo. Desktop and 390-pixel
layout checks passed. The synthetic ritual, temple and dependent SQL rows were
cleaned after verifying ownership; this image-free fixture created no storage
objects. The guide was verified in the browser.

Physical mobile keyboards/IME are not covered by the desktop browser journey.
Reader/editing presentation sharing remains a separate planned stage.
