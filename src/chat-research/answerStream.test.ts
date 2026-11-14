import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  DefaultChatTransport,
  type UIMessageChunk,
} from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { noResearchEvidenceAnswer, RESEARCH_ANSWER_ERROR } from "./answer";
import { ANSWER_ID, answerFixture, OTHER_ANSWER_ID } from "./answer.fixture";
import {
  collectResearchAnswer,
  RESEARCH_STREAM_BYTE_LIMIT,
  RESEARCH_STREAM_TIMEOUT_MS,
  type ResearchMessage,
} from "./answerStream";

const chunks = (data = answerFixture()): UIMessageChunk[] => [
  { type: "start", messageId: ANSWER_ID },
  { type: "data-research-answer-v1", id: ANSWER_ID, data },
  { type: "finish", finishReason: "stop" },
];
const encode = (value: string) => new TextEncoder().encode(value);
const raw = (items = chunks()) =>
  items.map((i) => `data: ${JSON.stringify(i)}\n\n`).join("") +
  "data: [DONE]\n\n";
const headers = {
  "content-type": "text/event-stream",
  "x-vercel-ai-ui-message-stream": "v1",
};
const response = (text = raw()) => new Response(text, { headers });
const signal = () => new AbortController().signal;
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("atomic raw research response", () => {
  it("accepts actual installed SDK serialization with no provider", async () => {
    const payload = answerFixture();
    const r = createUIMessageStreamResponse({
      stream: createUIMessageStream<ResearchMessage>({
        execute: ({ writer }) => {
          writer.write({ type: "start", messageId: ANSWER_ID });
          writer.write({
            type: "data-research-answer-v1",
            id: ANSWER_ID,
            data: payload,
          });
          writer.write({ type: "finish", finishReason: "stop" });
        },
        onError: () => RESEARCH_ANSWER_ERROR,
      }),
    });
    expect(await collectResearchAnswer(r, ANSWER_ID, signal())).toEqual(
      payload,
    );
  });
  const cases: [string, (c: UIMessageChunk[]) => unknown][] = [
    ["missing finish", (c) => c.pop()],
    ["missing data", (c) => c.splice(1, 1)],
    ["reordered", (c) => c.reverse()],
    ["duplicate data", (c) => c.splice(2, 0, c[1])],
    ["duplicate start", (c) => c.unshift(c[0])],
    ["duplicate finish", (c) => c.push(c[2])],
    [
      "late error",
      (c) => c.push({ type: "error", errorText: "private diagnostic" }),
    ],
    ["abort", (c) => c.splice(2, 1, { type: "abort" })],
    [
      "length finish",
      (c) => c.splice(2, 1, { type: "finish", finishReason: "length" }),
    ],
    ["missing reason", (c) => c.splice(2, 1, { type: "finish" })],
    [
      "wrong start ID",
      (c) => Object.assign(c[0], { messageId: OTHER_ANSWER_ID }),
    ],
    ["wrong part ID", (c) => Object.assign(c[1], { id: OTHER_ANSWER_ID })],
    [
      "wrong answer ID",
      (c) =>
        Object.assign(c[1], {
          data: { ...answerFixture(), answer_id: OTHER_ANSWER_ID },
        }),
    ],
    [
      "legacy event",
      (c) => Object.assign(c[1], { type: "data-grounded-answer" }),
    ],
    [
      "text delta",
      (c) =>
        c.splice(1, 0, { type: "text-delta", id: "private", delta: "private" }),
    ],
    ["transient", (c) => Object.assign(c[1], { transient: false })],
    [
      "start metadata",
      (c) => Object.assign(c[0], { messageMetadata: { token: "private" } }),
    ],
    [
      "finish metadata",
      (c) => Object.assign(c[2], { messageMetadata: { token: "private" } }),
    ],
    ["null payload", (c) => Object.assign(c[1], { data: null })],
    ["null event", (c) => c.splice(1, 1, null as unknown as UIMessageChunk)],
    ["array event", (c) => c.splice(1, 1, [] as unknown as UIMessageChunk)],
  ];
  for (const [name, mutate] of cases)
    it(`discards ${name} with generic diagnostics`, async () => {
      const c = chunks();
      mutate(c);
      await expect(
        collectResearchAnswer(response(raw(c)), ANSWER_ID, signal()),
      ).rejects.toThrow(/^Private research answer unavailable$/);
    });
  for (const [name, transform] of [
    [
      "truncated last JSON",
      (s: string) =>
        s.replace(
          "data: [DONE]\n\n",
          'data: {"type":"error","errorText":"private"',
        ),
    ],
    ["unfinished event after DONE", (s: string) => s + 'data: {"type":"error"'],
    ["missing DONE", (s: string) => s.replace("data: [DONE]\n\n", "")],
    ["unfinished DONE", (s: string) => s.slice(0, -1)],
    ["extra DONE", (s: string) => s + "data: [DONE]\n\n"],
    ["unknown trailing bytes", (s: string) => s + "private"],
    ["CRLF serializer", (s: string) => s.replaceAll("\n", "\r\n")],
    ["multiline event", (s: string) => s.replace("data: ", "data:\n")],
    ["malformed JSON", (s: string) => s.replace('"start"', "no-json")],
    [
      "duplicate JSON keys",
      (s: string) =>
        s.replace('"type":"start"', '"type":"error","type":"start"'),
    ],
    [
      "noncanonical JSON whitespace",
      (s: string) => s.replace('"type":"start"', '"type": "start"'),
    ],
    ["BOM", (s: string) => "\uFEFF" + s],
    [
      "oversized raw response",
      (s: string) => s + "x".repeat(RESEARCH_STREAM_BYTE_LIMIT),
    ],
  ] as const)
    it(`rejects ${name} at raw framing`, async () => {
      await expect(
        collectResearchAnswer(response(transform(raw())), ANSWER_ID, signal()),
      ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
    });
  it("reproduces the SDK unfinished-tail discard while the app rejects that same raw response", async () => {
    const text = raw().replace(
      "data: [DONE]\n\n",
      'data: {"type":"error","errorText":"private"',
    );
    const transport = new DefaultChatTransport<ResearchMessage>({
      fetch: async () => response(text),
    });
    const stream = await transport.sendMessages({
      trigger: "submit-message",
      chatId: "synthetic",
      messageId: undefined,
      messages: [],
      abortSignal: signal(),
    });
    const reader = stream.getReader(),
      parsed: UIMessageChunk[] = [];
    while (true) {
      const x = await reader.read();
      if (x.done) break;
      parsed.push(x.value);
    }
    reader.releaseLock();
    expect(parsed).toEqual(chunks());
    await expect(
      collectResearchAnswer(response(text), ANSWER_ID, signal()),
    ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  });
  it("does not deliver at DONE before physical EOF and owns the producer bytes", async () => {
    let control!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        control = c;
      },
    });
    const bytes = encode(raw());
    let settled = false;
    const result = collectResearchAnswer(
      new Response(body, { headers }),
      ANSWER_ID,
      signal(),
    );
    void result.then(() => {
      settled = true;
    });
    control.enqueue(bytes);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    bytes.fill(0);
    control.close();
    expect((await result).statements[0].text).toBe("Synthetic answer.");
    expect(body.locked).toBe(false);
  });
  it("discards caller abort without awaiting noncooperative cancellation", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const body = new ReadableStream<Uint8Array>({ cancel });
    const controller = new AbortController();
    const result = collectResearchAnswer(
      new Response(body, { headers }),
      ANSWER_ID,
      controller.signal,
    );
    const checked = expect(result).rejects.toThrow(RESEARCH_ANSWER_ERROR);
    controller.abort("private");
    await checked;
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });
  it("bounds a stalled source by one total deadline and clears its timer", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const body = new ReadableStream<Uint8Array>({ cancel });
    const result = collectResearchAnswer(
      new Response(body, { headers }),
      ANSWER_ID,
      signal(),
    );
    const checked = expect(result).rejects.toThrow(RESEARCH_ANSWER_ERROR);
    await vi.advanceTimersByTimeAsync(RESEARCH_STREAM_TIMEOUT_MS);
    await checked;
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects elapsed time before a delayed timer callback", async () => {
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const result = collectResearchAnswer(response(), ANSWER_ID, signal());
    clock = RESEARCH_STREAM_TIMEOUT_MS;
    await expect(result).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  });
  it("rechecks time at clean EOF and after parsing", async () => {
    for (const phase of ["eof", "parse"]) {
      let clock = 0;
      vi.spyOn(performance, "now").mockImplementation(() => clock);
      const bytes = encode(raw());
      let read = false;
      const body = new ReadableStream<Uint8Array>({
        pull(c) {
          if (!read) {
            read = true;
            c.enqueue(bytes);
          } else {
            if (phase === "eof") clock = RESEARCH_STREAM_TIMEOUT_MS;
            c.close();
          }
        },
      });
      if (phase === "parse") {
        const parse = JSON.parse;
        vi.spyOn(JSON, "parse").mockImplementation((text: string) => {
          clock = RESEARCH_STREAM_TIMEOUT_MS;
          return parse(text);
        });
      }
      await expect(
        collectResearchAnswer(
          new Response(body, { headers }),
          ANSWER_ID,
          signal(),
        ),
      ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
      vi.restoreAllMocks();
    }
  });
  it("decodes a split UTF-8 sequence and rejects an incomplete final one", async () => {
    const p = answerFixture();
    p.statements[0].text = "Synthetic 界 answer";
    const bytes = encode(raw(chunks(p)));
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (const b of bytes) c.enqueue(new Uint8Array([b]));
        c.close();
      },
    });
    expect(
      await collectResearchAnswer(
        new Response(body, { headers }),
        ANSWER_ID,
        signal(),
      ),
    ).toEqual(p);
    const invalid = new Uint8Array([...encode(raw()), 0xe7]);
    await expect(
      collectResearchAnswer(
        new Response(invalid, { headers }),
        ANSWER_ID,
        signal(),
      ),
    ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  });
  it("fails closed for wrong status/headers, absent body, pre-abort, bad ID and locked body", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      collectResearchAnswer(response(), ANSWER_ID, controller.signal),
    ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
    for (const r of [
      new Response(null, { headers }),
      new Response(raw(), { headers, status: 403 }),
      new Response(raw()),
      new Response(raw(), {
        headers: { ...headers, "x-vercel-ai-ui-message-stream": "v2" },
      }),
    ])
      await expect(
        collectResearchAnswer(r, ANSWER_ID, signal()),
      ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
    const r = response();
    await expect(
      collectResearchAnswer(r, `${ANSWER_ID}\n`, signal()),
    ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
    const reader = r.body!.getReader();
    await expect(collectResearchAnswer(r, ANSWER_ID, signal())).rejects.toThrow(
      RESEARCH_ANSWER_ERROR,
    );
    reader.releaseLock();
  });
  it("cancels unclaimed rejected bodies but never another reader's locked body", async () => {
    for (const reason of [
      "status",
      "headers",
      "abort",
      "id",
      "locked",
    ] as const) {
      const cancel = vi.fn(() => new Promise<void>(() => {}));
      const body = new ReadableStream<Uint8Array>({ cancel });
      const r = new Response(body, {
        status: reason === "status" ? 403 : 200,
        headers:
          reason === "headers"
            ? { ...headers, "content-type": "text/plain" }
            : headers,
      });
      const controller = new AbortController();
      if (reason === "abort") controller.abort();
      const reader = reason === "locked" ? body.getReader() : undefined;
      await expect(
        collectResearchAnswer(
          r,
          reason === "id" ? "invalid" : ANSWER_ID,
          controller.signal,
        ),
      ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
      expect(cancel).toHaveBeenCalledTimes(reason === "locked" ? 0 : 1);
      reader?.releaseLock();
    }
  });
  it("does not leak a rejected upstream cancellation", async () => {
    const cancel = vi.fn(async () => {
      throw Error("private cancellation diagnostic");
    });
    const body = new ReadableStream<Uint8Array>({ cancel });
    await expect(
      collectResearchAnswer(
        new Response(body, { headers, status: 403 }),
        ANSWER_ID,
        signal(),
      ),
    ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("redacts body errors and supports the source-free outcome", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.error(Error("private diagnostic"));
      },
    });
    await expect(
      collectResearchAnswer(
        new Response(body, { headers }),
        ANSWER_ID,
        signal(),
      ),
    ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
    const p = noResearchEvidenceAnswer(ANSWER_ID);
    expect(
      await collectResearchAnswer(
        response(raw(chunks(p))),
        ANSWER_ID,
        signal(),
      ),
    ).toEqual(p);
  });
});

