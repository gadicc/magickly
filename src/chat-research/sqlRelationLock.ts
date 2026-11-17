/** Transaction-held relation locks compatible with column-restricted database roles. */
import "server-only";
import { type SQL, sql } from "drizzle-orm";

/**
 * Zero-row SELECT takes ACCESS SHARE on each qualified relation without requiring
 * table-wide SELECT. Each trusted caller supplies a column already in its grants.
 * Execute inside the existing bounded transaction, then check persistent relation
 * identities before reading or mutating data. Never accept HTTP-selected SQL.
 */
export function researchRelationShareLock(
  relations: readonly (readonly [relation: SQL, column: string])[],
): SQL {
  if (!relations.length || relations.length > 16)
    throw Error("Private relation lock unavailable");
  const alias = (index: number) => sql.identifier(`research_lock_${index}`);
  return sql`select ${sql.join(
    relations.map(
      ([, column], index) => sql`${alias(index)}.${sql.identifier(column)}`,
    ),
    sql`, `,
  )} from ${sql.join(
    relations.map(([relation], index) => sql`${relation} as ${alias(index)}`),
    sql`, `,
  )} where false`;
}
