# Ritual node identities and retained Pug — 2 October 2026

## Accepted identity choice

New ritual nodes use secure Nano ID generation with 16 characters drawn from
`0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`. IDs are
case-sensitive. This provides about 95.3 bits of randomness, assuming uniform
generation. The app pins Nano ID 6.0.1 and uses its secure `customAlphabet` API,
including its browser export; it never uses the non-secure generator.

`src/doc/ritualNodeIds.ts` owns this domain policy. Existing canonical lowercase
UUIDv7 node identities remain valid and are preserved on import from semantic
JSON, source round trips, editor normalization and clipboard parsing. Duplicate
blocks receive new short IDs. Legacy JRT imports have no semantic identities,
so they receive short IDs when opened for semantic editing.

Database record identities, ritual/user/file/revision IDs, operation IDs,
publication handoffs and offline account/lease identities remain UUIDs. No SQL
migration or saved ritual rewrite is needed for this change. Existing dirty
source buffers and immutable pending requests are not modified.

Ritual Text accepts both identity forms in structural, shortcut, inline and
opaque commands. The saved semantic JSON remains format version 1 with an
additive identity validator; reader output remains JRT profile 1. The compiler
fingerprint now binds the updated semantic model and ritual identity module,
in addition to the compiler implementation. Previously compiled artifacts are
retained. An older editor cannot author documents containing the new IDs; users
need the updated application before editing such a revision. Returning to an
older application would require accounting for new-format identities.

## Original Pug versus regenerated source

The SQL schema retains immutable source revisions with their source format,
format version and hash. Creating a semantic revision does not replace an
earlier Pug revision. The approved private Mongo export also contains all five
original Pug sources and their archived reader trees. This inspection did not
query the live Production database or change any database records.

Both source and content hashes validate for all five backup entries. Importing
their stored reader trees with short IDs, compiling back to JRT, and round
tripping through Ritual Text preserves all five exactly.

Recompiling the original Pug with the current legacy compiler is not an exact
match for any of the five archived reader trees. Aggregate comparison found no
text changes, node-type changes or child-count changes. Differences include 152
stored `forMe` attributes and one missing-versus-empty child collection. Removing
`forMe` makes four of five trees equal; these differences should not be silently
discarded merely because the source is old and no ritual was intentionally
edited. No source content, names or identifiers were printed during comparison.

Recommended route: use the selected semantic/reader tree as authority and
generate the new bounded Pug projection from it. Retain original Pug as a
historical reference and conversion cross-check. A legacy import should continue
to use its retained reader tree and exact conversion report. Do not overwrite
current revisions or regenerate existing semantic IDs from a backup.

This identity change does not roll out the Pug projection, ID folding or shared
reader/editor presentation. Those remain the next implementation stages in
[the source/rendering proposal](040-ritual-source-and-rendering-research.md).
Historical measurement artifacts in that proposal retain their full UUID
baseline explicitly; source trial parsers accept both identity forms.

## Verification

- 630 editor, source, reader and SQL tests passed; 14 opt-in Mongo tests skipped.
- One additional mixed-identity compiler boundary regression passed afterward.
- 33 isolated source-format research checks passed.
- TypeScript and Loom production configuration checks passed.
- Independent adversarial review checked identity compatibility, paste repair,
  compiler output parity and the secure browser entry point.
- All five approved private backup trees retain exact JRT and source parity
  with new short identities; no database changes were made.

No physical mobile input journey or full production build was run for this
identity-only change. The actual Tiptap DOM/clipboard/undo paths are covered in
jsdom, and the installed browser-condition generator was checked independently.
