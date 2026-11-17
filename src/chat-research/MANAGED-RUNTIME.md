# Managed operator runtime foundations

These server-only factories are inactive. They do not read environment variables,
register routes or schedules, publish grants/windows, resolve an operator account,
or supply deployment consent. The existing local factories retain their own
formats, opaque handles and binary-pinned cleanup contract.

## Explicit entry points

- `prepareResearchManagedPublication` binds the managed cleanup profile, source
  policy and retained-read envelope. Its handle cannot enter a local publisher.
- `createSqlResearchManagedPublisher` and `observeSqlResearchManagedPublication`
  share the existing native relation, mutex, deadline and one-shot transaction
  logic. A failed acknowledgement never authorizes replay or delivery.
- `proposeResearchManagedOperatorStartup` produces a new domain-separated intent;
  `createResearchManagedOperatorStartup` requires the exact independently adopted
  startup, genuine canonical corpus/catalog handles and captured runtime/auth
  facts. It has no local-file fallback. The shared application still performs
  fresh native/session/source/retention/price/accounting checks.
- `runResearchManagedCleanup` uses separate direct TLS controller and packet pools.
  It requires the exact adopted profile and endpoint/database/role identity,
  non-owner restricted role flags, no memberships and the physical artifact OID.
  These checks are not a complete effective-privilege audit or custody attestation.
- `createResearchManagedCleanupHttpHandler` is a token-gated GET adapter, exposed
  only by the independently disabled entry under
  `/chat/research/cleanup`. A fixed-format bearer check precedes private option
  loading. It invokes only cleanup and exports no question/source/read capability.

The managed profile explicitly binds Node 22 or Node 24. Different majors yield
new profile/target/intent digests. The application and cleanup constructors also
check the actual running Node major; matching JSON cannot override it. The site
currently declares Node 24, so its first managed deployment must use an expressly
reviewed Node 24 profile. Earlier Node 22 experiments remain Node 22 evidence.
Region, project, code/lock, endpoint, secret source and protected release custody
still require independent outer adoption; matching hashes alone do not prove them.
Vercel supports these majors and can select a runtime from the package's engines
range. See [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions),
checked 16 November 2026.

## Cleanup and permissions

One invocation has at most 40 seconds of work, including authenticated option
loading, followed by an independent 15-second settlement allowance. An inherited
work deadline only shortens it. The native target mutex must acknowledge started
state before packet work. Health cannot be finished before the packet pool closes
and its PID disappears; uncertain final commits can be reconciled only after
controller settlement, native PID absence and an exact run/revision observation.
Unknown resource or acknowledgement states remain unavailable, without retries.

Cleanup logically nulls expired request/response packet JSON after thirty days;
immutable metadata remains. It does not delete original books, canonical corpus
text/vectors, accounts or unrelated app data. PostgreSQL history/WAL and provider
backups are outside that logical purge guarantee. Answer access remains separately
bounded to seven days; generation's native cleanup-health fence expires after two
hours. An empty backlog does not establish future cleanup or physical erasure.

