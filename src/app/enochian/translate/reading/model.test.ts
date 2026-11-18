import { afterEach, describe, expect, it, vi } from "vitest";
import {
  callError,
  gatewayReadingModel,
  type ReadingCall,
  ReadingCallError,
  type ReadingReply,
  readReply,
} from "./model.ts";
import { READING_MODEL, readingRouting } from "./prompt.ts";

// The `ai` package as the real call imports it: `streamText` records what
// it was sent and answers with a fixed final step, or a stream error.
const sent: Record<string, unknown>[] = [];
let streamError: unknown;
/** Whether some of the model's output arrives before the error. */
let outputFirst = false;
/** Whether some of the model's output arrives after the error. */
let outputAfter = false;
vi.mock("ai", () => ({
  streamText: (options: Record<string, unknown>) => {
    sent.push(options);
    return {
      stream: (async function* () {
        yield {
          type: "start-step",
          providerMetadata: { gateway: { generationId: "gen_01synthetic" } },
        };
        if (outputFirst) yield { type: "text-delta", id: "1", text: "Th" };
        if (streamError !== undefined)
          yield { type: "error", error: streamError };
        if (outputAfter) yield { type: "text-delta", id: "1", text: "Th" };
      })(),
      text: Promise.resolve("reply"),
      usage: Promise.resolve({
        inputTokens: 60_000,
        outputTokens: 2_000,
        inputTokenDetails: { cacheReadTokens: 59_000 },
      }),
      finalStep: Promise.resolve({
        providerMetadata: {
          gateway: {
            cost: "0.0165",
            routing: { finalProvider: "openai" },
            enabledZeroDataRetention: true,
          },
        },
        response: { modelId: "gpt-6.1-terra" },
      }),
      finishReason: Promise.resolve("stop"),
    };
  },
}));

afterEach(() => {
  sent.length = 0;
  streamError = undefined;
  outputFirst = false;
  outputAfter = false;
});

const routing = readingRouting(READING_MODEL);
const call: ReadingCall = {
  model: READING_MODEL,
  effort: "medium",
  routing,
  instructions: ["rules", "context", "grammar"],
  prompt: "Translate.\n\n[1] ZIR [2] IAD",
  maxOutputTokens: 120,
  signal: new AbortController().signal,
};

describe("the reading's gateway call (plan 081, S5)", () => {
  it("asks for no retries, the cap, the effort, caching and the routing", async () => {
    const reply = await gatewayReadingModel(call);
    expect(sent).toHaveLength(1);
    const [options] = sent;
    expect(options).toMatchObject({
      model: "openai/gpt-6.1-terra",
      prompt: call.prompt,
      reasoning: "medium",
      maxOutputTokens: 120,
      maxRetries: 0,
      abortSignal: call.signal,
      providerOptions: {
        gateway: { caching: "auto", only: ["openai"], zeroDataRetention: true },
      },
    });
    expect(options.instructions).toEqual(
      call.instructions.map((content) => ({ role: "system", content })),
    );
    // The SDK's own error logging is off: its errors carry the request.
    expect(typeof options.onError).toBe("function");
    expect(reply).toEqual({
      text: "reply",
      finishReason: "stop",
      cost: "0.0165",
      routing: { provider: "openai", zeroDataRetention: true },
      responseModel: "gpt-6.1-terra",
      generationId: "gen_01synthetic",
      inputTokens: 60_000,
      outputTokens: 2_000,
      cachedTokens: 59_000,
    });
  });

  it("fails with the error's class only, never its message", async () => {
    streamError = Object.assign(new Error("request body: ZIR IAD"), {
      name: "GatewayInternalServerError",
    });
    const failure = await gatewayReadingModel(call).catch((error) => error);
    expect(failure).toBeInstanceOf(ReadingCallError);
    expect(failure.kind).toBe("GatewayInternalServerError");
    expect(failure.message).not.toContain("ZIR");
    expect(failure.status).toBeUndefined();
  });

  it("says whether a failure came before any output (2H review)", async () => {
    streamError = Object.assign(new Error("limited"), {
      name: "GatewayRateLimitError",
      statusCode: 429,
    });
    expect(
      await gatewayReadingModel(call).catch((error) => error),
    ).toMatchObject({
      kind: "GatewayRateLimitError",
      status: 429,
      beforeContent: true,
    });
    outputFirst = true;
    expect(
      await gatewayReadingModel(call).catch((error) => error),
    ).toMatchObject({ status: 429, beforeContent: false });
    // Output after the error part counts too.
    outputFirst = false;
    outputAfter = true;
    expect(
      await gatewayReadingModel(call).catch((error) => error),
    ).toMatchObject({ status: 429, beforeContent: false });
    // Unknown, as for an error from anywhere else: not before.
    expect(callError(new Error("x")).beforeContent).toBe(false);
  });

  it("keeps a failed call's HTTP status, from the error or its cause", async () => {
    streamError = Object.assign(new Error("limited: ZIR"), {
      name: "GatewayRateLimitError",
      statusCode: 429,
    });
    expect(
      await gatewayReadingModel(call).catch((error) => error),
    ).toMatchObject({ kind: "GatewayRateLimitError", status: 429 });
    expect(
      callError(
        Object.assign(new Error("wrapped"), {
          name: "AI_RetryError",
          cause: { statusCode: 503 },
        }),
      ),
    ).toMatchObject({ kind: "AI_RetryError", status: 503 });
    expect(callError("odd")).toMatchObject({ kind: "string" });
  });
});

