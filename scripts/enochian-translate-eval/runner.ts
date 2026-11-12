import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import {
  type BarResult,
  checkBars,
} from "../../src/app/enochian/translate/bars.ts";
import type { AnswerItem, Task } from "./answer.ts";
import { type BarInputs, measureBars } from "./bars.ts";
import { a1Scores, markHard } from "./baseline.ts";
import { cipher } from "./cipher.ts";
import {
  applyVerdicts,
  EXPERT_QUEUE_HEAD,
  expertLines,
  foldVerdicts,
  JUDGE_NAMES,
  type JudgeCase,
  type JudgedRow,
  type JudgedRows,
  type JudgeName,
  judgeCase,
  judgeRequest,
  judgeRows,
  parseVerdicts,
  sameAnswer,
  type Verdict,
  type VerdictStore,
  verdictKey,
} from "./judge.ts";
import {
  type Calibration,
  costOf,
  EXPERIMENT_CAP_USD,
  type Ledger,
  type LedgerEntry,
  mayLaunch,
  NO_TOKENS,
  type PriceList,
  priceRow,
  projectCost,
  refusal,
  type Tokens,
  type TransportName,
  unreconciled,
  worstCost,
} from "./ledger.ts";
import { type Effort, type RequestKind, shortName } from "./models.ts";
import {
  type KeyProbe,
  probeKey,
  probeRequests,
  SIDES,
  type Side,
} from "./probe.ts";
import { type TranslateSpec, translateRequest } from "./prompt.ts";
import { parseAnswer } from "./reply.ts";
import {
  joinScores,
  type Report,
  report,
  type Scores,
  scoreFold,
  type Task1Outcome,
} from "./score.ts";
import type { Fold, KeyRowRecord } from "./testset.ts";
import {
  type BatchReference,
  type Gateway,
  type ModelRequest,
  type ModelResult,
  promptChars,
  promptHash,
  runSync,
  settingWarnings,
} from "./transport.ts";

/**
 * The model runner of plan 077: runs requests through a transport, keeps the
 * raw output outside the repository and every cost in the ledger, and scores
 * a run from what it saved.
 *
 * Layout under the output directory:
 *
 *     runs/ledger.jsonl            every call's tokens and cost, appended
 *     runs/<run>/manifest.json     what the run asked, request by request
 *     runs/<run>/prices.json       the gateway's prices the run used
 *     runs/<run>/requests/<id>.json  one reply each (text, usage, cost)
 *     runs/<run>/batches/<key>.json  a batch, saved before it is started
 *     runs/<run>/judge/…           the judges' requests, replies, attempts
 *     runs/<run>/judged.json       the judges' verdicts, by answer and row
 *     runs/<run>/scores.json, report.json
 *     runs/<run>/probe.json        a probe run's flags
 *     a1/judged.json               the verdicts on A1's to-judge rows
 *     expert-queue.tsv             rows the judges split on
 */

/** How many Keys the bars are defined over (plan 077, "Thresholds"). */
export const ALL_KEYS = 19;

// --- Files -----------------------------------------------------------------

export const runsDir = (out: string) => join(out, "runs");
export const ledgerPath = (out: string) => join(runsDir(out), "ledger.jsonl");
export const runDir = (out: string, run: string) => join(runsDir(out), run);
export const a1JudgedPath = (out: string) => join(out, "a1", "judged.json");
export const expertQueuePath = (out: string) => join(out, "expert-queue.tsv");

export function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJson<T>(path: string): T | undefined {
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as T)
    : undefined;
}

/** A run id: the time, to the second, a short label and a random suffix. */
export function newRunId(
  label: string,
  now = new Date(),
  suffix = randomBytes(2).toString("hex"),
): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "")
    .replace("T", "-");
  const tail = label.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return [stamp, tail, suffix].filter(Boolean).join("-");
}

