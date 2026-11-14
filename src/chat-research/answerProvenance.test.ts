import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { parseResearchBook, RESEARCH_ANSWER_ERROR } from "./answer";
import { ANSWER_ID, answerFixture, OTHER_ANSWER_ID } from "./answer.fixture";
import {
  compileResearchCatalog,
  inspectBoundResearchAnswer,
  inspectPreparedResearchCatalogView,
  inspectPreparedResearchEvidence,
  parseResearchAnswerDraft,
  prepareResearchCatalogView,
  prepareResearchEvidence,
  projectResearchAnswer,
  RESEARCH_PROVENANCE_ERROR,
  type ResearchCatalogInput,
  type ResearchEvidenceInput,
  researchAnswerHistoryCandidate,
  ungrantedResearchCatalogPolicy,
} from "./answerProvenance";
import {
  RESEARCH_SOURCE_ERROR,
  type ResearchSourceReaders,
  requireResearchSourceAccess,
} from "./sourceAuthorization";
import {
  prepareResearchSourcePolicy,
  readResearchSourcePolicy,
  researchPolicySnapshot,
} from "./sourcePolicy";

vi.mock("server-only", () => ({}));
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const metadata = () =>
  answerFixture().citations.find((c) => c.kind === "pdf_passage")!.book;
function catalogInput(): ResearchCatalogInput {
  return {
    schema_version: 1,
    sources: [1, 2, 3].map((i) => ({
      source_id: `source${i}`,
      source_version: sha(`pdf${i}`),
      pdf_pages: 10,
      book: { ...metadata(), title: `Synthetic book ${i}` },
      units: [
        {
          id: `unit${i}`,
          page_start: i,
          page_end: i + 1,
          extraction: i === 2 ? "unverified_ocr" : "native_text",
          text_sha256: sha(`Synthetic passage ${i}`),
        },
      ],
    })),
  };
}
function evidenceInput(): ResearchEvidenceInput {
  return {
    subject: { kind: "user", user_id: ANSWER_ID, session_id: OTHER_ANSWER_ID },
    expires_at_ms: 10000,
    question: "Synthetic original question?",
    outcome: "ready",
    inspected_source_ids: ["source1", "source2", "source3"],
    selected: [1, 2].map((i) => ({
      unit_id: `unit${i}`,
      text: `Synthetic passage ${i}`,
    })),
  };
}
function setup(input = evidenceInput()) {
  const c = compileResearchCatalog(catalogInput()),
    p = prepareResearchEvidence(c, input);
  return { c, p };
}
const draft = () => ({
  status: "partial",
  statements: [
    {
      type: "passage_statement",
      id: "s1",
      kind: "answer",
      text: "Synthetic answer",
      evidence_ids: ["passage1"],
    },
    { type: "limitation", id: "s2", reason: "scope_limited" },
  ],
  issues: [],
});
const inventoryDraft = () => ({
  status: "supported",
  statements: [
    { type: "inventory_count", id: "s1" },
    { type: "inventory_books", id: "s2", book_handles: ["book2"] },
  ],
  issues: [],
});

