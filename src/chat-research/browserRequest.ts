/** One-shot same-origin transport. No background calls, retries, storage or legacy protocol fallback. */
import {
  RESEARCH_ANSWER_ERROR,
  type ResearchAnswer,
  validResearchAnswerId,
} from "./answer";
import {
  collectResearchAnswer,
  RESEARCH_ANSWER_ID_HEADER,
} from "./answerStream";
import { RESEARCH_API_PATH, RESEARCH_READ_API_PATH } from "./paths";
import { parseResearchQuestion } from "./request";

export { RESEARCH_API_PATH } from "./paths";
/** Includes response headers and the existing independently bounded atomic stream read. Server settlement remains independent. */
export const RESEARCH_BROWSER_REQUEST_TIMEOUT_MS = 240_000;
function cancel(response: Response) {
  try {
    if (response.body && !response.body.locked)
      void response.body.cancel().catch(() => {});
  } catch {}
}
/** Dispatch exactly once; caller owns session/visibility checks before committing the returned answer to the DOM. */
export async function requestResearchAnswer(
  input: unknown,
  signal: AbortSignal,
  requestFetch: typeof fetch = fetch,
): Promise<ResearchAnswer> {
  return requestReply(
    {
      path: RESEARCH_API_PATH,
      timeoutMs: RESEARCH_BROWSER_REQUEST_TIMEOUT_MS,
      serialize: () => JSON.stringify(parseResearchQuestion(input)),
    },
    signal,
    requestFetch,
  );
}
/** Reopen exactly one completed record. Correlation IDs never replace fresh owner/source checks on the server. */
export async function requestRetainedResearchAnswer(
  entry: { readonly permit_id: string; readonly answer_id: string },
  signal: AbortSignal,
  requestFetch: typeof fetch = fetch,
): Promise<ResearchAnswer> {
  const originalEnd = performance.now() + 15000;
  let permitId: string, answerId: string;
  try {
    signal.throwIfAborted();
    permitId = entry.permit_id;
    answerId = entry.answer_id;
  } catch {
    throw Error(RESEARCH_ANSWER_ERROR);
  }
  return requestReply(
    {
      path: RESEARCH_READ_API_PATH,
      timeoutMs: 15000,
      originalEnd,
      expectedAnswerId: answerId,
      serialize: () => {
        if (
          !validResearchAnswerId(permitId) ||
          !validResearchAnswerId(answerId)
        )
          throw Error(RESEARCH_ANSWER_ERROR);
        return JSON.stringify({ permit_id: permitId });
      },
    },
    signal,
    requestFetch,
  );
}
async function requestReply(
  options: {
    path: typeof RESEARCH_API_PATH | typeof RESEARCH_READ_API_PATH;
    timeoutMs: number;
    originalEnd?: number;
    serialize: () => string;
    expectedAnswerId?: string;
  },
  signal: AbortSignal,
  requestFetch: typeof fetch,
): Promise<ResearchAnswer> {
  const end = Math.min(
      performance.now() + options.timeoutMs,
      options.originalEnd ?? Infinity,
    ),
    controller = new AbortController(),
    combined = AbortSignal.any([signal, controller.signal]);
  let reject!: (error: Error) => void, response: Response | undefined;
  const interrupted = new Promise<never>((_, r) => {
    reject = r;
  });
  void interrupted.catch(() => {});
  const stop = () => reject(Error(RESEARCH_ANSWER_ERROR));
  const timer = setTimeout(
    () => controller.abort(),
    Math.max(0, end - performance.now()),
  );
  combined.addEventListener("abort", stop, { once: true });
  const check = () => {
    if (combined.aborted || performance.now() >= end) throw Error();
  };
  try {
    check();
    const body = options.serialize();
    check();
    const pending = Promise.resolve()
      .then(() => {
        check();
        return requestFetch(options.path, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          headers: {
            "content-type": "application/json",
            accept: "text/event-stream",
          },
          body,
          signal: combined,
        });
      })
      .then((value) => {
        response = value;
        try {
          check();
        } catch {
          cancel(value);
          throw Error(RESEARCH_ANSWER_ERROR);
        }
        return value;
      });
    response = await Promise.race([pending, interrupted]);
    check();
    const answerId = response.headers.get(RESEARCH_ANSWER_ID_HEADER);
    if (
      response.redirected ||
      !validResearchAnswerId(answerId) ||
      (options.expectedAnswerId !== undefined &&
        answerId !== options.expectedAnswerId)
    )
      throw Error();
    const answer = await Promise.race([
      collectResearchAnswer(response, answerId, combined, end),
      interrupted,
    ]);
    check();
    return answer;
  } catch {
    if (response) cancel(response);
    throw Error(RESEARCH_ANSWER_ERROR);
  } finally {
    combined.removeEventListener("abort", stop);
    clearTimeout(timer);
    controller.abort();
  }
}