/** Makes a new run's directory, refusing one that already exists. */
export function createRunDir(out: string, run: string): string {
  const dir = runDir(out, run);
  if (existsSync(dir)) throw new Error(`Run ${run} already exists in ${dir}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** A request as the manifest records it; the prompt itself is rebuilt. */
export interface ManifestRequest {
  id: string;
  kind: RequestKind;
  model: string;
  effort: Effort;
  promptHash: string;
  chars: number;
  translate?: TranslateSpec;
  probe?: { key: number; side: Side };
}

export interface Manifest {
  runId: string;
  kind: "translate" | "probe";
  createdAt: string;
  transport: TransportName;
  budget: number;
  /** The expected cost when the run started. */
  projection: number;
  /** The worst case when the run started. */
  worstCase?: number;
  requests: ManifestRequest[];
  /** The `--retry-failed` re-runs, in order. */
  retries?: {
    at: string;
    ids: string[];
    transport: TransportName;
    /** A `--resume` (requests never run) rather than a retry. */
    resume?: boolean;
  }[];
}

/** One reply as saved: no prompt and no reasoning text. */
export interface RawResult {
  id: string;
  promptHash: string;
  model: string;
  effort: Effort;
  transport: TransportName;
  ok: boolean;
  text: string;
  finishReason?: string;
  responseModel?: string;
  error?: string;
  /** The AI SDK's warnings for the call (or its batch). */
  warnings?: unknown[];
  generationId?: string;
  /** The batch it came back in. */
  batchId?: string;
  tokens: Tokens;
  cost: number;
  exact: boolean;
  /** Booked at its worst case: the call failed and its cost isn't known. */
  unknown?: boolean;
  attempt: number;
  at: string;
}

/**
 * A batch, saved before the gateway is asked to start it ("starting") and
 * again once it has ("started", with its reference). Its worst case stays
 * reserved against the cap until it is collected.
 */
export interface BatchRecord {
  state: "starting" | "started";
  /** Sent as `providerOptions.gateway.idempotencyKey`; the file's name. */
  idempotencyKey: string;
  reference?: BatchReference;
  model: string;
  requestIds: string[];
  /** Its worst case: every request at its input and its most output. */
  reservation: number;
  startedAt: string;
  /** The warnings the start returned. */
  warnings?: unknown[];
  /** Reasoning or effort warnings: every reply of the batch fails. */
  warningFailure?: string[];
  /** Set when results stopped partway; `collect` resumes. */
  partial?: boolean;
  collectedAt?: string;
  status?: string;
  error?: string;
}

export function manifestRequest(
  request: ModelRequest,
  extra: Pick<ManifestRequest, "translate" | "probe"> = {},
): ManifestRequest {
  return {
    id: request.id,
    kind: request.kind,
    model: request.model,
    effort: request.effort,
    promptHash: promptHash(request),
    chars: promptChars(request),
    ...extra,
  };
}

const rawPath = (dir: string, id: string) =>
  join(dir, "requests", `${id}.json`);

export function readRaw(dir: string, id: string): RawResult | undefined {
  return readJson<RawResult>(rawPath(dir, id));
}

/** The batches saved under a run's directory. */
function batchFiles(dir: string): string[] {
  const batches = join(dir, "batches");
  return existsSync(batches)
    ? readdirSync(batches)
        .filter((one) => one.endsWith(".json"))
        .map((one) => join(batches, one))
    : [];
}

/** Every batch saved under the output directory, with its file. */
function allBatches(out: string): { file: string; batch: BatchRecord }[] {
  const runs = runsDir(out);
  if (!existsSync(runs)) return [];
  const found: { file: string; batch: BatchRecord }[] = [];
  for (const run of readdirSync(runs, { withFileTypes: true }))
    if (run.isDirectory())
      for (const dir of [join(runs, run.name), join(runs, run.name, "judge")])
        for (const file of batchFiles(dir)) {
          const batch = readJson<BatchRecord>(file);
          if (batch) found.push({ file, batch });
        }
  return found;
}

/**
 * What batches not yet collected may cost, each at its worst case: spent as
 * far as the cap is concerned, since a batch can't be stopped once started
 * and its bill arrives only on collection. A batch whose results stopped
 * partway keeps its whole reservation too, so what it has already booked
 * is counted twice until it is collected: on the safe side.
 */
export function reserved(out: string): number {
  return allBatches(out)
    .filter(({ batch }) => !batch.collectedAt)
    .reduce((sum, { batch }) => sum + batch.reservation, 0);
}

// --- Running requests --------------------------------------------------------

/** What every command that calls a model shares. */
export interface Runtime {
  out: string;
  gateway: Gateway;
  prices: PriceList;
  ledger: Ledger;
  log: (text: string) => void;
  now?: () => Date;
  concurrency?: number;
  /** Loaded from the output directory when first needed. */
  calibration?: Calibration;
  /** A sync call's time limit; `CALL_TIMEOUT_MS` by default. */
  callTimeoutMs?: number;
}

/** How long a sync call may take before it is aborted (and failed). */
export const CALL_TIMEOUT_MS = 30 * 60 * 1000;

export const calibrationPath = (out: string) => join(out, "calibration.json");

/** The kind of prompt a request is, for calibration. */
export function promptKind(request: {
  kind: RequestKind;
  instructions?: readonly string[];
  translate?: TranslateSpec;
}): string {
  if (request.kind !== "translate") return request.kind;
  const a0 = request.translate
    ? request.translate.arm === "A0"
    : (request.instructions?.length ?? 0) <= 1;
  return a0 ? "translate-A0" : "translate";
}

function calibrationOf(runtime: Pick<Runtime, "out" | "calibration">) {
  runtime.calibration ??=
    readJson<Calibration>(calibrationPath(runtime.out)) ?? {};
  return runtime.calibration;
}

/**
 * Records a call's characters per input token for its kind of prompt,
 * keeping the smallest seen: projections use it from then on.
 */
function observe(
  runtime: Runtime,
  kind: string,
  chars: number,
  inputTokens: number,
) {
  if (!(inputTokens > 0) || !(chars > 0)) return;
  const calibration = calibrationOf(runtime);
  const ratio = chars / inputTokens;
  if (calibration[kind] !== undefined && calibration[kind] <= ratio) return;
  calibration[kind] = ratio;
  writeJson(calibrationPath(runtime.out), calibration);
}

/** Sync calls ask the gateway to cache; batch requests don't. */
const caching = (transport: TransportName) => transport === "sync";

const projectable = (request: ModelRequest, calibration: Calibration) => ({
  kind: request.kind,
  effort: request.effort,
  chars: promptChars(request),
  charsPerToken: calibration[promptKind(request)],
});

/** One request's worst case by a transport. */
export function worstOf(
  request: ModelRequest,
  prices: PriceList,
  transport: TransportName,
  calibration: Calibration = {},
): number {
  return worstCost(
    projectable(request, calibration),
    priceRow(prices, request.model, transport),
    caching(transport),
  );
}

/** Requests' expected cost by a transport. */
export function projection(
  requests: readonly ModelRequest[],
  prices: PriceList,
  transport: TransportName,
  calibration: Calibration = {},
): number {
  return requests.reduce(
    (sum, one) =>
      sum +
      projectCost(
        projectable(one, calibration),
        priceRow(prices, one.model, transport),
        caching(transport),
      ),
    0,
  );
}

/** Requests' worst case by a transport. */
export function worstCase(
  requests: readonly ModelRequest[],
  prices: PriceList,
  transport: TransportName,
  calibration: Calibration = {},
): number {
  return requests.reduce(
    (sum, one) => sum + worstOf(one, prices, transport, calibration),
    0,
  );
}

/** A runtime's figures for some requests, with its calibration. */
export function costs(
  runtime: Runtime,
  requests: readonly ModelRequest[],
  transport: TransportName,
) {
  const calibration = calibrationOf(runtime);
  return {
    expected: projection(requests, runtime.prices, transport, calibration),
    worst: worstCase(requests, runtime.prices, transport, calibration),
  };
}

/** Spent so far by the whole experiment, uncollected batches reserved. */
export function spentSoFar(runtime: Pick<Runtime, "ledger" | "out">): number {
  return runtime.ledger.total() + reserved(runtime.out);
}

/**
 * Why requests may not run, or `undefined` when they may. Batch: its worst
 * case must fit in the budget and, with what is spent and reserved, in the
 * cap, since a started batch can't be stopped. Sync: its expected cost must,
 * and so must the dearest single call's worst case, since each call in
 * flight is held at its worst (`mayLaunch`).
 */
export function runRefusal(
  runtime: Runtime,
  requests: readonly ModelRequest[],
  transport: TransportName,
  budget: number,
): string | undefined {
  const spent = spentSoFar(runtime);
  const calibration = calibrationOf(runtime);
  if (transport === "batch")
    return refusal({
      spent,
      projection: worstCase(requests, runtime.prices, "batch", calibration),
      budget,
      what: "worst case",
    });
  const expected = refusal({
    spent,
    projection: projection(requests, runtime.prices, "sync", calibration),
    budget,
    what: "expected",
  });
  if (expected) return expected;
  const dearest = Math.max(
    0,
    ...requests.map((one) => worstOf(one, runtime.prices, "sync", calibration)),
  );
  return refusal({
    spent,
    projection: dearest,
    budget,
    what: "one call's worst case",
  });
}

/**
 * Whether a saved reply failed: its call failed, or (in output saved before
 * this check) it didn't finish normally ("stop").
 */
export function failedRaw(raw: RawResult): boolean {
  return !raw.ok || raw.finishReason !== "stop";
}

/**
 * Which requests still need running: without `retry`, those with no reply
 * saved (skipped at the budget, or lost in a crash); with it, only those
 * that failed. A reply that came back normally but unreadable, or was cut
 * off at the length limit, is the model's failure and is never re-run. Requests in a batch not yet collected are
 * left alone either way.
 */
export function pendingRequests(
  dir: string,
  requests: readonly ModelRequest[],
  retry = false,
): ModelRequest[] {
  const inBatch = new Set(
    batchFiles(dir)
      .map((file) => readJson<BatchRecord>(file))
      .filter((one) => one && !one.collectedAt)
      .flatMap((one) => one?.requestIds ?? []),
  );
  return requests.filter((one) => {
    if (inBatch.has(one.id)) return false;
    const raw = readRaw(dir, one.id);
    // A reply cut off at the length limit is the model's failure: retrying
    // it would give the hardest prompts several tries.
    return retry
      ? raw !== undefined && failedRaw(raw) && raw.finishReason !== "length"
      : raw === undefined;
  });
}

interface Recorded {
  id: string;
  kind: RequestKind;
  model: string;
  effort: Effort;
  promptHash: string;
  /** The prompt's length, for calibration. */
  chars: number;
  /** Its kind of prompt, for calibration (`promptKind`). */
  promptKind: string;
  /** The request's worst case, for booking a call whose cost isn't known. */
  worst: number;
}

/**
 * A call's cost. A reply: the gateway's figure, else estimated from its
 * tokens; a batch reply with neither a figure nor any output tokens is booked
 * at its worst case, unknown. A failed call: the gateway's figure for its
 * generation if it can say; else, for sync, its worst case, unknown until
 * `spent --reconcile`; for a batch item, nothing (batch APIs bill replies).
 */
async function costFor(
  runtime: Runtime,
  request: Recorded,
  result: ModelResult,
  transport: TransportName,
): Promise<{ cost: number; exact: boolean; unknown?: boolean }> {
  const price = priceRow(runtime.prices, request.model, transport);
  if (result.ok) {
    const cost = costOf(result.gatewayCost, result.tokens, price);
    if (transport === "batch" && !cost.exact && result.tokens.output === 0)
      return { cost: request.worst, exact: false, unknown: true };
    return cost;
  }
  const looked = result.generationId
    ? await runtime.gateway.generationCost(result.generationId)
    : undefined;
  if (looked !== undefined) return { cost: looked, exact: true };
  if (transport === "batch") return { cost: 0, exact: false };
  return { cost: request.worst, exact: false, unknown: true };
}

/** A sync call's hold, settled when it is recorded. */
interface Hold {
  id: string;
  cost: number;
}

/**
 * Saves a reply and its ledger line (for a held call, the line settling the
 * hold); an earlier attempt is kept aside. A reply is saved as failed, its
 * text and real cost kept, when:
 * - it didn't finish normally (finish reason other than "stop": cut off at
 *   the length limit, filtered, …);
 * - a warning says a setting was ignored or unsupported (or the batch it
 *   came in started with one);
 * - it came in a batch and reports no reasoning tokens, though every request
 *   here asks for reasoning.
 */
async function record(
  runtime: Runtime,
  run: string,
  dir: string,
  request: Recorded,
  given: ModelResult,
  transport: TransportName,
  extra: { batch?: BatchRecord; hold?: Hold } = {},
): Promise<RawResult> {
  const { batch, hold } = extra;
  const result = { ...given };
  const problems: string[] = [];
  const warned = [
    ...settingWarnings(result.warnings),
    ...(batch?.warningFailure ?? []),
  ];
  if (warned.length)
    problems.push(`settings not applied as asked: ${warned.join("; ")}`);
  if (given.ok && given.finishReason !== "stop")
    problems.push(`finish reason "${given.finishReason ?? "none"}"`);
  if (given.ok && transport === "batch" && given.tokens.reasoning === 0)
    problems.push(`no reasoning tokens at effort ${request.effort}`);
  if (given.ok && problems.length) {
    result.ok = false;
    result.error = problems.join("; ");
  }
  // A reply that came back is costed as one, failed or not.
  const { cost, exact, unknown } = await costFor(
    runtime,
    request,
    given,
    transport,
  );
  const path = rawPath(dir, request.id);
  const earlier = readJson<RawResult>(path);
  const attempt = (earlier?.attempt ?? 0) + 1;
  if (earlier)
    renameSync(
      path,
      join(dir, "requests", `${request.id}.attempt-${earlier.attempt}.json`),
    );
  const at = (runtime.now?.() ?? new Date()).toISOString();
  const raw: RawResult = {
    id: request.id,
    promptHash: request.promptHash,
    model: request.model,
    effort: request.effort,
    transport,
    ok: result.ok,
    text: result.text,
    tokens: result.tokens,
    cost,
    exact,
    attempt,
    at,
  };
  if (unknown) raw.unknown = true;
  if (result.finishReason) raw.finishReason = result.finishReason;
  if (result.responseModel) raw.responseModel = result.responseModel;
  if (result.error) raw.error = result.error;
  if (result.generationId) raw.generationId = result.generationId;
  if (result.warnings?.length) raw.warnings = result.warnings;
  if (batch?.reference) raw.batchId = batch.reference.id;
  writeJson(path, raw);
  observe(runtime, request.promptKind, request.chars, given.tokens.input);
  runtime.ledger.append({
    id: randomUUID(),
    at,
    run,
    request: request.id,
    model: request.model,
    transport,
    tokens: result.tokens,
    cost: hold ? cost - hold.cost : cost,
    ...(hold ? { settles: hold.id, actual: cost } : {}),
    exact,
    ...(unknown ? { unknown: true } : {}),
    ...(result.generationId ? { generationId: result.generationId } : {}),
    ...(result.ok ? {} : { failed: true }),
    ...(attempt > 1 ? { retry: attempt } : {}),
  });
  return raw;
}

const recorded = (request: ModelRequest, worst: number): Recorded => ({
  id: request.id,
  kind: request.kind,
  model: request.model,
  effort: request.effort,
  promptHash: promptHash(request),
  chars: promptChars(request),
  promptKind: promptKind(request),
  worst,
});

export interface ExecuteOptions {
  /** The ledger's run id. */
  run: string;
  /** Where replies and batches are saved. */
  dir: string;
  requests: readonly ModelRequest[];
  transport: TransportName;
  budget: number;
}

/**
 * Runs requests once the budget check (`runRefusal`) passes. Batch starts
 * one batch per model, saving it first (`startBatches`).
 *
 * Sync launches a call only while this run's spending, its calls in flight
 * at their worst case and the next call's worst case fit in the budget and
 * the cap. Before each launch it books that worst case in the ledger as a
 * hold, which the call's own line settles; a crash or Ctrl-C leaves it
 * booked until `spent --reconcile`. It stops launching on Ctrl-C (a second
 * one quits), and when a call costs more than its hold (the projection is
 * wrong, so the budget check can't be trusted). Each call has a time limit.
 */
export async function execute(
  runtime: Runtime,
  options: ExecuteOptions,
): Promise<{ skipped: string[]; batches: BatchRecord[]; stopped?: string }> {
  const { requests, transport, budget, dir, run } = options;
  const refused = runRefusal(runtime, requests, transport, budget);
  if (refused) throw new Error(`Refused: ${refused}`);
  if (!requests.length) return { skipped: [], batches: [] };
  if (transport === "batch")
    return {
      skipped: [],
      batches: await startBatches(runtime, run, dir, requests),
    };
  const calibration = calibrationOf(runtime);
  const spentBefore = spentSoFar(runtime);
  let spentThisRun = 0;
  let inFlight = 0;
  let stopped: string | undefined;
  const worst = new Map(
    requests.map((one) => [
      one.id,
      worstOf(one, runtime.prices, "sync", calibration),
    ]),
  );
  const holds = new Map<string, Hold>();
  const now = () => (runtime.now?.() ?? new Date()).toISOString();
  let interrupts = 0;
  const onInterrupt = () => {
    interrupts++;
    if (interrupts > 1) {
      runtime.log(
        "Second Ctrl-C: quitting. Calls in flight stay booked at their worst case until `spent --reconcile`.",
      );
      process.exit(130);
    }
    stopped = "Ctrl-C";
    runtime.log(
      "Ctrl-C: no new calls; waiting for those in flight (Ctrl-C again to quit).",
    );
  };
  process.on("SIGINT", onInterrupt);
  try {
    const { skipped } = await runSync(requests, {
      gateway: runtime.gateway,
      concurrency: runtime.concurrency,
      reserve: (request) => {
        const next = worst.get(request.id) ?? 0;
        if (stopped) return false;
        if (!mayLaunch({ spentBefore, spentThisRun, inFlight, next, budget }))
          return false;
        inFlight += next;
        const hold = { id: randomUUID(), cost: next };
        holds.set(request.id, hold);
        runtime.ledger.append({
          id: hold.id,
          at: now(),
          run,
          request: request.id,
          model: request.model,
          transport: "sync",
          tokens: { ...NO_TOKENS },
          cost: next,
          exact: false,
          unknown: true,
          hold: true,
        });
        return true;
      },
      hooks: (request) => ({
        signal: AbortSignal.timeout(runtime.callTimeoutMs ?? CALL_TIMEOUT_MS),
        onGenerationId: (generationId) => {
          const hold = holds.get(request.id);
          if (hold)
            runtime.ledger.append({
              id: randomUUID(),
              at: now(),
              run,
              request: request.id,
              model: request.model,
              transport: "sync",
              tokens: { ...NO_TOKENS },
              cost: 0,
              exact: false,
              holdFor: hold.id,
              generationId,
            });
        },
      }),
      onResult: async (result, request) => {
        const hold = holds.get(request.id) as Hold;
        const raw = await record(
          runtime,
          run,
          dir,
          recorded(request, hold.cost),
          result,
          "sync",
          { hold },
        );
        inFlight -= hold.cost;
        spentThisRun += raw.cost;
        const how = raw.exact ? "" : raw.unknown ? "unknown, booked at " : "~";
        runtime.log(
          `${request.id}: ${raw.ok ? "ok" : `FAILED ${raw.error}`} ${how}$${raw.cost.toFixed(4)} (run $${spentThisRun.toFixed(2)})`,
        );
        if (raw.cost > hold.cost + 1e-9 && !stopped) {
          stopped = `${request.id} cost $${raw.cost.toFixed(4)}, more than its worst case $${hold.cost.toFixed(4)}: the projection is off, so no more calls are launched. Check the prices and calibration before going on.`;
          runtime.log(`STOPPING: ${stopped}`);
        }
      },
    });
    if (skipped.length)
      runtime.log(
        `${stopped ? `Stopped (${stopped.split(":")[0]})` : "Stopped at the budget"}: ${skipped.length} requests not run (${skipped.join(", ")}). \`run --resume\` runs them later.`,
      );
    return { skipped, batches: [], ...(stopped ? { stopped } : {}) };
  } finally {
    process.off("SIGINT", onInterrupt);
  }
}

