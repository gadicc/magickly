// This file is auto-generated. Do not edit.

import * as v from "valibot";

export const discourseUserLinksSelect = v.object({
  userId: v.pipe(v.string(), v.uuid()),
  forumOrigin: v.string(),
  discourseUserId: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
  createdAt: v.date(),
});

export const discourseUserLinksInsert = v.object({
  userId: v.pipe(v.string(), v.uuid()),
  forumOrigin: v.string(),
  discourseUserId: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
  createdAt: v.optional(v.date()),
});

export const discourseUserLinksUpdate = v.object({
  userId: v.optional(v.pipe(v.string(), v.uuid())),
  forumOrigin: v.optional(v.string()),
  discourseUserId: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-9007199254740991),
      v.maxValue(9007199254740991),
      v.integer(),
    ),
  ),
  createdAt: v.optional(v.date()),
});

export type DiscourseUserLinksSelect = v.InferOutput<
  typeof discourseUserLinksSelect
>;
export type DiscourseUserLinksInsert = v.InferInput<
  typeof discourseUserLinksInsert
>;
export type DiscourseUserLinksUpdate = v.InferInput<
  typeof discourseUserLinksUpdate
>;
export const templeForumsSelect = v.object({
  templeId: v.pipe(v.string(), v.uuid()),
  forumOrigin: v.string(),
  apiUsername: v.string(),
  apiKeyEncrypted: v.string(),
  apiKeyHint: v.string(),
  updatedById: v.nullable(v.pipe(v.string(), v.uuid())),
  updatedAt: v.date(),
});

export const templeForumsInsert = v.object({
  templeId: v.pipe(v.string(), v.uuid()),
  forumOrigin: v.string(),
  apiUsername: v.string(),
  apiKeyEncrypted: v.string(),
  apiKeyHint: v.optional(v.string()),
  updatedById: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
  updatedAt: v.optional(v.date()),
});

export const templeForumsUpdate = v.object({
  templeId: v.optional(v.pipe(v.string(), v.uuid())),
  forumOrigin: v.optional(v.string()),
  apiUsername: v.optional(v.string()),
  apiKeyEncrypted: v.optional(v.string()),
  apiKeyHint: v.optional(v.string()),
  updatedById: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
  updatedAt: v.optional(v.date()),
});

export type TempleForumsSelect = v.InferOutput<typeof templeForumsSelect>;
export type TempleForumsInsert = v.InferInput<typeof templeForumsInsert>;
export type TempleForumsUpdate = v.InferInput<typeof templeForumsUpdate>;
