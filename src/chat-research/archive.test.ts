import { expect, it } from "vitest";
import {
  parseResearchAnswerArchive,
  RESEARCH_ARCHIVE_BYTE_LIMIT,
  RESEARCH_ARCHIVE_ERROR,
} from "./archive";
import { archiveFixture } from "./archive.fixture";

it("owns exact original-window metadata and accepts an explicitly empty archive", () => {
  const original = archiveFixture(),
    value = parseResearchAnswerArchive(original);
  original.entries[0].question = "Caller changed";
  expect(value.entries[0].question).toBe("Saved synthetic question 1");
  expect(parseResearchAnswerArchive(archiveFixture(0)).entries).toEqual([]);
  expect(Object.keys(value.entries[0]).sort()).toEqual([
    "answer_id",
    "completed_at_ms",
    "mode",
    "model_assessment",
    "permit_id",
    "question",
  ]);
});
it.each([
  "extra",
  "resource",
  "duplicate-permit",
  "duplicate-answer",
  "ascending",
  "tie-order",
  "count",
  "empty-question",
  "long-question",
  "unicode",
  "id",
  "timestamp",
  "mode",
  "review",
  "scope",
])("rejects archive %s", (kind) => {
  const value = JSON.parse(JSON.stringify(archiveFixture(2)));
  if (kind === "extra") value.actor_id = "private";
  if (kind === "resource")
    value.entries[0].file_url = "https://private.example";
  if (kind === "duplicate-permit")
    value.entries[1].permit_id = value.entries[0].permit_id;
  if (kind === "duplicate-answer")
    value.entries[1].answer_id = value.entries[0].answer_id;
  if (kind === "ascending") value.entries.reverse();
  if (kind === "tie-order")
    value.entries[1].completed_at_ms = value.entries[0].completed_at_ms;
  if (kind === "count") value.entries = archiveFixture(11).entries;
  if (kind === "empty-question") value.entries[0].question = " ";
  if (kind === "long-question") value.entries[0].question = "x".repeat(4001);
  if (kind === "unicode") value.entries[0].question = "\ud800";
  if (kind === "id") value.entries[0].permit_id += "\n";
  if (kind === "timestamp") value.entries[0].completed_at_ms = NaN;
  if (kind === "mode") value.entries[0].mode = "tools";
  if (kind === "review") value.semantic_review = "expert";
  if (kind === "scope") value.scope = "all_history";
  expect(() => parseResearchAnswerArchive(value)).toThrow(
    RESEARCH_ARCHIVE_ERROR,
  );
});
it("keeps all ten maximum escaped questions within the response cap without truncation", () => {
  const value = archiveFixture(10);
  for (const entry of value.entries) entry.question = "\0".repeat(4000);
  const result = parseResearchAnswerArchive(value);
  expect(
    new TextEncoder().encode(JSON.stringify(result)).byteLength,
  ).toBeLessThan(RESEARCH_ARCHIVE_BYTE_LIMIT);
  expect(result.entries[9].question).toHaveLength(4000);
});
it("bounds original bytes before walking unknown data", () => {
  expect(() =>
    parseResearchAnswerArchive({
      private: "x".repeat(RESEARCH_ARCHIVE_BYTE_LIMIT + 1),
    }),
  ).toThrow(RESEARCH_ARCHIVE_ERROR);
});
