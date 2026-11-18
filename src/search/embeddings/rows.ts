import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { encodeVectorArtifact } from "./artifact";
import type { EmbeddingProfile } from "./profiles";

/**
 * Committed embedding rows (plan 087, decision 1): one file per row,
 * `search-vectors/<profile-key>/<first two hex of key>/<key>.f32`, holding
 * the row's float32 values little-endian, unit length. The key is
 * `embeddingRowKey` (records.ts), so a row only ever serves the exact input
 * it was made from. Node-only: publishing writes rows, `search:build`
 * assembles them (artifact.ts); nothing at runtime reads this directory.
 */
export const ROWS_DIRECTORY = "search-vectors";

const ROW_KEY = /^[0-9a-f]{64}$/;
const PROFILE_KEY = /^[a-z0-9-]+$/;
/** float32 rounding of a unit vector stays far inside this. */
const NORM_TOLERANCE = 1e-3;

function checkProfileKey(profileKey: string) {
  if (!PROFILE_KEY.test(profileKey))
    throw new Error(`Invalid embedding profile key: ${profileKey}`);
}

function checkRowKey(key: string) {
  if (!ROW_KEY.test(key)) throw new Error(`Invalid embedding row key: ${key}`);
}

/** The directory holding one profile's rows. */
export function profileRowDirectory(root: string, profileKey: string) {
  checkProfileKey(profileKey);
  return join(root, ROWS_DIRECTORY, profileKey);
}

/** Where the row named `key` lives. */
export function rowPath(root: string, profileKey: string, key: string) {
  checkRowKey(key);
  return join(
    profileRowDirectory(root, profileKey),
    key.slice(0, 2),
    `${key}.f32`,
  );
}

/**
 * Decodes and validates one row: exactly `dimensions` float32 values, all
 * finite, with an L2 norm within a small tolerance of 1.
 */
export function decodeRow(bytes: Uint8Array, dimensions: number) {
  if (bytes.byteLength !== dimensions * 4)
    throw new Error(
      `Embedding row has ${bytes.byteLength} bytes, not ${dimensions * 4}`,
    );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = new Float32Array(dimensions);
  let sum = 0;
  for (let i = 0; i < dimensions; i++) {
    values[i] = view.getFloat32(i * 4, true);
    if (!Number.isFinite(values[i]))
      throw new Error("Embedding row has a non-finite value");
    sum += values[i] * values[i];
  }
  if (Math.abs(Math.sqrt(sum) - 1) > NORM_TOLERANCE)
    throw new Error("Embedding row is not unit length");
  return values;
}

/** Encodes a unit vector as a row's bytes, validating it the same way. */
export function encodeRow(vector: ArrayLike<number>, dimensions: number) {
  const bytes = new Uint8Array(vector.length * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < vector.length; i++)
    view.setFloat32(i * 4, vector[i], true);
  decodeRow(bytes, dimensions);
  return bytes;
}

/** Reads and validates the row named `key`. */
export function readRow(
  root: string,
  profileKey: string,
  key: string,
  dimensions: number,
) {
  const bytes = readFileSync(rowPath(root, profileKey, key));
  decodeRow(bytes, dimensions);
  return bytes;
}

/**
 * Every row key a profile has on disk, sorted. Dot files are ignored;
 * anything else that is not a correctly placed `<key>.f32` is an error.
 */
export function listRowKeys(root: string, profileKey: string): string[] {
  const directory = profileRowDirectory(root, profileKey);
  if (!existsSync(directory)) return [];
  const keys: string[] = [];
  for (const fan of readdirSync(directory, { withFileTypes: true })) {
    if (fan.name.startsWith(".")) continue;
    if (!fan.isDirectory() || !/^[0-9a-f]{2}$/.test(fan.name))
      throw new Error(`Unexpected entry in ${directory}: ${fan.name}`);
    for (const file of readdirSync(join(directory, fan.name))) {
      if (file.startsWith(".")) continue;
      const key = file.slice(0, -".f32".length);
      if (
        !file.endsWith(".f32") ||
        !ROW_KEY.test(key) ||
        !key.startsWith(fan.name)
      )
        throw new Error(
          `Unexpected entry in ${directory}/${fan.name}: ${file}`,
        );
      keys.push(key);
    }
  }
  return keys.sort();
}

/**
 * Writes rows that are missing or differ, validating each first. Returns
 * how many files it wrote.
 */
export function writeRows(
  root: string,
  profileKey: string,
  dimensions: number,
  rows: Iterable<readonly [key: string, bytes: Uint8Array]>,
) {
  let written = 0;
  for (const [key, bytes] of rows) {
    decodeRow(bytes, dimensions);
    const path = rowPath(root, profileKey, key);
    if (existsSync(path) && Buffer.from(bytes).equals(readFileSync(path)))
      continue;
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, bytes);
    written++;
  }
  return written;
}

/**
 * Deletes a profile's rows whose keys are not in `keep` (rows the catalogue
 * no longer references) and any fan-out directory left empty. Returns the
 * deleted keys.
 */
export function pruneRows(
  root: string,
  profileKey: string,
  keep: ReadonlySet<string>,
) {
  const pruned = listRowKeys(root, profileKey).filter((key) => !keep.has(key));
  for (const key of pruned) rmSync(rowPath(root, profileKey, key));
  const directory = profileRowDirectory(root, profileKey);
  for (const prefix of new Set(pruned.map((key) => key.slice(0, 2)))) {
    const fan = join(directory, prefix);
    if (!readdirSync(fan).length) rmdirSync(fan);
  }
  return pruned;
}

/**
 * Every committed row of `profile`, validated, as a keyed artifact
 * (artifact.ts). Rows nothing references are included; lookups by key
 * simply never reach them.
 */
export function assembleVectorArtifact(
  root: string,
  profile: EmbeddingProfile,
) {
  const keys = listRowKeys(root, profile.key);
  return {
    rows: keys.length,
    bytes: encodeVectorArtifact(
      profile.key,
      profile.dimensions,
      keys.map(
        (key) =>
          [key, readRow(root, profile.key, key, profile.dimensions)] as const,
      ),
    ),
  };
}

/**
 * Writes a published matrix as rows, `keys[i]` naming row i, and prunes
 * the profile's rows no key references. The rows are the matrix's bytes,
 * so assembling them reproduces it.
 */
export function publishRows(
  root: string,
  profile: EmbeddingProfile,
  keys: readonly string[],
  matrix: Uint8Array,
) {
  const rowBytes = profile.dimensions * 4;
  if (matrix.byteLength !== keys.length * rowBytes)
    throw new Error("Embedding matrix does not match its keys");
  const written = writeRows(
    root,
    profile.key,
    profile.dimensions,
    keys.map(
      (key, row) =>
        [key, matrix.subarray(row * rowBytes, (row + 1) * rowBytes)] as const,
    ),
  );
  return { written, pruned: pruneRows(root, profile.key, new Set(keys)) };
}
