// This file is auto-generated. Do not edit.

import * as v from "valibot";

export const chatResearchPermitsSelect = v.object({
  id: v.pipe(v.string(), v.uuid()),
  windowId: v.pipe(v.string(), v.uuid()),
  operationId: v.pipe(v.string(), v.uuid()),
  actorId: v.pipe(v.string(), v.uuid()),
  sessionId: v.pipe(v.string(), v.uuid()),
  descriptorSha256: v.string(),
  requestSha256: v.string(),
  sourceContextSha256: v.string(),
  upperPico: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
  quoteExpiresAt: v.date(),
  reservedAt: v.date(),
  state: v.string(),
  dispatchId: v.nullable(v.pipe(v.string(), v.uuid())),
  dispatchAt: v.nullable(v.date()),
  finishedAt: v.nullable(v.date()),
  reportedPico: v.nullable(
    v.pipe(
      v.number(),
      v.minValue(-9007199254740991),
      v.maxValue(9007199254740991),
      v.integer(),
    ),
  ),
  responseSha256: v.nullable(v.string()),
  answerSha256: v.nullable(v.string()),
  resultSha256: v.nullable(v.string()),
});

export const chatResearchPermitsInsert = v.object({
  id: v.optional(v.pipe(v.string(), v.uuid())),
  windowId: v.pipe(v.string(), v.uuid()),
  operationId: v.pipe(v.string(), v.uuid()),
  actorId: v.pipe(v.string(), v.uuid()),
  sessionId: v.pipe(v.string(), v.uuid()),
  descriptorSha256: v.string(),
  requestSha256: v.string(),
  sourceContextSha256: v.string(),
  upperPico: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
  quoteExpiresAt: v.date(),
  reservedAt: v.date(),
  state: v.string(),
  dispatchId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
  dispatchAt: v.optional(v.nullable(v.date())),
  finishedAt: v.optional(v.nullable(v.date())),
  reportedPico: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-9007199254740991),
        v.maxValue(9007199254740991),
        v.integer(),
      ),
    ),
  ),
  responseSha256: v.optional(v.nullable(v.string())),
  answerSha256: v.optional(v.nullable(v.string())),
  resultSha256: v.optional(v.nullable(v.string())),
});

export const chatResearchPermitsUpdate = v.object({
  id: v.optional(v.pipe(v.string(), v.uuid())),
  windowId: v.optional(v.pipe(v.string(), v.uuid())),
  operationId: v.optional(v.pipe(v.string(), v.uuid())),
  actorId: v.optional(v.pipe(v.string(), v.uuid())),
  sessionId: v.optional(v.pipe(v.string(), v.uuid())),
  descriptorSha256: v.optional(v.string()),
  requestSha256: v.optional(v.string()),
  sourceContextSha256: v.optional(v.string()),
  upperPico: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-9007199254740991),
      v.maxValue(9007199254740991),
      v.integer(),
    ),
  ),
  quoteExpiresAt: v.optional(v.date()),
  reservedAt: v.optional(v.date()),
  state: v.optional(v.string()),
  dispatchId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
  dispatchAt: v.optional(v.nullable(v.date())),
  finishedAt: v.optional(v.nullable(v.date())),
  reportedPico: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(-9007199254740991),
        v.maxValue(9007199254740991),
        v.integer(),
      ),
    ),
  ),
  responseSha256: v.optional(v.nullable(v.string())),
  answerSha256: v.optional(v.nullable(v.string())),
  resultSha256: v.optional(v.nullable(v.string())),
});

export type ChatResearchPermitsSelect = v.InferOutput<
  typeof chatResearchPermitsSelect
>;
export type ChatResearchPermitsInsert = v.InferInput<
  typeof chatResearchPermitsInsert
>;
export type ChatResearchPermitsUpdate = v.InferInput<
  typeof chatResearchPermitsUpdate
>;
export const chatResearchWindowsSelect = v.object({
  id: v.pipe(v.string(), v.uuid()),
  approvalSha256: v.string(),
  actorId: v.pipe(v.string(), v.uuid()),
  corpusVersion: v.string(),
  model: v.string(),
  processorProfile: v.string(),
  beginsAt: v.date(),
  expiresAt: v.date(),
  maxRequests: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  perRequestPico: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
  totalPico: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
  requestsUsed: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  heldPico: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
  stopped: v.nullable(v.date()),
});

export const chatResearchWindowsInsert = v.object({
  id: v.optional(v.pipe(v.string(), v.uuid())),
  approvalSha256: v.string(),
  actorId: v.pipe(v.string(), v.uuid()),
  corpusVersion: v.string(),
  model: v.string(),
  processorProfile: v.string(),
  beginsAt: v.date(),
  expiresAt: v.date(),
  maxRequests: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  perRequestPico: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
  totalPico: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
  requestsUsed: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  heldPico: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-9007199254740991),
      v.maxValue(9007199254740991),
      v.integer(),
    ),
  ),
  stopped: v.optional(v.nullable(v.date())),
});

export const chatResearchWindowsUpdate = v.object({
  id: v.optional(v.pipe(v.string(), v.uuid())),
  approvalSha256: v.optional(v.string()),
  actorId: v.optional(v.pipe(v.string(), v.uuid())),
  corpusVersion: v.optional(v.string()),
  model: v.optional(v.string()),
  processorProfile: v.optional(v.string()),
  beginsAt: v.optional(v.date()),
  expiresAt: v.optional(v.date()),
  maxRequests: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  perRequestPico: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-9007199254740991),
      v.maxValue(9007199254740991),
      v.integer(),
    ),
  ),
  totalPico: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-9007199254740991),
      v.maxValue(9007199254740991),
      v.integer(),
    ),
  ),
  requestsUsed: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  heldPico: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-9007199254740991),
      v.maxValue(9007199254740991),
      v.integer(),
    ),
  ),
  stopped: v.optional(v.nullable(v.date())),
});

export type ChatResearchWindowsSelect = v.InferOutput<
  typeof chatResearchWindowsSelect
>;
export type ChatResearchWindowsInsert = v.InferInput<
  typeof chatResearchWindowsInsert
>;
export type ChatResearchWindowsUpdate = v.InferInput<
  typeof chatResearchWindowsUpdate
>;
