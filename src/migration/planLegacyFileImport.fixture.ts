import { ObjectId } from "bson";
import { createUuidV7 } from "../lib/ids";
import type { LegacyFileImportOptions } from "./planLegacyFileImport";

/** Synthetic source rows shared by the independent planner and SQL suites. */
export type Row = Record<string, unknown>;
export const firstId = createUuidV7(),
  secondId = createUuidV7();
export const importedAt = new Date("2026-09-12T14:03:04.567Z");
export const originalAt = new Date("2014-03-30T00:59:59.123Z");
export const sourceId = new ObjectId("000000000000000000000001");
/** Builds a fresh synthetic source row while retaining the deliberate BSON identity. */
export function file(overrides: Row = {}): Row {
  return {
    _id: sourceId,
    filename: "\uFEFFTemple diagram — α.svg\r\n",
    sha256: "a".repeat(64),
    size: 20139,
    mimeType: "image/svg+xml",
    createdAt: new Date(originalAt),
    type: "image",
    image: { format: "svg", size: 20139, width: 800, height: 600 },
    __updatedAt: 1234567890123,
    ...overrides,
  };
}
/** Supplies explicit import settings and an independent bookkeeping timestamp. */
export function options(
  overrides: Partial<LegacyFileImportOptions> = {},
): LegacyFileImportOptions {
  return {
    lookup: () => firstId,
    storageProvider: "s3",
    sourceBucket: "synthetic-legacy-bucket",
    sourceObjectKeyPrefix: "",
    importedAt: new Date(importedAt),
    ...overrides,
  };
}
