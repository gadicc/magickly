import { createHash } from "node:crypto";
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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseVectorArtifact,
  VECTOR_ARTIFACT,
} from "../../src/search/embeddings/artifact";
import { EMBEDDING_PROFILES } from "../../src/search/embeddings/profiles";
import {
  type EmbeddingRecord,
  embeddingRowKey,
} from "../../src/search/embeddings/records";
import { rowPath, writeRows } from "../../src/search/embeddings/rows";
import { buildVectorArtifact, vectorBuildReport } from "./vectors";

// search:build's vector step (buildProse.ts), on the shipped profile in a
// scratch root, with one-hot rows: any unit row will do.
const profile = EMBEDDING_PROFILES[0];
const record = (id: string): EmbeddingRecord => ({
  id,
  path: `/${id}`,
  title: id,
  section: "",
  text: `text of ${id}`,
  href: `/${id}`,
});
const records = Array.from({ length: 10 }, (_, i) => record(`page-${i}`));
const unit = (at: number) => {
  const values = new Float32Array(profile.dimensions);
  values[at] = 1;
  return new Uint8Array(values.buffer);
};
const rowFor = (entry: EmbeddingRecord, i: number) =>
  [embeddingRowKey(profile, entry), unit(i)] as const;

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "magickli-search-build-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const artifact = () => join(root, VECTOR_ARTIFACT);

describe("search:build's embedding artifact", () => {
  it("removes the artifact and skips the catalogue when no profile is selected", async () => {
    mkdirSync(join(artifact(), ".."), { recursive: true });
    writeFileSync(artifact(), "old");
    const catalogue = vi.fn(async () => records);
    const build = await buildVectorArtifact(root, null, catalogue);
    expect(build).toEqual({ profile: null });
    expect(catalogue).not.toHaveBeenCalled();
    expect(existsSync(artifact())).toBe(false);
    expect(vectorBuildReport(build)).toEqual({
      log: ["search: no embedding profile selected"],
      warn: [],
    });
  });

  it("fails on an unknown profile", async () => {
    await expect(
      buildVectorArtifact(root, "no-such-profile", async () => records),
    ).rejects.toThrow(/Unknown embedding profile: no-such-profile/);
  });

  it("fails on a malformed row", async () => {
    writeRows(root, profile.key, profile.dimensions, [rowFor(records[0], 0)]);
    writeFileSync(
      rowPath(root, profile.key, embeddingRowKey(profile, records[0])),
      new Uint8Array(8),
    );
    await expect(
      buildVectorArtifact(root, profile.key, async () => records),
    ).rejects.toThrow(/bytes/);
  });

  it("assembles every covered record's row and reports full coverage", async () => {
    writeRows(root, profile.key, profile.dimensions, records.map(rowFor));
    const build = await buildVectorArtifact(
      root,
      profile.key,
      async () => records,
    );
    // The record-order digest: each record's row, in catalogue order.
    const sha256 = createHash("sha256")
      .update(Buffer.concat(records.map((_, i) => unit(i))))
      .digest("hex");
    expect(build).toEqual({
      profile: profile.key,
      covered: 10,
      total: 10,
      rows: 10,
      orphans: 0,
      sha256,
    });
    expect(parseVectorArtifact(readFileSync(artifact())).keys).toHaveLength(10);
    expect(vectorBuildReport(build)).toEqual({
      log: [
        `search: 10/10 records have embedding rows for ${profile.key}; assembled 10 rows, 0 orphan rows left on disk`,
        `search: record-order matrix sha256 ${sha256} (10 rows)`,
      ],
      warn: [],
    });
  });

  it("leaves orphans out and warns below 90% coverage", async () => {
    // Two records have changed since the rows were written: 8/10 covered,
    // and the two rows for their old text are orphans.
    const old = [record("old-1"), record("old-2")];
    writeRows(root, profile.key, profile.dimensions, [
      ...records.slice(0, 8).map(rowFor),
      ...old.map(rowFor),
    ]);
    const build = await buildVectorArtifact(
      root,
      profile.key,
      async () => records,
    );
    expect(build).toMatchObject({ covered: 8, total: 10, rows: 8, orphans: 2 });
    expect(parseVectorArtifact(readFileSync(artifact())).keys).not.toContain(
      embeddingRowKey(profile, old[0]),
    );
    const { warn } = vectorBuildReport(build);
    expect(warn).toHaveLength(1);
    expect(warn[0]).toMatch(/only 8 of 10 records \(80\.0%\)/);
    expect(warn[0]).toMatch(/found by text only/);
    // 9 of 10 is not below 90%.
    if (!build.profile) throw new Error("expected a profile");
    expect(vectorBuildReport({ ...build, covered: 9 }).warn).toEqual([]);
  });

  it("says meaning search is unavailable at zero coverage", async () => {
    const build = await buildVectorArtifact(
      root,
      profile.key,
      async () => records,
    );
    expect(build).toMatchObject({ covered: 0, total: 10, rows: 0, orphans: 0 });
    expect(parseVectorArtifact(readFileSync(artifact())).keys).toEqual([]);
    expect(vectorBuildReport(build).warn[0]).toMatch(
      /Search by meaning is unavailable/,
    );
  });
});
