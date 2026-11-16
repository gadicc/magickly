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
- `createResearchManagedCleanupHttpHandler` is an unregistered GET adapter under
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
