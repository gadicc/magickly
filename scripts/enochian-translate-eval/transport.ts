import { createHash } from "node:crypto";
import type { LanguageModelUsage } from "ai";
import { NO_TOKENS, type Tokens } from "./ledger.ts";
import { type Effort, MAX_OUTPUT_TOKENS, type RequestKind } from "./models.ts";

/**
 * The two ways a request reaches a model, behind one interface: `sync`, one
 * streamed call each with a few at a time, and `batch`, the gateway's batch
 * API at half price, collected later. Both go through Vercel AI Gateway (the
 * `ai` package's default provider, keyed by `AI_GATEWAY_API_KEY`). Tests
 * pass a fake `Gateway`, so nothing here is reached without a key.
 */

/** One request to a model, transport-neutral. */
export interface ModelRequest {
  /** Unique within its run; also its file name and batch id ([A-Za-z0-9_-]). */
  id: string;
  kind: RequestKind;
  /** A gateway model id. */
  model: string;
  effort: Effort;
  /** System messages, in order: fixed instructions first, then context. */
  instructions: string[];
  /** The user message: the task and its input. */
  prompt: string;
}

/** A request's prompt, hashed, to tie saved output to the prompt it answers. */
export function promptHash(request: ModelRequest): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        request.model,
        request.effort,
        request.instructions,
        request.prompt,
      ]),
    )
    .digest("hex");
}

/** The characters a request sends, for its projected input tokens. */
export function promptChars(request: ModelRequest): number {
  return (
    request.instructions.reduce((sum, one) => sum + one.length, 0) +
    request.prompt.length
  );
}

/** What came back for one request. Reasoning text is never kept. */
export interface ModelResult {
  id: string;
  /** False when the call or the batch item failed: no reply to score. */
  ok: boolean;
  text: string;
  finishReason?: string;
  tokens: Tokens;
  /** `providerMetadata.gateway.cost` as given, when given. */
  gatewayCost?: unknown;
  /** The gateway's id for the generation, for a later cost lookup. */
  generationId?: string;
  /** The model that answered, as the response names it. */
  responseModel?: string;
  /** The AI SDK's warnings for the call, as given. */
  warnings?: unknown[];
  error?: string;
}

/** A batch's serialisable reference (the AI SDK's `BatchReference`). */
export interface BatchReference {
  readonly version: 2;
  readonly id: string;
  readonly provider: string;
}

export type BatchState = "pending" | "completed" | "failed";

export interface BatchStatus {
  status: BatchState;
  counts?: {
    total: number;
    pending: number;
    completed: number;
    failed: number;
  };
  error?: string;
}

/** What the runner passes along with a sync call. */
export interface CallHooks {
  /** Aborts the call (its timeout). */
  signal?: AbortSignal;
  /** Called once, as soon as the gateway names the generation. */
  onGenerationId?: (id: string) => void;
}

/** The calls the runner makes; the real one is `aiGateway()`. */
export interface Gateway {
  generate(request: ModelRequest, hooks?: CallHooks): Promise<ModelResult>;
  /**
   * Starts a batch; every request must name the same model. Starting again
   * with the same idempotency key replays the batch first started with it.
   */
  startBatch(
    requests: readonly ModelRequest[],
    idempotencyKey: string,
  ): Promise<{ reference: BatchReference; warnings: unknown[] }>;
  batchStatus(batch: BatchReference): Promise<BatchStatus>;
  batchResults(batch: BatchReference): AsyncIterable<ModelResult>;
  /** A generation's cost from the gateway, if it can say. */
  generationCost(id: string): Promise<number | undefined>;
}

/** The AI SDK's usage as the ledger counts it. */
export function tokensOf(usage: LanguageModelUsage | undefined): Tokens {
  if (!usage) return { ...NO_TOKENS };
  return {
    input: usage.inputTokens ?? 0,
    cached: usage.inputTokenDetails?.cacheReadTokens ?? 0,
    cacheWrite: usage.inputTokenDetails?.cacheWriteTokens ?? 0,
    output: usage.outputTokens ?? 0,
    reasoning: usage.outputTokenDetails?.reasoningTokens ?? 0,
  };
}

