// This file is auto-generated. Do not edit.

import * as v from "valibot";

export const corpusDatasetsSelect = v.object({
  id: v.string(),
  corpusVersion: v.string(),
  manifestText: v.string(),
  catalogText: v.string(),
  catalogSha256: v.string(),
  sourceCount: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  unitCount: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  spaceCount: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  sealedAt: v.nullable(v.date()),
  createdAt: v.date(),
});

export const corpusDatasetsInsert = v.object({
  id: v.string(),
  corpusVersion: v.string(),
  manifestText: v.string(),
  catalogText: v.string(),
  catalogSha256: v.string(),
  sourceCount: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  unitCount: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  spaceCount: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  sealedAt: v.optional(v.nullable(v.date())),
  createdAt: v.optional(v.date()),
});

export const corpusDatasetsUpdate = v.object({
  id: v.optional(v.string()),
  corpusVersion: v.optional(v.string()),
  manifestText: v.optional(v.string()),
  catalogText: v.optional(v.string()),
  catalogSha256: v.optional(v.string()),
  sourceCount: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  unitCount: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  spaceCount: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  sealedAt: v.optional(v.nullable(v.date())),
  createdAt: v.optional(v.date()),
});

export type CorpusDatasetsSelect = v.InferOutput<typeof corpusDatasetsSelect>;
export type CorpusDatasetsInsert = v.InferInput<typeof corpusDatasetsInsert>;
export type CorpusDatasetsUpdate = v.InferInput<typeof corpusDatasetsUpdate>;
export const corpusSourcesSelect = v.object({
  datasetId: v.string(),
  sourceId: v.string(),
  sourceVersion: v.string(),
  pdfPages: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  bookJson: v.string(),
});

export const corpusSourcesInsert = v.object({
  datasetId: v.string(),
  sourceId: v.string(),
  sourceVersion: v.string(),
  pdfPages: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  bookJson: v.string(),
});

export const corpusSourcesUpdate = v.object({
  datasetId: v.optional(v.string()),
  sourceId: v.optional(v.string()),
  sourceVersion: v.optional(v.string()),
  pdfPages: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  bookJson: v.optional(v.string()),
});

export type CorpusSourcesSelect = v.InferOutput<typeof corpusSourcesSelect>;
export type CorpusSourcesInsert = v.InferInput<typeof corpusSourcesInsert>;
export type CorpusSourcesUpdate = v.InferInput<typeof corpusSourcesUpdate>;
export const corpusSpacesSelect = v.object({
  datasetId: v.string(),
  spaceId: v.string(),
  modelId: v.string(),
  dimensions: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  inputPrefix: v.string(),
  modelJson: v.string(),
  vectorCount: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
});

export const corpusSpacesInsert = v.object({
  datasetId: v.string(),
  spaceId: v.string(),
  modelId: v.string(),
  dimensions: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  inputPrefix: v.string(),
  modelJson: v.string(),
  vectorCount: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
});

export const corpusSpacesUpdate = v.object({
  datasetId: v.optional(v.string()),
  spaceId: v.optional(v.string()),
  modelId: v.optional(v.string()),
  dimensions: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  inputPrefix: v.optional(v.string()),
  modelJson: v.optional(v.string()),
  vectorCount: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
});

export type CorpusSpacesSelect = v.InferOutput<typeof corpusSpacesSelect>;
export type CorpusSpacesInsert = v.InferInput<typeof corpusSpacesInsert>;
export type CorpusSpacesUpdate = v.InferInput<typeof corpusSpacesUpdate>;
export const corpusUnitVectorsSelect = v.object({
  datasetId: v.string(),
  unitId: v.string(),
  spaceId: v.string(),
  inputId: v.string(),
});

export const corpusUnitVectorsInsert = v.object({
  datasetId: v.string(),
  unitId: v.string(),
  spaceId: v.string(),
  inputId: v.string(),
});

export const corpusUnitVectorsUpdate = v.object({
  datasetId: v.optional(v.string()),
  unitId: v.optional(v.string()),
  spaceId: v.optional(v.string()),
  inputId: v.optional(v.string()),
});

export type CorpusUnitVectorsSelect = v.InferOutput<
  typeof corpusUnitVectorsSelect
>;
export type CorpusUnitVectorsInsert = v.InferInput<
  typeof corpusUnitVectorsInsert
>;
export type CorpusUnitVectorsUpdate = v.InferInput<
  typeof corpusUnitVectorsUpdate
>;
export const corpusUnitsSelect = v.object({
  datasetId: v.string(),
  unitId: v.string(),
  sourceId: v.string(),
  pageStart: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  pageEnd: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  extraction: v.string(),
  textSha256: v.string(),
  body: v.string(),
});

export const corpusUnitsInsert = v.object({
  datasetId: v.string(),
  unitId: v.string(),
  sourceId: v.string(),
  pageStart: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  pageEnd: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  extraction: v.string(),
  textSha256: v.string(),
  body: v.string(),
});

export const corpusUnitsUpdate = v.object({
  datasetId: v.optional(v.string()),
  unitId: v.optional(v.string()),
  sourceId: v.optional(v.string()),
  pageStart: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  pageEnd: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  extraction: v.optional(v.string()),
  textSha256: v.optional(v.string()),
  body: v.optional(v.string()),
});

export type CorpusUnitsSelect = v.InferOutput<typeof corpusUnitsSelect>;
export type CorpusUnitsInsert = v.InferInput<typeof corpusUnitsInsert>;
export type CorpusUnitsUpdate = v.InferInput<typeof corpusUnitsUpdate>;
export const corpusVectorsSelect = v.object({
  datasetId: v.string(),
  spaceId: v.string(),
  inputId: v.string(),
  inputSha256: v.string(),
  dimensions: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  vectorSha256: v.string(),
  embedding: v.any(),
});

export const corpusVectorsInsert = v.object({
  datasetId: v.string(),
  spaceId: v.string(),
  inputId: v.string(),
  inputSha256: v.string(),
  dimensions: v.pipe(
    v.number(),
    v.minValue(-2147483648),
    v.maxValue(2147483647),
    v.integer(),
  ),
  vectorSha256: v.string(),
  embedding: v.any(),
});

export const corpusVectorsUpdate = v.object({
  datasetId: v.optional(v.string()),
  spaceId: v.optional(v.string()),
  inputId: v.optional(v.string()),
  inputSha256: v.optional(v.string()),
  dimensions: v.optional(
    v.pipe(
      v.number(),
      v.minValue(-2147483648),
      v.maxValue(2147483647),
      v.integer(),
    ),
  ),
  vectorSha256: v.optional(v.string()),
  embedding: v.optional(v.any()),
});

export type CorpusVectorsSelect = v.InferOutput<typeof corpusVectorsSelect>;
export type CorpusVectorsInsert = v.InferInput<typeof corpusVectorsInsert>;
export type CorpusVectorsUpdate = v.InferInput<typeof corpusVectorsUpdate>;
