# Temple administration — 9 October 2026

Gadi asked for an explanatory page for people who run temples. Writing it
exposed gaps, and he asked for the first three to be closed in the same
session: members could not be removed or leave, a ritual's audience could not
be changed after creation, and a temple's forum was not the temple's to
connect. This records what was decided and why, what was checked against real
data, and what is left for him to decide. The documents proposal that came out
of the same conversation is [plan 058](058-temple-documents.md).

## Commits

| Commit | What |
| --- | --- |
| `0545382` | The temples guide, `/help/temples`, with generated screenshots |
| `77cb5b1` | Remove a member, leave a temple, creator rights end with membership |
| `4c2038e` | Editors change who can read a ritual |
| `c085b06` | A temple connects its own forum |

## Decisions

**The guide and its screenshots.** `/help/temples` is public and in the
sitemap. Its images are never taken by hand: `scripts/docs-screenshots` seeds a
temple called Example with synthetic members and rituals through the app's own
services, then drives headless Chromium over the DevTools protocol (a small
client in `browser.mts`, so no new dependency) and writes WebP files next to
the page. `AGENTS.md` tells agents to regenerate them when a screen they show
changes, and the README lists the rules: synthetic data only, no dev overlay,
clip to the elements shown. The seed writes to the local development database
(it renamed one temple in place on 9 October to match the heading, which adds
" Temple" to the name). Readers only receive a ritual after its saved version
is published, so the capture presses Publish once, as an administrator would.

**Removing and leaving.** `removeMember` (a temple or global administrator)
and `leave` (the caller, for their own membership) share `deleteMembership`:
the temple row is locked, and deleting an administrator's membership is
refused when it is the last one, as demoting already was. The lock is now
`FOR NO KEY UPDATE`: it still serialises the temple writers but no longer
conflicts with the `FOR KEY SHARE` lock ritual creation takes on the temple,
which had inverted the lock order against remove and leave. A removed person
can rejoin with the join code at grade 0, so an administrator removing
someone should change or clear the code; the dialog and guide say so. There is
no receipt: removal is idempotent in effect and online-only.

**Creator rights end with membership (temple rituals only).** `getRitualAccess`
used to give a ritual's creator read and edit even with no membership at all,
which made removal ineffective for anyone who had created a ritual. For
temple-scoped rituals creator rights now need a current membership in that
temple, at any grade; public and group scopes are unchanged, as is the
confirmed policy of [plan 003](003-data-migration-contract.md) for them.
Checked against the 15 September production dump before changing it: it holds
five temple rituals; the creators of four are administrators of their temples,
and the fifth is the known orphan, stored as null. No existing creator loses
access. Downgrading an administrator who is also the creator does not remove
their creator rights while they remain a member.

*For Gadi.* Moving a ritual from a temple to a group (below) gives its creator
access again, even if they were removed from the temple, because group scope
keeps creator rights without membership. The dialog says so. The options are:
(a) require group membership for creator rights in group scope too, which
reverses a deliberate test (`permits creator access independently of
membership`); (b) clear the creator when a ritual moves to a scope they are not
in; (c) leave it. It is (c) for now.

**Changing who can read a ritual.** `authorizeRitualScopeChange` and
`createSqlRitualAccessService` (`sqlScope.ts`): the caller must edit the
ritual as it stands and administer a new temple or group (global
administrators may choose any); only global administrators make a ritual
public or take one out of public; naming the current scope again is a no-op.
It writes only the scope columns and `updatedAt`, so version and revision stay
put and an open editor can keep saving, and it needs no schema change. Access
is read fresh everywhere else, so people who no longer qualify lose the ritual
at once and the offline permission check deletes their downloaded copies
(`denied` purges). The editor's menu offers it, loaded on first use. The change
leaves no record of who made it beyond `updatedAt`; an audit log is a
follow-up.

**A temple's own forum.** Until now the sync talked to one hard-coded forum
with one environment key, for global administrators. A temple administrator can
now give their temple a Discourse address, API username and API key
(`temple_forums`, migration 0017, additive). The key is encrypted with
AES-256-GCM under a key derived (HKDF) from the Better Auth secret, so nothing
new needs configuring; `BETTER_AUTH_SECRETS` rotation keeps older keys
readable until the old secret is dropped, after which the key is entered
again. The ciphertext is bound to the temple and address as authenticated
data, and only a four-character hint is ever read back. Changing the address
requires entering the key again. Because anyone can create a temple, the
address is untrusted input: https only, standard port, a public DNS name (no
IP literals, `localhost`, `.local`, `.internal` and similar), resolved to
public addresses both when saved and before each sync, and every request
refuses redirects. DNS rebinding between that check and the connection is not
closed; it is stated in `forumOrigin.ts`. Running the sync needs a global
administrator or an administrator of that temple; a temple without a forum of
its own still uses the site forum, for global administrators only. For a
temple's own forum the sync also takes people it knows (linked to a local
account) out of the grade groups when they belong to no temple using that
forum; it never touches people it does not know, and does not do this on the
shared site forum, where other temples cannot be told apart. Saving also
proves the key is an administrator's by asking the forum for an admin-only page
(so a forum cannot be claimed by someone who does not run it, which would
otherwise let a removed member shield themselves from pruning by "connecting"
the same forum from a temple of their own), refuses the Magick.ly site forum,
and every request has a timer, a whole sync has a deadline, and bodies the app
reads are size-capped; bodies read inside the `discourse2` client are bounded
by the timers only.

The new table is registered as an empty runtime table in the guarded legacy
import (`LEGACY_IMPORT_TABLES`, its required artifact list), as the earlier
runtime tables were. That changes the import's complete-row projection, so a
rehearsal prepared before this commit must be refreshed before it is applied.

*For Gadi.* A sync sends each member's name, motto, grade and **verified email
address** to a forum the temple's administrator chose, which creates accounts
for people it does not know. The join page, the connection form and the guide
now say so, but members cannot opt out of it short of leaving. If that is not
enough, the alternative is a per-member opt-in (a profile switch, default off,
that sync respects).

## Verification

Each commit passed `pnpm check`, `pnpm typecheck`, the full coverage test run
and `loom check`; the access-change commit ran over `HEAD` in a separate
worktree because the working tree held the forum work (five
`dataInputs.mutation` tests fail only in that worktree and pass in the main
checkout). Each of the three features was reviewed by a fresh Opus 5.5 agent
given the spec and the diff; findings and their fixes are in the commit
messages. The forum review was security-briefed and found three majors, all
fixed before the commit. Browser checks used the local test sign-in: remove and leave,
changing a grade and watching the Reader's list change, and connecting,
refusing a private address and disconnecting a forum.

## Follow-ups

- TODO: an audit log of access changes (grade, removal, scope, forum).
- TODO: decide the creator rights gap above and the member opt-in for forum
  sharing.
- TODO: run the forum sync automatically after a membership change instead of
  only on request, with a visible last-synced time.
- Ideas, one line each, none started:
  - Documents in the temple library, with the same grading and offline use as
    rituals: [plan 058](058-temple-documents.md).
  - Audience finer than a minimum grade: an exact grade, officers only, or a
    named group within the temple.
  - Roles and invitations: single-use or expiring join codes, a queue of
    people waiting for approval, and a "my access" page for members.
  - A "what changed" feed or read receipt when a document updates (some temples
    will not want tracking, so it would be optional).
  - A printable or exportable copy with the reader's name on it, for temples
    that still want paper.
  - Summonses and RSVPs for meetings; an attendance register; membership dues
    and subscriptions. Temples may meet in person as well as online, so these
    are about running a physical lodge, which the app has not so far served.