describe("intrinsic source catalog", () => {
  it("derives leaves before the policy root, stays canonical under reorder and grants nothing", () => {
    const input = catalogInput(),
      c = compileResearchCatalog(input),
      policy = ungrantedResearchCatalogPolicy(c);
    expect(c).toMatchObject({ sourceCount: 3, unitCount: 3 });
    expect(Object.isFrozen(c)).toBe(true);
    expect(prepareResearchSourcePolicy(policy).corpusVersion).toBe(c.revision);
    expect(
      policy.sources.every(
        (s) => Object.keys(s.rights).length === 0 && s.grants.length === 0,
      ),
    ).toBe(true);
    const first = input.sources[0];
    expect(policy.sources[0].evidence_versions).toEqual([
      sha(
        JSON.stringify([
          "magickli-research-source-snapshot-v1",
          first.source_id,
          first.source_version,
          first.pdf_pages,
          parseResearchBook(first.book),
          first.units,
        ]),
      ),
    ]);
    input.sources.reverse();
    expect(compileResearchCatalog(input)).toEqual(c);
    policy.sources[0].rights.generation = true;
    expect(prepareResearchSourcePolicy(policy).corpusVersion).toBe(c.revision);
    expect(ungrantedResearchCatalogPolicy(c).sources[0].rights).toEqual({});
  });
  const mutations: [string, (p: ResearchCatalogInput) => void][] = [
    [
      "source revision",
      (p) => {
        p.sources[0].source_version = sha("changed");
      },
    ],
    [
      "metadata",
      (p) => {
        Object.assign(p.sources[0].book as object, { edition: "Changed" });
      },
    ],
    [
      "text revision",
      (p) => {
        p.sources[0].units[0].text_sha256 = sha("changed");
      },
    ],
    [
      "page",
      (p) => {
        p.sources[0].units[0].page_start = 2;
      },
    ],
    [
      "extraction",
      (p) => {
        p.sources[0].units[0].extraction = "unverified_ocr";
      },
    ],
    [
      "roster",
      (p) => {
        p.sources.pop();
      },
    ],
  ];
  for (const [name, mutate] of mutations)
    it(`binds ${name} without a circular corpus input`, () => {
      const p = catalogInput(),
        before = compileResearchCatalog(p);
      mutate(p);
      expect(compileResearchCatalog(p).revision).not.toBe(before.revision);
    });
  for (const [name, mutate] of [
    [
      "duplicate source",
      (p: ResearchCatalogInput) =>
        p.sources.push(structuredClone(p.sources[0])),
    ],
    [
      "duplicate unit",
      (p: ResearchCatalogInput) => {
        p.sources[1].units[0].id = "unit1";
      },
    ],
    [
      "reversed page",
      (p: ResearchCatalogInput) => {
        p.sources[0].units[0].page_start = 3;
      },
    ],
    [
      "outside PDF",
      (p: ResearchCatalogInput) => {
        p.sources[0].units[0].page_end = 11;
      },
    ],
    [
      "bad metadata",
      (p: ResearchCatalogInput) => {
        Object.assign(p.sources[0].book as object, { author_email: "private" });
      },
    ],
    [
      "unknown resource",
      (p: ResearchCatalogInput) => {
        Object.assign(p.sources[0], { path: "/private/source.pdf" });
      },
    ],
    [
      "source newline",
      (p: ResearchCatalogInput) => {
        p.sources[0].source_id += "\n";
      },
    ],
    [
      "unit newline",
      (p: ResearchCatalogInput) => {
        p.sources[0].units[0].id += "\n";
      },
    ],
    [
      "too many units",
      (p: ResearchCatalogInput) => {
        p.sources.forEach((s, i) => {
          s.units = Array.from({ length: 25001 }, (_, j) => ({
            ...s.units[0],
            id: `unit${i}_${j}`,
          }));
        });
      },
    ],
  ] as const)
    it(`rejects ${name} with source-free diagnostics`, () => {
      const p = catalogInput();
      mutate(p);
      expect(() => compileResearchCatalog(p)).toThrow(
        RESEARCH_PROVENANCE_ERROR,
      );
    });
  it("owns all input and rejects forged catalog handles", () => {
    const input = catalogInput(),
      c = compileResearchCatalog(input);
    input.sources[0].units[0].text_sha256 = sha("changed");
    expect(() => prepareResearchEvidence(c, evidenceInput())).not.toThrow();
    expect(() => ungrantedResearchCatalogPolicy({ ...c })).toThrow(
      RESEARCH_PROVENANCE_ERROR,
    );
  });
});

