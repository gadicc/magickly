/** Inactive authorized single-turn retrieval. No provider, history, file path, publication or spending. */
import "server-only";
import * as v from "valibot";
import {
  inspectPreparedResearchEvidence,
  inspectResearchCatalogUnit,
  prepareResearchEvidence,
  type ResearchCatalog,
  ungrantedResearchCatalogPolicy,
} from "./answerProvenance";
import {
  RESEARCH_OPERATION_TIMEOUT_MS,
  withinResearchDeadline,
} from "./boundedWork";
import {
  type PreparedResearchQuery,
  prepareResearchQuery,
  type ResearchQueryModeInput,
} from "./query";
import {
  type ResearchSourceReaders,
  type ResearchSourceSubject,
  requireResearchSourceAccess,
} from "./sourceAuthorization";

export const RESEARCH_RETRIEVAL_ERROR =
  "Private research retrieval unavailable";
export const RESEARCH_LOCAL_RETRIEVAL_PROFILE = "local-research-retrieval-v1";
export const RESEARCH_RETRIEVAL_LIMIT = 32;
const fail = (): never => {
  throw Error(RESEARCH_RETRIEVAL_ERROR);
};
const question = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(4000),
  v.check((s) => s.trim().length > 0 && s.isWellFormed()),
);
const book = v.pipe(
  v.string(),
  v.check((s) => /^book([1-9]|[12][0-9]|3[0-2])$/.exec(s)?.[0] === s),
);
const key = v.pipe(
  v.string(),
  v.check((s) => /^[A-Za-z0-9_.:-]{1,128}$/.exec(s)?.[0] === s),
);
const requestShape = v.strictObject({
  question,
  mode: v.picklist(["passage", "inventory", "comparison"]),
  source_book_handles: v.optional(v.pipe(v.array(book), v.maxLength(2)), []),
  retrieval_query: v.optional(question),
});
/** Explicit source choices constrain retrieval; they never convey permissions. Prior conversation and inferred source intent are unsupported. */
export type ResearchRetrievalRequest = v.InferInput<typeof requestShape>;
/** Ranked IDs only. Positive BM25 or other local scores are not semantic confidence. */
export interface ResearchRetrievalHit {
  readonly unit_id: string;
  readonly score: number;
}
/** Trusted local search port input. Filter these exact sources before scoring/statistics. Never use benchmark page labels. */
export interface ResearchSearchRequest {
  readonly catalog_revision: string;
  readonly query: string;
  readonly source_ids: readonly string[];
  readonly limit: 32;
}
/** Trusted owned local materialization, never client paths or provider output. Exact registered text hashes are checked independently. */
export interface ResearchMaterializeRequest {
  readonly catalog_revision: string;
  readonly unit_ids: readonly string[];
}
/** Server startup ports only; no callback or request shape proves access. The full catalog's influence set is fenced before local processing. */
export interface ResearchRetrievalOptions {
  readonly catalog: ResearchCatalog;
  readonly subject: ResearchSourceSubject;
  readonly expiresAtMs: number;
  readonly request: ResearchRetrievalRequest;
  /** New actual uncached readers for each gate; live integration must also bind the reviewed window. */
  readonly createSourceReaders: () => ResearchSourceReaders;
  readonly search: (
    request: ResearchSearchRequest,
    signal: AbortSignal,
  ) => Promise<readonly ResearchRetrievalHit[]>;
  readonly materialize: (
    request: ResearchMaterializeRequest,
    signal: AbortSignal,
  ) => Promise<readonly { unit_id: string; text: string }[]>;
}
const hitShape = v.strictObject({
  unit_id: key,
  score: v.pipe(v.number(), v.finite(), v.minValue(Number.MIN_VALUE)),
});
const textShape = v.strictObject({
  unit_id: key,
  text: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(16000),
    v.check((s) => s.trim().length > 0 && s.isWellFormed()),
  ),
});
function boundedRows<T>(
  raw: unknown,
  maximum: number,
  shape: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>,
): T[] {
  if (!Array.isArray(raw) || raw.length > maximum) return fail();
  return raw.map((row) => v.parse(shape, row));
}
/**
 * At most two source-filtered searches, four selected units and one materialization batch within one8s bound.
 * Every catalog source remains an influence, including inspected metadata and ranking statistics.
 * This returns private prepared input only; dispatch/delivery require their own fresh authorization.
 */
