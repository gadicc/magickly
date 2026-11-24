import { usageDay } from "@/app/chat/usage";
import { boundedText } from "@/lib/boundedText";
import { isSameOrigin } from "@/lib/sameOrigin";
import type { Translator } from "../lookup.ts";
import {
  type AllowanceScope,
  reserveReading,
  returnReading,
} from "./allowance.ts";
import { type CheckedReading, checkReading } from "./check.ts";
import type { ReadingDatabase } from "./database.ts";
import { routingProblems } from "./gateway.ts";
import {
  ceilingRoom,
  type Hold,
  holdSpend,
  readingsOff,
  settleSpend,
} from "./ledger.ts";
import { READING_MAX_DURATION } from "./limits.ts";
import { callError, type ReadingModel, readReply } from "./model.ts";
import {
  type AdmissionRefusal,
  admitReading,
  type ReadingPart,
  readingParts,
  readingUnits,
} from "./passage.ts";
import { reportedMicroUsd, worstCaseMicroUsd } from "./prices.ts";
import {
  type PartRequest,
  partRequest,
  type ReadingPrompt,
} from "./request.ts";
import {
  deleteExpiredReadings,
  lookUpReading,
  type PartFailure,
  readingStoreVersion,
  releaseReading,
  type StoredPart,
  storeParts,
} from "./store.ts";

/**
 * `POST /api/enochian/read` (plan 081, S5): the AI reading of a passage of
 * Enochian. In order: same-origin only; the JSON body (`{text, again?}`);
 * admission (S3); the session; the switch (S4), which when off serves
 * nothing, stored readings included; the shared store (S7), which answers
 * a reading made within the day for nothing and holds a lease against a
 * concurrent identical request; a read-only look at the day's ceiling;
 * the reader's allowance; the ceiling's hold, atomic (S4); then the model,
 * a part at a time, the switch read again before each, each part checked
 * (S6), stored and streamed as it lands.
 *
 * The response is NDJSON: a `part` event for each part in order, then
 * `done`; or one `refused` event, with an HTTP status to match. The model
 * calls don't stop when the reader leaves: they finish, are stored and
 * settled, kept alive by `waitUntil`.
 *
 * Nothing here logs the passage, the model's reply or its sentence, on any
 * path: the log has codes, counts, tokens, cost, times, the model and
 * generation ids, and a failed call's class and HTTP status (S10).
 */

export { READING_MAX_DURATION };

/** How long one call may take before it is aborted. */
export const CALL_TIMEOUT_MS = 120_000;

/**
 * A reading's lease on its row: past the function's limit, so a lease
 * outlives the request holding it only if that request died.
 */
export const LEASE_MS = (READING_MAX_DURATION + 30) * 1000;

/** The largest request body read, in bytes: the text is at most 1,200. */
export const MAX_BODY_BYTES = 8 * 1024;

/** Why a request isn't read; each is a state the card can show (S7). */
export type ReadingRefusal =
  /** Not from this site's own pages. */
  | { state: "forbidden" }
  /** Not a JSON body of `{text, again?}`. */
  | { state: "invalid" }
  /** The text isn't one the reading takes (S3). */
  | { state: "not admitted"; reason: AdmissionRefusal; words: number }
  /** Another request is reading the same passage: try again shortly. */
  | { state: "busy" }
  /** Readings are turned off by hand (S4). */
  | { state: "off" }
  /** The day's ceiling is reached: readings stop until `resetAt` (S4). */
  | { state: "ceiling"; resetAt: string }
  /** Too little of the reader's allowance is left (S4). */
  | {
      state: "allowance";
      scope: AllowanceScope;
      /** Units the reading needs. */
      units: number;
      /** Units left today. */
      left: number;
      limit: number;
      resetAt: string;
    }
  /** The session or the database failed: nothing was sent. */
  | { state: "unavailable" };

/** One line of the response. */
export type ReadingEvent =
  | ({ type: "refused" } & ReadingRefusal)
  | {
      type: "part";
      /** From 1. */
      part: number;
      parts: number;
      /** The store's reading, or the model's just now. */
      from: "store" | "model";
      status: "read";
      reading: CheckedReading;
    }
  | {
      type: "part";
      part: number;
      parts: number;
      status: "failed";
      state: PartFailure;
    }
  | {
      type: "done";
      /** Every part read, some, or none. */
      state: "read" | "partial" | "failed";
      from: "store" | "model";
      /** Units this request took from the allowance. */
      units: number;
    };