describe("prepared processing influences", () => {
  it("owns verified text and retains every inspected uncited source", () => {
    const input = evidenceInput(),
      { p } = setup(input),
      before = inspectPreparedResearchEvidence(p);
    expect(before.question).toBe("Synthetic original question?");
    expect(before.outcome).toBe("ready");
    expect(before.inventory?.source_count).toBe(3);
    before.inventory!.books[0].book.title = "Changed inventory";
    expect(
      inspectPreparedResearchEvidence(p).inventory!.books[0].book.title,
    ).toBe("Synthetic book 1");
    input.question = "Changed after preparation";
    expect(inspectPreparedResearchEvidence(p).question).toBe(
      "Synthetic original question?",
    );
    expect(before.context.bindings.map((b) => b.source_id)).toEqual([
      "source1",
      "source2",
      "source3",
    ]);
    expect(before.context.visible_reference_ids).toEqual(["ref1", "ref2"]);
    expect(before.passages[1].extraction).toBe("unverified_ocr");
    input.selected[0].text = "changed";
    before.passages[0].book.title = "changed";
    before.context.bindings.pop();
    expect(inspectPreparedResearchEvidence(p).passages[0].text).toBe(
      "Synthetic passage 1",
    );
    expect(inspectPreparedResearchEvidence(p).context.bindings).toHaveLength(3);
  });
  for (const [name, mutate] of [
    [
      "question",
      (p: ResearchEvidenceInput) => {
        p.question = "Changed question";
      },
    ],
    [
      "owner",
      (p: ResearchEvidenceInput) => {
        p.subject.user_id = OTHER_ANSWER_ID;
      },
    ],
    [
      "session",
      (p: ResearchEvidenceInput) => {
        p.subject.session_id = ANSWER_ID;
      },
    ],
    [
      "deadline",
      (p: ResearchEvidenceInput) => {
        p.expires_at_ms++;
      },
    ],
    [
      "selected order",
      (p: ResearchEvidenceInput) => {
        p.selected.reverse();
      },
    ],
    [
      "uncited pool",
      (p: ResearchEvidenceInput) => {
        p.inspected_source_ids.pop();
      },
    ],
  ] as const)
    it(`binds ${name}`, () => {
      const input = evidenceInput(),
        { c, p } = setup();
      mutate(input);
      expect(prepareResearchEvidence(c, input).revision).not.toBe(p.revision);
    });
  for (const [name, mutate] of [
    [
      "changed text",
      (p: ResearchEvidenceInput) => {
        p.selected[0].text += "changed";
      },
    ],
    [
      "uninspected selection",
      (p: ResearchEvidenceInput) => {
        p.inspected_source_ids = ["source1"];
      },
    ],
    [
      "unknown inspected source",
      (p: ResearchEvidenceInput) => {
        p.inspected_source_ids.push("unknown");
      },
    ],
    [
      "duplicate inspected source",
      (p: ResearchEvidenceInput) => {
        p.inspected_source_ids.push("source1");
      },
    ],
    [
      "duplicate selection",
      (p: ResearchEvidenceInput) => {
        p.selected.push(p.selected[0]);
      },
    ],
    [
      "unknown unit",
      (p: ResearchEvidenceInput) => {
        p.selected[0].unit_id = "unknown";
      },
    ],
    [
      "blank question",
      (p: ResearchEvidenceInput) => {
        p.question = " \n";
      },
    ],
    [
      "anonymous",
      (p: ResearchEvidenceInput) => {
        Object.assign(p.subject, { kind: "anonymous" });
      },
    ],
    [
      "untracked history",
      (p: ResearchEvidenceInput) => {
        Object.assign(p, {
          history: [{ role: "assistant", content: "private" }],
        });
      },
    ],
    [
      "no-evidence with selection",
      (p: ResearchEvidenceInput) => {
        p.outcome = "no_evidence";
      },
    ],
    [
      "unresolved source with selection",
      (p: ResearchEvidenceInput) => {
        p.outcome = "needs_source_clarification";
      },
    ],
  ] as const)
    it(`rejects ${name}`, () => {
      const input = evidenceInput(),
        { c } = setup();
      mutate(input);
      expect(() => prepareResearchEvidence(c, input)).toThrow(
        RESEARCH_PROVENANCE_ERROR,
      );
    });
  it("rejects lossy UTF-8 despite a matching replacement-character digest", () => {
    const input = catalogInput();
    input.sources[0].units[0].text_sha256 = sha("\uFFFD");
    const c = compileResearchCatalog(input);
    const e = evidenceInput();
    e.selected = [{ unit_id: "unit1", text: "\uD800" }];
    expect(() => prepareResearchEvidence(c, e)).toThrow(
      RESEARCH_PROVENANCE_ERROR,
    );
  });
  it("keeps distinct passages from one source but deduplicates its visible binding", () => {
    const input = catalogInput();
    input.sources[0].units.push({ ...input.sources[0].units[0], id: "unit1b" });
    const c = compileResearchCatalog(input);
    const e = evidenceInput();
    e.selected[1] = { unit_id: "unit1b", text: e.selected[0].text };
    expect(
      inspectPreparedResearchEvidence(prepareResearchEvidence(c, e)).context
        .visible_reference_ids,
    ).toEqual(["ref1"]);
  });
});