export async function retrieveResearchQuery(
  options: ResearchRetrievalOptions,
  signal: AbortSignal,
): Promise<PreparedResearchQuery> {
  const started = performance.now(),
    cancel = new AbortController();
  try {
    signal.throwIfAborted();
    const catalog = options.catalog,
      subject = structuredClone(options.subject),
      expires = options.expiresAtMs,
      request = v.parse(requestShape, structuredClone(options.request)),
      readers = options.createSourceReaders,
      search = options.search,
      materialize = options.materialize;
    return await withinResearchDeadline(signal, async (bounded) => {
      const combined = AbortSignal.any([bounded, cancel.signal]);
      const assert = () => {
        if (
          combined.aborted ||
          performance.now() >= started + RESEARCH_OPERATION_TIMEOUT_MS
        ) {
          cancel.abort();
          fail();
        }
      };
      assert();
      if (
        typeof readers !== "function" ||
        typeof search !== "function" ||
        typeof materialize !== "function"
      )
        fail();
      if (
        (request.mode === "inventory" && request.source_book_handles.length) ||
        (request.mode === "passage" && request.source_book_handles.length > 1)
      )
        fail();
      const sourceIds = ungrantedResearchCatalogPolicy(catalog).sources.map(
        (s) => s.source_id,
      );
      const seed = prepareResearchEvidence(catalog, {
        subject,
        expires_at_ms: expires,
        question: request.question,
        outcome: "needs_source_clarification",
        inspected_source_ids: sourceIds,
        selected: [],
      });
      const inspected = inspectPreparedResearchEvidence(seed);
      const access = async () => {
        assert();
        const r = readers();
        assert();
        await requireResearchSourceAccess(
          inspected.context,
          {
            kind: "generation",
            processor_profile: RESEARCH_LOCAL_RETRIEVAL_PROFILE,
          },
          r,
          combined,
        );
        assert();
      };
      await access();
      const handles = request.source_book_handles,
        books = inspected.inspected_books,
        selectedBooks = handles.map((h) => books.find((b) => b.handle === h));
      const unresolved =
        selectedBooks.some((b) => !b) ||
        new Set(handles).size !== handles.length ||
        (request.mode === "comparison" &&
          (handles.length !== 2 ||
            new Set(selectedBooks.map((b) => b?.binding.source_version))
              .size !== 2));
      if (unresolved) {
        const query = prepareResearchQuery(seed, { mode: request.mode });
        await access();
        assert();
        return query;
      }
      const mode: ResearchQueryModeInput = {
        mode: request.mode,
        ...(request.mode === "comparison"
          ? { comparison_book_handles: handles }
          : {}),
      };
      const branches =
        request.mode === "inventory"
          ? []
          : request.mode === "comparison"
            ? selectedBooks.map((b) => [b!.binding.source_id])
            : [
                selectedBooks.length
                  ? [selectedBooks[0]!.binding.source_id]
                  : sourceIds,
              ];
      const chosen: string[] = [];
      let incomplete = false;
      for (const sources of branches) {
        await access();
        assert();
        const raw = await search(
          Object.freeze({
            catalog_revision: catalog.revision,
            query: request.retrieval_query ?? request.question,
            source_ids: Object.freeze([...sources]),
            limit: RESEARCH_RETRIEVAL_LIMIT,
          }),
          combined,
        );
        assert();
        const hits = boundedRows(raw, RESEARCH_RETRIEVAL_LIMIT, hitShape);
        if (
          new Set(hits.map((h) => h.unit_id)).size !== hits.length ||
          hits.some((h, i) => i > 0 && h.score > hits[i - 1].score)
        )
          fail();
        for (const hit of hits)
          if (
            !sources.includes(
              inspectResearchCatalogUnit(catalog, hit.unit_id).source_id,
            )
          )
            fail();
        const ids = hits
          .slice(0, request.mode === "comparison" ? 2 : 4)
          .map((h) => h.unit_id);
        if (!ids.length) incomplete = true;
        chosen.push(...ids);
      }
      let selected: { unit_id: string; text: string }[] = [];
      if (chosen.length) {
        await access();
        assert();
        const raw = await materialize(
          Object.freeze({
            catalog_revision: catalog.revision,
            unit_ids: Object.freeze([...chosen]),
          }),
          combined,
        );
        assert();
        const rows = boundedRows(raw, 4, textShape);
        if (
          rows.length !== chosen.length ||
          new Set(rows.map((r) => r.unit_id)).size !== rows.length ||
          rows.some((r) => !chosen.includes(r.unit_id))
        )
          fail();
        selected = chosen.map((id) => rows.find((r) => r.unit_id === id)!);
        if (Buffer.byteLength(JSON.stringify(selected)) > 64 * 1024) fail();
      }
      // Validate actual text hashes and query coverage before the final awaited current-access decision.
      const outcome =
        request.mode === "inventory"
          ? "ready"
          : request.mode === "comparison" && incomplete
            ? "comparison_incomplete"
            : selected.length
              ? "ready"
              : "no_evidence";
      const evidence = prepareResearchEvidence(catalog, {
        subject,
        expires_at_ms: expires,
        question: request.question,
        outcome,
        inspected_source_ids: sourceIds,
        selected,
      });
      const query = prepareResearchQuery(evidence, mode);
      await access();
      assert();
      return query;
    });
  } catch {
    return fail();
  } finally {
    cancel.abort();
  }
}
