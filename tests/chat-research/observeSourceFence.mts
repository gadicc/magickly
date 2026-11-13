/** Test-only result observer. It forwards native Drizzle work, never retains SQL text/parameters or result values. */
import { is, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { ResearchSourceDatabase } from "../../src/chat-research/sqlSourceReaders";

const dialect = new PgDialect();
const fail = (): never => {
  throw Error("LOCAL_SOURCE_POLICY_EVIDENCE_FAILED");
};
function fenceProjection(value: unknown): boolean {
  if (
    !value ||
    typeof value !== "object" ||
    !("value" in value) ||
    !is(value.value, SQL)
  )
    return false;
  const statement = dialect.sqlToQuery(value.value).sql;
  return (
    statement.includes("'authorization_version'") &&
    statement.includes("'session_binding_sha256'")
  );
}
function observeBuilder<T extends object>(
  builder: T,
  completed: (rows: number) => void,
): T {
  return new Proxy(builder, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if ((key === "from" || key === "where") && typeof value === "function")
        return (...args: unknown[]) => {
          const next: unknown = Reflect.apply(value, target, args);
          if (!next || typeof next !== "object") return fail();
          return observeBuilder(next, completed);
        };
      if (key === "then" && typeof value === "function")
        return (
          resolve: ((rows: unknown) => unknown) | undefined,
          reject: ((error: unknown) => unknown) | undefined,
        ) =>
          Reflect.apply(value, target, [
            (rows: unknown) => {
              if (!Array.isArray(rows)) return fail();
              completed(rows.length);
              return resolve ? resolve(rows) : rows;
            },
            reject,
          ]);
      return typeof value === "function" && key !== "constructor"
        ? value.bind(target)
        : value;
    },
  });
}
/** One native transaction/callback/COMMIT per call, with only final-fence SELECT result lengths observed. */
export function observeSourceFence(
  database: ResearchSourceDatabase,
  completed: (rows: number) => void,
): ResearchSourceDatabase {
  return {
    transaction: (work, config) =>
      database.transaction(
        (tx) =>
          work(
            new Proxy(tx, {
              get(target, key) {
                const value = Reflect.get(target, key, target);
                if (key === "select" && typeof value === "function")
                  return (...args: unknown[]) => {
                    const builder: unknown = Reflect.apply(value, target, args);
                    if (!fenceProjection(args[0])) return builder;
                    if (!builder || typeof builder !== "object") return fail();
                    return observeBuilder(builder, completed);
                  };
                return typeof value === "function" && key !== "constructor"
                  ? value.bind(target)
                  : value;
              },
            }),
          ),
        config,
      ),
  };
}
/** A sent statement/error is never evidence of a completed zero-row denial. */
export function verifyFenceCase(value: {
  sent: number;
  completedRows: readonly number[];
  attempted: boolean;
  returned: boolean;
  denied: boolean;
  expectedDenied: boolean;
  expectedRows: 0 | 1;
}): void {
  if (
    value.sent !== 1 ||
    value.completedRows.length !== 1 ||
    value.completedRows[0] !== value.expectedRows ||
    !value.attempted ||
    value.returned !== (value.expectedRows === 1) ||
    value.denied !== value.expectedDenied
  )
    fail();
}
