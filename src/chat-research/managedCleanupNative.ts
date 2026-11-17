/** Pure cleanup catalog projection; the caller owns the original SQL/deadline fence. */
import "server-only";
import { sql } from "drizzle-orm";
import { researchManagedNativeRoleProjection } from "./managedNativeRole";
/** Same native role safety as the query root, plus the exact persistent artifact relation and backend. */
export function researchManagedCleanupNativeProjection(schemaName: string) {
  return {
    ...researchManagedNativeRoleProjection(),
    pid: sql<number>`pg_catalog.pg_backend_pid()`,
    oid: sql<number>`(select c.oid::bigint from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname=${schemaName} and c.relname='chat_research_artifacts' and c.relkind='r' and c.relpersistence='p')`.mapWith(
      Number,
    ),
  };
}
