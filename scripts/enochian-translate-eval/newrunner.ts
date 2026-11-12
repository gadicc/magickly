import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AnswerItem } from "./answer.ts";
import { a1kNewText, a1NewText, a1Task3 } from "./baseline.ts";
import {
  foldVerdicts,
  type JudgeCase,
  type JudgedRows,
  type JudgeRow,
  sameAnswer,
  type VerdictStore,
  verdictKey,
} from "./judge.ts";
import {
  type Calibration,
  estimateCost,
  estimateTokens,
  NO_TOKENS,
  type PriceList,
  priceRow,
  type TransportName,
} from "./ledger.ts";
import { OUTPUT_ALLOWANCE, shortName } from "./models.ts";
import {
  type NewSpec,
  partRows,
  type RoundTripSpec,
  roundTripRequest,
  type Task3Sentence,
  tasks12Dictionary,
} from "./newprompt.ts";
import {
  applyNewVerdicts,
  joinNewScores,
  type NewScores,
  newJudgeCase,
  newReport,
  newTextContext,
  scoreNewText,
} from "./newscore.ts";
import { type NewTextSet, newTextRows } from "./newtext.ts";
import { parseAnswer } from "./reply.ts";
import {
  blockedAttempts,
  type EvalData,
  execute,
  failedRaw,
  type Manifest,
  manifestRequest,
  promptKind,
  type RawResult,
  type Runtime,
  readJson,
  readRaw,
  runDir,
  runJudges,
  runsDir,
  verdictStorePath,
  writeJson,
} from "./runner.ts";
import {
  blockedRoundTrips,
  candidate,
  damagedControls,
  flatJudged,
  itemsBySentence,
  parseRoundTrip,
  parseRoundTripVerdicts,
  parseRubricVerdicts,
  type RoundTripStore,
  roundTripCases,
  roundTripJudgeRequest,
  roundTripKey,
  roundTripSpecs,
  roundTripsFor,
  rubricCases,
  rubricRequest,
  rubricRow,
  type Task3Candidate,
  type Task3Report,
  task3Report,
  translationText,
} from "./task3.ts";
import type { KeyRowRecord } from "./testset.ts";
import type { GenerationInfo, ModelRequest } from "./transport.ts";

/**
 * The runner's side of plan 077's redesign: scoring runs on the new text,
 * the judges' cases for them and for A1 and A1k, blocked replies, the cache
 * check and its projection, and task 3 (its pool of candidates, round trips,
 * judges and figures). Every call goes through `execute` or `runJudges`, so
 * through the ledger's holds and the cap.
 *
 * Layout under the output directory, besides `runner.ts`'s:
 *
 *     newtext-baseline/judged.json   the judges' verdicts on A1's and A1k's rows
 *     task3/roundtrips.json          every round trip done, by candidate
 *     task3/judged-rubric.json, judged-roundtrip.json   the task-3 verdicts
 *     task3/judge-rubric/, judge-roundtrip/   those judges' calls
 *     task3/report.json              task 3's figures
 *     runs/<run>/cache-check.json    the cache check's figures
 */

/**
 * Where A1's and A1k's scores and verdicts on a new text go: the committed
 * set's (seed 77) in `newtext-baseline`, another seed's (a top-up) apart,
 * since its row ids repeat the committed set's.
 */
export const newBaselineDir = (out: string, seed = 77) =>
  join(out, seed === 77 ? "newtext-baseline" : `newtext-baseline-seed${seed}`);
export const newBaselineJudgedPath = (out: string, seed?: number) =>
  join(newBaselineDir(out, seed), "judged.json");
export const task3Dir = (out: string) => join(out, "task3");
export const roundTripStorePath = (out: string) =>
  join(task3Dir(out), "roundtrips.json");

// --- Blocked replies --------------------------------------------------------------

/** Whether a saved reply was blocked by the provider's filter. */
export const isBlocked = (raw: Pick<RawResult, "finishReason">) =>
  raw.finishReason === "content-filter";

/**
 * A run's calls, every attempt (`requests/<id>.attempt-N.json` included),
 * and those blocked; `keep` picks requests by id.
 */
