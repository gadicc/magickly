// This file is auto-generated. Do not edit.

import * as v from "valibot";

export const chatResearchMaintenanceSelect = v.object({
  profileSha256: v.string(),
  targetSha256: v.string(),
  artifactSchema: v.string(),
  controllerPid: v.nullable(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  artifactTableOid: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
  publicationCutoff: v.date(),
  coverageThrough: v.date(),
  revision: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
  state: v.string(),
  runId: v.nullable(v.pipe(v.string(), v.uuid())),
  startedAt: v.nullable(v.date()),
  leaseExpiresAt: v.nullable(v.date()),
  observedAt: v.nullable(v.date()),
  finishedAt: v.nullable(v.date()),
  expiredPermits: v.nullable(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  expiredPackets: v.nullable(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  unpurgedPackets: v.nullable(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  latestRetainUntil: v.nullable(v.date()),
  purgedPermits: v.nullable(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  purgedPackets: v.nullable(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
});

export const chatResearchMaintenanceInsert = v.object({
  profileSha256: v.string(),
  targetSha256: v.string(),
  artifactSchema: v.string(),
  controllerPid: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  artifactTableOid: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
  publicationCutoff: v.date(),
  coverageThrough: v.date(),
  revision: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-9007199254740991),
      v.maxValue(9007199254740991),
      v.integer(),
    ),
  ),
  state: v.optional(v.string()),
  runId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
  startedAt: v.optional(v.nullable(v.date())),
  leaseExpiresAt: v.optional(v.nullable(v.date())),
  observedAt: v.optional(v.nullable(v.date())),
  finishedAt: v.optional(v.nullable(v.date())),
  expiredPermits: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  expiredPackets: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  unpurgedPackets: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  latestRetainUntil: v.optional(v.nullable(v.date())),
  purgedPermits: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  purgedPackets: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
});

export const chatResearchMaintenanceUpdate = v.object({
  profileSha256: v.optional(v.string()),
  targetSha256: v.optional(v.string()),
  artifactSchema: v.optional(v.string()),
  controllerPid: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  artifactTableOid: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-9007199254740991),
      v.maxValue(9007199254740991),
      v.integer(),
    ),
  ),
  publicationCutoff: v.optional(v.date()),
  coverageThrough: v.optional(v.date()),
  revision: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-9007199254740991),
      v.maxValue(9007199254740991),
      v.integer(),
    ),
  ),
  state: v.optional(v.string()),
  runId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
  startedAt: v.optional(v.nullable(v.date())),
  leaseExpiresAt: v.optional(v.nullable(v.date())),
  observedAt: v.optional(v.nullable(v.date())),
  finishedAt: v.optional(v.nullable(v.date())),
  expiredPermits: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  expiredPackets: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  unpurgedPackets: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  latestRetainUntil: v.optional(v.nullable(v.date())),
  purgedPermits: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  purgedPackets: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
});

export type ChatResearchMaintenanceSelect = v.InferOutput<
  typeof chatResearchMaintenanceSelect
>;
export type ChatResearchMaintenanceInsert = v.InferInput<
  typeof chatResearchMaintenanceInsert
>;
export type ChatResearchMaintenanceUpdate = v.InferInput<
  typeof chatResearchMaintenanceUpdate
>;
