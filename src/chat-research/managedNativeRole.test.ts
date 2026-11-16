import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { expect, it, vi } from "vitest";
import {
  assertResearchManagedNativeRole,
  prepareResearchManagedNativeRole,
  researchManagedNativeRoleProjection,
} from "./managedNativeRole";

vi.mock("server-only", () => ({}));
const pin = { database: "synthetic_db", role: "synthetic_role", roleOid: 701 };
it("captures adopted pins without holding mutable caller state", () => {
  const input = { ...pin },
    copied = prepareResearchManagedNativeRole(input);
  input.roleOid = 999;
  expect(copied).toEqual(pin);
  expect(Object.isFrozen(copied)).toBe(true);
});
it.each([
  { roleOid: 0 },
  { roleOid: 4294967296 },
  { role: "" },
  { database: "" },
])("refuses malformed identity %j", (delta) => {
  expect(() =>
    prepareResearchManagedNativeRole({ ...pin, ...delta }),
  ).toThrow();
});
it("accepts only the expected fresh unprivileged native row", () => {
  assertResearchManagedNativeRole({ ...pin, unsafeRole: false }, pin);
  for (const delta of [
    { database: "other" },
    { role: "owner" },
    { roleOid: 999 },
    { unsafeRole: true },
    { unsafeRole: undefined },
  ])
    expect(() =>
      assertResearchManagedNativeRole(
        { ...pin, unsafeRole: false, ...delta },
        pin,
      ),
    ).toThrow();
});
it("emits catalog-only fields with no query/transaction or caller deadline hidden in the helper", () => {
  const fields = researchManagedNativeRoleProjection(),
    query = new PgDialect().sqlToQuery(
      sql`select ${sql.join(
        Object.entries(fields).map(
          ([key, field]) => sql`${field} as ${sql.identifier(key)}`,
        ),
        sql`, `,
      )}`,
    );
  expect(query.params).toEqual([]);
  expect(query.sql).toContain("pg_catalog.pg_roles");
  expect(query.sql).toContain("pg_catalog.pg_auth_members");
  expect(query.sql).toContain("pg_catalog.pg_shdepend");
  expect(query.sql).toContain("d.deptype='o'");
  expect(query.sql).not.toContain("public.auth");
});
