// This file is auto-generated. Do not edit.

import * as v from "valibot";

export const enochianReadingSpendSelect = v.object({
  day: v.string(),
  microUsd: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
});

export const enochianReadingSpendInsert = v.object({
  day: v.string(),
  microUsd: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
});

export const enochianReadingSpendUpdate = v.object({
  day: v.optional(v.string()),
  microUsd: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-9007199254740991),
      v.maxValue(9007199254740991),
      v.integer(),
    ),
  ),
});

export type EnochianReadingSpendSelect = v.InferOutput<
  typeof enochianReadingSpendSelect
>;
export type EnochianReadingSpendInsert = v.InferInput<
  typeof enochianReadingSpendInsert
>;
export type EnochianReadingSpendUpdate = v.InferInput<
  typeof enochianReadingSpendUpdate
>;
export const enochianReadingSwitchSelect = v.object({
  id: v.string(),
  off: v.boolean(),
  changedAt: v.date(),
});

export const enochianReadingSwitchInsert = v.object({
  id: v.string(),
  off: v.boolean(),
  changedAt: v.optional(v.date()),
});

export const enochianReadingSwitchUpdate = v.object({
  id: v.optional(v.string()),
  off: v.optional(v.boolean()),
  changedAt: v.optional(v.date()),
});

export type EnochianReadingSwitchSelect = v.InferOutput<
  typeof enochianReadingSwitchSelect
>;
export type EnochianReadingSwitchInsert = v.InferInput<
  typeof enochianReadingSwitchInsert
>;
export type EnochianReadingSwitchUpdate = v.InferInput<
  typeof enochianReadingSwitchUpdate
>;
export const enochianReadingsSelect = v.object({
  version: v.string(),
  passage: v.string(),
  parts: v.union([
    v.union([v.string(), v.number(), v.boolean(), (v.null ?? v.null_)()]),
    v.array(v.any()),
    v.record(v.string(), v.any()),
  ]),
  complete: v.boolean(),
  claim: v.nullable(v.string()),
  pendingUntil: v.nullable(v.date()),
  createdAt: v.date(),
});

export const enochianReadingsInsert = v.object({
  version: v.string(),
  passage: v.string(),
  parts: v.union([
    v.union([v.string(), v.number(), v.boolean(), (v.null ?? v.null_)()]),
    v.array(v.any()),
    v.record(v.string(), v.any()),
  ]),
  complete: v.boolean(),
  claim: v.optional(v.nullable(v.string())),
  pendingUntil: v.optional(v.nullable(v.date())),
  createdAt: v.date(),
});

export const enochianReadingsUpdate = v.object({
  version: v.optional(v.string()),
  passage: v.optional(v.string()),
  parts: v.optional(
    v.union([
      v.union([v.string(), v.number(), v.boolean(), (v.null ?? v.null_)()]),
      v.array(v.any()),
      v.record(v.string(), v.any()),
    ]),
  ),
  complete: v.optional(v.boolean()),
  claim: v.optional(v.nullable(v.string())),
  pendingUntil: v.optional(v.nullable(v.date())),
  createdAt: v.optional(v.date()),
});

export type EnochianReadingsSelect = v.InferOutput<
  typeof enochianReadingsSelect
>;
export type EnochianReadingsInsert = v.InferInput<
  typeof enochianReadingsInsert
>;
export type EnochianReadingsUpdate = v.InferInput<
  typeof enochianReadingsUpdate
>;
