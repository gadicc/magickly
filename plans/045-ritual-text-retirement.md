# Ritual Text retirement — 2 October 2026

Normal semantic authoring now uses bounded Ritual Pug. Creation and editing no
longer offer a source-syntax selector. Saved revisions remain semantic JSON;
no database or document-schema migration is needed. Legacy Pug editing remains
separate.

Ritual Text codecs, diagnostics and the explanatory page remain for older local
draft recovery. Clean same-base drafts reconcile reader content before conversion,
retaining document identities and source comments/separators. Valid dirty source
applies its edits before conversion. Incomplete or conflicting buffers remain
available for repair, download or explicit discard. Pending SQL requests retain
their exact original payload; source conversion waits for their outcome.

Clean annotations absent from an older draft/request JSON are retained as an
unsaved follow-up, including when confirming a receipt after the server revision
advanced. If a newer server revision prevents safe reconciliation, recovery is
kept for download. Retained malformed buffers are never silently treated as an
empty document.

Verification covers clean/dirty/conflicting/incomplete recovery, ID-less source,
annotations, immutable pending retries, stale receipts and Pug creation. The
editor/source regression tests, TypeScript check and Loom check pass. Loom emits
existing advisory warnings about a future pnpm 11 migration.

Next planned core editor work: shared reader/editor presentation. Full offline
authoring, collaboration and physical mobile/IME testing remain future work.
