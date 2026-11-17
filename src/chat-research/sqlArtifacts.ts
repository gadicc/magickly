/** Inactive private packet storage. No HTTP, auth grant, provider transport or history admission. */
import "server-only";
import { and, eq, is, isNull, lte, sql } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { chatResearchArtifacts as artifacts } from "../db/schema/chatResearchArtifacts";
import {
  RESEARCH_OPERATION_TIMEOUT_MS,
  withinResearchDeadline,
} from "./boundedWork";
import {
  RESEARCH_ARTIFACT_RETENTION_MS,
  readResearchRequestPacket,
} from "./requestArtifact";
import type {
  ResearchAccountingStorage,
  ResearchAdmissionDatabase,
  ResearchAdmissionTransaction,
} from "./sqlAdmission";
import { researchRelationShareLock } from "./sqlRelationLock";

const ERROR = "Private research artifact storage unavailable";
const fail = (): never => {
  throw Error(ERROR);
};
/** Trusted startup namespace, copied; never accept one from a browser or use search-path fallback. */
export function researchArtifactNamespace(
  storage: ResearchAccountingStorage,
): string {
  const keys = Object.keys(storage),
    name = storage.schemaName ?? "public";
  if (
    keys.some((k) => k !== "schemaName") ||
    typeof name !== "string" ||
    name.trim() !== name ||
    name.length > 63 ||
    !/^[a-z_][a-z0-9_]*$/.test(name) ||
    name.startsWith("pg_") ||
    name === "information_schema"
  )
    fail();
  return name;
}
/** Qualified lock + native identity check prevent missing-migration fallthrough to a temporary table. */
export async function lockResearchArtifacts(
  tx: ResearchAdmissionTransaction,
  namespace: string,
  assertReady: () => void = () => {},
) {
  assertReady();
  await tx.execute(
    researchRelationShareLock([
      [
        sql`${sql.identifier(namespace)}.${sql.identifier("chat_research_artifacts")}`,
        "permit_id",
      ],
    ]),
  );
  assertReady();
  const rows = await tx
    .select({ name: sql<string>`c.relname` })
    .from(
      sql`pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace`,
    )
    .where(
      sql`n.nspname=${namespace} and c.relname='chat_research_artifacts' and c.relkind='r' and c.relpersistence='p'`,
    );
  assertReady();
  if (rows.length !== 1) fail();
}
/** Checks immutable request bytes and ledger identity; this is data only, never a completion/dispatch grant. */
export function validateResearchRequestRow(
  row: typeof artifacts.$inferSelect,
  permit: {
    id: string;
    windowId: string;
    operationId: string;
    actorId: string;
    sessionId: string;
    reservedAt: Date;
    requestSha256: string;
    sourceContextSha256: string;
  },
  scope: {
    model: string;
    processorProfile: string;
    corpusVersion: string;
    beginsAtMs?: number;
    expiresAtMs?: number;
  },
) {
  if (
    row.permitId !== permit.id ||
    row.kind !== "request" ||
    row.jobCreatedAt.getTime() !== permit.reservedAt.getTime() ||
    row.storedAt.getTime() !== permit.reservedAt.getTime() ||
    row.retainUntil.getTime() !==
      permit.reservedAt.getTime() + RESEARCH_ARTIFACT_RETENTION_MS
  )
    fail();
  if (row.packetJson === null || row.purgedAt !== null) return fail();
  const packet = readResearchRequestPacket(row.packetJson, row.packetSha256);
  if (
    packet.schema_version === 2 &&
    (packet.history_binding.window_begins_at_ms !== scope.beginsAtMs ||
      packet.history_binding.window_expires_at_ms !== scope.expiresAtMs)
  )
    fail();
  if (
    packet.window_id !== permit.windowId ||
    packet.operation_id !== permit.operationId ||
    packet.context.subject.user_id !== permit.actorId ||
    packet.context.subject.session_id !== permit.sessionId ||
    packet.context.corpus_version !== scope.corpusVersion ||
    packet.model !== scope.model ||
    packet.processor_profile !== scope.processorProfile ||
    packet.request_sha256 !== permit.requestSha256 ||
    packet.source_context_sha256 !== permit.sourceContextSha256
  )
    fail();
  return packet;
}
/** Bounded administrative expiry worker. Independent of accounting validity/authentication and never renews retention.
 * Only logical payload removal is claimed; WAL, backups and database storage reclamation are separate concerns. */
