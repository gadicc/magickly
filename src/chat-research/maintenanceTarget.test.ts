import { expect, it, vi } from "vitest";
import { createUuidV7 } from "../lib/ids";
import {
  prepareResearchMaintenanceTarget,
  RESEARCH_MAINTENANCE_ERROR,
  RESEARCH_PACKET_PURGE_LAG_MS,
  type ResearchMaintenanceTargetInput,
} from "./maintenanceTarget";
import { RESEARCH_ARTIFACT_RETENTION_MS } from "./requestArtifact";

vi.mock("server-only", () => ({}));
function fixture(): ResearchMaintenanceTargetInput {
  return {
    profileSha256: "a".repeat(64),
    artifactTableOid: 12345,
    maintenanceSchema: "private_maintenance",
    scope: {
      windowId: createUuidV7(),
      approvalSha256: "b".repeat(64),
      actorId: createUuidV7(),
      corpusVersion: "c".repeat(64),
      model: "synthetic-model",
      processorProfile: "synthetic_profile",
      beginsAtMs: 1000,
      expiresAtMs: 3601000,
      maxRequests: 10,
      perRequestPico: 100,
      totalPico: 1000,
    },
  };
}
it("derives coverage from the exact publication cutoff and owns canonical settings without minting dates/IDs", () => {
  const input = fixture(),
    target = prepareResearchMaintenanceTarget(input),
    expected =
      input.scope.expiresAtMs +
      RESEARCH_ARTIFACT_RETENTION_MS +
      RESEARCH_PACKET_PURGE_LAG_MS;
  expect(target.coverageThroughMs).toBe(expected);
  expect(target.publicationCutoffMs).toBe(input.scope.expiresAtMs);
  expect(
    prepareResearchMaintenanceTarget({
      ...input,
      storage: { schemaName: "public" },
    }),
  ).toEqual(target);
  const before = target.targetSha256;
  (input.scope as { windowId: string }).windowId = createUuidV7();
  expect(target.targetSha256).toBe(before);
  expect(target.scope.windowId).not.toBe(input.scope.windowId);
  expect(Object.isFrozen(target.scope)).toBe(true);
});
it("every actual target/scope field influences the descriptor and independent profiles cannot borrow it", () => {
  const input = fixture(),
    base = prepareResearchMaintenanceTarget(input);
  for (const change of [
    { profileSha256: "d".repeat(64) },
    { artifactTableOid: 12346 },
    { maintenanceSchema: "other" },
    { storage: { schemaName: "other" } },
    { scope: { ...input.scope, windowId: createUuidV7() } },
    { scope: { ...input.scope, approvalSha256: "e".repeat(64) } },
    { scope: { ...input.scope, actorId: createUuidV7() } },
    { scope: { ...input.scope, corpusVersion: "f".repeat(64) } },
    { scope: { ...input.scope, model: "other" } },
    { scope: { ...input.scope, processorProfile: "other" } },
    { scope: { ...input.scope, beginsAtMs: 999 } },
    { scope: { ...input.scope, expiresAtMs: 3601001 } },
    { scope: { ...input.scope, maxRequests: 9 } },
    { scope: { ...input.scope, perRequestPico: 99 } },
    { scope: { ...input.scope, totalPico: 999 } },
  ])
    expect(
      prepareResearchMaintenanceTarget({ ...input, ...change }).targetSha256,
    ).not.toBe(base.targetSha256);
});
it.each([0, -1, 4294967296, NaN, Infinity, 1.5])(
  "refuses invalid physical artifact OID %s",
  (artifactTableOid) => {
    expect(() =>
      prepareResearchMaintenanceTarget({ ...fixture(), artifactTableOid }),
    ).toThrow(RESEARCH_MAINTENANCE_ERROR);
  },
);
it.each(["public\n", "pg_temp", "information_schema", "bad-name", ""])(
  "refuses noncanonical maintenance namespace %s",
  (maintenanceSchema) => {
    expect(() =>
      prepareResearchMaintenanceTarget({ ...fixture(), maintenanceSchema }),
    ).toThrow(RESEARCH_MAINTENANCE_ERROR);
  },
);
it("refuses unsupported configuration, malformed profiles and unsafe/unrepresentable coverage", () => {
  const input = fixture();
  for (const change of [
    { extra: true },
    { profileSha256: "bad" },
    { scope: { ...input.scope, expiresAtMs: 1000 } },
  ])
    expect(() =>
      prepareResearchMaintenanceTarget({
        ...input,
        ...change,
      } as ResearchMaintenanceTargetInput),
    ).toThrow(RESEARCH_MAINTENANCE_ERROR);
  for (const cutoff of [
    Number.MAX_SAFE_INTEGER - 1000,
    8640000000000000 - 1000,
  ])
    expect(() =>
      prepareResearchMaintenanceTarget({
        ...input,
        scope: {
          ...input.scope,
          beginsAtMs: cutoff - 60000,
          expiresAtMs: cutoff,
        },
      }),
    ).toThrow(RESEARCH_MAINTENANCE_ERROR);
});
