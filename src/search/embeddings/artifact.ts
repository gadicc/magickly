import { closeSync, fstatSync, openSync, readSync } from "node:fs";
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
 * It holds only the rows some record referenced when it was assembled
 * (plan 087, S2). Readers look rows up by key, never by position, so an
 * artifact older or newer than the catalogue can only lack rows, never pair
 * a vector with the wrong record.
 */
export const VECTOR_ARTIFACT = "src/search/generated/search-vectors.bin";

const MAGIC = "SVK1";
const ROW_KEY = /^[0-9a-f]{64}$/;

/** An artifact's header: which profile, and which rows, it holds. */
export interface VectorArtifactHeader {
  profile: string;
  dimensions: number;
  /** Row keys, strictly ascending; row i of the matrix is `keys[i]`. */
  keys: string[];
}

/** A parsed artifact; `matrix` holds the raw little-endian row bytes. */
export interface VectorArtifact extends VectorArtifactHeader {
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

const invalid = () => new Error("Invalid search vector artifact");

/** The header's length H from the first 8 bytes, after checking the magic. */
function headerLength(prefix: Buffer) {
  if (prefix.length < 8 || prefix.toString("ascii", 0, 4) !== MAGIC)
    throw invalid();
  const length = prefix.readUInt32LE(4);
  if (length % 4) throw invalid();
  return length;
}

/**
 * Parses and validates the header, given its length and the artifact's
 * total size, so the matrix length is checked without reading the matrix.
 */
function parseHeader(
  json: string,
  length: number,
  size: number,
): VectorArtifactHeader {
  let header: unknown;
  try {
    header = JSON.parse(json);
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
    ) ||
    size !== 8 + length + keys.length * (dimensions as number) * 4
  )
    throw invalid();
  return { profile, dimensions: dimensions as number, keys };
}

/** Parses and structurally validates an artifact; throws if it is malformed. */
export function parseVectorArtifact(bytes: Buffer): VectorArtifact {
  const length = headerLength(bytes);
  if (8 + length > bytes.length) throw invalid();
  const json = bytes.toString("utf8", 8, 8 + length);
  return {
    ...parseHeader(json, length, bytes.length),
    matrix: bytes.subarray(8 + length),
  };
}

/**
 * Reads and validates only an artifact's header, and checks the file's size
 * against it, without reading the matrix: what `/search/index` needs to
 * decide whether meaning search is available. Throws if the file is missing
 * or malformed, as loading the whole artifact would.
 */
export function readVectorArtifactHeader(path: string): VectorArtifactHeader {
  const file = openSync(path, "r");
  try {
    const size = fstatSync(file).size;
    const prefix = Buffer.alloc(8);
    const length = headerLength(
      prefix.subarray(0, readSync(file, prefix, 0, 8, 0)),
    );
    if (8 + length > size) throw invalid();
    const header = Buffer.alloc(length);
    if (readSync(file, header, 0, length, 8) !== length) throw invalid();
    return parseHeader(header.toString("utf8"), length, size);
  } finally {
    closeSync(file);
  }
}

/** A record the artifact has a row for: its position in each. */
export interface CoveredRecord {
  /** The record's position in the records given. */
  record: number;
  /** Its row's position in the artifact's matrix. */
  row: number;
}

/**
 * The records the artifact covers under `profile`, in record order, each
 * found by its key, never by position (plan 087, decision 2). Records
 * without a row are left out; none are covered when the artifact is for
 * another profile. Meaning search is available exactly when this is not
 * empty, the one rule `/api/search` and `/search/index` share (store.ts).
 */
export function artifactCoverage(
  header: VectorArtifactHeader,
  profile: EmbeddingProfile,
  records: readonly EmbeddingRecord[],
): CoveredRecord[] {
  if (
    header.profile !== profile.key ||
    header.dimensions !== profile.dimensions
  )
    return [];
  const index = new Map(header.keys.map((key, i) => [key, i]));
  return records.flatMap((record, i) => {
    const row = index.get(embeddingRowKey(profile, record));
    return row === undefined ? [] : [{ record: i, row }];
  });
}
