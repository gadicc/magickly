# Check-only permission rechecks — 1 November 2026

Status: planned on `gate/check-only-recheck` from `main` at 951eff85.
Adversarially reviewed (Fable) and revised the same day, then Gadi's
answers folded in as decisions 4 to 6; see "Review, 1 November 2026" at
the end. Nothing built. Read [current status](000-current-status.md),
[plan 006](006-private-offline.md) (the offline lease) and
[plan 065](065-ritual-deletion.md#the-code-review-1-november-2026)
(item 3, which deferred this) first.

Every grant from `POST /api/rituals/permission` carries the ritual's whole
bundle manifest (`manifestJson`, the rendered text, up to about 16 MB; the
client accepts up to 17 MiB, `MAX_DELIVERY_BYTES`). Two callers almost
always throw it away:

- the Downloaded rituals recheck (`recheckOfflineRitual`) always does, and
  plan 065 throttled it to once per 6 hours per ritual because of this;
- the reader's refresh (`refreshOfflineRitual`) does whenever the
  downloaded copy is already current, which is nearly every time it opens
  a downloaded ritual online.

Plan 000 has the TODO "a check-only mode for `/api/rituals/permission`".
This plan adds one without changing the version 1 contract.

Gadi's decisions, 1 November 2026:

1. **A version 2 check request; the client compares.** The server answers
   with the usual permission and the current bundle's identity
   (`bundleId`, `manifestSha256`), never the manifest. The client compares
   that identity with its own copy.
   - Why: the recheck already uses nothing but those two values
     (`ritualDownload.ts:236`), and the copy on the device was
     hash-checked when it was installed, so the identity is all the
     client needs. Version 1 stays byte for byte as it is, so cached
     clients are untouched.
   - Rejected: sending the client's `known` identity and letting the
     server compare (If-None-Match style). It carries the same
     information but puts device state into the request and a comparison
     onto the server, and it saves a round trip only when the bundle has
     changed, which is rare.
   - Rejected: a header on the v1 request (`X-Magickli-Delivery: check`).
     An old server would ignore it and send the full reply, so fallback
     would be free. But the request would no longer be described by its
     strict body alone, and the reply's shape would depend on a header.
   - Rejected: a separate route (`/api/rituals/permission/check`). It
     would duplicate the alias handling and the exact-path checks for no
     gain over a version field.
2. **Both paths.** The recheck uses only the check. The reader checks
   first and asks for the full version 1 delivery only when its copy is
   out of date or missing.
3. **Fallback to version 1.** A version 2 request that gets back exactly
   400 `{"error":"invalid-request"}` is sent again, once, as version 1.
   That happens only when the server predates this plan (deploy skew or a
   rollback); the client then pays today's cost instead of losing
   renewals.

Gadi's answers after the review, 1 November 2026 (he accepted the plan's
defaults):

4. **The recheck interval stays at 6 hours.** A check is now cheap on the
   wire, but the server still reads and decodes each manifest (risk 5),
   so a shorter interval multiplies database load. It can be revisited
   once the server's read is cheaper.
5. **No "newer version available" yet.** It belongs to a later "update
   downloaded copy" plan, and nothing is stored for it now.
6. **The fallback flag stays.** A page whose server lacks v2 pays one
   request per ritual, not two. Rejected: dropping it and always paying
   the retry (one piece of state fewer, but a round of rechecks during
   skew doubles its requests).

## What exists (read for this plan)

### The server

- `createRitualHttpHandlers().permission` (`src/offline/ritualHttp.ts:88`)
  rejects anything but a JSON POST, reads at most 4096 bytes
  (`MAX_PERMISSION_REQUEST_BYTES`), and parses the body with the strict
  v1 parser (`parseRitualPermissionRequest`, exact keys `version`,
  `requestId`, `expectedActorId`, `ritualId`). Any other body is
  400 `{"error":"invalid-request"}`. It then checks the optional
  `X-Magickli-Ritual-Alias` header, calls `checkPermission`, and for a
  grant with an available rendering calls `getManifest`, re-runs
  `checkPermission` (access may change during the lookup) and attaches
  the bundle only when `sameDescriptor` holds. Replies are
  `private, no-store`; failures are 503.
- `checkPermission` (`sqlPermissionCheck.ts:49`) parses the v1 request
  itself. A v2 path must hand it the v1 request it implies, so it does
  not change. (The editor services, `src/doc/sqlEditorServices.ts:27`,
  parse the same v1 shape for `/api/rituals/source`, not this route.)