/** What the log may hold: codes, counts, tokens, cost and times. */
export interface ReadingLog {
  event: "refused" | "part" | "done" | "error";
  state?: string;
  part?: number;
  parts?: number;
  words?: number;
  units?: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  costMicroUsd?: number;
  ms?: number;
  /** The model the response names (S10). */
  model?: string;
  /** The gateway's id for the generation (S10). */
  generation?: string;
  /** An error's class, never its message. */
  error?: string;
  /** The HTTP status a failed call's error carried. */
  status?: number;
}

/** What the route passes in; tests pass fakes. */
export interface ReadingDependencies {
  db: ReadingDatabase;
  translator: () => Translator;
  prompt: () => ReadingPrompt;
  /** The signed-in user, or null; throws when the session can't be read. */
  userId: () => Promise<string | null>;
  /** The signed-out client's bucket for the UTC day (`clientSubject`). */
  clientSubject: (request: Request, day: string) => string;
  model: ReadingModel;
  /** Keeps the function alive for the calls (`after`). */
  waitUntil: (work: Promise<unknown>) => void;
  now?: () => Date;
  callTimeoutMs?: number;
  log?: (line: ReadingLog) => void;
}

/** The default log: one line, fields chosen by `ReadingLog`. */
export const logReading = (line: ReadingLog) =>
  console.info(`enochian-read ${JSON.stringify(line)}`);

const STATUS: Record<ReadingRefusal["state"], number> = {
  forbidden: 403,
  invalid: 400,
  "not admitted": 422,
  busy: 409,
  off: 503,
  ceiling: 503,
  allowance: 429,
  unavailable: 503,
};

const NDJSON = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
};

const line = (event: ReadingEvent) => `${JSON.stringify(event)}\n`;

/**
 * HTTP statuses a failed call's error may carry when no generation ran:
 * the gateway refused the call (authentication, permission, an unknown
 * model, a rate limit) before any model read the text, so it cost nothing
 * and its hold is settled to nothing. Any other failure keeps its hold.
 */
const NO_GENERATION: ReadonlySet<number> = new Set([401, 403, 404, 429]);

/** An error's class, for the log. */
const errorClass = (error: unknown) =>
  error instanceof Error ? error.name : typeof error;

/** Reads `{text, again?}` from a JSON body, or undefined. */
async function readBody(
  request: Request,
): Promise<{ text: string; again: boolean } | undefined> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) return undefined;
  let body: unknown;
  try {
    const raw = await boundedText(request, MAX_BODY_BYTES);
    if (raw === undefined) return undefined;
    body = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return undefined;
  const { text, again } = body as { text?: unknown; again?: unknown };
  if (typeof text !== "string") return undefined;
  if (again !== undefined && typeof again !== "boolean") return undefined;
  return { text, again: again === true };
}

/** The NDJSON lines of a stream that ends when `close` is called. */
function eventStream() {
  const encoder = new TextEncoder();
  const queue: string[] = [];
  let closed = false;
  let cancelled = false;
  let wake: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (!queue.length && !closed)
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      const next = queue.shift();
      if (next !== undefined) controller.enqueue(encoder.encode(next));
      else controller.close();
    },
    cancel() {
      // The reader left: the calls go on, and nothing more is queued.
      cancelled = true;
      queue.length = 0;
    },
  });
  const poke = () => {
    const resolve = wake;
    wake = undefined;
    resolve?.();
  };
  return {
    stream,
    push(event: ReadingEvent) {
      if (cancelled) return;
      queue.push(line(event));
      poke();
    },
    close() {
      closed = true;
      poke();
    },
  };
}

