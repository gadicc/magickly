import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSearchCatalogue } from "../catalogue";
import { createSearchEngine } from "../engine";
import { parseVectorArtifact, recordMatrix, VECTOR_ARTIFACT } from "./artifact";
import manifestData from "./manifest.json";
import { EMBEDDING_PROFILES, type EmbeddingProfile } from "./profiles";
import {
  catalogueDigest,
  digest,
  type EmbeddingRecord,
  embeddingRecords,
} from "./records";

export interface SearchEmbeddingManifest {
  version: 1;
  selected: string | null;
  catalogueSha256: string;
  profiles: {
    profile: EmbeddingProfile;
    file: string;
    sha256: string;
    rows: number;
  }[];
}

/**
 * Every record's vector from the keyed artifact, in record order, or null
 * when the artifact is for another profile or lacks any record's row (as
 * on a catalogue mismatch, semantic search is then unavailable). Rows are
 * found by key, never by position. Until plan 087 S2 drops it, the matrix
 * rebuilt in record order must still hash to the manifest's `sha256`.
 */
export function artifactVectors(
  bytes: Buffer,
  profile: EmbeddingProfile,
  records: readonly EmbeddingRecord[],
  sha256: string,
): Float32Array | null {
  const matrix = recordMatrix(parseVectorArtifact(bytes), profile, records);
  if (!matrix) return null;
  if (digest(matrix) !== sha256)
    throw new Error("Invalid search embedding artifact");
  const vectors = new Float32Array(records.length * profile.dimensions);
  for (let i = 0; i < vectors.length; i++) {
    vectors[i] = matrix.readFloatLE(i * 4);
    if (!Number.isFinite(vectors[i]))
      throw new Error("Invalid search vector value");
  }
  return vectors;
}

let loading: ReturnType<typeof readIndex> | undefined;
async function readIndex() {
  const manifest = manifestData as SearchEmbeddingManifest;
  if (!manifest.selected) return null;
  const selected = manifest.profiles.find(
    (entry) => entry.profile.key === manifest.selected,
  );
  const expected = EMBEDDING_PROFILES.find(
    (profile) => profile.key === manifest.selected,
  );
  if (
    !selected ||
    !expected ||
    JSON.stringify(expected) !== JSON.stringify(selected.profile)
  )
    throw new Error("Invalid search embedding manifest");
  const catalogue = await buildSearchCatalogue();
  if (catalogueDigest(catalogue) !== manifest.catalogueSha256) return null;
  const records = embeddingRecords(catalogue);
  if (records.length !== selected.rows)
    throw new Error("Invalid search embedding artifact");
  // Assembled by `search:build` from the committed rows; see artifact.ts.
  const vectors = artifactVectors(
    readFileSync(join(process.cwd(), VECTOR_ARTIFACT)),
    expected,
    records,
    selected.sha256,
  );
  if (!vectors) return null;
  return {
    profile: expected,
    catalogue,
    records,
    vectors,
    lexical: createSearchEngine(catalogue),
  };
}

/** A stale catalogue never uses old vectors; refreshing needs an explicit index job. */
export function loadSemanticIndex() {
  loading ??= readIndex().catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
