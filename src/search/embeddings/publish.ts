import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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

/**
 * Where the published matrices live. /api/search reads the artifact, not
 * these, but the service worker precaches every file here, so an earlier
 * matrix left behind is downloaded for nothing.
 */
export const MATRIX_DIRECTORY = "public/search-vectors";
/** The manifest naming the published matrix. */
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
export interface PublishedMatrix {
  /** The matrix's file name in `MATRIX_DIRECTORY`. */
  file: string;
  sha256: string;
  /** Row files written because they were missing or differed. */
  written: number;
  /** Row keys pruned because no record references them. */
  pruned: string[];
  /** The profile's earlier matrices, deleted once the manifest moved on. */
  removed: string[];
}

/**
 * Publishes `matrix`, whose row i is the vector for `keys[i]`: writes and
 * prunes the committed rows, writes the matrix under its hash, points the
 * manifest at it, deletes the profile's earlier matrices, and rebuilds the
 * artifact `search:build` assembles, so /api/search sees the rows without
 * another build. Rows go first and old matrices last, so a failure part way
 * leaves the old manifest naming a file that still exists.
 */
export function publishMatrix(
  root: string,
  profile: EmbeddingProfile,
  catalogueSha256: string,
  keys: readonly string[],
  matrix: Uint8Array,
): PublishedMatrix {
  const { written, pruned } = publishRows(root, profile, keys, matrix);
  const sha256 = digest(matrix);
  const file = `${profile.key}-${sha256.slice(0, 12)}.bin`;
  const directory = join(root, MATRIX_DIRECTORY);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, file), matrix);
  const manifest: SearchEmbeddingManifest = {
    version: 1,
    selected: profile.key,
    catalogueSha256,
    profiles: [{ profile, file, sha256, rows: keys.length }],
  };
  writeFileSync(join(root, MANIFEST), JSON.stringify(manifest, null, 2) + "\n");
  const earlier = new RegExp(`^${profile.key}-[0-9a-f]{12}\\.bin$`);
  const removed = readdirSync(directory).filter(
    (name) => name !== file && earlier.test(name),
  );
  for (const name of removed) rmSync(join(directory, name));
  mkdirSync(join(root, VECTOR_ARTIFACT, ".."), { recursive: true });
  writeFileSync(
    join(root, VECTOR_ARTIFACT),
    assembleVectorArtifact(root, profile, keys).bytes,
  );
  return { file, sha256, written, pruned, removed };
}