/** Handles one request (see the module's comment). */
export async function respondToReading(
  request: Request,
  deps: ReadingDependencies,
): Promise<Response> {
  const log = deps.log ?? logReading;
  const clock = () => deps.now?.() ?? new Date();
  const now = clock();
  const refuse = (refusal: ReadingRefusal, headers: HeadersInit = {}) => {
    log({ event: "refused", state: refusal.state });
    return new Response(line({ type: "refused", ...refusal }), {
      status: STATUS[refusal.state],
      headers: { ...NDJSON, ...headers },
    });
  };
  const unavailable = (error: unknown) => {
    log({ event: "error", error: errorClass(error) });
    return refuse({ state: "unavailable" });
  };

  if (!isSameOrigin(request)) return refuse({ state: "forbidden" });
  const body = await readBody(request);
  if (!body) return refuse({ state: "invalid" });

  let translator: Translator;
  let prompt: ReadingPrompt;
  try {
    translator = deps.translator();
    prompt = deps.prompt();
  } catch (error) {
    return unavailable(error);
  }
  const admission = admitReading(translator, body.text);
  if (!admission.ok)
    return refuse({
      state: "not admitted",
      reason: admission.reason,
      words: admission.words,
    });
  const parts = readingParts(translator, admission.passage);

  // A session or database failure stops here, before any model call.
  let userId: string | null;
  try {
    userId = await deps.userId();
  } catch (error) {
    return unavailable(error);
  }

  const { db } = deps;
  const key = {
    version: readingStoreVersion(prompt.version),
    passage: admission.passage,
  };
  let lookup: Awaited<ReturnType<typeof lookUpReading>>;
  try {
    // Off means nothing is served, a stored reading included: it may have
    // been turned off for what a reading says, not only for its cost.
    if (await readingsOff(db)) return refuse({ state: "off" });
    await deleteExpiredReadings(db, now);
    lookup = await lookUpReading(db, key, {
      parts: parts.length,
      again: body.again,
      now,
      leaseMs: LEASE_MS,
    });
  } catch (error) {
    return unavailable(error);
  }

  if (lookup.kind === "hit") {
    const events: ReadingEvent[] = lookup.parts.map((one, at) => ({
      type: "part",
      part: at + 1,
      parts: parts.length,
      from: "store",
      status: "read",
      reading: one.reading,
    }));
    events.push({ type: "done", state: "read", from: "store", units: 0 });
    log({ event: "done", state: "store", parts: parts.length, units: 0 });
    return new Response(events.map(line).join(""), { headers: NDJSON });
  }
  if (lookup.kind === "busy") return refuse({ state: "busy" });

  // Claimed: from here a refusal gives the lease back.
  const { claim } = lookup;
  const toRead = parts.flatMap((_, at) => (lookup.parts[at] ? [] : [at]));
  const requests = new Map<number, PartRequest>();
  const holds = new Map<number, Hold>();
  const giveBack = async () => {
    for (const hold of holds.values())
      await settleSpend(db, hold, 0).catch((error) =>
        log({ event: "error", state: "settle", error: errorClass(error) }),
      );
    await releaseReading(db, key, claim).catch((error) =>
      log({ event: "error", state: "release", error: errorClass(error) }),
    );
  };
  /** Whose allowance the reading draws on, once known. */
  let who: { userId: string | null; client: string } = {
    userId,
    client: "",
  };
  const units =
    toRead.length === parts.length
      ? admission.units
      : readingUnits(toRead.reduce((sum, at) => sum + parts[at].words, 0));
  /** Whether the units are taken, so a failure before any call returns them. */
  let reserved = false;
  try {
    for (const at of toRead) requests.set(at, partRequest(prompt, parts[at]));
    // Every call's worst case, held at once, so a reading never stops
    // half way for the ceiling; each settles on its own after its call.
    const worst = toRead.map((at) => {
      const one = requests.get(at) as PartRequest;
      return worstCaseMicroUsd(one.chars, one.maxOutputTokens);
    });
    const total = worst.reduce((sum, one) => sum + one, 0);
    // First a look, read only, so a reader with no allowance left never
    // holds any of the day's spending; then the allowance; then the hold.
    const room = await ceilingRoom(db, total, now);
    const ceiling = () =>
      refuse({ state: "ceiling", resetAt: room.resetAt.toISOString() });
    if (!room.ok) {
      await giveBack();
      return ceiling();
    }
    who = {
      userId,
      client: userId ? "" : deps.clientSubject(request, usageDay(now).day),
    };
    const allowance = await reserveReading(db, who, units, now);
    if (!allowance.ok) {
      await giveBack();
      return refuse(
        {
          state: "allowance",
          scope: allowance.scope,
          units,
          left: allowance.left,
          limit: allowance.limit,
          resetAt: allowance.resetAt.toISOString(),
        },
        { "Retry-After": allowance.resetAt.toUTCString() },
      );
    }
    reserved = true;
    const held = await holdSpend(db, total, now);
    if (!held.ok) {
      // Another request took the room meanwhile. No call was made, so the
      // units go back.
      reserved = false;
      await returnReading(db, who, units, now);
      await giveBack();
      return ceiling();
    }
    toRead.forEach((at, i) =>
      holds.set(at, { day: held.hold.day, microUsd: worst[i] }),
    );
  } catch (error) {
    // No call was made: the units go back with the lease and any hold.
    if (reserved)
      await returnReading(db, who, units, now).catch((failure) =>
        log({ event: "error", state: "return", error: errorClass(failure) }),
      );
    await giveBack();
    return unavailable(error);
  }

  const events = eventStream();
  const work = readParts({
    deps,
    log,
    clock,
    translator,
    prompt,
    parts,
    stored: lookup.parts,
    fresh: lookup.fresh,
    replacing: lookup.replacing,
    key,
    claim,
    requests,
    holds,
    units,
    who,
    reservedAt: now,
    push: events.push,
  }).finally(events.close);
  deps.waitUntil(work);
  return new Response(events.stream, { headers: NDJSON });
}

