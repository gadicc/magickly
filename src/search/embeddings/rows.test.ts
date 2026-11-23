import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { artifactCoverage, parseVectorArtifact } from "./artifact";
import { EMBEDDING_PROFILES, type EmbeddingProfile } from "./profiles";
import { type EmbeddingRecord, embeddingRowKey } from "./records";
import {
  assembleVectorArtifact,
  decodeRow,
  encodeRow,
  listRowKeys,
  pruneRows,
  publishRows,
  rowPath,
  writeRows,
} from "./rows";

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const profile: EmbeddingProfile = {
  ...EMBEDDING_PROFILES[0],
  key: "test-profile",
  dimensions: 4,
};
const row = (...values: number[]) => encodeRow(values, values.length);
const key = (seed: string) => seed.padEnd(64, "0");

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "magickli-search-rows-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("embedding row validation", () => {
  it("accepts a unit row and reads back its little-endian float32 values", () => {
    const bytes = row(0.6, 0.8, 0, 0);
    expect(bytes.byteLength).toBe(16);
    expect(new DataView(bytes.buffer).getFloat32(0, true)).toBeCloseTo(0.6);
    expect(Array.from(decodeRow(bytes, 4))).toEqual(
      Array.from(new Float32Array([0.6, 0.8, 0, 0])),
    );
  });
  it("rejects the wrong length, non-finite values and a norm far from 1", () => {
    expect(() => decodeRow(row(1, 0, 0, 0).subarray(4), 4)).toThrow(/bytes/);
    expect(() => decodeRow(row(1, 0, 0, 0), 3)).toThrow(/bytes/);
    for (const values of [
      [Number.NaN, 1, 0, 0],
      [Number.POSITIVE_INFINITY, 0, 0, 0],
      [0.5, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
    ])
      expect(() => encodeRow(values, 4)).toThrow();
    expect(() => encodeRow([1.0001, 0, 0, 0], 4)).not.toThrow();
  });
});

