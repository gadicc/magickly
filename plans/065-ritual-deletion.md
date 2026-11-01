# Deleting rituals — 31 October 2026

Status: planned on `gate/ritual-deletion` from `main` at 8c536103.
Adversarially reviewed (Fable) and revised the same day, then Gadi's
answers to the open questions folded in, including the two spike
questions (no rehearsal, no preview-bucket test); see "Review, 31 October
2026" and "Owner answers, 31 October 2026" at the end. Built on 1
November 2026; see "The build" at the end. Read
[current status](000-current-status.md),
[plan 057](057-temple-administration.md) (access, removal, the creator
gap) and [plan 006](006-private-offline.md) (the offline lease) first.

Nothing in the app deletes a ritual today. Gadi asked for deletion with
safeguards: a delete that hides the ritual, a restore, and a retention
policy that removes it for good after a period. The assessment
(31 October 2026, not in the repository; its facts are folded in below)
weighed the options. Gadi accepted all fourteen of its recommendations
the same day.

Gadi's decisions, 31 October 2026:

1. **Retention: 30 days, fixed, stored per row.** A deleted ritual is
   removed for good 30 days after it was deleted.
   - Why: private temple material should be gone when its owner expects
     it gone, and 30 days is what Gmail and Google Drive have taught
     people.
   - Rejected: 180 days (storage is cheap, but it keeps private material
     six times longer); a period set per temple (a policy UI and a
     question of who may shorten it, for one temple in production).
     Storing `purge_after` on each row keeps a later per-temple policy or
     a hold free of migrations.
2. **"Delete permanently now": yes, from Recently deleted only, with the
   title typed.**
   - As revised by the review (B3): it is final the moment it is
     confirmed, cannot be undone by anyone, and is carried out by the
     next nightly run, within a day. No server action purges
     synchronously.
   - Why: an owner who wants material gone should not wait 30 days.
     Offering it only in the trash makes destruction two deliberate acts.
   - Rejected: a permanent delete straight from the editor; no permanent
     delete at all.
