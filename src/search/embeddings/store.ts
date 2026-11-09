import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSearchCatalogue } from "../catalogue";
import { createSearchEngine } from "../engine";
import manifestData from "./manifest.json";
import { EMBEDDING_PROFILES, type EmbeddingProfile } from "./profiles";
import { catalogueDigest, digest, embeddingRecords } from "./records";

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
    JSON.stringify(expected) !== JSON.stringify(selected.profile) ||
    !/^[a-z0-9-]+\.bin$/.test(selected.file)
  )
    throw new Error("Invalid search embedding manifest");
  const catalogue = await buildSearchCatalogue();
  if (catalogueDigest(catalogue) !== manifest.catalogueSha256) return null;
  const records = embeddingRecords(catalogue);
  const bytes = readFileSync(
    join(process.cwd(), "public/search-vectors", selected.file),
  );
  if (
    digest(bytes) !== selected.sha256 ||
    records.length !== selected.rows ||
    bytes.length !== records.length * expected.dimensions * 4
  )
    throw new Error("Invalid search embedding artifact");
  const vectors = new Float32Array(records.length * expected.dimensions);
  for (let i = 0; i < vectors.length; i++) {
    vectors[i] = bytes.readFloatLE(i * 4);
    if (!Number.isFinite(vectors[i]))
      throw new Error("Invalid search vector value");
  }
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