/**
 * Reads the parts the store lacks, in order, storing and pushing each. The
 * switch is read again before each call, so a reading turned off part way
 * sends no more text. "Read again" over a complete reading stores nothing
 * until every part is read, so a failure keeps the reading it would have
 * replaced.
 */
async function readParts(run: {
  deps: ReadingDependencies;
  log: (line: ReadingLog) => void;
  clock: () => Date;
  translator: Translator;
  prompt: ReadingPrompt;
  parts: readonly ReadingPart[];
  stored: readonly StoredPart[];
  fresh: boolean;
  replacing: boolean;
  key: { version: string; passage: string };
  claim: string;
  requests: Map<number, PartRequest>;
  holds: Map<number, Hold>;
  units: number;
  /** Whose units were reserved, and when, to give back if no call is made. */
  who: { userId: string | null; client: string };
  reservedAt: Date;
  push: (event: ReadingEvent) => void;
}) {
  const { deps, log, parts, key, claim } = run;
  const { db } = deps;
  const mine = [...run.stored];
  const total = parts.length;
  let wrote = false;
  /** Why no more parts are sent, once one is. */
  let stop: PartFailure | undefined;
  /** Whether any model call was made. */
  let called = false;
  const settle = (at: number, actual: number | undefined) => {
    const hold = run.holds.get(at);
    return hold
      ? settleSpend(db, hold, actual).catch((error) =>
          log({ event: "error", state: "settle", error: errorClass(error) }),
        )
      : undefined;
  };
  const store = async () => {
    try {
      await storeParts(db, key, claim, mine, {
        fresh: run.fresh && !wrote,
        now: run.clock(),
      });
      wrote = true;
    } catch (error) {
      log({ event: "error", state: "store", error: errorClass(error) });
    }
  };
  for (let at = 0; at < total; at++) {
    const stored = mine[at];
    if (stored?.status === "read") {
      run.push({
        type: "part",
        part: at + 1,
        parts: total,
        from: "store",
        status: "read",
        reading: stored.reading,
      });
      continue;
    }
    if (!stop)
      try {
        if (await readingsOff(db)) stop = "off";
      } catch (error) {
        log({ event: "error", state: "switch", error: errorClass(error) });
        // Our side failed and nothing was sent: not the model's failure.
        stop = "unavailable";
      }
    if (!stop) called = true;
    const outcome: Awaited<ReturnType<typeof readPart>> = stop
      ? { part: { status: "failed", state: stop }, cost: 0 }
      : await readPart(run, at);
    await settle(at, outcome.cost);
    mine[at] = outcome.part;
    // After a part routed other than asked, or a failed call whose routing
    // the gateway never confirmed (a stream cut short, an error, a timeout;
    // not a refusal before any output), send no more text.
    if (
      outcome.part.status === "failed" &&
      (outcome.part.state === "routing" || outcome.unconfirmed)
    )
      stop = "not read";
    if (outcome.part.status === "read") {
      if (!run.replacing) await store();
      run.push({
        type: "part",
        part: at + 1,
        parts: total,
        from: "model",
        status: "read",
        reading: outcome.part.reading,
      });
    } else
      run.push({
        type: "part",
        part: at + 1,
        parts: total,
        status: "failed",
        state: outcome.part.state,
      });
  }
  const read = mine.filter((one) => one?.status === "read").length;
  try {
    if (run.replacing ? read === total : wrote) {
      // The failed parts' states too; a replacement, all at once.
      await storeParts(db, key, claim, mine, {
        fresh: run.fresh && !wrote,
        now: run.clock(),
      });
    }
    await releaseReading(db, key, claim);
  } catch (error) {
    log({ event: "error", state: "release", error: errorClass(error) });
  }
  // Stopped before any call (the switch): the units go back, as the
  // holds did, since nothing could have cost.
  let units = run.units;
  if (!called)
    try {
      await returnReading(db, run.who, run.units, run.reservedAt);
      units = 0;
    } catch (error) {
      log({ event: "error", state: "return", error: errorClass(error) });
    }
  const state = read === total ? "read" : read ? "partial" : "failed";
  log({ event: "done", state, parts: total, units });
  run.push({ type: "done", state, from: "model", units });
}