export function blockedCalls(
  dir: string,
  keep: (id: string) => boolean = () => true,
): { calls: number; blocked: number; ids: string[] } {
  const requests = join(dir, "requests");
  if (!existsSync(requests)) return { calls: 0, blocked: 0, ids: [] };
  let calls = 0;
  const ids: string[] = [];
  for (const file of readdirSync(requests).filter((one) =>
    one.endsWith(".json"),
  )) {
    const raw = readJson<RawResult>(join(requests, file));
    if (!raw || !keep(raw.id)) continue;
    calls++;
    if (isBlocked(raw)) ids.push(raw.id);
  }
  return { calls, blocked: ids.length, ids };
}

/**
 * Plan 077, "Blocked replies": a part the provider's filter blocks is
 * retried once. Re-runs the requests whose first attempt came back blocked,
 * within `budget`; a second block stands, and its rows count as wrong.
 */
export async function retryBlocked(
  runtime: Runtime,
  options: {
    run: string;
    dir: string;
    requests: readonly ModelRequest[];
    budget: number;
  },
): Promise<string[]> {
  const again = options.requests.filter((one) => {
    const raw = readRaw(options.dir, one.id);
    // Retried once after its first block, whatever came before it.
    return (
      raw !== undefined &&
      isBlocked(raw) &&
      blockedAttempts(options.dir, one.id) === 1
    );
  });
  if (!again.length || !(options.budget > 0)) return [];
  runtime.log(
    `Blocked by the provider's filter, retrying once: ${again.map((one) => one.id).join(", ")}`,
  );
  try {
    await execute(runtime, {
      run: options.run,
      dir: options.dir,
      requests: again,
      transport: "sync",
      budget: options.budget,
    });
  } catch (error) {
    runtime.log(`Not retried: ${(error as Error).message}`);
    return [];
  }
  return again.map((one) => one.id);
}

/** Opus's translation calls in some runs, every attempt, and those blocked. */
export function opusBlocked(
  out: string,
  runs: readonly string[],
  model: string,
): { calls: number; blocked: number } {
  let calls = 0;
  let blocked = 0;
  for (const run of runs) {
    const dir = runDir(out, run);
    const manifest = readJson<Manifest>(join(dir, "manifest.json"));
    if (!manifest) continue;
    const ids = new Set(
      manifest.requests
        .filter((one) => one.kind === "translate" && one.model === model)
        .map((one) => one.id),
    );
    const found = blockedCalls(dir, (id) => ids.has(id));
    calls += found.calls;
    blocked += found.blocked;
  }
  return { calls, blocked };
}

// --- What runs cost, with and without the cache -------------------------------------

/**
 * Requests' expected cost (each its output allowance) with cache reads and
 * without. Without: every input token at the input price. With (sync only;
 * batch requests carry no cache breakpoints, `callSettings`, and are priced
 * as plain input, as their reservation is): the first call of each prefix (`cachePrefix`:
 * model and system messages) writes its system messages to the cache, at the
 * cache-write price, and every later call reads them, at the cache-read
 * price; the user message is always plain input. Sync sends each prefix's
 * first call alone (`runSync`), so the later ones can read it.
 */
export function cacheProjection(
  requests: readonly ModelRequest[],
  prices: PriceList,
  transport: TransportName,
  calibration: Calibration = {},
): { withReads: number; without: number } {
  const written = new Set<string>();
  let withReads = 0;
  let without = 0;
  for (const one of requests) {
    const price = priceRow(prices, one.model, transport);
    const perToken = calibration[promptKind(one)];
    const prefix = estimateTokens(
      one.instructions.reduce((sum, text) => sum + text.length, 0),
      perToken,
    );
    const input = prefix + estimateTokens(one.prompt.length, perToken);
    const output = OUTPUT_ALLOWANCE[one.kind][one.effort];
    const plain = estimateCost({ ...NO_TOKENS, input, output }, price);
    without += plain;
    const key =
      transport === "sync" && one.instructions.length > 1
        ? JSON.stringify([one.model, one.instructions])
        : undefined;
    if (!key) withReads += plain;
    else if (written.has(key))
      withReads += estimateCost(
        { ...NO_TOKENS, input, cached: prefix, output },
        price,
      );
    else {
      written.add(key);
      withReads += estimateCost(
        { ...NO_TOKENS, input, cacheWrite: prefix, output },
        price,
      );
    }
  }
  return { withReads, without };
}

// --- The cache check ------------------------------------------------------------------