/**
 * A batch's idempotency key: the run, the model, its requests and the
 * attempt (a retry by batch is a new batch, so a new key).
 */
export function batchKey(
  run: string,
  model: string,
  ids: readonly string[],
  attempt = 1,
): string {
  return createHash("sha256")
    .update(`${run}\n${model}\n${[...ids].sort().join("\n")}\n${attempt}`)
    .digest("hex")
    .slice(0, 32);
}

const batchPath = (dir: string, key: string) =>
  join(dir, "batches", `${key}.json`);

/**
 * Starts (or resumes starting) one batch per model. Each is saved as
 * "starting", with its idempotency key and worst-case reservation, before
 * the gateway is asked; once it answers, the reference is saved. A batch
 * found "starting" (the earlier start never confirmed) is started again
 * with the same key, so the gateway replays it rather than starting a
 * second one. The key counts the attempt: the requests' saved attempts plus
 * one, so a retry of failed requests by batch gets a key of its own.
 */
export async function startBatches(
  runtime: Runtime,
  run: string,
  dir: string,
  requests: readonly ModelRequest[],
): Promise<BatchRecord[]> {
  const out: BatchRecord[] = [];
  const calibration = calibrationOf(runtime);
  for (const model of new Set(requests.map((one) => one.model))) {
    const group = requests.filter((one) => one.model === model);
    const attempt =
      1 +
      Math.max(0, ...group.map((one) => readRaw(dir, one.id)?.attempt ?? 0));
    const key = batchKey(
      run,
      model,
      group.map((one) => one.id),
      attempt,
    );
    const path = batchPath(dir, key);
    let batch = readJson<BatchRecord>(path);
    if (batch?.state === "started") {
      runtime.log(`Batch ${batch.reference?.id} already started; skipped`);
      out.push(batch);
      continue;
    }
    if (batch)
      runtime.log(
        `A start of this batch was begun before and never confirmed: starting again with the same idempotency key ${key}, so the gateway replays it`,
      );
    batch ??= {
      state: "starting",
      idempotencyKey: key,
      model,
      requestIds: group.map((one) => one.id),
      reservation: worstCase(group, runtime.prices, "batch", calibration),
      startedAt: (runtime.now?.() ?? new Date()).toISOString(),
    };
    writeJson(path, batch);
    const started = await runtime.gateway.startBatch(group, key);
    batch.state = "started";
    batch.reference = started.reference;
    if (started.warnings.length) batch.warnings = started.warnings;
    const warned = settingWarnings(started.warnings);
    if (warned.length) {
      batch.warningFailure = warned;
      runtime.log(
        `Batch ${started.reference.id} started with warnings that a setting was ignored or unsupported; every reply will be recorded as failed: ${warned.join("; ")}`,
      );
    }
    writeJson(path, batch);
    out.push(batch);
    runtime.log(
      `Started batch ${started.reference.id}: ${group.length} requests of ${model}, worst case $${batch.reservation.toFixed(2)} reserved`,
    );
  }
  return out;
}