it.each([NaN, Infinity, -Infinity])(
  "rejects an invalid inherited deadline without opening a reader: %s",
  async (deadline) => {
    const r = response(),
      acquire = vi.spyOn(r.body!, "getReader");
    await expect(
      collectResearchAnswer(r, ANSWER_ID, signal(), deadline),
    ).rejects.toThrow(RESEARCH_ANSWER_ERROR);
    expect(acquire).not.toHaveBeenCalled();
  },
);
it("does not extend its thirty-second reader bound with a longer inherited deadline", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const cancel = vi.fn(),
    r = new Response(new ReadableStream({ cancel }), { headers });
  const pending = collectResearchAnswer(
    r,
    ANSWER_ID,
    signal(),
    performance.now() + 60000,
  );
  const failed = expect(pending).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  await vi.advanceTimersByTimeAsync(RESEARCH_STREAM_TIMEOUT_MS);
  await failed;
  expect(cancel).toHaveBeenCalledOnce();
});

it("deducts synchronous header-validation time before waiting for a stalled first read", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const cancel = vi.fn(),
    r = new Response(new ReadableStream({ cancel }), { headers }),
    get = r.headers.get.bind(r.headers);
  vi.spyOn(r.headers, "get").mockImplementation((name) => {
    if (name === "content-type") vi.advanceTimersByTime(5000);
    return get(name);
  });
  let settled = false;
  const pending = collectResearchAnswer(r, ANSWER_ID, signal()).finally(() => {
    settled = true;
  });
  const failed = expect(pending).rejects.toThrow(RESEARCH_ANSWER_ERROR);
  await vi.advanceTimersByTimeAsync(RESEARCH_STREAM_TIMEOUT_MS - 5001);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await failed;
  expect(performance.now()).toBe(RESEARCH_STREAM_TIMEOUT_MS);
  expect(cancel).toHaveBeenCalledOnce();
});
