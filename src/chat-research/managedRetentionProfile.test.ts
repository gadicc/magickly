import { expect, it, vi } from "vitest";
import {
  prepareResearchManagedRetentionProfile as prepare,
  type ResearchManagedRetentionProfileInput,
  readResearchManagedRetentionProfile as read,
} from "./managedRetentionProfile";
import { publicationFixture } from "./publication.fixture";
import {
  prepareResearchRetentionProfile,
  readResearchRetentionProfile,
} from "./retentionProfile";

vi.mock("server-only", () => ({}));
const input = (): ResearchManagedRetentionProfileInput => ({
  ...publicationFixture().retentionInput,
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
});
it("owns canonical managed facts and keeps retention coverage, without relabelling a Node binary", () => {
  const value = input(),
    p = prepare(value),
    legacy = prepareResearchRetentionProfile(
      publicationFixture().retentionInput,
    );
  expect(read(p.document_json, p.document_sha256)).toEqual(p);
  expect(p.target.coverageThroughMs).toBe(legacy.target.coverageThroughMs);
  expect(p.target.profileSha256).toBe(p.document_sha256);
  expect(p.target.targetSha256).not.toBe(legacy.target.targetSha256);
  expect(JSON.parse(p.document_json).runtime).not.toHaveProperty("node_sha256");
  (value.runtime as { worker_artifact_sha256: string }).worker_artifact_sha256 =
    "5".repeat(64);
  (value.scope as { expiresAtMs: number }).expiresAtMs += 1000;
  expect(p.runtime.worker_artifact_sha256).toBe("1".repeat(64));
  expect(p.target.scope.expiresAtMs).toBe(3601000);
  expect(Object.isFrozen(p.runtime)).toBe(true);
  expect(() =>
    readResearchRetentionProfile(p.document_json, p.document_sha256),
  ).toThrow();
  expect(() => read(legacy.document_json, legacy.document_sha256)).toThrow();
});
it.each([
  { schema_version: 1 },
  { kind: "private-research-retention" },
  { packet_retention_ms: 31 * 86400000 },
  { purge_lag_ms: 0 },
  { cadence_ms: 7200000 },
  { stale_after_ms: 86400000 },
  { batch_size: 101 },
  { cleanup_scope: "original-window-only" },
  { stop: "at-horizon" },
  { artifact_table_oid: 0 },
  { maintenance_schema: "public\n" },
  { storage: { schemaName: "bad.namespace" } },
  { scope: { ...input().scope, maxRequests: 0 } },
  { deployment_id: "dpl_not_authority" },
  { adopted: true },
])("refuses protocol or target drift %j", (change) =>
  expect(() =>
    prepare({ ...input(), ...change } as ResearchManagedRetentionProfileInput),
  ).toThrow("Private managed cleanup profile unavailable"),
);
it.each([
  { platform: "other" },
  { node_major: 26 },
  { region: "iad1" },
  { custody_contract: "self-attested" },
  { worker_artifact_sha256: "0".repeat(63) + "\n" },
  { dependency_lock_sha256: "bad" },
  { critical_inputs_sha256: "bad" },
  { project_scope_sha256: "bad" },
  { node_sha256: "1".repeat(64) },
  { deployment_id: "dpl_circular" },
])("rejects unsupported or misleading runtime identity %j", (change) =>
  expect(() =>
    prepare({
      ...input(),
      runtime: { ...input().runtime, ...change },
    } as ResearchManagedRetentionProfileInput),
  ).toThrow(),
);
it("changes target identity with each independently bound artifact/project fact", () => {
  const p = prepare(input());
  for (const key of [
    "worker_artifact_sha256",
    "dependency_lock_sha256",
    "critical_inputs_sha256",
    "project_scope_sha256",
  ]) {
    const q = prepare({
      ...input(),
      runtime: { ...input().runtime, [key]: "f".repeat(64) },
    });
    expect(q.document_sha256).not.toBe(p.document_sha256);
    expect(q.target.targetSha256).not.toBe(p.target.targetSha256);
    expect(() => read(q.document_json, p.document_sha256)).toThrow();
  }
});
it("requires exact bounded canonical bytes and independently adopted hash", () => {
  const p = prepare(input());
  for (const json of [
    p.document_json + "\n",
    JSON.stringify(JSON.parse(p.document_json), null, 2),
    p.document_json.replace(
      '"schema_version":2',
      '"schema_version":2,"schema_version":2',
    ),
    " ".repeat(8193),
    "{}",
  ])
    expect(() => read(json, p.document_sha256)).toThrow();
  for (const sha of ["", "f".repeat(64), p.document_sha256 + "\n"])
    expect(() => read(p.document_json, sha)).toThrow();
});
it("remains parseable after expiry without creating a schedule or renewing the window", () => {
  const p = prepare(input());
  vi.useFakeTimers();
  try {
    vi.setSystemTime(p.target.coverageThroughMs + 86400000);
    expect(read(p.document_json, p.document_sha256)).toEqual(p);
  } finally {
    vi.useRealTimers();
  }
});

it("maximal escaped scope metadata remains within the fixed parser byte bound", () => {
  const value = input(),
    p = prepare({
      ...value,
      scope: {
        ...value.scope,
        model: "\0".repeat(128),
        processorProfile: "a".repeat(128),
      },
      storage: { schemaName: "a".repeat(63) },
      maintenance_schema: "b".repeat(63),
    });
  expect(Buffer.byteLength(p.document_json)).toBeLessThan(8192);
  expect(read(p.document_json, p.document_sha256)).toEqual(p);
});
it("does not re-read caller scope getters when binding the final target", () => {
  const value = input();
  let reads = 0;
  const p = prepare({
    ...value,
    scope: {
      ...value.scope,
      get actorId() {
        reads++;
        return reads === 1
          ? value.scope.actorId
          : "019ba96c-1000-7000-8000-000000000099";
      },
    },
  });
  expect(reads).toBe(1);
  expect(p.target.scope.actorId).toBe(
    JSON.parse(p.document_json).scope.actorId,
  );
});

it("binds the explicit Node24 app profile separately from the prior Node22 profile", () => {
  const original = prepare(input()),
    next = prepare({
      ...input(),
      runtime: { ...input().runtime, node_major: 24 },
    });
  expect(next.document_sha256).not.toBe(original.document_sha256);
  expect(next.target.targetSha256).not.toBe(original.target.targetSha256);
  expect(() => read(next.document_json, original.document_sha256)).toThrow();
  expect(
    read(next.document_json, next.document_sha256).runtime.node_major,
  ).toBe(24);
});
