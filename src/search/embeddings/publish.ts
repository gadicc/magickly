import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { VECTOR_ARTIFACT } from "./artifact";
import type { EmbeddingProfile } from "./profiles";
import { digest } from "./records";
import { assembleVectorArtifact, publishRows, readRow, rowPath } from "./rows";
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
    assembleVectorArtifact(root, profile).bytes,
  );
  return { file, sha256, written, pruned, removed };
}
