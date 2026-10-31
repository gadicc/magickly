// This file is auto-generated. Do not edit.

import * as v from "valibot";

export const auditEventsSelect = v.object({
  id: v.pipe(v.string(), v.uuid()),
  at: v.date(),
  actorId: v.nullable(v.pipe(v.string(), v.uuid())),
  subjectKind: v.string(),
  subjectId: v.pipe(v.string(), v.uuid()),
  action: v.string(),
  scope: v.string(),
  templeId: v.nullable(v.pipe(v.string(), v.uuid())),
  groupId: v.nullable(v.pipe(v.string(), v.uuid())),
});

export const auditEventsInsert = v.object({
  id: v.optional(v.pipe(v.string(), v.uuid())),
  at: v.date(),
  actorId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
  subjectKind: v.string(),
  subjectId: v.pipe(v.string(), v.uuid()),
  action: v.string(),
  scope: v.string(),
  templeId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
  groupId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
});

export const auditEventsUpdate = v.object({
  id: v.optional(v.pipe(v.string(), v.uuid())),
  at: v.optional(v.date()),
  actorId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
  subjectKind: v.optional(v.string()),
  subjectId: v.optional(v.pipe(v.string(), v.uuid())),
  action: v.optional(v.string()),
  scope: v.optional(v.string()),
  templeId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
  groupId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
});

export type AuditEventsSelect = v.InferOutput<typeof auditEventsSelect>;
export type AuditEventsInsert = v.InferInput<typeof auditEventsInsert>;
export type AuditEventsUpdate = v.InferInput<typeof auditEventsUpdate>;
export const cronRunsSelect = v.object({
  job: v.string(),
  startedAt: v.date(),
  finishedAt: v.nullable(v.date()),
  outcome: v.nullable(v.string()),
  due: v.nullable(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  purged: v.nullable(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  deferred: v.nullable(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  failed: v.nullable(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
});

export const cronRunsInsert = v.object({
  job: v.string(),
  startedAt: v.date(),
  finishedAt: v.optional(v.nullable(v.date())),
  outcome: v.optional(v.nullable(v.string())),
  due: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  purged: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  deferred: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  failed: v.optional(
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

export const cronRunsUpdate = v.object({
  job: v.optional(v.string()),
  startedAt: v.optional(v.date()),
  finishedAt: v.optional(v.nullable(v.date())),
  outcome: v.optional(v.nullable(v.string())),
  due: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  purged: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  deferred: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-2147483648),
        v.maxValue(2147483647),
        v.integer(),
      ),
    ),
  ),
  failed: v.optional(
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

export type CronRunsSelect = v.InferOutput<typeof cronRunsSelect>;
export type CronRunsInsert = v.InferInput<typeof cronRunsInsert>;
export type CronRunsUpdate = v.InferInput<typeof cronRunsUpdate>;