/**
 * Finishes a run's batches. One still "starting" is started again with its
 * key (with `rebuild` to remake its requests). One pending is reported and
 * left. One done has its replies saved and costed (the gateway's figure,
 * else estimated at the batch price); if the results stop partway, what came
 * is kept, the batch stays uncollected and reserved, and the next `collect`
 * goes on from there. A request the finished batch returned nothing for is
 * saved as failed. Returns whether every batch is collected. (Batch items
 * carry no warnings of their own in this AI SDK; the batch's are checked.)
 */
export async function collect(
  runtime: Runtime,
  run: string,
  dir: string,
  requests: readonly ManifestRequest[],
  rebuild?: (ids: readonly string[]) => ModelRequest[],
): Promise<boolean> {
  const calibration = calibrationOf(runtime);
  const byId = new Map(requests.map((one) => [one.id, one]));
  const worstOfEntry = (one: ManifestRequest) =>
    worstCost(
      {
        kind: one.kind,
        effort: one.effort,
        chars: one.chars,
        charsPerToken: calibration[promptKind(one)],
      },
      priceRow(runtime.prices, one.model, "batch"),
      false,
    );
  let done = true;
  for (const file of batchFiles(dir)) {
    let batch = readJson<BatchRecord>(file);
    if (!batch || batch.collectedAt) continue;
    if (batch.state === "starting") {
      if (!rebuild) throw new Error(`Batch ${file} never confirmed its start`);
      [batch] = await startBatches(
        runtime,
        run,
        dir,
        rebuild(batch.requestIds),
      );
    }
    const current = batch;
    const reference = current.reference as BatchReference;
    const status = await runtime.gateway.batchStatus(reference);
    if (status.status === "pending") {
      done = false;
      const c = status.counts;
      runtime.log(
        `Batch ${reference.id} pending${c ? `: ${c.completed} of ${c.total} done, ${c.failed} failed` : ""}`,
      );
      continue;
    }
    const seen = new Set(
      current.requestIds.filter(
        (id) => readRaw(dir, id)?.batchId === reference.id,
      ),
    );
    const save = async (result: ModelResult) => {
      const request = byId.get(result.id);
      if (!request || seen.has(result.id)) return;
      seen.add(result.id);
      await record(
        runtime,
        run,
        dir,
        {
          ...request,
          promptKind: promptKind(request),
          worst: worstOfEntry(request),
        },
        result,
        "batch",
        { batch: current },
      );
    };
    try {
      for await (const result of runtime.gateway.batchResults(reference))
        await save(result);
    } catch (error) {
      done = false;
      current.partial = true;
      current.error = (error as Error).message;
      writeJson(file, current);
      runtime.log(
        `Batch ${reference.id}: results stopped partway (${current.error}); ${seen.size} of ${current.requestIds.length} saved. Run collect again to go on.`,
      );
      continue;
    }
    for (const id of current.requestIds)
      if (!seen.has(id))
        await save({
          id,
          ok: false,
          text: "",
          tokens: { ...NO_TOKENS },
          error: `no result in batch (${status.status}${status.error ? `: ${status.error}` : ""})`,
        });
    current.status = status.status;
    current.partial = false;
    if (status.error) current.error = status.error;
    current.collectedAt = (runtime.now?.() ?? new Date()).toISOString();
    writeJson(file, current);
    runtime.log(
      `Collected batch ${reference.id} (${status.status}): ${seen.size} replies`,
    );
  }
  return done;
}

