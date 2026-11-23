import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildSearchCatalogue } from "../catalogue";
import { createSearchEngine } from "../engine";
import type { SearchCatalogue } from "../types";
import {
  artifactCoverage,
  parseVectorArtifact,
  readVectorArtifactHeader,
  VECTOR_ARTIFACT,
} from "./artifact";
import manifestData from "./manifest.json";
import { EMBEDDING_PROFILES, type EmbeddingProfile } from "./profiles";
import { type EmbeddingRecord, embeddingRecords } from "./records";
import { decodeRow } from "./rowBytes";

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
 * The manifest's selected profile, or null when none is selected. Throws
 * when the manifest's copy of it differs from the registered profile, since
 * every row key hashes the whole profile.
 */
export function selectedProfile(
  manifest: SearchEmbeddingManifest = manifestData as SearchEmbeddingManifest,
): EmbeddingProfile | null {
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
  return expected;
}

/** The records meaning search ranks and their vectors, row i for record i. */
export interface CoveredVectors {
  /** The covered records, in catalogue record order. */
  records: EmbeddingRecord[];
  vectors: Float32Array;
  /** How many of the catalogue's records there are in all. */
  total: number;
}

/**
 * The covered records and their vectors from the keyed artifact (plan 087,
 * decision 2), or null when none is covered (another profile's artifact, or
 * no record's row), so meaning search is unavailable. Records without a row
 * are left out of dense ranking only; lexical search still has them. Each
 * record and its vector are taken together, by key, so they cannot
 * misalign. Every row used is validated: length, finite values and norm.
 */
export function coveredVectors(
  bytes: Buffer,
  profile: EmbeddingProfile,
  records: readonly EmbeddingRecord[],
): CoveredVectors | null {
  const artifact = parseVectorArtifact(bytes);
  const covered = artifactCoverage(artifact, profile, records);
  if (!covered.length) return null;
  const rowBytes = profile.dimensions * 4;
  const vectors = new Float32Array(covered.length * profile.dimensions);
  for (const [i, { row }] of covered.entries())
    vectors.set(
      decodeRow(
        artifact.matrix.subarray(row * rowBytes, (row + 1) * rowBytes),
        profile.dimensions,
      ),
      i * profile.dimensions,
    );
  return {
    records: covered.map(({ record }) => records[record]),
    vectors,
    total: records.length,
  };
}

// Assembled by `search:build` from the committed rows; see artifact.ts.
const artifactPath = () => join(process.cwd(), VECTOR_ARTIFACT);

/**
 * Whether meaning search is available for `catalogue`: a profile is
 * selected and the artifact covers at least one record. The rule
 * `loadSemanticIndex` applies, read from the artifact's header alone, so
 * `/search/index` never advertises what `/api/search` would refuse. A
 * missing artifact throws, as loading does.
 */
export function semanticAvailable(catalogue: SearchCatalogue): boolean {
  const profile = selectedProfile();
  if (!profile) return false;
  return (
    artifactCoverage(
      readVectorArtifactHeader(artifactPath()),
      profile,
      embeddingRecords(catalogue),
    ).length > 0
  );
}

async function readIndex() {
  const profile = selectedProfile();
  if (!profile) return null;
  const catalogue = await buildSearchCatalogue();
  const covered = coveredVectors(
    readFileSync(artifactPath()),
    profile,
    embeddingRecords(catalogue),
  );
  if (!covered) return null;
  return {
    profile,
    catalogue,
    ...covered,
    lexical: createSearchEngine(catalogue),
  };
}

/** Changes whenever `search:build` rewrites or removes the artifact. */
function artifactStamp() {
  try {
    const { mtimeMs, size } = statSync(artifactPath());
    return `${mtimeMs}:${size}`;
  } catch {
    return "missing";
  }
}

let loading: { stamp: string; index: ReturnType<typeof readIndex> } | undefined;

/**
 * The semantic index, or null when meaning search is unavailable. A row
 * is keyed by its record's exact input, so no stale vector is ever used: a
 * record whose text changed since the last publish simply has no row until
 * the next one (plan 087). Loaded once per artifact: when `search:build`
 * rewrites it (the dev watcher after a pull, say), the next call reloads,
 * so `/api/search` follows the same artifact `/search/index` reads.
 */
export function loadSemanticIndex() {
  const stamp = artifactStamp();
  if (loading?.stamp !== stamp) {
    const index = readIndex().catch((error) => {
      if (loading?.index === index) loading = undefined;
      throw error;
    });
    loading = { stamp, index };
  }
  return loading.index;
}
