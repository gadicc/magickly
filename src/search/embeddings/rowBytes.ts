/**
 * One embedding row's bytes: `dimensions` float32 values, little-endian,
 * unit length (plan 087). Pure, with no file access, so the store can
 * validate rows without importing the committed rows' file handling
 * (rows.ts) into /api/search.
 */

/** float32 rounding of a unit vector stays far inside this. */
const NORM_TOLERANCE = 1e-3;

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