- `getManifest` is `read(input, false)` in `sqlRitualBundleReads.ts`
  (from line 137). In one repeatable-read snapshot it checks the actor
  and access, selects the current rendering, picks the newest
  accepted-policy publication with that descriptor, checks revision,
  compiled artifact, parent version and content hash, then **decodes the
  manifest and compares its title and `renderedJson` with the current
  ritual**. A bundle is offered only if all of that holds.
- Leases are minted, not stored (`sqlPermissionCheck.ts:105`), so an
  extra request costs no server state.

### The client

- `fetchRitualDelivery` (`ritualClientTransport.ts:74`) POSTs the v1
  request, requires an exact same-origin, unredirected, `no-store`,
  `application/json` reply, reads at most 17 MiB and hands it to
  `parseRitualDeliveryResponse` (`ritualDeliveryContract.ts:69`), which
  takes exact key sets and verifies the manifest against its hash,
  bundle ID, ritual ID and the permission's descriptor. Anything else is
  "temporarily unavailable", which neither renews nor revokes.
- `recheckOfflineRitual` (`ritualDownload.ts:195`) passes only the
  delivery's `bundleId` and `manifestSha256` to `acceptPermission`.
- `acceptPermission` (`repository.ts:654`) applies a denial (purging the
  copy) or a grant (renewing `authorizations`), writes the binding into
  the `checks` row, and renews the stored copy's own authorization only
  when the binding equals the stored `bundleId` and `manifestSha256`
  (`repository.ts:738`). Its contract (`repository.ts:647`) is to receive
  an ID and digest only for a complete, verified server manifest:
  `installBundle` (`repository.ts:836`) treats the `checks` row's
  `bundleId` and `manifestSha256` as proof of that.
- `refreshOfflineRitual` (`ritualDownload.ts:29`, called from
  `PrivateRitualReader.tsx:154` with the legacy route alias where there
  is one) fetches the full delivery, accepts it, broadcasts
  `coordinator.changed()`, and returns early when the stored copy has the
  same identity (`ritualDownload.ts:90`). Otherwise it fetches every
  asset and installs the new bundle.
- `beginCheck` (`repository.ts:615`) overwrites the `checks` row and
  keeps only the source-lease fields, so the server's last bundle
  identity lasts only until the next check begins.
- `beginPermissionCheck` (`lifecycle.ts:482`) hands out independent
  tokens; one operation may send more than one request.
- The service worker uses Serwist's `defaultCache`; this route is a POST
  and is never cached. A client cached by the service worker keeps
  sending v1 until it updates.
- The offline lease window is 14 days (`lease.ts:3`).

## Design

### 1. The request

```ts
/** Permission and current bundle identity only; never the manifest. */
interface RitualPermissionCheckRequestV2 {
  version: 2;
  requestId: string;
  expectedActorId: string;
  ritualId: string;
}
```

- Same rules as v1: exact keys, plain or null-prototype object, data
  properties only, lowercase UUIDv7 IDs.
- `parseRitualPermissionCheckRequest` returns the v1 request it implies
  (`{ ...input, version: 1 }`), which is what `checkPermission`, the
  editor services and the inner permission reply are bound to.
- It lives in a new module, `src/offline/ritualCheckContract.ts`, with
  the v2 reply parser. `permissionContract.ts` and
  `ritualDeliveryContract.ts` stay unchanged.
- No `mode` field: version 2 means "no manifest". A later conditional
  mode would be version 3.

The handler reads the body once with `boundedJson`. If it is an object
whose own `version` is exactly `2`, the v2 parser runs; otherwise the
existing v1 parser runs, so every other body is handled exactly as
today. Header, alias and size rules are shared.

### 2. The reply

```ts
interface RitualPermissionCheckResponseV2 {
  version: 2;
  requestId: string;
  ownerId: string;
  ritualId: string;
  routeAlias: string | null;
  /** Exactly the v1 permission object; a denial is byte-identical. */
  permission: RitualPermissionResponseV1;
  /** Present exactly when v1 would carry a bundle for the same snapshot. */
  bundle: null | { bundleId: string; manifestSha256: string };
}
```

- The server takes the same path as v1 (`checkPermission`,
  `getManifest`, `checkPermission` again, `sameDescriptor`) and drops
  `manifestJson` from the result. So the v2 bundle is present if and
  only if v1 would have sent one.
- **Server database work is unchanged in this plan.** The assessment
  suggested reading only the identity columns of
  `ritual_bundle_publication_intents`. That skips the decode in `read`,
  so it would offer bundles that v1 refuses: a title changed without
  republication, a rendering that no longer matches, a corrupt
  manifest. A check would then renew a copy that a full delivery would
  not. A cheaper read can come later, with its own equivalence tests.
