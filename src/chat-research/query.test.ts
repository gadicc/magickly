import { describe, expect, it, vi } from "vitest";
import { ANSWER_ID } from "./answer.fixture";
import {
  compileResearchCatalog,
  inspectPreparedResearchEvidence,
  prepareResearchEvidence,
} from "./answerProvenance";
import {
  assertResearchQueryAnswer,
  inspectResearchQuery,
  prepareResearchQuery,
  projectResearchQueryAnswer,
  RESEARCH_QUERY_ERROR,
  type ResearchQueryModeInput,
  researchQueryHistoryCandidate,
} from "./query";
import {
  inventoryQueryDraft,
  passageDraft,
  queryFixture,
} from "./query.fixture";

vi.mock("server-only", () => ({}));
describe("owned private query-mode coverage", () => {
  it("owns mode/context inputs and preserves all uncited inspected sources", () => {
    const mode: ResearchQueryModeInput = {
      mode: "comparison",
      comparison_book_handles: ["book1", "book2"],
    };
    const f = queryFixture({ mode });
    mode.comparison_book_handles!.reverse();
    const out = inspectResearchQuery(f.query);
    expect(out.comparison_book_handles).toEqual(["book1", "book2"]);
    expect(out.context.bindings).toHaveLength(3);
    out.inspected_books[0].book.title = "Changed";
    out.context.bindings.pop();
    expect(inspectResearchQuery(f.query).inspected_books[0].book.title).toBe(
      "Synthetic source title 1",
    );
    expect(inspectResearchQuery(f.query).context.bindings).toHaveLength(3);
  });
  for (const [name, mode] of [
    [
      "pair outside comparison",
      { mode: "passage", comparison_book_handles: ["book1", "book2"] },
    ],
    ["missing comparison pair", { mode: "comparison" }],
    [
      "duplicate pair",
      { mode: "comparison", comparison_book_handles: ["book1", "book1"] },
    ],
    [
      "unknown pair",
      { mode: "comparison", comparison_book_handles: ["book1", "book4"] },
    ],
    [
      "uncovered pair",
      { mode: "comparison", comparison_book_handles: ["book1", "book3"] },
    ],
    [
      "trailing newline alias",
      { mode: "comparison", comparison_book_handles: ["book1\n", "book2"] },
    ],
  ] as [string, ResearchQueryModeInput][])
    it(`rejects ${name}`, () => {
      const f = queryFixture();
      expect(() => prepareResearchQuery(f.evidence, mode)).toThrow(
        RESEARCH_QUERY_ERROR,
      );
    });
  it("requires inventory-only packets and a full roster", () => {
    const f = queryFixture();
    expect(() =>
      prepareResearchQuery(f.evidence, { mode: "inventory" }),
    ).toThrow(RESEARCH_QUERY_ERROR);
    const input = {
      ...f.evidenceInput,
      selected: [],
      inspected_source_ids: ["source1"],
    };
    const p = prepareResearchEvidence(f.catalog, input);
    expect(() => prepareResearchQuery(p, { mode: "inventory" })).toThrow(
      RESEARCH_QUERY_ERROR,
    );
    expect(() => prepareResearchQuery(p, { mode: "passage" })).toThrow(
      RESEARCH_QUERY_ERROR,
    );
    expect(() => queryFixture({ mode: { mode: "inventory" } })).not.toThrow();
  });
  it("keeps incomplete comparison and unresolved-source outcomes scoped and non-ready", () => {
    const mode: ResearchQueryModeInput = {
      mode: "comparison",
      comparison_book_handles: ["book1", "book2"],
    };
    const f = queryFixture({
      mode,
      outcome: "comparison_incomplete",
      selected: [1],
    });
    expect(inspectResearchQuery(f.query).outcome).toBe("comparison_incomplete");
    expect(() =>
      queryFixture({ mode, outcome: "comparison_incomplete" }),
    ).toThrow(RESEARCH_QUERY_ERROR);
    expect(() =>
      queryFixture({ outcome: "comparison_incomplete", selected: [1] }),
    ).toThrow(RESEARCH_QUERY_ERROR);
    expect(() =>
      queryFixture({
        mode: { mode: "comparison" },
        outcome: "needs_source_clarification",
        selected: [],
      }),
    ).not.toThrow();
    expect(() =>
      queryFixture({
        mode,
        outcome: "needs_source_clarification",
        selected: [],
      }),
    ).toThrow(RESEARCH_QUERY_ERROR);
  });
  it("rejects selected third-book contamination and an uninspected comparison handle", () => {
    const f = queryFixture({ selected: [1, 2, 3] });
    expect(() =>
      prepareResearchQuery(f.evidence, {
        mode: "comparison",
        comparison_book_handles: ["book1", "book2"],
      }),
    ).toThrow(RESEARCH_QUERY_ERROR);
    const narrow = queryFixture({ selected: [1], inspected: [1] });
    expect(() =>
      prepareResearchQuery(narrow.evidence, {
        mode: "comparison",
        comparison_book_handles: ["book1", "book2"],
      }),
    ).toThrow(RESEARCH_QUERY_ERROR);
  });
});
describe("query-specific answer projection", () => {
  it("never substitutes inventory support for a passage/comparison question", () => {
    for (const mode of [
      { mode: "passage" },
      { mode: "comparison", comparison_book_handles: ["book1", "book2"] },
    ] as ResearchQueryModeInput[]) {
      const { query } = queryFixture({ mode });
      expect(() =>
        projectResearchQueryAnswer(query, ANSWER_ID, inventoryQueryDraft()),
      ).toThrow(RESEARCH_QUERY_ERROR);
    }
  });
  it("requires each comparison answer to cite both requested sources while permitting per-side observations", () => {
    const { query } = queryFixture({
        mode: {
          mode: "comparison",
          comparison_book_handles: ["book1", "book2"],
        },
      }),
      d = passageDraft();
    expect(() => projectResearchQueryAnswer(query, ANSWER_ID, d)).toThrow(
      RESEARCH_QUERY_ERROR,
    );
    d.statements[0].evidence_ids = ["passage1", "passage2"];
    const answer = projectResearchQueryAnswer(query, ANSWER_ID, d);
    expect(
      assertResearchQueryAnswer(query, answer, d).payload.statements[0]
        .evidence_ids,
    ).toEqual(["passage1", "passage2"]);
    d.status = "insufficient";
    d.statements[0].kind = "observation";
    d.statements[0].evidence_ids = ["passage1"];
    expect(() => projectResearchQueryAnswer(query, ANSWER_ID, d)).not.toThrow();
  });
  it("supports insufficient inventory metadata without inventing a positive inventory fact", () => {
    const { query } = queryFixture({ mode: { mode: "inventory" } }),
      d = {
        status: "insufficient",
        statements: [
          { type: "limitation", id: "s1", reason: "metadata_incomplete" },
        ],
        issues: [],
      };
    const answer = projectResearchQueryAnswer(query, ANSWER_ID, d);
    expect(assertResearchQueryAnswer(query, answer, d).payload.status).toBe(
      "insufficient",
    );
    expect(() =>
      projectResearchQueryAnswer(query, ANSWER_ID, passageDraft()),
    ).toThrow(RESEARCH_QUERY_ERROR);
  });
  it("checks prose code points before accepting any provider draft", () => {
    const { query } = queryFixture(),
      d = passageDraft();
    d.statements[0].text = "界".repeat(4001);
    expect(() => projectResearchQueryAnswer(query, ANSWER_ID, d)).toThrow(
      RESEARCH_QUERY_ERROR,
    );
  });
  it("binds the exact private query, not an equal context or even a separately recreated identical query", () => {
    const a = queryFixture(),
      b = queryFixture({ question: "Different question" }),
      c = prepareResearchQuery(a.evidence, { mode: "passage" }),
      d = passageDraft();
    expect(inspectPreparedResearchEvidence(a.evidence).context).toEqual(
      inspectPreparedResearchEvidence(b.evidence).context,
    );
    const answer = projectResearchQueryAnswer(a.query, ANSWER_ID, d);
    for (const q of [b.query, c, { ...a.query }])
      expect(() => assertResearchQueryAnswer(q, answer, d)).toThrow(
        RESEARCH_QUERY_ERROR,
      );
    expect(() => assertResearchQueryAnswer(a.query, { ...answer }, d)).toThrow(
      RESEARCH_QUERY_ERROR,
    );
    const history = researchQueryHistoryCandidate(answer)!;
    expect(history.query_revision).toBe(a.query.revision);
    expect(history.answer_revision).toBe(answer.revision);
    expect(history.context.bindings).toHaveLength(3);
  });
  it("owns the normalized draft and rejects later mutations while accepting JSON key reorder", () => {
    const { query } = queryFixture(),
      d = passageDraft(),
      answer = projectResearchQueryAnswer(query, ANSWER_ID, d);
    const reversed = Object.fromEntries(Object.entries(d).reverse());
    expect(() =>
      assertResearchQueryAnswer(query, answer, reversed),
    ).not.toThrow();
    d.statements[0].text = "Changed";
    expect(() => assertResearchQueryAnswer(query, answer, d)).toThrow(
      RESEARCH_QUERY_ERROR,
    );
    expect(() => inspectResearchQuery({ ...query })).toThrow(
      RESEARCH_QUERY_ERROR,
    );
    expect(() =>
      projectResearchQueryAnswer({ ...query }, ANSWER_ID, d),
    ).toThrow(RESEARCH_QUERY_ERROR);
    expect(() => researchQueryHistoryCandidate({ ...answer })).toThrow(
      RESEARCH_QUERY_ERROR,
    );
  });
  it("requires null model input for non-ready server outcomes and never yields model history", () => {
    const { query } = queryFixture({ outcome: "no_evidence", selected: [] }),
      answer = projectResearchQueryAnswer(query, ANSWER_ID, null);
    expect(assertResearchQueryAnswer(query, answer, null).payload.outcome).toBe(
      "no_evidence",
    );
    expect(researchQueryHistoryCandidate(answer)).toBeNull();
    expect(() =>
      projectResearchQueryAnswer(query, ANSWER_ID, passageDraft()),
    ).toThrow(RESEARCH_QUERY_ERROR);
    expect(() =>
      assertResearchQueryAnswer(query, answer, passageDraft()),
    ).toThrow(RESEARCH_QUERY_ERROR);
    const { query: ready } = queryFixture();
    expect(() => projectResearchQueryAnswer(ready, ANSWER_ID, null)).toThrow(
      RESEARCH_QUERY_ERROR,
    );
  });
});

