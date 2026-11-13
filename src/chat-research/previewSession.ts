/** Server-rendered reader hint only. No source permission or packet authority is returned. */
import "server-only";
import { createHash } from "node:crypto";
import { is, sql } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { createSqlAuth, getFreshSqlSession } from "../auth/sqlAuth";
import { withinResearchDeadline } from "./boundedWork";
import {
  copyResearchSourceAuthOptions,
  type ResearchSourceAuthOptions,
  type ResearchSourceDatabase,
} from "./sqlSourceReaders";
/** Auth is read in its own fresh READ ONLY root. Ledger read paths separately need row locks and must retain their existing transaction mode. */
export async function readPrivateResearchPreviewSession(
  database: ResearchSourceDatabase,
  settings: ResearchSourceAuthOptions,
  headers: Headers,
  signal: AbortSignal,
) {
  const end = performance.now() + 8000,
    options = copyResearchSourceAuthOptions(settings),
    ownedHeaders = new Headers(headers);
  try {
    if (is(database, PgTransaction) || "rollback" in database) throw Error();
    return await withinResearchDeadline(
      signal,
      async (bounded) => {
        const assert = () => {
          bounded.throwIfAborted();
          if (performance.now() >= end) throw Error();
        };
        const value = await database.transaction(
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
            if (mode?.readonly !== "on" || mode.isolation !== "read committed")
              throw Error();
            const current = await getFreshSqlSession(
              createSqlAuth({ ...options, db: tx }),
              ownedHeaders,
            );
            assert();
            if (!current) return null;
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
            return Object.freeze({ expiresAt, identity });
          },
          { isolationLevel: "read committed", accessMode: "read only" },
        );
        assert();
        return value;
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
