# Adopt Loom secrets for temple forum keys — planned 12 October 2026

Temple forum API keys are encrypted by `src/temples/forumKeys.ts`, written on 9
October (plan 057, commit `c085b06`). It works, but the key is derived from the
Better Auth secret, so its strength, its exposure and its lifetime are all tied
to auth: a weak auth secret makes every stored forum key guessable from a
database dump, and dropping an old auth secret silently makes stored keys
unreadable. Loom is gaining a shared `secrets` feature with a dedicated,
backed-up key. This plan moves magickli onto it.

The Loom feature shipped in `@gadicc/loom` 1.36.0; its design is Loom's
`docs/secrets-feature.md`. The code below is implemented on the branch
`feat/loom-secrets`. No production key exists yet and nothing has touched
production: the rollout at the end is Gadi's, and **the branch must not reach
`main` before its steps 1 to 3**, because the release gate (`loom check
--production`, the release environment policy and the smoke check) fails until
a production key is recorded and deployed.

## Commits

| Commit | What |
| --- | --- |
| `fade5be` | Activate Loom secrets: the health route, the release smoke check and the release environment policy |
| `fe235ee` | Seal forum keys with Loom; drop the auth-derived cipher |
| `a30c4ce` | Report, verify and reseal from the administration page |
| `4da1019` | Authorize before a forum is contacted; show the hint from the key |

## Decisions

**A dedicated key, not the auth secret.** `LOOM_SECRETS_KEY_1` and
`LOOM_SECRETS_ACTIVE_KEY=1`, generated with `loom secrets keygen` on Gadi's
machine, saved in the password manager with its fingerprint, and added to
Vercel from that copy as a Secret for Production only. The fingerprint is
recorded in `loom.json`, and `assertReady()`, called from the `force-dynamic`
route `/api/health/secrets` that the release smoke check asks on the staged
deployment and again on the live site, proves that the deployed key is the
backed-up one. The route answers `{ ready, verified }` and nothing else; the
reason for a refusal goes to the server log. Development gets its own key, written to `.env.local` by
`loom add secrets`; its fingerprint is not recorded. Preview has no key: a
preview cannot store or read forum keys, and the page says so.

**No reader for the existing `v1.` strings.** The current code has been live
since 9 October and Gadi is all but certain no temple has connected a forum.
The first step of the rollout counts `temple_forums` rows in production. If
there are none, nothing is lost. If there are some, the sync reports them as
unreadable and the temple's administrator enters the key again. The settings
page does not decrypt today, so it would still show the saved hint as if
healthy; it gains an "unreadable, enter it again" state. Writing a permanent
reader for a format three days old is not worth it.
Existing `v1.` rows, if any, show up as `malformed` in Loom's `report`,
`verify` and `reseal`, which is expected.

**One purpose, bound to the temple, the forum address and the username.**
`temple-forum.api-key`, bound to `{ temple, origin, username }`. Today the
binding is temple and address. Adding the username means a database edit
alone cannot change who forum actions are attributed to. It is not more than
that: whoever the database calls a temple administrator can still change the
username through the form, which seals the key again under the new name, and
an older row of the same temple can be put back whole.

**Changing a bound field without a new key re-seals in the transaction.** The
form lets an administrator change the API username and keep the stored key.
With the username in the binding that key would stop opening, so the update
opens it with the old binding and seals it with the new one, inside the
existing `withTemple` transaction. Changing the address still requires entering
the key again, as now, because the key is checked against the forum before it
is saved.

**Calls become asynchronous, and ask whether the keys are ready.**
`encryptForumKey` and `decryptForumKey` are synchronous Node `crypto`; Loom's
`seal` and `tryOpen` are Web Crypto. The call sites in `src/temples/forum.ts`
are already inside async functions. `canStoreForumKeys` was called
synchronously while rendering and the plan first replaced it with a check
that the key variables are present. Review showed that is not enough: with a
key present but wrong (a fingerprint mismatch), Loom reports every stored
value as unreadable, so each administrator would be told their own key had
gone bad and would send a fresh one to their forum before the save failed. So
`canStoreKeys`, `save` and the sync loader ask `assertReady()` instead: the
form is switched off, a save is refused before the key goes anywhere, and a
sync says the server cannot read keys at the moment.

**The hint stays local.** The four-character hint is magickli's own display
rule and is not a Loom concern. It stays in `src/temples/forumKeys.ts`, which
keeps its name and now holds the hint and the one function that builds the
binding; the cipher in it is gone. When a key is kept or sealed again the
hint is recomputed from the key, since the stored hint is not sealed with it.

**One declared location.** `temple_forums.api_key_encrypted`, so Loom's
`report`, `verify` and `reseal` can run. magickli has no jobs feature, so they
are wired to a server action on the global administration page (`/admin`,
"Stored secrets"), with a rehearsal that writes nothing. A real reseal is
refused unless the keys were checked against recorded fingerprints, and a run
is called clean only when every location was read to its end, no row failed
and none changed underneath it. The column's 2048-character
check already fits: a 512-character key seals to about 770 characters.

