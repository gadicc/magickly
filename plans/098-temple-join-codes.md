# Temple join codes — 24 November 2026

Status: built on 24 November 2026 on `gate/098-temple-join-codes` (see
[As built](#as-built-24-november-2026)). Drafted and agreed the same day. Gadi took the
recommended code format and limit (decisions 1 and 2) and chose to
replace every existing code in the migration (decision 3, option b). Closes finding M2 of the input audit of 24 November 2026
(read-only Opus review; notes kept outside the repository).

## The finding

A temple administrator types the join code by hand
(`src/app/temples/admin/[_id]/InviteManager.tsx`), and `updateInvite`
(`src/temples/sql.ts`) accepts any 1–200 characters without `/`. Neither
`getJoinPreview` (the GET page `/temples/join/<slug>/<code>`) nor `join`
(its confirming POST) counts failed attempts, and the preview answers
"no temple matches" or shows the temple's name, which is an oracle. A
code like `1234` falls to 10,000 page loads from one signed-in account,
and success creates a grade-0 membership.

Sign-in is Google only (`src/auth/sqlAuth.ts`; email and password exist
only for the local test login), so an account is the natural "actor":
each one costs the attacker a Google account.

## What changes

### 1. Codes are made on the server

- **Format (decision 1):** 20 characters of Crockford base32 (the digits
  and the letters without `i`, `l`, `o`, `u`), 100 random bits from
  `crypto.randomBytes`, stored and shown lowercase in four groups of five:
  `7kq2m-dx9vt-a4hr0-nweb3`. URL-safe as it stands (letters, digits,
  hyphens). Admins read it out or print it, and people type it into My
  Temples, so the lookup forgives what people get wrong when typing:
  case, spaces, missing or extra hyphens, and `o`→`0`, `i`/`l`→`1`. A
  code that does not fit the pattern after that is a miss (see 3).
- `src/temples/joinCode.ts` (new, no database): `generateJoinCode()`,
  `normalizeJoinCode(input)`. Pure functions, unit-tested.
- The writer drops the free-text `updateInvite` and gains two commands,
  each with the same checks as today (fresh actor, row lock, temple or
  global admin):
  - `regenerateInvite({ version: 1, expectedActorId, templeId })` makes a
    new code, replacing any old one, and returns nothing secret (the page
    reloads and reads it as now);
  - `disableInvite({ version: 1, expectedActorId, templeId })` deletes
    the invite row, as clearing the field does today.
  `createSqlTempleWriter`'s options gain `generateJoinCode`, as they
  already take `generateId`, so tests and the screenshot fixture get a
  fixed code.
- Codes stay readable to admins (stored as they are now, not hashed):
  the admin page has to show the link and QR code again later. The table
  is read only after the admin check.
- New temples still start with no code; the admin creates one.

### 2. Failed attempts are limited per account

- New table `temple_join_failures`: `user_id` (primary key, references
  `user`, deleted with it), `day` (UTC date), `failures` (positive
  integer). One row per account, reused each day, as `chat_daily_usage`
  does. Migration `0030_temple_join_codes.sql` via `pnpm db:generate`.
- **Limit (decision 2):** 10 failed lookups per account per UTC day.
- To be safe under parallel requests, an attempt is **reserved before**
  the lookup with one conditional upsert (the `reserveDailyUsage`
  pattern in `src/app/chat/usage.ts`), and **given back** when the code
  matched, so people who follow a good link never use any of it. A
  hundred parallel guesses therefore get ten lookups, not a hundred.
- Both `getJoinPreview` and `join` go through it; any miss counts (wrong
  slug, wrong code). A refused account gets a distinct result
  (`limited`, with the reset time) and the page says so: "Too many
  incorrect join codes today. Try again after {time}." Only that account
  is refused, so nobody can lock others out of a temple. No per-temple
  cap, for that reason; with 100-bit codes it would add nothing.
- `src/temples/joinAttempts.ts` (new) holds reserve and refund; they
  are tested through the join tests in `sql.test.ts`, against PGlite.

### 3. Existing temples (decision 3: replace)

Imported and hand-chosen codes are the only weak ones, and the migration
replaces them all: `0030` sets every `temple_invites.join_pass` to a
fresh code in the new format, drawn in SQL from `gen_random_uuid()`
(PostgreSQL's strong random source; the first byte of a version-4 UUID
is wholly random, so its low five bits pick one character, a fresh UUID
for each character). Invitation links and printed QR codes handed out
before the release stop working; admins make or show the new link from
the admin page. The other way, keeping old codes behind the limit with a
warning, was not taken.

From then on a lookup only accepts a code in the new format (after
normalising); anything else is a miss without a query. No database
`CHECK` on the format: the fenced legacy import
(`src/migration/planLegacyMembershipImport.ts`) still plans the old
codes as they were, and its receipts must not change. Were it ever run
again, its codes would simply never match, and the admin page treats a
stored code not in the format as no code.

### 4. The admin's invite panel

`InviteManager.tsx` loses the text field. It shows:

- with a code: the code (masked until "Show", as now), the link with its
  copy button and the QR code, and two buttons: **New join code** and
  **Turn off invitations**, each behind `ConfirmAction` (the dialog says
  that the old link and QR code stop working; members already in are not
  affected);
- without one: "No one can join with a code at the moment." and
  **Create join code** (no confirmation needed);

Server actions `regenerateTempleInviteAction` and
`disableTempleInviteAction` replace `updateTempleInviteAction`.

### 5. Copy and translations

All new strings are Lingui messages (`/*i18n*/` with `UiText` or the
scoped translator); the refusal text joins `src/app/temples/feedback.ts`'s
`FIXED` set; strings that go away leave the catalogs. Then
`pnpm i18n:extract`, Hebrew for the delta in `src/locales/he/messages.po`,
`pnpm i18n:check`, and `pnpm i18n:context` if the context file needs the
new strings described.

The help page (`/help/temples#invite`, English only) is rewritten where
it says to type, clear and save a code. It is indexed by site search, so
its records re-key; I publish the embeddings under the standing budget
rule in AGENTS.md (a few records, cents).

### 6. Screenshots

The `join-code` shot on `/help/temples` shows this panel, so it is
regenerated with `/usr/local/bin/magickli-docs-capture <worktree>
join-code` (and any other shot the panel's height moves, checked by
looking). The fixture (`scripts/docs-screenshots/fixtures.ts`) calls
`regenerateInvite` with a fixed synthetic code from the injected
generator, so the QR code is the same on every capture; the README's
"the join code `example-join-code`" changes with it.

## Tests

- `joinCode.test.ts`: length, alphabet, groups, bits drawn from
  `randomBytes`; normalisation of case, spaces, hyphens and the look-alike
  letters; anything else (`1234`, a short or long code) refused.
- `sql.test.ts` (PGlite): regenerate makes a new valid code and the old
  one stops working; disable removes it; non-admins and other temples'
  admins are refused; a global admin may; a code not in the format never
  matches, even when stored; a typed code with wrong case and no hyphens
  joins.
- The migration's SQL, run against PGlite: each row gets a distinct code
  in the format.
- The join-limit tests in `sql.test.ts`: misses on the preview and on
  `join` both count; the eleventh is refused without a lookup (a correct
  code too); a match costs nothing; the counter resets on a new UTC day;
  parallel reservations never pass ten; one account's limit does not
  affect another's.
- A render test for `InviteManager` with and without a code, and its
  two confirmation dialogs.
- The browser at 375, 768 and 1,440 px, light and dark, Hebrew, for the
  admin panel and the refusal on the join page.

## Commits and gates

On `gate/098-temple-join-codes`, each commit passing `pnpm gate:quick`
and its tests:

1. the plan (with the decisions as made);
2. `joinCode.ts`, the failures table and the migration that replaces
   the codes;
3. the attempt limit on preview and join;
4. regenerate/disable and the admin panel, copy and Hebrew;
5. help page, fixture, screenshots, embeddings.

Then a fresh Opus review of the diff, the full `pnpm gate`, and landing
on local `main` per AGENTS.md. Pushing stays Gadi's.

## Out of scope

The join code also sits in the URL path, so it reaches browser history
and server logs (audit, Info). That is the nature of an invitation link;
a regenerated code is the remedy when one leaks. Not changed here.

## As built, 24 November 2026

- As planned, with these differences: no `generated_at` column (all old
  codes are replaced, so none is needed); the refusal says "Try again
  tomorrow" rather than a time, as the server does not know the
  reader's time zone; the failures table's check allows zero, because a
  matched lookup gives its reservation back with one `UPDATE` rather
  than deleting the row; the join page treats a signed-in account the
  database does not know as "no temple matches".
- Checked in the browser on a dev server for this worktree (local
  database, test sign-in): 375 px dark, 768 px Hebrew and desktop; a
  new code made through the dialog; a typed code in capitals without
  hyphens found; ten wrong codes, then the refusal (English and Hebrew)
  even for the right code.
- The local development database is not kept on drizzle's migration
  journal (21 of 31 recorded), so 0030's statements were applied to it
  by hand, with Gadi's agreement, before capturing `join-code`.
  `magickli-docs-capture` refuses any `.env*` in the worktree, and
  `.env.ci` is now tracked, so it was moved aside for each capture and
  put back; the script's check could skip `.env.ci`.
- Site search: 15 records re-keyed and published (3,265 tokens).

## Decisions

Made by Gadi on 24 November 2026.

1. Code format: 20-character grouped Crockford base32 (100 bits).
2. The limit: 10 failed lookups per account per UTC day.
3. Existing codes: replaced in the migration (option b).
