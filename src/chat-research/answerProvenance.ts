/** Inactive trusted catalog/projection boundary. Never a source grant or completion receipt. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import { isUuidV7 } from "../lib/ids";
import {
  parseResearchAnswer,
  parseResearchBook,
  RESEARCH_ANSWER_BYTE_LIMIT,
  type ResearchAnswer,
  type ResearchBook,
  researchQueryOutcomeAnswer,
} from "./answer";
import { parseResearchBookCatalog, type ResearchBookCatalog } from "./catalog";
import { formatResearchHistoryCandidate } from "./historyCandidate";
import {
  parseResearchSourceContext,
  type ResearchSourceContext,
  type ResearchSourceSubject,
} from "./sourceAuthorization";
import {
  prepareResearchSourcePolicy,
  type ResearchSourcePolicyInput,
} from "./sourcePolicy";

export const RESEARCH_PROVENANCE_ERROR =
  "Private research provenance unavailable";
const MAX_CATALOG_BYTES = 32 * 1024 * 1024;
const sha = (text: string) =>
  createHash("sha256").update(text, "utf8").digest("hex");
const exact = (pattern: RegExp) => (s: string) => pattern.exec(s)?.[0] === s;
const key = v.pipe(v.string(), v.check(exact(/^[A-Za-z0-9_.:-]{1,128}$/)));
const sourceId = v.pipe(v.string(), v.check(exact(/^[A-Za-z0-9_-]{1,128}$/)));
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const uuid = v.pipe(
  v.string(),
  v.check((s) => isUuidV7(s) && s === s.toLowerCase()),
);
const instant = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const page = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const unit = v.strictObject({
  id: key,
  page_start: page,
  page_end: page,
  extraction: v.picklist(["native_text", "unverified_ocr"]),
  text_sha256: hash,
});
const source = v.strictObject({
  source_id: sourceId,
  source_version: hash,
  pdf_pages: page,
  book: v.unknown(),
  units: v.pipe(v.array(unit), v.maxLength(50000)),
});
const catalogShape = v.strictObject({
  schema_version: v.literal(1),
  sources: v.pipe(v.array(source), v.minLength(1), v.maxLength(32)),
});
export type ResearchCatalogInput = v.InferInput<typeof catalogShape>;
interface CatalogSource {
  source_id: string;
  source_version: string;
  pdf_pages: number;
  book: ResearchBook;
  units: v.InferOutput<typeof unit>[];
  book_handle: string;
  binding: ResearchSourceContext["bindings"][number];
}
interface CatalogState {
  sources: CatalogSource[];
  corpusVersion: string;
  policyInput: ResearchSourcePolicyInput;
  units: Map<
    string,
    { source_id: string; book_handle: string; text_sha256: string }
  >;
}
/** Opaque intrinsic snapshot; final corpus identity is derived after its leaves, never fed back into them. */
export interface ResearchCatalog {
  readonly revision: string;
  readonly sourceCount: number;
  readonly unitCount: number;
}
const catalogs = new WeakMap<object, CatalogState>();
function fail(): never {
  throw Error(RESEARCH_PROVENANCE_ERROR);
}
function state<T>(map: WeakMap<object, T>, handle: object): T {
  const value = map.get(handle);
  if (!value) fail();
  return value;
}
const unique = (xs: readonly string[]) => new Set(xs).size === xs.length;
const sort = <T>(items: T[], keyOf: (x: T) => string) =>
  items.sort((a, b) =>
    keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0,
  );
