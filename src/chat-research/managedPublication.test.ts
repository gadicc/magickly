/** Synthetic configuration only; no identities, credentials, deployment, SQL or model calls. */
import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import {
  prepareResearchManagedRetentionProfile,
  type ResearchManagedRetentionProfileInput,
} from "./managedRetentionProfile";
import {
  inspectResearchManagedPublication,
  inspectResearchPublication,
  type PreparedResearchManagedPublication,
  type PreparedResearchPublication,
  prepareResearchManagedPublication,
  prepareResearchPublication,
  RESEARCH_PUBLICATION_ERROR,
} from "./publication";
import { publicationFixture } from "./publication.fixture";
import { prepareResearchSourcePolicy } from "./sourcePolicy";

vi.mock("server-only", () => ({}));
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
function fixture() {
  const f = publicationFixture(),
    profileInput: ResearchManagedRetentionProfileInput = {
      ...f.retentionInput,
      schema_version: 2,
      kind: "private-research-managed-retention",
      runtime: {
        platform: "vercel",
        node_major: 22,
        region: "lhr1",
        worker_artifact_sha256: "1".repeat(64),
        dependency_lock_sha256: "2".repeat(64),
        critical_inputs_sha256: "3".repeat(64),
        project_scope_sha256: "4".repeat(64),
        custody_contract: "independently-reviewed-protected-release",
      },
    },
    profile = prepareResearchManagedRetentionProfile(profileInput);
  return {
    ...f,
    profile,
    profileInput,
    managedInput: {
      ...f.input,
      retentionProfileJson: profile.document_json,
      retentionProfileSha256: profile.document_sha256,
    },
  };
}
it("binds the managed runtime into a distinct publication without changing the budget/read/source scope", () => {
  const f = fixture(),
    local = prepareResearchPublication(f.input),
    managed = prepareResearchManagedPublication(f.managedInput),
    facts = inspectResearchManagedPublication(managed),
    doc = JSON.parse(facts.document_json);
  expect(doc).toMatchObject({
    schema_version: 2,
    kind: "private-operator-managed-window-publication",
    runtime: f.profile.runtime,
    scope: f.scope,
    retention_profile_sha256: f.profile.document_sha256,
    source_count: 3,
    evidence_count: 6,
  });
  expect(doc.runtime).not.toHaveProperty("node_sha256");
  expect(managed.kind).toBe("prepared_private_research_managed_publication");
  expect(Object.isFrozen(managed)).toBe(true);
  expect(managed.sha256).toBe(sha(facts.document_json));
  expect(managed.sha256).not.toBe(local.sha256);
  expect(managed.sha256).not.toBe(f.scope.approvalSha256);
  expect(facts.target).toEqual(f.profile.target);
  expect(facts.read_envelope_json).toBe(f.input.readEnvelopeJson);
  expect(facts.source_policy_json).toBe(f.input.sourcePolicyJson);
  expect(prepareResearchManagedPublication(f.managedInput).sha256).toBe(
    managed.sha256,
  );
});
it("does not let either runtime format or genuine opaque handle cross into the other publication path", () => {
  const f = fixture(),
    local = prepareResearchPublication(f.input),
    managed = prepareResearchManagedPublication(f.managedInput);
  expect(() => prepareResearchPublication(f.managedInput)).toThrow(
    RESEARCH_PUBLICATION_ERROR,
  );
  expect(() => prepareResearchManagedPublication(f.input)).toThrow(
    RESEARCH_PUBLICATION_ERROR,
  );
  expect(() =>
    inspectResearchPublication(
      managed as unknown as PreparedResearchPublication,
    ),
  ).toThrow(RESEARCH_PUBLICATION_ERROR);
  expect(() =>
    inspectResearchManagedPublication(
      local as unknown as PreparedResearchManagedPublication,
    ),
  ).toThrow(RESEARCH_PUBLICATION_ERROR);
  for (const forged of [
    JSON.parse(JSON.stringify(managed)),
    { ...managed },
    Object.create(managed),
    null,
  ]) {
    expect(() => inspectResearchManagedPublication(forged)).toThrow(
      RESEARCH_PUBLICATION_ERROR,
    );
  }
});
it("owns inputs and inspected facts", () => {
  const f = fixture(),
    p = prepareResearchManagedPublication(f.managedInput),
    first = inspectResearchManagedPublication(p);
  f.sourceStorage.schemaName = "changed";
  first.source_policy.sources[0].state = "revoked";
  const second = inspectResearchManagedPublication(p);
  expect(second.source_storage.schemaName).toBe("synthetic_policy");
  expect(second.source_policy.sources[0].state).toBe("active");
});
it.each([
  "worker_artifact_sha256",
  "dependency_lock_sha256",
  "critical_inputs_sha256",
  "project_scope_sha256",
] as const)(
  "binds changed managed %s without claiming execution or adoption",
  (key) => {
    const f = fixture(),
      p = prepareResearchManagedPublication(f.managedInput),
      changed = prepareResearchManagedRetentionProfile({
        ...f.profileInput,
        runtime: { ...f.profileInput.runtime, [key]: "f".repeat(64) },
      }),
      q = prepareResearchManagedPublication({
        ...f.managedInput,
        retentionProfileJson: changed.document_json,
        retentionProfileSha256: changed.document_sha256,
      });
    expect(q.sha256).not.toBe(p.sha256);
    expect(inspectResearchManagedPublication(q).target.targetSha256).not.toBe(
      inspectResearchManagedPublication(p).target.targetSha256,
    );
  },
);
it.each(["sourcePolicy", "retentionProfile", "readEnvelope"] as const)(
  "rejects noncanonical or substituted managed %s child",
  (prefix) => {
    const f = fixture(),
      key = `${prefix}Json` as
        | "sourcePolicyJson"
        | "retentionProfileJson"
        | "readEnvelopeJson";
    expect(() =>
      prepareResearchManagedPublication({
        ...f.managedInput,
        [`${prefix}Sha256`]: "0".repeat(64),
      }),
    ).toThrow(RESEARCH_PUBLICATION_ERROR);
    const text = f.managedInput[key] + "\n";
    expect(() =>
      prepareResearchManagedPublication({
        ...f.managedInput,
        [key]: text,
        [`${prefix}Sha256`]: sha(text),
      }),
    ).toThrow(RESEARCH_PUBLICATION_ERROR);
  },
);
it("retains source and duplicate-scope refusals", () => {
  const f = fixture();
  f.policy.sources[0].state = "revoked";
  const revoked = prepareResearchSourcePolicy(f.policy);
  expect(() =>
    prepareResearchManagedPublication({
      ...f.managedInput,
      sourcePolicyJson: revoked.policyJson,
      sourcePolicySha256: revoked.policySha256,
    }),
  ).toThrow(RESEARCH_PUBLICATION_ERROR);
  const drift = prepareResearchManagedRetentionProfile({
    ...f.profileInput,
    scope: { ...f.scope, approvalSha256: "f".repeat(64) },
  });
  expect(() =>
    prepareResearchManagedPublication({
      ...f.managedInput,
      retentionProfileJson: drift.document_json,
      retentionProfileSha256: drift.document_sha256,
    }),
  ).toThrow(RESEARCH_PUBLICATION_ERROR);
});

// Captured from the unmodified compiler at 1fd564d5, then compared byte-for-byte
// through the same fixture/test harness. A managed-format change cannot relabel local approvals.
it("preserves the pre-managed local canonical publication digest", () => {
  expect(prepareResearchPublication(publicationFixture().input).sha256).toBe(
    "9f17b40f81a92bf0fbc2c28ae817d74feef425165b61f007dc4a7752360a8d09",
  );
});
