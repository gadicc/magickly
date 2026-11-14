/** Derived corpus snapshots only. Native pgvector migration/rehearsal is required; no route, source grant or active-dataset pointer is installed here.
 * Deliberately imported directly by corpus code, outside the public app/legacy-import schema barrel and its extension-free PGlite fixture graph. */
import { sql } from "drizzle-orm";
import {
  check,
  customType,
  foreignKey,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const researchCorpusSchema = pgSchema("chat_research_corpus");
// Drizzle quotes custom type names as one identifier. Migration 0025 resolves
// this through pg_catalog,public,pg_temp so a temporary type cannot shadow it.
const pgVector = customType<{ data: string; driverData: string }>({
  dataType: () => "vector",
});

/** Canonical metadata bytes and counts. Data integrity never establishes use/audience permission. */
export const corpusDatasets = researchCorpusSchema.table(
  "datasets",
  {
    id: text("id").primaryKey(),
    corpusVersion: text("corpus_version").notNull(),
    manifestText: text("manifest_text").notNull(),
    catalogText: text("catalog_text").notNull(),
    catalogSha256: text("catalog_sha256").notNull(),
    sourceCount: integer("source_count").notNull(),
    unitCount: integer("unit_count").notNull(),
    spaceCount: integer("space_count").notNull(),
    sealedAt: timestamp("sealed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "datasets_ids",
      sql`length(${t.id})=64 and ${t.id} ~ '^[0-9a-f]{64}$' and length(${t.corpusVersion})=64 and ${t.corpusVersion} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "datasets_counts",
      sql`${t.sourceCount} between 1 and 32 and ${t.unitCount} between 1 and 75000 and ${t.spaceCount} between 1 and 3`,
    ),
    check(
      "datasets_manifest",
      sql`pg_catalog.octet_length(${t.manifestText}) between 1 and 8192 and ${t.id}=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(${t.manifestText},'UTF8')),'hex')`,
    ),
    check(
      "datasets_catalog",
      sql`pg_catalog.octet_length(${t.catalogText}) between 1 and 33554432 and length(${t.catalogSha256})=64 and ${t.catalogSha256}=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(${t.catalogText},'UTF8')),'hex')`,
    ),
  ],
);

export const corpusSources = researchCorpusSchema.table(
  "sources",
  {
    datasetId: text("dataset_id")
      .notNull()
      .references(() => corpusDatasets.id, { onDelete: "restrict" }),
    sourceId: text("source_id").notNull(),
    sourceVersion: text("source_version").notNull(),
    pdfPages: integer("pdf_pages").notNull(),
    bookJson: text("book_json").notNull(),
  },
  (t) => [
    primaryKey({ name: "sources_pk", columns: [t.datasetId, t.sourceId] }),
    check(
      "sources_identity",
      sql`pg_catalog.octet_length(${t.sourceId}) between 1 and 128 and ${t.sourceId} ~ '^[A-Za-z0-9_-]+$' and length(${t.sourceVersion})=64 and ${t.sourceVersion} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "sources_metadata",
      sql`${t.pdfPages} between 1 and 100000 and pg_catalog.octet_length(${t.bookJson}) between 1 and 131072 and pg_catalog.json_typeof(${t.bookJson}::json)='object'`,
    ),
  ],
);

export const corpusUnits = researchCorpusSchema.table(
  "units",
  {
    datasetId: text("dataset_id").notNull(),
    unitId: text("unit_id").notNull(),
    sourceId: text("source_id").notNull(),
    pageStart: integer("page_start").notNull(),
    pageEnd: integer("page_end").notNull(),
    extraction: text("extraction").notNull(),
    textSha256: text("text_sha256").notNull(),
    body: text("body").notNull(),
  },
  (t) => [
    primaryKey({ name: "units_pk", columns: [t.datasetId, t.unitId] }),
    foreignKey({
      name: "units_source_fk",
      columns: [t.datasetId, t.sourceId],
      foreignColumns: [corpusSources.datasetId, corpusSources.sourceId],
    }).onDelete("restrict"),
    index("units_source_idx").on(t.datasetId, t.sourceId),
    check(
      "units_identity",
      sql`pg_catalog.octet_length(${t.unitId}) between 1 and 128 and ${t.unitId} ~ '^[A-Za-z0-9_.:-]+$'`,
    ),
    check(
      "units_pages",
      sql`${t.pageStart} >= 1 and ${t.pageEnd} >= ${t.pageStart} and ${t.extraction} in ('native_text','unverified_ocr')`,
    ),
    check(
      "units_body",
      sql`length(${t.body}) between 1 and 16000 and pg_catalog.octet_length(${t.body}) between 1 and 64000 and length(${t.textSha256})=64 and ${t.textSha256}=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(${t.body},'UTF8')),'hex')`,
    ),
  ],
);

