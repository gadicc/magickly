/** Inactive managed-runtime cleanup format. It does not adopt a deployment or weaken local binary pins. */
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
import {
  RESEARCH_RETENTION_CADENCE_MS,
  type ResearchRetentionProfileInput,
} from "./retentionProfile";

export const RESEARCH_MANAGED_RETENTION_ERROR =
  "Private managed cleanup profile unavailable";
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const runtime = v.strictObject({
  platform: v.literal("vercel"),
  node_major: v.literal(22),
  region: v.literal("lhr1"),
  worker_artifact_sha256: hash,
  dependency_lock_sha256: hash,
  critical_inputs_sha256: hash,
  project_scope_sha256: hash,
  custody_contract: v.literal("independently-reviewed-protected-release"),
});
const shape = v.strictObject({
  schema_version: v.literal(2),
  kind: v.literal("private-research-managed-retention"),
  scope: v.unknown(),
  storage: v.unknown(),
  maintenance_schema: v.string(),
  artifact_table_oid: v.number(),
  runtime,
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
/** Private data-only profile. Artifact/source hashes are release identity, never proof of a Node binary or runtime custody. */
export interface ResearchManagedRetentionProfileInput
  extends Omit<
    ResearchRetentionProfileInput,
    "schema_version" | "kind" | "runtime"
  > {
  readonly schema_version: 2;
  readonly kind: "private-research-managed-retention";
  readonly runtime: Readonly<v.InferInput<typeof runtime>>;
}
/**
 * Prepare a separately versioned target without deployment IDs in its digest.
 * Independent adoption must bind the actual protected project/release, code and
 * maintained Node policy. Parsing alone supplies no consent, scheduler, health,
 * connection, source permission or provider allowance. Existing local readers
 * deliberately do not accept this format; hosted publication/ingress is separate.
 */
export function prepareResearchManagedRetentionProfile(
  value: ResearchManagedRetentionProfileInput,
) {
  try {
    const p = v.parse(shape, value),
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
        ...p,
        scope: normalized.scope,
        storage: normalized.storage,
        maintenance_schema: normalized.maintenanceSchema,
        runtime: { ...p.runtime },
      },
      json = JSON.stringify(document);
    // Fixed scalar bounds and normalized scope keep emitted JSON below the8KiB input cap.
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
    throw Error(RESEARCH_MANAGED_RETENTION_ERROR);
  }
}
/** Require exact canonical bytes and an independently supplied digest; no self-attested adoption fields. */
export function readResearchManagedRetentionProfile(
  json: string,
  independentlyAdoptedSha256: string,
) {
  try {
    const p = prepareResearchManagedRetentionProfile(
      parseBoundedResearchJson(
        json,
        8192,
      ) as ResearchManagedRetentionProfileInput,
    );
    if (
      json !== p.document_json ||
      p.document_sha256 !== v.parse(hash, independentlyAdoptedSha256)
    )
      throw Error();
    return p;
  } catch {
    throw Error(RESEARCH_MANAGED_RETENTION_ERROR);
  }
}
