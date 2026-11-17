import type { ReportedRouting } from "./gateway.ts";
import {
  gatewayField,
  gatewayOptions,
  reportedRouting,
  routingProblems,
} from "./gateway.ts";
import type { Routing } from "./prompt.ts";
import type { ReplyItem } from "./reply.ts";
import { parseAnswer, parseSentence } from "./reply.ts";
import type { PartFailure } from "./store.ts";

/**
 * The reading's model call (plan 081, S5) behind one function type, so
 * tests pass a fake and nothing reaches the gateway without a key.
 */

/** One call: a part's request. */
export interface ReadingCall {
  model: string;
  effort: string;
  routing: Routing;
  instructions: readonly string[];
  prompt: string;
  maxOutputTokens: number;
  /** Aborts the call at its timeout (never when the reader leaves). */
  signal: AbortSignal;
}

/** What came back: never logged, never stored as given. */
export interface ReadingReply {
  text: string;
  /** The AI SDK's finish reason ("stop", "length", "content-filter", …). */
  finishReason?: string;
  /** `providerMetadata.gateway.cost` as given. */
  cost?: unknown;
  /** How the gateway says it routed the call. */
  routing: ReportedRouting;
  /** The model the response names, for the log (S10). */
  responseModel?: string;
  /** The gateway's id for the generation, for the log (S10). */
  generationId?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
}

/** Makes a call; rejects on a failed one, with an error that is never logged. */
export type ReadingModel = (call: ReadingCall) => Promise<ReadingReply>;

/**
 * Why a call failed, as the reading reports it: the error's class and, when
 * the SDK gives one, the HTTP status; never its message, since the SDK's
 * errors can carry the whole request.
 */
export class ReadingCallError extends Error {
  constructor(
    /** The error's class ("GatewayRateLimitError", "AbortError", …). */
    readonly kind: string,
    /** The HTTP status the SDK's error carries, if any. */
    readonly status?: number,
  ) {
    super("The model call failed");
    this.name = "ReadingCallError";
  }
}

/** An error's class and HTTP status, looking through its causes. */
export function callError(error: unknown): ReadingCallError {
  if (error instanceof ReadingCallError) return error;
  let status: number | undefined;
  for (let one = error, depth = 0; one && depth < 5; depth++) {
    const code =
      (one as { statusCode?: unknown }).statusCode ??
      (one as { status?: unknown }).status;
    if (typeof code === "number" && Number.isInteger(code)) {
      status = code;
      break;
    }
    one = (one as { cause?: unknown }).cause;
  }
  return new ReadingCallError(
    error instanceof Error ? error.name : typeof error,
    status,
  );
}

/**
 * The AI SDK options a call sends (`streamText`'s), but its abort signal
 * and error hook. They are step 2B's A3s settings (`callSettings` and the
 * transport's in `scripts/enochian-translate-eval/transport.ts`) but for
 * two differences, which `stage2b.test.ts` names and holds to:
 * - the output cap is the part's (`outputCap`), not the experiment's
 *   32,000 for every translation at medium;
 * - the system messages carry no Anthropic cache breakpoints
 *   (`providerOptions.anthropic.cacheControl`), which OpenAI ignores.
 */
export function readingCallSettings(call: Omit<ReadingCall, "signal">) {
  return {
    model: call.model,
    instructions: call.instructions.map((content) => ({
      role: "system" as const,
      content,
    })),
    prompt: call.prompt,
    reasoning: call.effort as "medium",
    maxOutputTokens: call.maxOutputTokens,
    maxRetries: 0,
    providerOptions: { gateway: gatewayOptions({ routing: call.routing }) },
  };
}

/**
 * The real call, through Vercel AI Gateway (the `ai` package's default
 * provider): streamed, so a long think never leaves the connection idle,
 * and read to its end; no retries (`maxRetries: 0`), so none is billed
 * twice; the gateway asked to cache the prompt and to route as `routing`
 * says. The SDK's own error logging is off (`onError`), since its errors
 * carry the request; a failure rejects with `ReadingCallError`.
 */
export const gatewayReadingModel: ReadingModel = async (call) => {
  const { streamText } = await import("ai");
  let generationId: string | undefined;
  const seen = (metadata: unknown) => {
    const id = gatewayField(metadata, "generationId");
    if (!generationId && typeof id === "string" && id) generationId = id;
  };
  try {
    const result = streamText({
      ...readingCallSettings(call),
      abortSignal: call.signal,
      onError: () => {},
    });
    let failed: unknown;
    for await (const part of result.stream) {
      seen((part as { providerMetadata?: unknown }).providerMetadata);
      if (part.type === "error") failed ??= part.error ?? "error";
    }
    if (failed !== undefined) throw callError(failed);
    const [text, usage, step, finishReason] = await Promise.all([
      result.text,
      result.usage,
      result.finalStep,
      result.finishReason,
    ]);
    seen(step.providerMetadata);
    return {
      text,
      finishReason,
      cost: gatewayField(step.providerMetadata, "cost"),
      routing: reportedRouting(step.providerMetadata),
      responseModel: step.response?.modelId,
      ...(generationId ? { generationId } : {}),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedTokens: usage.inputTokenDetails?.cacheReadTokens,
    };
  } catch (error) {
    throw callError(error);
  }
};

/** A reply read: its items and sentence, or why the part failed. */
export type ReadReply =
  | { ok: true; items: ReplyItem[]; sentence?: string }
  | { ok: false; state: PartFailure };

/**
 * Reads a reply (S5): routing other than asked (OpenAI, zero retention),
 * the provider's refusal, an answer cut at the cap, or one with no
 * readable json block each fail the part; the reply is then discarded.
 */
export function readReply(reply: ReadingReply, asked: Routing): ReadReply {
  if (routingProblems(asked, reply.routing).length)
    return { ok: false, state: "routing" };
  if (reply.finishReason === "content-filter")
    return { ok: false, state: "refused" };
  if (reply.finishReason === "length") return { ok: false, state: "truncated" };
  const parsed = parseAnswer(reply.text);
  if (!parsed.ok) return { ok: false, state: "unreadable" };
  const sentence = parseSentence(reply.text);
  return {
    ok: true,
    items: parsed.value,
    ...(sentence ? { sentence } : {}),
  };
}
