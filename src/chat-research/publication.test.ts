/** Pure synthetic compatibility checks. No policy, read scope, cleanup profile or provider is adopted or installed. */
import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import {
  inspectResearchPublication,
  type PreparedResearchPublication,
  prepareResearchPublication,
  RESEARCH_PUBLICATION_ERROR,
} from "./publication";
import { publicationFixture } from "./publication.fixture";
import { prepareResearchReadEnvelope } from "./readAdoption";
import { prepareResearchRetentionProfile } from "./retentionProfile";
import { POLICY_OTHER, sourcePolicyFixture } from "./sourcePolicy.fixture";

vi.mock("server-only", () => ({}));
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
it("binds canonical policy, profile, read scope and actual-target facts without creating dates, IDs or consent", () => {
  const f = publicationFixture(),
    p = prepareResearchPublication(f.input),
    facts = inspectResearchPublication(p),
    doc = JSON.parse(facts.document_json);
  expect(Object.isFrozen(p)).toBe(true);
  expect(p.sha256).toBe(sha(facts.document_json));
  expect(facts.document_sha256).toBe(p.sha256);
  expect(doc).toMatchObject({
    kind: "private-operator-first-window-publication",
    scope: f.scope,
    source_storage: f.sourceStorage,
    accounting_storage: f.retentionInput.storage,
    source_policy_sha256: f.source.policySha256,
    retention_profile_sha256: f.input.retentionProfileSha256,
    read_envelope_sha256: f.input.readEnvelopeSha256,
    source_count: 3,
    evidence_count: 6,
    artifact_table_oid: 1234,
  });
  expect(facts.source_policy_json).toBe(f.input.sourcePolicyJson);
  expect(facts.retention_profile_json).toBe(f.input.retentionProfileJson);
  expect(facts.read_until_ms).toBe(f.readInput.read_until_ms);
  expect(facts.document_json).not.toContain("synthetic_source_1");
  expect(facts.document_json).not.toContain("sourcePolicyJson");
  expect(prepareResearchPublication(f.input).sha256).toBe(p.sha256);
});
it("keeps the publication digest separate from the existing budget approval identity", () => {
  const f = publicationFixture(),
    p = prepareResearchPublication(f.input);
  expect(p.sha256).not.toBe(f.scope.approvalSha256);
  expect(inspectResearchPublication(p).target.scope.approvalSha256).toBe(
    f.scope.approvalSha256,
  );
});
it("owns inputs and returns copies rather than allowing inspected data to mutate the prepared publication", () => {
  const f = publicationFixture(),
    p = prepareResearchPublication(f.input),
    first = inspectResearchPublication(p);
  f.sourceStorage.schemaName = "replaced";
  first.source_policy.sources[0].state = "revoked";
  (first.target.scope as { actorId: string }).actorId = POLICY_OTHER;
  const second = inspectResearchPublication(p);
  expect(second.source_storage.schemaName).toBe("synthetic_policy");
  expect(second.source_policy.sources[0].state).toBe("active");
  expect(second.target.scope.actorId).toBe(f.scope.actorId);
});
it("rejects reconstructed or inherited handle shapes even with the correct public hash", () => {
  const p = prepareResearchPublication(publicationFixture().input);
  for (const forged of [
    JSON.parse(JSON.stringify(p)),
    { ...p },
    Object.create(p),
    null,
  ])
    expect(() =>
      inspectResearchPublication(forged as PreparedResearchPublication),
    ).toThrow(RESEARCH_PUBLICATION_ERROR);
});
it.each(["sourcePolicy", "retentionProfile", "readEnvelope"])(
  "refuses substituted %s hash or noncanonical bytes",
  (prefix) => {
    const f = publicationFixture();
    expect(() =>
      prepareResearchPublication({
        ...f.input,
        [prefix + "Sha256"]: "0".repeat(64),
      }),
    ).toThrow(RESEARCH_PUBLICATION_ERROR);
    const key = (prefix + "Json") as
      | "sourcePolicyJson"
      | "retentionProfileJson"
      | "readEnvelopeJson";
    expect(() =>
      prepareResearchPublication({ ...f.input, [key]: f.input[key] + "\n" }),
    ).toThrow(RESEARCH_PUBLICATION_ERROR);
  },
);
it("does not trust a self-attested grant/unknown option or a substituted source authority", () => {
  const f = publicationFixture();
  for (const change of [
    { adopted: true },
    { sourceStorage: { ...f.sourceStorage, schemaName: "other_policy" } },
    { sourceStorage: { ...f.sourceStorage, authSchemaName: "other_auth" } },
    { sourceStorage: { ...f.sourceStorage, corpusVersion: "f".repeat(64) } },
  ])
    expect(() => prepareResearchPublication({ ...f.input, ...change })).toThrow(
      RESEARCH_PUBLICATION_ERROR,
    );
});
it.each([
  "actorId",
  "windowId",
  "processorProfile",
  "model",
  "beginsAtMs",
  "expiresAtMs",
  "maxRequests",
  "perRequestPico",
  "totalPico",
])(
  "rejects a canonical retained-read envelope for another immutable %s scope",
  (key) => {
    const f = publicationFixture(),
      copy = structuredClone(f.readInput),
      scope = copy.original_scope as unknown as Record<string, string | number>;
    const changes: Record<string, string | number> = {
      actorId: POLICY_OTHER,
      windowId: "019ba96c-1000-7000-8000-000000000099",
      processorProfile: "other",
      model: "other",
      beginsAtMs: 1001,
      expiresAtMs: 3600999,
      maxRequests: 9,
      perRequestPico: 99,
      totalPico: 999,
    };
    scope[key] = changes[key];
    const prepared = prepareResearchReadEnvelope(copy);
    expect(() =>
      prepareResearchPublication({
        ...f.input,
        readEnvelopeJson: prepared.document_json,
        readEnvelopeSha256: prepared.document_sha256,
      }),
    ).toThrow(RESEARCH_PUBLICATION_ERROR);
  },
);
it("rejects another canonical accounting namespace even when its scope matches", () => {
  const f = publicationFixture(),
    copy = {
      ...f.readInput,
      accounting_storage: { schemaName: "other_artifacts" },
    };
  const read = prepareResearchReadEnvelope(copy);
  expect(() =>
    prepareResearchPublication({
      ...f.input,
      readEnvelopeJson: read.document_json,
      readEnvelopeSha256: read.document_sha256,
    }),
  ).toThrow(RESEARCH_PUBLICATION_ERROR);
});
it("rejects a profile for another corpus even when its own canonical hash is correct", () => {
  const f = publicationFixture(),
    input = structuredClone(f.retentionInput);
  (input.scope as { corpusVersion: string }).corpusVersion = "f".repeat(64);
  const profile = prepareResearchRetentionProfile(input);
  expect(() =>
    prepareResearchPublication({
      ...f.input,
      retentionProfileJson: profile.document_json,
      retentionProfileSha256: profile.document_sha256,
    }),
  ).toThrow(RESEARCH_PUBLICATION_ERROR);
});
it.each([
  "revoked",
  "no-grant",
  "other-owner",
  "extra-owner",
  "rights-generation",
  "rights-answer",
  "rights-metadata",
  "grant-generation",
  "grant-answer",
  "grant-metadata",
  "rights-processor",
  "grant-processor",
  "source-from",
  "source-until",
  "grant-from",
  "grant-until",
])(
  "refuses a source that contradicts this sole-operator initial scope: %s",
  (kind) => {
    const policy = sourcePolicyFixture(),
      source = policy.sources[0],
      grant = source.grants[0];
    if (kind === "revoked") source.state = "revoked";
    else if (kind === "no-grant") source.grants = [];
    else if (kind === "other-owner") grant.user_id = POLICY_OTHER;
    else if (kind === "extra-owner")
      source.grants.push({ ...structuredClone(grant), user_id: POLICY_OTHER });
    else if (kind.startsWith("rights-") && kind !== "rights-processor")
      source.rights[kind.slice(7) as "generation" | "answer" | "metadata"] =
        false;
    else if (
      kind.startsWith("grant-") &&
      !["grant-processor", "grant-from", "grant-until"].includes(kind)
    )
      grant.capabilities[
        kind.slice(6) as "generation" | "answer" | "metadata"
      ] = false;
    else if (kind === "rights-processor") source.rights.processor_profiles = [];
    else if (kind === "grant-processor")
      grant.capabilities.processor_profiles = [];
    else if (kind === "source-from") source.valid_from_ms = 1001;
    else if (kind === "source-until")
      source.valid_until_ms = 1000 + 7 * 86400000 - 1;
    else if (kind === "grant-from") grant.valid_from_ms = 1001;
    else if (kind === "grant-until")
      grant.valid_until_ms = 1000 + 7 * 86400000 - 1;
    expect(() =>
      prepareResearchPublication(publicationFixture(policy).input),
    ).toThrow(RESEARCH_PUBLICATION_ERROR);
  },
);
it("accepts exact initial interval boundaries and preserves explicitly proposed extra processor profiles", () => {
  const policy = sourcePolicyFixture();
  for (const s of policy.sources) {
    s.valid_from_ms = 1000;
    s.valid_until_ms = 1000 + 7 * 86400000;
    s.grants[0].valid_from_ms = 1000;
    s.grants[0].valid_until_ms = s.valid_until_ms;
    s.rights.processor_profiles!.push("synthetic_local_prep");
    s.grants[0].capabilities.processor_profiles!.push("synthetic_local_prep");
  }
  const p = prepareResearchPublication(publicationFixture(policy).input);
  expect(
    inspectResearchPublication(p).source_policy.sources[0].rights
      .processor_profiles,
  ).toContain("synthetic_local_prep");
});
it("binds a full32-source synthetic registry without embedding its policy/evidence lists in the small manifest", () => {
  const policy = sourcePolicyFixture(),
    base = policy.sources[0];
  policy.sources = Array.from({ length: 32 }, (_, i) => ({
    ...structuredClone(base),
    source_id: "synthetic_" + i,
    source_version: sha("source" + i),
    evidence_versions: [sha("evidence-a" + i), sha("evidence-b" + i)],
  }));
  const facts = inspectResearchPublication(
      prepareResearchPublication(publicationFixture(policy).input),
    ),
    document = JSON.parse(facts.document_json);
  expect(document.source_count).toBe(32);
  expect(document.evidence_count).toBe(64);
  expect(Buffer.byteLength(facts.document_json)).toBeLessThan(8192);
  expect(facts.source_policy.sources).toHaveLength(32);
});
it("pure preparation does not start/renew a stale proposed scope", () => {
  const f = publicationFixture(),
    first = prepareResearchPublication(f.input);
  vi.useFakeTimers();
  try {
    vi.setSystemTime(1900000000000);
    expect(prepareResearchPublication(f.input).sha256).toBe(first.sha256);
    expect(inspectResearchPublication(first).target.scope).toEqual(f.scope);
  } finally {
    vi.useRealTimers();
  }
});
