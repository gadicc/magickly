# Hosted operator research preparation

## Scope and current state

Prepare the existing private research service as an unlinked operator-only route
on the main site. Keep legacy chat unchanged. An undisclosed URL is not an access
control: every page and API must freshly authorize the canonical operator.
Deployment, private corpus transfer, production schema changes and new model
spending require their own concrete adoption. Existing local-only flags remain
local-only and must not be enabled on Vercel.

This checkpoint supplies an inactive hosted entry. The existing research routes
remain disabled in an unconfigured main-site build. No hosted
flag, concrete database target, scheduler or allowance has been installed.
The selected architecture is now local ingestion into Neon; R2 is deferred.

Implemented:

- Genuine opaque handles for a fully compiled corpus and a distinct metadata-only
  catalog. Configuration rejects forged handles, ambiguous inputs and generation
  from catalog-only state. Existing filesystem controls remain supported.
- One bounded streamed load across fresh source checks, hashing and canonical
  compilation; exact manifest pin and complete source influence required before
  unit text is loaded. The original ingress deadline can only shorten its eight
  seconds. Bytes, chunk count and decoded input are bounded; late or failed
  streams are cancelled/released with generic diagnostics and no retries/cache.
- Retained reads load manifest/catalog only, use current delivery rights and do
  not require a new generation allowance or unit text. Real synthetic SQL-core
  tests reopen a completed answer after generation rights/window are removed.
- An optional read-only R2 adapter with explicit credentials and fixed
  content-addressed keys. No upload, listing, presigning, generic files records,
  browser access or public endpoint. It is not configured or invoked by routes.
- A fresh uncached SQL operator-session hint reader. Exact canonical account ID
  matters; matching email/role is insufficient. A hint is not an API grant.
- A route-aware root shell: private research omits normal chrome, theme storage,
  recovery DB and registration mounts. Crossing the public/private shell hides
  children and requests a new document. The old whole-process private shell is
  preserved for local controls.
- A browser compatibility probe for the actual current service worker, plus a
  restricted same-origin no-store POST transport. Old/silent/unknown controllers
  block the private UI; controller changes abort old work and clear the child.
  No worker registration, cache erasure or app-state migration occurs in the gate.

## Storage decision

The selected first architecture is local preparation/ingestion into Neon. Keep
original documents and rendered page images local; store versioned derived
passages, citation metadata and selected cached document embeddings in private
server-side database tables. The existing SQL prototype controls are feasibility
evidence, not an installed production corpus adapter. Exact model/input/config
bindings are required when reusing vectors; no new model calls follow from a
storage decision.

R2 artifact storage is deferred until after the initial text service is online.
The optional Get-only adapter remains inactive. Large images, original documents
or immutable rebuild snapshots can be considered separately later. A live backend
on the ingestion machine is not required by the selected Neon architecture.

Migration 0025 now defines the empty private corpus store: immutable sealed
snapshots, checked source/unit projections, independent model spaces and exact
binary-vector/input membership. The dataset key is the canonical corpus manifest
hash; the embedding-space set is frozen at sealing. Adding a model to the same
unchanged corpus needs a separate versioning design, not an appended space.
SQL guards establish relational integrity, not canonical compiler provenance or
source permission. A future importer must use the genuine compiler, pinned
manifest and exact cached-input checks before COPY.

The migration ships through the normal staged main release, never through the
importer. The importer must verify the installed schema/journal and refuse drift.
It does not install extensions or create tables. The bounded ingestion executor and actual intake receipts belong in the private
companion. SQL retrieval/index selection and restricted writer/reader composition
remain inactive preparation work; no private target facts belong in this plan. Database ownership is a trusted boundary; revoking
PUBLIC access cannot constrain a runtime sharing the migration owner's role.
Vercel Sensitive variables cannot be recovered through CLI; use an approved direct
migration/ingestion credential under the existing release boundary. Do not fall
back to a development database or rotate credentials to bypass access restrictions.

