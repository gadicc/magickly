/** Pure native-role projection/checks. Callers own SQL and deadline checks around every await. */
import "server-only";
import { sql } from "drizzle-orm";
import * as v from "valibot";

const shape = v.strictObject({
  database: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  role: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  roleOid: v.pipe(
    v.number(),
    v.safeInteger(),
    v.minValue(1),
    v.maxValue(4294967295),
  ),
});
export type ResearchManagedNativeRole = Readonly<v.InferInput<typeof shape>>;
/** Capture only adopted scalar pins, never a mutable caller object. */
export function prepareResearchManagedNativeRole(
  input: ResearchManagedNativeRole,
) {
  return Object.freeze(v.parse(shape, input));
}
/** PostgreSQL catalog fields only; this function performs no query or waiting. */
export function researchManagedNativeRoleProjection() {
  return {
    database: sql<string>`pg_catalog.current_database()`,
    role: sql<string>`current_user`,
    roleOid:
      sql<number>`(select r.oid::bigint from pg_catalog.pg_roles r where r.rolname=current_user)`.mapWith(
        Number,
      ),
    unsafeRole: sql<boolean>`(select not r.rolcanlogin or r.rolsuper or r.rolcreatedb or r.rolcreaterole or r.rolinherit or r.rolreplication or r.rolbypassrls or exists(select 1 from pg_catalog.pg_auth_members m where m.member=r.oid) or exists(select 1 from pg_catalog.pg_shdepend d where d.refclassid='pg_catalog.pg_authid'::regclass and d.refobjid=r.oid and d.deptype='o') from pg_catalog.pg_roles r where r.rolname=current_user)`,
  };
}
/** Check fresh native data inside the caller's already fenced operation. No identity or grants are adopted here. */
export function assertResearchManagedNativeRole(
  row: {
    database?: string;
    role?: string;
    roleOid?: number;
    unsafeRole?: boolean;
  },
  pin: ResearchManagedNativeRole,
) {
  if (
    row.database !== pin.database ||
    row.role !== pin.role ||
    row.roleOid !== pin.roleOid ||
    row.unsafeRole !== false
  )
    throw Error("Private native role unavailable");
}
