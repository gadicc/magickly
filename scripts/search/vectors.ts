import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { VECTOR_ARTIFACT } from "../../src/search/embeddings/artifact";
import { EMBEDDING_PROFILES } from "../../src/search/embeddings/profiles";
import {
  type EmbeddingRecord,
  embeddingRowKey,
} from "../../src/search/embeddings/records";
import { assembleVectorArtifact } from "../../src/search/embeddings/rows";

/** Below this share of covered records, `search:build` warns (plan 087). */
export const COVERAGE_WARNING = 0.9;

/** What `search:build` assembled for meaning search. */
export type VectorBuild =
  | { profile: null }
  | {
      profile: string;
      /** Records with a committed row. */
      covered: number;
      /** Records in the catalogue. */
      total: number;
      /** Distinct rows in the artifact. */
      rows: number;
      /** Rows on disk no record references, left out of the artifact. */
      orphans: number;
      /**
       * SHA-256 of the covered records' rows in catalogue record order,
       * the matrix the store ranks (rows.ts); comparable across history.
       */
      sha256: string;
    };

/** Writes only on change, so watchers and incremental builds stay quiet. */
export function update(output: string, next: string | Buffer) {
  if (!existsSync(output) || !readFileSync(output).equals(Buffer.from(next)))
    writeFileSync(output, next);
}

/**
 * Assembles the selected profile's committed rows that some record
 * references into the keyed artifact, and reports coverage (plan 087, S2).
 * With no profile selected the artifact is removed; an unknown profile or a
 * malformed row throws. `records` is called only when a profile is
 * selected, since building the catalogue is most of the cost.
 */
export async function buildVectorArtifact(
  root: string,
  selected: string | null,
  records: () => Promise<readonly EmbeddingRecord[]>,
): Promise<VectorBuild> {
  const artifact = resolve(root, VECTOR_ARTIFACT);
  const profile = EMBEDDING_PROFILES.find((entry) => entry.key === selected);
  if (!profile) {
    if (selected) throw new Error(`Unknown embedding profile: ${selected}`);
    rmSync(artifact, { force: true });
    return { profile: null };
  }
  const keys = (await records()).map((record) =>
    embeddingRowKey(profile, record),
  );
  const assembled = assembleVectorArtifact(root, profile, keys);
  mkdirSync(dirname(artifact), { recursive: true });
  update(artifact, assembled.bytes);
  return {
    profile: profile.key,
    covered: assembled.covered,
    total: keys.length,
    rows: assembled.rows,
    orphans: assembled.orphans,
    sha256: assembled.sha256,
  };
}

/** What `search:build` prints about meaning search; warnings go to stderr. */
export function vectorBuildReport(build: VectorBuild) {
  if (!build.profile)
    return { log: ["search: no embedding profile selected"], warn: [] };
  const { profile, covered, total, rows, orphans, sha256 } = build;
  const log = [
    `search: ${covered}/${total} records have embedding rows for ${profile}; ` +
      `assembled ${rows} rows, ${orphans} orphan rows left on disk`,
    // The published vectors' digest, now that no matrix is committed: at
    // full coverage, what the manifest's `sha256` was (plan 087, S3).
    `search: record-order matrix sha256 ${sha256} (${covered} records)`,
  ];
  const warn: string[] = [];
  if (covered < total * COVERAGE_WARNING)
    warn.push(
      `search: warning: only ${covered} of ${total} records ` +
        `(${((covered / Math.max(total, 1)) * 100).toFixed(1)}%) have embedding rows. ` +
        (covered
          ? "The rest are found by text only"
          : "Search by meaning is unavailable") +
        ` until \`pnpm search:publish ${profile}\` (plan 087).`,
    );
  return { log, warn };
}
