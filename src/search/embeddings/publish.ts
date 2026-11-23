import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { VECTOR_ARTIFACT } from "./artifact";
import { type EmbeddingProfile, unitVector } from "./profiles";
import { digest } from "./records";
import {
  assembleVectorArtifact,
  encodeRow,
  publishRows,
  readRow,
  rowPath,
} from "./rows";
import type { SearchEmbeddingManifest } from "./store";

/**
 * The last steps of a publish, shared by `search:publish` (vectors from the
 * provider or its cache) and `search:assemble` (vectors from committed rows
 * alone). Node-only, like rows.ts.
 */

/** The manifest recording the selected profile (store.ts). */
export const MANIFEST = "src/search/embeddings/manifest.json";

/** Positions in `keys` whose row is not committed. */
export function missingRows(
  root: string,
  profile: EmbeddingProfile,
  keys: readonly string[],
): number[] {
  return keys.flatMap((key, i) =>
    existsSync(rowPath(root, profile.key, key)) ? [] : [i],
  );
}

/**
 * The committed rows for `keys`, in that order, as one matrix. The row
 * files' bytes are copied as they are, never decoded and re-encoded, so the
 * matrix reproduces the published bytes exactly (plan 087, S2).
 */
export function matrixFromRows(
  root: string,
  profile: EmbeddingProfile,
  keys: readonly string[],
): Buffer {
  const missing = missingRows(root, profile, keys);
  if (missing.length)
    throw new Error(
      `${missing.length} of ${keys.length} rows are not committed: ${missing
        .slice(0, 5)
        .map((i) => keys[i])
        .join(", ")}${missing.length > 5 ? ", …" : ""}`,
    );
  const rowBytes = profile.dimensions * 4;
  const matrix = Buffer.alloc(keys.length * rowBytes);
  for (const [i, key] of keys.entries())
    readRow(root, profile.key, key, profile.dimensions).copy(
      matrix,
      i * rowBytes,
    );
  return matrix;
}

/** Where a publish takes a row from, in this order of preference. */
export type RowSource = "committed" | "cache" | "provider";

/**
 * Where each key's row comes from (plan 087, S2): the committed row if
 * there is one, else the worktree's private cache (`cached`), else the
 * provider. Only "provider" rows cost anything.
 */
export function rowSources(
  root: string,
  profile: EmbeddingProfile,
  keys: readonly string[],
  cached: (key: string) => boolean,
): RowSource[] {
  return keys.map((key) =>
    existsSync(rowPath(root, profile.key, key))
      ? "committed"
      : cached(key)
        ? "cache"
        : "provider",
  );
}

/** How `gatherMatrix` reads the cache and calls the provider. */
export interface RowFetchers {
  /** The cached raw vector for a "cache" row's key. */
  readCache(key: string): readonly number[];
  /**
   * Embeds the rows at these positions with the provider, returning their
   * raw vectors in the same order; the caller caches them. Called only for
   * "provider" rows, at most `batch` at a time.
   */
  embed(positions: number[]): Promise<readonly (readonly number[])[]>;
}

/**
 * The matrix for `keys`, row i from `sources[i]`. A committed row's bytes
 * are copied as they are, never decoded and renormalised, so a republish
 * reproduces them exactly (plan 087, S2); a cached or provider vector is
 * normalised (`unitVector`) and encoded as a row.
 */
export async function gatherMatrix(
  root: string,
  profile: EmbeddingProfile,
  keys: readonly string[],
  sources: readonly RowSource[],
  fetchers: RowFetchers,
  batch = 32,
): Promise<Buffer> {
  if (sources.length !== keys.length)
    throw new Error("Embedding row sources do not match their keys");
  const rowBytes = profile.dimensions * 4;
  const matrix = Buffer.alloc(keys.length * rowBytes);
  const put = (i: number, vector: readonly number[]) =>
    matrix.set(
      encodeRow(unitVector(vector, profile.dimensions), profile.dimensions),
      i * rowBytes,
    );
  const requested: number[] = [];
  for (const [i, key] of keys.entries()) {
    if (sources[i] === "committed")
      readRow(root, profile.key, key, profile.dimensions).copy(
        matrix,
        i * rowBytes,
      );
    else if (sources[i] === "cache") put(i, fetchers.readCache(key));
    else requested.push(i);
  }
  for (let offset = 0; offset < requested.length; offset += batch) {
    const positions = requested.slice(offset, offset + batch);
    const vectors = await fetchers.embed(positions);
    if (vectors.length !== positions.length)
      throw new Error("The provider returned the wrong number of embeddings");
    for (const [j, i] of positions.entries()) put(i, vectors[j]);
  }
  return matrix;
}

/** What a publish wrote and removed. */
export interface PublishedVectors {
  /** Row files written because they were missing or differed. */
  written: number;
  /** Row keys pruned because no record references them. */
  pruned: string[];
  /**
   * SHA-256 of `matrix`, the rows in catalogue record order: what
   * `search:build` prints as the record-order digest once every record has
   * a row (plan 087, S3).
   */
  sha256: string;
}

/**
 * Publishes `matrix`, whose row i is the vector for `keys[i]`: writes and
 * prunes the committed rows, writes the manifest, and rebuilds the
 * artifact `search:build` assembles, so /api/search sees the rows without
 * another build. The rows are the only published form of the vectors
 * (plan 087, S3); nothing is written under `public/`. Rows go first, so a
 * failure part way leaves the old manifest in place.
 */
export function publishVectors(
  root: string,
  profile: EmbeddingProfile,
  keys: readonly string[],
  matrix: Uint8Array,
): PublishedVectors {
  const { written, pruned } = publishRows(root, profile, keys, matrix);
  const manifest: SearchEmbeddingManifest = {
    version: 2,
    selected: profile.key,
    profile,
  };
  writeFileSync(join(root, MANIFEST), JSON.stringify(manifest, null, 2) + "\n");
  mkdirSync(join(root, VECTOR_ARTIFACT, ".."), { recursive: true });
  writeFileSync(
    join(root, VECTOR_ARTIFACT),
    assembleVectorArtifact(root, profile, keys).bytes,
  );
  return { written, pruned, sha256: digest(matrix) };
}
