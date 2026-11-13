/** Atomic browser-safe HTTP consumer, pinned to the installed SDK serializer. */
import type { UIMessage } from "ai";
import {
  parseResearchAnswer,
  RESEARCH_ANSWER_ERROR,
  type ResearchAnswer,
  validResearchAnswerId,
} from "./answer";
export type ResearchMessage = UIMessage<
  never,
  { "research-answer-v1": ResearchAnswer }
>;
/** Correlation only, not ownership: validate this server header against every complete stream frame. */
export const RESEARCH_ANSWER_ID_HEADER = "x-magickli-research-answer-id";
export const RESEARCH_STREAM_TIMEOUT_MS = 30_000;
export const RESEARCH_STREAM_BYTE_LIMIT = 256 * 1024;
const keys = (value: Record<string, unknown>, expected: string[]) =>
  Object.keys(value).length === expected.length &&
  Object.keys(value).every((k) => expected.includes(k));
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error();
  return value as Record<string, unknown>;
};
/**
 * Consume the raw Response, never an already-parsed SDK chunk stream. The SDK's
 * general SSE parser may discard an unfinished tail; chunk EOF cannot prove raw
 * completion. Require exactly the app's three SDK JSON events, [DONE], and clean
 * physical EOF. No part becomes visible before complete validation. Caller must
 * still authorize delivery on the server and scrub rendered content on auth loss.
 * An inherited monotonic deadline only shortens this reader's own thirty-second bound.
 */
export async function collectResearchAnswer(
  response: Response,
  expectedAnswerId: string,
  signal: AbortSignal,
  inheritedDeadlineAt?: number,
): Promise<ResearchAnswer> {
  const started = performance.now(),
    deadline = Math.min(
      started + RESEARCH_STREAM_TIMEOUT_MS,
      inheritedDeadlineAt ?? Infinity,
    );
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let body: ReadableStream<Uint8Array> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectInterrupted!: (reason: Error) => void;
  const interrupted = new Promise<never>((_, reject) => {
    rejectInterrupted = reject;
  });
  const abort = () => rejectInterrupted(Error(RESEARCH_ANSWER_ERROR));
  void interrupted.catch(() => {});
  const check = () => {
    if (signal.aborted || performance.now() >= deadline) throw Error();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    body = response.body;
    if (
      inheritedDeadlineAt !== undefined &&
      !Number.isFinite(inheritedDeadlineAt)
    )
      throw Error();
    check();
    if (
      !validResearchAnswerId(expectedAnswerId) ||
      response.status !== 200 ||
      response.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "text/event-stream" ||
      response.headers.get("x-vercel-ai-ui-message-stream") !== "v1" ||
      !body
    )
      throw Error();
    check();
    reader = body.getReader();
    check();
    timer = setTimeout(abort, Math.max(0, deadline - performance.now()));
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    let text = "",
      bytes = 0;
    while (true) {
      check();
      const { done, value } = await Promise.race([reader.read(), interrupted]);
      check();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > RESEARCH_STREAM_BYTE_LIMIT) throw Error();
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const frames = text.split("\n\n");
    if (frames.length !== 5 || frames[3] !== "data: [DONE]" || frames[4] !== "")
      throw Error();
    const parsed = frames.slice(0, 3).map((frame) => {
      if (!frame.startsWith("data: ") || /[\r\n]/.test(frame)) throw Error();
      const json = frame.slice(6);
      const value: unknown = JSON.parse(json);
      if (JSON.stringify(value) !== json) throw Error();
      return object(value);
    });
    const [start, data, finish] = parsed;
    if (
      !keys(start, ["type", "messageId"]) ||
      start.type !== "start" ||
      start.messageId !== expectedAnswerId ||
      !keys(data, ["type", "id", "data"]) ||
      data.type !== "data-research-answer-v1" ||
      data.id !== expectedAnswerId ||
      !keys(finish, ["type", "finishReason"]) ||
      finish.type !== "finish" ||
      finish.finishReason !== "stop"
    )
      throw Error();
    const payload = parseResearchAnswer(data.data);
    if (payload.answer_id !== expectedAnswerId) throw Error();
    check();
    return payload;
  } catch {
    // Do not wait for a cancel implementation that may never settle.
    if (reader) void reader.cancel().catch(() => {});
    else if (body && !body.locked) void body.cancel().catch(() => {});
    throw Error(RESEARCH_ANSWER_ERROR);
  } finally {
    signal.removeEventListener("abort", abort);
    clearTimeout(timer);
    reader?.releaseLock();
  }
}