**Re-entry is not protected by the binding.** If someone with database access
changes the stored username or address, the key stops opening and the
administrator is asked to enter it again. In that state the form offers
neither the saved address nor the saved username back. The address matters
more than the username the plan first named: a new key is checked against the
forum before it is saved, so a pre-filled address would send it to a host the
administrator never chose. Reading the settings therefore opens the stored key
to learn whether it still can be; when it cannot, the service returns nothing
else of the connection, so the saved values do not reach the browser at all,
and a blank key is refused. A value that fails to open is logged on the server
with its purpose, key version and reason.

**Authorize before the forum is contacted.** Found by the final review and
older than this plan: saving checked the typed key against the typed address
before it knew the temple existed or that the caller administers it, so any
signed-in user could have the server request a host of their choosing. The
save now resolves the temple and authorizes first, and again under its lock.

## Known limits

- A malformed `LOOM_SECRETS_ENVIRONMENT` value, or a malformed key list in
  `loom.json`, makes `src/secrets.ts` throw when it loads. The temple
  administration page and the forum sync then fail outright, not only the
  health route. The release smoke check still fails closed.
- When the pointer names a key that is not there but an older key is, the
  page says forum connections are switched off although stored keys still
  open and a sync still runs.
- Changing only the username does not ask the forum again whether the key is
  an administrator's for that name. The next sync finds out.
- The stored `api_key_hint` is still written but no longer read.

## Rejected

- **Keeping the auth-derived key as a fallback.** It would keep the coupling
  this plan removes.
- **Binding to the forum address only.** It leaves the username editable
  underneath the key.
- **Requiring the key again on any change.** Simpler, but a regression for
  administrators who only fix a username.

## Risks

- A temple connects a forum between the row count and the deploy. Its key then
  shows as unreadable and is entered again. No data is lost that the
  administrator does not hold.
- The production key is pasted wrongly. `assertReady()` fails the smoke test
  before any key is stored.
- The Loom feature is new. This is its first inline adopter; porty3's plan 036
  is the first with existing data.

## Rollout, each step Gadi's

1. Count `temple_forums` rows in production. Skipped on 14 October 2026: Gadi
   reports no temple changes since the forum code landed, so none are expected;
   any that exist show as unreadable and the key is entered again.
2. `pnpm exec loom secrets keygen` in Gadi's own terminal, on this branch; save
   the key and fingerprint; commit the fingerprint. `loom check --production`
   fails until a production key has been recorded by `keygen`, so this step
   comes before any commit that the release gate checks.
3. Add the two variables to Vercel, Production only. With Loom 1.37.0
   `keygen` offers to do this itself: answer yes and paste the key back from
   the password manager (`loom secrets push 1` does the same later). Here and
   at any later
   rotation, set the pointer variable (`LOOM_SECRETS_ACTIVE_KEY`) on the
   platform **before** deploying a `loom.json` that changes the active key: a
   deployment built with the new list and the old pointer fails every seal,
   though opens still work. `vercel env pull` rewrites `.env.local` and drops
   the development key and `LOOM_SECRETS_ENVIRONMENT`; run `loom add secrets`
   again afterwards.

   Add the secrets requirements to `.github/vercel-production-env.json`.
   Naming the key as a required Secret is not enough: `loom check --production`
   only accepts a requirement with a `keyPattern` that covers every key
   version, with `sensitive: true` and `productionOnly: true`, plus a `keys`
   requirement for the pointer. Use the pair `loom check` prints:

   ```json
   {
     "name": "secrets keys",
     "keyPattern": "^LOOM_SECRETS_KEY_[1-9][0-9]*$",
     "sensitive": true,
     "productionOnly": true,
     "placeholder": { "kind": "secret" }
   },
   { "name": "secrets active key pointer", "keys": ["LOOM_SECRETS_ACTIVE_KEY"] }
   ```
4. Deploy. The smoke test's `assertReady()` must pass.
5. Connect a forum on a test temple, read it back, change its username, read
   it back again.

## Verification

- `forumKeys.test.ts` is replaced by tests through the new wrapper: round trip;
  refusal under another temple, address or username; the username-change
  re-seal; an unreadable stored value; no key configured; keys refused.
- The settings form, the health route, the declared location and the smoke
  check have tests of their own.
- The help page's forum screenshot shows the form before anything is
  connected, which did not change, so it was not regenerated. Capturing it now
  needs a development key in `.env.local` (`loom add secrets` writes one).
- `pnpm` typecheck, lint and tests; `loom check`; `loom check --production`
  before release.

## Follow-ups

- **To do: rollout step 5**, connecting a forum on a test temple, reading it
  back, changing its username and reading it back again. Deferred by Gadi on 14
  October 2026. Do it before telling temples about their own forums, or the
  first time one connects.

- Site-wide `DISCOURSE_API_KEY` stays an environment variable; it is not a
  stored secret.
