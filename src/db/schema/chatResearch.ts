import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidV7 } from "./ids";

const instant = (name: string) => timestamp(name, { withTimezone: true });
const pico = (name: string) => bigint(name, { mode: "number" });

/** Inert accounting scope. Rows are not operator approval, identity proof or source grants. */
export const chatResearchWindows = pgTable(
  "chat_research_windows",
  {
    id: uuidV7("id").primaryKey(),
    approvalSha256: text("approval_sha256").notNull().unique(),
    // Historical canonical identity: logout/account deletion must not erase held spending evidence.
    actorId: uuid("actor_id").notNull(),
    corpusVersion: text("corpus_version").notNull(),
    model: text("model").notNull(),
    processorProfile: text("processor_profile").notNull(),
    beginsAt: instant("begins_at").notNull(),
    expiresAt: instant("expires_at").notNull(),
    maxRequests: integer("max_requests").notNull(),
    perRequestPico: pico("per_request_pico").notNull(),
    totalPico: pico("total_pico").notNull(),
    requestsUsed: integer("requests_used").notNull().default(0),
    heldPico: pico("held_pico").notNull().default(0),
    stopped: timestamp("stopped_at", { withTimezone: true }),
  },
  (t) => [
    ...[t.approvalSha256, t.corpusVersion].map((c) =>
      check(
        `chat_research_windows_${c.name}_hash`,
        sql`${c} ~ '^[0-9a-f]{64}$'`,
      ),
    ),
    check(
      "chat_research_windows_identity",
      sql`substring(${t.id}::text from 15 for 1)='7' and substring(${t.id}::text from 20 for 1) in ('8','9','a','b') and substring(${t.actorId}::text from 15 for 1)='7' and substring(${t.actorId}::text from 20 for 1) in ('8','9','a','b')`,
    ),
    check(
      "chat_research_windows_profile",
      sql`length(${t.model}) between 1 and 128 and ${t.processorProfile} ~ '^[a-zA-Z0-9_-]{1,128}$'`,
    ),
    check(
      "chat_research_windows_lifetime",
      sql`${t.expiresAt} > ${t.beginsAt} and ${t.expiresAt} <= ${t.beginsAt} + interval '24 hours'`,
    ),
    check(
      "chat_research_windows_count",
      sql`${t.maxRequests} between 1 and 10 and ${t.requestsUsed} between 0 and ${t.maxRequests}`,
    ),
    check(
      "chat_research_windows_amount",
      sql`${t.perRequestPico} between 1 and 350000000000 and ${t.totalPico} between 1 and 3500000000000 and ${t.heldPico} between 0 and ${t.totalPico}`,
    ),
  ],
);

/** Full immutable reservations survive failure. These metadata rows contain no question, passage or secret. */
export const chatResearchPermits = pgTable(
  "chat_research_permits",
  {
    id: uuidV7("id").primaryKey(),
    windowId: uuid("window_id")
      .notNull()
      .references(() => chatResearchWindows.id, { onDelete: "restrict" }),
    operationId: uuid("operation_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    descriptorSha256: text("descriptor_sha256").notNull(),
    requestSha256: text("request_sha256").notNull(),
    sourceContextSha256: text("source_context_sha256").notNull(),
    upperPico: pico("upper_pico").notNull(),
    quoteExpiresAt: instant("quote_expires_at").notNull(),
    reservedAt: instant("reserved_at").notNull(),
    state: text("state")
      .$type<
        "reserved" | "dispatching" | "completed" | "failed" | "indeterminate"
      >()
      .notNull(),
    dispatchId: uuid("dispatch_id"),
    dispatchAt: instant("dispatch_at"),
    finishedAt: instant("finished_at"),
    reportedPico: pico("reported_pico"),
    responseSha256: text("response_sha256"),
    answerSha256: text("answer_sha256"),
    resultSha256: text("result_sha256"),
  },
  (t) => [
    uniqueIndex("chat_research_permits_operation").on(
      t.windowId,
      t.operationId,
    ),
    uniqueIndex("chat_research_permits_one_open")
      .on(t.windowId)
      .where(sql`${t.state} in ('reserved','dispatching')`),
    index("chat_research_permits_owner").on(t.actorId, t.sessionId),
    check(
      "chat_research_permits_identity",
      sql`substring(${t.id}::text from 15 for 1)='7' and substring(${t.id}::text from 20 for 1) in ('8','9','a','b') and substring(${t.operationId}::text from 15 for 1)='7' and substring(${t.operationId}::text from 20 for 1) in ('8','9','a','b') and substring(${t.actorId}::text from 15 for 1)='7' and substring(${t.actorId}::text from 20 for 1) in ('8','9','a','b') and substring(${t.sessionId}::text from 15 for 1)='7' and substring(${t.sessionId}::text from 20 for 1) in ('8','9','a','b')`,
    ),
    ...[t.descriptorSha256, t.requestSha256, t.sourceContextSha256].map((c) =>
      check(
        `chat_research_permits_${c.name}_hash`,
        sql`${c} ~ '^[0-9a-f]{64}$'`,
      ),
    ),
    ...[t.responseSha256, t.answerSha256, t.resultSha256].map((c) =>
      check(
        `chat_research_permits_${c.name}_hash`,
        sql`${c} is null or ${c} ~ '^[0-9a-f]{64}$'`,
      ),
    ),
    check(
      "chat_research_permits_dispatch_time",
      sql`${t.dispatchAt} is null or (${t.dispatchAt} >= ${t.reservedAt} and ${t.dispatchAt} < ${t.quoteExpiresAt})`,
    ),
    check(
      "chat_research_permits_amount",
      sql`${t.upperPico} between 1 and 350000000000 and (${t.reportedPico} is null or ${t.reportedPico} between 0 and 9007199254740991)`,
    ),
    check(
      "chat_research_permits_quote",
      sql`${t.quoteExpiresAt} > ${t.reservedAt} and ${t.quoteExpiresAt} <= ${t.reservedAt} + interval '60 seconds'`,
    ),
    check(
      "chat_research_permits_state",
      sql`
      (${t.state}='reserved' and ${t.dispatchId} is null and ${t.dispatchAt} is null and ${t.finishedAt} is null and ${t.resultSha256} is null and ${t.reportedPico} is null and ${t.responseSha256} is null and ${t.answerSha256} is null)
      or (${t.state}='dispatching' and ${t.dispatchId} is not null and ${t.dispatchAt} is not null and ${t.finishedAt} is null and ${t.resultSha256} is null and ${t.reportedPico} is null and ${t.responseSha256} is null and ${t.answerSha256} is null)
      or (${t.state} in ('completed','failed','indeterminate') and ${t.dispatchId} is not null and ${t.dispatchAt} is not null and ${t.finishedAt} is not null and ${t.finishedAt} >= ${t.dispatchAt} and ${t.resultSha256} is not null)
    `,
    ),
    check(
      "chat_research_permits_completed",
      sql`${t.state} <> 'completed' or (${t.reportedPico} is not null and ${t.reportedPico} <= ${t.upperPico} and ${t.responseSha256} is not null and ${t.answerSha256} is not null)`,
    ),
  ],
);