- The handler's shared part becomes one function returning the parsed
  request, the route alias, the final permission and the manifest (or
  null). Two serialisers build the v1 and v2 envelopes. The v1 output
  must be byte-identical to today's (see Tests).
- Errors, status codes and headers are as in v1.

### 3. The client transport

`fetchRitualCheck(request, signal, fetcher, routeAlias)` in
`ritualClientTransport.ts`:

- The same exact-response rules as `fetchRitualDelivery`, and a 64 KiB
  read bound.
- `parseRitualPermissionCheckResponse` takes exact keys, `version: 2`,
  the same request, owner, ritual and alias rules, and the inner
  permission through the unchanged `parseRitualPermissionResponse`.
  `bundle` is null or exactly `{bundleId, manifestSha256}` with a valid
  ID and hash, and is allowed only for a grant whose rendering is
  available. Anything else is "temporarily unavailable".
- **Fallback.** The trigger is a 400 that passes the same exact-response
  rules (same origin, unredirected, `no-store`, `application/json`),
  read under the 64 KiB bound, whose body is exactly
  `{"error":"invalid-request"}`. The client then sends the v1 request
  once with the same `requestId` and parses the reply with
  `parseRitualDeliveryResponse` (manifest verified as today). It keeps
  the identity only as the fallback's result, never as a binding (see
  section 4).
  - Reusing the request ID is safe: an older server issued nothing for
    the v2 body, since parsing fails before `checkPermission`.
  - A module-level flag remembers for the page's lifetime that the
    server lacks v2, so a round of rechecks pays one request per ritual,
    not two. It is set **only when the v1 retry returns an exact 200
    reply that parses**. A genuine 400 from a new server, such as an
    alias mismatch from the reader's legacy route
    (`ritualHttp.ts:107`), is retried once, gets 400 again, stays
    temporary and leaves the flag clear.
  - No fallback on any other status, a network error or an abort.
- Result type: `{ routeAlias, permission, bundle: null | { bundleId,
  manifestSha256 } }`.

### 4. One binding rule for both paths

Given the check reply and the stored copy (`readBundle`):

| Reply | Stored copy | What the client does |
| --- | --- | --- |
| no bundle | any | accept with no binding (renews the authorization only, as today) |
| same identity, and `permission.rendered.descriptor.contentSha256` equals the copy's `renderedSha256` | present | accept with the identity as binding (renews the copy) |
| same identity, content hash differs | present | **treat the whole reply as temporary**: `acceptPermission` is not called |
| different identity, or no copy | any | accept with no binding |

- The content-hash test restores the one link v1 checks on the client
  and a check reply cannot: that the permission's descriptor belongs to
  the bundle being renewed.
- Row 3 matches v1. There, such a reply fails `parseRitualBundleManifest`
  (`ritualBundleManifest.ts:182`) and the whole envelope is temporary, so
  nothing is renewed.
- Row 4 passes no binding because an identity from a check reply was
  never verified against manifest bytes, and `installBundle` trusts the
  `checks` row's identity as proof that it was. Nothing is lost:
  `beginCheck` wipes the value anyway, and the reader's outdated branch
  gets its binding from the verified v1 delivery.
- The test is weaker than v1's full descriptor check, because the copy
  stores only `renderedSha256` and not `descriptorSha256` (which also
  covers revision, version and artifact). An honest server cannot offer
  a bundle under a changed descriptor (`sameDescriptor`), so this is
  accepted. Storing `descriptorSha256` in the bundle would close it
  later.

### 5. The recheck

`recheckOfflineRitual` reads the stored copy, sends `fetchRitualCheck`
instead of `fetchRitualDelivery`, and applies the binding rule. Its
outcomes (`denied`, `granted`, `unchanged`, `fresh`, `interrupted`) and
its silence towards other tabs are unchanged. The comments on
`OFFLINE_RECHECK_INTERVAL_MS` (`ritualDownload.ts:183`) and
`lastGrantedAtMs` give the manifest's size as the throttle's reason; they
change to the server's database load (risk 5).

### 6. The reader's refresh

`refreshOfflineRitual` reads the stored copy first.