The generic SQL metadata port is now prepared separately. It serves only sealed
manifest/catalog objects through fresh read-only root transactions. The existing
remote loader retains canonical source gates and metadata-handle compilation and
passes its original absolute end into the port; late SQL results cannot start a
new data query after that end. Units are refused before SQL, so generation still
needs a separate search/materialization adapter. This installs no route, database
adoption, source grant or retention/hosting configuration.

Actual source admission, derived-data ingestion, hosting and model spending are
separate scopes. Preserve the selected operator-only audience; source and target
facts belong in the private companion. Original-document storage and private
collection publication must not be inferred from derived-result ingestion.

## Remaining hosted implementation

1. Bind the intended Neon endpoint/database, restricted roles, corpus relations,
   dataset digest, actual operator, site origin and native target in a new
   domain-separated hosted intent. Keep actual values and credentials outside Git.
   Local startup approvals must not be repurposed as hosted approvals.
2. Build the hosted page/API composition. Perform the canonical operator gate
   before request bodies, private configuration, corpus I/O, keys or price work;
   repeat current-source and native gates at their existing boundaries. Pass the
   original ingress deadline through setup. Initial HTML/RSC must contain no
   bibliography, questions, saved answers or passages. Key the client shell by
   the fresh identity digest; every API independently repeats authorization.
3. Add a managed-runtime retention profile rather than weakening the frozen local
   binary contract. Bind reviewed critical source/lock inputs independently of
   deployment ID to avoid hash/redeploy cycles. A source hash is release identity,
   not proof of runtime custody. Preserve seven-day answer access, thirty-day
   packets, hourly cleanup and the two-hour stale-health gate unless explicitly
   changed. Keep old installed cleanup/runtime inputs and receipts immutable.