/** Trusted prepared metadata/unit hashes only. No disk reads, publication, permissions or raw source text. */
export function compileResearchCatalog(
  input: ResearchCatalogInput,
): ResearchCatalog {
  try {
    if (Buffer.byteLength(JSON.stringify(input)) > MAX_CATALOG_BYTES) fail();
    const parsed = v.parse(catalogShape, input);
    if (
      !unique(parsed.sources.map((s) => s.source_id)) ||
      parsed.sources.reduce((n, s) => n + s.units.length, 0) > 75000
    )
      fail();
    const ids = new Set<string>();
    const registrations = new Map<
      string,
      { source_id: string; book_handle: string; text_sha256: string }
    >();
    const sources = sort(parsed.sources, (s) => s.source_id).map(
      (s, i): CatalogSource => {
        const book = parseResearchBook(s.book),
          units = sort(s.units, (u) => u.id);
        for (const u of units) {
          if (
            ids.has(u.id) ||
            u.page_end < u.page_start ||
            u.page_end > s.pdf_pages
          )
            fail();
          ids.add(u.id);
          registrations.set(u.id, {
            source_id: s.source_id,
            book_handle: `book${i + 1}`,
            text_sha256: u.text_sha256,
          });
        }
        const evidenceVersion = sha(
          JSON.stringify([
            "magickli-research-source-snapshot-v1",
            s.source_id,
            s.source_version,
            s.pdf_pages,
            book,
            units,
          ]),
        );
        return {
          ...s,
          book,
          units,
          book_handle: `book${i + 1}`,
          binding: {
            reference_id: `ref${i + 1}`,
            source_id: s.source_id,
            source_version: s.source_version,
            evidence_version: evidenceVersion,
          },
        };
      },
    );
    if (Buffer.byteLength(JSON.stringify(sources)) > MAX_CATALOG_BYTES) fail();
    const policyInput: ResearchSourcePolicyInput = {
      schema_version: 1,
      scope: "private-operator-research",
      sources: sources.map((s) => ({
        source_id: s.source_id,
        source_version: s.source_version,
        evidence_versions: [s.binding.evidence_version],
        state: "active",
        valid_from_ms: null,
        valid_until_ms: null,
        rights: {},
        grants: [],
      })),
    };
    const corpusVersion =
      prepareResearchSourcePolicy(policyInput).corpusVersion;
    const value = Object.freeze({
      revision: corpusVersion,
      sourceCount: sources.length,
      unitCount: ids.size,
    });
    catalogs.set(value, {
      sources,
      corpusVersion,
      policyInput,
      units: registrations,
    });
    return value;
  } catch {
    return fail();
  }
}
/** Owned registered-unit facts for trusted local retrieval. This reveals no passage and grants no processing or source access. */
export function inspectResearchCatalogUnit(
  catalog: ResearchCatalog,
  unitId: string,
) {
  const source = state(catalogs, catalog).units.get(unitId);
  if (!source) fail();
  return { ...source };
}
/** Preparation defaults to no rights and no grants. A reviewed publisher must independently adopt the roster/policy. */
export function ungrantedResearchCatalogPolicy(
  catalog: ResearchCatalog,
): ResearchSourcePolicyInput {
  return structuredClone(state(catalogs, catalog).policyInput);
}
/** Opaque intrinsic metadata view, not source permission or a completed/model artifact. */
export interface PreparedResearchCatalogView {
  readonly kind: "prepared_research_catalog_view";
  readonly revision: string;
}
const catalogViews = new WeakMap<
  object,
  { context: ResearchSourceContext; value: ResearchBookCatalog }
