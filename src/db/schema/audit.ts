import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { uuidV7 } from "./ids";

const instant = (name: string) => timestamp(name, { withTimezone: true });
const v7 = (name: string, id: AnyPgColumn) =>
  check(
    name,
    sql`substring(${id}::text from 15 for 1) = '7' and substring(${id}::text from 20 for 1) in ('8', '9', 'a', 'b')`,
  );

/**
 * Who did what to which subject, kept indefinitely (plan 065, decision 7).
 * It holds no title or content and no foreign key to the subject, so it
 * survives the subject's purge and records it. Text columns with checks
 * rather than enums, so a later kind or action is a check change, not an
 * ALTER TYPE. The actor's foreign key means deleting an account must handle
 * these rows, as it handles ritual write receipts.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuidV7("id").primaryKey(),
    at: instant("at").notNull(),
    // Null only for the scheduled purge.
    actorId: uuid("actor_id").references(() => user.id),
    subjectKind: text("subject_kind").notNull(),
    // No foreign key: the row outlives its subject.
    subjectId: uuid("subject_id").notNull(),
    action: text("action").notNull(),
    // The subject's scope when the event happened.
    scope: text("scope").notNull(),
    // No foreign keys, like the receipts.
    templeId: uuid("temple_id"),
    groupId: uuid("group_id"),
  },
  (table) => [
    v7("audit_events_id_v7", table.id),
    check("audit_events_subject_kind", sql`${table.subjectKind} in ('ritual')`),
    check(
      "audit_events_action",
      sql`${table.action} in ('delete', 'restore', 'purge_requested', 'purge_cancelled', 'purged')`,
    ),
    check(
      "audit_events_actor",
      sql`${table.actorId} is not null or ${table.action} = 'purged'`,
    ),
    check(
      "audit_events_scope",
      sql`(${table.scope} = 'public' and ${table.templeId} is null and ${table.groupId} is null)
    or (${table.scope} = 'group' and ${table.groupId} is not null and ${table.templeId} is null)
    or (${table.scope} = 'temple' and ${table.templeId} is not null and ${table.groupId} is null)`,
    ),
    index("audit_events_subject_idx").on(
      table.subjectKind,
      table.subjectId,
      table.at,
    ),
    index("audit_events_temple_idx").on(table.templeId, table.at),
  ],
);

/**
 * One heartbeat row per scheduled job, written when a run starts and again
 * when it ends. A null finishedAt with an old startedAt means a run died
 * midway; Recently deleted shows global administrators the last run.
 */
export const cronRuns = pgTable(
  "cron_runs",
  {
    job: text("job").primaryKey(),
    startedAt: instant("started_at").notNull(),
    finishedAt: instant("finished_at"),
    outcome: text("outcome"),
    due: integer("due"),
    purged: integer("purged"),
    deferred: integer("deferred"),
    failed: integer("failed"),
  },
  (table) => [
    check("cron_runs_job", sql`${table.job} in ('purge-deleted-rituals')`),
    check(
      "cron_runs_outcome",
      sql`${table.outcome} is null or ${table.outcome} in ('ok', 'partial', 'failed')`,
    ),
  ],
);
