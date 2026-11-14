# Private research engine boundary

The public app contains reusable source-aware research code and synthetic tests.
Actual collection identities, catalogs, private experiments, bibliography
observations, source-specific questions, review labels and identifying reports
belong in a separate private workspace. Bulk source/derived data and retained
payloads stay outside Git altogether. No private experiment history is required
for this public code to build or test.

The application adapter is local/operator-only and disabled by default. It accepts
independently adopted server configuration and current source permissions; it
contains no built-in collection, operator binding or model allowance. Public
answers must use a separately approved public collection. Hiding filenames alone
cannot prevent collection inference from answer text or citations.

Public tests use fictional documents/accounts and a historical public pricing
fixture. They verify contracts, authorization, budgets, retained reads and failure
behavior. They do not establish corpus accuracy or confer source rights. Actual
private corpus evaluation and immutable evidence remain a separate test layer.

Before public publication, review the new commit tree and ancestry, examples,
fixtures, docs, logs, generated outputs and build traces for collection-identifying
material. Keep any collection-specific audit dictionary itself private. A clean
export must not merge private research commits into its history.

The generic section diagnostic is exploratory and unregistered. Its narrow grammar
can miss unsupported heading forms; canonical interval coverage is not semantic
or structural completeness. No hosted run or source processing profile is adopted.

Research migrations are additive empty tables and related constraints/functions.
The existing main release workflow runs migrations regardless of feature enablement;
merging/releasing this adapter therefore requires a separate schema decision. No
migration, reindex, source grant or production activation is performed by preparing
or testing this branch.

## Integration and release proposal

Keep the additive migrations together with the generic engine, and leave research
unconfigured on the hosted app. This keeps the schema journal coherent and lets
normal CI exercise the shipped contracts. Approval to prepare this candidate is
separate from approval to merge it into the production release branch.

| Migration | New objects | Purpose |
| --- | --- | --- |
| 0021 | `chat_research_windows`, `chat_research_permits` | Finite request accounting, reservations and dispatch state |
| 0022 | `chat_research_source_policies`; policy function and three triggers | Versioned source permissions and protection against resets |
| 0023 | `chat_research_artifacts`; artifact function and three triggers | Bounded retained packets and expired one-way tombstones |
| 0024 | `chat_research_maintenance`; maintenance function and two triggers | Cleanup target ownership and finite coverage evidence |

The four files create five empty tables, three trigger functions, eight triggers
and nine indexes including primary keys. Their foreign keys, indexes and triggers
attach only to the new research tables. They do not rewrite old application data,
create extensions, copy a collection, grant source access, install a schedule or
activate a model allowance. They use the existing `uuid_generate_v7()` dependency.

No `GRANT`, `REVOKE` or row-level security policy is installed by these files.
New table privileges depend on the actual migration owner and its default ACLs;
a feature flag is not database isolation. The current local-only gate also refuses
hosted Vercel/CI activation. No private corpus configuration belongs in hosted
variables or this repository.

## Upgrade evidence

`tests/chat-research/migrationUpgrade.test.ts` runs the installed Drizzle migrator
on an exact old migration prefix with synthetic existing users and a completed
legacy-import singleton. It verifies that:

- old rows, relation identities, ACLs, constraints and triggers remain unchanged;
- all five research tables start empty, with the expected functions and triggers;
- the actual auth cutover predicate still accepts the completed singleton, and
  ordinary user/session writes continue to work;
- a collision in the final migration rolls back the entire pending batch and
  migration journal while preserving the preexisting collision and old rows;
- a successful rerun adds no duplicate journal entries;
- a shadow creation schema causes refusal and no committed misplaced tables.

The RAM test uses Loom's UUID fixture instead of migration 0000's extension. A
separate disposable native PostgreSQL 18 control uses the real `pg_uuidv7`, exact
SQL bytes and explicit transaction batches. It checks old-object preservation,
late-failure rollback and actual separate-role privileges. With no default grants,
the runtime role can still write old tables but cannot read the new packet table.
An explicit default SELECT grant is inherited, demonstrating why the actual target
ACLs need review before any future data adoption. The native batch control does
not substitute for running the Node migration client against the release target.

These are synthetic compatibility checks, not live Neon acceptance, deployed
Google-auth acceptance or expert corpus-accuracy labels. Collection-specific
verification receipts and local infrastructure identities stay private.

## Release boundary and recovery

Before an approved release, verify the intended main baseline and exact pending
migration prefix, target project/branch/database and migration/runtime roles using
the existing Loom release workflow. The role must resolve unqualified creation to
`public`, have the existing UUID function, and have the intended default ACLs.
Refuse unexpected preexisting research objects, schema drift or an unresolved
previous release. Do not drop conflicting objects or rewrite saved import hashes
as a shortcut. Completed runtime auth readiness is distinct from replaying an old
schema-bound import operation; such old maintenance artifacts remain immutable.

The normal release stages the built app, applies compatible migrations, verifies
the staged deployment and only then promotes it. Its existing smoke checks remain
required. Research routes must stay unavailable on the hosted deployment, and no
source grants, real packets or model window are seeded as part of the release.

If migration fails, withhold promotion and inspect the exact migration journal and
catalog. The installed migrator's pending batch is transactional; its initial
schema/journal bootstrap is separate. If later build/promotion checks fail after a
successful migration, keep old code serving against the additive empty tables and
resolve the release state. Do not automatically run destructive down migrations,
reset accounting evidence or drop retained data. Any later cleanup is a separate
reviewed change with actual-state and retention checks.

Remaining release decision: approve shipping these four additive migrations with
research disabled, or defer merging the candidate. No production operation is
performed by the tests or by preparing this proposal.

## Separate legacy-chat boundary

The existing `/chat` API remains a separate code path. When its Pinecone corpus is
configured, `src/app/chat/server.ts` sends retrieved source passages and metadata
to clients in both supported protocols. The new private adapter's permissions do
not govern that older path, and repository separation does not remove an existing
hosted index. This candidate currently preserves that behavior.

Operator decision: keep legacy chat unchanged while finishing only the new engine.
Legacy retrieval, its two response protocols and source delivery are outside this
change. No legacy disablement, index replacement or private-operator conversion
is adopted. Do not describe this branch as having resolved the older runtime's
source privacy. No live index query, removal or production setting change is
performed here.

## Preparation status

The generic engine is prepared for integration with the research adapter disabled.
The current code has passed full tests and strict coverage, type/quality/Loom/data
checks, both builds, populated-database migration rehearsals and independent
reviews. The legacy-chat policy decision is resolved; it is not a release blocker
for this scoped preparation.

A production merge/release remains a separate action. It would apply four additive
migrations and create five empty tables through the existing release workflow.
The actual target/role checks and staged smoke/promotion gates remain required.
No approved public corpus, source grant, operator binding or model allowance is
created by completing this preparation.
