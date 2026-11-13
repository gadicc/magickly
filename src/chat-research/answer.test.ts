import { describe, expect, it } from "vitest";
import {
  noResearchEvidenceAnswer,
  parseResearchAnswer,
  RESEARCH_ANSWER_BYTE_LIMIT,
  RESEARCH_ANSWER_ERROR,
  RESEARCH_QUERY_OUTCOMES,
  type ResearchAnswer,
  researchQueryOutcomeAnswer,
  validResearchAnswerId,
} from "./answer";
import { ANSWER_ID, answerFixture } from "./answer.fixture";
import { validIsbn } from "./answerIsbn";

const passage = (p: ResearchAnswer) =>
  p.citations.find((c) => c.kind === "pdf_passage")!;
const inventory = (p: ResearchAnswer) =>
  p.citations.find((c) => c.kind === "prepared_inventory")!;

describe("private app answer contract", () => {
  it("retains qualified statements, inventory scope, checked metadata and physical PDF pages in an owned projection", () => {
    const raw = answerFixture(),
      answer = parseResearchAnswer(raw);
    expect(answer).toEqual(raw);
    raw.statements[0].text = "Changed";
    passage(raw).book.contributors[0].name = "Changed";
    expect(answer.statements[0].text).toBe("Synthetic answer.");
    expect(passage(answer).book.contributors[0].name).toBe("Synthetic Author");
    expect(answer.validation).toBe("structural-only");
    expect(answer.semantic_review).toBe("unreviewed");
    expect(inventory(answer).whole_library_coverage).toBe("not_established");
  });
  const mutations: [string, (p: ResearchAnswer) => unknown][] = [
    ["foreign contract", (p) => Object.assign(p, { contract: "other" })],
    [
      "model server outcome",
      (p) => {
        p.outcome = "no_evidence";
      },
    ],
    [
      "whitespace answer",
      (p) => {
        p.statements[0].text = " \t\n";
      },
    ],
    [
      "whitespace limitation",
      (p) => {
        p.statements[2].text = " \t\n";
      },
    ],
    [
      "passage limitation",
      (p) => {
        p.statements[0].kind = "limitation";
      },
    ],
    ["legacy version", (p) => Object.assign(p, { schema_version: 3 })],
    [
      "expert approval",
      (p) => Object.assign(p, { semantic_review: "approved" }),
    ],
    [
      "source URL",
      (p) =>
        Object.assign(passage(p), { url: "https://synthetic.invalid/private" }),
    ],
    [
      "excerpt",
      (p) =>
        Object.assign(passage(p), { excerpt: "Synthetic private diagnostic" }),
    ],
    [
      "source hash",
      (p) => Object.assign(passage(p), { source_version: "a".repeat(64) }),
    ],
    ["authority", (p) => Object.assign(p, { authorized: true })],
    [
      "nested extra",
      (p) =>
        Object.assign(passage(p).book.contributors[0], {
          email: "synthetic@example.invalid",
        }),
    ],
    [
      "bad ISBN",
      (p) => {
        passage(p).book.isbns[0].value = "9780306406158";
      },
    ],
    [
      "untrimmed title",
      (p) => {
        passage(p).book.title = " Synthetic title";
      },
    ],
    [
      "invalid UUID",
      (p) => {
        p.answer_id = `${ANSWER_ID}\n`;
      },
    ],
    [
      "newline statement",
      (p) => {
        p.statements[0].id = "s1\n";
      },
    ],
    [
      "newline evidence",
      (p) => {
        p.statements[0].evidence_ids = ["passage1\n"];
      },
    ],
    [
      "newline handle",
      (p) => {
        passage(p).book_handle = "book1\n";
      },
    ],
    [
      "newline citation",
      (p) => {
        passage(p).id = "passage1\n";
      },
    ],
    [
      "duplicate statement",
      (p) => {
        p.statements[1].id = "s1";
      },
    ],
    [
      "duplicate citation",
      (p) => p.citations.push(structuredClone(p.citations[0])),
    ],
    [
      "duplicate reference",
      (p) => p.statements[0].evidence_ids.push("passage1"),
    ],
    [
      "dangling evidence",
      (p) => {
        p.statements[0].evidence_ids = ["passage4"];
      },
    ],
    [
      "uncited citation",
      (p) => {
        p.statements[0].evidence_ids = [];
        p.statements[0].kind = "limitation";
        p.statements[0].basis = "context_scope";
      },
    ],
    [
      "conflicting metadata",
      (p) => {
        inventory(p).books[0].book.edition = "Other edition";
      },
    ],
    [
      "reversed pages",
      (p) => {
        passage(p).physical_pdf_page_end = 1;
      },
    ],
    [
      "fractional page",
      (p) => {
        passage(p).physical_pdf_page_start = 1.2;
      },
    ],
    [
      "unknown page",
      (p) => Object.assign(passage(p), { physical_pdf_page_start: null }),
    ],
    [
      "duplicate inventory handle",
      (p) => inventory(p).books.push(structuredClone(inventory(p).books[0])),
    ],
    [
      "inventory beyond count",
      (p) => {
        inventory(p).source_count = 1;
        inventory(p).books.push({
          ...structuredClone(inventory(p).books[0]),
          handle: "book2",
        });
      },
    ],
    [
      "duplicate book reference",
      (p) => p.statements[1].book_handles.push("book1"),
    ],
    [
      "missing inventory book",
      (p) => {
        p.statements[1].book_handles = ["book2"];
      },
    ],
    [
      "context with evidence",
      (p) => {
        p.statements[0].basis = "context_scope";
      },
    ],
    [
      "context answer",
      (p) => {
        p.statements[2].kind = "answer";
      },
    ],
    [
      "passage without evidence",
      (p) => {
        p.statements[0].evidence_ids = [];
      },
    ],
    [
      "passage using inventory",
      (p) => {
        p.statements[0].evidence_ids = ["inventory1"];
      },
    ],
    [
      "passage with book handle",
      (p) => {
        p.statements[0].book_handles = ["book1"];
      },
    ],
    [
      "inventory limitation",
      (p) => {
        p.statements[1].kind = "limitation";
      },
    ],
    [
      "inventory using passage",
      (p) => {
        p.statements[1].evidence_ids = ["passage1"];
      },
    ],
    [
      "inventory missing",
      (p) => {
        p.citations = p.citations.filter(
          (c) => c.kind !== "prepared_inventory",
        );
      },
    ],
    ["duplicate issue", (p) => p.issues.push(structuredClone(p.issues[0]))],
    ["duplicate issue link", (p) => p.issues[0].statement_ids.push("s1")],
    [
      "dangling issue",
      (p) => {
        p.issues[0].statement_ids = ["s20"];
      },
    ],
    [
      "supported unresolved issue",
      (p) => {
        p.status = "supported";
      },
    ],
    [
      "insufficient with answer",
      (p) => {
        p.status = "insufficient";
      },
    ],
    [
      "oversized statement",
      (p) => {
        p.statements[0].text = "a".repeat(16001);
      },
    ],
    [
      "nonfinite metadata",
      (p) => {
        passage(p).book.candidate_fields = Infinity;
      },
    ],
  ];
  for (const [name, mutate] of mutations)
    it(`rejects ${name} with no private diagnostics`, () => {
      const p = answerFixture();
      mutate(p);
      expect(() => parseResearchAnswer(p)).toThrow(
        /^Private research answer unavailable$/,
      );
    });
  it("rejects unqualified partial status, scope conflicts and reordered duplicate issues", () => {
    const p = answerFixture();
    p.statements = p.statements.filter((s) => s.kind !== "limitation");
    p.issues = [];
    expect(() => parseResearchAnswer(p)).toThrow(RESEARCH_ANSWER_ERROR);
    const q = answerFixture();
    q.issues = [
      { kind: "conflict", statement_ids: ["s3"], affects_answer: true },
    ];
    expect(() => parseResearchAnswer(q)).toThrow(RESEARCH_ANSWER_ERROR);
    q.issues[0].statement_ids = ["s1", "s3"];
    expect(() => parseResearchAnswer(q)).toThrow(RESEARCH_ANSWER_ERROR);
    const r = answerFixture();
    r.issues.push({
      ...r.issues[0],
      statement_ids: [...r.issues[0].statement_ids].reverse(),
      affects_answer: false,
    });
    expect(() => parseResearchAnswer(r)).toThrow(RESEARCH_ANSWER_ERROR);
  });
  it("supports structurally qualified partial status and passage-linked conflict graphs", () => {
    const p = answerFixture();
    p.statements[1] = { ...p.statements[0], id: "s2", kind: "observation" };
    p.statements = p.statements.slice(0, 2);
    p.citations = [passage(p)];
    p.issues = [
      { kind: "conflict", statement_ids: ["s1", "s2"], affects_answer: true },
    ];
    expect(parseResearchAnswer(p)).toEqual(p);
    p.status = "insufficient";
    p.statements[0].kind = "observation";
    expect(parseResearchAnswer(p)).toEqual(p);
  });
  it("supports joint passage references, partial observations, OCR qualifications and an issue-free supported answer", () => {
    const p = answerFixture();
    p.citations.push({
      ...structuredClone(passage(p)),
      id: "passage2",
      book_handle: "book2",
      extraction: "unverified_ocr",
    });
    p.statements[0].evidence_ids.push("passage2");
    p.statements[0].kind = "observation";
    expect(parseResearchAnswer(p)).toEqual(p);
    p.statements[0].kind = "answer";
    p.status = "supported";
    p.issues[0].affects_answer = false;
    expect(parseResearchAnswer(p).status).toBe("supported");
  });
  it("allows insufficient model observations without classifying them as answers", () => {
    const p = answerFixture();
    p.statements[0].kind = "observation";
    p.statements.splice(1, 1);
    p.citations = p.citations.filter((c) => c.kind !== "prepared_inventory");
    p.status = "insufficient";
    expect(parseResearchAnswer(p).origin).toBe("model");
    p.status = "partial";
    expect(() => parseResearchAnswer(p)).toThrow(RESEARCH_ANSWER_ERROR);
  });
  it("bounds actual UTF-8 bytes even with an inherited toJSON hiding the input", () => {
    const p = answerFixture();
    p.statements = Array.from({ length: 20 }, (_, i) => ({
      ...p.statements[0],
      id: `s${i + 1}`,
      text: "界".repeat(4000),
    }));
    p.citations = [passage(p)];
    p.issues = [];
    Object.setPrototypeOf(
      p,
      Object.defineProperty({}, "toJSON", { value: () => ({}) }),
    );
    expect(JSON.stringify(p)).toBe("{}");
    expect(() => parseResearchAnswer(p)).toThrow(RESEARCH_ANSWER_ERROR);
    Object.setPrototypeOf(p, Object.prototype);
    expect(
      new TextEncoder().encode(JSON.stringify(p)).byteLength,
    ).toBeGreaterThan(RESEARCH_ANSWER_BYTE_LIMIT);
    expect(() => parseResearchAnswer(p)).toThrow(RESEARCH_ANSWER_ERROR);
  });
  it("redacts malformed, cyclic, throwing and absent input", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    for (const p of [
      null,
      undefined,
      12,
      "private",
      circular,
      {
        toJSON() {
          throw Error("private");
        },
      },
    ])
      expect(() => parseResearchAnswer(p)).toThrow(RESEARCH_ANSWER_ERROR);
  });
  it("keeps server outcome sentences immutable at runtime", () => {
    const original = RESEARCH_QUERY_OUTCOMES.no_evidence;
    expect(Object.isFrozen(RESEARCH_QUERY_OUTCOMES)).toBe(true);
    expect(
      Reflect.set(RESEARCH_QUERY_OUTCOMES, "no_evidence", "Invented assertion"),
    ).toBe(false);
    expect(noResearchEvidenceAnswer(ANSWER_ID).statements[0].text).toBe(
      original,
    );
  });
  it("preserves distinct source-clarification and comparison outcomes without claiming library absence", () => {
    for (const outcome of [
      "no_evidence",
      "needs_source_clarification",
      "comparison_incomplete",
    ] as const) {
      const p = researchQueryOutcomeAnswer(ANSWER_ID, outcome);
      expect(p.outcome).toBe(outcome);
      expect(p.statements[0].text).toBe(RESEARCH_QUERY_OUTCOMES[outcome]);
      const invalid = { ...p, outcome: null };
      expect(() => parseResearchAnswer(invalid)).toThrow(RESEARCH_ANSWER_ERROR);
    }
  });
  it("server outcomes use one exact source-free statement and cannot invent model assertions", () => {
    const p = noResearchEvidenceAnswer(ANSWER_ID);
    expect(p.origin).toBe("server_query_outcome");
    expect(p.citations).toEqual([]);
    for (const mutate of [
      (a: ResearchAnswer) => {
        a.statements[0].text = "Invented assertion";
      },
      (a: ResearchAnswer) => {
        a.issues = [
          {
            kind: "missing_context",
            statement_ids: ["s1"],
            affects_answer: true,
          },
        ];
      },
      (a: ResearchAnswer) => {
        a.statements.push({ ...a.statements[0], id: "s2" });
      },
      (a: ResearchAnswer) => {
        a.status = "partial";
      },
    ]) {
      const a = structuredClone(p);
      mutate(a);
      expect(() => parseResearchAnswer(a)).toThrow(RESEARCH_ANSWER_ERROR);
    }
  });
});

it("validates exact UUIDv7 and ISBN syntax/checksums without asserting bibliographic identity", () => {
  expect(validResearchAnswerId(ANSWER_ID)).toBe(true);
  for (const id of [
    null,
    `${ANSWER_ID}\n`,
    ANSWER_ID.toUpperCase(),
    ANSWER_ID.replace("-7000-", "-4000-"),
  ])
    expect(validResearchAnswerId(id)).toBe(false);
  for (const isbn of [
    "0-306-40615-2",
    "0-8044-2957-X",
    "9780306406157",
    "9791090636071",
  ])
    expect(validIsbn(isbn), isbn).toBe(true);
  for (const isbn of [
    "9780306406158",
    "1234",
    "0306406152\n",
    "9780306406157\n",
    "030640615?",
    "978030640615X",
  ])
    expect(validIsbn(isbn), isbn).toBe(false);
});
