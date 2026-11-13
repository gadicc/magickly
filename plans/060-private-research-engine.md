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