describe("source-projected answers and history candidates", () => {
  it("projects only used citations from the registry while preserving all processing influences privately", () => {
    const { p } = setup(),
      a = projectResearchAnswer(p, ANSWER_ID, draft()),
      out = inspectBoundResearchAnswer(a);
    expect(out.payload.citations).toHaveLength(1);
    expect(out.payload.citations[0]).toMatchObject({
      id: "passage1",
      book_handle: "book1",
      physical_pdf_page_start: 1,
      physical_pdf_page_end: 2,
    });
    expect(out.context.bindings).toHaveLength(3);
    expect(out.payload).not.toHaveProperty("context");
    out.payload.statements[0].text = "changed";
    out.context.bindings.pop();
    expect(inspectBoundResearchAnswer(a).payload.statements[0].text).toBe(
      "Synthetic answer",
    );
    const h = researchAnswerHistoryCandidate(a)!;
    expect(h.question).toBe("Synthetic original question?");
    expect(h.text).toContain(
      "Model-reported status: partial; semantic review: unreviewed",
    );
    expect(h.text).toContain('"kind":"limitation","basis":"context_scope"');
    expect(h.context.bindings).toHaveLength(3);
    expect(h.answer_revision).toBe(a.revision);
    expect(h.text).toContain("Synthetic book");
    expect(h.text).toContain("Bibliography is metadata, not passage evidence");
    expect(h.text).toContain(ANSWER_ID);
    expect(h.text).not.toContain("source_version");
    h.context.bindings.pop();
    expect(researchAnswerHistoryCandidate(a)!.context.bindings).toHaveLength(3);
  });
  it("projects inventory count/list facts and checks all roster influences even for unprinted books", () => {
    const { p } = setup(),
      out = inspectBoundResearchAnswer(
        projectResearchAnswer(p, ANSWER_ID, inventoryDraft()),
      );
    expect(out.payload.statements[0].text).toContain("3 PDF artifacts");
    expect(out.payload.statements[1].text).toContain("Synthetic book 2");
    expect(out.payload.citations[0]).toMatchObject({
      kind: "prepared_inventory",
      source_count: 3,
      books: [{ handle: "book2" }],
    });
    expect(out.context.bindings).toHaveLength(3);
    const e = evidenceInput();
    e.inspected_source_ids = ["source1", "source2"];
    const { p: narrow } = setup(e);
    expect(inspectPreparedResearchEvidence(narrow).inventory).toBeNull();
    expect(() =>
      projectResearchAnswer(narrow, ANSWER_ID, inventoryDraft()),
    ).toThrow(RESEARCH_PROVENANCE_ERROR);
  });
  it("retains joint citations, OCR and linked conflict qualifications", () => {
    const { p } = setup();
    const d = {
      status: "partial",
      statements: [
        {
          type: "passage_statement",
          id: "s1",
          kind: "answer",
          text: "First",
          evidence_ids: ["passage1", "passage2"],
        },
        {
          type: "passage_statement",
          id: "s2",
          kind: "observation",
          text: "Second",
          evidence_ids: ["passage2"],
        },
      ],
      issues: [
        { kind: "conflict", statement_ids: ["s1", "s2"], affects_answer: true },
      ],
    };
    const a = projectResearchAnswer(p, ANSWER_ID, d),
      out = inspectBoundResearchAnswer(a);
    expect(out.payload.citations).toHaveLength(2);
    expect(out.payload.citations[1]).toHaveProperty(
      "extraction",
      "unverified_ocr",
    );
    const history = researchAnswerHistoryCandidate(a)!.text;
    expect(history).toContain(
      '"kind":"conflict","statement_ids":["s1","s2"],"affects_answer":true',
    );
    expect(history).toContain('"extraction":"unverified_ocr"');
    expect(history).toContain('"evidence_ids":["passage1","passage2"]');
    expect(history).toContain('"title_status":"locally_observed"');
  });
  for (const [name, mutate] of [
    [
      "invented metadata",
      (d: ReturnType<typeof draft>) =>
        Object.assign(d.statements[0], { book: { title: "invented" } }),
    ],
    [
      "invented pages",
      (d: ReturnType<typeof draft>) =>
        Object.assign(d.statements[0], { physical_pdf_page_start: 42 }),
    ],
    [
      "model inventory prose",
      (d: ReturnType<typeof draft>) => {
        Object.assign(d.statements[0], {
          type: "inventory_count",
          text: "Invented count",
        });
      },
    ],
    [
      "dangling passage",
      (d: ReturnType<typeof draft>) => {
        d.statements[0].evidence_ids = ["passage4"];
      },
    ],
    [
      "nonsequential IDs",
      (d: ReturnType<typeof draft>) => {
        d.statements[0].id = "s2";
      },
    ],
    [
      "supported insufficient limitation",
      (d: ReturnType<typeof draft>) => {
        d.status = "supported";
        d.statements[1].reason = "insufficient_selected_evidence";
      },
    ],
    [
      "unsupported source-intent match",
      (d: ReturnType<typeof draft>) =>
        Object.assign(d.statements[0], {
          type: "inventory_match",
          intent_index: 0,
        }),
    ],
  ] as const)
    it(`rejects ${name}`, () => {
      const { p } = setup(),
        d = draft();
      mutate(d);
      expect(() => projectResearchAnswer(p, ANSWER_ID, d)).toThrow(
        RESEARCH_PROVENANCE_ERROR,
      );
    });
  it("does not silently trim at history size capacity or block a valid answer's inspection", () => {
    const { p } = setup(),
      d = draft();
    d.statements[0].text = "x".repeat(8100);
    const a = projectResearchAnswer(p, ANSWER_ID, d);
    expect(researchAnswerHistoryCandidate(a)).toBeNull();
    expect(
      inspectBoundResearchAnswer(a).payload.statements[0].text,
    ).toHaveLength(8100);
  });
  it("requires prepared outcome identity, never interpreting a failed model draft as no evidence", () => {
    const { p } = setup();
    expect(() => projectResearchAnswer(p, ANSWER_ID, null)).toThrow(
      RESEARCH_PROVENANCE_ERROR,
    );
    for (const outcome of [
      "no_evidence",
      "needs_source_clarification",
      "comparison_incomplete",
    ] as const) {
      const e = evidenceInput();
      e.outcome = outcome;
      e.selected = [];
      const { p: prepared } = setup(e),
        a = projectResearchAnswer(prepared, ANSWER_ID, null);
      expect(inspectBoundResearchAnswer(a).payload.outcome).toBe(outcome);
      expect(researchAnswerHistoryCandidate(a)).toBeNull();
      expect(() => projectResearchAnswer(prepared, ANSWER_ID, draft())).toThrow(
        RESEARCH_PROVENANCE_ERROR,
      );
    }
    const e = evidenceInput();
    e.outcome = "needs_source_clarification";
    e.selected = [];
    e.inspected_source_ids = ["source1"];
    expect(() => setup(e)).toThrow(RESEARCH_PROVENANCE_ERROR);
  });
  it("permits an insufficient inventory answer without inventing support and rejects absent evidence", () => {
    const e = evidenceInput();
    e.selected = [];
    const { p } = setup(e);
    expect(() =>
      projectResearchAnswer(p, ANSWER_ID, inventoryDraft()),
    ).not.toThrow();
    const d = {
      status: "insufficient",
      statements: [{ type: "limitation", id: "s1", reason: "scope_limited" }],
      issues: [],
    };
    expect(() => projectResearchAnswer(p, ANSWER_ID, d)).not.toThrow();
    const narrow = evidenceInput();
    narrow.selected = [];
    narrow.inspected_source_ids = ["source1"];
    expect(() => projectResearchAnswer(setup(narrow).p, ANSWER_ID, d)).toThrow(
      RESEARCH_PROVENANCE_ERROR,
    );
  });
  it("rejects forged/recreated evidence and answer handles rather than admitting uncompleted history", () => {
    const { p } = setup(),
      a = projectResearchAnswer(p, ANSWER_ID, draft());
    for (const work of [
      () => inspectPreparedResearchEvidence({ ...p }),
      () => projectResearchAnswer({ ...p }, ANSWER_ID, draft()),
      () => inspectBoundResearchAnswer({ ...a }),
      () => researchAnswerHistoryCandidate({ ...a }),
    ])
      expect(work).toThrow(RESEARCH_PROVENANCE_ERROR);
  });
});