/**
 * The warnings that say a setting was ignored or isn't supported: every
 * "unsupported" and "compatibility" warning, and any other that says so.
 * With one of these the request didn't run as asked (reasoning or effort
 * ignored would make a high/medium comparison meaningless), so it fails,
 * recorded, its reply kept. Deprecation notices don't count.
 */
export function settingWarnings(warnings: readonly unknown[] = []): string[] {
  return warnings
    .filter((one) => {
      const type = (one as { type?: string })?.type;
      if (type === "deprecated") return false;
      if (type === "unsupported" || type === "compatibility") return true;
      return /ignor|unsupport|not support|not applied/i.test(
        JSON.stringify(one),
      );
    })
    .map((one) => JSON.stringify(one));
}

/**
 * The generation id a thrown error carries, if any: the gateway's errors
 * keep it (`GatewayError.generationId`), sometimes as another error's cause.
 */
export function errorGenerationId(error: unknown): string | undefined {
  for (let one = error, depth = 0; one && depth < 5; depth++) {
    const id = (one as { generationId?: unknown }).generationId;
    if (typeof id === "string" && id) return id;
    one = (one as { cause?: unknown }).cause;
  }
  return undefined;
}

const message = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

/** A field of `providerMetadata.gateway`. */
function gatewayField(metadata: unknown, field: string): unknown {
  return (metadata as { gateway?: Record<string, unknown> } | undefined)
    ?.gateway?.[field];
}

/** The settings both transports send with a request. */
function callSettings(request: ModelRequest) {
  return {
    instructions: request.instructions.map((content) => ({
      role: "system" as const,
      content,
    })),
    prompt: request.prompt,
    reasoning: request.effort,
    maxOutputTokens: MAX_OUTPUT_TOKENS[request.kind][request.effort],
  };
}

/**
 * The real gateway, through the `ai` package.
 *
 * Sync calls stream (`streamText`), so a long think never leaves the
 * connection silent long enough for the HTTP client's timeouts; the stream is
 * read to its end, then the text, usage, final step's metadata and warnings
 * are taken. They ask the gateway to cache prompts
 * (`providerOptions.gateway.caching: "auto"`, `GatewayProviderOptions` in
 * `@ai-sdk/gateway`) and make no retries, so a failure is recorded rather
 * than hidden; `--retry-failed` re-runs it openly. The generation id is kept
 * from the first chunk that carries it, so a failed call's cost can be
 * looked up (`getGenerationInfo`).
 */
