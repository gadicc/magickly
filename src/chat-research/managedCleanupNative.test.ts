import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { expect, it, vi } from "vitest";
import { researchManagedCleanupNativeProjection } from "./managedCleanupNative";

vi.mock("server-only", () => ({}));
it("keeps the schema a parameter while combining native role safety and persistent artifact identity", () => {
  const input = "synthetic';select 1;--",
    p = researchManagedCleanupNativeProjection(input),
    q = new PgDialect().sqlToQuery(
      sql`select ${sql.join(
        Object.entries(p).map(([k, v]) => sql`${v} as ${sql.identifier(k)}`),
        sql`, `,
      )}`,
    );
  expect(q.params).toEqual([input]);
  expect(q.sql).not.toContain(input);
  expect(q.sql).toContain("pg_catalog.pg_shdepend");
  expect(q.sql).toContain("c.relpersistence='p'");
  expect(Object.keys(p)).toEqual([
    "database",
    "role",
    "roleOid",
    "unsafeRole",
    "pid",
    "oid",
  ]);
});