>();
/** Derive metadata and its complete influence context from the actual catalog; never invent a question or permit. */
export function prepareResearchCatalogView(
  catalog: ResearchCatalog,
  subject: ResearchSourceSubject,
  expiresAtMs: number,
): PreparedResearchCatalogView {
  try {
    const intrinsic = state(catalogs, catalog),
      context = parseResearchSourceContext({
        subject,
        corpus_version: intrinsic.corpusVersion,
        expires_at_ms: expiresAtMs,
        bindings: intrinsic.sources.map((s) => ({ ...s.binding })),
        visible_reference_ids: [],
      }),
      value = parseResearchBookCatalog({
        contract: "magickli-private-research-catalog",
        schema_version: 1,
        catalog_revision: intrinsic.corpusVersion,
        books: intrinsic.sources.map((s) => ({
          handle: s.book_handle,
          book: structuredClone(s.book),
        })),
      }),
      view = Object.freeze({
        kind: "prepared_research_catalog_view" as const,
        revision: sha(JSON.stringify([context, value])),
      });
    catalogViews.set(view, { context, value });
    return view;
  } catch {
    return fail();
  }
}
/** Owned view data for trusted current-source delivery only; an opaque view does not grant access. */
export function inspectPreparedResearchCatalogView(
  view: PreparedResearchCatalogView,
) {
  return structuredClone(state(catalogViews, view));
}
const evidenceInput = v.strictObject({
  subject: v.strictObject({
    kind: v.literal("user"),
    user_id: uuid,
    session_id: uuid,
  }),
  expires_at_ms: instant,
  question: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(4000),
    v.check((s) => s.trim().length > 0),
  ),
  outcome: v.picklist([
    "ready",
    "no_evidence",
    "needs_source_clarification",
    "comparison_incomplete",
  ]),
  inspected_source_ids: v.pipe(
    v.array(sourceId),
    v.minLength(1),
    v.maxLength(32),
  ),
  selected: v.pipe(
    v.array(
      v.strictObject({
        unit_id: key,
        text: v.pipe(
          v.string(),
          v.minLength(1),
          v.maxLength(16000),
          v.check((s) => s.trim().length > 0),
          v.check((s) => s.isWellFormed()),
        ),
      }),
    ),
    v.maxLength(4),
  ),
});
export type ResearchEvidenceInput = v.InferInput<typeof evidenceInput>;
interface SelectedPassage {
  id: string;
  source: CatalogSource;
  unit: v.InferOutput<typeof unit>;
  text: string;
}
interface EvidenceState {
  catalog: CatalogState;
  context: ResearchSourceContext;
  passages: SelectedPassage[];
  question: string;
  outcome: v.InferOutput<typeof evidenceInput>["outcome"];
}
/** Preparation only, not an authenticated retrieval, model completion or reusable permission. */
export interface PreparedResearchEvidence {
  readonly revision: string;
}
const evidence = new WeakMap<object, EvidenceState>();
/** Caller must declare every inspected source (including retrieval/intent/metadata candidates), not just selected citations. */
export function prepareResearchEvidence(
  catalog: ResearchCatalog,
  input: ResearchEvidenceInput,
): PreparedResearchEvidence {
  try {
    const c = state(catalogs, catalog),
      parsed = v.parse(evidenceInput, input);
    if (
      !unique(parsed.inspected_source_ids) ||
      !unique(parsed.selected.map((s) => s.unit_id))
    )
      fail();
    const inspected = c.sources.filter((s) =>
      parsed.inspected_source_ids.includes(s.source_id),
    );
    if (inspected.length !== parsed.inspected_source_ids.length) fail();
    const passages = parsed.selected.map((item, i): SelectedPassage => {
      const source = inspected.find((s) =>
        s.units.some((u) => u.id === item.unit_id),
      );
      const unit = source?.units.find((u) => u.id === item.unit_id);
      if (!source || !unit || sha(item.text) !== unit.text_sha256) fail();
      return { id: `passage${i + 1}`, source, unit, text: item.text };
    });
    if (
      (parsed.outcome === "no_evidence" ||
        parsed.outcome === "needs_source_clarification") &&
      passages.length
    )
      fail();
    if (
      parsed.outcome === "needs_source_clarification" &&
      inspected.length !== c.sources.length
    )
      fail();
    const context: ResearchSourceContext = {
      subject: parsed.subject,
      corpus_version: c.corpusVersion,
      expires_at_ms: parsed.expires_at_ms,
      bindings: inspected.map((s) => structuredClone(s.binding)),
      visible_reference_ids: [
        ...new Set(passages.map((p) => p.source.binding.reference_id)),
      ],
    };
    const revision = sha(
      JSON.stringify([
        "magickli-research-prepared-evidence-v1",
        context,
        parsed.question,
        parsed.outcome,
        passages.map((p) => [p.id, p.unit.id, p.unit.text_sha256]),
      ]),
    );
    const value = Object.freeze({ revision });
    evidence.set(value, {
      catalog: c,
      context,
      passages,
      question: parsed.question,
      outcome: parsed.outcome,
    });
    return value;
  } catch {
    return fail();
  }
}
/** Owned private server inputs. Requires an independent fresh source/processor fence before any use or dispatch. */
export function inspectPreparedResearchEvidence(
  value: PreparedResearchEvidence,
) {
  const s = state(evidence, value);
  return {
    question: s.question,
    outcome: s.outcome,
    inventory:
      s.context.bindings.length === s.catalog.sources.length
        ? {
            scope: "admitted_private_prepared_pdf_snapshots" as const,
            source_count: s.catalog.sources.length,
            whole_library_coverage: "not_established" as const,
            index_membership: "not_established" as const,
            books: s.catalog.sources.map((source) => ({
              handle: source.book_handle,
              book: structuredClone(source.book),
            })),
          }
        : null,
    context: structuredClone(s.context),
    inspected_books: s.catalog.sources
      .filter((source) =>
        s.context.bindings.some(
          (binding) => binding.source_id === source.source_id,
        ),
      )
      .map((source) => ({
        handle: source.book_handle,
        binding: structuredClone(source.binding),
        book: structuredClone(source.book),
      })),
    passages: s.passages.map((p) => ({
      id: p.id,
      text: p.text,
      book_handle: p.source.book_handle,
      book: structuredClone(p.source.book),
      physical_pdf_page_start: p.unit.page_start,
      physical_pdf_page_end: p.unit.page_end,
      extraction: p.unit.extraction,
    })),
  };
}
/** Opaque checked projection, deliberately not a model-completed or authorized-delivery handle. */
export interface BoundResearchAnswer {
  readonly revision: string;
}
interface AnswerState {
  evidence: EvidenceState;
  payload: ResearchAnswer;
}
const answers = new WeakMap<object, AnswerState>();
/** Bind every printed fact to the prepared server catalog; model/client metadata cannot establish its own provenance. */
function bindResearchAnswer(
  prepared: PreparedResearchEvidence,
  value: unknown,
): BoundResearchAnswer {
  try {
    const s = state(evidence, prepared),
      payload = parseResearchAnswer(value);
    if (
      payload.origin === "model" &&
      s.passages.length === 0 &&
      s.context.bindings.length !== s.catalog.sources.length
    )
      fail();
    const revision = sha(
      JSON.stringify([
        "magickli-research-bound-answer-v1",
        prepared.revision,
        payload,
      ]),
    );
    const answer = Object.freeze({ revision });
    answers.set(answer, { evidence: s, payload });
    return answer;
  } catch {
    return fail();
  }
}
/** Metadata/answer inspection only, never a delivery or completion grant. Full uncited influences remain private. */
export function inspectBoundResearchAnswer(value: BoundResearchAnswer) {
  const s = state(answers, value);
  return {
    payload: structuredClone(s.payload),
    context: structuredClone(s.evidence.context),
  };
}
/** Qualified text candidate only. Persistent completed-job verification and a fresh source fence must precede history admission. */
export function researchAnswerHistoryCandidate(value: BoundResearchAnswer): {
  question: string;
  text: string;
  context: ResearchSourceContext;
  answer_revision: string;
} | null {
  const s = state(answers, value),
    p = s.payload;
  if (p.origin !== "model") return null;
  const candidate = formatResearchHistoryCandidate(s.evidence.question, p);
  if (!candidate) return null;
  return {
    ...candidate,
    context: structuredClone(s.evidence.context),
    answer_revision: value.revision,
  };
}