Migration `0026_chat_research_window_guard` prevents changes to published window
scope, refunds to conservative counters and reopening stopped windows. Terminal
settlement preserves any existing native stop exactly, including microseconds.
This permits a cleanup row-lock grant on `approval_sha256` without allowing its
value to change. PostgreSQL requires an UPDATE column privilege for row locks;
see [SELECT locking privileges](https://www.postgresql.org/docs/18/sql-select.html),
checked 16 November 2026. The guard protects the migrated public table and
restricted non-owner roles; it does not control owners who can remove it.
Other namespaces require their own verified guard before equivalent adoption.

The actual role grants, effective PUBLIC privileges and trigger/constraint
fingerprints must be independently audited before use. No new role or password
is created by these source files. The broad migration credential is not a
runtime or cleanup credential.

## Scheduler and adoption work

The intended cadence is hourly; no `vercel.json` cron entry has been added.
Vercel sends its configured cron secret as a bearer token; invocations can overlap
or duplicate, and failed invocations are not retried. Native exclusivity and
idempotent packet purging handle those cases. See
[cron management](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs),
checked 16 November 2026. Cron configuration/secret rotation is a separate release
operation; this worker is not given a Vercel control-plane token.

The project's actual scheduling entitlement still needs verification: legacy
Vercel Cron on Hobby is daily, whereas the required cadence is hourly. See
[cron usage](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing), checked
16 November 2026. Choosing another scheduler or adopting Vercel Schedules requires
its own concrete implementation/adoption review. No upgrade or new service is
selected here.

A native closed result stops packet work. The deployment owner must then retire
the schedule and credentials after a verified final receipt; this adapter cannot
remove a provider job. No process-local timer or cache is treated as a durable
scheduler or a source-authorization grant.

The remaining integration must authenticate the exact operator before private
startup/object/key access, load the SQL corpus through fresh per-object source
and native gates, compose the main-site shell/APIs, and verify the full path under
its original deadline. Current constructor/scripted lifecycle tests and isolated
native SQL tests do not establish hosted role custody, end-to-end acceptance,
answer quality, cold latency or production readiness.


## Request-owned SQL composition checkpoint

`createResearchManagedSqlService` is the HTTPS POST factory used by the
independently disabled main-site entry for the
four existing research API paths. It does not read environment variables or
change the Next route/page dispatch. Independently adopted origin/operator/startup
pins and an app auth root precede private startup loading. Its initial signed
session check also fences the exact current token, session, owner and expiry in
native read-only SQL. A conservative native TTL includes SQL and COMMIT time;
it can only shorten the original eight-second ingress/startup bound.

Each request binds the authority and separate corpus reader's transaction methods,
checks native database/role/relation OIDs, and passes the existing remote loader
fresh source readers for every object. The initial canonical identity uses the
main app's public auth tables; other auth layouts need explicit integration.
This first factory requires one intrinsic evidence snapshot per source and refuses
ambiguity before corpus reads. The generic policy/publication formats retain their
broader compatibility. No snapshot is selected merely because its hash sorts first.

Questions prepare the full canonical corpus. Catalogue and saved-answer paths
prepare metadata only and avoid generation/provider option getters. Catalogue
bootstrap remains capped at the original spending-window expiry; archive and
answer reads use the independently adopted retained-read expiry. This distinction
does not extend the original window or create an AI allowance.

There is one operation slot per service instance, held through the delegated core
handler. Unsettled SQL/configuration work at a bounded return poisons the instance
until process replacement, rather than authorizing another load. This is not a
distributed concurrency or physical connection-termination guarantee. Root identity
checks persist after handoff; the core then owns provider and independent settlement
lifetimes, including teardown after request cancellation. There is no startup,
corpus, session or authorization cache.

Focused tests include scripted timing/mutation/concurrency controls plus genuine
PGlite signed-auth, native SQL, current policy, nine-column reader grants, canonical
corpus compilation and configured-handler dispatch. These are synthetic data and
local database controls. They do not prove a deployed Neon client's TLS/ACL custody,
actual restricted runtime/cleanup operation, full-corpus cold latency or answer
quality. Protected release/credential adoption, scheduling and enabled hosted operator
acceptance remain pending; inactive Next registration is described below.

## Inactive main-site entry

The new `managedDeployment` / `managedServer` / `managedBootstrap` path composes
the existing Next page and POST routes behind a distinct absent-by-default managed
flag. It does not adopt actual credentials, source intent, allowance or scheduling.
See [hosted entry inputs and remaining gates](../../plans/060-hosted-operator-research.md#inactive-next-entry-checkpoint).

`managedDatabase` provides a dedicated lazy postgres.js/Drizzle root. Native role
OID/flags/membership/ownership projections run inside existing auth and corpus
fences, rather than inserting hidden asynchronous transport checks. Full local
synthetic tests and a native projection rehearsal establish source contracts;
actual Node TLS, hosted custody and complete service acceptance remain separate.

## Independent disabled cleanup entry

`GET /chat/research/cleanup` now has a distinct absent-by-default managed cleanup
entry. It imports no query bootstrap or canonical account/session configuration.
Its original40s work end is captured before cheap descriptor parsing. Bearer
authentication precedes lazy runner import and protected profile loading inside
one8s config bound; the worker retains its independent15s settlement allowance.
The route requests60s platform headroom. This is not a hosted timing or physical
shutdown guarantee. No cron stanza is registered.

The descriptor binds HTTPS origin, independent profile/config/connection digests,
cleanup role OID and release facts for Node24/London. The separate private JSON
contains only a profile document. Only after profile/runtime validation does a
callback read the dedicated cleanup URL: exact `magickli_research_cleanup_v1`,
64hex password, direct certificate-verifying Neon target, with no app DB, runtime
role, corpus-reader or environment fallback. Recreated role names, NOLOGIN, parent
memberships, elevated flags and all object ownership are refused through the
shared native projection inside the existing bounded query. The artifact physical
OID/PID fences and native exclusive maintenance lifecycle remain in place.

| Server-only input | Purpose |
| --- | --- |
| `MAGICKLI_PRIVATE_RESEARCH_MANAGED_CLEANUP` | Independent opt-in; cleanup may outlive question availability |
| `MAGICKLI_MANAGED_CLEANUP_DEPLOYMENT_JSON` | Cheap independently adopted target/release pins |
| `MAGICKLI_MANAGED_CLEANUP_SECRET` | Dedicated256-bit bearer; not an operator cookie or global cron fallback |
| `MAGICKLI_MANAGED_CLEANUP_PRIVATE_JSON` | Hash-pinned profile JSON only |
| `MAGICKLI_MANAGED_CLEANUP_DATABASE_URL` | Dedicated cleanup login, resolved after profile/runtime validation |

None of these inputs is installed by the source change. Actual scheduler custody
and authentication must be adopted together: native Vercel Cron sends the
project-wide `CRON_SECRET`, not a job-specific arbitrary variable. This entry
does not silently reuse or rotate that secret. A reviewed credential mapping or
a scheduler able to send the dedicated bearer remains an operational choice.
[Vercel cron authentication](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs#securing-cron-jobs),
checked17 November2026.

Synthetic route/credential/lazy-import/role/deadline controls and an exact native
projection rehearsal do not establish actual cleanup transport, real packet
purging/health settlement, hosted custody or scheduled delivery. Those remain
explicit launch gates before generation is enabled. The frozen local retention
owner and installed local binaries are unchanged.