it("byte-identical PDF aliases cannot satisfy two-artifact comparison coverage", () => {
  const f = queryFixture(),
    input = f.input;
  input.sources[1].source_version = input.sources[0].source_version;
  input.sources[1].book = structuredClone(input.sources[0].book);
  const catalog = compileResearchCatalog(input),
    prepared = prepareResearchEvidence(catalog, f.evidenceInput);
  const mode: ResearchQueryModeInput = {
    mode: "comparison",
    comparison_book_handles: ["book1", "book2"],
  };
  expect(() => prepareResearchQuery(prepared, mode)).toThrow(
    RESEARCH_QUERY_ERROR,
  );
  const incomplete = prepareResearchEvidence(catalog, {
    ...f.evidenceInput,
    outcome: "comparison_incomplete",
  });
  const query = prepareResearchQuery(incomplete, mode),
    answer = projectResearchQueryAnswer(query, ANSWER_ID, null);
  expect(assertResearchQueryAnswer(query, answer, null).payload.outcome).toBe(
    "comparison_incomplete",
  );
});

it("inventory mode cannot report a passage-search no-evidence outcome", () => {
  const f = queryFixture({ outcome: "no_evidence", selected: [] });
  expect(() => prepareResearchQuery(f.evidence, { mode: "inventory" })).toThrow(
    RESEARCH_QUERY_ERROR,
  );
});
