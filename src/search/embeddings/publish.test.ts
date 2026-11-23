import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseVectorArtifact, VECTOR_ARTIFACT } from "./artifact";
import { EMBEDDING_PROFILES, type EmbeddingProfile } from "./profiles";
import {
  gatherMatrix,
  MANIFEST,
  matrixFromRows,
  missingRows,
  publishVectors,
  rowSources,
} from "./publish";
import { digest } from "./records";
import { encodeRow, listRowKeys, writeRows } from "./rows";
import type { SearchEmbeddingManifest } from "./store";

const profile: EmbeddingProfile = {
  ...EMBEDDING_PROFILES[0],
  key: "test-profile",
  dimensions: 4,
};
const other: EmbeddingProfile = { ...profile, key: "other-profile" };
const key = (seed: string) => seed.padEnd(64, "0");
// b2's norm is 1.0005, inside the rows' tolerance: decoding it and
// renormalising (unitVector) before re-encoding would change its bytes.
const offUnit = new Uint8Array(
  new Float32Array([0, 0, 0.6, 0.8].map((v) => v * 1.0005)).buffer,
);
const rows = [
  [key("a1"), encodeRow([0.6, 0.8, 0, 0], 4)],
  [key("b2"), offUnit],
  [key("c3"), encodeRow([0, 1, 0, 0], 4)],
] as const;
const manifest = (root: string): SearchEmbeddingManifest =>
  JSON.parse(readFileSync(join(root, MANIFEST), "utf8"));

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "magickli-search-publish-"));
  mkdirSync(join(root, "src/search/embeddings"), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("matrixFromRows", () => {
  it("concatenates the committed rows' exact bytes in the keys' order", () => {
    writeRows(root, profile.key, 4, rows);
    const matrix = matrixFromRows(root, profile, [key("c3"), key("a1")]);
    expect(matrix.equals(Buffer.concat([rows[2][1], rows[0][1]]))).toBe(true);
  });
  it("names the rows that are not committed", () => {
    writeRows(root, profile.key, 4, rows.slice(0, 1));
    expect(
      missingRows(root, profile, [key("a1"), key("d4"), key("e5")]),
    ).toEqual([1, 2]);
    expect(() => matrixFromRows(root, profile, [key("a1"), key("d4")])).toThrow(
      `1 of 2 rows are not committed: ${key("d4")}`,
    );
  });
  it("rejects a row of the wrong size rather than copying it", () => {
    writeRows(root, profile.key, 4, rows.slice(0, 1));
    expect(() =>
      matrixFromRows(root, { ...profile, dimensions: 3 }, [key("a1")]),
    ).toThrow(/bytes/);
  });
});

describe("the publish lookup order", () => {
  // a1 and b2 are committed; b2 and c3 are also cached; d4 is in neither.
  const keys = [key("d4"), key("b2"), key("c3"), key("a1")];
  const cache = new Map<string, number[]>([
    [key("b2"), [0, 0, 0, 3]],
    [key("c3"), [0, 0, 2, 0]],
  ]);
  beforeEach(() => writeRows(root, profile.key, 4, rows.slice(0, 2)));

  it("takes committed rows first, then the cache, then the provider", () => {
    expect(rowSources(root, profile, keys, (k) => cache.has(k))).toEqual([
      "provider",
      "committed",
      "cache",
      "committed",
    ]);
  });

  it("copies committed rows as bytes and asks the provider only for the rest", async () => {
    const asked: number[][] = [];
    const matrix = await gatherMatrix(
      root,
      profile,
      keys,
      rowSources(root, profile, keys, (k) => cache.has(k)),
      {
        readCache: (k) => cache.get(k) ?? [],
        async embed(positions) {
          asked.push(positions);
          return positions.map(() => [2, 0, 0, 0]);
        },
      },
    );
    expect(asked).toEqual([[0]]);
    // b2's committed row is off unit length: copied, not renormalised, so
    // its bytes stay the committed ones rather than the cache's [0,0,0,1].
    expect(
      matrix.equals(
        Buffer.concat([
          encodeRow([1, 0, 0, 0], 4),
          offUnit,
          encodeRow([0, 0, 1, 0], 4),
          rows[0][1],
        ]),
      ),
    ).toBe(true);
  });

  it("batches provider rows and checks what comes back", async () => {
    const asked: number[][] = [];
    const all = [key("e5"), key("f6"), key("e7")];
    const sources = rowSources(root, profile, all, () => false);
    await gatherMatrix(
      root,
      profile,
      all,
      sources,
      {
        readCache: () => [],
        async embed(positions) {
          asked.push(positions);
          return positions.map(() => [0, 1, 0, 0]);
        },
      },
      2,
    );
    expect(asked).toEqual([[0, 1], [2]]);
    await expect(
      gatherMatrix(root, profile, all, sources, {
        readCache: () => [],
        embed: async () => [],
      }),
    ).rejects.toThrow(/wrong number/);
    await expect(
      gatherMatrix(root, profile, all, sources, {
        readCache: () => [],
        embed: async (positions) => positions.map(() => [0, 0, 0]),
      }),
    ).rejects.toThrow(/Incompatible/);
  });
});

describe("publishVectors", () => {
  it("writes the rows, the manifest and the artifact, and nothing under public/", () => {
    const keys = rows.map(([k]) => k);
    const matrix = Buffer.concat(rows.map(([, bytes]) => bytes));
    const published = publishVectors(root, profile, keys, matrix);
    expect(published).toEqual({
      written: 3,
      pruned: [],
      sha256: digest(matrix),
    });
    expect(listRowKeys(root, profile.key)).toEqual([...keys].sort());
    expect(manifest(root)).toEqual({
      version: 2,
      selected: "test-profile",
      profile,
    });
    const artifact = parseVectorArtifact(
      readFileSync(join(root, VECTOR_ARTIFACT)),
    );
    expect(artifact.profile).toBe("test-profile");
    expect(artifact.keys).toEqual([...keys].sort());
    // The rows are the only published form of the vectors (plan 087, S3).
    expect(existsSync(join(root, "public"))).toBe(false);
  });

  it("reproduces a publish from its committed rows alone", () => {
    const keys = rows.map(([k]) => k);
    const matrix = Buffer.concat(rows.map(([, bytes]) => bytes));
    const first = publishVectors(root, profile, keys, matrix);
    const before = readFileSync(join(root, MANIFEST), "utf8");
    const again = publishVectors(
      root,
      profile,
      keys,
      matrixFromRows(root, profile, keys),
    );
    expect(again).toEqual({ ...first, written: 0 });
    expect(readFileSync(join(root, MANIFEST), "utf8")).toBe(before);
  });

  it("prunes only the published profile's unreferenced rows", () => {
    writeRows(root, profile.key, 4, rows);
    writeRows(root, other.key, 4, rows);
    const keys = [key("a1"), key("c3")];
    const published = publishVectors(
      root,
      profile,
      keys,
      matrixFromRows(root, profile, keys),
    );
    expect(published.pruned).toEqual([key("b2")]);
    expect(listRowKeys(root, profile.key)).toEqual(keys);
    expect(listRowKeys(root, other.key)).toHaveLength(3);
  });

  it("leaves the artifact alone when the manifest cannot be written", () => {
    mkdirSync(join(root, MANIFEST));
    expect(() =>
      publishVectors(root, profile, [key("a1")], rows[0][1]),
    ).toThrow();
    expect(existsSync(join(root, VECTOR_ARTIFACT))).toBe(false);
  });

  it("leaves the manifest alone when the rows cannot be written", () => {
    writeFileSync(join(root, MANIFEST), "old\n");
    expect(() =>
      publishVectors(root, profile, [key("a1")], new Uint8Array(4)),
    ).toThrow(/does not match/);
    expect(readFileSync(join(root, MANIFEST), "utf8")).toBe("old\n");
    expect(listRowKeys(root, profile.key)).toEqual([]);
  });
});