/**
 * Looks up the real cost of calls booked at their worst case (failed calls,
 * and holds a crash or Ctrl-C left unsettled) by generation id, and appends
 * a correction for each one found; the ledger is never rewritten. Returns
 * what it corrected and what it couldn't.
 */
export async function reconcile(runtime: Runtime) {
  const open = unreconciled(runtime.ledger.entries());
  let fixed = 0;
  let change = 0;
  const left: string[] = [];
  for (const entry of open) {
    const cost = entry.lookup
      ? await runtime.gateway.generationCost(entry.lookup)
      : undefined;
    if (cost === undefined) {
      left.push(`${entry.run}/${entry.request}`);
      continue;
    }
    runtime.ledger.append({
      id: randomUUID(),
      at: (runtime.now?.() ?? new Date()).toISOString(),
      run: entry.run,
      request: entry.request,
      model: entry.model,
      transport: entry.transport,
      tokens: { ...NO_TOKENS },
      cost: cost - entry.booked,
      exact: true,
      reconciles: entry.id,
    });
    fixed++;
    change += cost - entry.booked;
  }
  return { fixed, change, left };
}

/** What a run's failed attempts are booked at, for `--retry-failed`. */
export function failedBooking(
  ledger: Ledger,
  run: string,
  ids: readonly string[],
) {
  const wanted = new Set(ids);
  const entries = ledger.entries();
  const holds = new Map(
    entries.filter((one) => one.hold).map((one) => [one.id, one.cost]),
  );
  const open = new Set(unreconciled(entries).map((one) => one.id));
  const failed = entries.filter(
    (one) => one.run === run && one.failed && wanted.has(one.request),
  );
  const booked = (one: LedgerEntry) =>
    one.cost + (one.settles ? (holds.get(one.settles) ?? 0) : 0);
  return {
    attempts: failed.length,
    cost: failed.reduce((sum, one) => sum + booked(one), 0),
    unknown: failed
      .filter((one) => open.has(one.id))
      .reduce((sum, one) => sum + booked(one), 0),
  };
}

// --- Scoring a run -----------------------------------------------------------

/** The data scoring needs: folds already marked with A1's outcomes. */
export interface EvalData {
  dictionary: EnochianDictionary;
  rows: KeyRowRecord[];
  grammar: string;
  folds: Fold[];
}

/** A1's judged outcomes by row id, for `markHard`. */
export function a1Verdicts(out: string): Map<string, Task1Outcome> {
  const judged = readJson<JudgedRows>(a1JudgedPath(out)) ?? {};
  return new Map(
    Object.entries(judged)
      .filter(([, one]) => one.outcome)
      .map(([id, one]) => [id, one.outcome as Task1Outcome]),
  );
}

/** Marks the folds' hard rows, with A1's verdicts where judged. */
export function markFolds(
  folds: Fold[],
  dictionary: EnochianDictionary,
  out: string,
) {
  markHard(folds, dictionary, a1Verdicts(out));
  return folds;
}

/** One translation request, scored. */
export interface ScoredRequest {
  id: string;
  spec: TranslateSpec;
  /** Why it has no items: the call failed, or the reply was unreadable. */
  failure?: string;
  /** Minor slips in the reply that were mended (`mendAnswer`). */
  coercions?: number;
  scores: Scores;
}

/** The arm, task, book, model and effort a request's scores pool under. */
export function groupName(spec: TranslateSpec): string {
  const book = spec.arm === "A0" ? "" : ` ${spec.book}`;
  return `${spec.arm} task ${spec.task}${book} ${shortName(spec.model)} ${spec.effort}`;
}

/**
 * Scores every translation request of a run from its saved replies, the
 * judges' verdicts folded in. A failed call or unreadable reply scores every
 * row "missing"; a request never run (stopped at the budget, or a batch not
 * yet collected) is left out and listed.
 */
export function scoreRequests(
  manifest: Manifest,
  dir: string,
  data: EvalData,
): { scored: ScoredRequest[]; notRun: string[] } {
  const judged =
    readJson<Record<string, JudgedRows>>(join(dir, "judged.json")) ?? {};
  const folds = new Map(data.folds.map((fold) => [fold.key, fold]));
  const scored: ScoredRequest[] = [];
  const notRun: string[] = [];
  for (const request of manifest.requests) {
    const spec = request.translate;
    if (!spec) continue;
    const fold = folds.get(spec.key);
    if (!fold) throw new Error(`No fold for Key ${spec.key}`);
    const raw = readRaw(dir, request.id);
    if (!raw) {
      notRun.push(request.id);
      continue;
    }
    const failed = failedRaw(raw);
    let failure: string | undefined = failed
      ? `call failed: ${raw.error ?? `finish reason "${raw.finishReason ?? "none"}"`}`
      : undefined;
    let items: AnswerItem[] = [];
    let coercions = 0;
    if (!failed) {
      const parsed = parseAnswer(raw.text);
      if (parsed.ok) {
        items = parsed.value;
        coercions = parsed.coercions ?? 0;
      } else failure = `reply unreadable: ${parsed.error}`;
    }
    const scores = scoreFold(fold, items, {
      task: spec.task,
      book: spec.book,
      dictionary: data.dictionary,
      ...(spec.arm === "A2c" ? { cipher } : {}),
      ...(spec.arm === "A0" ? { emptyContext: true } : {}),
      flagAlternatives: true,
    });
    if (spec.task === 1) applyVerdicts(scores, judged[request.id]);
    const one: ScoredRequest = { id: request.id, spec, scores };
    if (failure) one.failure = failure;
    if (coercions) one.coercions = coercions;
    scored.push(one);
  }
  return { scored, notRun };
}

/** One pooled group of a run: its requests' scores joined, and the report. */
export interface Group {
  name: string;
  spec: Omit<TranslateSpec, "key">;
  keys: number[];
  scores: Scores;
  report: Report;
}

export function groups(scored: readonly ScoredRequest[]): Group[] {
  const by = new Map<string, ScoredRequest[]>();
  for (const one of scored) {
    const name = groupName(one.spec);
    by.set(name, [...(by.get(name) ?? []), one]);
  }
  return [...by].map(([name, list]) => {
    const { key: _key, ...spec } = list[0].spec;
    const scores = joinScores(list.map((one) => one.scores));
    return {
      name,
      spec,
      keys: list.map((one) => one.spec.key).sort((a, b) => a - b),
      scores,
      report: report(scores, spec.book),
    };
  });
}

