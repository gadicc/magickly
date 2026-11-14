/** Inactive one-shot packet retention tick. No timer, authentication, approval, provider or generation API. */
import "server-only";
import { is, sql } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import {
  RESEARCH_OPERATION_TIMEOUT_MS,
  withinResearchDeadline,
} from "./boundedWork";
import type {
  ResearchAccountingStorage,
  ResearchAdmissionDatabase,
} from "./sqlAdmission";
import {
  createSqlResearchArtifactPurger,
  lockResearchArtifacts,
  researchArtifactNamespace,
} from "./sqlArtifacts";
export const RESEARCH_RETENTION_ERROR =
  "Private research retention unavailable";
function fail(): never {
  throw Error(RESEARCH_RETENTION_ERROR);
}
/** Source-free native-time observation only. A zero backlog is not a future cleanup/physical erasure guarantee. */
export interface ResearchRetentionObservation {
  readonly observed_at_ms: number;
  readonly expired_permits: number;
  readonly expired_packets: number;
  readonly oldest_expired_at_ms: number | null;
}
/** A bounded logical purge followed by an independent fresh native-time backlog observation. */
export interface ResearchRetentionTick extends ResearchRetentionObservation {
  readonly status: "no-expired-packets-observed" | "expired-packets-pending";
  readonly purged_permits: number;
  readonly purged_packets: number;
}
/** Actual root database/namespace, never request data. No active spend/source/session is needed to remove expired packets. */
export function createSqlResearchRetentionTick(
  database: ResearchAdmissionDatabase,
  storage: ResearchAccountingStorage = {},
  limit = 100,
) {
  try {
    if (
      is(database, PgTransaction) ||
      "rollback" in database ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      fail();
    const namespace = researchArtifactNamespace(storage),
      purge = createSqlResearchArtifactPurger(database, {
        schemaName: namespace,
      });
    let consumed = false;
    return Object.freeze({
      /** Single-use per worker invocation; a timeout/lost ACK is never auto-retried here. The next separately scheduled tick is idempotent. */
      async run(
        signal: AbortSignal,
        absoluteDeadlineAt?: number,
      ): Promise<ResearchRetentionTick> {
        try {
          if (
            absoluteDeadlineAt !== undefined &&
            (typeof absoluteDeadlineAt !== "number" ||
              !Number.isFinite(absoluteDeadlineAt))
          )
            fail();
          const deadlineAt = Math.min(
            performance.now() + RESEARCH_OPERATION_TIMEOUT_MS,
            absoluteDeadlineAt ?? Infinity,
          );
          if (consumed) fail();
          consumed = true;
          return await withinResearchDeadline(
            signal,
            async (bounded) => {
              const assert = () => {
                bounded.throwIfAborted();
                if (performance.now() >= deadlineAt) fail();
              };
              const step = async <T>(
                action: () => PromiseLike<T>,
              ): Promise<T> => {
                assert();
                const result = await action();
                assert();
                return result;
              };
              assert();
              const removed = await step(() =>
                purge(limit, bounded, deadlineAt),
              );
              assert();
              const observation = await database.transaction(
                async (tx) => {
                  assert();
                  await step(() =>
                    tx.execute(sql`set local lock_timeout='5s'`),
                  );
                  await step(() =>
                    tx.execute(sql`set local statement_timeout='8s'`),
                  );
                  await step(() =>
                    tx.execute(
                      sql`set local search_path=pg_catalog, ${sql.identifier(namespace)}, pg_temp`,
                    ),
                  );
                  await step(() =>
                    lockResearchArtifacts(tx, namespace, assert),
                  );
                  const [r] = await step(() =>
                    tx
                      .select({
                        now: sql<number>`pg_catalog.floor(extract(epoch from clock.at)*1000)::double precision`,
                        permits: sql<number>`due.permits::double precision`,
                        packets: sql<number>`due.packets::double precision`,
                        oldest: sql<
                          number | null
                        >`pg_catalog.floor(extract(epoch from due.oldest)*1000)::double precision`,
                        readOnly: sql<string>`pg_catalog.current_setting('transaction_read_only')`,
                        isolation: sql<string>`pg_catalog.current_setting('transaction_isolation')`,
                      })
                      .from(
                        sql`(select pg_catalog.clock_timestamp() as at) clock cross join lateral (select pg_catalog.count(distinct a.permit_id) as permits,pg_catalog.count(*) as packets,pg_catalog.min(a.retain_until) as oldest from ${sql.identifier(namespace)}.${sql.identifier("chat_research_artifacts")} a where a.purged_at is null and a.retain_until<=clock.at) due`,
                      ),
                  );
                  assert();
                  if (
                    !r ||
                    r.readOnly !== "on" ||
                    r.isolation !== "read committed" ||
                    !Number.isSafeInteger(r.now) ||
                    r.now < 0 ||
                    !Number.isSafeInteger(r.permits) ||
                    r.permits < 0 ||
                    !Number.isSafeInteger(r.packets) ||
                    r.packets < r.permits ||
                    r.packets > 2 * r.permits ||
                    (r.packets === 0
                      ? r.oldest !== null
                      : !Number.isSafeInteger(r.oldest) || r.oldest! > r.now)
                  )
                    fail();
                  return Object.freeze({
                    observed_at_ms: r.now,
                    expired_permits: r.permits,
                    expired_packets: r.packets,
                    oldest_expired_at_ms: r.oldest,
                  });
                },
                { accessMode: "read only", isolationLevel: "read committed" },
              );
              assert();
              return Object.freeze({
                ...observation,
                status:
                  observation.expired_packets === 0
                    ? ("no-expired-packets-observed" as const)
                    : ("expired-packets-pending" as const),
                purged_permits: removed.permits,
                purged_packets: removed.packets,
              });
            },
            deadlineAt,
          );
        } catch {
          return fail();
        }
      },
    });
  } catch {
    return fail();
  }
}
