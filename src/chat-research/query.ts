/** Inactive query-mode contract over owned source evidence. No retriever, provider or completed-history admission. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import {
  type BoundResearchAnswer,
  inspectBoundResearchAnswer,
  inspectPreparedResearchEvidence,
  type PreparedResearchEvidence,
  parseResearchAnswerDraft,
  projectResearchAnswer,
  researchAnswerHistoryCandidate,
} from "./answerProvenance";
export const RESEARCH_QUERY_ERROR = "Private research query unavailable";
export const RESEARCH_DRAFT_PROSE_CHARACTERS = 4000;
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const modeSchema = v.strictObject({
  mode: v.picklist(["passage", "inventory", "comparison"]),
  comparison_book_handles: v.optional(
    v.pipe(
      v.array(
        v.pipe(
          v.string(),
          v.check((s) => /^book([1-9]|[12][0-9]|3[0-2])$/.exec(s)?.[0] === s),
        ),
      ),
      v.maxLength(2),
    ),
    [],
  ),
});
export type ResearchQueryModeInput = v.InferInput<typeof modeSchema>;
type Mode = v.InferOutput<typeof modeSchema>;
interface QueryState {
  prepared: PreparedResearchEvidence;
  mode: Mode;
  input: ReturnType<typeof inspectPreparedResearchEvidence>;
}
export interface PreparedResearchQuery {
  readonly revision: string;
}
const queries = new WeakMap<object, QueryState>();
const answers = new WeakMap<
  object,
  {
    query: PreparedResearchQuery;
    bound: BoundResearchAnswer;
    draftSha: string | null;
  }
>();
export interface ResearchQueryAnswer {
  readonly revision: string;
}
function fail(): never {
  throw Error(RESEARCH_QUERY_ERROR);
}
function state<T>(map: WeakMap<object, T>, handle: object): T {
  const item = map.get(handle);
  if (!item) fail();
  return item;
}
/** Intent/mode must be chosen by a trusted query adapter. This validates coverage, not the truth of external retrieval outcomes. */
export function prepareResearchQuery(
  prepared: PreparedResearchEvidence,
  value: ResearchQueryModeInput,
): PreparedResearchQuery {
  try {
    const mode = v.parse(modeSchema, value),
      input = inspectPreparedResearchEvidence(prepared),
      pair = mode.comparison_book_handles;
    if (mode.mode !== "comparison" && pair.length) fail();
    if (input.outcome === "comparison_incomplete" && mode.mode !== "comparison")
      fail();
    if (mode.mode === "inventory" && input.passages.length) fail();
    if (mode.mode === "inventory" && input.outcome === "no_evidence") fail();
    if (
      mode.mode === "inventory" &&
      input.outcome === "ready" &&
      !input.inventory
    )
      fail();
    if (
      mode.mode === "passage" &&
      input.outcome === "ready" &&
      !input.passages.length
    )
      fail();
    if (
      mode.mode === "comparison" &&
      input.outcome !== "needs_source_clarification"
    ) {
      if (
        pair.length !== 2 ||
        new Set(pair).size !== 2 ||
        pair.some((h) => !input.inspected_books.some((b) => b.handle === h)) ||
        input.passages.some((p) => !pair.includes(p.book_handle))
      )
        fail();
      const distinctArtifacts =
        new Set(
          pair.map(
            (handle) =>
              input.inspected_books.find((book) => book.handle === handle)!
                .binding.source_version,
          ),
        ).size === 2;
      const covered =
        distinctArtifacts &&
        pair.every((h) => input.passages.some((p) => p.book_handle === h));
      if (
        (input.outcome === "ready" && !covered) ||
        (input.outcome === "comparison_incomplete" && covered)
      )
        fail();
    } else if (mode.mode === "comparison" && pair.length) fail();
    const query = Object.freeze({
      revision: digest(["magickli-research-query-v1", prepared.revision, mode]),
    });
    queries.set(query, { prepared, mode, input });
    return query;
  } catch {
    return fail();
  }
}
/** Owned private request input; the context is for a separate fresh source fence and never goes to the model. */
export function inspectResearchQuery(value: PreparedResearchQuery) {
  const s = state(queries, value);
  return {
    ...structuredClone(s.input),
    ...structuredClone(s.mode),
    prepared_revision: s.prepared.revision,
    query_revision: value.revision,
  };
}
/** A response is bound to this exact private query identity, not merely a matching source context. */
export function projectResearchQueryAnswer(
  query: PreparedResearchQuery,
  answerId: string,
  value: unknown,
): ResearchQueryAnswer {
  try {
    const s = state(queries, query);
    if (s.input.outcome !== "ready" && value !== null) fail();
    const draft =
      s.input.outcome === "ready" ? parseResearchAnswerDraft(value) : null;
    if (draft !== null) {
      for (const item of draft.statements) {
        if (
          item.type === "passage_statement" &&
          Array.from(item.text).length > RESEARCH_DRAFT_PROSE_CHARACTERS
        )
          fail();
        if (
          (item.type === "inventory_count" ||
            item.type === "inventory_books") &&
          s.mode.mode !== "inventory"
        )
          fail();
        if (item.type === "passage_statement" && s.mode.mode === "inventory")
          fail();
        if (
          item.type === "passage_statement" &&
          item.kind === "answer" &&
          s.mode.mode === "comparison"
        ) {
          const cited = new Set(
            item.evidence_ids.map(
              (id) => s.input.passages.find((p) => p.id === id)?.book_handle,
            ),
          );
          if (!s.mode.comparison_book_handles.every((h) => cited.has(h)))
            fail();
        }
      }
    }
    const bound = projectResearchAnswer(s.prepared, answerId, draft),
      draftSha =
        draft === null
          ? null
          : digest(["magickli-research-normalized-draft-v1", draft]);
    const answer = Object.freeze({
      revision: digest([
        "magickli-research-query-answer-v1",
        query.revision,
        bound.revision,
        draftSha,
      ]),
    });
    answers.set(answer, { query, bound, draftSha });
    return answer;
  } catch {
    return fail();
  }
}
/** Preparation only. Finalization must additionally prove the exact request, raw provider receipt, usage and terminal permit. */
export function assertResearchQueryAnswer(
  query: PreparedResearchQuery,
  answer: ResearchQueryAnswer,
  draft: unknown,
) {
  try {
    const s = state(answers, answer);
    state(queries, query);
    const normalized = draft === null ? null : parseResearchAnswerDraft(draft);
    const draftSha =
      normalized === null
        ? null
        : digest(["magickli-research-normalized-draft-v1", normalized]);
    if (s.query !== query || s.draftSha !== draftSha) fail();
    return {
      ...inspectBoundResearchAnswer(s.bound),
      prepared_revision: state(queries, query).prepared.revision,
      query_revision: query.revision,
      answer_revision: answer.revision,
      normalized_draft_sha256: draftSha,
    };
  } catch {
    return fail();
  }
}
/** Candidate only; no parsed/model answer can directly enter persistent conversation history. */
export function researchQueryHistoryCandidate(answer: ResearchQueryAnswer) {
  const s = state(answers, answer),
    candidate = researchAnswerHistoryCandidate(s.bound);
  return candidate
    ? {
        ...candidate,
        answer_revision: answer.revision,
        query_revision: s.query.revision,
      }
    : null;
}
