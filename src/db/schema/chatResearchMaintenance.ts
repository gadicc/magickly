import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true });
/** Inactive source-free cleanup heartbeat. No profile is seeded; this row is not operator adoption or a source grant. */
export const chatResearchMaintenance = pgTable(
  "chat_research_maintenance",
  {
    profileSha256: text("profile_sha256").primaryKey(),
    targetSha256: text("target_sha256").notNull(),
    artifactSchema: text("artifact_schema").notNull(),
    controllerPid: integer("controller_pid"),
    artifactTableOid: bigint("artifact_table_oid", {
      mode: "number",
    }).notNull(),
    publicationCutoff: instant("publication_cutoff").notNull(),
    coverageThrough: instant("coverage_through").notNull(),
    revision: bigint("revision", { mode: "number" }).notNull().default(1),
    state: text("state")
      .$type<"idle" | "started" | "healthy" | "pending" | "failed" | "closed">()
      .notNull()
      .default("idle"),
    runId: uuid("run_id"),
    startedAt: instant("started_at"),
    leaseExpiresAt: instant("lease_expires_at"),
    observedAt: instant("observed_at"),
    finishedAt: instant("finished_at"),
    expiredPermits: integer("expired_permits"),
    expiredPackets: integer("expired_packets"),
    unpurgedPackets: integer("unpurged_packets"),
    latestRetainUntil: instant("latest_retain_until"),
    purgedPermits: integer("purged_permits"),
    purgedPackets: integer("purged_packets"),
  },
  (t) => [
    check(
      "chat_research_maintenance_identity",
      sql`${t.profileSha256} ~ '^[a-f0-9]{64}$' and length(${t.profileSha256})=64 and ${t.targetSha256} ~ '^[a-f0-9]{64}$' and length(${t.targetSha256})=64 and (${t.runId} is null or (substring(${t.runId}::text from 15 for 1)='7' and substring(${t.runId}::text from 20 for 1) in ('8','9','a','b')))`,
    ),
    check(
      "chat_research_maintenance_namespace",
      sql`pg_catalog.length(${t.artifactSchema}) between 1 and 63 and ${t.artifactSchema}=pg_catalog.btrim(${t.artifactSchema}) and ${t.artifactSchema} ~ '^[a-z_][a-z0-9_]*$' and ${t.artifactSchema} !~ '[^a-z0-9_]' and pg_catalog.left(${t.artifactSchema},3)<>'pg_' and ${t.artifactSchema}<>'information_schema'`,
    ),
    check(
      "chat_research_maintenance_pid",
      sql`(${t.state}='idle' and ${t.controllerPid} is null) or (${t.state}<>'idle' and ${t.controllerPid} is not null and ${t.controllerPid}>0)`,
    ),
    check(
      "chat_research_maintenance_oid",
      sql`${t.artifactTableOid} between 1 and 4294967295`,
    ),
    check(
      "chat_research_maintenance_revision",
      sql`${t.revision} between 1 and 9007199254740991`,
    ),
    check(
      "chat_research_maintenance_coverage",
      sql`pg_catalog.isfinite(${t.publicationCutoff}) and ${t.publicationCutoff}>=timestamptz '1970-01-01T00:00:00Z' and pg_catalog.isfinite(${t.coverageThrough}) and ${t.coverageThrough}=${t.publicationCutoff}+interval '721 hours'`,
    ),
    check(
      "chat_research_maintenance_times",
      sql`(${t.startedAt} is null or pg_catalog.isfinite(${t.startedAt})) and (${t.leaseExpiresAt} is null or pg_catalog.isfinite(${t.leaseExpiresAt})) and (${t.observedAt} is null or pg_catalog.isfinite(${t.observedAt})) and (${t.finishedAt} is null or pg_catalog.isfinite(${t.finishedAt})) and (${t.latestRetainUntil} is null or pg_catalog.isfinite(${t.latestRetainUntil}))`,
    ),
    check(
      "chat_research_maintenance_state",
      sql`
    (${t.state}='idle' and ${t.runId} is null and ${t.startedAt} is null and ${t.leaseExpiresAt} is null and ${t.finishedAt} is null and ${t.observedAt} is null)
    or (${t.state}='started' and ${t.runId} is not null and ${t.startedAt} is not null and ${t.leaseExpiresAt} is not null and ${t.leaseExpiresAt}=${t.startedAt}+interval '60 seconds' and ${t.finishedAt} is null and ${t.observedAt} is null)
    or (${t.state}='failed' and ${t.runId} is not null and ${t.startedAt} is not null and ${t.leaseExpiresAt} is not null and ${t.finishedAt} is not null and ${t.leaseExpiresAt}=${t.startedAt}+interval '60 seconds' and ${t.finishedAt}>=${t.startedAt} and ${t.finishedAt}<${t.leaseExpiresAt} and ${t.observedAt} is null)
    or (${t.state} in ('healthy','pending','closed') and ${t.runId} is not null and ${t.startedAt} is not null and ${t.leaseExpiresAt} is not null and ${t.observedAt} is not null and ${t.finishedAt} is not null and ${t.leaseExpiresAt}=${t.startedAt}+interval '60 seconds' and ${t.observedAt}>=${t.startedAt} and ${t.finishedAt}>=${t.observedAt} and ${t.finishedAt}<${t.leaseExpiresAt})`,
    ),
    check(
      "chat_research_maintenance_counts",
      sql`
    (${t.state} in ('idle','started','failed') and ${t.expiredPermits} is null and ${t.expiredPackets} is null and ${t.unpurgedPackets} is null and ${t.latestRetainUntil} is null and ${t.purgedPermits} is null and ${t.purgedPackets} is null)
    or (${t.state} in ('healthy','pending','closed') and ${t.expiredPermits} is not null and ${t.expiredPackets} is not null and ${t.unpurgedPackets} is not null and ${t.purgedPermits} is not null and ${t.purgedPackets} is not null and ${t.expiredPermits}>=0 and ${t.expiredPackets}>=${t.expiredPermits} and ${t.expiredPackets}<=2*${t.expiredPermits} and ${t.unpurgedPackets}>=${t.expiredPackets} and ((${t.unpurgedPackets}=0 and ${t.latestRetainUntil} is null) or (${t.unpurgedPackets}>0 and ${t.latestRetainUntil} is not null)) and ${t.purgedPermits} between 0 and 100 and ${t.purgedPackets} between 0 and 200)`,
    ),
    check(
      "chat_research_maintenance_terminal",
      sql`(${t.state}<>'healthy' or (${t.expiredPackets}=0 and (${t.latestRetainUntil} is null or ${t.latestRetainUntil}<=${t.coverageThrough}-interval '1 hour'))) and (${t.state}<>'closed' or ${t.unpurgedPackets}=0)`,
    ),
  ],
);
