/** Synthetic public metadata only, shared by transport tests. */
import type { ResearchAnswer } from "./answer";
export const ANSWER_ID = "019aa111-0000-7000-8000-000000000001";
export const OTHER_ANSWER_ID = "019aa111-0000-7000-8000-000000000002";
export function answerFixture(): ResearchAnswer {
  const book = {
    title: "Synthetic book",
    subtitle: "Synthetic subtitle",
    volume: null,
    language: "en",
    title_status: "locally_observed" as const,
    contributors: [{ name: "Synthetic Author", role: "author" as const }],
    publisher: "Synthetic Press",
    edition: "Second edition",
    dates: [{ kind: "publication" as const, year: 2020 }],
    isbns: [{ value: "978-0-306-40615-7", format: "paperback" as const }],
    notes: [],
    candidate_fields: 0,
  };
  return {
    contract: "magickli-private-research-answer",
    schema_version: 1,
    answer_id: ANSWER_ID,
    origin: "model",
    outcome: null,
    validation: "structural-only",
    semantic_review: "unreviewed",
    status: "partial",
    statements: [
      {
        id: "s1",
        kind: "answer",
        basis: "passage",
        text: "Synthetic answer.",
        evidence_ids: ["passage1"],
        book_handles: [],
      },
      {
        id: "s2",
        kind: "answer",
        basis: "inventory",
        text: "Synthetic inventory observation.",
        evidence_ids: ["inventory1"],
        book_handles: ["book1"],
      },
      {
        id: "s3",
        kind: "limitation",
        basis: "context_scope",
        text: "Evidence is limited.",
        evidence_ids: [],
        book_handles: [],
      },
    ],
    issues: [
      {
        kind: "missing_context",
        statement_ids: ["s1", "s3"],
        affects_answer: true,
      },
    ],
    citations: [
      {
        kind: "pdf_passage",
        id: "passage1",
        book_handle: "book1",
        book: structuredClone(book),
        physical_pdf_page_start: 2,
        physical_pdf_page_end: 3,
        extraction: "native_text",
      },
      {
        kind: "prepared_inventory",
        id: "inventory1",
        scope: "admitted_private_prepared_pdf_snapshots",
        source_count: 2,
        whole_library_coverage: "not_established",
        index_membership: "not_established",
        books: [{ handle: "book1", book: structuredClone(book) }],
      },
    ],
  };
}
