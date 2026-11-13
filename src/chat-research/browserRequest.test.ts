import { afterEach, expect, it, vi } from "vitest";
import { RESEARCH_ANSWER_ERROR } from "./answer";
import { ANSWER_ID, answerFixture, OTHER_ANSWER_ID } from "./answer.fixture";
import { createResearchAnswerResponse } from "./answerResponse";
import {
  RESEARCH_API_PATH,
  RESEARCH_BROWSER_REQUEST_TIMEOUT_MS,
  requestResearchAnswer,
  requestRetainedResearchAnswer,
} from "./browserRequest";

vi.mock("server-only", () => ({}));
const input = () => ({ question: "Synthetic question", mode: "passage" });
const signal = () => new AbortController().signal;
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { resolve, promise };
};
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("dispatches exactly once with fixed same-origin settings and the actual installed typed serializer", async () => {
  const requestFetch = vi.fn<typeof fetch>(async () =>
    createResearchAnswerResponse(answerFixture()),
  );
  expect(await requestResearchAnswer(input(), signal(), requestFetch)).toEqual(
    answerFixture(),
  );
  expect(requestFetch).toHaveBeenCalledOnce();
  const [path, options] = requestFetch.mock.calls[0];
  expect(path).toBe(RESEARCH_API_PATH);
  expect(options).toMatchObject({
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
    },
  });
  expect(JSON.parse(options!.body as string)).toEqual({
    ...input(),
    source_book_handles: [],
  });
  expect(options!.signal!.aborted).toBe(true);
});
it("owns input before its first await", async () => {
  const given = {
      ...input(),
      source_book_handles: ["book1"],
      expected_catalog_revision: "a".repeat(64),
    },
    requestFetch = vi.fn<typeof fetch>(async () =>
      createResearchAnswerResponse(answerFixture()),
    );
  const pending = requestResearchAnswer(given, signal(), requestFetch);
  given.question = "Changed";
  given.source_book_handles[0] = "book2";
  await pending;
  expect(JSON.parse(requestFetch.mock.calls[0][1]!.body as string)).toEqual({
    ...input(),
    source_book_handles: ["book1"],
    expected_catalog_revision: "a".repeat(64),
  });
});
it.each(["absent", "invalid", "combined", "mismatch", "redirected", "status"])(
  "refuses %s without reading or displaying an error body",
  async (kind) => {
    const r = createResearchAnswerResponse(answerFixture());
    if (kind === "absent") r.headers.delete("x-magickli-research-answer-id");
    if (kind === "invalid")
      r.headers.set("x-magickli-research-answer-id", "private-token");
    if (kind === "combined")
      r.headers.append("x-magickli-research-answer-id", ANSWER_ID);
    if (kind === "mismatch")
      r.headers.set("x-magickli-research-answer-id", OTHER_ANSWER_ID);
    if (kind === "redirected")
      Object.defineProperty(r, "redirected", { value: true });
    if (kind === "status") Object.defineProperty(r, "status", { value: 503 });
    const fetcher = vi.fn<typeof fetch>(async () => r);
    await expect(
      requestResearchAnswer(input(), signal(), fetcher),
    ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
    expect(fetcher).toHaveBeenCalledOnce();
  },
);
it("does not read an unbounded error body and cancels it", async () => {
  const cancel = vi.fn(),
    r = new Response(new ReadableStream({ cancel }), { status: 503 });
  await expect(
    requestResearchAnswer(input(), signal(), async () => r),
  ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  expect(cancel).toHaveBeenCalledOnce();
});
it("does not dispatch invalid input or an already-aborted request", async () => {
  const fetcher = vi.fn<typeof fetch>(),
    controller = new AbortController();
  controller.abort();
  await expect(
    requestResearchAnswer(input(), controller.signal, fetcher),
  ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  await expect(
    requestResearchAnswer({ ...input(), history: [] }, signal(), fetcher),
  ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  expect(fetcher).not.toHaveBeenCalled();
});
it("redacts both synchronous sender errors and asynchronous rejections without retry", async () => {
  for (const fetcher of [
    vi.fn<typeof fetch>(() => {
      throw Error("private key");
    }),
    vi.fn<typeof fetch>(async () => {
      throw Error("private passage");
    }),
  ]) {
    await expect(
      requestResearchAnswer(input(), signal(), fetcher),
    ).rejects.toThrow(/^Private research answer unavailable$/);
    expect(fetcher).toHaveBeenCalledOnce();
  }
});
it.each(["abort", "timeout"])(
  "bounds noncooperative header waiting and cancels its late response after %s",
  async (kind) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const gate = deferred<Response>(),
      controller = new AbortController(),
      fetcher = vi.fn<typeof fetch>(() => gate.promise);
    const pending = requestResearchAnswer(input(), controller.signal, fetcher);
    const failed = expect(pending).rejects.toThrow(RESEARCH_ANSWER_ERROR);
    await Promise.resolve();
    if (kind === "abort") controller.abort();
    else await vi.advanceTimersByTimeAsync(RESEARCH_BROWSER_REQUEST_TIMEOUT_MS);
    await failed;
    const cancel = vi.fn();
    gate.resolve(new Response(new ReadableStream({ cancel })));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
  },
);
it("rejects a timer-starved late fetch result even before a timer callback", async () => {
  const now = vi.spyOn(performance, "now").mockReturnValue(0),
    cancel = vi.fn();
  await expect(
    requestResearchAnswer(input(), signal(), async () => {
      now.mockReturnValue(RESEARCH_BROWSER_REQUEST_TIMEOUT_MS);
      return new Response(new ReadableStream({ cancel }));
    }),
  ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  expect(cancel).toHaveBeenCalledOnce();
});
it("cancels an unfinished raw stream without exposing complete-looking partial events", async () => {
  const raw = await createResearchAnswerResponse(answerFixture()).text(),
    cancel = vi.fn();
  const r = new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(raw));
      },
      cancel,
    }),
    {
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
        "x-magickli-research-answer-id": ANSWER_ID,
      },
    },
  );
  const controller = new AbortController(),
    pending = requestResearchAnswer(input(), controller.signal, async () => r);
  const failed = expect(pending).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  await new Promise((r) => setTimeout(r, 5));
  controller.abort();
  await failed;
  expect(cancel).toHaveBeenCalledOnce();
});

