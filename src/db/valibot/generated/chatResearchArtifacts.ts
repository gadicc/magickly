// This file is auto-generated. Do not edit.

import * as v from "valibot";

export const chatResearchArtifactsSelect = v.object({
  permitId: v.pipe(v.string(), v.uuid()),
  kind: v.string(),
  packetJson: v.nullable(v.string()),
  packetSha256: v.string(),
  jobCreatedAt: v.date(),
  storedAt: v.date(),
  retainUntil: v.date(),
  purgedAt: v.nullable(v.date()),
});

export const chatResearchArtifactsInsert = v.object({
  permitId: v.pipe(v.string(), v.uuid()),
  kind: v.string(),
  packetJson: v.optional(v.nullable(v.string())),
  packetSha256: v.string(),
  jobCreatedAt: v.date(),
  storedAt: v.date(),
  retainUntil: v.date(),
  purgedAt: v.optional(v.nullable(v.date())),
});

export const chatResearchArtifactsUpdate = v.object({
  permitId: v.optional(v.pipe(v.string(), v.uuid())),
  kind: v.optional(v.string()),
  packetJson: v.optional(v.nullable(v.string())),
  packetSha256: v.optional(v.string()),
  jobCreatedAt: v.optional(v.date()),
  storedAt: v.optional(v.date()),
  retainUntil: v.optional(v.date()),
  purgedAt: v.optional(v.nullable(v.date())),
});

export type ChatResearchArtifactsSelect = v.InferOutput<
  typeof chatResearchArtifactsSelect
>;
export type ChatResearchArtifactsInsert = v.InferInput<
  typeof chatResearchArtifactsInsert
>;
export type ChatResearchArtifactsUpdate = v.InferInput<
  typeof chatResearchArtifactsUpdate
>;