it("parses owned book metadata and bounds it independently without claiming citation authority", () => {
  const book = metadata(),
    copy = parseResearchBook(book);
  book.title = "Changed";
  expect(copy.title).toBe("Synthetic book");
  expect(() => parseResearchBook({ ...book, download_url: "private" })).toThrow(
    RESEARCH_ANSWER_ERROR,
  );
  const large = metadata();
  large.contributors = Array.from({ length: 64 }, () => ({
    name: "界".repeat(512),
    role: "author",
  }));
  large.notes = Array.from({ length: 32 }, () => "界".repeat(512));
  expect(() => parseResearchBook(large)).toThrow(RESEARCH_ANSWER_ERROR);
  Object.setPrototypeOf(
    large,
    Object.defineProperty({}, "toJSON", { value: () => ({}) }),
  );
  expect(() => parseResearchBook(large)).toThrow(RESEARCH_ANSWER_ERROR);
});

it("keeps uncited inspected-source revocation effective through the actual app policy gate", async () => {
  const { c, p } = setup(),
    answer = projectResearchAnswer(p, ANSWER_ID, draft());
  const context = inspectBoundResearchAnswer(answer).context,
    input = ungrantedResearchCatalogPolicy(c);
  for (const source of input.sources) {
    source.rights = {
      generation: true,
      answer: true,
      metadata: true,
      processor_profiles: ["synthetic_processor"],
    };
    source.grants = [
      {
        user_id: ANSWER_ID,
        capabilities: structuredClone(source.rights),
        valid_from_ms: null,
        valid_until_ms: null,
      },
    ];
  }
  const principal = {
    subject: context.subject,
    session_binding_sha256: "a".repeat(64),
    expires_at_ms: 20000,
  };
  const readers = (): ResearchSourceReaders => ({
    now: () => 100,
    readPrincipal: async () => structuredClone(principal),
    loadSnapshot: async (subject, requested) => {
      const prepared = prepareResearchSourcePolicy(input);
      const document = readResearchSourcePolicy(
        prepared.policyJson,
        prepared.policySha256,
        prepared.corpusVersion,
      );
      return researchPolicySnapshot(document, subject, requested, "1");
    },
    readFence: async () => ({
      principal: structuredClone(principal),
      authorization_version: "1",
    }),
  });
  await expect(
    requireResearchSourceAccess(
      context,
      { kind: "delivery" },
      readers(),
      new AbortController().signal,
    ),
  ).resolves.toBeUndefined();
  // source3 contributed to the candidate pool but has no selected/cited passage.
  input.sources[2].state = "revoked";
  await expect(
    requireResearchSourceAccess(
      context,
      { kind: "delivery" },
      readers(),
      new AbortController().signal,
    ),
  ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
});

it("rejects unknown/duplicate inventory handles without accepting model metadata", () => {
  const { p } = setup();
  for (const handles of [["book4"], ["book2", "book2"]]) {
    const d = inventoryDraft();
    d.statements[1].book_handles = handles;
    expect(() => projectResearchAnswer(p, ANSWER_ID, d)).toThrow(
      RESEARCH_PROVENANCE_ERROR,
    );
  }
});

it("rejects oversized model drafts before projecting or retaining their contents", () => {
  const { p } = setup();
  expect(() =>
    projectResearchAnswer(p, ANSWER_ID, { padding: "private".repeat(20000) }),
  ).toThrow(RESEARCH_PROVENANCE_ERROR);
});

it("preserves all OCR, bibliographic uncertainty and missing-field qualifications in prior-answer scope", () => {
  const input = catalogInput(),
    book = input.sources[1].book as ReturnType<typeof metadata>;
  book.title_status = "catalog_fallback";
  book.candidate_fields = 3;
  book.notes = ["Synthetic edition attribution uncertain"];
  const c = compileResearchCatalog(input),
    e = evidenceInput();
  e.selected = [{ unit_id: "unit2", text: "Synthetic passage 2" }];
  const prepared = prepareResearchEvidence(c, e);
  const answer = projectResearchAnswer(prepared, ANSWER_ID, {
    status: "supported",
    statements: [
      {
        type: "passage_statement",
        id: "s1",
        kind: "answer",
        text: "Synthetic answer",
        evidence_ids: ["passage1"],
      },
    ],
    issues: [],
  });
  const h = researchAnswerHistoryCandidate(answer)!;
  const preserved = JSON.parse(h.text.split("\n\n").at(-1)!);
  expect(preserved).toEqual(inspectBoundResearchAnswer(answer).payload);
  for (const qualifier of [
    '"extraction":"unverified_ocr"',
    '"title_status":"catalog_fallback"',
    '"candidate_fields":3',
    "Synthetic edition attribution uncertain",
    '"physical_pdf_page_start":2',
  ])
    expect(h.text).toContain(qualifier);
  expect(h.text).toContain(
    "belongs only to that prior answer, not current retrieval",
  );
});

it("declines an oversized question-plus-qualified-answer pair without blocking answer inspection", () => {
  const e = evidenceInput();
  e.question = "界".repeat(4000);
  const { p } = setup(e),
    d = draft();
  d.statements[0].text = "x".repeat(3000);
  const answer = projectResearchAnswer(p, ANSWER_ID, d);
  expect(researchAnswerHistoryCandidate(answer)).toBeNull();
  expect(
    inspectBoundResearchAnswer(answer).payload.statements[0].text,
  ).toHaveLength(3000);
});

it("bounds the owned normalized draft even when a prototype toJSON hides input bytes", () => {
  const value = {
    status: "supported",
    statements: Array.from({ length: 20 }, (_, i) => ({
      type: "passage_statement",
      id: `s${i + 1}`,
      kind: "answer",
      text: "界".repeat(4000),
      evidence_ids: ["passage1"],
    })),
    issues: [],
  };
  Object.setPrototypeOf(
    value,
    Object.defineProperty({}, "toJSON", { value: () => ({}) }),
  );
  expect(() => parseResearchAnswerDraft(value)).toThrow(
    RESEARCH_PROVENANCE_ERROR,
  );
});

it("intrinsic metadata views preserve the original corpus identity and full uncited influence set", () => {
  const input = catalogInput(),
    catalog = compileResearchCatalog(input),
    before = JSON.stringify(ungrantedResearchCatalogPolicy(catalog)),
    revision = catalog.revision,
    view = prepareResearchCatalogView(catalog, evidenceInput().subject, 9000),
    first = inspectPreparedResearchCatalogView(view);
  expect(first.value.catalog_revision).toBe(revision);
  expect(first.context.bindings).toHaveLength(3);
  expect(first.context.visible_reference_ids).toEqual([]);
  expect(first.value.books).toHaveLength(3);
  expect(first.value.books[0].book).toEqual({
    ...metadata(),
    title: "Synthetic book 1",
  });
  first.value.books[0].book.title = "Mutated";
  first.context.bindings.pop();
  const next = inspectPreparedResearchCatalogView(view);
  expect(next.value.books[0].book.title).toBe("Synthetic book 1");
  expect(next.context.bindings).toHaveLength(3);
  expect(JSON.stringify(ungrantedResearchCatalogPolicy(catalog))).toBe(before);
  expect(catalog.revision).toBe(revision);
  expect(() =>
    prepareResearchCatalogView({ ...catalog }, evidenceInput().subject, 9000),
  ).toThrow(RESEARCH_PROVENANCE_ERROR);
  expect(() =>
    prepareResearchCatalogView(
      catalog,
      { ...evidenceInput().subject, user_id: "bad" },
      9000,
    ),
  ).toThrow(RESEARCH_PROVENANCE_ERROR);
  expect(() => inspectPreparedResearchCatalogView({ ...view })).toThrow(
    RESEARCH_PROVENANCE_ERROR,
  );
});
