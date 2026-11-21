import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { chatResearchPermits } from "./chatResearch";
/** Inactive private packet sidecars, never generic files/downloads or an independent job terminal status. */
export const chatResearchArtifacts = pgTable(
  "chat_research_artifacts",
  {
    permitId: uuid("permit_id")
      .notNull()
      .references(() => chatResearchPermits.id, { onDelete: "restrict" }),
    kind: text("kind").$type<"request" | "result">().notNull(),
    packetJson: text("packet_json"),
    packetSha256: text("packet_sha256").notNull(),
    jobCreatedAt: timestamp("job_created_at", { withTimezone: true }).notNull(),
    storedAt: timestamp("stored_at", { withTimezone: true }).notNull(),
    retainUntil: timestamp("retain_until", { withTimezone: true }).notNull(),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.permitId, t.kind] }),
    index("chat_research_artifacts_expiry")
      .on(t.retainUntil)
      .where(sql`${t.purgedAt} is null`),
    check(
      "chat_research_artifacts_identity",
      sql`substring(${t.permitId}::text from 15 for 1)='7' and substring(${t.permitId}::text from 20 for 1) in ('8','9','a','b') and ${t.kind} in ('request','result') and length(${t.packetSha256})=64 and ${t.packetSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "chat_research_artifacts_retention",
      sql`pg_catalog.isfinite(${t.jobCreatedAt}) and pg_catalog.isfinite(${t.storedAt}) and pg_catalog.isfinite(${t.retainUntil}) and (${t.purgedAt} is null or pg_catalog.isfinite(${t.purgedAt})) and (${t.retainUntil}=${t.jobCreatedAt}+interval '720 hours' or ${t.retainUntil}=${t.jobCreatedAt}+interval '48 hours') and ${t.storedAt}>=${t.jobCreatedAt} and ${t.storedAt}<${t.retainUntil}`,
    ),
    check(
      "chat_research_artifacts_body",
      sql`(${t.packetJson} is not null and ${t.purgedAt} is null and pg_catalog.octet_length(${t.packetJson}) between 1 and (case when ${t.kind}='request' then 262144 else 2097152 end) and ${t.packetSha256}=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(${t.packetJson},'UTF8')),'hex')) or (${t.packetJson} is null and ${t.purgedAt} is not null and ${t.purgedAt}>=${t.retainUntil})`,
    ),
  ],
);