/** A probe run's flags: the Keys it probed and those it flagged. */
export interface ProbeFlags {
  run: string;
  model: string;
  probed: Set<number>;
  flagged: Set<number>;
}

export interface ProbeFile {
  runId: string;
  model: string;
  effort: Effort;
  keys: Record<string, KeyProbe>;
  flagged: number[];
}

/** Whether a probe says something about every Key: flagged or clear. */
function covers(file: ProbeFile, keys: readonly number[]): boolean {
  const flagged = new Set(file.flagged);
  return keys.every(
    (key) =>
      flagged.has(key) ||
      (file.keys[String(key)] !== undefined &&
        !file.keys[String(key)].incomplete),
  );
}

/**
 * The flags of a probe run of the given model: the named run (which must be
 * of that model), else the latest such run that covers every Key in `need`
 * (says of each whether it is flagged or clear; a newer probe that doesn't
 * is passed over for an older one that does), else `undefined`.
 */
export function loadProbeFlags(
  out: string,
  model: string,
  run?: string,
  need: readonly number[] = [],
): ProbeFlags | undefined {
  const read = (name: string) =>
    readJson<ProbeFile>(join(runDir(out, name), "probe.json"));
  let chosen: { name: string; file: ProbeFile } | undefined;
  if (run) {
    const file = read(run);
    if (!file) throw new Error(`No probe.json in run ${run}`);
    if (file.model !== model)
      throw new Error(
        `Probe run ${run} is of ${file.model}, not ${model}: its flags don't apply`,
      );
    chosen = { name: run, file };
  } else {
    const runs = runsDir(out);
    if (!existsSync(runs)) return undefined;
    for (const name of readdirSync(runs).sort().reverse()) {
      const file = read(name);
      if (file?.model === model && covers(file, need)) {
        chosen = { name, file };
        break;
      }
    }
  }
  if (!chosen) return undefined;
  const probed = new Set(
    Object.entries(chosen.file.keys)
      .filter(([, one]) => !one.incomplete)
      .map(([key]) => Number(key)),
  );
  return {
    run: chosen.name,
    model,
    probed,
    flagged: new Set(chosen.file.flagged),
  };
}

/** Scores narrowed to some Keys. */
function onlyKeys(scores: Scores, keep: (key: number) => boolean): Scores {
  return {
    rows: scores.rows.filter((one) => keep(one.key)),
    items: scores.items.filter((one) => keep(one.key)),
  };
}

/**
 * The bars measurable from a run, per model and effort: A3 open book for
 * tasks 1 and 2, and A2 against A2c on the Keys a probe of the same model
 * has cleared. A bar defined over all 19 Keys is unmeasurable on a run with
 * fewer (its figure is still in the run's report), and so is the memory bar
 * without a probe of the model. One whose inputs refuse (rows still waiting
 * for the judges) says why.
 */
export interface RunBars {
  model: string;
  effort: Effort;
  results?: BarResult[];
  /** Why the bars couldn't be measured (rows still waiting for judges). */
  error?: string;
}

export function runBars(
  all: readonly Group[],
  flagsFor: (model: string, need: readonly number[]) => ProbeFlags | undefined,
): RunBars[] {
  const out: RunBars[] = [];
  const pairs = new Set(
    all.map((one) => `${one.spec.model}|${one.spec.effort}`),
  );
  for (const pair of pairs) {
    const [model, effort] = pair.split("|") as [string, Effort];
    const find = (arm: string, task: Task) =>
      all.find(
        (one) =>
          one.spec.model === model &&
          one.spec.effort === effort &&
          one.spec.arm === arm &&
          one.spec.task === task &&
          one.spec.book === "open",
      );
    const inputs: BarInputs = {};
    const a3t1 = find("A3", 1);
    const a3t2 = find("A3", 2);
    if (a3t1) inputs.a3Task1 = a3t1.report;
    if (a3t2) inputs.a3Task2 = a3t2.report;
    const a2 = find("A2", 1);
    const a2c = find("A2c", 1);
    const need = [...new Set([...(a2?.keys ?? []), ...(a2c?.keys ?? [])])];
    const flags = a2 && a2c ? flagsFor(model, need) : undefined;
    // The memory bar is over every Key the probe clears: A2 and A2c must
    // both have run on all of them.
    const cleared = flags
      ? [...flags.probed].filter((key) => !flags.flagged.has(key))
      : [];
    const missing =
      a2 && a2c
        ? cleared.filter(
            (key) => !a2.keys.includes(key) || !a2c.keys.includes(key),
          )
        : [];
    if (a2 && a2c && flags && !missing.length) {
      const clear = (key: number) => cleared.includes(key);
      inputs.a2Unflagged = report(onlyKeys(a2.scores, clear), "open");
      inputs.a2cUnflagged = report(onlyKeys(a2c.scores, clear), "open");
    }
    if (!Object.keys(inputs).length && !(a2 && a2c)) continue;
    try {
      const measured = measureBars(inputs);
      const short = (group: Group | undefined) =>
        group && group.keys.length < ALL_KEYS
          ? {
              unmeasurable: `run has ${group.keys.length} of ${ALL_KEYS} Keys`,
            }
          : undefined;
      for (const [bar, group] of [
        ["toEnglish", a3t1],
        ["toEnglishHard", a3t1],
        ["toEnochian", a3t2],
      ] as const) {
        const why = short(group);
        if (why) measured[bar] = why;
      }
      if (a2 && a2c && !flags)
        measured.notMemory = {
          unmeasurable: `no recall probe of ${shortName(model)} covering Keys ${need.join(",")} to tell which it recites`,
        };
      else if (missing.length)
        measured.notMemory = {
          unmeasurable: `A2 and A2c must cover every Key the probe clears; missing ${missing.join(",")}`,
        };
      out.push({ model, effort, results: checkBars(measured) });
    } catch (error) {
      out.push({ model, effort, error: (error as Error).message });
    }
  }
  return out;
}

/** Scores a run and writes its scores and report beside its replies. */
export function scoreRun(out: string, run: string, data: EvalData) {
  const dir = runDir(out, run);
  const manifest = readJson<Manifest>(join(dir, "manifest.json"));
  if (!manifest) throw new Error(`No run ${run} in ${runsDir(out)}`);
  const { scored, notRun } = scoreRequests(manifest, dir, data);
  const pooled = groups(scored);
  writeJson(join(dir, "scores.json"), {
    run,
    requests: scored.map((one) => ({
      id: one.id,
      spec: one.spec,
      failure: one.failure,
      coercions: one.coercions ?? 0,
      rows: one.scores.rows.map((row) => ({
        id: row.id,
        outcome: row.outcome,
        basis: row.basis,
        a1: row.a1,
        answer: row.answer,
      })),
      items: one.scores.items,
    })),
    notRun,
  });
  writeJson(join(dir, "report.json"), {
    run,
    groups: Object.fromEntries(
      pooled.map((one) => [one.name, { keys: one.keys, ...one.report }]),
    ),
    failures: scored
      .filter((one) => one.failure)
      .map((one) => ({ id: one.id, failure: one.failure })),
    coercions: scored
      .filter((one) => one.coercions)
      .map((one) => ({ id: one.id, coercions: one.coercions })),
    notRun,
  });
  return { manifest, scored, notRun, groups: pooled };
}

