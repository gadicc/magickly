/** Server-rendered reader hint only. No source permission or packet authority is returned. */
import "server-only";
import { createHash } from "node:crypto";
import { is, sql } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { createSqlAuth, getFreshSqlSession } from "../auth/sqlAuth";
import { isUuidV7 } from "../lib/ids";
import { withinResearchDeadline } from "./boundedWork";
import type { ResearchSourceSubject } from "./sourceAuthorization";
import {
  copyResearchSourceAuthOptions,
  type ResearchSourceAuthOptions,
  type ResearchSourceDatabase,
} from "./sqlSourceReaders";

/** Auth is read in its own fresh READ ONLY root. Ledger read paths separately need row locks and must retain their existing transaction mode. */
async function readPrivateResearchSession(
  database: ResearchSourceDatabase,
  settings: ResearchSourceAuthOptions,
  headers: Headers,
  signal: AbortSignal,
  operatorId: string | null,
  inheritedDeadlineAt?: number,
  includeSubject = false,
) {
  const started = performance.now(),
    end = Math.min(started + 8000, inheritedDeadlineAt ?? Infinity),
    options = copyResearchSourceAuthOptions(settings),
    ownedHeaders = new Headers(headers);
  try {
    if (
      inheritedDeadlineAt !== undefined &&
      (typeof inheritedDeadlineAt !== "number" ||
        !Number.isFinite(inheritedDeadlineAt))
    )
      throw Error();
    if (is(database, PgTransaction) || "rollback" in database) throw Error();
    return await withinResearchDeadline(
      signal,
      async (bounded) => {
        let nativeSessionEnd = end;
        const assert = () => {
          bounded.throwIfAborted();
          if (performance.now() >= nativeSessionEnd) throw Error();
        };
        let nativeTimer: ReturnType<typeof setTimeout> | undefined;
        let rejectNative!: (error: Error) => void;
        const nativeExpired = new Promise<never>((_resolve, reject) => {
          rejectNative = reject;
        });
        void nativeExpired.catch(() => {});
        const expire = () =>
          rejectNative(Error("Private operator session unavailable"));
        bounded.addEventListener("abort", expire, { once: true });
        try {
          const value = await Promise.race([
            database.transaction(
              async (tx) => {
                assert();
                await tx.execute(sql`set local statement_timeout='8s'`);
                assert();
                await tx.execute(
                  sql`set local search_path=pg_catalog,public,pg_temp`,
                );
                assert();
                const [mode] = await tx
                  .select({
                    readonly: sql<string>`current_setting('transaction_read_only')`,
                    isolation: sql<string>`current_setting('transaction_isolation')`,
                  })
                  .from(sql`(select 1) preview_auth_guard`);
                assert();
                if (
                  mode?.readonly !== "on" ||
                  mode.isolation !== "read committed"
                )
                  throw Error();
                const current = await getFreshSqlSession(
                  createSqlAuth({ ...options, db: tx }),
                  ownedHeaders,
                );
                assert();
                if (
                  !current ||
                  (operatorId !== null && current.user.id !== operatorId)
                )
                  return null;
                if (includeSubject) {
                  const nativeStarted = performance.now(),
                    token = current.session.token;
                  if (
                    typeof token !== "string" ||
                    !token.length ||
                    token.length > 4096 ||
                    !token.isWellFormed()
                  )
                    throw Error();
                  const rows = await tx
                    .select({
                      now: sql<number>`pg_catalog.ceil(extract(epoch from clock.at)*1000)::double precision`.mapWith(
                        Number,
                      ),
                      expires:
                        sql<number>`pg_catalog.floor(extract(epoch from s.expires_at)*1000)::double precision`.mapWith(
                          Number,
                        ),
                    })
                    .from(
                      sql`(select pg_catalog.clock_timestamp() as at) clock cross join public.auth_session s join public.auth_user u on u.id=s.user_id`,
                    )
                    .where(
                      sql`s.id=${current.session.id}::uuid and u.id=${current.user.id}::uuid and s.token=${token} and s.expires_at>clock.at`,
                    );
                  assert();
                  if (
                    rows.length !== 1 ||
                    !Number.isSafeInteger(rows[0].now) ||
                    !Number.isSafeInteger(rows[0].expires) ||
                    rows[0].now < 0 ||
                    rows[0].expires <= rows[0].now
                  )
                    throw Error();
                  // Query start is conservative: SQL, adapter and COMMIT time consume
                  // the observed remaining native TTL rather than resetting it.
                  nativeSessionEnd = Math.min(
                    end,
                    nativeStarted + rows[0].expires - rows[0].now,
                  );
                  assert();
                  nativeTimer = setTimeout(
                    expire,
                    Math.max(0, nativeSessionEnd - performance.now()),
                  );
                  nativeTimer.unref?.();
                }
                const expiresAt = current.session.expiresAt.getTime(),
                  identity = createHash("sha256")
                    .update(
                      JSON.stringify([
                        current.user.id,
                        current.session.id,
                        expiresAt,
                      ]),
                    )
                    .digest("hex");
                assert();
                return Object.freeze({
                  expiresAt,
                  identity,
                  ...(includeSubject
                    ? {
                        deadlineAt: nativeSessionEnd,
                        subject: Object.freeze({
                          kind: "user" as const,
                          user_id: current.user.id,
                          session_id: current.session.id,
                        }),
                      }
                    : {}),
                });
              },
              { isolationLevel: "read committed", accessMode: "read only" },
            ),
            nativeExpired,
          ]);
          assert();
          return value;
        } finally {
          bounded.removeEventListener("abort", expire);
          if (nativeTimer !== undefined) clearTimeout(nativeTimer);
        }
      },
      end,
    );
  } catch {
    throw Error("Private reader session unavailable");
  } finally {
    ownedHeaders.delete("cookie");
    ownedHeaders.delete("authorization");
  }
}

