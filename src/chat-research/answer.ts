/** Browser-safe app contract. Validation is structural, never source authorization or expert review. */
import * as v from "valibot";
import { validIsbn } from "./answerIsbn";

export const RESEARCH_ANSWER_ERROR = "Private research answer unavailable";
export const RESEARCH_ANSWER_BYTE_LIMIT = 128 * 1024;
export const RESEARCH_QUERY_OUTCOMES = Object.freeze({
  no_evidence:
    "No matching passages were returned by this retrieval control. This does not establish absence from the collection or wider library.",
  needs_source_clarification:
    "The named source or edition is not resolved by the prepared metadata. Please clarify the requested source.",
  comparison_incomplete:
    "The selected passages do not cover two resolved source artifacts for this comparison.",
} as const);
export type ResearchQueryOutcome = keyof typeof RESEARCH_QUERY_OUTCOMES;
const roles = [
  "author",
  "editor",
  "translator",
  "foreword",
  "introduction",
  "notes",
  "digital_edition_credit",
] as const;
const dateKinds = [
  "publication",
  "first_publication",
  "original_publication",
  "revision",
  "edition_history",
  "first_printing",
  "digital_edition",
  "first_paperback",
  "reprint",
] as const;
const answerId = v.pipe(
  v.string(),
  v.regex(
    /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$(?![\s\S])/,
  ),
);
/** Exact UUIDv7 syntax only; it conveys no ownership or access. */
export const validResearchAnswerId = (value: unknown): value is string =>
  v.is(answerId, value);