/** One call of the cache check, as the ledger and the gateway saw it. */
export interface CacheCheckCall {
  id: string;
  ok: boolean;
  /** All input tokens, and those read from and written to the cache. */
  input: number;
  cached: number;
  cacheWrite: number;
  output: number;
  cost: number;
  /** The gateway's own cost figure (else estimated from the tokens). */
  exact: boolean;
  /** What the gateway recorded for the generation, where it says. */
  generation?: GenerationInfo;
}

export interface CacheCheckResult {
  calls: CacheCheckCall[];
  /** The second call's input read from the cache, as a share of its input. */
  secondReadShare: number;
  /** Whether the second call read the shared prefix from the cache. */
  reads: boolean;
}

/** The share of the second call's input it must read for the check to pass. */
export const CACHE_READ_PASS = 0.5;

/**
 * Plan 077's first paid step: two calls sharing one context prefix, one
 * after the other, then each call's cached input tokens and cost from the
 * ledger's record (usage, else provider metadata) and, where the gateway
 * says, its own record of the generation. Through `execute`, so the calls
 * are held and booked like any run's.
 */
export async function cacheCheck(
  runtime: Runtime,
  options: {
    run: string;
    dir: string;
    requests: readonly [ModelRequest, ModelRequest];
    budget: number;
  },
): Promise<CacheCheckResult> {
  const [a, b] = options.requests;
  if (JSON.stringify(a.instructions) !== JSON.stringify(b.instructions))
    throw new Error("The cache check's two calls must share their context");
  await execute(
    { ...runtime, concurrency: 1 },
    {
      run: options.run,
      dir: options.dir,
      requests: options.requests,
      transport: "sync",
      budget: options.budget,
    },
  );
  const calls: CacheCheckCall[] = [];
  for (const request of options.requests) {
    const raw = readRaw(options.dir, request.id);
    if (!raw) continue;
    const generation =
      raw.generationId && runtime.gateway.generationInfo
        ? await runtime.gateway.generationInfo(raw.generationId)
        : undefined;
    calls.push({
      id: raw.id,
      ok: !failedRaw(raw),
      input: raw.tokens.input,
      cached: raw.tokens.cached,
      cacheWrite: raw.tokens.cacheWrite,
      output: raw.tokens.output,
      cost: raw.cost,
      exact: raw.exact,
      ...(generation ? { generation } : {}),
    });
  }
  const second = calls[1];
  const cached = Math.max(
    second?.cached ?? 0,
    second?.generation?.cachedTokens ?? 0,
  );
  const input = Math.max(
    second?.input ?? 0,
    second?.generation?.promptTokens ?? 0,
  );
  const secondReadShare = input ? cached / input : 0;
  const result = {
    calls,
    secondReadShare,
    reads: secondReadShare >= CACHE_READ_PASS,
  };
  writeJson(join(options.dir, "cache-check.json"), result);
  return result;
}

// --- Scoring runs on the new text ---------------------------------------------------

/** The arm, task, subset, model and effort a request's scores pool under. */
export function newGroupName(spec: NewSpec): string {
  return `${spec.arm} task ${spec.task} ${spec.subset} ${shortName(spec.model)} ${spec.effort}`;
}

/** One request on the new text, scored. */
export interface NewScoredRequest {
  id: string;
  spec: NewSpec;
  failure?: string;
  blocked?: boolean;
  coercions?: number;
  scores: NewScores;
}

/** The scoring context of tasks 1 and 2: the prompt with the knowns. */
function tasks12Context(data: EvalData) {
  return newTextContext(tasks12Dictionary(data), data.rows);
}

/** A saved reply's items, or why there are none. */
function itemsOf(raw: RawResult | undefined): {
  items: AnswerItem[];
  failure?: string;
  coercions?: number;
} {
  if (!raw) return { items: [], failure: "not run" };
  if (failedRaw(raw))
    return {
      items: [],
      failure: `call failed: ${raw.error ?? `finish reason "${raw.finishReason ?? "none"}"`}`,
    };
  const parsed = parseAnswer(raw.text);
  if (!parsed.ok)
    return { items: [], failure: `reply unreadable: ${parsed.error}` };
  return { items: parsed.value, coercions: parsed.coercions ?? 0 };
}

/**
 * Scores every request of a new-text run (tasks 1 and 2) from its saved
 * replies, part by part, the judges' verdicts folded in. A failed, blocked
 * or unreadable reply scores its rows "missing"; a request never run is left
 * out and listed.
 */
