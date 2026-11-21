import { expect, it, vi } from "vitest";
import { prepareResearchMaintenanceTarget } from "./maintenanceTarget";
import { RESEARCH_MODEL_ID, RESEARCH_PROCESSOR_PROFILE } from "./modelRequest";
import {
  prepareResearchRetentionProfile,
  type ResearchRetentionProfileInput,
  readResearchRetentionProfile,
} from "./retentionProfile";

vi.mock("server-only", () => ({}));
const original = (): ResearchRetentionProfileInput => ({
  schema_version: 1,
  kind: "private-research-retention",
  scope: {
    windowId: "019ba96c-1000-7000-8000-000000000001",
    approvalSha256: "a".repeat(64),
    actorId: "019ba96c-1000-7000-8000-000000000002",
    corpusVersion: "b".repeat(64),
    model: RESEARCH_MODEL_ID,
    processorProfile: RESEARCH_PROCESSOR_PROFILE,
    beginsAtMs: 1790000000000,
    expiresAtMs: 1790000060000,
    maxRequests: 10,
    perRequestPico: 350000000000,
    totalPico: 3500000000000,
  },
  storage: { schemaName: "research_packets" },
  maintenance_schema: "research_maintenance",
  artifact_table_oid: 1234,
  runtime: {
    worker_sha256: "c".repeat(64),
    node_sha256: "d".repeat(64),
    input_inventory_sha256: "e".repeat(64),
  },
  packet_retention_ms: 2 * 86400000,
  purge_lag_ms: 6 * 3600000,
  cadence_ms: 6 * 3600000,
  stale_after_ms: 7 * 3600000,
  batch_size: 100,
  cleanup_scope: "all-expired-packets-in-physical-artifact-namespace",
  stop: "native-all-windows-closed-and-all-payloads-purged",
});
it("binds canonical immutable cleanup facts to their own digest without generating new dates or IDs", () => {
  const value = original(),
    p = prepareResearchRetentionProfile(value),
    parsed = JSON.parse(p.document_json);
  expect(parsed.scope).toEqual(value.scope);
  expect(parsed.runtime).toEqual(value.runtime);
  expect(p.target).toEqual(
    prepareResearchMaintenanceTarget({
      scope: value.scope,
      storage: value.storage,
      maintenanceSchema: value.maintenance_schema,
      artifactTableOid: value.artifact_table_oid,
      profileSha256: p.document_sha256,
    }),
  );
  (value.scope as { expiresAtMs: number }).expiresAtMs += 1;
  (value.runtime as { worker_sha256: string }).worker_sha256 = "f".repeat(64);
  expect(p.runtime.worker_sha256).toBe("c".repeat(64));
  expect(p.target.publicationCutoffMs).toBe(parsed.scope.expiresAtMs);
  expect(
    readResearchRetentionProfile(p.document_json, p.document_sha256),
  ).toEqual(p);
  expect(Object.isFrozen(p.runtime)).toBe(true);
});
it("cleanup remains parseable after the original window/calendar horizon; parsing creates no seed or authority", () => {
  const p = prepareResearchRetentionProfile(original());
  vi.useFakeTimers();
  try {
    vi.setSystemTime(p.target.coverageThroughMs + 86400000);
    expect(
      readResearchRetentionProfile(p.document_json, p.document_sha256),
    ).toEqual(p);
  } finally {
    vi.useRealTimers();
  }
});
it.each([
  { packet_retention_ms: 31 * 86400000 },
  { purge_lag_ms: 0 },
  { cadence_ms: 7200000 },
  { stale_after_ms: 86400000 },
  { batch_size: 101 },
  { cleanup_scope: "only-original-window" },
  { stop: "at-coverage-horizon" },
  { runtime: { ...original().runtime, worker_sha256: "0".repeat(63) + "\n" } },
  { runtime: { ...original().runtime, extra: true } },
  { extra: true },
  { artifact_table_oid: 0 },
  { maintenance_schema: "public\n" },
])("refuses protocol drift or unsafe target %j", (change) => {
  expect(() =>
    prepareResearchRetentionProfile({
      ...original(),
      ...change,
    } as unknown as ResearchRetentionProfileInput),
  ).toThrow("Private research cleanup profile unavailable");
});
it("requires independently supplied digest and exact canonical bytes, with no self-attested field", () => {
  const p = prepareResearchRetentionProfile(original());
  for (const json of [
    p.document_json + "\n",
    JSON.stringify(JSON.parse(p.document_json), null, 2),
    JSON.stringify({
      ...JSON.parse(p.document_json),
      adopted_sha256: p.document_sha256,
    }),
    "{}",
    " ".repeat(8193),
  ]) {
    expect(() =>
      readResearchRetentionProfile(json, p.document_sha256),
    ).toThrow();
  }
  for (const hash of ["a".repeat(64), p.document_sha256 + "\n", ""])
    expect(() => readResearchRetentionProfile(p.document_json, hash)).toThrow();
});
it("changes identity when any byte-bound code or target fact changes", () => {
  const a = original(),
    b = {
      ...original(),
      runtime: { ...original().runtime, worker_sha256: "f".repeat(64) },
    };
  const p = prepareResearchRetentionProfile(a),
    q = prepareResearchRetentionProfile(b);
  expect(q.document_sha256).not.toBe(p.document_sha256);
  expect(q.target.targetSha256).not.toBe(p.target.targetSha256);
  expect(() =>
    readResearchRetentionProfile(q.document_json, p.document_sha256),
  ).toThrow();
});
it("maximally escaped bounded scope metadata still fits the frozen input byte allowance", () => {
  const p = original(),
    maximum = {
      ...p,
      scope: {
        ...p.scope,
        model: "\0".repeat(128),
        processorProfile: "a".repeat(128),
      },
      storage: { schemaName: "a".repeat(63) },
      maintenance_schema: "b".repeat(63),
    };
  const prepared = prepareResearchRetentionProfile(maximum);
  expect(Buffer.byteLength(prepared.document_json)).toBeLessThan(8192);
  expect(
    readResearchRetentionProfile(
      prepared.document_json,
      prepared.document_sha256,
    ),
  ).toEqual(prepared);
});