// --- The judges ----------------------------------------------------------------

/** One request put to a judge for some rows of a case. */
export interface JudgeAttempt {
  id: string;
  rows: string[];
  promptHash: string;
}

/** Every judge request made, by answer and judge, oldest first. */
export type AttemptLog = Record<
  string,
  Partial<Record<JudgeName, JudgeAttempt[]>>
>;

/** Verdicts already given for a case's rows, by judge, for its answers. */
function knownVerdicts(
  item: JudgeCase,
  judged: JudgedRows | undefined,
): Record<JudgeName, Map<string, Verdict>> {
  const out = Object.fromEntries(
    JUDGE_NAMES.map((name) => [name, new Map<string, Verdict>()]),
  ) as Record<JudgeName, Map<string, Verdict>>;
  for (const { row, answer } of item.rows) {
    const one = judged?.[row];
    if (!one || !sameAnswer(one, answer)) continue;
    for (const name of JUDGE_NAMES) {
      const verdict = one[name];
      if (verdict) out[name].set(row, verdict);
    }
  }
  return out;
}

export interface JudgeOptions {
  run: string;
  /** Where the judges' replies and their attempt log go. */
  dir: string;
  cases: readonly JudgeCase[];
  /** The verdicts saved so far, by answer. */
  existing: Record<string, JudgedRows>;
  budget: number;
  dryRun?: boolean;
  /** Re-run judge calls that failed outright (no reply). */
  retry?: boolean;
  /** What the expert queue names as the source ("A1", or the run id). */
  source: string;
}

export const verdictStorePath = (out: string) => join(out, "verdicts.json");

/**
 * Fills `judged` from the verdict store: a row whose translation (as
 * `verdictKey` normalises it) some judge has already ruled on, in any run or
 * in A1, takes that ruling. Returns how many rows got both rulings so.
 */
function fromStore(
  store: VerdictStore,
  cases: readonly JudgeCase[],
  judged: Record<string, JudgedRows>,
): number {
  let reused = 0;
  for (const item of cases)
    for (const row of item.rows) {
      const saved = store[verdictKey(row)];
      if (!saved) continue;
      const before = judged[item.answer]?.[row.row];
      const merged: JudgedRow =
        before && sameAnswer(before, row.answer)
          ? { ...before, answer: row.answer }
          : { answer: row.answer };
      let took = false;
      for (const judge of JUDGE_NAMES) {
        const verdict = saved[judge];
        if (!merged[judge] && verdict) {
          merged[judge] = verdict;
          took = true;
        }
      }
      const outcome = foldVerdicts(merged.opus, merged.gpt);
      if (outcome) merged.outcome = outcome;
      if (merged.opus?.supported === false && merged.gpt?.supported === false)
        merged.unsupported = true;
      if (took && merged.opus && merged.gpt) reused++;
      judged[item.answer] = { ...judged[item.answer], [row.row]: merged };
    }
  return reused;
}

/** Saves every ruling on the cases' rows into the verdict store. */
function toStore(
  store: VerdictStore,
  cases: readonly JudgeCase[],
  judged: Record<string, JudgedRows>,
) {
  for (const item of cases)
    for (const row of item.rows) {
      const one = judged[item.answer]?.[row.row];
      if (!one || !sameAnswer(one, row.answer)) continue;
      const key = verdictKey(row);
      for (const judge of JUDGE_NAMES) {
        const verdict = one[judge];
        if (verdict) store[key] = { ...store[key], [judge]: verdict };
      }
    }
}

/** A planned judge request and the attempt it is. */
interface PlannedJudge {
  item: JudgeCase;
  judge: JudgeName;
  request: ModelRequest;
  attempt: JudgeAttempt;
  /** It reuses an attempt already logged (not run yet, or failed). */
  again: boolean;
}

/**
 * The judge requests a round needs: for each case and judge, the rows that
 * judge hasn't ruled on. A first request goes under the plain id. One whose
 * reply came back but left rows out (or couldn't be read) is followed by a
 * new request for just those rows (`…-retry-N`); so is one whose rows have
 * changed since. One never run is run as it was; one whose call failed is
 * re-run only with `retry`.
 */
function planJudges(
  options: JudgeOptions,
  judged: Record<string, JudgedRows>,
  log: AttemptLog,
): { planned: PlannedJudge[]; failed: string[] } {
  const planned: PlannedJudge[] = [];
  const failed: string[] = [];
  for (const item of options.cases) {
    const known = knownVerdicts(item, judged[item.answer]);
    for (const judge of JUDGE_NAMES) {
      const missing = item.rows.filter((one) => !known[judge].has(one.row));
      if (!missing.length) continue;
      const sub: JudgeCase = { ...item, rows: missing };
      const attempts = log[item.answer]?.[judge] ?? [];
      const last = attempts.at(-1);
      const base = `${item.answer}_judge-${judge}`;
      const fresh = (id: string) => {
        const request = judgeRequest(sub, judge, id);
        return {
          item: sub,
          judge,
          request,
          attempt: {
            id,
            rows: missing.map((one) => one.row),
            promptHash: promptHash(request),
          },
          again: false,
        };
      };
      if (!last) {
        planned.push(fresh(base));
        continue;
      }
      const same = judgeRequest(sub, judge, last.id);
      const raw = readRaw(options.dir, last.id);
      if (promptHash(same) === last.promptHash && (!raw || failedRaw(raw))) {
        if (raw && !options.retry) {
          failed.push(last.id);
          continue;
        }
        planned.push({
          item: sub,
          judge,
          request: same,
          attempt: last,
          again: true,
        });
        continue;
      }
      planned.push(fresh(`${base}-retry-${attempts.length}`));
    }
  }
  return { planned, failed };
}

/**
 * Puts each case to both judges, then folds what they said into the saved
 * verdicts and queues the split rows for an expert. Verdicts are taken only
 * from a reply whose saved prompt hash is the one its attempt was logged
 * with, and only for that attempt's rows. Rows a reply left out (or all of
 * them, if it couldn't be read) are asked again once, under a new id, in the
 * same command, within what is left of the budget. A row without both
 * verdicts stays "to judge". Returns the verdicts, by answer.
 */
export async function runJudges(
  runtime: Runtime,
  options: JudgeOptions,
): Promise<{
  judged: Record<string, JudgedRows>;
  requests: number;
  projected: number;
  worst: number;
  failed: string[];
  /** Why the first round may not run, if it may not. */
  refused?: string;
  /** Rows both of whose rulings came from the verdict store. */
  reused: number;
}> {
  const logPath = join(options.dir, "attempts.json");
  const log = readJson<AttemptLog>(logPath) ?? {};
  const judged = { ...options.existing };
  const storePath = verdictStorePath(runtime.out);
  const store = readJson<VerdictStore>(storePath) ?? {};
  const reused = fromStore(store, options.cases, judged);
  const first = planJudges(options, judged, log);
  const firstRequests = first.planned.map((one) => one.request);
  const firstCosts = costs(runtime, firstRequests, "sync");
  const summary = {
    requests: firstRequests.length,
    projected: firstCosts.expected,
    worst: firstCosts.worst,
    failed: first.failed,
    refused: runRefusal(runtime, firstRequests, "sync", options.budget),
    reused,
  };
  if (options.dryRun) return { judged, ...summary };
  let left = options.budget;
  let planned = first.planned;
  for (let round = 0; round < 2 && planned.length; round++) {
    if (round > 0)
      runtime.log(
        `Asking again for rows the judges left out: ${planned.map((one) => one.request.id).join(", ")}`,
      );
    for (const one of planned.filter((p) => !p.again)) {
      const byJudge = (log[one.item.answer] ??= {});
      (byJudge[one.judge] ??= []).push(one.attempt);
    }
    writeJson(logPath, log);
    const before = runtime.ledger.total();
    try {
      await execute(runtime, {
        run: options.run,
        dir: options.dir,
        requests: planned.map((one) => one.request),
        transport: "sync",
        budget: left,
      });
    } catch (error) {
      if (round === 0) throw error;
      runtime.log(`Not asking again: ${(error as Error).message}`);
      break;
    }
    left -= runtime.ledger.total() - before;
    foldJudged(runtime, options, judged, log);
    // Only the rows a reply left out are asked again; failed calls wait
    // for --retry-failed.
    planned = planJudges(
      { ...options, retry: false },
      judged,
      log,
    ).planned.filter((one) => !one.again);
  }
  toStore(store, options.cases, judged);
  writeJson(storePath, store);
  const queue = options.cases.flatMap((item) =>
    expertLines(options.source, item, judged[item.answer] ?? {}),
  );
  appendExpertQueue(runtime.out, queue);
  return { judged, ...summary };
}