const draftId = v.pipe(v.string(), v.check(exact(/^s([1-9]|1[0-9]|20)$/)));
const passageId = v.pipe(v.string(), v.check(exact(/^passage[1-4]$/)));
const bookHandle = v.pipe(
  v.string(),
  v.check(exact(/^book([1-9]|[12][0-9]|3[0-2])$/)),
);
const reasons = Object.freeze({
  insufficient_selected_evidence:
    "The selected evidence does not establish a complete answer.",
  metadata_incomplete:
    "Some bibliographic metadata remains incomplete or unverified.",
  scope_limited:
    "This answer is limited to the admitted prepared sources and selected context.",
} as const);
const draftSchema = v.strictObject({
  status: v.picklist(["supported", "partial", "insufficient"]),
  statements: v.pipe(
    v.array(
      v.variant("type", [
        v.strictObject({
          type: v.literal("passage_statement"),
          id: draftId,
          kind: v.picklist(["answer", "observation"]),
          text: v.pipe(
            v.string(),
            v.minLength(1),
            v.maxLength(16000),
            v.check((s) => s.trim().length > 0),
          ),
          evidence_ids: v.pipe(
            v.array(passageId),
            v.minLength(1),
            v.maxLength(4),
          ),
        }),
        v.strictObject({
          type: v.literal("limitation"),
          id: draftId,
          reason: v.picklist([
            "insufficient_selected_evidence",
            "metadata_incomplete",
            "scope_limited",
          ]),
        }),
        v.strictObject({ type: v.literal("inventory_count"), id: draftId }),
        v.strictObject({
          type: v.literal("inventory_books"),
          id: draftId,
          book_handles: v.pipe(
            v.array(bookHandle),
            v.minLength(1),
            v.maxLength(32),
          ),
        }),
      ]),
    ),
    v.minLength(1),
    v.maxLength(20),
  ),
  issues: v.pipe(
    v.array(
      v.strictObject({
        kind: v.picklist(["conflict", "source_attribution", "missing_context"]),
        statement_ids: v.pipe(
          v.array(draftId),
          v.minLength(1),
          v.maxLength(20),
        ),
        affects_answer: v.boolean(),
      }),
    ),
    v.maxLength(10),
  ),
});
/** Owned, bounded model draft only. It confers no source, query, completion or delivery authority. */
export function parseResearchAnswerDraft(
  value: unknown,
): v.InferOutput<typeof draftSchema> {
  try {
    if (Buffer.byteLength(JSON.stringify(value)) > RESEARCH_ANSWER_BYTE_LIMIT)
      fail();
    const parsed = v.parse(draftSchema, value);
    if (Buffer.byteLength(JSON.stringify(parsed)) > RESEARCH_ANSWER_BYTE_LIMIT)
      fail();
    return parsed;
  } catch {
    return fail();
  }
}
/** Model prose is accepted only for passages. All citation metadata, inventory facts and limitations are server-projected.
 * This inactive slice does not support source-intent match declarations or prior conversational history yet.
 */