describe("reading a reply", () => {
  const answer = (block: unknown, extra: Partial<ReadingReply> = {}) => ({
    text: `Working.\n\`\`\`json\n${JSON.stringify(block)}\n\`\`\``,
    finishReason: "stop",
    routing: { provider: "openai", zeroDataRetention: true },
    ...extra,
  });
  const item = {
    source: "ZIR",
    target: "I am",
    basis: "attested",
    ref: "ZIR",
    token: 1,
  };

  it("gives the items and the sentence", () => {
    expect(
      readReply(answer({ items: [item], sentence: " I am. " }), routing),
    ).toEqual({
      ok: true,
      items: [item],
      sentence: "I am.",
    });
  });

  it("fails a reply routed other than asked, whatever it holds", () => {
    for (const reported of [
      { provider: "openai", zeroDataRetention: false },
      { provider: "openai" },
      { provider: "azure", zeroDataRetention: true },
      {},
    ])
      expect(
        readReply(answer({ items: [item] }, { routing: reported }), routing),
      ).toEqual({ ok: false, state: "routing" });
  });

  it("fails a refused, a truncated and an unreadable reply apart", () => {
    expect(
      readReply(
        answer({ items: [item] }, { finishReason: "content-filter" }),
        routing,
      ),
    ).toEqual({ ok: false, state: "refused" });
    expect(
      readReply(answer({ items: [item] }, { finishReason: "length" }), routing),
    ).toEqual({ ok: false, state: "truncated" });
    expect(readReply(answer("no items"), routing)).toEqual({
      ok: false,
      state: "unreadable",
    });
    expect(
      readReply({ ...answer({}), text: "No block at all." }, routing),
    ).toEqual({ ok: false, state: "unreadable" });
  });

  it("fails a stream cut short as a failed call, not a routing failure (2H)", () => {
    // The real `streamText` ends a stream with no finish part as "other",
    // with no routing reported.
    for (const finishReason of ["other", "error"])
      for (const reported of [
        {},
        { provider: "openai", zeroDataRetention: true },
      ])
        expect(
          readReply(
            answer({ items: [item] }, { finishReason, routing: reported }),
            routing,
          ),
        ).toEqual({ ok: false, state: "failed" });
    // Routing reported and wrong is still a routing failure.
    expect(
      readReply(
        answer(
          { items: [item] },
          {
            finishReason: "other",
            routing: { provider: "azure", zeroDataRetention: true },
          },
        ),
        routing,
      ),
    ).toEqual({ ok: false, state: "routing" });
  });
});