/**
 * One model call, its reply read and checked; never throws. `unconfirmed`
 * says a reply came back without the routing asked for confirmed.
 */
async function readPart(
  run: Parameters<typeof readParts>[0],
  at: number,
): Promise<{
  part: StoredPart & object;
  cost?: number;
  unconfirmed?: boolean;
}> {
  const { deps, log, prompt } = run;
  const request = run.requests.get(at) as PartRequest;
  const started = Date.now();
  const signal = AbortSignal.timeout(deps.callTimeoutMs ?? CALL_TIMEOUT_MS);
  const counts = {
    part: at + 1,
    parts: run.parts.length,
    words: run.parts[at].words,
  };
  let cost: number | undefined;
  try {
    const reply = await deps.model({
      model: prompt.model,
      effort: prompt.effort,
      routing: prompt.routing,
      instructions: request.instructions,
      prompt: request.prompt,
      maxOutputTokens: request.maxOutputTokens,
      signal,
    });
    cost = reportedMicroUsd(reply.cost);
    const read = readReply(reply, prompt.routing);
    log({
      event: "part",
      state: read.ok ? "read" : read.state,
      ...counts,
      inputTokens: reply.inputTokens,
      outputTokens: reply.outputTokens,
      cachedTokens: reply.cachedTokens,
      costMicroUsd: cost,
      ms: Date.now() - started,
      model: reply.responseModel,
      generation: reply.generationId,
    });
    if (!read.ok)
      return {
        part: { status: "failed", state: read.state },
        cost,
        unconfirmed: routingProblems(prompt.routing, reply.routing).length > 0,
      };
    const reading = checkReading(run.translator, {
      passage: run.parts[at].text,
      items: read.items,
      sentence: read.sentence,
    });
    return { part: { status: "read", reading }, cost };
  } catch (error) {
    const failure = callError(error);
    const state: PartFailure =
      signal.aborted ||
      failure.kind === "AbortError" ||
      failure.kind === "TimeoutError"
        ? "timeout"
        : "failed";
    log({
      event: "part",
      state,
      ...counts,
      ms: Date.now() - started,
      error: failure.kind,
      ...(failure.status !== undefined ? { status: failure.status } : {}),
    });
    // Refused before any generation ran: it cost nothing, so its hold is
    // given back rather than kept as a worst case (S4). Only when the error
    // came before any output: one after it may follow a generation.
    const refusedBefore =
      failure.beforeContent &&
      failure.status !== undefined &&
      NO_GENERATION.has(failure.status);
    if (cost === undefined && refusedBefore) cost = 0;
    // Otherwise the text may have reached a provider whose routing was
    // never confirmed, so no more is sent.
    return {
      part: { status: "failed", state },
      cost,
      unconfirmed: !refusedBefore,
    };
  }
}