3. **Who may act.**
   - Delete and restore: anyone with edit access to the ritual as it
     stands. A public ritual needs a global administrator, matching the
     rule for taking a ritual out of public (`access.ts:206`).
   - Delete permanently: administrators of the ritual's temple or group,
     and global administrators. A creator who is not an administrator
     cannot.
   - Plan 057's creator gap stays as (c): in group scope a creator keeps
     edit without membership. Soft delete is reversible for 30 days, and
     the audit row shows who did it.
   - Why: deleting changes what a whole temple can read, like a scope
     change; irreversible removal belongs to the people who administer
     the audience.
   - Rejected: creators may purge (a creator removed from a group could
     destroy the group's ritual); administrators only for every action
     (a creator could not tidy their own drafts).
4. **No hidden administrator restore window beyond the 30 days.**
   - Why: the promise is what the UI says. A secret grace period would
     make "removed after 30 days" untrue.
   - Rejected: a 30-day window shown to users plus a longer one for
     administrators. (The global administrator's "cancel removal" in §3
     is for a purge stuck before any object was deleted; it is recorded
     and does not extend a requested permanent deletion.)
5. **Soft delete: a confirmation stating who loses the ritual, then an
   Undo snackbar.**
   - Why: one click removes it from a whole temple and wipes members'
     downloads (§6). Undo covers the slip that gets past the dialog.
   - Rejected: Undo alone (Gmail style), because the effect on others is
     larger than on a personal mailbox; typing the title, which belongs
     to the irreversible step.
6. **One "Recently deleted" list, filtered by permission.** It is linked
   from `/gd/rituals` when not empty and from the temple administration
   page. Global administrators see everything.
   - Why: rituals have no personal scope (creation needs a scope
     administrator, `authorizeRitualCreation`, `access.ts:279-301`), so a
     list filtered by who may restore already gives each creator and
     administrator their own view.
   - Rejected: a separate per-user trash; one list per temple only.
7. **Audit: a generic `audit_events` table with no titles, kept
   indefinitely.** It starts with the ritual lifecycle and will later
   carry plan 057's access-change log.
   - Why: "who deleted it?" must be answerable after the purge, without
     keeping the private title.
   - Rejected: a ritual-only table (plan 057 needs the same thing); no
     audit at all.
8. **What readers see.**
   - People without access: nothing changes; a deleted ritual looks like
     an ID that never existed.
   - A formerly public ritual returns a 404 until it is purged.
   - The member and editor notice ("this ritual was deleted") is a later
     stage, through a separate request, never by changing the offline
     reply (§6).
   - Why: nothing may leak to people who never had access, and installed
     offline clients must keep recognising `denied`.
   - Rejected: 410 (an App Router page cannot easily send it, and search
     engines treat it like 404); a `reason` field on `denied`.
9. **Purge mechanism: a daily Vercel cron route behind `CRON_SECRET`.**
   No Loom jobs for now.
   - Why: it runs in the production runtime with the credentials that
     runtime already has; only one new secret.
   - Rejected:
     - GitHub Actions on a schedule: production database and R2
       credentials in GitHub, or the route's secret held in two places;
       scheduled runs are best-effort.
     - Loom jobs: shipped in `@gadicc/loom@2.0.0` but not active here,
       and it has no scheduler. It could later add an operator page.
     - Opportunistic purging on page views: unreliable.
     - `pg_cron`: cannot delete R2 objects.
10. **Backups: not relied on.** As answered by Gadi on 31 October: the
    Neon point-in-time restore window is 6 hours on the free plan, and
    "let's not rely on this".
    - The guide promises nothing about backups. It says that Recently
      deleted, for 30 days, is the only way back, and that a purged
      ritual is gone.
    - Do not turn on R2 versioning.
    - Why: a 6-hour window rescues nobody who notices a mistake the next
      day, and versioning would keep purged images.
    - Rejected: relying on host backups.
11. **Evidence from the import of the old site, kept for now.** This
    covers `legacy_import_runs.payload`, the importer's local run file,
    the gitignored `dump/` files, and the old Mongo database and bucket.
    Whether to retire it is a separate decision.
    - Until it is taken, the guide does not promise a complete purge for
      the five rituals imported in September 2026.
    - Why: this evidence is a migration safeguard, and its hashes forbid
      editing one ritual out of it.
12. **Write receipts and legacy aliases survive a purge.**
    - Why: they hold no content. Purging a create receipt would let a
      delayed retry re-create the ritual under a new ID, because the
      server generates it (`sqlWrites.ts:285-286,361`).
    - Rejected: purging them for tidiness.
13. **Tell the other administrators when a ritual is deleted:** in the
    later stage (an in-app notice; email only if notifications exist by
    then).
14. **Names fit plan 058's documents.**
    - The audit table records `subject_kind` (`ritual` now, `document`
      later).
    - The services speak of rituals today, but the columns sit on the
      table plan 058 would generalise.

**Offline copies** (from the review, B1; Gadi chose option (b) on 31
October): the Downloaded rituals page, when opened online, rechecks every
downloaded ritual and drops deleted ones (§6). The wording stays honest
about devices that open neither.

## What exists (read for this plan)

Paths are as of `main` at 8c536103.

### What hangs off a ritual

No foreign key here has an `ON DELETE` action. Every one is `no action`
(drizzle `0004`, `0008`, `0009`, `0011`), and none is `DEFERRABLE`. The
only cascades in the schema hang off `auth_user`.

- **`rituals`** (`src/db/schema/rituals.ts:48-100`): title, scope and the
  two current pointers.
  - The pointers make a circle. `(id, current_revision_id)` references
    `ritual_revisions(ritual_id, id)` (`:79-83`), and
    `(current_revision_id, current_compiled_artifact_id)` references
    `ritual_compiled_artifacts(revision_id, id)` (`:84-91`).
  - The check `rituals_selected_artifact_requires_revision` (`:92-95`)
    allows both pointers to be null together.
  - A purge must clear both pointers before deleting artefacts and
    revisions.
- **`ritual_revisions`** (`:103-143`): the full source. Foreign key on
  `ritual_id` (`:107-109`).
- **`ritual_compiled_artifacts`** (`:185-235`): compiled JSON. Composite
  foreign key to the revision's `(id, source_sha256)` (`:206-210`).
- **`legacy_ritual_compiled_archives`** (`:150-182`): compiled JSON of
  imported rituals. The primary key is a foreign key to `rituals`, and it
  also references its own revision.
- **`ritual_bundle_publication_intents`** (`ritualBundles.ts:38-119`):
  `ritual_id` with no foreign key (`:46`). Its `manifest_json` holds the
  **title** (`ritualBundleManifest.ts:35,297`) and its `plan_json` the
  asset plan.
  - Intents expire within 24 hours (`:106-109`), and claims within 120
    seconds (`:110-113`).
- **`ritual_bundle_assets`** (`:126-203`): references the intent
  (`:167-175`) and records each asset copy's provider, bucket and object
  key.
  - Copies are never deduplicated across bundles (`:121-125`).
- **`ritual_bundles`** (`:210-241`): the delivery marker. References the
  intent and `ritual_revisions` (`:220-234`).
- **`ritual_upload_intents`** (`ritualFiles.ts:26-105`): `ritual_id`
  with no foreign key. Records the filename, the staging and canonical
  keys, a 24-hour expiry and a 120-second claim.
- **`ritual_file_links`** (`ritualFiles.ts:108-145`): foreign keys to
  `rituals` (`:113-115`), to `loom_files` and to the intent. Its
  `deleted_at` (`:123`) is unused in production code.
- **`loom_files`**: the digest is globally unique (`loomFiles.ts:44-46`),
  and a duplicate upload is rejected even against a tombstone
  (`sqlRitualUploads.ts:310-311,423-428`). So an uploaded file row belongs
  to one ritual. Its `bucket` is nullable (`loomFiles.ts:26`).
  - Legacy files have no ritual links (`legacyImportRows.ts:231`) and
    are served publicly by digest through `/api/file2`
    (`legacyPublicFiles.ts:177-198`). A purge must never touch them.
- **`ritual_write_receipts_v2`** (`ritualCommands.ts:219-253`) and
  **`legacy_id_aliases`** (`legacyIds.ts:198-242`): no foreign keys to
  the ritual by design, and no content. Kept (decision 12). The receipts'
  `actor_id` does reference `auth_user`.
- **`legacy_import_runs.payload`** (`legacyImportRuns.ts:155-224`): up to
  64 MB holding all five imported rituals. Kept (decision 11).
- **`study_progress.set_id`** names built-in study sets
  (`studyProgress.ts:34`), never rituals.

### Object storage

There is one private R2 bucket per environment (`loom.json`
`features.files.storage`), with one credential, `FILES_S3_*`
(`ritualStorageConfig.ts:112-113`).

- **Key layout:**
  - Upload staging: `ritual-staging/{operationId}`.
  - Upload canonical: `ritual-files/{fileId}/{sha256}`
    (`r2RitualStorage.ts:309,314`; prefixes in
    `ritualStorageConfig.ts:115-116`).
  - Bundle assets: `ritual-bundles/{bundleId}/{assetKey}`
    (`r2RitualBundleStorage.ts:305`). These keys contain no ritual ID.
- **What lingers today:**
  - Finalising an upload never deletes its staging object (plan 008).
  - "Late provider writes can leave owned orphans" (plan 008:17).
  - A presigned upload URL lives up to 600 seconds, and never beyond its
    intent (`r2RitualStorage.ts:433`).
- **Nothing deletes R2 objects anywhere in the app.**
  - The only S3 commands imported are Get, Put and the presigner.
  - The bundle storage interface says it has no deletion
    (`r2RitualBundleStorage.ts:101`).
  - The Files route's adapter passes only Get and Put
    (`src/files/storage.ts:86`) and is wired into the read-only Loom route
    (`src/app/api/files/route.ts`).
  - Loom's S3 `deleteObject` silently does nothing without a
    `DeleteObjectCommand` constructor
    (`node_modules/@gadicc/loom/source/src/files/s3.ts:115-125`). Loom's
    Files service never calls it.
  - Plan 014:27 says the operator created Object Read & Write credentials;
    whether they cover delete is spike question 2.

### Every query of `rituals`

No query filters deletion today. These are all the sites outside tests.
Each is either a `.from`/`.update` on the table or raw SQL naming it.

| Site | Path | Effect if a deleted ritual is not filtered |
| --- | --- | --- |
| `src/doc/sqlReads.ts:107-125` `parent()` | reader, metadata, rendered, source history, current and revision source | content readable |
| `src/doc/sqlReads.ts:187-202` `listMetadata` | `/gd/rituals` (`page.tsx:47`), `/upload` (`page.tsx:30`) | still listed |
| `src/doc/sqlScope.ts:87-98`, update `:219` | Who can read this ritual | scope of a deleted ritual changed |
| `src/doc/sqlWrites.ts:204-211` (`for update`), update `:407`, replay `:270-276` | save, title, publish, receipt replay | edits succeed |
| `src/files/sqlRitualUploads.ts:402-407` (`for share`) | image upload, its claim and finalise | uploads to a deleted ritual |
| `src/offline/sqlPermissionCheck.ts:76-80` | `/api/rituals/permission` | devices renew 14-day grants |
| `src/offline/sqlRitualBundleReads.ts:147-158` | `/api/rituals/assets/...` | bundle bytes served |
| `src/offline/sqlRitualPublicationSelection.ts:109-118` | publish | publication |
| `src/offline/sqlRitualBundlePublications.ts:303-308` (`for share`) | bundle initiate, claim, publish | publication |
| `src/offline/sqlRitualPublicationBackfill.ts:86-100` | global-admin backfill batch | re-bundled |
| `src/migration/sqlLegacyImport.ts:464`; `legacyImportRows.ts:31` (`schema.rituals`) | the fenced, one-shot importer | n/a |
| `scripts/export-ritual-corpus.ts:40` (raw SQL) | owner export to local disk (`audit-ritual-corpus.ts` reads that export, not the database) | deleted text exported |
| `scripts/docs-screenshots/fixtures.ts:10` (`rituals as ritualRows`), queried at `:262-270` | the screenshot seed's `saveIfChanged` | seed saves to a deleted sample |

Some paths are covered once `parent()` is filtered:

- the `/doc/[_id]` metadata and the anonymous public render
  (`page.tsx:31-58`);
- ritual-linked files on `/api/files`, because `ritualFileAccess.ts:23-56`
  calls `sqlRitualReader.getRendered`, and `repository.ts:162` already
  requires a live link.

Some paths never list database rituals: the sitemap
(`src/app/sitemap.ts:14-30`), the SEO pages and cards, `/api/render`,
`/api/file2` and the app-bar search.

Where writers already serialise:

- Writers lock the parent row. Saves and scope changes take `FOR UPDATE`
  (`sqlWrites.ts:209`, `sqlScope.ts:96`).
- Uploads and bundle publications take `FOR SHARE` in one shared
  `authorize` callback per service (`sqlRitualUploads.ts:402-407`,
  `sqlRitualBundlePublications.ts:303-308`). Initiate, claim and complete
  all go through it.
- A delete that takes `FOR UPDATE` therefore waits for every writer in
  flight, and every later writer sees the deletion.

### Resurrection

- **The legacy importer cannot re-insert anything.**
  - It is a singleton (`legacyImportRuns.ts:164,184`).
  - After completion it compares every table it knows with `except all`
    against its saved rows (`legacyImportRows.ts:314-357`).
  - It is fenced to an exact list of artefacts
    (`LEGACY_IMPORT_REQUIRED_ARTIFACTS`, `legacyImportCommand.ts:41-127`).
  - Plan 000 forbids rerunning it.
  - Every migration still updates that list and `LEGACY_IMPORT_TABLES`
    (`legacyImportRows.ts:16-54`), as `071c7f1d` did for 0018.
- **The legacy Gongo path is dead.** `/api/gongoPoll` answers 410, and
  `registerLegacyRitualWrites` is reached only from tests.
- **The live risks** are writes against a soft-deleted row, a receipt
  replay (`sqlWrites.ts:270-276`, which today returns ok for any row
  present), the backfill, purged create receipts (decision 12), and the
  screenshot seed (§7).

### Access

`getRitualAccess` (`src/doc/access.ts:105-145`) gives edit to:

- global administrators;
- the creator, for temple scope only while a member (`:119-128`);
- group administrators;
- temple administrators.

Further rules:

- Scope changes need edit access plus administration of the destination.
  Public in or out needs a global administrator
  (`authorizeRitualScopeChange`, `:186-221`).
- Built-in rituals are files (`src/doc/0=0.pug`, `1=10.pug`, `2=9.pug`)
  with no SQL row, and their slugs fail `parseRitualRouteIdentity`
  (`ritualRouteIdentity.ts:10-29`). They cannot be deleted by
  construction.

### Offline copies

- **Downloads.** Opening a private ritual online downloads it
  (`PrivateRitualReader.tsx:154,189-194`) into Dexie
  (`src/offline/storage.ts:160-184`). The lease lasts at most 14 days
  (`lease.ts:3`).
- **Only two things re-ask the server.** The single-ritual reader
  (`refreshOfflineRitual`, `src/offline/ritualDownload.ts:29`, called only
  from `PrivateRitualReader.tsx:154`) and, for editors, the editor's
  source sync (`syncOfflineRitualSource`,
  `src/app/doc/[_id]/edit/SqlDocEdit.tsx:661`).
  - The Downloaded rituals page (`OfflineRitualCatalog.tsx:75-100`)
    lists what the device holds and never contacts the server.
  - Lease expiry (`lease.ts:201-214,278-290`) is the only other way a
    copy goes.
  - **So a member who never reopens a deleted ritual keeps its download
    for up to 14 days**, connected or not (review B1).
- **What a reply does.** A validated `denied` reply locks the copy as
  revoked and purges its bundle, assets and source (`lease.ts:182-189`;
  `repository.ts:655-759`, `purgeResource` `:438-451`).
  - Every other answer counts as temporary and keeps the copy: any other
    status, a malformed body, or a thrown error
    (`permissionContract.ts:92-97,113-118`; `sqlPermissionCheck.ts`
    catch).
  - A missing row already answers `denied` (`sqlPermissionCheck.ts:80`).
- **The trap.** `shape()` demands the exact key count
  (`permissionContract.ts:53-65,123-126`). A `denied` reply with any extra
  field is read as temporary by every installed client, which keeps the
  ritual for up to 14 days.
- **Drafts and outbox entries are never purged** (`lease.ts:69`).
  - A save that gets `NOT_FOUND` or `FORBIDDEN` becomes `rejected`
    (`repository.ts:1447-1457`). The draft stays, reachable through
    Download draft (`drafts.ts:405-426`).
- **No UI shows a revocation as such.** The reader says "This ritual is
  unavailable on this device. Connect and retry to check access."
  (`PrivateRitualReader.tsx:279`).

### Release, scheduling, backups

- **`release.yml`** runs CI, then:
  1. pulls the production env and masks it with
     `loom db release mask-env`;
  2. builds placeholders from `.github/vercel-production-env.json`
     (`loom db release prepare-build-env`);
  3. checks the migration connection
     (`loom db migrations verify-env --connect`);
  4. `vercel build --prod --standalone`, then
     `loom db release verify-build-env`;
  5. `vercel deploy --prebuilt --prod --skip-domain`;
  6. **`pnpm run db:migrate`** (drizzle-kit) under the pulled env and
     `MIGRATION_DATABASE_URL_UNPOOLED` (`:119-130`);
  7. the staged smoke checks, then `vercel promote` and the promoted
     checks.

  There is no `loom db release migrate` step: Loom masks the env, builds
  and verifies the placeholders, and checks the connection; drizzle-kit
  migrates.
- **Every push to `main` runs it**, and migrations land while the
  previous deployment is still live, so each must suit both versions
  (expand only; `.claude/skills/loom/references/release-safety.md:120-122`).
- **Nothing is scheduled:**
  - no `schedule:` in any workflow;
  - no `crons` in `vercel.json`, which disables Git deployments of `main`;
  - no `CRON_SECRET`;
  - no cron route, and no route sets `maxDuration`.
- **Backups:**
  - No Neon restore window is recorded (plan 004:63-64).
  - Restoring a snapshot is not a rollback (plan 025:56-58).
  - R2 has no versioning or lifecycle rules (plans 014, 022).

### Precedents

- **Online-only commands with no receipt.** Plan 057's member removal is
  idempotent in effect (`057:34-43`). Scope change is a service
  (`sqlScope.ts`) behind server actions that validate their arguments
  (`src/app/doc/[_id]/edit/semantic/accessActions.ts`). Its transaction:
  1. `lock_timeout` 5 s;
  2. the principal's grants locked `FOR SHARE`;
  3. the parent `FOR UPDATE`;
  4. one failure code for missing and forbidden alike.
- **The editor's menu**
  (`src/app/doc/[_id]/edit/semantic/SemanticEditor.tsx:1224-1272`) holds
  Download draft, View ritual, "Who can read this ritual…" (a lazily
  loaded dialog) and the Pug guide.
- **UI pieces:** a danger dialog in `src/app/temples/ConfirmAction.tsx`;
  an Undo snackbar in `src/doc/RitualTaskDeletionNotice.tsx`.
- **Routing:** `/gd/rituals/*` is already network-only in the service
  worker (`privateRequests.ts:37-43`), and `/api/*` is private.
- **Guard tests:** `src/components/importBoundary.test.ts` walks source
  files with the TypeScript compiler API.
- **Database tests:** the PGlite harness is a single session
  (`src/doc/sqlWrites.test.ts:2-4`). Lock behaviour is asserted from the
  query log (`sqlWrites.test.ts:903-940`), not by real waits.
- **Help screenshots:** `/help/temples` takes its images from
  `scripts/docs-screenshots` (`capture.mts`), and AGENTS.md requires
  regenerating them when a screen they show changes. The seed finds each
  sample ritual by its creation receipt and always calls `saveIfChanged`
  (`fixtures.ts:216-232`).

## Design

### 1. The data model

Six columns on `rituals`, in `src/db/schema/rituals.ts`:

```ts
deletedAt: instant("deleted_at"),
deletedById: uuid("deleted_by_id").references(() => user.id),
purgeAfter: instant("purge_after"),
// "Delete permanently" was confirmed: final, restore refused.
purgeRequestedAt: instant("purge_requested_at"),
// The purge claimed the row.
purgeStartedAt: instant("purge_started_at"),
// Set just before the first object delete is sent: the point of no return.
purgeObjectsDeletedAt: instant("purge_objects_deleted_at"),
```

Their check and partial index:

```ts
check("rituals_deletion_state", sql`
  (${t.deletedAt} is null and ${t.deletedById} is null and ${t.purgeAfter} is null
    and ${t.purgeRequestedAt} is null and ${t.purgeStartedAt} is null
    and ${t.purgeObjectsDeletedAt} is null)
  or (${t.deletedAt} is not null and ${t.deletedById} is not null
    and ${t.purgeAfter} is not null and ${t.purgeAfter} >= ${t.deletedAt}
    and (${t.purgeRequestedAt} is null or ${t.purgeRequestedAt} >= ${t.deletedAt})
    and (${t.purgeStartedAt} is null or ${t.purgeStartedAt} >= ${t.deletedAt})
    and (${t.purgeObjectsDeletedAt} is null
         or (${t.purgeStartedAt} is not null and ${t.purgeObjectsDeletedAt} >= ${t.purgeStartedAt})))`),
index("rituals_purge_due_idx").on(t.purgeAfter)
  .where(sql`${t.purgeAfter} is not null`),
```

`deleted_by_id` references `auth_user`, as the receipts' `actor_id` does.

A new table, `audit_events`, in `src/db/schema/audit.ts`:

```ts
export const auditEvents = pgTable("audit_events", {
  id: uuidV7("id").primaryKey(),
  at: instant("at").notNull(),
  // FK to auth_user, like the receipts; null only for the scheduled purge.
  actorId: uuid("actor_id").references(() => user.id),
  subjectKind: text("subject_kind").notNull(),   // 'ritual'
  subjectId: uuid("subject_id").notNull(),      // no FK: survives the purge
  action: text("action").notNull(),
  scope: text("scope").notNull(),                // public | group | temple
  templeId: uuid("temple_id"),                   // no FK, like the receipts
  groupId: uuid("group_id"),
}, (t) => [
  v7("audit_events_id_v7", t.id),
  check("audit_events_subject_kind", sql`${t.subjectKind} in ('ritual')`),
  check("audit_events_action", sql`${t.action} in
    ('delete','restore','purge_requested','purge_cancelled','purged')`),
  check("audit_events_actor", sql`${t.actorId} is not null or ${t.action} = 'purged'`),
  check("audit_events_scope", sql`(${t.scope} = 'public' and ${t.templeId} is null and ${t.groupId} is null)
    or (${t.scope} = 'group' and ${t.groupId} is not null and ${t.templeId} is null)
    or (${t.scope} = 'temple' and ${t.templeId} is not null and ${t.groupId} is null)`),
  index("audit_events_subject_idx").on(t.subjectKind, t.subjectId, t.at),
  index("audit_events_temple_idx").on(t.templeId, t.at),
]);
```

- **No title, no content, no foreign key to the subject.** Like the
  receipts, the row is history, not a reference that blocks the purge.
  The `actor_id` foreign key means a future account deletion must handle
  it as it handles the receipts' actors.
- **Text with checks rather than `pgEnum`.** Plan 057's access changes,
  and plan 058's `document` kind, extend a check in a later migration
  without `ALTER TYPE`.

A heartbeat table, `cron_runs`, in the same file (review B2):

```ts
export const cronRuns = pgTable("cron_runs", {
  job: text("job").primaryKey(),                 // 'purge-deleted-rituals'
  startedAt: instant("started_at").notNull(),
  finishedAt: instant("finished_at"),
  outcome: text("outcome"),                      // ok | partial | failed
  due: integer("due"), purged: integer("purged"),
  deferred: integer("deferred"), failed: integer("failed"),
}, (t) => [
  check("cron_runs_job", sql`${t.job} in ('purge-deleted-rituals')`),
  check("cron_runs_outcome", sql`${t.outcome} is null or ${t.outcome} in ('ok','partial','failed')`),
]);
```

It is one row per job, written at the start of each run and again at its
end.

- Why a table and not an `audit_events` action: a heartbeat is current
  state with no subject. One row neither grows daily nor loosens
  `audit_events`' subject and actor checks.
- `finished_at` null with an old `started_at` means a run died midway.

**A deletion touches neither `updated_at` nor `version`.** "Last edited"
stays true, and an editor that is still open can keep its base version
through an Undo.

**The migration**, `pnpm db:generate --name ritual_deletion`:

- produces `drizzle/0019_ritual_deletion.sql`, `meta/0019_snapshot.json`
  and the journal entry;
- regenerates the Valibot schemas (`pnpm schema:gen`:
  `src/db/valibot/generated/rituals.ts` and a new `audit.ts`, exported
  from `src/db/valibot/index.ts`);
- exports the new schema from `src/db/schema/index.ts`.

It is expand only:

- six nullable columns whose check passes for every existing row;
- a partial index on a table of a handful of rows;
- two new tables.

The previous deployment, live while `db:migrate` runs between deploy and
promotion, never names the columns, and its inserts satisfy the check.
There is no contract step. A failed promotion leaves the old code
running happily on the new schema.

**The importer fence**, as `071c7f1d` did:

- `LEGACY_IMPORT_REQUIRED_ARTIFACTS` gains the 0019 SQL, its snapshot and
  `src/db/schema/audit.ts`;
- `LEGACY_IMPORT_TABLES` gains `audit_events` and `cron_runs`, and the
  projection gives each `[]`;
- `legacyImportRows.pure.test.ts` adds them to `emptyTables`, and its
  table count goes from 37 to 39;
- the ritual rows from `planLegacyRitualImport.ts` set the six columns to
  null explicitly, so the full-row projection stays exact.

### 2. Hiding: one helper, one predicate, one guard

The sites select different field sets, so `src/doc/sqlPolicy.ts` gains
two forms.

```ts
/** SQL fragment: the ritual has not been deleted. Use in every rituals query. */
export const liveRitual = isNull(rituals.deletedAt);

/**
 * The one way to load a ritual's policy row by ID. A deleted ritual is
 * missing, exactly like an ID that never existed; lock as the caller needs.
 */
export async function loadSqlRitualParent(
  tx: SqlRitualSelectDatabase,
  id: string,
  lock?: "update" | "share",
): Promise<SqlRitualParentRow | null>;
```

Where each site goes:

| Site | Change |
| --- | --- |
| `sqlScope.ts:87-98` | `loadSqlRitualParent(tx, id, lock ? "update" : undefined)` |
| `sqlWrites.ts:204-211` | `loadSqlRitualParent(tx, id, "update")`; covers saves, publish and the replay at `:270` |
| `sqlRitualUploads.ts:402-407` | `loadSqlRitualParent(tx, ritualId, "share")` |
| `sqlRitualBundlePublications.ts:303-308` | `liveRitual` in its where (it selects `parentFields`, which add fields) |
| `sqlPermissionCheck.ts:76-80` | `loadSqlRitualParent(tx, id)`; no row stays `{ ...base, kind: "denied" }` |
| `sqlReads.ts:116`, `:193` | `and(..., liveRitual)` beside `isNotNull(currentRevisionId)` |
| `sqlRitualBundleReads.ts:152` | `and(eq(...), liveRitual)` |
| `sqlRitualPublicationSelection.ts:111` | `and(eq(...), liveRitual)` |
| `sqlRitualPublicationBackfill.ts:93` | `liveRitual` in its `and(...)` |
| `scripts/export-ritual-corpus.ts:40` | `where r.deleted_at is null` in its SQL |
| `scripts/docs-screenshots/fixtures.ts` | rewritten in §7; allowlisted, because it handles deleted samples on purpose |

How a deleted ritual behaves:

- Every site takes the branch it already takes for a missing row, so
  **no new error codes** on existing paths.
- Installed editors already file `NOT_FOUND` and `FORBIDDEN` as
  `rejected`.
- The permission check's `denied` reply keeps exactly its five keys, so
  installed offline clients purge as they do for a removed member.
- A replay of a receipt whose parent is deleted or purged fails as
  `FORBIDDEN`, as a missing parent does today. It never answers ok.

**The guard**, `src/doc/ritualQueryGuard.test.ts`, built like
`src/components/importBoundary.test.ts` on the TypeScript compiler API
(review S1):

- **Files.** It parses every non-test `.ts`, `.tsx` and `.mts` file under
  `src/` and `scripts/`.
- **Which names mean the table.** It resolves every local name bound to
  the table:
  - named imports of `rituals` from the schema modules, under any alias
    (`rituals as ritualRows`, `fixtures.ts:10`);
  - namespace imports (`import * as schema`), whose `schema.rituals`
    member counts (`legacyImportRows.ts:8,31`);
  - re-exports.
- **What it flags.**
  - Each use of such a name as the argument of `from`, `update`,
    `delete`, `innerJoin`, `leftJoin`, `rightJoin` or `fullJoin`.
  - Any `db.query.rituals` or `tx.query.rituals` access.
  - Tagged SQL templates (`sql`…``, postgres' `tx`…``) whose text names
    the table, matched by `\b(from|join|update|into)\s+"?rituals"?\b`.

  A plain `\brituals\b` on every template literal would flag URLs such
  as `` `${base}/gd/rituals` `` (`capture.mts:150`), so only SQL
  templates are read.
- **What passes.** A flagged use passes when its enclosing statement
  contains `liveRitual` or `deleted_at is null` (raw SQL), or is inside
  `loadSqlRitualParent` itself. Otherwise its file must be on the
  allowlist with a reason:
  - `sqlPolicy.ts` (the helper);
  - `sqlLifecycle.ts` and `sqlPurge.ts` (deleted rows on purpose);
  - `sqlLegacyImport.ts`, `legacyImportRows.ts` and
    `planLegacyRitualImport.ts` (fenced importer);
  - `scripts/docs-screenshots/fixtures.ts` (§7);
  - the `update(rituals)` calls in `sqlWrites.ts` and `sqlScope.ts`,
    which run by ID in the transaction of a locked live load.

  An allowlist entry that no longer matches fails the test, as in
  `importBoundary.test.ts`.
- **Self-test.** Fixture source strings with an aliased, a namespaced, a
  `query.` and a raw-SQL use each fail.

### 3. The lifecycle service

`src/doc/sqlLifecycle.ts`, `createSqlRitualLifecycleService(db,
getVerifiedActorId, { now })`, is shaped like `sqlScope.ts`.

**Rules.** The pure rule, in `src/doc/access.ts`:

```ts
export function authorizeRitualLifecycle(
  policy: RitualPolicy | null,
  principal: RitualPrincipal | null,
  action: "delete" | "restore" | "purge" | "cancel-removal",
): RitualDecision
```

- **delete and restore:** `getRitualAccess(policy, principal).edit`, and
  for public scope `principal.globalAdmin`.
- **purge:** `globalAdmin`, or an admin grant on the ritual's group, or an
  admin membership of its temple.
- **cancel-removal:** `globalAdmin` only.
- The rule is evaluated on the ritual as it stands. While deleted, its
  scope cannot change, because scope change goes through the helper.

**Commands.** Each is a server action with `version: 1`,
`expectedActorId` and `ritualId`, validated like `changeRitualAccess`.
Each runs in `read committed`:

1. `lock_timeout` 5 s;
2. `loadSqlRitualPrincipal(tx, actor, true)`;
3. the ritual row `FOR UPDATE`, deleted or not;
4. one `FORBIDDEN` for missing, malformed and unauthorised alike.

The service has its own codes, as `sqlScope.ts` does. No installed
client knows them, so the new ones below are free.

| Command | Effect | Refused or idempotent | Audit |
| --- | --- | --- | --- |
| `deleteRitual` | `deleted_at = now`, `deleted_by_id = actor`, `purge_after = now + 30 days` | already deleted: ok, unchanged | `delete` |
| `restoreRitual` | clears all six columns | live: ok, unchanged. `purge_requested_at` or `purge_started_at` set: `BEING_REMOVED` ("It is being removed and can no longer be restored.") | `restore` |
| `purgeRitualNow` (also takes `confirmTitle`) | `confirmTitle` must equal the stored title (trimmed), checked on the server too; then `purge_requested_at = now`, `purge_after = least(purge_after, greatest(now, deleted_at + 30 minutes))`. **Always queued**: the nightly run carries it out | not deleted: `NOT_DELETED`. Already requested: ok, unchanged | `purge_requested` |
| `cancelRemoval` (global administrators) | for a purge stuck before the point of no return: clears `purge_started_at`, sets `purge_after = now + 30 days` | allowed only while `purge_started_at` is set, `purge_objects_deleted_at` is null and `purge_requested_at` is null; otherwise `NOT_CANCELLABLE` | `purge_cancelled` |

**Restore after a permanent delete is refused** (review S4). The
deletion is final the moment it is confirmed, though the rows remain
until the nightly run.

**Cancel removal is for a purge that failed with nothing deleted**
(review S5), for example a storage outage or a missing permission:

- Without it, the claim (`purge_started_at`) would leave an intact
  ritual that nobody can restore.
- It never applies once a delete may have been sent, nor to a requested
  permanent deletion.
- For those, the operator steps in §5 apply.

The thirty minutes after deletion are the **quiet period**:

- They exceed a presigned upload's 600 seconds, a claim's 120 seconds,
  and any route's duration.
- No object can still be landing at a key whose row the purge is about
  to delete.
- A permanent deletion inside that half hour simply falls due when it
  ends. Since the nightly run does all purging, the user-facing promise
  is "within a day" in every case.

**Reads.** One read serves every screen (review M5):

- `listDeleted({ templeSlug? })` returns `{ rows, count }`: the deleted
  rows the caller may restore, or may see as being removed.
- Each row has its title, its temple or group name, who deleted it
  (`auth_user.name`), `deleted_at`, `purge_after`, `canPurge`, and a
  state:
  - `restorable`;
  - `being-removed` (`purge_requested_at` or `purge_started_at` set);
  - `removal-delayed` (`purge_started_at` more than a day old);
  - `removal-overdue` (`purge_after` more than a day past and
    `purge_started_at` null; the cron did not run, review B2).
- For global administrators it also returns the `cron_runs` row.
- The `/gd/rituals` link uses `count`, and the Undo snackbar takes its
  title from `rows`.
- `readDeletion(ritualId)` serves the delete dialog only: the title, the
  scope and its display name (as `sqlScope.read`), and whether the caller
  may delete.

Constants live in `src/doc/ritualRetention.ts` (`RETENTION_DAYS = 30`,
`PURGE_QUIET_MS`), which the service, the UI and the guide's dates
share.

### 4. The UI

- **Editor menu**
  (`src/app/doc/[_id]/edit/semantic/SemanticEditor.tsx`): "Delete
  ritual…" after "Who can read this ritual…", in the error colour,
  opening a lazily loaded `DeleteRitualDialog.tsx`.
  - It falls back to a "could not be loaded" dialog when offline, as the
    access dialog does.
  - It is disabled with a hint for a public ritual unless the caller is a
    global administrator.
  - Deleting is offered **from the editor only** in this build, not from
    the list's rows, so the person deleting is looking at the ritual.

  The dialog, as of commit 4 (commit 3 omits the date, review S7):

  > **Delete "Title"?** Members of Example Temple at grade 2 and above
  > lose it now. A copy downloaded to a member's device is removed the
  > next time that device opens that ritual or the Downloaded rituals
  > page while online, and in any case within 14 days. You can restore it
  > from Recently deleted until 30 November 2026; after that it is gone
  > for good.

  - When the editor has unsaved or unsent changes, the dialog says they
    stay on this device as a draft, and offers Download draft.
  - The buttons are Cancel and **Delete**, in error colour.
- **After deleting**, the editor goes to `/gd/rituals?deleted=<id>`.
  - The URL holds the ID only, never the title. The ID still lands in
    browser history and request logs, as every ritual URL does
    (review M6).
  - The page shows a snackbar, "Deleted "Title". Undo", for 10 seconds.
    Undo calls `restoreRitual` and returns to the editor.
- **`/gd/rituals`** gains a "Recently deleted (n)" link beside "Open
  downloaded rituals", shown when n > 0.
- **`/gd/rituals/deleted`** (`page.tsx`, `RecentlyDeletedList.tsx`):
  - `privateMetadata("Recently deleted")`, so it is not indexed, and
    `connection()`. No `maxDuration`: nothing here purges.
  - `?temple=<slug>` filters to one temple.
  - Each row shows the title, temple or group, who and when, and its
    state. From commit 4 it also shows "Removed on 30 November", and
    "Removal overdue" or "Removal delayed" when they apply.
  - The actions are Restore, and Delete permanently when `canPurge`.
    Global administrators also get Cancel removal on a delayed row.
  - Global administrators see a line, "Nightly removal last ran 31
    October 2026, 03:17 (ok)", from `cron_runs`. It turns into a warning
    when the run is more than 36 hours old, never ran, or ended
    `partial` or `failed`.
  - The breadcrumb in `src/app/pathnames.ts` becomes
    `rituals: { "/": "Rituals", deleted: "Recently deleted" }`.
- **Temple administration** (`/temples/admin/[_id]`): a "Recently deleted
  rituals (n)" link to `/gd/rituals/deleted?temple=<slug>`, when n > 0.
- **`PurgeRitualDialog.tsx`:**
  - It names what goes: the text, its whole history, its images, its
    published bundles (including their manifests, which carry the title)
    and every downloaded copy.
  - It says the decision is final at once: nobody can restore it, even
    before the nightly run removes it, within a day, and nobody can bring
    it back afterwards (decision 10).
  - A text field takes the exact title; **Delete permanently** stays
    disabled until it matches.
  - Afterwards the row shows "being removed", with no actions.

### 5. The purge

`src/doc/sqlPurge.ts`:

- `purgeRitual(db, storage, id)`;
- `purgeDueRituals({ db, storage, now, limit, deadlineMs })`.

Only the cron calls them. Every step is safe to repeat.

1. **Claim** (transaction 1).
   - Lock the row `FOR UPDATE`. Go on only if it is deleted and
     `purge_after <= now`. If a restore won, stop.
   - Set `purge_started_at` if not set; restore is refused from here on.
   - Collect every object the ritual owns:
     - each `ritual_bundle_assets` (bucket, key) of its intents;
     - each upload intent's staging and canonical (bucket, key);
     - each `loom_files` row reached through its `ritual_file_links`;
     - for the sweep, the prefixes `ritual-bundles/{bundleId}/` for each
       intent and `ritual-files/{fileId}/` for each upload.
   - **The bucket check** (review S6). Refuse if any recorded bucket is
     null (`loom_files.bucket` is nullable) or differs from this
     deployment's configured bucket. The ritual counts as failed and
     stays claimed. A preview key must never be deleted from production,
     or the reverse.
   - The due condition ignores `purge_started_at`, so an interrupted
     purge is picked up again.
2. **The point of no return.** In its own small transaction, set
   `purge_objects_deleted_at` if it is null, before the first
   `DeleteObject` is sent. It errs towards "no return": once set, cancel
   removal is refused even if a later delete fails. One exception keeps
   the fail-safe of §3 true (code review, Fable 1): when this run set the
   mark and its **first** delete is refused outright (`AccessDenied` or a
   403), nothing was deleted, so the failure handling clears the mark
   again and the ritual stays cancellable.
3. **Objects** (outside any transaction).
   - `DeleteObject` each recorded key, with a 10-second timeout each. A
     missing object counts as done.
   - **Then the sweep, best-effort** (review M4). `ListObjectsV2` each
     prefix and delete what it finds, catching plan 008:17's orphans.
     Any list error is logged by class and ignored, so the purge never
     needs the List permission.
   - A failed `DeleteObject` stops this ritual. It keeps its state
     (except as in step 2), counts as failed, and the next run retries it.
   - Each ritual also has its own deadline inside the run: past it, the
     purge stops between objects, the ritual stays claimed, counts as
     deferred, and continues the next night. Deletes are idempotent.
4. **Rows** (transaction 2, in foreign-key order). Lock the row again and
   check `purge_started_at`. If the row is gone, another runner finished,
   and that counts as done. Then:
   1. `ritual_bundles`, then `ritual_bundle_assets`, then
      `ritual_bundle_publication_intents`, all where `ritual_id`. The
      intents take their `manifest_json`, with the title, and their
      `plan_json` with them;
   2. `ritual_file_links` where `ritual_id` (their file IDs collected
      first);
   3. `loom_files` with those IDs. A row is skipped if any other link,
      `legacy_file_snapshots` or `legacy_file_relocations` row names it,
      so legacy files are never touched;
   4. `ritual_upload_intents` where `ritual_id`;
   5. `legacy_ritual_compiled_archives` where `ritual_id`;
   6. `update rituals set current_compiled_artifact_id = null,
      current_revision_id = null`, which breaks the circle;
   7. `ritual_compiled_artifacts` whose revision is one of the ritual's;
   8. `ritual_revisions` where `ritual_id`;
   9. `rituals`;
   10. an `audit_events` row, `purged`, with the scope snapshot.

What a purge keeps (decisions 11 and 12):

- `ritual_write_receipts_v2`;
- `legacy_id_aliases`;
- `audit_events`;
- `legacy_import_runs`.

**Objects before rows.** A crash between the two leaves rows that point
at missing objects. That is harmless, because the ritual is already
hidden, and the rerun repeats the idempotent deletes. The reverse order
could leave objects with no record.

**Nothing new can appear** between transactions 1 and 2. Every writer
loads the parent through §2 under a lock, so none passes a deleted
ritual, and the quiet period outlasts any presigned URL or claim issued
before the deletion.

**Operator steps** for a ritual that stays failed. Global administrators
see it in Recently deleted as "removal delayed", and the cron response
and logs give the error class.

1. A bucket refusal: stop and investigate the rows. Never edit them by
   hand to get past the check.
2. A storage failure (outage, credential, permission): fix the cause,
   then use the cron's "Run" button in the Vercel dashboard, or wait for
   the next night.
3. If the ritual should be kept meanwhile, and nothing has been deleted
   (`purge_objects_deleted_at` null) and no permanent deletion was
   requested: **Cancel removal**. It becomes restorable again, with a
   fresh 30 days, and the cancellation is recorded.

**Storage**, `src/files/r2Purge.ts` (server-only):

```ts
export function createRitualObjectPurger(environment: NodeJS.ProcessEnv): {
  /** The configured bucket; every recorded bucket must equal it. */
  readonly bucket: string;
  /** Deletes one object; a missing one is success. */
  deleteObject(bucket: string, key: string): Promise<void>;
  /** Lists every key under a prefix (paged); callers treat errors as best-effort. */
  listPrefix(bucket: string, prefix: string): Promise<string[]>;
  destroy(): void;
};
```

- It builds Loom's `createS3FileStorage` with
  `{ GetObjectCommand, PutObjectCommand, DeleteObjectCommand }`. Wiring
  the delete command is what stops Loom's silent no-op.
- Listing uses `ListObjectsV2Command` on the same client.
- The Files route's `filesStorage` stays without a delete, and only the
  purge imports this module.
- A unit test asserts that a delete really sends a `DeleteObjectCommand`
  for the right bucket and key.

**The cron route**, `src/app/api/cron/purge-deleted-rituals/route.ts`
(review B3):

```ts
export const runtime = "nodejs";
// No route sets this today. The team is on Pro (spike 1(b)); 60 s is all a small batch needs.
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response(null, { status: 503 }); // never runs unconfigured
  if (!sameSecret(request.headers.get("authorization"), `Bearer ${secret}`))
    return new Response(null, { status: 401 });
  // cron_runs: started
  const result = await purgeDueRituals({ limit: 5, deadlineMs: 45_000 });
  // cron_runs: finished, outcome, counts
  return Response.json(result); // { due, purged, deferred, failed }: counts only
}
```

- **Sizing** (as built, code review S3). Within the 60 seconds no ritual
  starts after 35, the running one stops deleting objects at 45 and
  continues the next night, and each request is capped at 10 seconds,
  leaving time for its rows and the heartbeat. Nothing bounds a ritual's
  object count, so a large one takes several nights. The batch takes fresh
  due rituals first, then claimed ones still deleting, and claimed ones
  that stopped before deleting anything (refusals) last, so a stuck ritual
  never starves the others. "Within a day" can be about 24.5 hours: the
  quiet period, then the next 03:17 UTC run.
- **The heartbeat** is written whatever the outcome, so a run that throws
  still leaves `started_at`.
- `sameSecret` compares in constant time.
- Logs carry ritual IDs and error classes, never titles.
- `vercel.json` gains
  `"crons": [{ "path": "/api/cron/purge-deleted-rituals", "schedule": "17 3 * * *" }]`.
- `.github/vercel-production-env.json` gains the requirement
  `{ "name": "cron secret", "keys": ["CRON_SECRET"], "placeholder": { "key": "CRON_SECRET", "kind": "secret" }, "sensitive": true }`,
  and `scripts/vercel-production-env.test.ts` follows.
- Gadi added `CRON_SECRET` to Vercel Production, as a sensitive variable,
  on 31 October 2026. Releases already tolerate variables outside the
  metadata (17 today); listing it makes the release refuse to build if it
  ever goes missing.
- **The release checks the cron is in the build.** Commit 4 adds a
  `crons` command to `scripts/release-checks.mjs`, run by a new
  `release.yml` step after "Build production artifact". The command
  reads `.vercel/output/config.json`, needs no network, and fails the
  release unless `crons` holds exactly this path and schedule.
  - The value is not secret, so the step may print it.
  - It is tested in `scripts/release-checks.test.ts`.
  - Vercel's cron troubleshooting guide recommends this check (spike
    1(a)).

### 6. Readers, links, offline copies and the 404

- **`/doc/[_id]`.** When `loadPublicRitual` finds no live public ritual,
  a new `publicSqlRitualReader.isDeletedPublic(id)` asks whether a
  **deleted row with public scope** exists. That reveals nothing, since
  the ritual was public.
  - If so, `DocPage` calls `notFound()` before any `Suspense`, and
    `generateMetadata` returns `privateMetadata`.
  - The route has no `loading.tsx` and the app does not use Cache
    Components, so the response is a real 404. Next's notFound docs say
    a call after streaming begins gives a 200 with `noindex`. The browser
    check confirms the status.
  - **The 404 lasts until the purge** (review M2). Afterwards the row is
    gone, and the URL renders the private shell like any unknown ID: a
    200 with `noindex`.
- **Everything else is unchanged.** A deleted private ritual and a purged
  ritual render the private shell exactly as an unknown ID does. Members
  see today's "unavailable on this device".
- **Offline copies: when they go** (review B1, Gadi's answer (b)). A
  member's download is removed the next time that device opens that
  ritual or the Downloaded rituals page while online, or by the 14-day
  lease at the latest. Nothing else asks the server (see "Offline
  copies" above), so a device that opens neither keeps its copy until
  the lease ends, connected or not.
  - The dialog (§4), the guide (§7) and risk 2 say exactly this.
- **The recheck from Downloaded rituals** (commit 3, as Gadi chose
  option (b)).
  - **What it does.** When the page (`OfflineRitualCatalog.tsx`) opens
    online with a signed-in account, it runs the permission check once
    for each downloaded ritual. A new check-only function,
    `recheckOfflineRitual` in `src/offline/ritualDownload.ts` beside
    `refreshOfflineRitual`, posts to `/api/rituals/permission` and hands
    the reply to the same `acceptPermission` path.
  - **The outcome.** `denied` purges the copy and its existing `hide`
    callback drops the entry from the list. A grant renews its lease.
    Anything temporary changes nothing. It never downloads a bundle:
    from a list, that would be wasteful.
  - **Order and failure.**
    - It runs after the list renders, one ritual at a time, so the page
      shows at once.
    - It stops when the page unmounts or the account changes, through
      the coordinator registrations the page already holds.
    - It is skipped offline (`navigator.onLine` false), and runs again
      on the `online` event once the connection has settled for two
      seconds (code review S2).
    - It tells other tabs nothing unless a ritual was denied, and then
      once per round (code review S1): a grant never invalidates an open
      reader.
  - **Cost** (corrected by the code review, S2).
    - A grant reply carries the whole rendered descriptor, up to 16 MB,
      so each recheck can download that ritual's text again. The list
      therefore rechecks a ritual only when its last accepted grant is
      more than 6 hours old (the stored authorization's local start
      time), so a visit costs nothing for recently checked rituals and
      at most one POST and one transaction per stale one.
    - It renews leases without the ritual being read. That is
      acceptable, since renewal requires current access.
    - A check-only request mode for the permission endpoint would remove
      the download; it is a follow-up, since it changes the offline
      contract (plan 000).
  - **Reach.** It does not reach devices that open neither page, so the
    wording names both.
- **The offline contract stays byte-compatible.** The `denied` body keeps
  `version, requestId, ownerId, ritualId, kind` and nothing else. A test
  compares the deleted reply with the missing-row reply, key for key.
  The member notice is the later stage.

### 7. Backups, the guide and its screenshots

- **Neon.** The point-in-time restore window is 6 hours (the free plan,
  Gadi, 31 October 2026). Nothing relies on it, and the guide does not
  mention it (decision 10). Plan 000 records the figure.
- **R2.** Versioning stays off. Purged images are then gone at once.

The new `/help/temples` section, "Deleting a ritual" (`id="delete"`,
after "When access changes", with a line in Contents), says:

- **Commit 3:**
  - Who may delete and restore a ritual, and that deleting hides it from
    everyone at once.
  - "A copy downloaded to a member's device is removed the next time that
    device opens that ritual or the Downloaded rituals page while online,
    and in any case within 14 days."
  - Recently deleted, and Restore.
  - What deletion cannot reach: what a member has already read or
    copied, and drafts left on an editor's own device.
- **Commit 4** (review S7: nothing user-visible promises removal before
  the purge exists):
  - Recently deleted keeps a ritual for 30 days; then it is removed for
    good, with its text, history, images and published copies.
  - Delete permanently: temple or group administrators, after typing the
    title. It is final at once and carried out within a day.
  - "Recently deleted is the only way back. Once a ritual is removed,
    it is gone: neither you nor the site's administrators can recover
    it." Nothing about backups.
  - **The imported rituals:** "Rituals carried over from the old
    Magick.ly in September 2026 also stay in the migration's records
    until those are retired." This line stays until decision 11 is taken.

"When access changes" gains a bullet, "Delete a ritual", pointing to the
new section.

Screenshots (synthetic data only, `scripts/docs-screenshots/README.md`):

- **The seed is rewritten for deletion** (review S3). Today it finds a
  sample by its creation receipt and always calls `saveIfChanged`
  (`fixtures.ts:216-232`). That fails with `NOT_FOUND` on a deleted
  sample, and recreates nothing after a local purge, because the receipt
  survives (decision 12). The new order for each sample:
  1. Find it by title in the Example temple, deleted rows included (the
     seed is allowlisted in the guard). Sample titles are unique there.
  2. Deleted but not being removed: restore it through the lifecycle
     service, then `saveIfChanged`. Live: `saveIfChanged`, as today.
  3. Not found, or only one being removed: create it. Use the fixed
     operation ID if its receipt is absent; otherwise the receipt points
     at a purged ritual, so use a fresh random ID.

  The README's "rituals by receipt" becomes "rituals by title in the
  temple".
- **"Retired opening (sample)"** is a third sample the seed keeps
  deleted, so it skips step 2. It is created if absent, then deleted through the service if
  live; a sample being removed is left alone.
- **New shots in `capture.mts`:**
  - `delete-ritual`: the creator opens "Delete ritual…" on "Zelator
    1=10 (sample)" and the dialog is framed, without confirming;
  - `recently-deleted`: the list;
  - `delete-permanently`: the dialog with the title half typed.
- **Rerun every shot, and look at each.** `ritual-list-grade-1` (the
  reader, who sees no link), `create-ritual`, `members` and
  `forum-settings` are expected unchanged.
- Run with
  `/usr/local/bin/magickli-docs-capture <worktree> <shots>`, which takes
  minutes, under a long timeout.

## Stage 0: the spike, before the build

Neither question may touch production data or credentials. Gadi
answered part of it on 31 October 2026; what remains is marked.

1. **Does a Vercel cron get registered and called under `release.yml`'s
   `vercel build --prod --standalone`, `deploy --prebuilt --prod
   --skip-domain`, then `promote` flow, and what may its route run for?**
   - **(b) Answered by Gadi.**
     - The team is on **Pro**. Crons run within the minute scheduled,
       and the duration cap is above 60 seconds. The route keeps
       `maxDuration = 60` anyway, because small batches don't need
       more.
     - Deployment Protection is **Standard**. It protects preview and
       generated deployment URLs, not the production domain, which is
       what the cron calls. Shareable Links, Protection Bypass for
       Automation and Deployment Protection Exceptions bypass it.
   - **(a) Read from Vercel's docs on 31 October 2026.**
     - **Settled:**
       - Crons come from `vercel.json` or the Build Output API's
         `config.json` `crons`, which describes "the cron jobs for the
         production deployment of a project"
         ([Build Output configuration](https://vercel.com/docs/build-output-api/configuration#crons)).
       - Vercel calls "your project's production deployment URL"
         ([Cron Jobs](https://vercel.com/docs/cron-jobs)), with the
         `Authorization: Bearer` value of `CRON_SECRET`
         ([Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)).
       - Cron definitions belong to a deployment: an Instant Rollback
         "restores the cron job definitions associated with that
         deployment"
         ([Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs#rollbacks-with-cron-jobs)).
       - Crons "only run on Production deployments". To make sure they
         register, run `vercel build --prod` and check `config.json` for
         `crons`
         ([Troubleshooting Vercel Cron Jobs](https://vercel.com/kb/guide/troubleshooting-vercel-cron-jobs)).
       - Promoting a staged production deployment (domains not
         auto-assigned) makes it Current without a rebuild
         ([Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment#staging-and-promoting-a-production-deployment)).
     - **Not stated anywhere:**
       - whether `vercel build` (rather than Vercel's own build step)
         copies `vercel.json`'s `crons` into `config.json`. The
         `vercel build` page speaks only of Schedules
         ([vercel build](https://vercel.com/docs/cli/build));
       - when the definitions of a *staged* production deployment take
         effect: at deploy, or at promotion.
     - **So (a) is not unambiguous.** The first gap is closed by the
       build check in §5: the release fails unless `config.json` holds
       the cron. The second is harmless either way:
       - early activation would call the production domain while the
         old deployment, which has no such route, still serves it: a
         404 that Vercel logs and ignores;
       - late activation is the normal case.
   - **(c) Needed only if (a) is not unambiguous, and it is not.** A
     throwaway rehearsal creates a Vercel project, so it needs Gadi:
     - a one-route app with `vercel.json` crons and `maxDuration = 60`;
     - the same three commands;
     - a route that writes nothing but its log line;
     - checks that the dashboard lists the cron after the promotion, and
       that "Run" reaches the route with the header;
     - then the project is deleted.

     The alternative, if Gadi prefers it, is to let (d) be the test. It
     is safe because the early runs touch no data, and the build check
     guarantees the definition is in the deployment. A missing
     registration would show as a stale heartbeat the next morning.
     **Gadi chose the alternative on 31 October 2026: no rehearsal; the
     first nightly run after the release is the test (d).** The release's
     build check for `crons` stays.
   - **(d) Release acceptance after the merge: required.** The first
     nightly runs have nothing to do: no ritual falls due within 30 days
     of the release except by a permanent deletion. So the production
     check touches no data:
     - Settings, Cron Jobs lists the path;
     - its "Run" button gives a 200 with `{"due":0,...}`;
     - the `cron_runs` row shows the run (Recently deleted's line, for a
       global administrator);
     - a request without the secret gets a 401;
     - the next morning, the heartbeat shows the scheduled run.
2. **Does the production R2 token allow `DeleteObject`?** List is
   optional, because the sweep is best-effort.
   - **(a) Answered by Gadi:** the token behind `FILES_S3_ACCESS_KEY_ID`
     is Object Read & Write.
   - **(b) Kept, as a short confirmation.** Cloudflare's token page says
     only that the permission allows "read, write, and list objects in
     specific buckets"
     ([R2 API tokens](https://developers.cloudflare.com/r2/api/tokens/)).
     Object delete is not named, so the dashboard answer is strong but
     not explicit.
     - The confirmation: in the preview bucket `magickli-files-preview`,
       with a preview credential of the same permission, put, list and
       delete one throwaway key, `spike/delete-check-<uuid>`.
     - Gadi runs it, or gives an agent a scratch credential.
     - Nothing touches production.
     - If it were skipped and delete were refused, the first purge would
       stop before any row went, show "removal delayed", and stay
       cancellable (§3). That is visible and recoverable, but
       confirming first is cheap.
     - **Gadi chose to skip it on 31 October 2026** and rely on that
       fail-safe. No preview-bucket test is run.
   - Local MinIO already allows both. It proves the code, not the token.

The answers went into this plan before the build started (see "Owner
answers", items 7 and 8); Stage 0 needs no further step from Gadi. If (1) fails,
fall back to a scheduled GitHub workflow that calls the same route with
the secret (decision 9's runner-up). The heartbeat and the "removal
overdue" state work the same either way.

## Tests and checks

Coverage is per file at 95/90 on the globs in `vitest.config.mts`. Add:

- `src/doc/sqlLifecycle.ts`
- `src/doc/sqlPurge.ts`
- `src/doc/ritualRetention.ts`
- `src/files/r2Purge.ts`
- `src/app/api/cron/purge-deleted-rituals/route.ts`

These are already listed: `src/doc/sqlPolicy.ts`, `sqlReads.ts`,
`sqlWrites.ts`, `sqlScope.ts`, `access.ts`, and the offline and files
modules in the table above.

The database tests use the PGlite harness (`createMemoryPgliteHarness`)
with the full schema. It is **one session**
(`src/doc/sqlWrites.test.ts:2-4`), so concurrency is tested in two ways
(review S2):

- **Query-log assertions** for locks, as `sqlWrites.test.ts:903-940`
  does. The queries end in `for update` or `for share`, in the expected
  order, inside a `read committed read write` transaction with
  `lock_timeout` set. This covers `loadSqlRitualParent`'s locks,
  delete's, restore's, purge now's and cancel's row locks, and the
  purge's second lock.
- **Interleavings driven through injected hooks**, run in sequence in the
  one session:
  - a fake `storage` whose `deleteObject` calls `restoreRitual` mid-purge
    (expect `BEING_REMOVED`, then a complete purge);
  - one whose first call runs a second `purgeRitual` for the same ID
    (both finish, every table empty);
  - one that throws on the first delete (state kept, the rerun
    completes);
  - one that throws after the point of no return (cancel refused);
  - a hook between transactions 1 and 2 that tries a save, an upload
    initiate and a bundle initiate (all refused).
  - Restore committed before the claim (purge skips) is two plain calls
    in order.
- **Not covered:** real waits between two connections, since PGlite has
  one session. The browser check runs delete and save against the real
  local Postgres.

The suites:

- **`access.test.ts`:** `authorizeRitualLifecycle` for each action, scope
  and kind of principal. Cases include:
  - a temple creator who is still a member: delete yes, purge no;
  - a removed temple creator: nothing;
  - a group creator without membership (plan 057's gap);
  - a public ritual for a non-admin;
  - cancel-removal for global administrators only.
- **`sqlPolicy.test.ts`:** `loadSqlRitualParent` with live, deleted and
  missing rows, and each lock in the query log.
- **`ritualQueryGuard.test.ts`:** passes on the tree. Its fixture
  sources (aliased, namespaced, `query.`, raw SQL, a stale allowlist
  entry) each fail.
- **One "deleted is missing" test per site**, set up by writing the
  columns directly:
  - `sqlReads.test.ts`: every reader method, and `listMetadata`;
  - `sqlScope.test.ts`: read and change;
  - `sqlWrites.test.ts`: create, save, title, publish, receipt replay;
  - `sqlRitualUploads.test.ts`: initiate, claim, finalise;
  - `permissionCheck.test.ts`: `denied`, deep-equal to the missing-row
    reply;
  - `sqlRitualBundleReads.test.ts`;
  - `sqlRitualPublicationSelection.test.ts`;
  - `sqlRitualBundlePublications.test.ts`;
  - `sqlRitualPublicationBackfill.test.ts`;
  - `sqlRitualFiles.test.ts`: a file of a deleted ritual is unreadable.
- **`sqlLifecycle.test.ts`:**
  - delete: the columns, the audit row, idempotence, `FORBIDDEN` for
    missing and unauthorised, `ACCOUNT_CHANGED`, `INVALID_REQUEST`;
  - restore: clearing, audit, idempotence, `BEING_REMOVED` after purge
    now and after a claim;
  - purge now: the server-side title check, administrators only,
    `purge_after` set to the end of the quiet period or kept if earlier,
    never synchronous;
  - cancel removal: allowed only in its one state, and its audit row;
  - `listDeleted`'s permission filter, its temple filter, each state
    (including overdue from a clock moved past `purge_after`), the count,
    and the `cron_runs` row for global administrators only.
- **`sqlPurge.test.ts`:**
  - After a purge every table in §5 holds nothing for the ritual. A
    second ritual, a legacy file, the receipts, the aliases and the
    import run are untouched.
  - The order holds under the real foreign keys.
  - Refusals: a null bucket and a bucket mismatch.
  - The point of no return is set before the first delete.
  - The sweep deletes an unrecorded key, and a list failure is logged and
    ignored.
  - The limit and the deadline; the interleavings above.
- **`r2Purge.test.ts`:** a `DeleteObjectCommand` is sent with the right
  bucket and key; a missing object (404) is success; listing pages.
- **Cron route test:**
  - 503 without `CRON_SECRET`;
  - 401 without the header, or with a wrong or differently sized one;
  - 200 with counts and no titles;
  - the `cron_runs` row written at start and finish, and on a throw.
- **`DocRender` and page tests:**
  - a deleted public ritual calls `notFound` and its metadata is
    `noindex`;
  - a deleted private ritual and a purged one render the shell.
- **UI tests:**
  - `DeleteRitualDialog`: the audience sentence with the "next time that
    device opens that ritual or the Downloaded rituals page… within 14
    days" wording, the unsaved-draft warning, disabled for a public
    ritual;
  - the Undo snackbar calls restore and navigates;
  - `RecentlyDeletedList`: buttons by permission and state, and the
    heartbeat line and its warning;
  - `PurgeRitualDialog`: disabled until the title matches; says it is
    final.
- **The recheck from Downloaded rituals** (`ritualDownload.test.ts`,
  the catalogue's tests with the fake runtime its suite already uses):
  - `recheckOfflineRitual` posts the permission request and never fetches
    a bundle or an asset;
  - `denied` purges the copy and fires `hide`, so the entry leaves the
    list;
  - a grant renews the lease and keeps the entry;
  - `temporarily-unavailable`, a non-200 response and a thrown fetch
    change nothing;
  - the page rechecks each listed ritual once, in sequence, after it
    renders;
  - nothing runs while offline, and it runs again on `online`;
  - unmounting or switching account stops the remaining checks;
  - a signed-out page makes no request.
- **The seed:** `fixtures.ts` against a deleted, a purged and a live
  sample, by the existing local-development fixture tests' pattern.
- **Release plumbing:** `legacyImportRows.pure.test.ts`, the
  required-artefact list, `vercel-production-env.test.ts`, and the new
  `crons` command in `release-checks.test.ts` (missing file, missing
  `crons`, a wrong path or schedule, the right entry).

**The browser check** follows plan 064:

- headless Chromium over CDP against a production build of the tip
  (`next build --webpack`, `next start -H 127.0.0.1` on a free port);
- a temporary `.env.local` with only the local database, MinIO and login
  lines, the 127.0.0.1 URLs, a throwaway auth secret, placeholder Google
  values and a local `CRON_SECRET`, deleted afterwards;
- the Creator and Reader test logins, at 1,440 × 900, on a copy of the
  local fixture ritual.

The steps:

- **Creator:**
  1. Delete from the editor: check the dialog's wording and the snackbar,
     and that Undo brings the editor back.
  2. Delete again: the link reads "Recently deleted (1)"; the list shows
     the date; Restore works.
  3. Delete, then save from a second tab's editor against the real local
     Postgres: the save is rejected and the draft is kept.
- **Reader, the Downloaded rituals page** (grade 1). Open two rituals
  while they are live, so both are downloaded. The creator deletes one.
  Then, **without opening `/doc/<id>`**:
  1. Open Downloaded rituals online. The deleted ritual leaves the list
     within the page's rechecks, and the other stays.
  2. The network log shows one permission request per downloaded ritual
     and no asset fetches. The deleted one's reply is `denied`, with its
     five keys.
  3. Dexie (`magickli-ritual-offline`) no longer holds the deleted
     ritual's bundle, assets or source.
  4. With the browser offline (CDP `Network.emulateNetworkConditions`),
     opening the page makes no request. Going online runs the checks.
- **Reader, the ritual page.** Download a third ritual, and have the
  creator delete it. Then open `/doc/<id>` directly, not the list: it
  says unavailable, and the download is gone.
- **Permanent deletion:**
  1. The button is disabled until the title matches.
  2. Afterwards the row shows "being removed" and Restore is gone.
  3. Set `purge_after` back past the quiet period in `magickli_dev`.
  4. Call the cron route with and without the local secret: 401, then
     200 and `purged: 1`.
  5. The ritual's rows are gone (`psql`), its objects are gone from
     MinIO, another fixture's objects remain, and the heartbeat line
     shows the run.
- **Overdue:** set another deleted ritual's `purge_after` two days back:
  Recently deleted shows "removal overdue".
- **The 404:** a throwaway ritual set to public scope in the local
  database, then deleted: `curl -I` on `/doc/<id>` gives 404. After its
  purge it gives 200.

Screenshots go under `.mockups/ritual-deletion/` in the worktree, not
committed.

## Commits and gates

1. `docs(plan): Plan ritual deletion`: this plan and plan 000's line.
2. `feat(doc): Hide deleted rituals from every path`:
   - migration 0019, the schema (both tables), Valibot and the importer
     fence;
   - `liveRitual` and `loadSqlRitualParent` at every site, the corpus
     export, the AST guard;
   - the "deleted is missing" tests.

   Nothing sets the columns yet. It is consistent and gateable alone.
3. `feat(doc): Delete and restore rituals`:
   - `authorizeRitualLifecycle`, `sqlLifecycle.ts` (no purge now or
     cancel yet), `ritualRetention.ts`, the server actions;
   - the editor's menu item and dialog (without the date), the Undo
     snackbar, Recently deleted with Restore (without "Removed on"), the
     links;
   - the 404, the breadcrumb;
   - the seed's rewrite;
   - the guide's commit 3 text, and the `delete-ritual` and
     `recently-deleted` shots;
   - the recheck from Downloaded rituals (`recheckOfflineRitual`, the
     catalogue's use of it) and its tests;
   - tests.
4. `feat(doc): Purge deleted rituals after 30 days`:
   - `r2Purge.ts`, `sqlPurge.ts`, `purgeRitualNow`, `cancelRemoval`;
   - the purge dialog, the dates, the states and the heartbeat line;
   - the cron route, `vercel.json` crons, the `CRON_SECRET` requirement,
     and the release's `crons` check (`release-checks.mjs`,
     `release.yml`);
   - the guide's commit 4 text, and the `delete-permanently` shot
     (`recently-deleted` retaken);
   - tests;
   - this plan's "The build" section.

**Commits 3 and 4 reach `main` in one push** (review S7). `release.yml`
runs on every push to `main`, so pushing commit 3 alone would release a
soft delete without its purge. The branch is merged, or `main`
fast-forwarded, to the tip in a single push. Commit 3 is still honest on
its own: nothing it shows promises a removal date.

Each commit is gated alone:

- a clean `git archive` export under `~/.cache/gates/` (install, check,
  typecheck, test:coverage, build), with nvm's Node 24;
- `drizzle-kit generate` reporting no changes from commit 2 on.

The tip also runs `loom check`, the `magick-data` smoke test and
`check:turbopack`.

The compiler identity files (`semantic.ts`, `semanticCompilerImpl.ts`)
stay byte-identical; the permission contract (`permissionContract.ts`)
does too, except its tests.

**Before the build:** nothing. Gadi chose 1(d) as the test instead of the
1(c) rehearsal, and skipped 2(b), the preview-bucket delete, relying on
the purge's fail-safe. `CRON_SECRET` is already in Vercel Production.
**After the merge:** 1(d), required: it is the cron's only test.

## Risks

1. **A missed query leaks a deleted ritual.** Mitigation: the helper, the
   AST guard (aliases, namespaces, `query.`, raw SQL) and one test per
   site.
2. **Downloads outlive the deletion.** A member's copy goes when their
   device next opens that ritual or the Downloaded rituals page online,
   or after at most 14 days (the lease). A device that opens neither
   keeps it until then, even while online (review B1).
   - The dialog and the guide say this exactly.
   - Changing the `denied` reply would make it 14 days for every device:
     the shape test guards it.
3. **The cron never fires, and nobody notices** (review B2).
   - Mitigations: the `cron_runs` heartbeat and its warning to global
     administrators, "removal overdue" on rows past due, the release's
     build check for `crons`, and the morning-after check in 1(d), which
     replaces the 1(c) rehearsal (Gadi, 31 October 2026).
   - Still uncovered: a global administrator who never opens Recently
     deleted. An alert outside the app is a later step.
4. **A purge stops halfway.**
   - Objects go first, every step repeats safely, and `purge_started_at`
     and `purge_objects_deleted_at` mark the state.
   - A ritual failed before its first delete can have its removal
     cancelled; after that, the operator fixes the cause and the next run
     finishes it.
5. **The build fails on a duration** (review B3). The route uses 60
   seconds, within Pro's cap (spike 1(b)). No other route gains a
   `maxDuration`.
6. **An orphan object outlives the purge.** Only when written more than
   30 minutes after deletion to a key no row recorded; nothing in the app
   issues such writes. The best-effort sweep catches older orphans under
   the ritual's prefixes, when List is allowed.
7. **A wrong bucket, or none.** Refused, for a null `bucket` as for a
   mismatch.
8. **Restore against purge, delete against a save.**
   - The purge and restore serialise on the row lock;
     `purge_requested_at` and `purge_started_at` end restore.
   - A save in flight finishes before the delete, or fails after it.
   - A read whose snapshot began before the commit may still finish.
9. **Copies remain after a purge (privacy):**
   - Neon's point-in-time history, for up to 6 hours. It is not relied
     on, and the guide promises nothing about it (decision 10);
   - for the five imported rituals, the import evidence (decision 11);
   - the owner's earlier corpus exports;
   - editors' device drafts and old localStorage recovery drafts;
   - the receipts' `request_hash`, a fingerprint that only confirms an
     exact guess;
   - ritual IDs in browser history and Vercel request logs;
   - search-engine caches of formerly public rituals.

   The guide states the ones users can act on: what a member has read or
   copied, editors' own drafts, and the imported rituals' records.
10. **Plan 057's creator gap.** A creator removed from a group can
    soft-delete that group's ritual. Administrators can restore it for
    30 days, the audit row shows who, and the administrator notice comes
    in the later stage.
11. **The release refuses to build without `CRON_SECRET`** once commit 4
    lands. That is intended, and the variable is already set (31
    October 2026). The release also refuses a build whose
    `config.json` lacks the cron.
12. **Rolling back past this release** (code review S4). An Instant
    Rollback to a deployment before commit 4 makes every soft-deleted
    ritual readable again, because the old code never filters
    `deleted_at`, and stops purging, because the cron belongs to the
    deployment. Do not roll production back past this release without
    first purging what should go, or accepting that deleted rituals
    reappear until the release is restored.

## The later stage

- **The member and editor notice:** an authenticated
  `GET /api/rituals/status?id=`. It answers `{ deleted: true,
  restorable }` only to people who could read the ritual before. The
  reader then says "This ritual was deleted", with Restore for editors,
  and the editor explains a rejected save with Download draft.
- **Telling the other administrators** of the temple or group when a
  ritual is deleted (decision 13).
- **An alert outside the app** when the heartbeat goes stale.
- **An audit view** per temple, and plan 057's access-change events in
  `audit_events`.
- **Device drafts** of purged rituals: clear them once the device can
  tell "purged" from "revoked" without that leaking.
- **Retention per temple, or a hold:** `purge_after` already allows it.
- **Deleting a temple**, which would ride on this purge.
- **A Loom jobs operator page** (dry run, run now) if the cron's logs and
  the heartbeat are not enough.
- **Decision 11:** retiring the import evidence, and then the guide's
  caveat.

## Review, 31 October 2026

Fable reviewed the plan at 3e67519d adversarially: three blocking items,
eight to fix and six minor. All are taken. They change:

- **B1: downloads.**
  - "Removed when their devices next connect" was wrong. Only the
    single-ritual reader and the editor re-ask the server, so a download
    goes when that ritual is next opened online, or by the 14-day lease.
  - Option (a), honest wording, is now in the dialog (§4), §6, the guide
    (§7) and risk 2.
  - Option (b), a recheck from the Downloaded rituals page, was
    described with its cost and commit. Gadi then chose it (see "Owner
    answers").
  - The browser check opens Downloaded rituals before `/doc/<id>`.
- **B2: a silent cron.**
  - A `cron_runs` heartbeat table (a table rather than an `audit_events`
    action, for the reasons in §1).
  - "Removal overdue" rows.
  - The last-run line and its warning for global administrators.
  - Spike 1(c) required unless 1(a) is unambiguous, and the
    morning-after check in 1(d).
- **B3: function durations.**
  - The cron route uses `maxDuration = 60`, with `limit: 5` and
    `deadlineMs: 45_000`.
  - Spike 1(b) asks for the cap and the Fluid compute state.
  - "Delete permanently" always queues, so no server action purges and
    `/gd/rituals/deleted` sets no duration. Decision 2's "at once" became
    "final at once, carried out within a day".
- **S1: the guard.** It now uses the TypeScript AST, resolving aliases,
  namespace members, `query.rituals` and SQL templates. The screenshot
  seed joins the site table.
  - One narrowing: only tagged SQL templates are read, not every template
    literal, because `\brituals\b` matches `/gd/rituals` URLs.
- **S2: concurrency tests.** They are named as query-log assertions or
  hook-driven interleavings, with what one PGlite session cannot cover
  stated.
- **S3: the seed.** It handles deleted and purged samples, with a lookup
  that does not depend on the surviving receipt.
- **S4: final permanent deletion.** `purge_requested_at` refuses restore
  once a permanent deletion is confirmed.
- **S5: a stuck claim.** `purge_objects_deleted_at` marks the point of no
  return. A global administrator's Cancel removal works before it, with
  an audit action `purge_cancelled`. The operator steps are spelt out.
- **S6:** a null `loom_files.bucket` is refused like a mismatch.
- **S7: "released together".** It now means one push to `main`. The
  30-day promise, the removal dates and the permanent-deletion text move
  to commit 4.
- **S8:** the spike now covers B2 and B3.
- **M1:** the `auth_user` foreign keys on `actor_id` and `deleted_by_id`
  are noted.
- **M2:** the 404 lasts until the purge, then the URL gives 200 with
  `noindex`.
- **M3:** adopted with B3.
- **M4:** the sweep is best-effort, so List is not required.
- **M5:** one `listDeleted` returning rows and a count.
- **M6:** "what goes" names the intents' manifests, and the ID's place in
  history and logs is noted.
- `SemanticEditor.tsx` is cited by its full path.

## Owner answers, 31 October 2026

Gadi answered the review's open questions the same day:

1. **Offline copies: option (b).** The Downloaded rituals page rechecks
   every downloaded ritual when it opens online, and drops deleted ones.
   It is in commit 3, with its tests (`recheckOfflineRitual` and the
   catalogue) and a browser step that opens Downloaded rituals, not
   `/doc/<id>`, and sees the ritual go (§6, Tests). The honest wording
   names both pages: "the next time that device opens that ritual or the
   Downloaded rituals page while online, and in any case within 14 days"
   (§4, §7, risk 2).
2. **Vercel: Pro, with Standard Deployment Protection.** Standard covers
   preview and generated deployment URLs, not the production domain the
   cron calls. The route keeps `maxDuration = 60`. Spike 1(b) is
   answered.
   - **Spike 1(a): the docs settle most of it, but not all.** They do
     not say whether `vercel build` itself writes `vercel.json`'s `crons`
     into `config.json`, nor when a staged deployment's crons take
     effect.
   - So commit 4 adds a release step that fails unless `config.json`
     holds the cron.
   - 1(c), the throwaway rehearsal, is needed by the rule and needs
     Gadi, since it creates a Vercel project. Accepting 1(d) as the test
     is offered as his alternative.
   - 1(d) stays required.
3. **R2: the token is Object Read & Write.** Spike 2 shrinks to one
   throwaway put, list and delete in the preview bucket. It is kept
   because Cloudflare's page lists read, write and list but does not name
   object delete.
4. **Neon: a 6-hour restore window on the free plan; "let's not rely on
   this".** Decision 10 and §7 now say so. The guide promises nothing
   about backups: Recently deleted, for 30 days, is the only way back,
   and a purged ritual is gone. The permanent-delete dialog says nobody
   can bring it back. R2 versioning stays off. Plan 000 records the
   window.
5. **`CRON_SECRET`** was added to Vercel Production, sensitive, on 31
   October 2026. Commit 4 still lists it in
   `.github/vercel-production-env.json`; releases already tolerate
   variables outside that list (17 today).
6. **Decision 11** stays Gadi's separate decision, as written.
7. **Spike 1: no rehearsal.** Gadi chose to let the first nightly run
   after the release be the test (1(d)) rather than run the throwaway
   Vercel rehearsal (1(c)). The release step that checks `crons` in
   `.vercel/output/config.json` stays, as §5 has it.
8. **Spike 2: no preview-bucket test.** Gadi chose to rely on the
   fail-safe: a refused delete stops the purge before any row goes, the
   row shows "removal delayed", and a global administrator can cancel
   the removal (§3, §5). 2(b) is not run. As first built the fail-safe
   did not hold for a ritual with objects; the code review's fix (§5,
   step 2) makes it hold: a refused first delete leaves the ritual
   cancellable.

Stage 0 therefore needs nothing more from Gadi before the build.

## The build, 1 November 2026

Built on `gate/ritual-deletion` in the commits listed under "Commits and
gates", rebased onto `main` at dd9562f7.

| Commit | Subject |
| --- | --- |
| 2fbcab59 | `docs(plan): Plan ritual deletion` |
| bc9aec58 | `feat(doc): Hide deleted rituals from every path` |
| 2da93270 | `feat(doc): Delete and restore rituals` |
| (tip) | `feat(doc): Purge deleted rituals after 30 days` |

**The screenshots** came from `/usr/local/bin/magickli-docs-capture`
after Gadi approved migrating his `magickli_dev` (1 November 2026),
which applied main's pending 0018 as well as 0019. `delete-ritual` and
`recently-deleted` were taken at commit 3, and `delete-ritual`,
`recently-deleted` and `delete-permanently` at the tip. Every other shot
was retaken and looked at: none frames anything this change touches,
and their differences came from that database's data (rituals other
agents left in the Example temple among them), so the committed versions
stay. `forum-settings` timed out waiting for "Connect forum" on the
temple's administration page, which rendered for the `members` shot; its
committed image stays too. `recently-deleted` frames the page's own heading, not
the app bar's.

Where the build departs from the design, or settles what it left open:

- **The guard's allowlist names only what it flags.** `sqlPolicy.ts`,
  `legacyImportRows.ts` and `planLegacyRitualImport.ts` never use the
  table as a query's table, so allowing them would be stale entries, which
  fail. The two `update(rituals)` calls in `sqlWrites.ts` and `sqlScope.ts`
  carry `liveRitual` in their `where` instead of an allowlist entry. The
  allowlist is `sqlLegacyImport.ts`, `sqlLifecycle.ts`, `sqlPurge.ts` and
  the screenshot seed. The guard also flags a re-export of the table
  outside the schema directory, and a tagged template that interpolates the
  table after `from`, `join`, `update` or `into`.
- **The deleted-public check** is `isDeletedPublicRitual` in
  `sqlLifecycle.ts`, exported from `sqlRuntime.ts` as
  `isDeletedPublicSqlRitual`, rather than a method of the anonymous reader,
  so `sqlReads.ts` keeps reading live rituals only.
- **"Delete ritual…" is never disabled in the menu.** The editor does not
  know the ritual's scope, so the dialog says "Only a site administrator
  can delete a public ritual." and keeps Delete disabled instead.
- **The server actions** live in `src/app/gd/rituals/lifecycleActions.ts`,
  shared by the editor's dialog, the Undo snackbar and Recently deleted.
- **Dates are shown in UTC** ("30 November 2026"; the heartbeat "03:17
  UTC"), like the cron's schedule, so the server and the browser render
  the same text.
- **The retired sample is the fourth**, "Retired opening (sample)", since
  the seed already had three. A sample found by title prefers a live row,
  then a deleted one, then one being removed.
- **The purge** marks the point of no return even when a ritual owns no
  object, which errs towards no return as §5 asks. Storage is built only
  when something is due, so a run with nothing to do needs no storage
  settings. A ritual skipped during a run (restored or cancelled meanwhile)
  counts in none of `purged`, `deferred` or `failed`: `deferred` is the due
  rituals the run did not reach.
- **The loom_files guard** keeps a file named by another ritual's link,
  `legacy_file_snapshots` or `legacy_file_relocations`. The first can never
  apply: a link binds to its own upload intent, whose `file_id` is unique.
  The guard protects only the file row's own key; an upload intent's keys
  and its `ritual-files/{fileId}/` prefix are always fresh, since every
  upload mints a new file.
- **A bucket refusal stays claimed** with no point of no return, so Cancel
  removal is offered for it. Operator step 1 still says to investigate
  first; nothing enforces it.
- **The Downloaded rituals recheck** broadcasts each accepted reply, as the
  reader does, so the list may briefly redraw once per ritual during a
  round.
- **The tests caught** a missing pair of parentheses around the purge's
  `not exists` subqueries (drizzle does not add them to a raw fragment),
  which would have failed every ritual with an image at the claim, and a
  late row's colour that MUI 9 ignored (`warning.main` is no longer a
  Typography colour; `warning` is).

## The code review, 1 November 2026

Opus 5.5 and Fable 5.1 reviewed the branch independently; neither found
anything blocking. The fixes are folded into the commits they belong to.

**Must fix:**

1. **The R2 fail-safe** (Fable). The point of no return was set before
   the first delete, so a refused delete left a ritual neither
   restorable nor cancellable. Now a refusal (`AccessDenied` or 403) of
   this run's first delete, with nothing deleted, clears this run's mark
   again; the mark-before-delete order stays for crash safety (§5 step 2,
   owner answer 8). Tested for both forms of refusal, and that a refusal
   after one delete, another error and an earlier run's mark keep it.
2. **Other tabs** (Opus S1). Every accepted recheck called
   `coordinator.changed()`, invalidating every view in every tab once
   per ritual. The recheck now broadcasts nothing; the list calls it once
   at the end of a round, and only after a denial. Tested that a round of
   grants invalidates nothing.
3. **Recheck cost** (Opus S2). A grant carries the rendered descriptor,
   up to 16 MB. The offline contract is unchanged; instead a ritual is
   rechecked only when its last accepted grant is over 6 hours old
   (`repository.lastGrantedAtMs`, the stored authorization's local start
   time), and `online` events are settled for two seconds. The cost line
   in §6 is corrected, and a check-only request mode is a follow-up.
4. **Starvation and large rituals** (Opus S3, Fable 3). The batch takes
   fresh due rituals first, then claimed ones still deleting, then
   claimed ones that stopped before deleting anything. The running
   ritual stops between objects at 45 seconds and continues the next
   night. The route's comment no longer promises "a few dozen deletes".
   **Declined: `DeleteObjects` batching.** Loom's adapter has only a
   single-object delete, so batching would bypass it; `DeleteObjects`
   must carry a checksum header whose R2 support the skipped spike never
   tested; and it reports per-key errors inside a 200 reply, a new
   failure mode for the fail-safe above. With the per-ritual deadline a
   large ritual simply takes more nights.
5. **Rollback** (Opus S4). Recorded as risk 12 and in plan 000.

**Should fix:**

- **The guard** now also catches `alias(rituals, …)`, destructured and
  re-bound names, `liveRitual` inside `or(…)` or `not(…)` (counted as
  unfiltered), `public.rituals` and `"public"."rituals"`, comma joins in
  raw SQL, `sql.identifier("rituals")` and `sql.raw` of text naming the
  table, and reads `.js`/`.mjs` files and `tests/` (but not the data in
  `tests/fixtures`). `tests/ritualBundleFixtures.ts` joins the allowlist.
  The allowlist is per file: an entry trusts its whole file.
- **Title confirmation** compares NFC text with whitespace runs
  collapsed, on the client and the server, still case-sensitive
  (`src/doc/ritualTitleMatch.ts`).
- **Delete permanently** is refused on a row already claimed
  (`REMOVAL_STARTED`) and not offered there. **Cancel removal** is
  offered only on a delayed row: claimed more than a day ago, or more
  than 10 minutes ago with nothing deleted, which is how a refused bucket
  or delete shows, so such a row reads "removal delayed", never "being
  removed, within a day".
- **The delete dialog's date** comes from the server (`readDeletion`
  returns `restoreUntil`), not the browser's clock.
- **Accessible names** start with the visible text: "Delete permanently:
  {title}", "Restore: {title}", "Cancel removal: {title}".
- **The Undo snackbar** drops `?deleted=` from the address once shown,
  with `history.replaceState` (which Next's router follows) rather than
  `router.replace`, whose server round trip would re-render the page
  without the snackbar.
- **`r2Purge.ts`** throws if Loom's adapter has no delete, instead of
  succeeding silently.
- **Wording:** Recently deleted's heading names the temple ("Recently
  deleted in Example"), only for its members and global administrators;
  "Nobody can read them meanwhile"; the guide says imported rituals'
  images stay reachable at their old addresses. The heading and intro
  are changed in commit 4, where that page's code now lives, rather than
  in commit 3; both reach `main` in one push.
- **Counts:** a runner that finds the row already gone counts it as
  skipped, not purged.

**Noted, not changed:**

- A late upload claim or finalise that locks the ritual row while the
  purge's row transaction deletes its intents can deadlock with it.
  Postgres's detector aborts one side; the purge counts as failed and is
  retried the next night, and the upload is refused anyway, since the
  ritual is deleted.
- Two overlapping runs (the "Run" button during the nightly run) share
  one `cron_runs` row: the second start overwrites the first, and the
  first's finish then matches nothing. The row locks keep the purges
  themselves safe.
- "Within a day" can be about 24.5 hours (§5, Sizing).

