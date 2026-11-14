/** Exact typed SDK encoding only. This pure projection does not authenticate, prove completion or grant delivery/history. */
import "server-only";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import {
  parseResearchAnswer,
  RESEARCH_ANSWER_ERROR,
  type ResearchAnswer,
} from "./answer";
import {
  RESEARCH_ANSWER_ID_HEADER,
  type ResearchMessage,
} from "./answerStream";
/** Owned validated DTO only; callers must finish current access/completion/retention checks before returning this response. */
export function createResearchAnswerResponse(answer: ResearchAnswer): Response {
  const owned = parseResearchAnswer(answer);
  return createUIMessageStreamResponse({
    headers: {
      "cache-control": "private, no-store, max-age=0",
      vary: "Cookie",
      "x-content-type-options": "nosniff",
      [RESEARCH_ANSWER_ID_HEADER]: owned.answer_id,
    },
    stream: createUIMessageStream<ResearchMessage>({
      execute: ({ writer }) => {
        writer.write({ type: "start", messageId: owned.answer_id });
        writer.write({
          type: "data-research-answer-v1",
          id: owned.answer_id,
          data: owned,
        });
        writer.write({ type: "finish", finishReason: "stop" });
      },
      onError: () => RESEARCH_ANSWER_ERROR,
    }),
  });
}
