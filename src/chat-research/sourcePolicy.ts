/** Private metadata format/compiler only. Preparing a document never approves or publishes it. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import { isUuidV7 } from "../lib/ids";
import type {
  ResearchSourceContext,
  ResearchSourceSnapshot,
  ResearchSourceSubject,
} from "./sourceAuthorization";
import { RESEARCH_SOURCE_ERROR } from "./sourceAuthorization";

/** 75,000 bare SHA-256 strings occupy about 5 MB in JSON; 8 MiB leaves bounded policy/grant overhead. */
export const MAX_RESEARCH_POLICY_BYTES = 8 * 1024 * 1024;
export const MAX_RESEARCH_POLICY_EVIDENCE = 75000;
const exact = (pattern: RegExp) => (s: string) => pattern.exec(s)?.[0] === s;
const key = v.pipe(v.string(), v.check(exact(/^[A-Za-z0-9_-]{1,128}$/)));
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const uuid = v.pipe(
  v.string(),
  v.check((s) => isUuidV7(s) && s === s.toLowerCase()),
);
const instant = v.nullable(v.pipe(v.number(), v.safeInteger(), v.minValue(0)));
const unique = (a: readonly string[]) => new Set(a).size === a.length;
const caps = v.strictObject({
  generation: v.optional(v.boolean(), false),
  answer: v.optional(v.boolean(), false),
  metadata: v.optional(v.boolean(), false),
  excerpt: v.optional(v.literal(false), false),
  image: v.optional(v.literal(false), false),
  download: v.optional(v.literal(false), false),
  processor_profiles: v.optional(
    v.pipe(
      v.array(key),
      v.maxLength(20),
      v.check((a) => unique(a)),
    ),
    [],
  ),
});
const validInterval = (x: {
  valid_from_ms: number | null;
  valid_until_ms: number | null;
}) =>
  x.valid_from_ms === null ||
  x.valid_until_ms === null ||
  x.valid_until_ms > x.valid_from_ms;
const grant = v.pipe(
  v.strictObject({
    user_id: uuid,
    capabilities: caps,
    valid_from_ms: instant,
    valid_until_ms: instant,
  }),
  v.check((x) => validInterval(x)),
);
const source = v.pipe(
  v.strictObject({
    source_id: key,
    source_version: hash,
    evidence_versions: v.pipe(
      v.array(hash),
      v.minLength(1),
      v.maxLength(50000),
      v.check((a) => unique(a)),
    ),
    state: v.picklist(["active", "revoked"]),
    valid_from_ms: instant,
    valid_until_ms: instant,
    rights: caps,
    grants: v.pipe(
      v.array(grant),
      v.maxLength(32),
      v.check((a) => unique(a.map((g) => g.user_id))),
    ),
  }),
  v.check((x) => validInterval(x)),
);
const inputShape = v.strictObject({
  schema_version: v.literal(1),
  scope: v.literal("private-operator-research"),
  sources: v.pipe(
    v.array(source),
    v.minLength(1),
    v.maxLength(32),
    v.check((a) => unique(a.map((s) => s.source_id))),
    v.check(
      (a) =>
        a.reduce((n, s) => n + s.evidence_versions.length, 0) <=
        MAX_RESEARCH_POLICY_EVIDENCE,
    ),
  ),
});
const documentShape = v.strictObject({
  ...inputShape.entries,
  corpus_version: hash,
});
/** No text, images, local paths, emails, credentials or arbitrary capability fields are accepted. */
export type ResearchSourcePolicyInput = v.InferInput<typeof inputShape>;
export type ResearchSourcePolicyDocument = v.InferOutput<typeof documentShape>;
/** Format/identity evidence only, never operator consent or source/provider permission. */
export interface PreparedResearchSourcePolicy {
  readonly corpusVersion: string;
  readonly policyJson: string;
  readonly policySha256: string;
}
const sha = (bytes: string) =>
  createHash("sha256").update(bytes, "utf8").digest("hex");
function fail(): never {
  throw Error(RESEARCH_SOURCE_ERROR);
}
const sortKeys = <T>(values: readonly T[], key: (v: T) => string) =>
  [...values].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
