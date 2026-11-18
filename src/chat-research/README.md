# Private research engine

A generic, default-disabled local operator research adapter. Actual collections,
identity bindings, source policies, adoption records and runtime configuration
are supplied outside the public repository. No collection or query allowance is
bundled or activated. All committed examples and tests are synthetic.

The core supports typed evidence-linked answers and bibliographic facts, complete
source influence tracking, exact immutable model-request bytes, finite accounting,
explicit saved-answer history, protected archive reads and finite packet retention.
Structural validation is separate from semantic/expert support. The catalog and
metadata loaders are server-only; an authenticated source policy is checked again
at the relevant boundaries rather than treating retrieval similarity as permission.

The private page and POST APIs stay unavailable without the local deployment and
independently adopted configuration. The private layout excludes ordinary site
navigation, browser persistence, analytics and service-worker activity. A normal
site deployment keeps its existing chat behavior. Enabling this adapter is a
separate operational/privacy decision with its own real-target checks.

## External private inputs

Keep PDFs, text/OCR/figure data, vectors and catalog manifests outside Git. The
private configuration supplies absolute external paths and immutable fingerprints;
never put those values in client bundles, public env variables or public reports.
Keep credentials, actual account bindings and retained request/response bodies out
of Git, including a private research repository. Retention-owned packets remain in
their original restricted storage under the adopted cleanup policy.

Use a separate private companion repository for collection-specific experiment
code, definitions and identifying metadata. Public CI exercises this adapter with
synthetic fixtures. Private corpus evaluation is a distinct verification layer.
Private catalog membership must not be exposed through a public catalog endpoint,
answers, citations, logging or build artifacts. A public answer audience needs its
own explicitly approved collection and policies.

## Verification and release

Use the project's pinned pnpm/Node and normal full test/type/quality/build tasks.
`pnpm test:chat-research` runs the focused synthetic adapter cases. Test SQL helpers
live under `tests/chat-research`; the historical pricing fixture is public API
metadata, not a live price promise or provider/spending approval.

The additive research migrations create empty accounting/policy/artifact tables;
they seed no sources, grants, operator bindings, model window or profile. Main's
existing release workflow applies migrations even when the adapter is disabled.
A release requires explicit schema/rollout approval. Disabling the feature does
not justify automatically dropping retained accounting or private packets.

The generic offline section helper is documented in
`scripts/chat-research/section-candidates/README.md`. Its candidates are not a
production retriever or semantic gold labels. Its derived parents require their
own registration and processing context before use.


## Operator service purpose

`operatorStartup.ts` proposes and validates a new intent/native approval binding;
it never renews the earlier fixed trial. `operatorDeployment.ts` uses separate
pins, and the old `localBootstrap.ts` continues to select read-only generation.
`operatorNodeServer.ts` supplies the loopback-only closed-surface outer listener.
Its actual immutable custom-server packaging, custody and adoption are required;
unrestricted `next start` is not an approved operator service launcher. See the
plan for target provisioning, cleanup and independent adoption order. No new live
scope or service is started by installing or importing these modules.

## SQL metadata port

`sqlCorpusMetadata.ts` is an inactive object port for `manifest.json` and
`catalog.json` only. It uses a separately adopted database root, sealed dataset
and catalog-revision pins, fresh read-only transactions and the loader's original
absolute deadline. `loadResearchRemoteCorpus` supplies that deadline and repeats
current source gates and canonical checks. The resulting catalog supports
retained-answer citations; it cannot become a generation corpus. Passage/object
requests fail before SQL. Database/role/native custody, operator ingress and
source grants remain separate hosted-adoption requirements. No route or default
configuration uses this port.

Deadline/destroy checks reject late results; they do not cancel already-started
driver work or prove connection/backend closure. Actual connection, COMMIT and
session lifetimes still need explicit hosting/driver adoption.


## Canonical SQL bundle control

`sqlCorpusBundle.ts` is a separate inactive full-bundle object port. It preserves
canonical compilation and the existing BM25 pipeline. Before reading units it
checks the sealed manifest and exact encoded row size, with a 32 MiB unit-file
cap. It verifies sorted canonical JSONL bytes and their digest while streaming.
The original loader deadline applies through SQL, encoding and delivery; unread
rows are released on cancellation, abort, expiry and destruction. This does not
prove termination of already-started driver or backend work.

Use the metadata-only port for retained reads. Full-bundle generation remains a
performance control until a co-located measurement establishes its cold-load
budget. This factory grants no source processing, opens no route and starts no
model request. Database custody, ingress, retention and runtime adoption remain
separate requirements.

## Managed cleanup profile preparation

`managedRetentionProfile.ts` defines an inactive, separately versioned profile for
reviewed Vercel Node22/London releases. It binds worker-artifact, dependency-lock,
critical-input and project-scope digests without putting a deployment ID into the
profile digest. These identify release inputs; they prove neither an actual Node
binary nor runtime custody. An independent protected-release adoption must still
bind the real deployed code, project, region, runtime policy and database target.

The local binary-pinned profile is unchanged. Both parsers reject the other's
format. Existing publication/startup and local workers deliberately do not consume
the managed profile. Retention, cadence, stale-health limits, cleanup scope and
stop conditions are preserved, but no managed worker, route, scheduler, grant,
window or activation follows from preparing this data.

## Explicit cleanup scheduler authentication

The independently enabled cleanup descriptor accepts optional `authorization`:
`dedicated-bearer` (the unchanged default) or `vercel-cron`. The first reads only
`MAGICKLI_MANAGED_CLEANUP_SECRET` and requires the existing 64-character hex token.
The second reads only `CRON_SECRET` and accepts 16–256 ASCII bearer-token characters
(letters, digits, `. _ ~ + / = -`). There is no fallback between secrets. Missing,
malformed or mismatched tokens cannot load private cleanup configuration or DB
credentials. The Node24/London, independent cleanup opt-in and native retention
contracts are unchanged.

[Vercel's cron authentication documentation](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs#securing-cron-jobs)
explains the platform's `Authorization: Bearer` header and deployment-captured
`CRON_SECRET`. The explicit mode lets a reviewed release use that existing secret
without reading it back, duplicating it into another setting or rotating the
site's other jobs. Platform cron credentials are shared across the project's
cron endpoints; choosing this mode is not purpose-isolated token custody. Use a
separately adopted dedicated scheduler when that isolation is required.

No hourly schedule, secret value, source/window/retention publication, credential
custody, health write or service activation follows from this adapter. A release
must adopt those operations separately and verify actual scheduler delivery.
