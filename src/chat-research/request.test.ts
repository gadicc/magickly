import { expect, it } from "vitest";
import { ANSWER_ID, OTHER_ANSWER_ID } from "./answer.fixture";
import { parseResearchQuestion, RESEARCH_REQUEST_ERROR } from "./request";

it("copies the exact single-turn fields with an owned default list", () => {
  const input = {
    question: " A question ",
    mode: "comparison",
    source_book_handles: ["book32"],
    expected_catalog_revision: "a".repeat(64),
  };
  const result = parseResearchQuestion(input);
  input.source_book_handles[0] = "book1";
  expect(result).toEqual({
    question: " A question ",
    mode: "comparison",
    source_book_handles: ["book32"],
    expected_catalog_revision: "a".repeat(64),
  });
  expect(
    parseResearchQuestion({ question: "Q", mode: "passage" })
      .source_book_handles,
  ).toEqual([]);
});
it.each([
  null,
  {},
  { question: " ", mode: "passage" },
  { question: "x".repeat(4001), mode: "passage" },
  { question: "\ud800", mode: "passage" },
  { question: "Q", mode: "other" },
  { question: "Q", mode: "passage", history: [] },
  { question: "Q", mode: "passage", actor: "someone" },
  { question: "Q", mode: "passage", source_book_handles: ["book1", "book2"] },
  { question: "Q", mode: "inventory", source_book_handles: ["book1"] },
  {
    question: "Q",
    mode: "comparison",
    source_book_handles: ["book1", "book1"],
  },
  { question: "Q", mode: "comparison", source_book_handles: ["book0"] },
  { question: "Q", mode: "comparison", source_book_handles: ["book33"] },
  { question: "Q", mode: "comparison", source_book_handles: ["book1\n"] },
  {
    question: "Q",
    mode: "comparison",
    source_book_handles: ["book1", "book2", "book3"],
  },
])("rejects invalid input without echoing private details %#", (input) => {
  expect(() => parseResearchQuestion(input)).toThrow(RESEARCH_REQUEST_ERROR);
});

it.each([undefined, "a".repeat(63), "A".repeat(64), "a".repeat(64) + "\n"])(
  "requires an exact catalog revision for ordinal choices %s",
  (revision) => {
    expect(() =>
      parseResearchQuestion({
        question: "Q",
        mode: "passage",
        source_book_handles: ["book1"],
        expected_catalog_revision: revision,
      }),
    ).toThrow(RESEARCH_REQUEST_ERROR);
  },
);
it("does not accept an orphan catalog revision for a global query", () => {
  expect(() =>
    parseResearchQuestion({
      question: "Q",
      mode: "passage",
      expected_catalog_revision: "a".repeat(64),
    }),
  ).toThrow(RESEARCH_REQUEST_ERROR);
});

it("accepts only owned prior-record ID hints, never browser-provided conversation or policy", () => {
  const previous_answer = {
      permit_id: ANSWER_ID,
      expected_answer_id: OTHER_ANSWER_ID,
    },
    parsed = parseResearchQuestion({
      question: "Follow-up?",
      mode: "passage",
      previous_answer,
    });
  previous_answer.permit_id = OTHER_ANSWER_ID;
  expect(parsed.previous_answer).toEqual({
    permit_id: ANSWER_ID,
    expected_answer_id: OTHER_ANSWER_ID,
  });
});
it.each([
  null,
  {},
  [],
  { permit_id: ANSWER_ID },
  { permit_id: ANSWER_ID, expected_answer_id: "invalid" },
  { permit_id: ANSWER_ID + "\n", expected_answer_id: OTHER_ANSWER_ID },
  { permit_id: ANSWER_ID, expected_answer_id: OTHER_ANSWER_ID, history: [] },
  {
    permit_id: ANSWER_ID,
    expected_answer_id: OTHER_ANSWER_ID,
    window_id: ANSWER_ID,
  },
])(
  "rejects malformed or authority-bearing previous-answer hints %#",
  (previous_answer) => {
    expect(() =>
      parseResearchQuestion({
        question: "Follow-up?",
        mode: "passage",
        previous_answer,
      }),
    ).toThrow(RESEARCH_REQUEST_ERROR);
  },
);
