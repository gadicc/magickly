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

## Deployment readiness qualification

The generic coordinator now shares the original prepare-source deadline with its
reader factory and the inner authorization gate. A factory that uses the entire
budget must not start principal I/O; principal work that uses the remaining budget
must not start snapshot/fence I/O. Regression controls also preserve successful
completion just within the budget. This change neither grants authority nor
renews a spending scope.

The shipped Next bootstrap explicitly selects read-only generation policy and
requires the reviewed local runtime. It is not a hosted replacement chat service
that can be enabled by changing one environment variable. Before an active
replacement, adopt the deployment audience and source collection, implement and
review the actual generation authority/transport and its durable spending,
reconciliation and cleanup ownership, then verify the staged target. The private
operator/source scope does not authorize a public corpus. An inactive engine
merge and an active legacy-chat switch remain distinct milestones.


## Separate operator question service

The next target is operator-only research using independently reviewed private
sources, with answers/citations only. The existing public legacy chat remains
unchanged until a separate cutover discussion. No source corpus, operator identity
or allowance is shipped in this repository.

The new operator startup is distinct from the archive reader and the old fixed
trial. A domain-separated intent normalizes only the known approval link using
an internal sentinel, rebuilds existing canonical child formats, then binds the
result into the native approval hash. Final preparation requires that exact
identity and recompiles every derived digest. Changing the actor, corpus/policy,
window, limits, retention/read terms, runtime, endpoint or physical target creates
a different intent. Preparation is data, never consent or a renewable allowance.

The old reader opt-in and startup pins remain read-only. The new independently
opted-in entry uses separate pins and immutable-deployment startup packages under
an external owner-only `operator-startups` directory beneath a separate OS-owned
operator-service root. The old reader root is not modified or borrowed. Ambiguous purposes, hosted
Vercel/CI settings, bad pins and unsupported origins refuse. The private shell
suppresses ordinary client persistence, navigation, analytics and service workers
for either private intent, including invalid/ambiguous configurations; that
conservative UI suppression grants no API authority.

The owner-local Node listener binds only IPv4 loopback. Before Next sees a request,
it refuses unrelated routes, source resources, auth/file/legacy APIs, server
actions, routing override headers, aliases, upgrades and Expect handshakes. Only
the research shell, four POST APIs and required static assets proceed to their
own authorization. Do not substitute unrestricted `next start` for this listener.
No global proxy or behavior change is added to ordinary public-site requests.

Activation sequence remains separate: provision/attest an isolated physical target
before final OID-bound intent preparation; build and verify an immutable app/code
image independently of startup configuration; adopt exact source/account/window
and budget scope; establish independently owned matching cleanup/health coverage;
pin the final startup and verify the actual launcher, Gateway account/secret,
endpoint and DDL custody. The consumed fixed trial and its cleanup owner cannot
supply any of those. Ten requests/24h is an existing format maximum, not adopted
spending. No dates, grants, windows or renewal are installed by these compilers.

A Next custom-server runtime must include and test the complete runtime it uses.
Do not combine its packaging contract with the generated standalone server.
Source-level and synthetic native/listener controls are not proof of an installed,
adopted running service. Actual runtime packaging/attestation, cleanup, a new
finite request allowance and staged acceptance remain required before activation.


The selected hosting destination is a private operator route on the main site,
without publishing a link or replacing public chat. An unlinked URL is not an
authorization boundary. The owner-local entry above is a verified control, not
the hosted main-site adapter: its local flags must not be enabled on Vercel.
Hosted preparation must add route-scoped privacy, fresh operator authorization
and server-only external corpus/storage/cleanup custody; source transfer, live
allowance, deployment and cutover are separate adoption steps.