export function scoreNewRequests(
  manifest: Manifest,
  dir: string,
  data: EvalData,
): { scored: NewScoredRequest[]; notRun: string[] } {
  if (!data.newText) throw new Error("No new text loaded");
  const judged =
    readJson<Record<string, JudgedRows>>(join(dir, "judged.json")) ?? {};
  const context = tasks12Context(data);
  const scored: NewScoredRequest[] = [];
  const notRun: string[] = [];
  for (const request of manifest.requests) {
    const spec = request.newtext;
    if (!spec || spec.task === 3) continue;
    const raw = readRaw(dir, request.id);
    if (!raw) {
      notRun.push(request.id);
      continue;
    }
    const { items, failure, coercions } = itemsOf(raw);
    const scores = scoreNewText(
      partRows(data.newText, spec.sentences),
      items,
      spec.task,
      context,
      { flagAlternatives: true, emptyContext: spec.arm === "A0" },
    );
    if (spec.task === 1) applyNewVerdicts(scores, judged[request.id]);
    const one: NewScoredRequest = { id: request.id, spec, scores };
    if (failure) one.failure = failure;
    if (isBlocked(raw)) one.blocked = true;
    if (coercions) one.coercions = coercions;
    scored.push(one);
  }
  return { scored, notRun };
}

/** One pooled group of a new-text run. */
export interface NewGroup {
  name: string;
  spec: Omit<NewSpec, "part" | "sentences">;
  parts: number;
  scores: NewScores;
  report: ReturnType<typeof newReport>;
}

export function newGroups(scored: readonly NewScoredRequest[]): NewGroup[] {
  const by = new Map<string, NewScoredRequest[]>();
  for (const one of scored) {
    const name = newGroupName(one.spec);
    by.set(name, [...(by.get(name) ?? []), one]);
  }
  return [...by].map(([name, list]) => {
    const { part: _part, sentences: _sentences, ...spec } = list[0].spec;
    const scores = joinNewScores(list.map((one) => one.scores));
    return {
      name,
      spec,
      parts: list.length,
      scores,
      report: newReport(scores),
    };
  });
}

/** Scores a new-text run and writes its scores and report beside its replies. */
export function scoreNewRun(out: string, run: string, data: EvalData) {
  const dir = runDir(out, run);
  const manifest = readJson<Manifest>(join(dir, "manifest.json"));
  if (!manifest) throw new Error(`No run ${run} in ${runsDir(out)}`);
  const { scored, notRun } = scoreNewRequests(manifest, dir, data);
  const pooled = newGroups(scored);
  const blocked = blockedCalls(dir);
  writeJson(join(dir, "scores.json"), {
    run,
    requests: scored.map((one) => ({
      id: one.id,
      spec: one.spec,
      failure: one.failure,
      blocked: one.blocked ?? false,
      coercions: one.coercions ?? 0,
      rows: one.scores.rows,
      items: one.scores.items,
    })),
    notRun,
  });
  writeJson(join(dir, "report.json"), {
    run,
    groups: Object.fromEntries(
      pooled.map((one) => [one.name, { parts: one.parts, ...one.report }]),
    ),
    failures: scored
      .filter((one) => one.failure)
      .map((one) => ({ id: one.id, failure: one.failure })),
    blocked,
    notRun,
  });
  return { manifest, scored, notRun, groups: pooled, blocked };
}

/** A run for the bars: its manifest and the data its set needs. */
export interface BarRun {
  run: string;
  manifest: Manifest;
  data: EvalData;
}

/** What `barGroup` looks for: one arm's task on all of a set's rows. */
export interface BarWant {
  arm: NewSpec["arm"];
  task: 1 | 2;
  model: string;
  effort: NewSpec["effort"];
}

/**
 * One arm's figures for the bars: the run on the committed set (subset
 * "all"), pooled with any runs of it on top-up sets (plan 077: "the bar
 * decided on all the rows together"). Refuses, rather than measure:
 * - a run with requests never run (resume it first);
 * - a run whose rows aren't its set's (it ran on part of it);
 * - two runs on the same set that both match (name one with `--runs`);
 * - a top-up run with no run on the committed set.
 * `undefined` when no run matches.
 */