it("does not start a second raw read after the original deadline when the timer is starved", async () => {
  const now = vi.spyOn(performance, "now").mockReturnValue(0);
  let pulls = 0;
  const cancel = vi.fn();
  const fetcher: typeof fetch = async () => {
    now.mockReturnValue(RESEARCH_BROWSER_REQUEST_TIMEOUT_MS - 1000);
    return new Response(
      new ReadableStream<Uint8Array>(
        {
          pull(c) {
            pulls++;
            now.mockReturnValue(RESEARCH_BROWSER_REQUEST_TIMEOUT_MS + 1);
            c.enqueue(new TextEncoder().encode("data: partial"));
          },
          cancel,
        },
        { highWaterMark: 0 },
      ),
      {
        headers: {
          "content-type": "text/event-stream",
          "x-vercel-ai-ui-message-stream": "v1",
          "x-magickli-research-answer-id": ANSWER_ID,
        },
      },
    );
  };
  await expect(
    requestResearchAnswer(input(), signal(), fetcher),
  ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  expect(pulls).toBe(1);
  expect(cancel).toHaveBeenCalledOnce();
});

it.each(["synchronous", "rejected"])(
  "sanitizes a failing response-body cancellation: %s",
  async (kind) => {
    const cancel = vi.fn(() => {
      if (kind === "synchronous") throw Error("private cancel diagnostic");
      return Promise.reject(Error("private cancel diagnostic"));
    });
    const r = new Response(new ReadableStream({ cancel }), { status: 503 });
    await expect(
      requestResearchAnswer(input(), signal(), async () => r),
    ).rejects.toThrow(/^Private research answer unavailable$/);
    expect(cancel).toHaveBeenCalledOnce();
    await Promise.resolve();
  },
);
it("includes delayed header validation in its original deadline before body acquisition", async () => {
  const now = vi.spyOn(performance, "now").mockReturnValue(0),
    r = createResearchAnswerResponse(answerFixture());
  const get = r.headers.get.bind(r.headers);
  vi.spyOn(r.headers, "get").mockImplementation((name) => {
    now.mockReturnValue(RESEARCH_BROWSER_REQUEST_TIMEOUT_MS + 1);
    return get(name);
  });
  const acquire = vi.spyOn(r, "body", "get");
  await expect(
    requestResearchAnswer(input(), signal(), async () => r),
  ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  // The consumer never opens a reader; outer error cleanup still owns/cancels the body.
  expect(r.body!.locked).toBe(false);
  expect(acquire).toHaveBeenCalled();
});

it("reopens exactly one owned row ID at the fixed read endpoint and binds its expected answer ID", async () => {
  const entry = { permit_id: OTHER_ANSWER_ID, answer_id: ANSWER_ID },
    fetch = vi.fn<typeof globalThis.fetch>(async () =>
      createResearchAnswerResponse(answerFixture()),
    ),
    pending = requestRetainedResearchAnswer(entry, signal(), fetch);
  entry.permit_id = ANSWER_ID;
  entry.answer_id = OTHER_ANSWER_ID;
  expect((await pending).answer_id).toBe(ANSWER_ID);
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][0]).toBe("/chat/research/answers/read");
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({
    permit_id: OTHER_ANSWER_ID,
  });
});
it("rejects a different answer header before opening the retained stream", async () => {
  const response = createResearchAnswerResponse({
      ...answerFixture(),
      answer_id: OTHER_ANSWER_ID,
    }),
    read = vi.spyOn(response.body!, "getReader"),
    fetch = vi.fn<typeof globalThis.fetch>(async () => response);
  await expect(
    requestRetainedResearchAnswer(
      { permit_id: OTHER_ANSWER_ID, answer_id: ANSWER_ID },
      signal(),
      fetch,
    ),
  ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  expect(read).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledOnce();
});
it("rejects a retained body whose DTO disagrees with the correctly pinned header", async () => {
  const response = createResearchAnswerResponse({
    ...answerFixture(),
    answer_id: OTHER_ANSWER_ID,
  });
  response.headers.set("x-magickli-research-answer-id", ANSWER_ID);
  await expect(
    requestRetainedResearchAnswer(
      { permit_id: OTHER_ANSWER_ID, answer_id: ANSWER_ID },
      signal(),
      async () => response,
    ),
  ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
});
it.each(["permit", "answer", "getter"])(
  "rejects invalid saved-row %s before dispatch without diagnostics",
  async (kind) => {
    const entry = { permit_id: OTHER_ANSWER_ID, answer_id: ANSWER_ID };
    if (kind === "permit") entry.permit_id = "private invalid identifier";
    if (kind === "answer") entry.answer_id = "private invalid identifier";
    if (kind === "getter")
      Object.defineProperty(entry, "permit_id", {
        get: () => {
          throw Error("private getter diagnostic");
        },
      });
    const fetch = vi.fn();
    await expect(
      requestRetainedResearchAnswer(entry, signal(), fetch),
    ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("retained reopening uses the short read timeout rather than the paid generation timeout", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn<typeof globalThis.fetch>(
      () => new Promise<Response>(() => {}),
    ),
    pending = requestRetainedResearchAnswer(
      { permit_id: OTHER_ANSWER_ID, answer_id: ANSWER_ID },
      signal(),
      fetch,
    ),
    rejected = expect(pending).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  await vi.advanceTimersByTimeAsync(15000);
  await rejected;
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true);
});

it("counts retained-row ownership getters inside the original short read deadline", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const entry = {
      get permit_id() {
        now = 15001;
        return OTHER_ANSWER_ID;
      },
      answer_id: ANSWER_ID,
    },
    fetch = vi.fn();
  await expect(
    requestRetainedResearchAnswer(entry, signal(), fetch),
  ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  expect(fetch).not.toHaveBeenCalled();
});

it("sends explicit prior IDs through the same one-shot transport without raw history or implicit requests", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      createResearchAnswerResponse(answerFixture()),
    ),
    previous_answer = {
      permit_id: OTHER_ANSWER_ID,
      expected_answer_id: ANSWER_ID,
    };
  const reply = await requestResearchAnswer(
    { question: "A contextual question", mode: "passage", previous_answer },
    signal(),
    fetch,
  );
  expect(reply.answer_id).toBe(ANSWER_ID);
  expect(fetch).toHaveBeenCalledOnce();
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({
    question: "A contextual question",
    mode: "passage",
    source_book_handles: [],
    previous_answer,
  });
});
