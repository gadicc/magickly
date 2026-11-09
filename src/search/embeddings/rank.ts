import { searchExcerpt } from "../engine";
import type { SearchResult } from "../types";
import type { EmbeddingRecord } from "./records";

/** Exhaustive cosine scoring is sufficient for this small, public catalogue. */
export function rankVectors(
  records: EmbeddingRecord[],
  vectors: Float32Array,
  query: readonly number[],
  text: string,
  limit = 20,
): SearchResult[] {
  if (vectors.length !== records.length * query.length)
    throw new Error("Invalid search vector matrix");
  const pages = new Map<string, SearchResult>();
  for (let row = 0; row < records.length; row++) {
    let score = 0;
    for (let d = 0; d < query.length; d++)
      score += vectors[row * query.length + d] * query[d];
    const record = records[row];
    const previous = pages.get(record.path);
    if (previous && previous.score >= score) continue;
    pages.set(record.path, {
      path: record.path,
      href: record.href,
      title: record.title,
      section: record.section || undefined,
      excerpt: searchExcerpt(record.text, text),
      score,
      match: "semantic",
    });
  }
  return [...pages.values()]
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}

/** Rank fusion avoids treating lexical and cosine scores as the same units. */
export function fuseSearchResults(
  lexical: SearchResult[],
  semantic: SearchResult[],
  limit = 20,
): SearchResult[] {
  const combined = new Map<string, { result: SearchResult; score: number }>();
  for (const list of [lexical, semantic])
    for (const [rank, result] of list.entries()) {
      const entry = combined.get(result.path);
      const score = 1 / (60 + rank);
      if (entry) entry.score += score;
      else combined.set(result.path, { result, score });
    }
  // The exact-title boost in the lexical engine is an intentional navigation guarantee.
  for (const result of lexical)
    if (result.exactTitle) combined.get(result.path)!.score += 1;
  return [...combined.values()]
    .sort(
      (a, b) => b.score - a.score || a.result.path.localeCompare(b.result.path),
    )
    .slice(0, limit)
    .map(({ result, score }) => ({ ...result, score }));
}