export function barGroup(
  out: string,
  runs: readonly BarRun[],
  want: BarWant,
):
  | { report: ReturnType<typeof newReport>; runs: string[]; sets: EvalData[] }
  | undefined {
  const found: { run: string; data: EvalData; scores: NewScores }[] = [];
  for (const one of runs) {
    if (one.manifest.kind !== "newtext") continue;
    const result = scoreNewRun(out, one.run, one.data);
    const group = result.groups.find(
      (g) =>
        g.spec.arm === want.arm &&
        g.spec.task === want.task &&
        g.spec.model === want.model &&
        g.spec.effort === want.effort &&
        g.spec.subset === "all",
    );
    if (!group) continue;
    if (result.notRun.length)
      throw new Error(
        `Run ${one.run} has requests never run (${result.notRun.join(", ")}): resume it before measuring the bars`,
      );
    const rows = newTextRows(one.data.newText as NewTextSet).length;
    if (group.report.all.rows !== rows)
      throw new Error(
        `Run ${one.run}: ${group.name} covers ${group.report.all.rows} rows, its set ${rows}`,
      );
    found.push({ run: one.run, data: one.data, scores: group.scores });
  }
  const seeds = new Map<number, string[]>();
  for (const one of found) {
    const seed = (one.data.newText as NewTextSet).seed;
    seeds.set(seed, [...(seeds.get(seed) ?? []), one.run]);
  }
  for (const [seed, list] of seeds)
    if (list.length > 1)
      throw new Error(
        `Runs ${list.join(" and ")} both have ${want.arm} task ${want.task} on the seed-${seed} set: name the one to measure with --runs`,
      );
  const main = found.find((one) => one.data.newText?.seed === COMMITTED_SEED);
  if (!main) {
    if (found.length)
      throw new Error(
        `Top-up runs (${found.map((one) => one.run).join(", ")}) but no run on the committed set`,
      );
    return undefined;
  }
  const all = [main, ...found.filter((one) => one !== main)];
  return {
    report: newReport(joinNewScores(all.map((one) => one.scores))),
    runs: all.map((one) => one.run),
    sets: all.map((one) => one.data),
  };
}

/** The committed new text's seed (plan 077's number). */
export const COMMITTED_SEED = 77;

/** A1k on the same sets as a pooled arm, each set's own scores pooled. */
export function a1kPooled(out: string, sets: readonly EvalData[]) {
  const scored = sets.map((one) => newBaselineScores(out, one).scored.A1k);
  return {
    task1: newReport(joinNewScores(scored.map((one) => one.task1))),
    task2: newReport(joinNewScores(scored.map((one) => one.task2))),
  };
}

/** The judges' cases from a new-text run's task-1 answers. */
export function newRunJudgeCases(
  scored: readonly NewScoredRequest[],
  data: EvalData,
): JudgeCase[] {
  if (!data.newText) throw new Error("No new text loaded");
  const dictionary = tasks12Dictionary(data);
  return scored
    .filter((one) => one.spec.task === 1)
    .map((one) =>
      newJudgeCase(
        one.id,
        partRows(
          data.newText as NonNullable<EvalData["newText"]>,
          one.spec.sentences,
        ),
        one.scores,
        dictionary,
        data.rows,
      ),
    )
    .filter((one) => one.rows.length);
}

// --- A1 and A1k on the new text --------------------------------------------------------

/** The judged answers' names, for A1's and A1k's task-1 rows. */
export const BASELINE_ANSWERS = { A1: "A1-new-t1", A1k: "A1k-new-t1" } as const;

/**
 * A1 and A1k on the new text, both tasks, scored, with the judges' verdicts
 * on their task-1 rows folded in (`newtext-baseline/judged.json`).
 */
export function newBaselineScores(
  out: string,
  data: EvalData,
  /** Leave the judges' verdicts out: every row the script can't settle stays to judge. */
  withVerdicts = true,
) {
  if (!data.newText) throw new Error("No new text loaded");
  const rows = newTextRows(data.newText);
  const dictionary = tasks12Dictionary(data);
  const context = newTextContext(dictionary, data.rows);
  const judged =
    readJson<Record<string, JudgedRows>>(
      newBaselineJudgedPath(out, data.newText.seed),
    ) ?? {};
  const answers = {
    A1: a1NewText(rows, dictionary, data.rows),
    A1k: a1kNewText(rows, dictionary, data.rows),
  };
  const scored = Object.fromEntries(
    (["A1", "A1k"] as const).map((arm) => {
      const task1 = scoreNewText(rows, answers[arm].task1, 1, context);
      if (withVerdicts) applyNewVerdicts(task1, judged[BASELINE_ANSWERS[arm]]);
      return [
        arm,
        { task1, task2: scoreNewText(rows, answers[arm].task2, 2, context) },
      ];
    }),
  ) as Record<"A1" | "A1k", { task1: NewScores; task2: NewScores }>;
  const cases = (["A1", "A1k"] as const)
    .map((arm) =>
      newJudgeCase(
        BASELINE_ANSWERS[arm],
        rows,
        scored[arm].task1,
        dictionary,
        data.rows,
      ),
    )
    .filter((one) => one.rows.length);
  return { answers, scored, cases, judged };
}