const text = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(512),
  v.check((s) => s.trim() === s),
);
const handle = v.pipe(
  v.string(),
  v.regex(/^book([1-9]|[12][0-9]|3[0-2])$(?![\s\S])/),
);
const evidenceId = v.pipe(
  v.string(),
  v.regex(/^(inventory1|passage[1-4])$(?![\s\S])/),
);
const statementId = v.pipe(
  v.string(),
  v.regex(/^s([1-9]|1[0-9]|20)$(?![\s\S])/),
);
const book = v.strictObject({
  title: text,
  subtitle: v.nullable(text),
  volume: v.nullable(text),
  language: v.nullable(text),
  title_status: v.picklist(["locally_observed", "catalog_fallback"]),
  contributors: v.pipe(
    v.array(v.strictObject({ name: text, role: v.picklist(roles) })),
    v.maxLength(64),
  ),
  publisher: v.nullable(text),
  edition: v.nullable(text),
  dates: v.pipe(
    v.array(
      v.strictObject({
        kind: v.picklist(dateKinds),
        year: v.pipe(
          v.number(),
          v.safeInteger(),
          v.minValue(1000),
          v.maxValue(2200),
        ),
      }),
    ),
    v.maxLength(64),
  ),
  isbns: v.pipe(
    v.array(
      v.strictObject({
        value: v.pipe(text, v.check(validIsbn)),
        format: v.picklist(["ebook", "paperback", "hardback", "unknown"]),
      }),
    ),
    v.maxLength(64),
  ),
  notes: v.pipe(v.array(text), v.maxLength(32)),
  candidate_fields: v.pipe(
    v.number(),
    v.safeInteger(),
    v.minValue(0),
    v.maxValue(256),
  ),
});
/** Checked metadata projection only; no identity, source authority or edition verification is inferred. */
export type ResearchBook = v.InferOutput<typeof book>;
export function parseResearchBook(value: unknown): ResearchBook {
  try {
    if (
      new TextEncoder().encode(JSON.stringify(value)).byteLength >
      RESEARCH_ANSWER_BYTE_LIMIT
    )
      throw Error();
    const projected = v.parse(book, value);
    if (
      new TextEncoder().encode(JSON.stringify(projected)).byteLength >
      RESEARCH_ANSWER_BYTE_LIMIT
    )
      throw Error();
    return projected;
  } catch {
    throw Error(RESEARCH_ANSWER_ERROR);
  }
}
const shape = v.strictObject({
  contract: v.literal("magickli-private-research-answer"),
  schema_version: v.literal(1),
  answer_id: answerId,
  origin: v.picklist(["model", "server_query_outcome"]),
  outcome: v.nullable(
    v.picklist([
      "no_evidence",
      "needs_source_clarification",
      "comparison_incomplete",
    ]),
  ),
  validation: v.literal("structural-only"),
  semantic_review: v.literal("unreviewed"),
  status: v.picklist(["supported", "partial", "insufficient"]),
  statements: v.pipe(
    v.array(
      v.strictObject({
        id: statementId,
        kind: v.picklist(["answer", "observation", "limitation"]),
        basis: v.picklist(["passage", "inventory", "context_scope"]),
        text: v.pipe(
          v.string(),
          v.minLength(1),
          v.maxLength(16000),
          v.check((s) => s.trim().length > 0),
        ),
        evidence_ids: v.pipe(v.array(evidenceId), v.maxLength(4)),
        book_handles: v.pipe(v.array(handle), v.maxLength(32)),
      }),
    ),
    v.minLength(1),
    v.maxLength(20),
  ),
  issues: v.pipe(
    v.array(
      v.strictObject({
        kind: v.picklist(["conflict", "source_attribution", "missing_context"]),
        statement_ids: v.pipe(
          v.array(statementId),
          v.minLength(1),
          v.maxLength(20),
        ),
        affects_answer: v.boolean(),
      }),
    ),
    v.maxLength(10),
  ),
  citations: v.pipe(
    v.array(
      v.variant("kind", [
        v.strictObject({
          kind: v.literal("prepared_inventory"),
          id: v.literal("inventory1"),
          scope: v.literal("admitted_private_prepared_pdf_snapshots"),
          source_count: v.pipe(
            v.number(),
            v.safeInteger(),
            v.minValue(1),
            v.maxValue(32),
          ),
          whole_library_coverage: v.literal("not_established"),
          index_membership: v.literal("not_established"),
          books: v.pipe(
            v.array(v.strictObject({ handle, book })),
            v.maxLength(32),
          ),
        }),
        v.strictObject({
          kind: v.literal("pdf_passage"),
          id: v.pipe(v.string(), v.regex(/^passage[1-4]$(?![\s\S])/)),
          book_handle: handle,
          book,
          physical_pdf_page_start: v.pipe(
            v.number(),
            v.safeInteger(),
            v.minValue(1),
          ),
          physical_pdf_page_end: v.pipe(
            v.number(),
            v.safeInteger(),
            v.minValue(1),
          ),
          extraction: v.picklist(["native_text", "unverified_ocr"]),
        }),
      ]),
    ),
    v.maxLength(5),
  ),
});
/** Complete answer/citation transport; model status is not an expert quality grade. */
export type ResearchAnswer = v.InferOutput<typeof shape>;
const unique = (xs: string[]) => new Set(xs).size === xs.length;
/** Enforce finite evidence graphs and consistent server-projected metadata without accepting source resources. */
export function parseResearchAnswer(value: unknown): ResearchAnswer {
  try {
    if (
      new TextEncoder().encode(JSON.stringify(value)).byteLength >
      RESEARCH_ANSWER_BYTE_LIMIT
    )
      throw Error();
    const a = v.parse(shape, value);
    // Check the owned plain projection too: an inherited toJSON may have hidden input bytes.
    if (
      new TextEncoder().encode(JSON.stringify(a)).byteLength >
      RESEARCH_ANSWER_BYTE_LIMIT
    )
      throw Error();
    if (
      !unique(a.statements.map((s) => s.id)) ||
      !unique(a.citations.map((c) => c.id))
    )
      throw Error();
    const cited = new Set<string>(),
      books = new Map<string, string>();
    const addBook = (h: string, b: unknown) => {
      const text = JSON.stringify(b);
      if (books.has(h) && books.get(h) !== text) throw Error();
      books.set(h, text);
    };
    for (const c of a.citations) {
      if (c.kind === "pdf_passage") {
        if (c.physical_pdf_page_end < c.physical_pdf_page_start) throw Error();
        addBook(c.book_handle, c.book);
      } else {
        if (
          !unique(c.books.map((b) => b.handle)) ||
          c.books.length > c.source_count
        )
          throw Error();
        c.books.forEach((b) => addBook(b.handle, b.book));
      }
    }
    for (const s of a.statements) {
      if (
        !unique(s.evidence_ids) ||
        !unique(s.book_handles) ||
        s.evidence_ids.some((id) => !a.citations.some((c) => c.id === id))
      )
        throw Error();
      s.evidence_ids.forEach((id) => cited.add(id));
      if (s.basis === "context_scope") {
        if (
          s.kind !== "limitation" ||
          s.evidence_ids.length ||
          s.book_handles.length
        )
          throw Error();
      } else if (s.basis === "passage") {
        if (
          s.kind === "limitation" ||
          !s.evidence_ids.length ||
          s.evidence_ids.some((id) => !id.startsWith("passage")) ||
          s.book_handles.length
        )
          throw Error();
      } else {
        if (
          s.kind !== "answer" ||
          s.evidence_ids.length !== 1 ||
          s.evidence_ids[0] !== "inventory1"
        )
          throw Error();
        const inv = a.citations.find((c) => c.kind === "prepared_inventory");
        if (
          !inv ||
          inv.kind !== "prepared_inventory" ||
          s.book_handles.some((h) => !inv.books.some((b) => b.handle === h))
        )
          throw Error();
      }
    }
    if (a.citations.some((c) => !cited.has(c.id))) throw Error();
    const ids = new Set(a.statements.map((s) => s.id));
    if (
      !unique(
        a.issues.map((i) =>
          JSON.stringify([i.kind, [...i.statement_ids].sort()]),
        ),
      )
    )
      throw Error();
    for (const i of a.issues) {
      if (
        !unique(i.statement_ids) ||
        i.statement_ids.some((id) => !ids.has(id)) ||
        (i.kind === "conflict" &&
          (i.statement_ids.length < 2 ||
            i.statement_ids.some(
              (id) =>
                a.statements.find((s) => s.id === id)?.basis !== "passage",
            ))) ||
        (a.status === "supported" && i.affects_answer)
      )
        throw Error();
    }
    if (
      a.status === "partial" &&
      !a.statements.some((s) => s.kind === "limitation") &&
      !a.issues.some((i) => i.affects_answer)
    )
      throw Error();
    if (
      (a.status === "insufficient") ===
      a.statements.some((s) => s.kind === "answer")
    )
      throw Error();
    if (
      a.origin === "server_query_outcome" &&
      (a.status !== "insufficient" ||
        a.statements.some((s) => s.basis !== "context_scope") ||
        a.citations.length ||
        a.issues.length ||
        a.statements.length !== 1 ||
        a.outcome === null ||
        a.statements[0].text !== RESEARCH_QUERY_OUTCOMES[a.outcome])
    )
      throw Error();
    if (a.origin === "model" && a.outcome !== null) throw Error();
    return a;
  } catch {
    throw Error(RESEARCH_ANSWER_ERROR);
  }
}

/** Source-free server outcome, only after successful authorized retrieval returned the matching outcome.
 * Identity, policy, retrieval and provider errors remain failures; this is never their fallback.
 * Eligibility is a server coordinator precondition, not enforced by this browser-safe factory. */
export function researchQueryOutcomeAnswer(
  answer_id: string,
  outcome: ResearchQueryOutcome,
): ResearchAnswer {
  return parseResearchAnswer({
    contract: "magickli-private-research-answer",
    schema_version: 1,
    answer_id,
    origin: "server_query_outcome",
    outcome,
    validation: "structural-only",
    semantic_review: "unreviewed",
    status: "insufficient",
    statements: [
      {
        id: "s1",
        kind: "limitation",
        basis: "context_scope",
        text: RESEARCH_QUERY_OUTCOMES[outcome],
        evidence_ids: [],
        book_handles: [],
      },
    ],
    issues: [],
    citations: [],
  });
}

/** Successful authorized retrieval with no matching evidence; never an error fallback. */
export function noResearchEvidenceAnswer(answer_id: string): ResearchAnswer {
  return researchQueryOutcomeAnswer(answer_id, "no_evidence");
}
