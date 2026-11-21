/** Prospective policy business bounds; imports no DB, schema, loader or credentials. */
import { expect, it, vi } from "vitest";
import { RESEARCH_ARTIFACT_RETENTION_MS } from "./artifactRetention";
import {
  prepareResearchMaintenanceTarget,
  RESEARCH_MAINTENANCE_STALE_MS,
  RESEARCH_PACKET_PURGE_LAG_MS,
} from "./maintenanceTarget";
import { publicationFixture } from "./publication.fixture";
import {
  prepareResearchReadEnvelope,
  RESEARCH_MAX_READ_WINDOW_MS,
} from "./readAdoption";
import { RESEARCH_RETENTION_CADENCE_MS } from "./retentionProfile";

vi.mock("server-only", () => ({}));
it("keeps the short pilot's access, storage, schedule and health clocks distinct", () => {
  expect(RESEARCH_ARTIFACT_RETENTION_MS).toBe(172800000);
  expect(RESEARCH_MAX_READ_WINDOW_MS).toBe(172800000);
  expect(RESEARCH_RETENTION_CADENCE_MS).toBe(21600000);
  expect(RESEARCH_PACKET_PURGE_LAG_MS).toBe(21600000);
  expect(RESEARCH_MAINTENANCE_STALE_MS).toBe(25200000);
  const f = publicationFixture();
  const target = prepareResearchMaintenanceTarget({
    scope: f.scope,
    storage: f.retentionInput.storage,
    maintenanceSchema: f.retentionInput.maintenance_schema,
    artifactTableOid: f.retentionInput.artifact_table_oid,
    profileSha256: "a".repeat(64),
  });
  expect(target.coverageThroughMs - target.publicationCutoffMs).toBe(194400000);
  expect(() =>
    prepareResearchReadEnvelope({
      ...f.readInput,
      read_until_ms: f.scope.beginsAtMs + 172800001,
    }),
  ).toThrow();
});