export const corpusSpaces = researchCorpusSchema.table(
  "spaces",
  {
    datasetId: text("dataset_id")
      .notNull()
      .references(() => corpusDatasets.id, { onDelete: "restrict" }),
    spaceId: text("space_id").notNull(),
    modelId: text("model_id").notNull(),
    dimensions: integer("dimensions").notNull(),
    inputPrefix: text("input_prefix").notNull(),
    modelJson: text("model_json").notNull(),
    vectorCount: integer("vector_count").notNull(),
  },
  (t) => [
    primaryKey({ name: "spaces_pk", columns: [t.datasetId, t.spaceId] }),
    unique("spaces_dimensions_key").on(t.datasetId, t.spaceId, t.dimensions),
    check(
      "spaces_identity",
      sql`length(${t.spaceId})=64 and ${t.spaceId} ~ '^[0-9a-f]{64}$' and pg_catalog.octet_length(${t.modelId}) between 1 and 128 and ${t.dimensions} in (1536,3072) and ${t.vectorCount} between 1 and 75000`,
    ),
    check(
      "spaces_metadata",
      sql`pg_catalog.octet_length(${t.inputPrefix}) <= 1024 and pg_catalog.octet_length(${t.modelJson}) between 1 and 8192 and pg_catalog.json_typeof(${t.modelJson}::json)='object'`,
    ),
  ],
);

export const corpusVectors = researchCorpusSchema.table(
  "vectors",
  {
    datasetId: text("dataset_id").notNull(),
    spaceId: text("space_id").notNull(),
    inputId: text("input_id").notNull(),
    inputSha256: text("input_sha256").notNull(),
    dimensions: integer("dimensions").notNull(),
    vectorSha256: text("vector_sha256").notNull(),
    embedding: pgVector("embedding").notNull(),
  },
  (t) => [
    primaryKey({
      name: "vectors_pk",
      columns: [t.datasetId, t.spaceId, t.inputId],
    }),
    unique("vectors_exact_input_key").on(t.datasetId, t.spaceId, t.inputSha256),
    foreignKey({
      name: "vectors_space_fk",
      columns: [t.datasetId, t.spaceId, t.dimensions],
      foreignColumns: [
        corpusSpaces.datasetId,
        corpusSpaces.spaceId,
        corpusSpaces.dimensions,
      ],
    }).onDelete("restrict"),
    check(
      "vectors_input",
      sql`pg_catalog.octet_length(${t.inputId}) between 1 and 128 and ${t.inputId} ~ '^[A-Za-z0-9_.:-]+$' and length(${t.inputSha256})=64 and ${t.inputSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "vectors_bytes",
      sql`public.vector_dims(${t.embedding})=${t.dimensions} and public.vector_norm(${t.embedding})>0 and length(${t.vectorSha256})=64 and ${t.vectorSha256}=pg_catalog.encode(pg_catalog.sha256(public.vector_send(${t.embedding})),'hex')`,
    ),
  ],
);

export const corpusUnitVectors = researchCorpusSchema.table(
  "unit_vectors",
  {
    datasetId: text("dataset_id").notNull(),
    unitId: text("unit_id").notNull(),
    spaceId: text("space_id").notNull(),
    inputId: text("input_id").notNull(),
  },
  (t) => [
    primaryKey({
      name: "unit_vectors_pk",
      columns: [t.datasetId, t.unitId, t.spaceId],
    }),
    foreignKey({
      name: "unit_vectors_unit_fk",
      columns: [t.datasetId, t.unitId],
      foreignColumns: [corpusUnits.datasetId, corpusUnits.unitId],
    }).onDelete("restrict"),
    foreignKey({
      name: "unit_vectors_vector_fk",
      columns: [t.datasetId, t.spaceId, t.inputId],
      foreignColumns: [
        corpusVectors.datasetId,
        corpusVectors.spaceId,
        corpusVectors.inputId,
      ],
    }).onDelete("restrict"),
  ],
);
