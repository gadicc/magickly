# Daily limits

Every daily limit on work that costs money (model calls, embeddings,
server renders) is a policy in [`policies.ts`](policies.ts), reserved
through [`counters.ts`](counters.ts). Read this before adding a route that
spends money on a request, or changing a limit's size.

## The policies

A **pool** is one counter everyone it covers shares; a **user** policy is a
signed-in reader's own counter; a **client** policy is a signed-out
client's (or, for search and renders, any client's) own counter, keyed by
an HMAC of its IP address under a key for the day (`client.ts`).

| Policy | Kind | A day | Counts | Enforced in |
|---|---|---|---|---|
| `CHAT_USER` | user | 100 | chat submissions and AI-reading units, signed in | `app/chat/usage.ts`, `reading/allowance.ts` |
| `ANONYMOUS_POOL` | pool | 500 | the same, every signed-out reader together | same |
| `CHAT_CLIENT` | client | 20 | chat submissions from one signed-out client | `app/chat/usage.ts` |
| `READING_CLIENT` | client | 10 | AI-reading units from one signed-out client (plan 081, S4; shown on the page) | `reading/allowance.ts` |
| `SEARCH_POOL` | pool | 10,000 | searches by meaning, the whole site | `search/usage.ts` |
| `SEARCH_CLIENT` | client | 100 | searches by meaning from one client | `search/usage.ts` |
| `RENDER_POOL` | pool | 20,000 | fresh renders of personal images, the whole site | `render/renderAllowance.ts` |
| `RENDER_CROSS_SITE_POOL` | pool | 2,000 | the part of those from outside the site's own pages | same |
| `RENDER_CLIENT` | client | 60 | fresh personal renders one client causes | same |

Why these sizes (24 November 2026):

- **Chat and readings.** 500 signed-out units a day was the original
  budget. Without a per-client share one script could use it all and stop
  chat for every signed-out reader; 20 submissions is more than a reader
  asks in a sitting. The reading keeps its own 10 units, as plan 081 set.
- **Search.** One embedding call a search. The dialog searches by meaning
  only when the reader asks, so 100 a client is generous; 10,000 bounds
  the day's cost.
- **Renders.** Only contracts with `personal: true` (`kamea-sigil`,
  `rose-sigil`, `astro-geomancy-chart`) are counted: their free text makes
  every request a possible new CDN key. Every other image has a closed set
  of inputs the CDN soon holds. A CDN hit never reaches the function, so
  only fresh renders count. The worst kamea sigil measured took about 2 s
  (about $0.00012 at Vercel's London prices), so 20,000 bounds a day at
  about $2.40; the generators draw in the browser and call the API only to
  export or share, so 60 a client is a busy reader's day. The cross-site
  pool keeps link previews, hotlinks and scripts from using up what the
  site's readers need. Headers can be forged, so it is fairness, not a
  boundary: the client and site pools are the bound.

## How a limit works

- **Reserve before the work, and keep it.** A request reserves its units
  before it calls the provider or renders; a call that fails may still
  have cost, so it stays counted. Only work that provably never started
  is given back (`returnDailyUsage`, as the reading does).
- **Narrowest first, all or none.** `reserveTogether` takes every bucket
  in one transaction, in order, so a client over its own limit never
  touches a pool, and a pool that refuses leaves the client's bucket as it
  was. It needs a database that runs transactions: `@/db/neonFull`, not
  `@/db/neon`.
- **Atomic and day-stamped.** Each counter is one row in
  `chat_daily_usage` (named for its first user), updated with a guarded
  upsert, so concurrent requests on any instance never overshoot, and a
  stale request from before midnight UTC never rolls a row's day back.
  The purge-readings cron deletes earlier days' rows, so no client bucket
  outlives its day.
- **No address is stored.** A client's subject is
  `<prefix>:<HMAC-SHA-256 of the address>` under an HKDF key from the auth
  secret, the policy's label and the day. IPv6 addresses are cut to their
  /64; a request with no usable address shares `<prefix>:none`.
- **Refusals are never cached.** Send `refusalHeaders(resetAt)`: a 429
  with `Retry-After` and `Cache-Control: no-store`, so the CDN never keeps
  a refusal under a URL it would otherwise serve.
- **Same-origin where a reader's allowance is spent.** Routes that spend
  an allowance on a model call (chat, the reading, search) refuse requests
  that aren't from the site's own pages (`src/lib/sameOrigin.ts`). Renders
  can't: an image is loaded without an `Origin`, and shared links must
  work, so they use the cross-site pool instead.
- **Fail closed.** If the counters can't be reached, the request is
  refused (search answers 503 and text search carries on).

## Adding a limit

1. Add a policy to `policies.ts` and to `LIMIT_POLICIES`: a pool's
   `subject`, or a client policy's `prefix` and `label`
   (`magickli/<purpose>/client-cap/v1`), each unique (the test checks).
2. Reserve in the route's server code, before the work:

   ```ts
   const now = new Date();
   const reserved = await reserveTogether(
     db, // @/db/neonFull
     [
       clientBucket(MY_CLIENT, requestClientSubject(request, MY_CLIENT, now)),
       poolBucket(MY_POOL),
     ],
     1,
     now,
   );
   if (!reserved.ok)
     return new Response("…", {
       status: 429,
       headers: refusalHeaders(usageDay(now).resetAt),
     });
   ```

   Take the database as a parameter where you can, so a test passes
   PGlite's (`createMemoryPgliteHarness({ schema: { chatDailyUsage } })`).
3. Add the policy's row to the table above, with why it is that size.
   `policies.test.ts` fails until every policy is in this file.

## Outside the app

A Vercel Firewall rate-limit rule is the only thing that sees requests the
CDN answers from cache, so it is what stops someone hammering a cached URL
for bandwidth. It is configured in Vercel, not here, and changing it is the
owner's call. Record any such rule in this section when it is added.