/** Existing reader session hint; source and retained-read authorization remain separate. */
export function readPrivateResearchPreviewSession(
  database: ResearchSourceDatabase,
  settings: ResearchSourceAuthOptions,
  headers: Headers,
  signal: AbortSignal,
) {
  return readPrivateResearchSession(database, settings, headers, signal, null);
}
/** Main-site operator shell guard. Only an independently bound canonical account ID is accepted; email, browser role and UI state are not allowlist authority. APIs must still perform their own fresh source/native checks. */
export function readPrivateResearchOperatorSession(
  database: ResearchSourceDatabase,
  settings: ResearchSourceAuthOptions,
  headers: Headers,
  signal: AbortSignal,
  independentlyBoundOperatorId: string,
) {
  if (
    !isUuidV7(independentlyBoundOperatorId) ||
    independentlyBoundOperatorId !== independentlyBoundOperatorId.toLowerCase()
  )
    return Promise.reject(Error("Private operator session unavailable"));
  return readPrivateResearchSession(
    database,
    settings,
    headers,
    signal,
    independentlyBoundOperatorId,
  );
}

/** Server-only canonical operator identity for managed bootstrap. No token, profile or source grant is returned. The inherited route deadline can only shorten the fresh read-only authentication. */
export async function readPrivateResearchManagedOperatorPrincipal(
  database: ResearchSourceDatabase,
  settings: ResearchSourceAuthOptions,
  headers: Headers,
  signal: AbortSignal,
  independentlyBoundOperatorId: string,
  inheritedDeadlineAt: number,
): Promise<Readonly<{
  subject: ResearchSourceSubject;
  expiresAt: number;
  deadlineAt: number;
}> | null> {
  try {
    if (
      !isUuidV7(independentlyBoundOperatorId) ||
      independentlyBoundOperatorId !==
        independentlyBoundOperatorId.toLowerCase()
    )
      throw Error();
    const value = await readPrivateResearchSession(
      database,
      settings,
      headers,
      signal,
      independentlyBoundOperatorId,
      inheritedDeadlineAt,
      true,
    );
    if (!value) return null;
    const subject = value.subject;
    if (
      !subject ||
      !isUuidV7(subject.session_id) ||
      subject.session_id !== subject.session_id.toLowerCase() ||
      !Number.isSafeInteger(value.expiresAt) ||
      value.expiresAt <= Date.now()
    )
      throw Error();
    if (
      typeof value.deadlineAt !== "number" ||
      !Number.isFinite(value.deadlineAt) ||
      signal.aborted ||
      performance.now() >= value.deadlineAt
    )
      throw Error();
    return Object.freeze({
      subject,
      expiresAt: value.expiresAt,
      deadlineAt: value.deadlineAt,
    });
  } catch {
    throw Error("Private operator session unavailable");
  }
}
