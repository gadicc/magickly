/** Synthetic-only data for query/request contract controls. */
import { createHash } from "node:crypto";
import { ANSWER_ID, answerFixture, OTHER_ANSWER_ID } from "./answer.fixture";
import {
  compileResearchCatalog,
  prepareResearchEvidence,
  type ResearchCatalogInput,
  type ResearchEvidenceInput,
} from "./answerProvenance";
import { prepareResearchQuery, type ResearchQueryModeInput } from "./query";
export const querySha = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export function queryFixture(
  options: {
    mode?: ResearchQueryModeInput;
    question?: string;
    outcome?: ResearchEvidenceInput["outcome"];
    texts?: string[];
    selected?: number[];
    inspected?: number[];
  } = {},
) {
  const texts = options.texts ?? [
    "Synthetic source one.",
    "Synthetic source two.",
    "Synthetic source three.",
  ];
  const book = answerFixture().citations.find(
    (c) => c.kind === "pdf_passage",
  )!.book;
  const input: ResearchCatalogInput = {
    schema_version: 1,
    sources: texts.map((text, i) => ({
      source_id: `source${i + 1}`,
      source_version: querySha(`pdf${i + 1}`),
      pdf_pages: 10,
      book: {
        ...structuredClone(book),
        title: `Synthetic source title ${i + 1}`,
      },
      units: [
        {
          id: `unit${i + 1}`,
          page_start: i + 1,
          page_end: i + 2,
          extraction: i === 1 ? "unverified_ocr" : "native_text",
          text_sha256: querySha(text),
        },
      ],
    })),
  };
  const catalog = compileResearchCatalog(input);
  const mode = options.mode ?? { mode: "passage" };
  const selected =
    options.selected ?? (mode.mode === "inventory" ? [] : [1, 2]);
  const evidenceInput: ResearchEvidenceInput = {
    subject: { kind: "user", user_id: ANSWER_ID, session_id: OTHER_ANSWER_ID },
    expires_at_ms: 10000,
    question: options.question ?? "Synthetic question?",
    outcome: options.outcome ?? "ready",
    inspected_source_ids: (options.inspected ?? [1, 2, 3]).map(
      (i) => `source${i}`,
    ),
    selected: selected.map((i) => ({
      unit_id: `unit${i}`,
      text: texts[i - 1],
    })),
  };
  const evidence = prepareResearchEvidence(catalog, evidenceInput),
    query = prepareResearchQuery(evidence, mode);
  return { input, catalog, evidence, evidenceInput, query, mode };
}
export const passageDraft = () => ({
  status: "partial",
  statements: [
    {
      type: "passage_statement",
      id: "s1",
      kind: "answer",
      text: "Synthetic answer.",
      evidence_ids: ["passage1"],
    },
    { type: "limitation", id: "s2", reason: "scope_limited" },
  ],
  issues: [],
});
export const inventoryQueryDraft = () => ({
  status: "supported",
  statements: [{ type: "inventory_count", id: "s1" }],
  issues: [],
});