/** Folds every logged attempt's verdicts into `judged`. */
function foldJudged(
  runtime: Runtime,
  options: JudgeOptions,
  judged: Record<string, JudgedRows>,
  log: AttemptLog,
) {
  for (const item of options.cases) {
    const verdicts = knownVerdicts(item, judged[item.answer]);
    const rows = new Set(item.rows.map((one) => one.row));
    for (const judge of JUDGE_NAMES)
      for (const attempt of log[item.answer]?.[judge] ?? []) {
        const raw = readRaw(options.dir, attempt.id);
        if (!raw || failedRaw(raw) || raw.promptHash !== attempt.promptHash)
          continue;
        // The attempt must ask about these rows as they are now: a reply
        // about an earlier answer to them doesn't count.
        const asked = new Set(attempt.rows);
        const now = {
          ...item,
          rows: item.rows.filter((r) => asked.has(r.row)),
        };
        if (
          now.rows.length !== attempt.rows.length ||
          promptHash(judgeRequest(now, judge, attempt.id)) !==
            attempt.promptHash
        )
          continue;
        const parsed = parseVerdicts(raw.text);
        if (parsed.error)
          runtime.log(`${raw.id}: verdicts unreadable (${parsed.error})`);
        for (const [row, verdict] of parsed.verdicts)
          if (asked.has(row) && rows.has(row) && !verdicts[judge].has(row))
            verdicts[judge].set(row, verdict);
      }
    judged[item.answer] = {
      ...judged[item.answer],
      ...judgeRows(item, verdicts),
    };
  }
}

/** Adds lines to the expert queue, each (source, answer, row) once. */
export function appendExpertQueue(out: string, lines: readonly string[]) {
  const path = expertQueuePath(out);
  const keyOf = (line: string) => line.split("\t").slice(0, 3).join("\t");
  const known = new Set(
    existsSync(path)
      ? readFileSync(path, "utf8").split("\n").filter(Boolean).map(keyOf)
      : [],
  );
  const fresh = lines.filter((line) => !known.has(keyOf(line)));
  if (!fresh.length) return;
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) writeFileSync(path, `${EXPERT_QUEUE_HEAD}\n`);
  appendFileSync(path, `${fresh.join("\n")}\n`);
}

/** The cases a run's task-1 answers send to the judges. */
export function runJudgeCases(
  scored: readonly ScoredRequest[],
  data: EvalData,
): JudgeCase[] {
  const folds = new Map(data.folds.map((fold) => [fold.key, fold]));
  return scored
    .filter((one) => one.spec.task === 1)
    .map((one) =>
      judgeCase(
        one.id,
        folds.get(one.spec.key) as Fold,
        one.scores,
        one.spec.book,
        data.dictionary,
      ),
    )
    .filter((one) => one.rows.length);
}

/** The cases A1's open-book task-1 answers send to the judges. */
export function a1JudgeCases(
  data: Pick<EvalData, "dictionary" | "folds">,
  existing: JudgedRows,
): JudgeCase[] {
  return data.folds
    .map((fold) =>
      judgeCase(
        `A1-k${String(fold.key).padStart(2, "0")}`,
        fold,
        applyVerdicts(a1Scores(fold, "open", data.dictionary).task1, existing),
        "open",
        data.dictionary,
      ),
    )
    .filter((one) => one.rows.length);
}

// --- The recall probe ------------------------------------------------------------

/** A probe's requests for some Keys, with their manifest entries. */
export function probePlan(
  rows: readonly KeyRowRecord[],
  keys: readonly number[],
  model: string,
  effort: Effort,
) {
  return keys.flatMap((key) =>
    probeRequests(
      rows.filter((row) => row.key === key),
      model,
      effort,
    ).map((request, i) => ({
      request,
      manifest: manifestRequest(request, {
        probe: { key, side: SIDES[i] },
      }),
    })),
  );
}

/** Scores a probe run's recitals and writes its flags to probe.json. */
export function scoreProbe(
  out: string,
  run: string,
  rows: readonly KeyRowRecord[],
): ProbeFile {
  const dir = runDir(out, run);
  const manifest = readJson<Manifest>(join(dir, "manifest.json"));
  if (!manifest) throw new Error(`No run ${run}`);
  const texts = new Map<number, Partial<Record<Side, string>>>();
  for (const request of manifest.requests) {
    if (!request.probe) continue;
    const raw = readRaw(dir, request.id);
    const one = texts.get(request.probe.key) ?? {};
    // A failed, cut-off or filtered side stays out: incomplete.
    if (raw && !failedRaw(raw)) one[request.probe.side] = raw.text;
    texts.set(request.probe.key, one);
  }
  const keys: Record<string, KeyProbe> = {};
  for (const [key, text] of texts)
    keys[key] = probeKey(
      rows.filter((row) => row.key === key),
      text,
    );
  const first = manifest.requests[0];
  const file: ProbeFile = {
    runId: run,
    model: first?.model ?? "",
    effort: first?.effort ?? "medium",
    keys,
    flagged: Object.entries(keys)
      .filter(([, one]) => one.flagged)
      .map(([key]) => Number(key)),
  };
  writeJson(join(dir, "probe.json"), file);
  return file;
}

/** Rebuilds a run's requests from its manifest, checking each prompt hash. */
export function rebuildRequests(
  manifest: Manifest,
  data: EvalData,
): ModelRequest[] {
  const folds = new Map(data.folds.map((fold) => [fold.key, fold]));
  return manifest.requests.map((entry) => {
    let request: ModelRequest | undefined;
    if (entry.translate)
      request = translateRequest(
        folds.get(entry.translate.key) as Fold,
        entry.translate,
        data,
      );
    else if (entry.probe)
      request = probePlan(
        data.rows,
        [entry.probe.key],
        entry.model,
        entry.effort,
      ).find((one) => one.request.id === entry.id)?.request;
    if (!request) throw new Error(`Can't rebuild ${entry.id}`);
    if (promptHash(request) !== entry.promptHash)
      throw new Error(
        `${entry.id}: its prompt has changed since the run (data or code); start a new run`,
      );
    return request;
  });
}

/** The cap, for messages. */
export const CAP = EXPERIMENT_CAP_USD;