describe("embedding row files", () => {
  it("fans rows out by the first two hex characters of their key", () => {
    expect(rowPath(root, "test-profile", key("ab12"))).toBe(
      join(root, "search-vectors/test-profile/ab", `${key("ab12")}.f32`),
    );
    expect(() => rowPath(root, "test-profile", "AB12")).toThrow();
    expect(() => rowPath(root, "../escape", key("ab"))).toThrow();
  });

  it("writes rows that are missing or differ, and validates before writing", () => {
    const rows = [
      [key("aa"), row(1, 0, 0, 0)],
      [key("ab"), row(0, 1, 0, 0)],
    ] as const;
    expect(writeRows(root, profile.key, 4, rows)).toBe(2);
    expect(writeRows(root, profile.key, 4, rows)).toBe(0);
    expect(
      writeRows(root, profile.key, 4, [[key("aa"), row(0, 0, 1, 0)]]),
    ).toBe(1);
    expect(
      Buffer.from(row(0, 0, 1, 0)).equals(
        readFileSync(rowPath(root, profile.key, key("aa"))),
      ),
    ).toBe(true);
    expect(() =>
      writeRows(root, profile.key, 4, [
        [key("cc"), new Uint8Array(16).fill(0)],
      ]),
    ).toThrow();
    expect(existsSync(rowPath(root, profile.key, key("cc")))).toBe(false);
    expect(listRowKeys(root, profile.key)).toEqual([key("aa"), key("ab")]);
  });

  it("lists nothing for a missing profile and rejects stray files", () => {
    expect(listRowKeys(root, profile.key)).toEqual([]);
    writeRows(root, profile.key, 4, [[key("aa"), row(1, 0, 0, 0)]]);
    const fan = join(root, "search-vectors/test-profile/aa");
    writeFileSync(join(fan, ".DS_Store"), "");
    expect(listRowKeys(root, profile.key)).toEqual([key("aa")]);
    writeFileSync(join(fan, `${key("bb")}.f32`), row(1, 0, 0, 0));
    expect(() => listRowKeys(root, profile.key)).toThrow(/Unexpected/);
    rmSync(join(fan, `${key("bb")}.f32`));
    mkdirSync(join(root, "search-vectors/test-profile/notes"));
    expect(() => listRowKeys(root, profile.key)).toThrow(/Unexpected/);
  });

  it("prunes rows no key references, with their emptied directories", () => {
    writeRows(root, profile.key, 4, [
      [key("aa1"), row(1, 0, 0, 0)],
      [key("aa2"), row(0, 1, 0, 0)],
      [key("bb"), row(0, 0, 1, 0)],
    ]);
    expect(pruneRows(root, profile.key, new Set([key("aa1")]))).toEqual([
      key("aa2"),
      key("bb"),
    ]);
    expect(listRowKeys(root, profile.key)).toEqual([key("aa1")]);
    expect(readdirSync(join(root, "search-vectors/test-profile"))).toEqual([
      "aa",
    ]);
  });

  it("publishes a matrix as rows and prunes what it no longer names", () => {
    writeRows(root, profile.key, 4, [[key("ff"), row(1, 0, 0, 0)]]);
    const matrix = Buffer.concat([row(1, 0, 0, 0), row(0, 1, 0, 0)]);
    expect(() => publishRows(root, profile, [key("aa")], matrix)).toThrow();
    const result = publishRows(root, profile, [key("aa"), key("bb")], matrix);
    expect(result).toEqual({ written: 2, pruned: [key("ff")] });
    expect(listRowKeys(root, profile.key)).toEqual([key("aa"), key("bb")]);
    expect(
      Buffer.from(matrix.subarray(16)).equals(
        readFileSync(rowPath(root, profile.key, key("bb"))),
      ),
    ).toBe(true);
  });

  it("assembles the referenced rows into an artifact that reproduces the matrix", () => {
    const record = (id: string, text: string): EmbeddingRecord => ({
      id,
      path: `/${id}`,
      title: id,
      section: "",
      text,
      href: `/${id}`,
    });
    const records = [
      record("one", "first"),
      record("two", "second"),
      record("three", "third"),
    ];
    const keys = records.map((entry) => embeddingRowKey(profile, entry));
    const matrix = Buffer.concat([
      row(1, 0, 0, 0),
      row(0, 0.6, 0.8, 0),
      row(0, 0, 0, 1),
    ]);
    publishRows(root, profile, keys, matrix);
    const assembled = assembleVectorArtifact(root, profile, keys);
    expect(assembled).toMatchObject({ rows: 3, covered: 3, orphans: 0 });
    const artifact = parseVectorArtifact(assembled.bytes);
    expect(artifact.keys).toEqual(listRowKeys(root, profile.key));
    const coverage = artifactCoverage(artifact, profile, records);
    expect(coverage.map(({ record }) => record)).toEqual([0, 1, 2]);
    expect(
      Buffer.concat(
        coverage.map(({ row }) =>
          artifact.matrix.subarray(row * 16, row * 16 + 16),
        ),
      ).equals(matrix),
    ).toBe(true);
    // The digest search:build prints: the covered rows in record order.
    expect(assembled.sha256).toBe(sha256(matrix));
  });

  it("leaves orphan rows out of the artifact without failing", () => {
    writeRows(root, profile.key, 4, [
      [key("aa"), row(1, 0, 0, 0)],
      [key("bb"), row(0, 1, 0, 0)],
      [key("cc"), row(0, 0, 1, 0)],
    ]);
    // dd has no row; aa is referenced twice, as identical records would be.
    const assembled = assembleVectorArtifact(root, profile, [
      key("aa"),
      key("dd"),
      key("aa"),
      key("cc"),
    ]);
    expect(assembled).toMatchObject({ rows: 2, covered: 3, orphans: 1 });
    expect(parseVectorArtifact(assembled.bytes).keys).toEqual([
      key("aa"),
      key("cc"),
    ]);
    expect(listRowKeys(root, profile.key)).toHaveLength(3);
    // In the keys' order, repeats included, the missing dd skipped.
    expect(assembled.sha256).toBe(
      sha256(
        Buffer.concat([row(1, 0, 0, 0), row(1, 0, 0, 0), row(0, 0, 1, 0)]),
      ),
    );
  });

  it("fails on a malformed row, even one nothing references", () => {
    writeRows(root, profile.key, 4, [
      [key("aa"), row(1, 0, 0, 0)],
      [key("bb"), row(0, 1, 0, 0)],
    ]);
    writeFileSync(rowPath(root, profile.key, key("bb")), new Uint8Array(12));
    expect(() => assembleVectorArtifact(root, profile, [key("aa")])).toThrow(
      /bytes/,
    );
    const nan = new Float32Array([Number.NaN, 0, 0, 0]);
    writeFileSync(
      rowPath(root, profile.key, key("bb")),
      new Uint8Array(nan.buffer),
    );
    expect(() => assembleVectorArtifact(root, profile, [key("aa")])).toThrow(
      /non-finite/,
    );
    writeFileSync(
      rowPath(root, profile.key, key("bb")),
      new Uint8Array(new Float32Array([0.5, 0, 0, 0]).buffer),
    );
    expect(() => assembleVectorArtifact(root, profile, [key("aa")])).toThrow(
      /unit length/,
    );
  });
});