- **No copy:** today's flow, unchanged (full v1 delivery and install).
- **A copy:** a check, with the route alias, through the same permission
  operation. The reply is accepted and broadcast as today, so a denial
  closes every tab before anything else.
  - Granted, same identity and content hash (row 2 of section 4): done;
    returns true. The alias joins the copy's `routeAliases` through
    `acceptPermission`, as today.
  - Same identity, content hash differs (row 3): temporary; stop.
  - Granted, different identity: a second `beginCheck` and today's full
    flow (delivery, assets, install) within the same operation.
  - Granted with no bundle (rendering temporarily unavailable),
    temporary, or not accepted: stop, as today.
- `onInterrupted` fires on an abort before the check's reply is accepted
  (today's meaning), and also on an abort of the outdated branch's v1
  delivery before its own `acceptPermission`. Without the second case
  the stale copy would silently stay until the next open
  (`ritualDownload.ts:160`, `PrivateRitualReader.tsx:158`).
- Today's body moves into a helper used by both branches, so the full
  flow itself is not edited.
- Another tab may install a newer copy between the read and the check.
  `acceptPermission` compares inside its transaction, so renewal stays
  correct. At worst an update is skipped until the next open.

### 7. Throttle and "newer version"

- `OFFLINE_RECHECK_INTERVAL_MS` stays at 6 hours (decision 4).
- No "newer version available" UI in this plan (decision 5). When it
  comes, it needs the server's last identity stored, because
  `beginCheck` wipes it from `checks`. It must be stored apart from the
  `checks` binding, which only a verified manifest may set (section 4).

### Compatibility

| Client | Server | Result |
| --- | --- | --- |
| cached, v1 | new | v1, byte-identical |
| new | new | v2 check; full v1 only when the copy is out of date |
| new | older (skew, rollback) | 400, then one v1 retry: today's cost |
| cached, v1 | older | as today |

Rolling back past this release is safe for clients, unlike plan 065.

## Stage 0: no spike

Nothing here rests on an unproven claim. The saving is the manifest's
size, and every path reuses code that already runs. The integration
tests below measure the reply sizes instead.

## Tests and checks

- `ritualCheckContract.test.ts`, mirroring `permissionContract.test.ts`
  and `ritualDeliveryContract` tests:
  - the request parser: exact keys, extra keys, symbols, getters,
    prototypes, uppercase IDs, `version` other than 2;
  - the reply parser: exact keys, a `manifestJson` key rejected, a bundle
    on a denial or an unavailable rendering rejected, a v1 envelope
    rejected, alias rules, and every denial or authentication-required
    reply bound to the request.
- `ritualHttp.integration.test.ts`:
  - a v1 golden test: for fixed fixtures (grant with bundle, rendering
    unavailable, denied, authentication required, alias, invalid body),
    the v1 reply bytes equal recorded ones. `checkPermission` mints a
    fresh `leaseId` with `createUuidV7()` on every call
    (`sqlPermissionCheck.ts:105`) and the harness uses the real checker
    (`ritualHttp.integration.test.ts:56`), so the golden mocks
    `createUuidV7` to a fixed sequence and fixes the time. The bytes are
    recorded in a commit of their own (commit 2) against the untouched
    handler, so the handler change in commit 3 is checked against them;
  - v1/v2 equivalence over the fixture states, including a title changed
    without republication and a corrupt manifest: v2's bundle is
    non-null exactly when v1's is, with the same identity;
  - a v2 body with a missing or extra key gets 400; an oversize v2 body
    gets 503, as v1 (the size bound applies before dispatch);
  - v2 reply size stays under 64 KiB for the largest fixture.
- The contract tests also cover a v2 reply whose inner permission is
  `temporarily-unavailable` not being accepted, mirroring
  `ritualDeliveryContract.ts:112`.
- `ritualClientTransport.test.ts`:
  - the fallback fires only on an exact 400 `invalid-request`, once, with
    the same request ID;
  - a matching body on a redirected, cached, cross-origin or non-JSON
    response does not trigger it;
  - the module flag is set only by a parsed 200 v1 retry, and then skips
    v2; a 400 on the retry leaves it clear;
  - no fallback on 404, 503, network error or abort;
  - the 64 KiB bound.
- `ritualDownload.test.ts`:
  - the recheck sends v2 only and applies each row of the binding table;
  - the reader with a current copy sends one v2 request and no v1 or
    asset request;
  - an outdated copy gets v2 then v1 and installs;
  - a denial on the outdated branch's v1 delivery purges and broadcasts;
  - an abort of the outdated branch's v1 delivery calls `onInterrupted`;
  - no copy goes straight to v1;
  - a denial on the check purges, broadcasts and sends nothing more;
  - a temporary check sends nothing more;
  - the alias is kept.
- Existing tests that change:
  - the test at `ritualDownload.test.ts:443` asserts that the recheck
    sent `version: 1`; it now expects 2;
  - `permissionServer` (line 356) and `transport()` (line 135) answer
    every request with a v1 body. Both must dispatch on the request's
    version, or the reader's copy-present tests would get a v1 body for a
    v2 request, read it as temporary and fail for the wrong reason.
- `OfflineRitualCatalog.test.tsx` unchanged in behaviour.
- Compiler identity: `git diff --exit-code 951eff85 -- src/doc/semantic.ts
  src/doc/semanticCompilerImpl.ts src/doc/ritualNodeIds.ts` on every
  commit.
- Every commit passes the full gate (`pnpm install --frozen-lockfile`,
  `loom check`, `loom check --production`, `pnpm check`, `typecheck`,
  `test:coverage`, `build`) in a clean worktree on `/home`.
- No screen changes, so no documentation screenshots.

## Commits and gates

Gate branch `gate/check-only-recheck` from `main`.

| # | Commit | Contents |
| --- | --- | --- |
| 1 | `docs(plan): Plan check-only permission rechecks` | this plan; claims the number |
| 2 | `test(offline): Record v1 permission replies` | the deterministic v1 golden against the untouched handler |
| 3 | `feat(offline): Answer check-only permission requests` | `ritualCheckContract.ts`, handler dispatch and serialisers, contract and integration tests; the golden from commit 2 unchanged and passing |
| 4 | `feat(offline): Recheck downloads without manifests` | `fetchRitualCheck` with fallback, the binding rule, recheck and reader changes, the throttle comments, tests; plan 000's TODO replaced by a status line |

Commit 3 is deployable alone: nothing sends v2 yet. Implementation by an
Opus 5.5 subagent at high (multi-file, contract); an independent Opus
review, then a Fable review of the final tree.

## Risks

1. **The check trusts the server's identity without bytes.** It renews
   only a copy whose bytes were verified when installed, and only when
   the descriptor's content hash matches that copy. It never records an
   unverified identity where `installBundle` would trust it (section 4).
2. **A v1 regression would hit every cached client.** Covered by the
   golden test and by keeping the v1 parser untouched.
3. **The fallback doubles requests on a genuine 400.** Bounded to one
   retry, which also fails, changes no state and does not set the flag.
4. **The reader adds a round trip when the copy is out of date.** Only
   when the ritual changed. The common case saves the whole manifest.
5. **Server database load is unchanged.** Each check still reads and
   decodes the manifest from Postgres, which is why the interval stays
   at 6 hours (decision 4). A cheaper server read is a possible later
   plan.

## Review, 1 November 2026

Fable 5.1 (high) reviewed the draft in a fresh context. Nothing was
blocking. Its file and line claims were checked against the code before
being folded in.

**Should fix (folded in):**

1. **An unverified identity in `checks`** (section 4, row 4). The draft
   passed the server's bare identity when it differed from the copy,
   which makes the `checks` row vouch for bytes nobody checked;
   `installBundle` (`repository.ts:836`) trusts that row. Row 4 now
   passes no binding.
2. **An inconsistent reply was accepted** (row 3). v1 refuses the whole
   envelope when the descriptor's content hash does not match the
   manifest; the draft renewed the authorization anyway. Row 3 is now
   temporary.
3. **One genuine 400 could set the fallback flag** (section 3), for
   example an alias mismatch from the reader's legacy route. The flag is
   now set only by a parsed 200 v1 retry, and the 400 must pass the
   exact-response rules first.
4. **The v1 golden could not be byte-exact**: every check mints a fresh
   lease ID. The golden now mocks `createUuidV7` and is recorded in a
   commit of its own before the handler changes (commits table).

**Minor (folded in):** `onInterrupted` also covers an abort of the
outdated branch's v1 delivery; the existing tests and doubles that must
change are named; the throttle comments are updated; the editor-services
sentence is corrected; tests added for v2 400/503, an inner temporary
permission, the outdated branch's denial, and a matching 400 on a
non-exact response.

**Noted:** the content-hash test is weaker than v1's full descriptor
check (recorded in section 4); the reader's outdated branch mints two
stateless leases, which costs nothing; dropping the fallback flag was
offered and declined (decision 6).

The reviewer confirmed that no spike is needed. An older server answers
a v2 body with 400 before `checkPermission` (`ritualHttp.ts:99`), and
the route is never cached: Serwist's runtime routes match GET by
default, and the private routes are `NetworkOnly`.
