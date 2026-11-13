/** Inactive cleanup-profile compiler. Preparing/parsing data never supplies independent operator adoption. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import { parseBoundedResearchJson } from "./boundedJson";
import {
  prepareResearchMaintenanceTarget,
  RESEARCH_MAINTENANCE_STALE_MS,
  RESEARCH_PACKET_PURGE_LAG_MS,
  type ResearchMaintenanceTargetInput,
} from "./maintenanceTarget";
import { RESEARCH_ARTIFACT_RETENTION_MS } from "./requestArtifact";

export const RESEARCH_RETENTION_PROFILE_ERROR =
  "Private research cleanup profile unavailable";
export const RESEARCH_RETENTION_CADENCE_MS = 3600000;
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const runtimeShape = v.strictObject({
  worker_sha256: hash,
  node_sha256: hash,
  input_inventory_sha256: hash,
});
const shape = v.strictObject({
  schema_version: v.literal(1),
  kind: v.literal("private-research-retention"),
  scope: v.unknown(),
  storage: v.unknown(),
  maintenance_schema: v.string(),
  artifact_table_oid: v.number(),
  runtime: runtimeShape,
  packet_retention_ms: v.literal(RESEARCH_ARTIFACT_RETENTION_MS),
  purge_lag_ms: v.literal(RESEARCH_PACKET_PURGE_LAG_MS),
  cadence_ms: v.literal(RESEARCH_RETENTION_CADENCE_MS),
  stale_after_ms: v.literal(RESEARCH_MAINTENANCE_STALE_MS),
  batch_size: v.literal(100),
  cleanup_scope: v.literal(
    "all-expired-packets-in-physical-artifact-namespace",
  ),
  stop: v.literal("native-all-windows-closed-and-all-payloads-purged"),
});
/** Canonical source-free cleanup facts only; private profile files remain outside Git. No provider/source/read capability. */
export interface ResearchRetentionProfileInput {
  readonly schema_version: 1;
  readonly kind: "private-research-retention";
  readonly scope: ResearchMaintenanceTargetInput["scope"];
  readonly storage: NonNullable<ResearchMaintenanceTargetInput["storage"]>;
  readonly maintenance_schema: string;
  readonly artifact_table_oid: number;
  readonly runtime: Readonly<v.InferOutput<typeof runtimeShape>>;
  readonly packet_retention_ms: typeof RESEARCH_ARTIFACT_RETENTION_MS;
  readonly purge_lag_ms: typeof RESEARCH_PACKET_PURGE_LAG_MS;
  readonly cadence_ms: typeof RESEARCH_RETENTION_CADENCE_MS;
  readonly stale_after_ms: typeof RESEARCH_MAINTENANCE_STALE_MS;
  readonly batch_size: 100;
  readonly cleanup_scope: "all-expired-packets-in-physical-artifact-namespace";
  readonly stop: "native-all-windows-closed-and-all-payloads-purged";
}
/** Deterministic owned bytes; the profile's digest becomes its ledger identity without a circular hash field. */
export function prepareResearchRetentionProfile(
  input: ResearchRetentionProfileInput,
) {
  try {
    const p = v.parse(shape, input),
      common = {
        scope: p.scope as ResearchMaintenanceTargetInput["scope"],
        storage: p.storage as ResearchMaintenanceTargetInput["storage"],
        maintenanceSchema: p.maintenance_schema,
        artifactTableOid: p.artifact_table_oid,
      },
      normalized = prepareResearchMaintenanceTarget({
        ...common,
        profileSha256: "0".repeat(64),
      }),
      document = {
        schema_version: p.schema_version,
        kind: p.kind,
        scope: normalized.scope,
        storage: normalized.storage,
        maintenance_schema: normalized.maintenanceSchema,
        artifact_table_oid: normalized.artifactTableOid,
        runtime: { ...p.runtime },
        packet_retention_ms: p.packet_retention_ms,
        purge_lag_ms: p.purge_lag_ms,
        cadence_ms: p.cadence_ms,
        stale_after_ms: p.stale_after_ms,
        batch_size: p.batch_size,
        cleanup_scope: p.cleanup_scope,
        stop: p.stop,
      },
      json = JSON.stringify(document);
    // Every emitted field has a fixed scalar/length bound; untrusted JSON input is separately capped at8KiB.
    const digest = createHash("sha256").update(json).digest("hex");
    return Object.freeze({
      document_json: json,
      document_sha256: digest,
      runtime: Object.freeze({ ...p.runtime }),
      target: prepareResearchMaintenanceTarget({
        scope: normalized.scope,
        storage: normalized.storage,
        maintenanceSchema: normalized.maintenanceSchema,
        artifactTableOid: normalized.artifactTableOid,
        profileSha256: digest,
      }),
    });
  } catch {
    throw Error(RESEARCH_RETENTION_PROFILE_ERROR);
  }
}
/** Require an independently adopted digest and exact canonical bytes; this parser does not establish that adoption. */
export function readResearchRetentionProfile(
  json: string,
  independentlyAdoptedSha256: string,
) {
  try {
    const p = prepareResearchRetentionProfile(
      parseBoundedResearchJson(json, 8192) as ResearchRetentionProfileInput,
    );
    if (
      json !== p.document_json ||
      p.document_sha256 !== v.parse(hash, independentlyAdoptedSha256)
    )
      throw Error();
    return p;
  } catch {
    throw Error(RESEARCH_RETENTION_PROFILE_ERROR);
  }
}
