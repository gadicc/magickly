/**
 * The gap hints' vector cache, under `.private/` and never committed:
 * one JSON line per vector, `{"k": cacheKey, "v": base64 float32}`,
 * appended after every batch, so an interrupted run keeps what it paid
 * for and a rerun embeds only what is missing.
 */
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
} from "node:fs";
import path from "node:path";

/** Vectors by cache key, and how many lines couldn't be read. */
export interface VectorCache {
  vectors: Map<string, Float32Array>;
  /**
   * Lines cut short (an interrupted write) or otherwise unreadable: their
   * vectors count as missing and are embedded again.
   */
  skipped: number;
}

/** The cache file's vectors; empty when there is no file. */
export function readCache(file: string, dimensions: number): VectorCache {
  const cache: VectorCache = { vectors: new Map(), skipped: 0 };
  if (!existsSync(file)) return cache;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line) continue;
    try {
      const entry = JSON.parse(line) as { k?: unknown; v?: unknown };
      if (typeof entry.k !== "string" || typeof entry.v !== "string")
        throw new Error("no key or vector");
      const bytes = Buffer.from(entry.v, "base64");
      const vector = new Float32Array(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      );
      if (vector.length !== dimensions) throw new Error("wrong dimensions");
      cache.vectors.set(entry.k, vector);
    } catch {
      cache.skipped++;
    }
  }
  return cache;
}

/** Whether a file is empty or ends with a newline. */
function endsLine(file: string): boolean {
  const { size } = statSync(file);
  if (!size) return true;
  const last = Buffer.alloc(1);
  const fd = openSync(file, "r");
  try {
    readSync(fd, last, 0, 1, size - 1);
  } finally {
    closeSync(fd);
  }
  return last[0] === 0x0a;
}

/** Appends vectors to the cache file and to `cache`. */
export function appendCache(
  file: string,
  cache: VectorCache,
  entries: readonly (readonly [key: string, vector: readonly number[]])[],
): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const lines = entries.map(([key, vector]) => {
    const floats = Float32Array.from(vector);
    cache.vectors.set(key, floats);
    return `${JSON.stringify({ k: key, v: Buffer.from(floats.buffer).toString("base64") })}\n`;
  });
  // After an interrupted write, start on a line of its own.
  const start = existsSync(file) && !endsLine(file) ? "\n" : "";
  appendFileSync(file, start + lines.join(""));
}