4. Prepare hosted cleanup with exclusive locking, idempotence, bounded work,
   failure receipts and health fencing. Cron can overlap, duplicate or miss an
   invocation; a schedule is not evidence cleanup ran. Do not add an active cron
   schedule or platform configuration as part of source preparation.
   [Vercel cron operations](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
   Session-level cleanup locks need a direct connection; Neon transaction pooling
   does not preserve session advisory locks.
   [Neon pooling](https://neon.com/docs/connect/connection-pooling).
5. Implement and measure the SQL corpus adapter: exact/ANN/lexical controls with
   real source filters and planner behaviour, bounded candidate budgets, warm/cold
   latency, memory, revocation and metadata-only retained reads. Do not infer
   relevance or semantic equivalence from matching vector neighbours alone.
   Keep text out of build tracing/static assets. Function limits and plan capacity
   are release inputs, not inferred from successful local loading.
   [Vercel function limits](https://vercel.com/docs/functions/limitations).
6. Review an exact release: empty additive schema scope, target/credential custody,
   derived-data import, finite model allowance, staged authenticated/denied tests,
   cleanup installation/health, monitoring and rollback. No implicit pilot renewal.

## Evidence and limits

Focused tests cover source revocation, deadlines, corrupt/oversized bodies,
excessive empty chunks, cancellation rejection, forged handles, operator mismatch,
worker incompatibility and cross-shell UI behavior. The private companion records
machine-local performance, full-suite/build evidence, browser receipts and reviews.
No private bibliography, corpus hashes, paths or real identities belong here.

Synthetic Chromium checks exercise the actual research client and worker modules
with fixture anonymous shells: old-controller blocking before API use, current
catalog delivery, controller-change abortion/clearing and private payload absence
from CacheStorage, web storage and IndexedDB. Serwist metadata can legitimately
exist. This does not prove a deployed Next build or real authentication. Separate
built checks cover the disabled Next root and public/private crossings.

Shared-origin scripts, existing controllers, browser extensions and XSS remain
inside the trust boundary. A cooperative worker probe is compatibility information,
not a defense against a malicious same-origin worker or server authorization.
Server-side source authorization and minimal initial HTML/RSC remain mandatory.

Help screenshots were regenerated through the registered-worktree wrapper using
synthetic fixtures and visually reviewed. All nineteen were captured and reviewed. The
forum form used an independently reviewed, development-only synthetic-key fixture
in the disposable capture checkout; the form was never submitted. Its image is
byte-for-byte unchanged. No real key or application secret configuration changed.

Expert-reviewed held-out quality acceptance, later image/upload features and
public legacy-chat cutover remain separate roadmap work. None is established by
structural/security tests or by this hosting preparation.


## SQL reader checkpoint

The inactive metadata reader supports retained citations without loading passage
bodies. The separate canonical full-bundle reader preserves the current compiler
and BM25 behavior, with byte/hash verification, a 32 MiB unit-file cap and the
original absolute deadline. Neither reader changes default configuration or
provides operator/source authorization by itself.

Measure the full path in the intended hosting region before adopting it. A local
network diagnostic is insufficient to accept or reject co-located performance.
Any temporary cloud probe needs a separately reviewed Preview-only scope, private
runtime configuration, authenticated ingress, bounded reads and resource cleanup;
it must not deploy the application, invoke models or change production aliases.
Native SQL retrieval remains an alternative requiring separate relevance and
runtime acceptance, rather than an assumed equivalent to the current BM25 path.

## Managed profile checkpoint

A distinct schema2 managed-retention profile now prepares the original logical
maintenance target from bounded owned facts. It retains the local policy's packet
retention, purge lag, hourly cadence, stale-health fence, full-namespace scope and
native stop condition. Worker-artifact, dependency-lock, critical-input and
project-scope digests bind release identity independently of a deployment ID.
Node22/London/Vercel are the first reviewed policy shape; broadening that shape
requires an explicit source/runtime review.

This is data compilation only. Actual protected-release custody, managed worker
and scheduler implementation, native target/role adoption, hosted publication,
ingress and health acceptance remain required. The local binary format and its
consumers remain unchanged and reject this distinct profile. The managed format is accepted only through the later inactive hosted entry; no
concrete deployment configuration or service activation is installed.


## Managed runtime checkpoint

Explicit managed SQL publication, startup, application and cleanup factories now
reuse the existing source/session/native/accounting gates without accepting a
managed handle through a local-only constructor. Node 22 and Node 24 profiles
are distinct; the actual process major must match. The current site's Node 24
setting needs its own hosted acceptance rather than inheriting Node 22 results.

The initially unregistered cleanup HTTP adapter authenticates before loading private
configuration. It preserves the original forty-second work budget plus a
separate fifteen-second settlement allowance, native exclusivity, packet-pool
closure and exact final-acknowledgement reconciliation. No schedule, token or credential is installed. The later independent cleanup
entry registers a default-disabled route; it does not activate a worker. See
[managed runtime foundations](../src/chat-research/MANAGED-RUNTIME.md).

Migration 0026 freezes published window scope, conservative holds and irreversible
stopping. This permits a narrowly granted column UPDATE privilege solely for
cleanup row locks. Settlement preserves an existing native stop timestamp exactly.
Synthetic native privilege tests and actual SQL ledger/migration tests cover these
contracts; scripted client-lifecycle tests do not establish hosted client custody
or complete service acceptance.

Remaining work includes separately adopted restricted roles and credential
custody, authenticated main-site ingress and SQL-object composition, verified
hourly scheduling, protected-release acceptance and a fresh finite model scope.
The source remains inactive and legacy chat remains unchanged.

## Inactive Next entry checkpoint

The existing research page and four POST routes now dispatch to a distinct
managed deployment only when `MAGICKLI_PRIVATE_RESEARCH_MANAGED=1`. This does not
enable the existing local flags on Vercel. The cheap descriptor requires a
production Node24 runtime, London, the exact HTTPS site/auth origin, independently
adopted operator/role OIDs and domain-separated endpoint/config/startup digests.
A flag alone is insufficient. No concrete configuration is included in Git.

The page freshly checks the canonical operator and returns only an opaque shell
key, conservative session expiry and read-only mode through the existing worker
privacy gate. Page and API share a canonical descriptor projection; UI-only fields
cannot fork shared startup. Every API independently repeats authorization.
Runtime/auth resources may be shared, but corpus, session, source and answer
authority are not cached. Corpus credentials, protected startup and provider keys
remain behind the fresh operator gate. Native-window mode still needs a separately
adopted finite window; read-only mode refuses question dispatch without model work.

The dedicated postgres.js roots use certificate/hostname-verified direct Neon TLS,
restricted role names, independently pinned database/role OIDs, bounded pools and
server timeouts. Role safety is observed inside the existing deadline-bound native
queries: no parent membership, elevated flags or object ownership, including
database ownership. The original ingress deadline covers bootstrap and auth and
can only shorten the eight-second budget. Provider/settlement lifetimes after
handoff retain their independent bounds. No hidden transport query renews a gate.
The URL's `channel_binding=require` is validated as a configuration requirement;
it does not establish that postgres.js negotiated libpq-style channel binding.
Actual driver/TLS and hosted lifecycle acceptance remain required.

Protected runtime inputs (all server-only, never `NEXT_PUBLIC_*`):

| Variable | Purpose |
| --- | --- |
| `MAGICKLI_PRIVATE_RESEARCH_MANAGED` | Explicit hosted-purpose opt-in |
| `MAGICKLI_MANAGED_DEPLOYMENT_JSON` | Bounded independently adopted descriptor; no password |
| `MAGICKLI_MANAGED_RUNTIME_DATABASE_URL` | Dedicated runtime credential; ordinary app DB is discarded |
| `MAGICKLI_MANAGED_PRIVATE_JSON` | Hash-pinned startup, generation mode, relation OIDs and cleanup facts |
| `MAGICKLI_MANAGED_CORPUS_DATABASE_URL` | Separate narrow corpus reader; loaded after operator auth |
| `AI_GATEWAY_API_KEY` | Existing provider credential; accessed only when generation needs it |

These are input contracts, not instructions to install secrets. Measure the exact
protected configuration against the hosting platform's actual per-variable and
combined limits before custody adoption. Source parser bounds are not a platform
capacity guarantee. Vercel currently permits64KB combined per deployment for
Node runtimes; account for existing site variables as well as this configuration.
See [environment variable limits](https://vercel.com/docs/environment-variables#environment-variable-size),
checked16 November2026. No original documents, rendered images or corpus text belong
in deployment artifacts or these configuration values.

Remaining release gates are actual driver/host custody and full canonical-path
latency, exact source/publication intent, cleanup client/scheduler acceptance,
fresh bounded generation approval and staged operator/denied/revocation checks.
The inactive source can be reviewed independently of those live adoptions. No
cron, credential transfer, enabled service or legacy-chat replacement is installed
by this checkpoint.

## Independent cleanup route checkpoint

The main-site cleanup route is now registered behind its own disabled-by-default
flag. Query availability is independent so retention can continue after questions
stop. No scheduler, token, secret custody, profile adoption or cleanup-role use
is installed. The entry authenticates its dedicated bearer before importing the
runner or reading protected profile/credentials, preserving original40s work,
8s setup and15s independent settlement bounds.

Native cleanup attestation now requires an independently adopted role OID as
well as the shared role flags/membership/all-ownership projection and persistent
artifact relation/PID checks. Keep source-only route validation distinct from
actual managed cleanup/health acceptance. See
[cleanup input contract and scheduler boundary](../src/chat-research/MANAGED-RUNTIME.md#independent-disabled-cleanup-entry).