export function aiGateway(): Gateway {
  return {
    async generate(request, hooks = {}) {
      const { streamText } = await import("ai");
      let generationId: string | undefined;
      const seen = (id: unknown) => {
        if (generationId || typeof id !== "string" || !id) return;
        generationId = id;
        hooks.onGenerationId?.(id);
      };
      const failed = (error: unknown): ModelResult => {
        seen(errorGenerationId(error));
        return {
          id: request.id,
          ok: false,
          text: "",
          tokens: { ...NO_TOKENS },
          error: message(error),
          ...(generationId ? { generationId } : {}),
        };
      };
      try {
        const result = streamText({
          model: request.model,
          ...callSettings(request),
          maxRetries: 0,
          providerOptions: { gateway: { caching: "auto" } },
          ...(hooks.signal ? { abortSignal: hooks.signal } : {}),
        });
        let streamError: unknown;
        for await (const part of result.stream) {
          seen(
            gatewayField(
              (part as { providerMetadata?: unknown }).providerMetadata,
              "generationId",
            ),
          );
          if (part.type === "error") streamError ??= part.error;
        }
        if (streamError !== undefined) return failed(streamError);
        const [text, usage, step, warnings, finishReason] = await Promise.all([
          result.text,
          result.usage,
          result.finalStep,
          result.warnings,
          result.finishReason,
        ]);
        seen(gatewayField(step.providerMetadata, "generationId"));
        const out: ModelResult = {
          id: request.id,
          ok: true,
          text,
          finishReason,
          tokens: tokensOf(usage),
          gatewayCost: gatewayField(step.providerMetadata, "cost"),
          responseModel: step.response?.modelId,
          warnings: [...(warnings ?? [])],
        };
        if (generationId) out.generationId = generationId;
        return out;
      } catch (error) {
        return failed(error);
      }
    },
    async startBatch(requests, idempotencyKey) {
      const { experimental_startBatch } = await import("ai");
      const batch = await experimental_startBatch({
        requests: requests.map((request) => ({
          id: request.id,
          type: "text" as const,
          model: request.model,
          ...callSettings(request),
        })),
        providerOptions: { gateway: { idempotencyKey } },
      });
      return {
        reference: {
          version: batch.version,
          id: batch.id,
          provider: batch.provider,
        },
        warnings: [...(batch.warnings ?? [])],
      };
    },
    async batchStatus(batch) {
      const { experimental_getBatchStatus } = await import("ai");
      const status = await experimental_getBatchStatus({ batch });
      const out: BatchStatus = { status: status.status };
      if (status.requestCounts) out.counts = status.requestCounts;
      if (status.error) out.error = status.error.message;
      return out;
    },
    async *batchResults(batch) {
      const { experimental_getBatchResults } = await import("ai");
      for await (const item of experimental_getBatchResults({ batch })) {
        if (item.type !== "text") continue;
        const generationId = gatewayField(
          item.providerMetadata,
          "generationId",
        );
        const common = typeof generationId === "string" ? { generationId } : {};
        if (item.status === "succeeded")
          yield {
            id: item.id,
            ok: true,
            text: item.text,
            finishReason: item.finishReason,
            tokens: tokensOf(item.usage),
            gatewayCost: gatewayField(item.providerMetadata, "cost"),
            responseModel: item.response?.modelId,
            ...common,
          };
        else
          yield {
            id: item.id,
            ok: false,
            text: "",
            tokens: { ...NO_TOKENS },
            error: `${item.status}${item.error ? `: ${item.error.message}` : ""}`,
            ...common,
          };
      }
    },
    async generationCost(id) {
      const { gateway } = await import("ai");
      try {
        const info = await gateway.getGenerationInfo({ id });
        return Number.isFinite(info.totalCost) ? info.totalCost : undefined;
      } catch {
        return undefined;
      }
    },
  };
}

/**
 * Sends requests one call each, `concurrency` at a time. Before each launch
 * it asks `reserve`, which holds the call's worst case if it fits. When that
 * says no while calls are in flight, the worker waits for one to finish and
 * asks again; when it says no with none in flight, the rest are skipped and
 * returned by id. So a run never holds more than it may spend, each call in
 * flight counted at its worst case.
 */
export async function runSync(
  requests: readonly ModelRequest[],
  options: {
    gateway: Gateway;
    concurrency?: number;
    reserve: (request: ModelRequest) => boolean;
    /** The hooks for a call (its timeout, its generation id). */
    hooks?: (request: ModelRequest) => CallHooks;
    onResult: (
      result: ModelResult,
      request: ModelRequest,
    ) => void | Promise<void>;
  },
): Promise<{ skipped: string[] }> {
  const skipped: string[] = [];
  let next = 0;
  let stopped = false;
  let inFlight = 0;
  let waiting: (() => void)[] = [];
  const wake = () => {
    const all = waiting;
    waiting = [];
    for (const one of all) one();
  };
  const worker = async () => {
    while (next < requests.length) {
      const request = requests[next];
      if (stopped) {
        next++;
        skipped.push(request.id);
        continue;
      }
      // `reserve` and `next++` run with no await between them, so two
      // workers never take the same request.
      if (!options.reserve(request)) {
        if (inFlight > 0)
          await new Promise<void>((resolve) => waiting.push(resolve));
        else stopped = true;
        continue;
      }
      next++;
      inFlight++;
      try {
        await options.onResult(
          await options.gateway.generate(request, options.hooks?.(request)),
          request,
        );
      } finally {
        inFlight--;
        wake();
      }
    }
  };
  const workers = Math.max(
    1,
    Math.min(options.concurrency ?? 4, requests.length),
  );
  await Promise.all(Array.from({ length: workers }, worker));
  wake();
  return { skipped };
}