// --- Task 3 -------------------------------------------------------------------------------

/** A task-3 run's source name for a spec: its run and group. */
export const task3Source = (run: string, spec: NewSpec) =>
  `${run}:${spec.arm} ${shortName(spec.model)} ${spec.effort}`;

/**
 * A task-3 run's candidates: one per sentence and group. A sentence whose
 * part failed, was blocked twice or couldn't be read is a candidate with
 * nothing to judge, which counts as wrong.
 */
export function task3RunCandidates(
  out: string,
  run: string,
  sentences: readonly Task3Sentence[],
): Task3Candidate[] {
  const dir = runDir(out, run);
  const manifest = readJson<Manifest>(join(dir, "manifest.json"));
  if (!manifest) throw new Error(`No run ${run}`);
  const byId = new Map(sentences.map((one) => [one.id, one]));
  const out3: Task3Candidate[] = [];
  for (const request of manifest.requests) {
    const spec = request.newtext;
    if (!spec || spec.task !== 3) continue;
    const raw = readRaw(dir, request.id);
    const { items, failure } = itemsOf(raw);
    const found = itemsBySentence(items, spec.sentences);
    for (const id of spec.sentences) {
      const sentence = byId.get(id);
      if (!sentence) continue;
      const its = found.get(id) ?? [];
      out3.push(
        candidate(task3Source(run, spec), sentence, its, {
          ...(failure || !its.length
            ? { missing: failure ?? "no items for the sentence" }
            : {}),
        }),
      );
    }
  }
  return out3;
}

/**
 * The task-3 source a bar is measured on: the one source of the group
 * ("A3 opus medium"), or none. Two runs of the group are refused, as
 * `barGroup` refuses them for tasks 1 and 2: the one to measure is named
 * with `--runs`, so a run is never chosen among complete ones by result.
 */
export function barSource(
  sources: readonly string[],
  group: string,
): string | undefined {
  const found = sources.filter((one) => one.endsWith(`:${group}`));
  if (found.length > 1)
    throw new Error(
      `Task-3 runs ${found.map((one) => one.split(":")[0]).join(" and ")} both have ${group}: name the one to measure with --runs`,
    );
  return found[0];
}

/**
 * The runs of one kind to read when `--runs` names some runs: those of the
 * kind it names, or all of them when it names none of the kind (it named
 * only the other kind's). Two runs of one arm are still refused, by
 * `barGroup` (tasks 1 and 2) and `barSource` (task 3).
 */
export function namedRuns(
  named: readonly string[] | undefined,
  all: readonly string[],
): string[] {
  const mine = named?.filter((one) => all.includes(one)) ?? [];
  return mine.length ? mine : [...all];
}

/** Every task-3 run in the output directory, oldest first. */
export function task3Runs(out: string): string[] {
  const runs = runsDir(out);
  if (!existsSync(runs)) return [];
  return readdirSync(runs)
    .sort()
    .filter(
      (name) =>
        readJson<Manifest>(join(runs, name, "manifest.json"))?.kind === "task3",
    );
}

/**
 * Task 3's candidates: A1's, the judges' check (damaged controls and their
 * originals, from the new text) and every named task-3 run's (all of them,
 * by default).
 */
export function task3Pool(
  out: string,
  data: EvalData,
  runs: readonly string[] = task3Runs(out),
) {
  const sentences = data.task3 ?? [];
  const a1 = a1Task3(sentences, data.dictionary, data.rows);
  const a1Candidates = sentences.map((one) =>
    candidate("A1", one, a1.get(one.id) ?? []),
  );
  const check = data.newText
    ? damagedControls(data.newText, data)
    : { passages: 0, units: 0, originals: [], controls: [] };
  const fromRuns = runs.flatMap((run) =>
    task3RunCandidates(out, run, sentences),
  );
  return {
    a1,
    candidates: [
      ...a1Candidates,
      ...check.originals,
      ...check.controls,
      ...fromRuns,
    ],
    runs: [...runs],
    /** How many passages qualified for the controls, and the pairs made. */
    controlsFrom: { passages: check.passages, units: check.units },
  };
}

