// This file is auto-generated. Do not edit.

import * as v from "valibot";

export const chatResearchSourcePoliciesSelect = v.object({
  corpusVersion: v.string(),
  revision: v.pipe(
    v.number(),
    v.minValue(-9007199254740991),
    v.maxValue(9007199254740991),
    v.integer(),
  ),
  state: v.string(),
  policyJson: v.string(),
  policySha256: v.string(),
});

export const chatResearchSourcePoliciesInsert = v.object({
  corpusVersion: v.string(),
  revision: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-9007199254740991),
      v.maxValue(9007199254740991),
      v.integer(),
    ),
  ),
  state: v.optional(v.string()),
  policyJson: v.string(),
  policySha256: v.string(),
});

export const chatResearchSourcePoliciesUpdate = v.object({
  corpusVersion: v.optional(v.string()),
  revision: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-9007199254740991),
      v.maxValue(9007199254740991),
      v.integer(),
    ),
  ),
  state: v.optional(v.string()),
  policyJson: v.optional(v.string()),
  policySha256: v.optional(v.string()),
});

export type ChatResearchSourcePoliciesSelect = v.InferOutput<
  typeof chatResearchSourcePoliciesSelect
>;
export type ChatResearchSourcePoliciesInsert = v.InferInput<
  typeof chatResearchSourcePoliciesInsert
>;
export type ChatResearchSourcePoliciesUpdate = v.InferInput<
  typeof chatResearchSourcePoliciesUpdate
>;
