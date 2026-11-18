import { describe, expect, it } from "vitest";
import {
  encodeVectorArtifact,
  parseVectorArtifact,
  recordMatrix,
} from "./artifact";
import { EMBEDDING_PROFILES, type EmbeddingProfile } from "./profiles";
import { digest, type EmbeddingRecord, embeddingRowKey } from "./records";
import { encodeRow } from "./rows";
import { artifactVectors } from "./store";

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
    for (const order of [
      rows,
      [...rows].reverse(),
      [rows[1], rows[2], rows[0]],
    ])
      expect(
        recordMatrix(
          parseVectorArtifact(encodeVectorArtifact(profile.key, 2, order)),
          profile,
          records,
        )?.equals(matrix),
      ).toBe(true);
    const shuffled = [records[2], records[0], records[1]];
    expect(
      recordMatrix(
        parseVectorArtifact(encodeVectorArtifact(profile.key, 2, rows)),
        profile,
        shuffled,
      )?.equals(Buffer.concat([rows[2][1], rows[0][1], rows[1][1]])),
    ).toBe(true);
  });

  it("has no matrix for another profile or a record without a row", () => {
    const artifact = parseVectorArtifact(
      encodeVectorArtifact(profile.key, 2, rows),
    );
    expect(recordMatrix(artifact, { ...profile, key: "other" }, records)).toBe(
      null,
    );
    expect(
      recordMatrix(artifact, profile, [...records, record("missing")]),
    ).toBe(null);
    const partial = parseVectorArtifact(
      encodeVectorArtifact(profile.key, 2, rows.slice(1)),
    );
    expect(recordMatrix(partial, profile, records)).toBe(null);
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
  it("returns every record's vector in record order", () => {
    const vectors = artifactVectors(
      encodeVectorArtifact(profile.key, 2, [...rows].reverse()),
      profile,
      records,
      digest(matrix),
    );
    expect(Array.from(vectors ?? [])).toEqual(
      Array.from(new Float32Array([1, 0, 0, 1, 0.6, 0.8])),
    );
  });

  it("is unavailable when any record has no row", () => {
    expect(
      artifactVectors(
        encodeVectorArtifact(profile.key, 2, rows.slice(0, 2)),
        profile,
        records,
        digest(matrix),
      ),
    ).toBe(null);
  });

  it("throws when the rebuilt matrix differs from the manifest checksum", () => {
    expect(() =>
      artifactVectors(
        encodeVectorArtifact(profile.key, 2, rows),
        profile,
        records,
        "0".repeat(64),
      ),
    ).toThrow(/artifact/);
  });

  it("rejects a non-finite value even under a matching checksum", () => {
    const bad = Buffer.alloc(8);
    bad.writeFloatLE(Number.NaN, 0);
    const tampered = rows.map(
      ([key, bytes], i) => [key, i === 1 ? bad : bytes] as const,
    );
    expect(() =>
      artifactVectors(
        encodeVectorArtifact(profile.key, 2, tampered),
        profile,
        records,
        digest(Buffer.concat(tampered.map(([, bytes]) => bytes))),
      ),
    ).toThrow(/value/);
  });
});
