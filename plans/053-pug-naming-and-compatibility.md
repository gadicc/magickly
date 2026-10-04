# Pug naming and compatibility — 4 October 2026

The three bundled ritual sources now use `.pug`; their bytes are unchanged.
Imports, TypeScript declarations, webpack raw-text loading and corpus tests use
the new extension. Turbopack retains its native `with { type: "text" }` imports.
Ritual IDs, reader URLs and database storage formats are unchanged.

Current starters and guide examples live in `ritualPugExamples.ts`. Retired
Ritual Text authoring examples and its help page were removed. The old help URL
redirects to the Pug guide; the editor links only to the current guide. Ordinary
successful saves say “Saved.” Recovery-specific messages remain detailed.

## Preservation is still in use

A fresh count-only check of the three bundled rituals found four opaque legacy
nodes. Their current Pug projections emitted 2,040 `ritualText(...)` wrappers.
The wrappers preserve exact text and boundaries; their name does not mean the
retired Ritual Text authoring syntax. Emission counts alone do not establish
that every wrapper could never be simplified.

The earlier approved production backup audit covered five current rituals and
found 189 opaque blocks (plan 038). The later Pug audit retained their exact
reader trees and semantic documents (plan 042). These are historical backup
results, not a fresh audit of the current production PostgreSQL database.

Keep preservation until supported representations can replace every relevant
payload without changing reader content, IDs, references, whitespace or source
annotations. A zero count among new rituals would not establish safety for old
revisions, exports or offline bundles.

## Checking whether Ritual Text draft recovery can retire

Old authoring buffers live in browser IndexedDB, independently of server
revisions. The server cannot prove that every browser has converted its drafts.

Before deciding to remove recovery:

1. Inventory each used browser/profile and origin, including development and
   production. Read the `magickli-semantic-editor-v1` draft store using a reviewed
   local diagnostic, without modifying or logging source/private identifiers.
   Report counts for explicit `ritual-text` dialects, missing dialects whose
   header is `ritual 1`, dirty/conflicting buffers, stale bases and pending saves.
   Include retained creation forms as well as existing-ritual drafts.
2. Open each affected draft as its owning account and use the existing guarded
   conversion/retry flow. Download unresolved buffers before manual repair or
   explicit discard. Pending operations must retain their exact original
   requests until their outcomes are confirmed; never rewrite them in place.
3. Recheck counts after conversion. Account for dormant browsers and restored
   backups. If they cannot be inventoried, retain an import/recovery path rather
   than silently making their stored work unreadable. Optional future usage
   counts should be aggregate-only and deliberately designed, not source logs.
4. Decide separately whether to remove automatic startup recovery or the codec.
   A small explicit recovery/import tool may cover older exported drafts after
   normal startup stops supporting them.

Do not delete local stores, advance their schema to discard records, or assume
that a server save removed drafts from every client. Existing recovery tests
remain in place throughout this naming cleanup.

## Checking whether preservation can simplify

Use a fresh authorized private export and audit current heads, retained history,
supported imports/backups and relevant offline artifacts. Existing export/audit
scripts provide a starting point; `audit-ritual-corpus.ts` still checks the old
Ritual Text round trip, so a future retirement audit must also check current
Pug and classify opaque payloads/exact-text requirements. Do not treat its old
round-trip check as proof that the codec is unused.

Keep private exports outside Git with owner-only permissions and expose only
aggregate results. For each proposed simplification, require exact semantic and
reader-tree equivalence plus round trips covering whitespace, Unicode, IDs,
comments and blank separators. A schema-supported replacement needs explicit
migration and rollback design before removing the fallback.

No production or browser draft inventory, migration, recovery removal or shared
package publication is performed by this cleanup.

## Verification

Full coverage exits 0 with 5,263 passing tests and all per-file thresholds met.
The production webpack build, including its TypeScript check and 388 generated
pages, passes. Built manifests confirm the 308 help redirect, removal of the
retired page and prerendering of all three bundled rituals. Scoped Biome, Loom
checks and diff whitespace checks pass; Loom retains its pnpm 11 advisories.

Run coverage and builds sequentially: the data-package cleanup test exercises
the shared generated output directory, and a concurrent build can remove its
synthetic stray files first. The first build also exposed a stale development
type validator for the deleted page; removing that generated cache allowed the
current production types to validate normally.
