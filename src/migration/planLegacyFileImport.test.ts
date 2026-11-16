import { createHash } from "node:crypto";
import { EJSON, ObjectId } from "bson";
import { describe, expect, it, vi } from "vitest";
import type { LegacyAliasKey } from "../db/legacyIds";
import {
  LegacyFileImportError,
  type LegacyFileImportOptions,
  planLegacyFileImport,
} from "./planLegacyFileImport";
import {
  file,
  firstId,
  importedAt,
  options,
  originalAt,
  type Row,
  secondId,
  sourceId,
} from "./planLegacyFileImport.fixture";

// Keep focused planning runs independent of the SQL runtime and database engine.
vi.mock("@gadicc/loom/db/testing", () => {
  throw new Error("Pure planning imported the PGlite harness");
});
vi.mock("@electric-sql/pglite", () => {
  throw new Error("Pure planning imported PGlite");
});
vi.mock("drizzle-orm", () => {
  throw new Error("Pure planning imported Drizzle");
});
vi.mock("drizzle-orm/pg-core", () => {
  throw new Error("Pure planning imported a SQL schema");
});

function failure(
  input: readonly unknown[],
  code: string,
  settings = options(),
) {
  try {
    planLegacyFileImport(input, settings);
  } catch (error) {
    expect(error).toBeInstanceOf(LegacyFileImportError);
    expect((error as LegacyFileImportError).code).toBe(code);
    expect((error as Error).message).not.toContain("Temple diagram");
    expect((error as Error).message).not.toContain(sourceId.toHexString());
    return;
  }
  throw new Error("Expected rejected synthetic import");
}

