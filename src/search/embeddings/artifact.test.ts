import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  artifactCoverage,
  encodeVectorArtifact,
  parseVectorArtifact,
  readVectorArtifactHeader,
  type VectorArtifact,
} from "./artifact";
import { EMBEDDING_PROFILES, type EmbeddingProfile } from "./profiles";
import { rankVectors } from "./rank";
import { type EmbeddingRecord, embeddingRowKey } from "./records";
import { encodeRow } from "./rows";
import { coveredVectors } from "./store";

const profile: EmbeddingProfile = {
  ...EMBEDDING_PROFILES[0],
  key: "test-profile",
  dimensions: 2,
};
const record = (id: string): EmbeddingRecord => ({
  id,
  path: `/${id}`,
  title: id,
  section: "",
  text: `text of ${id}`,
  href: `/${id}`,
});
const records = ["a", "b", "c"].map(record);
const vectors = [
  [1, 0],
  [0, 1],
  [0.6, 0.8],
];
const rows = records.map(
  (entry, i) =>
    [embeddingRowKey(profile, entry), encodeRow(vectors[i], 2)] as const,
);
const matrix = Buffer.concat(rows.map(([, bytes]) => bytes));

describe("the keyed vector artifact", () => {
  it("round-trips rows given in any order, sorted by key", () => {
    const artifact = parseVectorArtifact(
      encodeVectorArtifact(profile.key, 2, [...rows].reverse()),
    );
    expect(artifact.profile).toBe(profile.key);
    expect(artifact.dimensions).toBe(2);
    expect(artifact.keys).toEqual(rows.map(([key]) => key).sort());
    expect(artifact.matrix.length).toBe(3 * 2 * 4);
  });

  it("finds each record's row by key, whatever the file order", () => {
    // The covered records' rows, concatenated in record order.
    const coveredMatrix = (artifact: VectorArtifact, of = records) =>
      Buffer.concat(
        artifactCoverage(artifact, profile, of).map(({ row }) =>
          artifact.matrix.subarray(row * 8, row * 8 + 8),
        ),
      );
    for (const order of [
      rows,
      [...rows].reverse(),
      [rows[1], rows[2], rows[0]],
    ])
      expect(
        coveredMatrix(
          parseVectorArtifact(encodeVectorArtifact(profile.key, 2, order)),
        ).equals(matrix),
      ).toBe(true);
    const shuffled = [records[2], records[0], records[1]];
    expect(
      coveredMatrix(
        parseVectorArtifact(encodeVectorArtifact(profile.key, 2, rows)),
        shuffled,
      ).equals(Buffer.concat([rows[2][1], rows[0][1], rows[1][1]])),
    ).toBe(true);
  });

  it("covers only the records with a row, and none for another profile", () => {
    const artifact = parseVectorArtifact(
      encodeVectorArtifact(profile.key, 2, rows),
    );
    expect(
      artifactCoverage(artifact, { ...profile, key: "other" }, records),
    ).toEqual([]);
    expect(
      artifactCoverage(artifact, profile, [...records, record("missing")]).map(
        ({ record }) => record,
      ),
    ).toEqual([0, 1, 2]);
    const partial = parseVectorArtifact(
      encodeVectorArtifact(profile.key, 2, rows.slice(1)),
    );
    expect(
      artifactCoverage(partial, profile, records).map(({ record }) => record),
    ).toEqual([1, 2]);
  });

  it("reads the same header from a file without its matrix", () => {
    const directory = mkdtempSync(join(tmpdir(), "magickli-search-artifact-"));
    try {
      const path = join(directory, "search-vectors.bin");
      const bytes = encodeVectorArtifact(profile.key, 2, rows);
      writeFileSync(path, bytes);
      const { matrix: _, ...header } = parseVectorArtifact(bytes);
      expect(readVectorArtifactHeader(path)).toEqual(header);
      writeFileSync(path, bytes.subarray(0, bytes.length - 4));
      expect(() => readVectorArtifactHeader(path)).toThrow(/artifact/);
      writeFileSync(path, bytes.subarray(0, 6));
      expect(() => readVectorArtifactHeader(path)).toThrow(/artifact/);
      expect(() => readVectorArtifactHeader(join(directory, "none"))).toThrow(
        /ENOENT/,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects malformed artifacts and rows", () => {
    const bytes = encodeVectorArtifact(profile.key, 2, rows);
    expect(() =>
      parseVectorArtifact(bytes.subarray(0, bytes.length - 4)),
    ).toThrow();
    const magic = Buffer.from(bytes);
    magic.write("XXXX", 0, "ascii");
    expect(() => parseVectorArtifact(magic)).toThrow();
    // Swap the first two keys in the header only, keeping every length.
    const unsorted = Buffer.from(bytes);
    const [first, second] = parseVectorArtifact(bytes).keys;
    const end = 8 + bytes.readUInt32LE(4);
    const header = bytes.toString("utf8", 8, end);
    const swapped = header
      .replace(first, "x".repeat(64))
      .replace(second, first)
      .replace("x".repeat(64), second);
    expect(swapped).not.toBe(header);
    unsorted.write(swapped, 8, "utf8");
    expect(parseVectorArtifact(Buffer.from(bytes)).keys).toHaveLength(3);
    expect(() => parseVectorArtifact(unsorted)).toThrow();
    expect(() =>
      encodeVectorArtifact(profile.key, 2, [rows[0], rows[0]]),
    ).toThrow(/repeated/);
    expect(() => encodeVectorArtifact(profile.key, 3, rows)).toThrow(/length/);
  });
});

describe("store vectors from the artifact", () => {
  it("returns every record's vector in record order when all are covered", () => {
    const covered = coveredVectors(
      encodeVectorArtifact(profile.key, 2, [...rows].reverse()),
      profile,
      records,
    );
    expect(covered?.records).toEqual(records);
    expect(covered?.total).toBe(3);
    expect(Array.from(covered?.vectors ?? [])).toEqual(
      Array.from(new Float32Array([1, 0, 0, 1, 0.6, 0.8])),
    );
  });

  it("leaves records without a row out of dense ranking only, aligned", () => {
    // b has no row: a and c keep their own vectors, in record order.
    const covered = coveredVectors(
      encodeVectorArtifact(profile.key, 2, [rows[2], rows[0]]),
      profile,
      records,
    );
    expect(covered?.records.map(({ id }) => id)).toEqual(["a", "c"]);
    expect(covered?.total).toBe(3);
    expect(Array.from(covered?.vectors ?? [])).toEqual(
      Array.from(new Float32Array([1, 0, 0.6, 0.8])),
    );
    if (!covered) throw new Error("expected coverage");
    // Each covered record's own vector ranks its page first; b never ranks.
    for (const [i, entry] of covered.records.entries()) {
      const query = Array.from(covered.vectors.slice(i * 2, i * 2 + 2));
      const ranked = rankVectors(covered.records, covered.vectors, query, "");
      expect(ranked[0].path).toBe(entry.path);
      expect(ranked.map(({ path }) => path)).not.toContain("/b");
    }
  });

  it("is unavailable when no record is covered or the profile differs", () => {
    expect(
      coveredVectors(
        encodeVectorArtifact(profile.key, 2, []),
        profile,
        records,
      ),
    ).toBe(null);
    expect(
      coveredVectors(encodeVectorArtifact("other", 2, rows), profile, records),
    ).toBe(null);
    expect(
      coveredVectors(encodeVectorArtifact(profile.key, 2, rows), profile, [
        record("unrelated"),
      ]),
    ).toBe(null);
  });

  it("rejects a non-finite or non-unit row it would use", () => {
    for (const values of [
      [Number.NaN, 0],
      [0.5, 0],
    ]) {
      const bad = Buffer.from(new Float32Array(values).buffer);
      const tampered = rows.map(
        ([key, bytes], i) => [key, i === 1 ? bad : bytes] as const,
      );
      expect(() =>
        coveredVectors(
          encodeVectorArtifact(profile.key, 2, tampered),
          profile,
          records,
        ),
      ).toThrow(/Embedding row/);
    }
  });
});
