/** Shared inactive accounting configuration validation. It confers no identity, approval or spending authority. */
import "server-only";
import * as v from "valibot";
import { isUuidV7 } from "../lib/ids";

const fail = (): never => {
  throw Error("Private research admission unavailable");
};
const uuid = v.pipe(
  v.string(),
  v.check((s) => isUuidV7(s) && s === s.toLowerCase()),
);
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[0-9a-f]{64}$/));
const integer = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const money = v.pipe(integer, v.maxValue(Number.MAX_SAFE_INTEGER));
const scopeShape = v.pipe(
  v.strictObject({
    windowId: uuid,
    approvalSha256: hash,
    actorId: uuid,
    corpusVersion: hash,
    model: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    processorProfile: v.pipe(v.string(), v.regex(/^[a-zA-Z0-9_-]{1,128}$/)),
    beginsAtMs: integer,
    expiresAtMs: integer,
    maxRequests: v.pipe(integer, v.minValue(1), v.maxValue(10)),
    perRequestPico: v.pipe(money, v.minValue(1), v.maxValue(350000000000)),
    totalPico: v.pipe(money, v.minValue(1), v.maxValue(3500000000000)),
  }),
  v.check(
    (s) =>
      s.expiresAtMs > s.beginsAtMs && s.expiresAtMs - s.beginsAtMs <= 86400000,
  ),
);
const storageShape = v.strictObject({
  schemaName: v.optional(
    v.pipe(
      v.string(),
      v.maxLength(63),
      v.regex(/^[a-z_][a-z0-9_]*$/),
      v.check(
        (s) =>
          s.trim() === s && !s.startsWith("pg_") && s !== "information_schema",
      ),
    ),
    "public",
  ),
});
/** Trusted deployment namespace, never a request field. Activation must separately bind database + schema. */
export interface ResearchAccountingStorage {
  readonly schemaName?: string;
}
/** Fixed server-owned accounting identity. It is NOT an operator approval, source grant or provider capability. */
export type ResearchAccountingScope = Readonly<
  v.InferOutput<typeof scopeShape>
>;

/** Validate and own trusted startup configuration. No I/O, window creation or authority. */
export function parseResearchAccountingTarget(
  value: ResearchAccountingScope,
  storage: ResearchAccountingStorage = {},
) {
  const parsed = v.safeParse(scopeShape, value),
    location = v.safeParse(storageShape, storage);
  if (!parsed.success || !location.success) return fail();
  return Object.freeze({
    scope: Object.freeze(parsed.output),
    storage: Object.freeze(location.output),
  });
}
