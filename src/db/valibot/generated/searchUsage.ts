// This file is auto-generated. Do not edit.

import * as v from "valibot";

export const siteSearchUsageSelect = v.object({
  id: v.string(),
  day: v.string(),
  queries: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
});

export const siteSearchUsageInsert = v.object({
  id: v.string(),
  day: v.string(),
  queries: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
});

export const siteSearchUsageUpdate = v.object({
  id: v.optional(v.string()),
  day: v.optional(v.string()),
  queries: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
});

export type SiteSearchUsageSelect = v.InferOutput<typeof siteSearchUsageSelect>;
export type SiteSearchUsageInsert = v.InferInput<typeof siteSearchUsageInsert>;
export type SiteSearchUsageUpdate = v.InferInput<typeof siteSearchUsageUpdate>;