/** The round trips a pool needs, as requests with their manifest entries. */
export function roundTripPlan(
  out: string,
  candidates: readonly Task3Candidate[],
  data: EvalData,
  model: string,
  effort: RoundTripSpec["effort"],
) {
  const store = readJson<RoundTripStore>(roundTripStorePath(out)) ?? {};
  return roundTripSpecs(candidates, store, model, effort).map((spec) => {
    const request = roundTripRequest(spec, data.dictionary);
    return { request, manifest: manifestRequest(request, { roundtrip: spec }) };
  });
}

/**
 * Reads a round-trip run's replies into the store
 * (`task3/roundtrips.json`), each by its candidate's key; returns how many
 * it added and the candidates a reply left out.
 */
export function mergeRoundTrips(
  out: string,
  run: string,
  candidates: readonly Task3Candidate[],
): { added: number; left: string[]; blocked: string[] } {
  const dir = runDir(out, run);
  const manifest = readJson<Manifest>(join(dir, "manifest.json"));
  if (!manifest) throw new Error(`No run ${run}`);
  const store = readJson<RoundTripStore>(roundTripStorePath(out)) ?? {};
  const byId = new Map(candidates.map((one) => [one.id, one]));
  let added = 0;
  const left: string[] = [];
  const blocked: string[] = [];
  for (const request of manifest.requests) {
    const spec = request.roundtrip;
    if (!spec) continue;
    const raw = readRaw(dir, request.id);
    const parsed =
      raw && !failedRaw(raw)
        ? parseRoundTrip(raw.text)
        : { english: new Map() };
    // Blocked, and blocked again on its one retry: it stands (plan 077,
    // "Blocked replies"), recorded so it is never asked again.
    const stands =
      raw !== undefined &&
      isBlocked(raw) &&
      blockedAttempts(dir, request.id) >= 2;
    for (const { id, enochian } of spec.input) {
      const one = byId.get(id);
      // Only for the translation it was asked about.
      if (!one || translationText(one.items) !== enochian) {
        left.push(id);
        continue;
      }
      const english = parsed.english.get(id);
      if (english !== undefined) {
        store[roundTripKey(one)] = { english, run };
        added++;
      } else if (stands) {
        store[roundTripKey(one)] = { english: "", run, blocked: true };
        blocked.push(id);
      } else left.push(id);
    }
  }
  writeJson(roundTripStorePath(out), store);
  return { added, left, blocked };
}

/** Where `refillFromStore` puts the rulings it takes from the store. */
export const FROM_STORE_CASE = "T3J-from-store";

/**
 * Puts into `existing` (the rubric's saved verdicts, by case) every
 * candidate's rulings that the verdict store has from both judges but the
 * saved verdicts lack, under `FROM_STORE_CASE`. Returns how many.
 */
export function refillFromStore(
  existing: Record<string, JudgedRows>,
  candidates: readonly Task3Candidate[],
  keyRows: readonly KeyRowRecord[],
  store: VerdictStore,
): number {
  const rows = new Map(keyRows.map((row) => [row.id, row]));
  const have = flatJudged(existing);
  let added = 0;
  for (const one of candidates) {
    if (one.missing || !one.items.length) continue;
    const row = rubricRow(one, rows);
    const saved = store[verdictKey(row)];
    const known = have.get(row.row);
    if (!saved?.opus || !saved.gpt) continue;
    if (known?.outcome && sameAnswer(known, row.answer)) continue;
    existing[FROM_STORE_CASE] = {
      ...existing[FROM_STORE_CASE],
      [row.row]: {
        answer: row.answer,
        opus: saved.opus,
        gpt: saved.gpt,
        outcome: foldVerdicts(saved.opus, saved.gpt),
      },
    };
    added++;
  }
  return added;
}

