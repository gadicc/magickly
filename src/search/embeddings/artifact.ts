import type { EmbeddingProfile } from "./profiles";
import { type EmbeddingRecord, embeddingRowKey } from "./records";

/**
 * The keyed vector artifact `search:build` assembles from the committed
 * rows (plan 087, decision 3), ignored by git and traced into `/api/search`.
 * One file, so its keys and matrix can never come from different builds:
 *
 * - bytes 0–3: the ASCII magic `SVK1`;
 * - bytes 4–7: the header's length H, a little-endian uint32, a multiple
 *   of 4 so the matrix stays aligned;
 * - bytes 8 to 8+H: UTF-8 JSON `{ profile, dimensions, keys }`, padded with
 *   spaces, where `profile` is the profile key and `keys` are the row keys
 *   in strictly ascending order;
 * - the rest: `keys.length × dimensions` little-endian float32 values,
 *   row i being `keys[i]`.
 *
 * Readers look rows up by key, never by position, so an artifact older or
 * newer than the catalogue can only lack rows, never pair a vector with the
 * wrong record.
 */
export const VECTOR_ARTIFACT = "src/search/generated/search-vectors.bin";

const MAGIC = "SVK1";
const ROW_KEY = /^[0-9a-f]{64}$/;

/** A parsed artifact; `matrix` holds the raw little-endian row bytes. */
export interface VectorArtifact {
  profile: string;
  dimensions: number;
  keys: string[];
  matrix: Buffer;
}

/** Encodes rows, in any order, as an artifact. Each row must be `dimensions` float32 values. */
export function encodeVectorArtifact(
  profile: string,
  dimensions: number,
  rows: Iterable<readonly [key: string, bytes: Uint8Array]>,
): Buffer {
  const sorted = [...rows].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const keys = sorted.map(([key]) => key);
  for (const [i, [key, bytes]] of sorted.entries()) {
    if (!ROW_KEY.test(key) || (i && keys[i - 1] === key))
      throw new Error(`Invalid or repeated embedding row key: ${key}`);
    if (bytes.byteLength !== dimensions * 4)
      throw new Error(`Embedding row ${key} has the wrong length`);
  }
  let header = Buffer.from(JSON.stringify({ profile, dimensions, keys }));
  header = Buffer.concat([
    header,
    Buffer.alloc((4 - (header.length % 4)) % 4, " "),
  ]);
  const prefix = Buffer.alloc(8);
  prefix.write(MAGIC, 0, "ascii");
  prefix.writeUInt32LE(header.length, 4);
  return Buffer.concat([prefix, header, ...sorted.map(([, bytes]) => bytes)]);
}

/** Parses and structurally validates an artifact; throws if it is malformed. */
export function parseVectorArtifact(bytes: Buffer): VectorArtifact {
  const invalid = () => new Error("Invalid search vector artifact");
  if (bytes.length < 8 || bytes.toString("ascii", 0, 4) !== MAGIC)
    throw invalid();
  const length = bytes.readUInt32LE(4);
  if (length % 4 || 8 + length > bytes.length) throw invalid();
  let header: unknown;
  try {
    header = JSON.parse(bytes.toString("utf8", 8, 8 + length));
  } catch {
    throw invalid();
  }
  const { profile, dimensions, keys } = (header ?? {}) as Record<
    string,
    unknown
  >;
  if (
    typeof profile !== "string" ||
    !Number.isInteger(dimensions) ||
    (dimensions as number) <= 0 ||
    !Array.isArray(keys) ||
    !keys.every(
      (key, i) =>
        typeof key === "string" &&
        ROW_KEY.test(key) &&
        (!i || keys[i - 1] < key),
    )
  )
    throw invalid();
  const matrix = bytes.subarray(8 + length);
  if (matrix.length !== keys.length * (dimensions as number) * 4)
    throw invalid();
  return { profile, dimensions: dimensions as number, keys, matrix };
}

/**
 * The raw bytes of every record's row, in record order, looked up by each
 * record's key under `profile`; null when the artifact is for another
 * profile or lacks any record's row.
 */
export function recordMatrix(
  artifact: VectorArtifact,
  profile: EmbeddingProfile,
  records: readonly EmbeddingRecord[],
): Buffer | null {
  if (
    artifact.profile !== profile.key ||
    artifact.dimensions !== profile.dimensions
  )
    return null;
  const rowBytes = profile.dimensions * 4;
  const index = new Map(artifact.keys.map((key, i) => [key, i]));
  const matrix = Buffer.alloc(records.length * rowBytes);
  for (const [row, record] of records.entries()) {
    const at = index.get(embeddingRowKey(profile, record));
    if (at === undefined) return null;
    artifact.matrix.copy(
      matrix,
      row * rowBytes,
      at * rowBytes,
      (at + 1) * rowBytes,
    );
  }
  return matrix;
}
