# Pug shortcuts and author annotations

Implemented October 2026, extending plan 042.

## Authoring contract

Canonical Pug uses `hiero#ID: speech` and `* keryx#ID action` when the role and
children fit those shortcuts. Full IDs remain in saved source and are folded
visually. Explicit `say`/`do` remains available for complex children or roles
that cannot be printed safely as shortcuts. Historic role normalization lowers
the first letter of each comma-separated role. Supported Pug tag names retain
their colon block-expansion syntax.

`//-` author comments and blank source lines are semantic annotations. They
survive visual edits, saving and switching between Pug and Ritual Text, and are
omitted from the reader tree. These separators organize source; `br` remains a
reader-visible line break. Literal Pug text blocks and multiline attribute
values preserve their existing content whitespace. The final newline alone is
a source envelope, not a section separator.

Annotations have no persistent node IDs. The visual editor displays selectable
comment/separator markers; comment wording is edited in source. Multiline
comments can use the generated exact `ritualComment(value=...)/` wrapper.
Unsupported placement inside inline-only content uses the existing visual
compatibility gate rather than discarding annotations.

Semantic JSON remains revision authority. No SQL or IndexedDB schema migration,
historical source rewrite, or reader artifact rewrite is required.

## Draft and pending save recovery

Older clean Pug drafts recover annotations from their retained source only when
the complete reader tree agrees. Existing node IDs are restored. Pending SQL
request bytes and operation IDs remain unchanged. Confirming that earlier
request can atomically retain recovered annotations as a follow-up local draft.
The author must save that follow-up separately.

Replayed receipts permit rebasing only against the exact displayed server
revision. Missing or superseded draft slots reject follow-up storage. A rejected
follow-up is available as a manual download and never enters access-lock draft
persistence, protecting a newer draft from being overwritten.

## Verification

- 682 affected editor/source/SQL/admin regression tests passed; 14 existing
  opt-in tests were skipped. Disposable PGlite verifies stored annotation JSON,
  immutable request replay and reader omission. Fake IndexedDB verifies atomic
  follow-up retention and competing-draft protection.
- Independent adversarial review covered syntax contexts, inline content,
  identity folding, malformed input and draft recovery. It exercised 2,000
  annotation trees and 8,000 awkward-text task shortcuts. Its final focused
  rerun passed 88 tests with no residual actionable findings.
- TypeScript, changed-file formatting and an isolated production webpack build
  passed. Loom production validation passed with existing pnpm 11 advisories.
- A temporary synthetic browser page using the actual creation editor verified
  source-to-visual edits, visual-to-source edits, folded shortcut IDs and retained
  comments/separators. The page and browser tab were removed afterward.

The normal local creation page reported creation unavailable, so a complete
live browser create/save journey was not verified in this pass. The authoritative
local database verification task passed; the creation endpoint's runtime failure
remains undiagnosed. No local database or storage fixtures were created for this
pass. Physical mobile keyboard and IME behavior remains unverified.