/** Task 3's judging: the rubric, then the round trips, both judges. */
export async function judgeTask3(
  runtime: Runtime,
  options: {
    candidates: readonly Task3Candidate[];
    data: EvalData;
    budget: number;
    dryRun?: boolean;
    retry?: boolean;
  },
) {
  const out = runtime.out;
  const store = readJson<RoundTripStore>(roundTripStorePath(out)) ?? {};
  const trips = roundTripsFor(options.candidates, store);
  const rubricPath = join(task3Dir(out), "judged-rubric.json");
  const tripPath = join(task3Dir(out), "judged-roundtrip.json");
  const before = runtime.ledger.total();
  // Rulings the verdict store has but the rubric's file lacks (a crash
  // between the two writes) are put back first; then only what both judges
  // haven't ruled on is dealt into new cases, so a later round (the
  // controls, a model's run) never sends again what an earlier one judged,
  // nor mixes it in to make more calls. A row one judge left out is dealt
  // again with what remains: it goes out as a new, smaller case (or under
  // `-retry-N` if its case is unchanged), one call for each judge missing.
  const verdicts = readJson<VerdictStore>(verdictStorePath(out)) ?? {};
  const existing = readJson<Record<string, JudgedRows>>(rubricPath) ?? {};
  refillFromStore(existing, options.candidates, options.data.rows, verdicts);
  const done = (row: JudgeRow) => {
    const saved = verdicts[verdictKey(row)];
    return Boolean(saved?.opus && saved.gpt);
  };
  const rubric = await runJudges(runtime, {
    run: "task3-rubric",
    dir: join(task3Dir(out), "judge-rubric"),
    cases: rubricCases(options.candidates, options.data.rows, undefined, done),
    existing,
    budget: options.budget,
    dryRun: options.dryRun,
    retry: options.retry,
    source: "task3",
    request: rubricRequest({
      dictionary: options.data.dictionary,
      grammar: options.data.grammar,
    }),
    parse: parseRubricVerdicts,
  });
  if (!options.dryRun) writeJson(rubricPath, rubric.judged);
  // One budget for both: the round trips' judges get what the rubric's left.
  const left =
    options.budget -
    (options.dryRun ? rubric.projected : runtime.ledger.total() - before);
  const cases = roundTripCases(options.candidates, trips);
  if (!options.dryRun && !(left > 0)) {
    runtime.log("No budget left for the round trips' judges; run again.");
    return {
      rubric,
      trips,
      cases,
      blocked: blockedRoundTrips(options.candidates, store),
    };
  }
  const roundTrip = await runJudges(runtime, {
    run: "task3-roundtrip-judge",
    dir: join(task3Dir(out), "judge-roundtrip"),
    cases,
    existing: readJson<Record<string, JudgedRows>>(tripPath) ?? {},
    // A dry run still reports the round trips' cost when the rubric's
    // projection uses up the budget; its refusal says so.
    budget: Math.max(left, 1e-9),
    dryRun: options.dryRun,
    retry: options.retry,
    source: "task3-roundtrip",
    request: roundTripJudgeRequest,
    parse: parseRoundTripVerdicts,
  });
  if (!options.dryRun) writeJson(tripPath, roundTrip.judged);
  return {
    rubric,
    roundTrip,
    trips,
    cases,
    blocked: blockedRoundTrips(options.candidates, store),
  };
}

/** Task 3's figures from what is saved; written to `task3/report.json`. */
export function task3Summary(
  out: string,
  data: EvalData,
  candidates: readonly Task3Candidate[],
  a1: ReadonlyMap<string, readonly AnswerItem[]>,
): Task3Report {
  const store = readJson<RoundTripStore>(roundTripStorePath(out)) ?? {};
  // Rulings the verdict store has but the rubric's file lacks are put back
  // here too, and saved: the file is derived from the store.
  const rubricPath = join(task3Dir(out), "judged-rubric.json");
  const rubric = readJson<Record<string, JudgedRows>>(rubricPath) ?? {};
  const verdicts = readJson<VerdictStore>(verdictStorePath(out)) ?? {};
  if (refillFromStore(rubric, candidates, data.rows, verdicts))
    writeJson(rubricPath, rubric);
  const report = task3Report({
    candidates,
    sentences: data.task3 ?? [],
    rubric: flatJudged(rubric),
    roundTrip: flatJudged(
      readJson<Record<string, JudgedRows>>(
        join(task3Dir(out), "judged-roundtrip.json"),
      ) ?? {},
    ),
    roundTrips: roundTripsFor(candidates, store),
    blockedTrips: blockedRoundTrips(candidates, store),
    a1,
    dictionary: data.dictionary,
    keyRows: data.rows,
  });
  writeJson(join(task3Dir(out), "report.json"), report);
  return report;
}