export function projectResearchAnswer(
  prepared: PreparedResearchEvidence,
  answerId: string,
  draft: unknown,
): BoundResearchAnswer {
  try {
    const s = state(evidence, prepared);
    if (s.outcome !== "ready") {
      if (draft !== null) fail();
      return bindResearchAnswer(
        prepared,
        researchQueryOutcomeAnswer(answerId, s.outcome),
      );
    }
    const parsed = parseResearchAnswerDraft(draft);
    const used = new Set<string>(),
      handles = new Set<string>();
    const statements: ResearchAnswer["statements"] = parsed.statements.map(
      (item, i) => {
        if (item.id !== `s${i + 1}`) fail();
        if (item.type === "passage_statement") {
          for (const id of item.evidence_ids) {
            if (!s.passages.some((p) => p.id === id)) fail();
            used.add(id);
          }
          return {
            id: item.id,
            kind: item.kind,
            basis: "passage",
            text: item.text,
            evidence_ids: item.evidence_ids,
            book_handles: [],
          };
        }
        if (item.type === "limitation") {
          if (
            item.reason === "insufficient_selected_evidence" &&
            parsed.status === "supported"
          )
            fail();
          return {
            id: item.id,
            kind: "limitation",
            basis: "context_scope",
            text: reasons[item.reason],
            evidence_ids: [],
            book_handles: [],
          };
        }
        used.add("inventory1");
        let bookHandles: string[] = [],
          text: string;
        if (item.type === "inventory_books") {
          bookHandles = item.book_handles;
          if (!unique(bookHandles)) fail();
          const names = bookHandles.map((h) => {
            const source = s.catalog.sources.find(
              (source) => source.book_handle === h,
            );
            if (!source) fail();
            handles.add(h);
            return source.book.title;
          });
          text = `Registered prepared artifacts: ${names.join("; ")}. This list describes the selected registry entries, not the whole library.`;
        } else
          text = `The admitted prepared snapshot contains ${s.catalog.sources.length} PDF artifacts. Whole-library coverage and index membership are not established.`;
        return {
          id: item.id,
          kind: "answer",
          basis: "inventory",
          text,
          evidence_ids: ["inventory1"],
          book_handles: bookHandles,
        };
      },
    );
    const citations: ResearchAnswer["citations"] = [];
    if (
      used.has("inventory1") &&
      s.context.bindings.length !== s.catalog.sources.length
    )
      fail();
    if (used.has("inventory1"))
      citations.push({
        kind: "prepared_inventory",
        id: "inventory1",
        scope: "admitted_private_prepared_pdf_snapshots",
        source_count: s.catalog.sources.length,
        whole_library_coverage: "not_established",
        index_membership: "not_established",
        books: s.catalog.sources
          .filter((source) => handles.has(source.book_handle))
          .map((source) => ({
            handle: source.book_handle,
            book: structuredClone(source.book),
          })),
      });
    for (const p of s.passages)
      if (used.has(p.id))
        citations.push({
          kind: "pdf_passage",
          id: p.id,
          book_handle: p.source.book_handle,
          book: structuredClone(p.source.book),
          physical_pdf_page_start: p.unit.page_start,
          physical_pdf_page_end: p.unit.page_end,
          extraction: p.unit.extraction,
        });
    return bindResearchAnswer(prepared, {
      contract: "magickli-private-research-answer",
      schema_version: 1,
      answer_id: answerId,
      origin: "model",
      outcome: null,
      validation: "structural-only",
      semantic_review: "unreviewed",
      status: parsed.status,
      statements,
      issues: parsed.issues,
      citations,
    });
  } catch {
    return fail();
  }
}