describe("legacy Files import plan", () => {
  it("preserves historical SVG links, keys, claims, source dates and protected evidence without fabricating ownership", () => {
    const input = file(),
      plan = planLegacyFileImport([input], options());
    expect(plan.files).toEqual([
      {
        id: firstId,
        sha256: input.sha256,
        byteSize: input.size,
        originalFilename: input.filename,
        contentType: "image/svg+xml",
        detectedContentType: null,
        kind: "image",
        storageProvider: "s3",
        bucket: "synthetic-legacy-bucket",
        objectKey: input.sha256,
        ownerType: null,
        ownerId: null,
        visibility: "public",
        imageMeta: input.image,
        audioMeta: null,
        meta: {},
        deletedAt: null,
        createdAt: originalAt,
        updatedAt: importedAt,
      },
    ]);
    const snapshot = plan.snapshots[0];
    expect(snapshot).toMatchObject({
      fileId: firstId,
      sourceSystem: "mongodb",
      legacyIdType: "objectid",
      legacyIdValue: sourceId.toHexString(),
      legacyPublicPath: `/api/file2?sha256=${input.sha256}`,
      sourceStorageProvider: "s3",
      sourceBucket: "synthetic-legacy-bucket",
      sourceObjectKey: input.sha256,
      sourceObjectKeyPrefix: "",
      serializationVersion: "bson-canonical-ejson-v1",
      legacySyncUpdatedAtMilliseconds: 1234567890123,
      importedAt,
    });
    expect(EJSON.parse(snapshot.sourceEjson, { relaxed: true })).toEqual(input);
    expect(snapshot.sourceSha256).toBe(
      createHash("sha256").update(snapshot.sourceEjson).digest("hex"),
    );
    expect(plan.objectVerificationRequired).toEqual([firstId]);
    expect(plan.aliases).toEqual([
      {
        source: {
          sourceSystem: "mongodb",
          entityType: "files",
          legacyIdType: "objectid",
          legacyIdValue: sourceId.toHexString(),
        },
        canonicalId: firstId,
      },
    ]);
  });
  it("uses only an explicit verified key prefix while preserving source, digest and public URL", () => {
    const input = file();
    const bare = planLegacyFileImport([input], options());
    const settings = options({ sourceObjectKeyPrefix: "verified-prefix/" });
    const prefixed = planLegacyFileImport([input], settings);
    expect(prefixed.files[0]).toEqual({
      ...bare.files[0],
      objectKey: `verified-prefix/${input.sha256}`,
    });
    expect(prefixed.snapshots[0]).toEqual({
      ...bare.snapshots[0],
      sourceObjectKey: `verified-prefix/${input.sha256}`,
      sourceObjectKeyPrefix: "verified-prefix/",
    });
    expect(prefixed.aliases).toEqual(bare.aliases);
    expect(prefixed.objectVerificationRequired).toEqual([firstId]);
    expect(planLegacyFileImport([input], settings)).toEqual(prefixed);
    settings.sourceObjectKeyPrefix = "changed-later/";
    expect(prefixed.snapshots[0].sourceObjectKeyPrefix).toBe(
      "verified-prefix/",
    );
  });
  it("never derives a key prefix from the provider or bucket", () => {
    const plan = planLegacyFileImport(
      [file()],
      options({
        storageProvider: "r2",
        sourceBucket: "different-bucket",
        sourceObjectKeyPrefix: "independently-verified/",
      }),
    );
    expect(plan.files[0]).toMatchObject({
      storageProvider: "r2",
      bucket: "different-bucket",
      objectKey: `independently-verified/${"a".repeat(64)}`,
    });
  });
  it("preserves exact prefix bytes instead of URL encoding, trimming or Unicode normalization", () => {
    const prefix = " exact e\u0301 é/";
    const plan = planLegacyFileImport(
      [file()],
      options({ sourceObjectKeyPrefix: prefix }),
    );
    expect(plan.files[0].objectKey).toBe(prefix + "a".repeat(64));
    expect(plan.snapshots[0].sourceObjectKeyPrefix).toBe(prefix);
  });
  it("requires an explicit prefix choice and rejects invalid or oversized key prefixes", () => {
    for (const prefix of [
      undefined,
      null,
      1,
      "missing-delimiter",
      "x\0/",
      "\ud800/",
      "x".repeat(960) + "/",
      "é".repeat(480) + "/",
    ]) {
      expect(() =>
        planLegacyFileImport(
          [file()],
          options({ sourceObjectKeyPrefix: prefix as string }),
        ),
      ).toThrow(LegacyFileImportError);
    }
    const prefix = "x".repeat(959) + "/";
    const plan = planLegacyFileImport(
      [file()],
      options({ sourceObjectKeyPrefix: prefix }),
    );
    expect(Buffer.byteLength(plan.files[0].objectKey, "utf8")).toBe(1024);
  });
  it("keeps old audio and other metadata outside the future image upload allowlist", () => {
    const audio = file({
      type: "audio",
      audio: {
        container: "WAVE",
        codec: "PCM",
        lossless: true,
        bitrate: 128000,
        duration: 2.125,
        notes: ["α", null],
      },
      mimeType: "audio/wav",
    });
    delete audio.image;
    const other = file({
      _id: "old-string-id",
      sha256: "b".repeat(64),
      type: "other",
      mimeType: "application/pdf",
      size: 30 * 1024 * 1024,
    });
    delete other.image;
    const plan = planLegacyFileImport(
      [audio, other],
      options({
        lookup: (ref) => (ref.legacyIdType === "objectid" ? firstId : secondId),
      }),
    );
    expect(plan.files.map((row) => row.kind)).toEqual(["audio", "other"]);
    expect(plan.files[0].audioMeta).toEqual(audio.audio);
    expect(plan.files[1]).toMatchObject({
      byteSize: 30 * 1024 * 1024,
      contentType: "application/pdf",
      visibility: "public",
    });
  });
  it("distinguishes absent optional source fields from empty strings and preserves zero sizes/sync values", () => {
    const absent = file({ size: 0 });
    delete absent.filename;
    delete absent.mimeType;
    delete absent.__updatedAt;
    const empty = file({ filename: "", mimeType: "", __updatedAt: 0 });
    const a = planLegacyFileImport([absent], options()),
      b = planLegacyFileImport([empty], options());
    expect(a.files[0]).toMatchObject({
      originalFilename: null,
      contentType: null,
      byteSize: 0,
    });
    expect(a.snapshots[0].legacySyncUpdatedAtMilliseconds).toBeNull();
    expect(
      Object.hasOwn(EJSON.parse(a.snapshots[0].sourceEjson), "filename"),
    ).toBe(false);
    expect(b.files[0]).toMatchObject({ originalFilename: "", contentType: "" });
    expect(b.snapshots[0].legacySyncUpdatedAtMilliseconds).toBe(0);
  });
  it("keeps ObjectId and identical string identities separate, with stable preallocated UUIDv7 mappings", () => {
    const input = [
      file(),
      file({ _id: sourceId.toHexString(), sha256: "b".repeat(64) }),
    ];
    const seen: LegacyAliasKey[] = [];
    const opts = options({
      lookup: (ref) => {
        seen.push(ref);
        return ref.legacyIdType === "objectid"
          ? firstId.toUpperCase()
          : secondId;
      },
    });
    const plan = planLegacyFileImport(input, opts);
    expect(plan.files.map((row) => row.id)).toEqual([firstId, secondId]);
    expect(seen.map((ref) => ref.legacyIdType)).toEqual(["objectid", "string"]);
    expect(planLegacyFileImport(input, opts)).toEqual(plan);
  });
  it("does not share mutable metadata or dates with its source", () => {
    const input = file(),
      settings = options();
    const before = EJSON.stringify(input, { relaxed: false }),
      plan = planLegacyFileImport([input], settings);
    (input.image as Row).width = 1;
    (input.createdAt as Date).setTime(0);
    settings.importedAt.setTime(0);
    expect(plan.files[0].imageMeta?.width).toBe(800);
    expect(plan.files[0].createdAt).toEqual(originalAt);
    expect(plan.files[0].updatedAt).toEqual(importedAt);
    expect(plan.snapshots[0].sourceEjson).toBe(before);
  });
  it("permits an empty inventory with explicit source settings", () => {
    expect(planLegacyFileImport([], options())).toEqual({
      files: [],
      snapshots: [],
      aliases: [],
      objectVerificationRequired: [],
    });
  });
  it.each([
    ["ownerId", firstId],
    ["userId", sourceId],
    ["templeId", secondId],
    ["meta", { private: true }],
    ["deletedAt", importedAt],
    ["unexpected", "secret"],
  ])(
    "rejects unreviewed %s rather than inventing ownership or dropping evidence",
    (field, value) =>
      failure([file({ [field]: value })], "unclassified-fields"),
  );
  it.each([
    ["sha256", "A".repeat(64), "invalid-legacy-digest"],
    ["sha256", ` ${"a".repeat(64)}`, "invalid-legacy-digest"],
    ["sha256", "not-a-hash", "invalid-legacy-digest"],
    ["sha256", 1, "invalid-legacy-digest"],
    ["size", -1, "invalid-byte-size"],
    ["size", -0, "invalid-byte-size"],
    ["size", 0.5, "invalid-byte-size"],
    ["size", Number.MAX_SAFE_INTEGER + 1, "invalid-byte-size"],
    ["size", "1", "invalid-byte-size"],
    ["size", Number.POSITIVE_INFINITY, "invalid-byte-size"],
    ["createdAt", undefined, "invalid-date"],
    ["createdAt", originalAt.toISOString(), "invalid-date"],
    ["createdAt", new Date(Number.NaN), "invalid-date"],
    ["type", "pdf", "unsupported-kind"],
    ["mimeType", undefined, "invalid-text"],
    ["filename", null, "invalid-text"],
    ["filename", "bad\u0000name", "unrepresentable-text"],
    ["filename", "\uD800", "unrepresentable-text"],
    ["__updatedAt", -1, "invalid-sync-timestamp"],
    ["__updatedAt", null, "invalid-sync-timestamp"],
    ["__updatedAt", undefined, "invalid-sync-timestamp"],
    ["__updatedAt", -0, "invalid-sync-timestamp"],
  ])("rejects unrepresentable %s case %#", (field, value, code) =>
    failure([file({ [field]: value })], code as string),
  );
  it.each([
    null,
    [],
    {},
    { _bsontype: "ObjectId", toHexString: () => sourceId.toHexString() },
    "",
    42,
  ])("rejects fabricated identity %#", (value) =>
    failure(
      [file({ _id: value })],
      typeof value === "string" ? "invalid-text" : "invalid-source-id",
    ),
  );
  it.each([
    ["image", null],
    ["image", []],
    ["image", { bad: undefined }],
    ["image", { bad: new Date() }],
    ["image", { bad: Number.NaN }],
    ["image", { bad: -0 }],
    ["image", { bad: [undefined] }],
  ])("rejects metadata that JSONB cannot preserve %#", (field, value) => {
    expect(() =>
      planLegacyFileImport([file({ [field as string]: value })], options()),
    ).toThrow(LegacyFileImportError);
  });
  it("rejects cycles, sparse arrays, symbol fields and accessor-backed metadata", () => {
    const cycle: Row = {};
    cycle.self = cycle;
    const sparse = new Array(2);
    sparse[1] = 1;
    const getter = Object.defineProperty({}, "x", {
      enumerable: true,
      get() {
        throw new Error("should not evaluate");
      },
    });
    for (const image of [
      cycle,
      { sparse },
      { [Symbol("secret")]: 1 },
      getter,
    ]) {
      expect(() => planLegacyFileImport([file({ image })], options())).toThrow(
        LegacyFileImportError,
      );
    }
  });
  it("rejects metadata array accessors without evaluating them", () => {
    let reads = 0;
    const values = [1];
    Object.defineProperty(values, "0", {
      enumerable: true,
      get() {
        reads++;
        return 1;
      },
    });
    let error: unknown;
    try {
      planLegacyFileImport([file({ image: { values } })], options());
    } catch (caught) {
      error = caught;
    }
    expect(reads).toBe(0);
    expect(error).toBeInstanceOf(LegacyFileImportError);
  });
  it("rejects hidden array metadata instead of silently dropping source evidence", () => {
    const values = [1];
    Object.defineProperty(values, "privateNote", {
      enumerable: false,
      value: "preserve this source evidence",
    });
    failure([file({ image: { values } })], "non-json-metadata");
  });
  it("rejects literal EJSON type tags rather than changing protected evidence on revival", () => {
    failure(
      [file({ image: { innocent: { $date: "2020-01-01T00:00:00.000Z" } } })],
      "snapshot-roundtrip-loss",
    );
  });
  it.each([
    { type: "other" },
    { type: "audio", audio: {} },
    { audio: {} },
    { image: undefined },
  ])("rejects inconsistent kind metadata %#", (override) => {
    expect(() => planLegacyFileImport([file(override)], options())).toThrow(
      LegacyFileImportError,
    );
  });
  it("fails duplicate source identities, canonical aliases and digest collisions without partial plans", () => {
    failure([file(), file()], "duplicate-source-id");
    const different = file({
      _id: new ObjectId("000000000000000000000002"),
      sha256: "b".repeat(64),
    });
    failure([file(), different], "canonical-alias-collision");
    failure(
      [file(), { ...different, sha256: "a".repeat(64) }],
      "duplicate-digest-needs-review",
      options({
        lookup: (ref) => (ref.legacyIdValue.endsWith("1") ? firstId : secondId),
      }),
    );
  });
  it.each([null, "bad", "00000000-0000-4000-8000-000000000000"])(
    "rejects missing or non-v7 alias %#",
    (id) =>
      failure(
        [file()],
        "missing-or-invalid-alias",
        options({ lookup: () => id }),
      ),
  );
  it.each([
    { storageProvider: "" },
    { sourceBucket: "  " },
    { sourceBucket: "invalid\u0000" },
    { importedAt: new Date(Number.NaN) },
    { lookup: null },
  ])("requires explicit valid import options %#", (override) => {
    expect(() =>
      planLegacyFileImport([file()], {
        ...options(),
        ...override,
      } as LegacyFileImportOptions),
    ).toThrow(LegacyFileImportError);
  });
  it("rejects malformed input containers", () => {
    expect(() => planLegacyFileImport(null as never, options())).toThrow(
      LegacyFileImportError,
    );
    expect(() => planLegacyFileImport([], null as never)).toThrow(
      LegacyFileImportError,
    );
    for (const value of [null, [], 3, new Date()])
      expect(() => planLegacyFileImport([value], options())).toThrow(
        LegacyFileImportError,
      );
  });
});