/** Derive the corpus identity only from exact registered source/evidence tuples; permissions are separate. */
export function prepareResearchSourcePolicy(
  value: ResearchSourcePolicyInput,
): PreparedResearchSourcePolicy {
  try {
    const parsed = v.parse(inputShape, value);
    const sources = sortKeys(parsed.sources, (s) => s.source_id).map((s) => ({
      ...s,
      evidence_versions: [...s.evidence_versions].sort(),
      rights: {
        ...s.rights,
        processor_profiles: [...s.rights.processor_profiles].sort(),
      },
      grants: sortKeys(s.grants, (g) => g.user_id).map((g) => ({
        ...g,
        capabilities: {
          ...g.capabilities,
          processor_profiles: [...g.capabilities.processor_profiles].sort(),
        },
      })),
    }));
    const corpusVersion = sha(
      JSON.stringify([
        "magickli-research-corpus-evidence-v1",
        sources.map((s) => [
          s.source_id,
          s.source_version,
          s.evidence_versions,
        ]),
      ]),
    );
    const policyJson = JSON.stringify({
      schema_version: 1,
      scope: "private-operator-research",
      sources,
      corpus_version: corpusVersion,
    });
    if (Buffer.byteLength(policyJson, "utf8") > MAX_RESEARCH_POLICY_BYTES)
      fail();
    return Object.freeze({
      corpusVersion,
      policyJson,
      policySha256: sha(policyJson),
    });
  } catch {
    return fail();
  }
}
/** Decode owned canonical bytes and validate both permission and corpus identities. No persisted record is trusted by hash alone. */
export function readResearchSourcePolicy(
  policyJson: string,
  policySha256: string,
  corpusVersion: string,
): ResearchSourcePolicyDocument {
  try {
    if (
      typeof policyJson !== "string" ||
      Buffer.byteLength(policyJson, "utf8") > MAX_RESEARCH_POLICY_BYTES ||
      sha(policyJson) !== v.parse(hash, policySha256)
    )
      fail();
    const document = v.parse(documentShape, JSON.parse(policyJson));
    const prepared = prepareResearchSourcePolicy({
      schema_version: document.schema_version,
      scope: document.scope,
      sources: document.sources,
    });
    if (
      prepared.policyJson !== policyJson ||
      prepared.policySha256 !== policySha256 ||
      prepared.corpusVersion !== v.parse(hash, corpusVersion) ||
      document.corpus_version !== corpusVersion
    )
      fail();
    return document;
  } catch {
    return fail();
  }
}
const maximum = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : Math.max(a, b);
const minimum = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : Math.min(a, b);
/** Map EVERY requested tuple, including uncited history; absence never silently narrows the influence union. */
export function researchPolicySnapshot(
  document: ResearchSourcePolicyDocument,
  subject: ResearchSourceSubject,
  context: ResearchSourceContext,
  revision: string,
): ResearchSourceSnapshot {
  try {
    if (document.corpus_version !== context.corpus_version) fail();
    return {
      subject: structuredClone(subject),
      corpus_version: document.corpus_version,
      authorization_version: revision,
      publication_state: "published",
      sources: context.bindings.map((binding) => {
        const source = document.sources.find(
          (s) => s.source_id === binding.source_id,
        );
        if (
          !source ||
          source.source_version !== binding.source_version ||
          !source.evidence_versions.includes(binding.evidence_version)
        )
          fail();
        const grant = source.grants.find((g) => g.user_id === subject.user_id);
        return {
          binding: structuredClone(binding),
          state: source.state,
          valid_from_ms: maximum(
            source.valid_from_ms,
            grant?.valid_from_ms ?? null,
          ),
          valid_until_ms: minimum(
            source.valid_until_ms,
            grant?.valid_until_ms ?? null,
          ),
          rights: structuredClone(source.rights),
          grants: grant
            ? structuredClone(grant.capabilities)
            : v.parse(caps, {}),
        };
      }),
    };
  } catch {
    return fail();
  }
}
