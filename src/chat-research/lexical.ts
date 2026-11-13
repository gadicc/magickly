/** Inactive local lexical baseline over exact registered text. No network, files, embeddings or authorization. */
import "server-only";
import { createHash } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import * as v from "valibot";
import {
  inspectResearchCatalogUnit,
  type ResearchCatalog,
  ungrantedResearchCatalogPolicy,
} from "./answerProvenance";
import {
  RESEARCH_RETRIEVAL_ERROR,
  type ResearchMaterializeRequest,
  type ResearchSearchRequest,
} from "./retrieval";

const fail = (): never => {
  throw Error(RESEARCH_RETRIEVAL_ERROR);
};
const rowShape = v.strictObject({
  unit_id: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  text: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(16000),
    v.check((s) => s.trim().length > 0 && s.isWellFormed()),
  ),
});
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
/** NFKC plus Unicode lowercase and L/N/M words. This is not full Unicode casefold, stemming, synonym or symbol recognition. */
const tokens = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .match(/[\p{L}\p{N}\p{M}]+/gu) ?? [];
/**
 * Own every registered unit exactly once, with a64MiB input ceiling and exact hash checks.
 * Source filters precede BM25 document frequencies. Scores are a baseline, not relevance labels.
 * Returned ports are private server capabilities; call them only through authorized retrieval.
 */
export function createResearchLexicalRetriever(
  catalog: ResearchCatalog,
  values: readonly { unit_id: string; text: string }[],
) {
  try {
    if (
      !Array.isArray(values) ||
      values.length !== catalog.unitCount ||
      values.length > 75000
    )
      fail();
    const docs = new Map<string, { source_id: string; text: string }>(),
      sources = new Set(
        ungrantedResearchCatalogPolicy(catalog).sources.map(
          (source) => source.source_id,
        ),
      );
    let bytes = 0;
    for (const value of values) {
      const row = v.parse(rowShape, value),
        registered = inspectResearchCatalogUnit(catalog, row.unit_id);
      bytes += Buffer.byteLength(row.unit_id) + Buffer.byteLength(row.text);
      if (
        bytes > 64 * 1024 * 1024 ||
        docs.has(row.unit_id) ||
        sha(row.text) !== registered.text_sha256
      )
        fail();
      docs.set(row.unit_id, {
        source_id: registered.source_id,
        text: row.text,
      });
    }
    const check = (revision: string, signal: AbortSignal) => {
      signal.throwIfAborted();
      if (revision !== catalog.revision) fail();
    };
    const search = async (
      request: ResearchSearchRequest,
      signal: AbortSignal,
    ) => {
      check(request.catalog_revision, signal);
      if (
        request.limit !== 32 ||
        typeof request.query !== "string" ||
        request.query.length > 4000 ||
        !request.query.trim() ||
        !request.query.isWellFormed() ||
        !Array.isArray(request.source_ids) ||
        !request.source_ids.length ||
        request.source_ids.length > 32 ||
        new Set(request.source_ids).size !== request.source_ids.length ||
        request.source_ids.some((s) => !sources.has(s))
      )
        fail();
      const allowed = new Set(request.source_ids),
        terms = new Set(tokens(request.query));
      if (!terms.size) return [];
      const df = new Map<string, number>(),
        rows: {
          unit_id: string;
          length: number;
          counts: Map<string, number>;
        }[] = [];
      let total = 0,
        visited = 0;
      for (const [unit_id, doc] of docs) {
        if (++visited % 128 === 0) {
          await setImmediate();
          check(request.catalog_revision, signal);
        }
        if (!allowed.has(doc.source_id)) continue;
        const words = tokens(doc.text),
          counts = new Map<string, number>();
        for (const word of words)
          if (terms.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
        for (const word of counts.keys()) df.set(word, (df.get(word) ?? 0) + 1);
        rows.push({ unit_id, length: words.length, counts });
        total += words.length;
      }
      check(request.catalog_revision, signal);
      const average = rows.length ? total / rows.length : 0;
      if (!average) return [];
      const hits: { unit_id: string; score: number }[] = [];
      for (const [i, row] of rows.entries()) {
        if (i % 128 === 0) {
          await setImmediate();
          check(request.catalog_revision, signal);
        }
        let score = 0;
        // Stable summation order makes equal token bags tie regardless of source word order.
        for (const term of [...row.counts.keys()].sort()) {
          const frequency = row.counts.get(term)!;
          const idf = Math.log1p(
              (rows.length - df.get(term)! + 0.5) / (df.get(term)! + 0.5),
            ),
            norm = 1.2 * (1 - 0.75 + (0.75 * row.length) / average);
          score += (idf * frequency * 2.2) / (frequency + norm);
        }
        if (score > 0) hits.push({ unit_id: row.unit_id, score });
      }
      hits.sort(
        (a, b) =>
          b.score - a.score ||
          (a.unit_id < b.unit_id ? -1 : a.unit_id > b.unit_id ? 1 : 0),
      );
      check(request.catalog_revision, signal);
      return hits.slice(0, 32);
    };
    const materialize = async (
      request: ResearchMaterializeRequest,
      signal: AbortSignal,
    ) => {
      check(request.catalog_revision, signal);
      if (
        !Array.isArray(request.unit_ids) ||
        !request.unit_ids.length ||
        request.unit_ids.length > 4 ||
        new Set(request.unit_ids).size !== request.unit_ids.length
      )
        fail();
      return request.unit_ids.map((unit_id) => {
        const doc = docs.get(unit_id);
        if (!doc) fail();
        return { unit_id, text: doc!.text };
      });
    };
    return Object.freeze({ search, materialize });
  } catch {
    return fail();
  }
}
