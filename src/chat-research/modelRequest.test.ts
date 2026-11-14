import { describe, expect, it, vi } from "vitest";
import { ANSWER_ID, OTHER_ANSWER_ID } from "./answer.fixture";
import {
  compileResearchCatalog,
  prepareResearchEvidence,
} from "./answerProvenance";
import {
  assertResearchRequestAnswer,
  freezeResearchModelRequest,
  inspectFrozenResearchModelRequest,
  RESEARCH_MODEL_ID,
  RESEARCH_OUTPUT_TOKEN_LIMIT,
  RESEARCH_REQUEST_BYTE_LIMIT,
  RESEARCH_REQUEST_ERROR,
} from "./modelRequest";
import { prepareResearchQuery, projectResearchQueryAnswer } from "./query";
import {
  inventoryQueryDraft,
  passageDraft,
  queryFixture,
} from "./query.fixture";

vi.mock("server-only", () => ({}));
const body = (q: ReturnType<typeof queryFixture>["query"]) =>
  JSON.parse(
    inspectFrozenResearchModelRequest(freezeResearchModelRequest(q, ANSWER_ID))
      .body_json,
  );
describe("immutable single-turn model request compiler", () => {
  it("builds only a bounded text-only high-reasoning control without credentials or network", () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(Error("No network"));
    try {
      const f = queryFixture(),
        request = freezeResearchModelRequest(f.query, ANSWER_ID),
        out = inspectFrozenResearchModelRequest(request),
        b = JSON.parse(out.body_json),
        input = JSON.parse(b.input);
      expect(Object.isFrozen(request)).toBe(true);
      expect(b).toMatchObject({
        model: RESEARCH_MODEL_ID,
        store: false,
        service_tier: "default",
        reasoning: { effort: "high" },
        max_output_tokens: RESEARCH_OUTPUT_TOKEN_LIMIT,
        providerOptions: { gateway: { only: ["openai"] } },
      });
      expect(b).not.toHaveProperty("tools");
      expect(b).not.toHaveProperty("previous_response_id");
      expect(b).not.toHaveProperty("background");
      expect(input).toMatchObject({
        schema_version: 1,
        question: "Synthetic question?",
        mode: "passage",
        inventory: null,
        history: [],
      });
      expect(input.passages).toHaveLength(2);
      expect(input.passages[1].extraction).toBe("unverified_ocr");
      for (const key of [
        "subject",
        "bindings",
        "source_id",
        "source_version",
        "evidence_version",
        "corpus_version",
        "prepared_revision",
        "inspected_books",
        "authorization",
      ])
        expect(out.body_json).not.toContain(`\\"${key}\\"`);
      expect(out.body_json).not.toContain(ANSWER_ID);
      expect(out.body_json).not.toContain(OTHER_ANSWER_ID);
      expect(Buffer.byteLength(out.body_json)).toBeLessThanOrEqual(
        RESEARCH_REQUEST_BYTE_LIMIT,
      );
      out.context.bindings.pop();
      expect(
        inspectFrozenResearchModelRequest(request).context.bindings,
      ).toHaveLength(3);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
  it("restricts wire schemas to this mode and actual local aliases, with every object closed and required", () => {
    const passage = body(queryFixture().query),
      inventory = body(queryFixture({ mode: { mode: "inventory" } }).query),
      comparison = body(
        queryFixture({
          mode: {
            mode: "comparison",
            comparison_book_handles: ["book1", "book2"],
          },
        }).query,
      );
    for (const b of [passage, inventory, comparison]) {
      const schema = b.text.format.schema;
      expect(b.text.format).toMatchObject({
        type: "json_schema",
        name: "magickli_private_research_draft_v1",
        strict: true,
      });
      expect(schema.type).toBe("object");
      expect(schema).not.toHaveProperty("anyOf");
      const visit = (x: unknown) => {
        if (!x || typeof x !== "object") return;
        if (Array.isArray(x)) {
          x.forEach(visit);
          return;
        }
        const node = x as Record<string, unknown>;
        if (node.type === "object") {
          expect(node.additionalProperties).toBe(false);
          expect([...(node.required as string[])].sort()).toEqual(
            Object.keys(node.properties as object).sort(),
          );
        }
        Object.values(node).forEach(visit);
      };
      visit(schema);
    }
    const types = (b: typeof passage) =>
      b.text.format.schema.properties.statements.items.anyOf.map(
        (v: { properties: { type: { enum: string[] } } }) =>
          v.properties.type.enum[0],
      );
    expect(types(passage)).toEqual(["passage_statement", "limitation"]);
    expect(types(comparison)).toEqual(["passage_statement", "limitation"]);
    expect(types(inventory)).toEqual([
      "inventory_count",
      "inventory_books",
      "limitation",
    ]);
    const variants =
      passage.text.format.schema.properties.statements.items.anyOf;
    expect(variants[0].properties.evidence_ids.items.enum).toEqual([
      "passage1",
      "passage2",
    ]);
    expect(variants[0].properties.text.maxLength).toBe(4000);
    expect(
      inventory.text.format.schema.properties.statements.items.anyOf[1]
        .properties.book_handles.items.enum,
    ).toEqual(["book1", "book2", "book3"]);
    expect(JSON.parse(inventory.input).inventory.books).toHaveLength(3);
    expect(JSON.parse(comparison.input).comparison_book_handles).toEqual([
      "book1",
      "book2",
    ]);
  });
  it("owns request bytes and distinguishes question, mode, answer identity and prepared context", () => {
    const f = queryFixture(),
      a = freezeResearchModelRequest(f.query, ANSWER_ID),
      b = freezeResearchModelRequest(f.query, OTHER_ANSWER_ID);
    expect(a.revision).not.toBe(b.revision);
    expect(inspectFrozenResearchModelRequest(a).request_sha256).toBe(
      inspectFrozenResearchModelRequest(b).request_sha256,
    );
    const other = freezeResearchModelRequest(
      queryFixture({ question: "Different question?" }).query,
      ANSWER_ID,
    );
    expect(inspectFrozenResearchModelRequest(other).request_sha256).not.toBe(
      inspectFrozenResearchModelRequest(a).request_sha256,
    );
    const comparison = freezeResearchModelRequest(
      prepareResearchQuery(f.evidence, {
        mode: "comparison",
        comparison_book_handles: ["book1", "book2"],
      }),
      ANSWER_ID,
    );
    expect(comparison.revision).not.toBe(a.revision);
    const view = inspectFrozenResearchModelRequest(a);
    view.context.subject.user_id = OTHER_ANSWER_ID;
    view.body_json = "changed";
    expect(inspectFrozenResearchModelRequest(a).context.subject.user_id).toBe(
      ANSWER_ID,
    );
    expect(inspectFrozenResearchModelRequest(a).body_json).not.toBe("changed");
  });
  it("rejects copied handles, invalid answer IDs and non-ready outcomes before any request exists", () => {
    const { query } = queryFixture(),
      request = freezeResearchModelRequest(query, ANSWER_ID);
    expect(() => freezeResearchModelRequest({ ...query }, ANSWER_ID)).toThrow(
      RESEARCH_REQUEST_ERROR,
    );
    expect(() => inspectFrozenResearchModelRequest({ ...request })).toThrow(
      RESEARCH_REQUEST_ERROR,
    );
    expect(() => freezeResearchModelRequest(query, `${ANSWER_ID}\n`)).toThrow(
      RESEARCH_REQUEST_ERROR,
    );
    const noEvidence = queryFixture({ outcome: "no_evidence", selected: [] });
    expect(() =>
      freezeResearchModelRequest(noEvidence.query, ANSWER_ID),
    ).toThrow(RESEARCH_REQUEST_ERROR);
  });
  it("rejects body size overflow and malformed Unicode without trimming registered source text", () => {
    const oversized = queryFixture({
      texts: Array.from({ length: 3 }, () => "界".repeat(16000)),
      selected: [1, 2, 3],
    });
    expect(() =>
      freezeResearchModelRequest(oversized.query, ANSWER_ID),
    ).toThrow(RESEARCH_REQUEST_ERROR);
    const invalid = queryFixture({ question: "Invalid \uD800 question" });
    expect(() => freezeResearchModelRequest(invalid.query, ANSWER_ID)).toThrow(
      RESEARCH_REQUEST_ERROR,
    );
    const f = queryFixture();
    Object.assign(f.input.sources[0].book as object, {
      title: "Invalid \uD800 title",
    });
    const p = prepareResearchEvidence(
        compileResearchCatalog(f.input),
        f.evidenceInput,
      ),
      q = prepareResearchQuery(p, { mode: "passage" });
    expect(() => freezeResearchModelRequest(q, ANSWER_ID)).toThrow(
      RESEARCH_REQUEST_ERROR,
    );
  });
});
describe("exact request-to-answer binding", () => {
  it("requires this private query identity and original normalized provider draft", () => {
    const f = queryFixture(),
      draft = passageDraft(),
      answer = projectResearchQueryAnswer(f.query, ANSWER_ID, draft),
      request = freezeResearchModelRequest(f.query, ANSWER_ID);
    const verified = assertResearchRequestAnswer(request, answer, draft);
    expect(verified.request_sha256).toBe(
      inspectFrozenResearchModelRequest(request).request_sha256,
    );
    expect(verified.payload.answer_id).toBe(ANSWER_ID);
    expect(verified.normalized_draft_sha256).toMatch(/^[a-f0-9]{64}$/);
    const other = queryFixture({ question: "Different question?" }),
      wrong = projectResearchQueryAnswer(other.query, ANSWER_ID, draft);
    expect(() => assertResearchRequestAnswer(request, wrong, draft)).toThrow(
      RESEARCH_REQUEST_ERROR,
    );
    const identical = prepareResearchQuery(f.evidence, { mode: "passage" });
    expect(identical.revision).toBe(f.query.revision);
    expect(() =>
      assertResearchRequestAnswer(
        request,
        projectResearchQueryAnswer(identical, ANSWER_ID, draft),
        draft,
      ),
    ).toThrow(RESEARCH_REQUEST_ERROR);
    const wrongId = projectResearchQueryAnswer(f.query, OTHER_ANSWER_ID, draft);
    expect(() => assertResearchRequestAnswer(request, wrongId, draft)).toThrow(
      RESEARCH_REQUEST_ERROR,
    );
    draft.statements[0].text = "Changed provider draft";
    expect(() => assertResearchRequestAnswer(request, answer, draft)).toThrow(
      RESEARCH_REQUEST_ERROR,
    );
    expect(() =>
      assertResearchRequestAnswer({ ...request }, answer, draft),
    ).toThrow(RESEARCH_REQUEST_ERROR);
    expect(() =>
      assertResearchRequestAnswer(request, { ...answer }, draft),
    ).toThrow(RESEARCH_REQUEST_ERROR);
  });
  it("supports the same closed contract for server-projected inventory facts", () => {
    const f = queryFixture({ mode: { mode: "inventory" } }),
      draft = inventoryQueryDraft(),
      answer = projectResearchQueryAnswer(f.query, ANSWER_ID, draft),
      request = freezeResearchModelRequest(f.query, ANSWER_ID);
    expect(
      assertResearchRequestAnswer(request, answer, draft).payload.citations[0],
    ).toMatchObject({ kind: "prepared_inventory", source_count: 3 });
  });
});

it("advertises complete conflict and duplicate-issue rules that remain enforced server-side", () => {
  const f = queryFixture(),
    b = body(f.query);
  expect(b.instructions).toContain(
    "Every conflict target must be a passage_statement, never a limitation or inventory declaration",
  );
  expect(b.instructions).toContain(
    "same kind and unordered statement-ID set, regardless of ID order or affects_answer",
  );
  const d = {
    status: "partial",
    statements: [
      {
        type: "passage_statement",
        id: "s1",
        kind: "answer",
        text: "First",
        evidence_ids: ["passage1"],
      },
      {
        type: "passage_statement",
        id: "s2",
        kind: "observation",
        text: "Second",
        evidence_ids: ["passage2"],
      },
      { type: "limitation", id: "s3", reason: "scope_limited" },
    ],
    issues: [
      {
        kind: "conflict",
        statement_ids: ["s1", "s2", "s3"],
        affects_answer: true,
      },
    ],
  };
  expect(() => projectResearchQueryAnswer(f.query, ANSWER_ID, d)).toThrow();
  d.issues[0].statement_ids = ["s1", "s2"];
  d.issues.push({
    ...d.issues[0],
    statement_ids: ["s2", "s1"],
    affects_answer: false,
  });
  expect(() => projectResearchQueryAnswer(f.query, ANSWER_ID, d)).toThrow();
  const inventory = body(queryFixture({ mode: { mode: "inventory" } }).query);
  expect(
    inventory.text.format.schema.properties.issues.items.properties.kind.enum,
  ).toEqual(["source_attribution", "missing_context"]);
});
