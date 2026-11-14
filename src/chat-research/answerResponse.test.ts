import { afterEach, expect, it, vi } from "vitest";
import { RESEARCH_ANSWER_ERROR } from "./answer";
import { ANSWER_ID, answerFixture } from "./answer.fixture";
import { createResearchAnswerResponse } from "./answerResponse";
import { collectResearchAnswer } from "./answerStream";

const transport = vi.hoisted(() => ({ fail: false }));
vi.mock("server-only", () => ({}));
vi.mock("ai", async (original) => {
  const actual = await original<typeof import("ai")>();
  return {
    ...actual,
    createUIMessageStream: (
      options: Parameters<typeof actual.createUIMessageStream>[0],
    ) => {
      if (!transport.fail) return actual.createUIMessageStream(options);
      return actual.createUIMessageStream({
        ...options,
        execute: ({ writer }) =>
          options.execute({
            writer: {
              ...writer,
              write: (chunk) => {
                if (chunk.type === "start") writer.write(chunk);
                else throw Error("Synthetic private serializer failure");
              },
            },
          }),
      });
    },
  };
});
afterEach(() => {
  transport.fail = false;
});
it("encodes an owned DTO with the exact atomic SDK frames and private response headers", async () => {
  const input = answerFixture(),
    response = createResearchAnswerResponse(input);
  input.statements[0].text = "Changed after construction";
  expect(response.headers.get("x-magickli-research-answer-id")).toBe(ANSWER_ID);
  const answer = await collectResearchAnswer(
    response,
    ANSWER_ID,
    new AbortController().signal,
  );
  expect(answer.statements[0].text).toBe("Synthetic answer.");
  expect(response.headers.get("cache-control")).toBe(
    "private, no-store, max-age=0",
  );
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});
it("redacts an installed SDK writer failure and cannot turn its partial stream into an answer", async () => {
  transport.fail = true;
  const response = createResearchAnswerResponse(answerFixture()),
    raw = await response.clone().text();
  expect(raw).toContain(RESEARCH_ANSWER_ERROR);
  expect(raw).not.toContain("Synthetic private serializer failure");
  await expect(
    collectResearchAnswer(response, ANSWER_ID, new AbortController().signal),
  ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
});
it("does not serialize malformed answer data as a completed frame", () => {
  expect(() =>
    createResearchAnswerResponse({ ...answerFixture(), answer_id: "invalid" }),
  ).toThrow(RESEARCH_ANSWER_ERROR);
});
