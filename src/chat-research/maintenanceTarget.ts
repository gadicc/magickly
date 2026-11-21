/** Inactive cleanup-target format. Parsing is not external adoption, source permission or a window/seed writer. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import {
  parseResearchAccountingTarget,
  type ResearchAccountingScope,
  type ResearchAccountingStorage,
} from "./accountingScope";
import { RESEARCH_ARTIFACT_RETENTION_MS } from "./requestArtifact";
import { researchArtifactNamespace } from "./sqlArtifacts";
export const RESEARCH_MAINTENANCE_ERROR =
  "Private research maintenance unavailable";
/** Scheduled sweep opportunity; missed delivery is a health failure, not a TTL extension. */
export const RESEARCH_PACKET_PURGE_LAG_MS = 6 * 3600000;
/** Six-hour cadence plus one hour of delivery grace; checked against the SQL clock. */
export const RESEARCH_MAINTENANCE_STALE_MS = 7 * 3600000;
export const RESEARCH_MAINTENANCE_LEASE_MS = 60000;
export const RESEARCH_MAINTENANCE_LOCK_PREFIX =
  "magickli-retention-controller-v1:";
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const shape = v.strictObject({
  scope: v.unknown(),
  storage: v.optional(v.unknown()),
  maintenanceSchema: v.string(),
  profileSha256: hash,
  artifactTableOid: v.pipe(
    v.number(),
    v.safeInteger(),
    v.minValue(1),
    v.maxValue(4294967295),
  ),
});
/** Fixed actual target and original accounting scope, supplied only by trusted startup. No browser-selected DB/schema/profile. */
export interface ResearchMaintenanceTargetInput {
  readonly scope: ResearchAccountingScope;
  readonly storage?: ResearchAccountingStorage;
  readonly maintenanceSchema: string;
  readonly profileSha256: string;
  readonly artifactTableOid: number;
}
/** Own canonical target facts and derive finite minimum coverage from the ACTUAL publication cutoff, never preview duration or heartbeat mtime. */
export function prepareResearchMaintenanceTarget(
  value: ResearchMaintenanceTargetInput,
) {
  try {
    const p = v.parse(shape, value),
      target = parseResearchAccountingTarget(
        p.scope as ResearchAccountingScope,
        p.storage as ResearchAccountingStorage | undefined,
      ),
      maintenanceSchema = researchArtifactNamespace({
        schemaName: p.maintenanceSchema,
      }),
      cutoff = target.scope.expiresAtMs,
      coverage =
        cutoff + RESEARCH_ARTIFACT_RETENTION_MS + RESEARCH_PACKET_PURGE_LAG_MS;
    if (
      !Number.isSafeInteger(coverage) ||
      !Number.isFinite(new Date(coverage).getTime())
    )
      throw Error();
    return Object.freeze({
      scope: target.scope,
      storage: target.storage,
      maintenanceSchema,
      profileSha256: p.profileSha256,
      artifactTableOid: p.artifactTableOid,
      publicationCutoffMs: cutoff,
      coverageThroughMs: coverage,
      targetSha256: createHash("sha256")
        .update(
          JSON.stringify([
            "research-maintenance-target-v1",
            target.scope,
            target.storage,
            maintenanceSchema,
            p.profileSha256,
            p.artifactTableOid,
            RESEARCH_ARTIFACT_RETENTION_MS,
            RESEARCH_PACKET_PURGE_LAG_MS,
          ]),
        )
        .digest("hex"),
    });
  } catch {
    throw Error(RESEARCH_MAINTENANCE_ERROR);
  }
}
