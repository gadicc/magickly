// This file is auto-generated. Do not edit.

import * as v from "valibot";

export const chatDailyUsageSelect = v.object({
  subject: v.string(),
  day: v.string(),
  submissions: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
});

export const chatDailyUsageInsert = v.object({
  subject: v.string(),
  day: v.string(),
  submissions: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
});

export const chatDailyUsageUpdate = v.object({
  subject: v.optional(v.string()),
  day: v.optional(v.string()),
  submissions: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
});

export type ChatDailyUsageSelect = v.InferOutput<typeof chatDailyUsageSelect>;
export type ChatDailyUsageInsert = v.InferInput<typeof chatDailyUsageInsert>;
export type ChatDailyUsageUpdate = v.InferInput<typeof chatDailyUsageUpdate>;