export function createSqlResearchArtifactPurger(
  database: ResearchAdmissionDatabase,
  storage: ResearchAccountingStorage = {},
) {
  if (is(database, PgTransaction) || "rollback" in database) fail();
  const namespace = researchArtifactNamespace(storage);
  return async (
    limit: number,
    signal: AbortSignal,
    parentDeadlineAt?: number,
  ): Promise<{ permits: number; packets: number }> => {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail();
    if (
      parentDeadlineAt !== undefined &&
      (typeof parentDeadlineAt !== "number" ||
        !Number.isFinite(parentDeadlineAt))
    )
      fail();
    const deadlineAt = Math.min(
      performance.now() + RESEARCH_OPERATION_TIMEOUT_MS,
      parentDeadlineAt ?? Infinity,
    );
    try {
      return await withinResearchDeadline(
        signal,
        async (bounded) => {
          const assert = () => {
            bounded.throwIfAborted();
            if (performance.now() >= deadlineAt) fail();
          };
          const step = async <T>(action: () => PromiseLike<T>): Promise<T> => {
            assert();
            const result = await action();
            assert();
            return result;
          };
          assert();
          const result = await database.transaction(async (tx) => {
            await step(() => tx.execute(sql`set local lock_timeout='5s'`));
            await step(() => tx.execute(sql`set local statement_timeout='8s'`));
            await step(() =>
              tx.execute(
                sql`set local search_path=pg_catalog, ${sql.identifier(namespace)}, pg_temp`,
              ),
            );
            await step(() => lockResearchArtifacts(tx, namespace, assert));
            // Serialize workers only; never acquire window/permit locks after artifact locks.
            const [lock] = await step(() =>
              tx
                .select({
                  ok: sql<boolean>`pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(${`magickli-research-artifact-purge-v1:${namespace}`},0))`,
                })
                .from(sql`(select 1) as purge_lock`),
            );
            if (!lock?.ok) return { permits: 0, packets: 0 };
            const [clock] = await step(() =>
              tx
                .select({
                  now: sql<Date>`pg_catalog.clock_timestamp()`.mapWith(
                    (value: string | Date) => new Date(value),
                  ),
                })
                .from(sql`(select 1) as purge_clock`),
            );
            if (!clock || !Number.isFinite(clock.now.getTime())) fail();
            const eligible = await step(() =>
              tx
                .selectDistinct({ permitId: artifacts.permitId })
                .from(artifacts)
                .where(
                  and(
                    isNull(artifacts.purgedAt),
                    lte(artifacts.retainUntil, clock.now),
                  ),
                )
                .orderBy(artifacts.permitId)
                .limit(limit),
            );
            let packets = 0;
            for (const { permitId } of eligible) {
              await step(() =>
                tx
                  .select({ kind: artifacts.kind })
                  .from(artifacts)
                  .where(eq(artifacts.permitId, permitId))
                  .orderBy(artifacts.kind)
                  .for("update"),
              );
              const changed = await step(() =>
                tx
                  .update(artifacts)
                  .set({ packetJson: null, purgedAt: clock.now })
                  .where(
                    and(
                      eq(artifacts.permitId, permitId),
                      isNull(artifacts.purgedAt),
                      lte(artifacts.retainUntil, clock.now),
                    ),
                  )
                  .returning({ kind: artifacts.kind }),
              );
              packets += changed.length;
            }
            assert();
            return { permits: eligible.length, packets };
          });
          assert();
          return result;
        },
        deadlineAt,
      );
    } catch {
      return fail();
    }
  };
}
