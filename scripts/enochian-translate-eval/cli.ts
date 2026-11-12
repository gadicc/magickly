import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import dictionary from "magick-data/enochian/dictionary";
import keys from "magick-data/enochian/keys";
import { a1Scores, markHard } from "./baseline.ts";
import { cipher } from "./cipher.ts";
import {
  serialiseContext,
  serialiseDictionary,
  task1Input,
  task2Input,
} from "./context.ts";
import { barRows, line, pct, usd } from "./format.ts";
import { JUDGES, type JudgedRows, judgedCounts } from "./judge.ts";
import {
  CHARS_PER_TOKEN,
  EXPERIMENT_CAP_USD,
  fetchPrices,
  Ledger,
  ledgerTotals,
  type PriceList,
  type TransportName,
} from "./ledger.ts";
import { efforts, modelId, shortName } from "./models.ts";
import { normEnochian } from "./normalise.ts";
import {
  ARMS,
  planSpecs,
  type TranslateSpec,
  translateRequest,
} from "./prompt.ts";
import {
  a1JudgeCases,
  a1JudgedPath,
  a1Verdicts,
  collect,
  costs,
  createRunDir,
  type EvalData,
  execute,
  failedBooking,
  groupName,
  ledgerPath,
  loadProbeFlags,
  type Manifest,
  manifestRequest,
  markFolds,
  newRunId,
  type ProbeFile,
  pendingRequests,
  probePlan,
  type Runtime,
  readJson,
  rebuildRequests,
  reconcile,
  reserved,
  runBars,
  runDir,
  runJudgeCases,
  runJudges,
  runRefusal,
  scoreProbe,
  scoreRequests,
  scoreRun,
  spentSoFar,
  writeJson,
} from "./runner.ts";
import { joinScores, report } from "./score.ts";
import {
  buildTestSet,
  type ClosedGap,
  closedGaps,
  FIXED_KEYS,
  type Fold,
  isScoreable,
  rowsFromKeys,
  type SourceData,
} from "./testset.ts";
import { aiGateway, type ModelRequest } from "./transport.ts";

/**
 * Plan 077's experiment.
 *
 *   pnpm translate-eval:testset [--out DIR]   the test set and its contexts
 *   pnpm translate-eval:baseline [--out DIR]  arm A1's scores
 *   pnpm translate-eval:run -- …              model runs (see USAGE below),
 *     and :collect, :judge, :judge-a1, :probe, :report, :spent
 *
 * Outputs go outside the repository (default below), the runner's raw output
 * included, which never enters the repository. The commands that call a
 * model run through `loom env --` for AI_GATEWAY_API_KEY, and every one
 * takes a required `--budget`.
 */

const DEFAULT_OUT = join(
  homedir(),
  "Documents/Magick/Enochian/derived/translate-eval",
);

const pad = (n: number) => String(n).padStart(2, "0");

function source(): SourceData {
  return { dictionary, rows: rowsFromKeys(keys) };
}

function write(path: string, text: string) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** The plan's counts ("What we have"), recomputed, to check the data. */
function dataCounts(data: SourceData) {
  const scoreable = data.rows.filter(isScoreable);
  const keysOf = new Map<string, Set<number>>();
  for (const row of data.rows) {
    const form = row.word ?? row.gd;
    if (!form) continue;
    const norm = normEnochian(form);
    keysOf.set(norm, (keysOf.get(norm) ?? new Set()).add(row.key));
  }
  const distinct = new Set(scoreable.map((row) => normEnochian(row.word)));
  const headwords = new Set(Object.keys(data.dictionary).map(normEnochian));
  const single = [...distinct].filter((word) => keysOf.get(word)?.size === 1);
  return {
    dictionaryEntries: Object.keys(data.dictionary).length,
    keyRows: data.rows.length,
    scoreableRows: scoreable.length,
    distinctWords: distinct.size,
    distinctWithEntry: [...distinct].filter((word) => headwords.has(word))
      .length,
    distinctSingleKey: single.length,
    runningShared: scoreable.filter(
      (row) => (keysOf.get(normEnochian(row.word))?.size ?? 0) > 1,
    ).length,
  };
}

function foldJson(fold: Fold) {
  return {
    key: fold.key,
    fixed: FIXED_KEYS.includes(fold.key),
    rows: fold.rows,
    input: fold.input.map((row) => row.id),
    removals: fold.removals,
    exemptions: fold.exemptions,
  };
}

function testset(out: string) {
  const data = source();
  const folds = buildTestSet(data);
  markHard(folds, data.dictionary, a1Verdicts(out));
  const dir = join(out, "testset");
  write(join(dir, "data-counts.json"), json(dataCounts(data)));
  write(
    join(dir, "cipher.json"),
    json({ forward: cipher.forward, note: "J is I and V is U before it" }),
  );
  write(
    join(dir, "context", "dictionary-open.txt"),
    `${serialiseDictionary(data.dictionary)}\n`,
  );
  const removals = ["key\theadword\tbecause\trule\trows"];
  const exemptions = ["key\theadword\tbecause\trule\tinKeys"];
  const table: Record<string, unknown>[] = [];
  const gaps: ({ key: number } & ClosedGap)[] = [];
  for (const fold of folds) {
    const k = pad(fold.key);
    write(join(dir, `fold-${k}.json`), json(foldJson(fold)));
    for (const [name, options] of [
      ["open", { book: "open" }],
      ["closed", { book: "closed" }],
      ["cipher-open", { book: "open", cipher: true }],
    ] as const)
      write(
        join(dir, "context", `${name}-${k}.txt`),
        serialiseContext(fold, data.dictionary, options),
      );
    write(join(dir, "input", `task1-${k}.txt`), `${task1Input(fold)}\n`);
    write(
      join(dir, "input", `task1-cipher-${k}.txt`),
      `${task1Input(fold, { cipher: true })}\n`,
    );
    write(join(dir, "input", `task2-${k}.txt`), `${task2Input(fold)}\n`);
    for (const one of closedGaps(fold, data.dictionary))
      gaps.push({ key: fold.key, ...one });
    for (const one of fold.removals)
      removals.push(
        [
          fold.key,
          one.headword,
          one.because,
          one.rule,
          one.rows.join(" "),
        ].join("\t"),
      );
    for (const one of fold.exemptions)
      exemptions.push(
        [
          fold.key,
          one.headword,
          one.because,
          one.rule,
          one.inKeys.join(" "),
        ].join("\t"),
      );
    table.push({
      key: fold.key,
      scoreable: fold.rows.length,
      singleKey: fold.rows.filter((row) => row.singleKey).length,
      unknowable: fold.rows.filter((row) => !row.knowableClosed).length,
      noEntry: fold.rows.filter((row) => !row.inDictionary).length,
      removals: fold.removals.length,
      exemptions: fold.exemptions.length,
      hard1: fold.rows.filter((row) => isHard(row.a1?.task1)).length,
      a1Judge1: fold.rows.filter((row) => row.a1?.task1 === "to judge").length,
      hard2: fold.rows.filter((row) => isHard(row.a1?.task2)).length,
      gaps: gaps.filter((one) => one.key === fold.key).length,
    });
  }
  write(join(dir, "removals.tsv"), `${removals.join("\n")}\n`);
  write(join(dir, "exemptions.tsv"), `${exemptions.join("\n")}\n`);
  write(
    join(dir, "closed-gaps.tsv"),
    `${[
      "key\trow\theadword\tform\tmeaning",
      ...gaps.map((one) =>
        [one.key, one.row, one.headword, one.form, one.meaning].join("\t"),
      ),
    ].join("\n")}\n`,
  );
  write(join(dir, "summary.json"), json(table));
  console.log("Data:", dataCounts(data));
  console.table(table);
  const exempt = folds.flatMap((fold) => fold.exemptions);
  console.log(
    `Removals ${folds.reduce((a, f) => a + f.removals.length, 0)}; exemptions ${exempt.length} (${new Set(exempt.map((one) => one.headword)).size} headwords, ${new Set(exempt.flatMap((one) => one.inKeys)).size} rows of other Keys); known closed-book gaps ${gaps.length} (closed-gaps.tsv). Written to ${dir}`,
  );
}

/** Whether A1's outcome makes a row hard: wrong by script. */
function isHard(outcome: string | undefined) {
  return (
    outcome !== undefined && outcome !== "correct" && outcome !== "to judge"
  );
}

function baseline(out: string) {
  const data = source();
  const folds = buildTestSet(data);
  const open = markHard(folds, data.dictionary, a1Verdicts(out));
  const perFold = folds.map((fold) =>
    a1Scores(fold, "closed", data.dictionary),
  );
  const closed = {
    task1: joinScores(perFold.map((one) => one.task1)),
    task2: joinScores(perFold.map((one) => one.task2)),
  };
  const reports = {
    task1Open: report(open.task1, "open"),
    task2Open: report(open.task2, "open"),
    task1Closed: report(closed.task1, "closed"),
    task2Closed: report(closed.task2, "closed"),
  };
  const dir = join(out, "a1");
  write(join(dir, "report.json"), json(reports));
  write(join(dir, "scores.json"), json({ open, closed }));
  for (const [name, r] of Object.entries(reports)) console.log(line(name, r));
  console.table(
    reports.task1Open.perKey.map((one, i) => ({
      key: one.key,
      rows: one.all.rows,
      task1: pct(one.headline),
      task1Judge: one.all.counts["to judge"] ?? 0,
      task2: pct(reports.task2Open.perKey[i].headline),
      task2Syn: reports.task2Open.perKey[i].all.counts.synonym ?? 0,
      task2Near: reports.task2Open.perKey[i].all.counts.near ?? 0,
      closed1: pct(reports.task1Closed.perKey[i].headline),
      closed2: pct(reports.task2Closed.perKey[i].headline),
    })),
  );
  console.log(
    "Task 1 outcomes (open):",
    reports.task1Open.pooled.all.counts,
    "\nTask 2 outcomes (open):",
    reports.task2Open.pooled.all.counts,
    `\nHard rows: task 1 ${reports.task1Open.hard.all.rows} (+${reports.task1Open.a1ToJudge.all.rows} A1 to-judge), task 2 ${reports.task2Open.hard.all.rows}. Written to ${dir}`,
  );
}

// --- The model runner ---------------------------------------------------------

/** The grammar notes A3 adds, from the data package. */
const GRAMMAR = fileURLToPath(
  new URL(
    "../../packages/magick-data/src/enochian/grammar.md",
    import.meta.url,
  ),
);

/** The test set, its folds marked with A1's (judged) outcomes, and the notes. */
function evalData(out: string): EvalData {
  const data = source();
  return {
    ...data,
    grammar: readFileSync(GRAMMAR, "utf8"),
    folds: markFolds(buildTestSet(data), data.dictionary, out),
  };
}

/** `--keys`: "all", "fixed" (plan 077's five) or a list such as "1,3-5". */
function parseKeys(text: string | undefined): number[] {
  if (!text) throw new Error("--keys is required (all, fixed, or e.g. 1,3-5)");
  if (text === "all") return Array.from({ length: 19 }, (_, i) => i + 1);
  if (text === "fixed") return [...FIXED_KEYS];
  const out = text.split(",").flatMap((one) => {
    if (!/^\s*\d+\s*(?:-\s*\d+\s*)?$/.test(one))
      throw new Error(`--keys: not a Key or range: "${one}"`);
    const [from, to = from] = one.split("-").map(Number);
    if (to < from) throw new Error(`--keys: empty range "${one}"`);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  });
  if (!out.length || out.some((key) => !(key >= 1 && key <= 19)))
    throw new Error(`--keys: not Keys 1 to 19: "${text}"`);
  return [...new Set(out)];
}

/** A comma-separated option, each value one of `allowed`. */
function listOf<T extends string | number>(
  name: string,
  text: string,
  allowed: readonly T[],
): T[] {
  const out = text.split(",").map((one) => {
    const found = allowed.find((value) => String(value) === one.trim());
    if (found === undefined)
      throw new Error(`--${name} takes ${allowed.join(", ")}, not "${one}"`);
    return found;
  });
  return [...new Set(out)];
}

/** `--budget`: required for anything that may call a model, in USD. */
function budgetOf(text: string | undefined): number {
  const budget = Number(text);
  if (!text || !/^\d+(?:\.\d+)?$/.test(text.trim()) || !(budget > 0))
    throw new Error(
      `--budget <usd> is required, a positive number: what this run may spend (got "${text ?? ""}")`,
    );
  return budget;
}

/** `--max-requests`: a positive whole number, or none. */
function maxRequestsOf(text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  if (!/^\d+$/.test(text.trim()) || Number(text) < 1)
    throw new Error(
      `--max-requests takes a positive whole number, not "${text}"`,
    );
  return Number(text);
}

/** `--concurrency`: a positive whole number, 4 by default. */
function concurrencyOf(text: string | undefined): number {
  if (text === undefined) return 4;
  const n = Number(text);
  if (!/^\d+$/.test(text.trim()) || !Number.isInteger(n) || n < 1)
    throw new Error(
      `--concurrency takes a positive whole number, not "${text}"`,
    );
  return n;
}

function transportOf(text: string | undefined): TransportName {
  const out = text ?? "sync";
  if (out !== "sync" && out !== "batch")
    throw new Error(`--transport takes sync or batch, not "${out}"`);
  return out;
}

/**
 * Refuses to go on without a gateway key. Its value is never read here: the
 * AI SDK takes it from the environment, which `loom env --` loads.
 */
function requireGatewayKey() {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN)
    throw new Error(
      "No AI_GATEWAY_API_KEY in the environment: run through the pnpm translate-eval:* scripts, which use `loom env --`",
    );
}

/** A runtime with the gateway's prices: fetched now, or a run's saved ones. */
async function runtimeFor(
  out: string,
  models: readonly string[],
  options: { prices?: PriceList; concurrency?: number } = {},
): Promise<Runtime> {
  return {
    out,
    gateway: aiGateway(),
    prices: options.prices ?? (await fetchPrices(models)),
    ledger: new Ledger(ledgerPath(out)),
    log: (text) => console.log(text),
    concurrency: options.concurrency,
  };
}

/**
 * What a run would do: its requests (by group), their expected and
 * worst-case cost, what the experiment has spent and reserved, and whether
 * the budget check lets it start.
 */
function summarise(
  runtime: Runtime,
  requests: readonly ModelRequest[],
  transport: TransportName,
  budget: number,
  groupOf: (request: ModelRequest) => string = (one) => one.kind,
) {
  const table = new Map<
    string,
    { requests: number; expected: number; worst: number }
  >();
  for (const one of requests) {
    const row = table.get(groupOf(one)) ?? {
      requests: 0,
      expected: 0,
      worst: 0,
    };
    row.requests++;
    const figures = costs(runtime, [one], transport);
    row.expected += figures.expected;
    row.worst += figures.worst;
    table.set(groupOf(one), row);
  }
  console.table(
    [...table].map(([group, row]) => ({
      group,
      requests: row.requests,
      expected: usd(row.expected),
      "worst case": usd(row.worst),
    })),
  );
  const { expected, worst } = costs(runtime, requests, transport);
  const held = reserved(runtime.out);
  const calibrated = Object.entries(runtime.calibration ?? {})
    .map(
      ([kind, ratio]) =>
        `${kind} ${Math.min(ratio, CHARS_PER_TOKEN).toFixed(2)}`,
    )
    .join(", ");
  const refused = runRefusal(runtime, requests, transport, budget);
  console.log(
    [
      `${requests.length} requests by ${transport}: expected ${usd(expected)}, worst case ${usd(worst)}`,
      `(input at ${CHARS_PER_TOKEN} chars a token${calibrated ? `, or as measured: ${calibrated}` : ", until runs measure it"}${transport === "sync" ? "; priced as cache writes" : ""}; expected = output allowance per kind and effort, worst = maxOutputTokens)`,
      `spent so far ${usd(runtime.ledger.total())}${held ? ` + ${usd(held)} reserved for batches not yet collected` : ""} of the ${usd(EXPERIMENT_CAP_USD)} cap; --budget ${usd(budget)}`,
      transport === "batch"
        ? "A batch can't be stopped once started, so it is checked and reserved at its worst case."
        : "Sync holds each call in flight at its worst case and launches only what fits.",
      refused ? `REFUSED: ${refused}` : "within budget and cap",
      ...(refused && transport === "batch"
        ? [
            "Split a sweep this big into smaller runs (by --keys or --arms) so each batch's worst case fits.",
          ]
        : []),
    ].join("\n"),
  );
  return refused;
}

const groupOfRequest =
  (specs: ReadonlyMap<string, TranslateSpec>) => (request: ModelRequest) => {
    const spec = specs.get(request.id);
    return spec ? groupName(spec) : request.kind;
  };

async function run(out: string, v: Values) {
  const budget = budgetOf(v.budget);
  const transport = transportOf(v.transport);
  if (v["retry-failed"]) return rerun(out, v["retry-failed"], v, "retry");
  if (v.resume) return rerun(out, v.resume, v, "resume");
  const data = evalData(out);
  const model = modelId(v.model ?? "opus");
  const specs = planSpecs({
    keys: parseKeys(v.keys),
    arms: listOf("arms", v.arms ?? "A2,A3", ARMS),
    tasks: listOf("tasks", v.tasks ?? "1,2", [1, 2] as const),
    books: listOf("books", v.books ?? "open,closed", [
      "open",
      "closed",
    ] as const),
    model,
    efforts: efforts(v.effort ?? "medium"),
  });
  const folds = new Map(data.folds.map((fold) => [fold.key, fold]));
  const most = maxRequestsOf(v["max-requests"]);
  if (most !== undefined && specs.length > most) {
    console.log(
      `--max-requests ${most}: running the first ${most} of ${specs.length} requests`,
    );
    specs.length = most;
  }
  const requests = specs.map((spec) =>
    translateRequest(folds.get(spec.key) as Fold, spec, data),
  );
  const runtime = await runtimeFor(out, [model], {
    concurrency: concurrencyOf(v.concurrency),
  });
  const bySpec = new Map(requests.map((one, i) => [one.id, specs[i]]));
  const refused = summarise(
    runtime,
    requests,
    transport,
    budget,
    groupOfRequest(bySpec),
  );
  if (v["dry-run"]) return console.log("Dry run: no call made.");
  if (refused) throw new Error(`Refused: ${refused}`);
  requireGatewayKey();
  const runId = newRunId(v.label ?? `translate-${shortName(model)}`);
  const dir = createRunDir(out, runId);
  writeJson(join(dir, "prices.json"), runtime.prices);
  const manifest: Manifest = {
    runId,
    kind: "translate",
    createdAt: new Date().toISOString(),
    transport,
    budget,
    projection: costs(runtime, requests, transport).expected,
    worstCase: costs(runtime, requests, transport).worst,
    requests: requests.map((one, i) =>
      manifestRequest(one, { translate: specs[i] }),
    ),
  };
  writeJson(join(dir, "manifest.json"), manifest);
  console.log(`Run ${runId}`);
  await execute(runtime, { run: runId, dir, requests, transport, budget });
  if (transport === "batch")
    console.log(
      `Batch started and saved. Finish it with: pnpm translate-eval:collect ${runId}`,
    );
  else printRun(out, runId, data, v.probe);
}

/**
 * Runs a run's requests again under its original specs. "retry": those that
 * failed (not those whose reply came back normally but unreadable). "resume":
 * those never run at all (skipped at the budget, or lost in a crash).
 */
async function rerun(
  out: string,
  runId: string,
  v: Values,
  mode: "retry" | "resume",
) {
  const budget = budgetOf(v.budget);
  const dir = runDir(out, runId);
  const manifest = readJson<Manifest>(join(dir, "manifest.json"));
  if (!manifest) throw new Error(`No run ${runId}`);
  const transport = transportOf(v.transport ?? manifest.transport);
  const data = evalData(out);
  const requests = pendingRequests(
    dir,
    rebuildRequests(manifest, data),
    mode === "retry",
  );
  const prices = readJson<PriceList>(join(dir, "prices.json"));
  const runtime = await runtimeFor(
    out,
    [...new Set(requests.map((one) => one.model))],
    {
      prices,
      concurrency: concurrencyOf(v.concurrency),
    },
  );
  const refused = summarise(runtime, requests, transport, budget);
  const booked = failedBooking(
    runtime.ledger,
    runId,
    requests.map((one) => one.id),
  );
  console.log(
    [
      `${mode === "retry" ? "Retrying" : "Resuming"} ${requests.map((one) => one.id).join(", ") || "nothing"}`,
      ...(mode === "retry"
        ? [
            `Their ${booked.attempts} failed attempts are booked at ${usd(booked.cost)}, ${usd(booked.unknown)} of it at worst case because the real cost isn't known (try \`spent --reconcile\`).`,
          ]
        : []),
    ].join("\n"),
  );
  if (v["dry-run"]) return console.log("Dry run: no call made.");
  if (refused) throw new Error(`Refused: ${refused}`);
  if (!requests.length) return;
  requireGatewayKey();
  manifest.retries = [
    ...(manifest.retries ?? []),
    {
      at: new Date().toISOString(),
      ids: requests.map((one) => one.id),
      transport,
      ...(mode === "resume" ? { resume: true } : {}),
    },
  ];
  writeJson(join(dir, "manifest.json"), manifest);
  await execute(runtime, { run: runId, dir, requests, transport, budget });
  if (transport === "batch")
    console.log(`Finish it with: pnpm translate-eval:collect ${runId}`);
  else if (manifest.kind === "probe")
    printProbe(scoreProbe(out, runId, data.rows));
  else printRun(out, runId, data, v.probe);
}

async function collectCommand(out: string, runId: string, v: Values) {
  const dir = runDir(out, runId);
  const manifest = readJson<Manifest>(join(dir, "manifest.json"));
  if (!manifest) throw new Error(`No run ${runId}`);
  requireGatewayKey();
  const runtime = await runtimeFor(out, [], {
    prices: readJson<PriceList>(join(dir, "prices.json")),
  });
  const rebuild = (ids: readonly string[]) => {
    const all = rebuildRequests(manifest, evalData(out));
    return all.filter((one) => ids.includes(one.id));
  };
  while (!(await collect(runtime, runId, dir, manifest.requests, rebuild))) {
    if (!v.wait)
      return console.log(
        "Not finished; run collect again later (or pass --wait).",
      );
    await setTimeout(60_000);
  }
  const data = evalData(out);
  if (manifest.kind === "probe") printProbe(scoreProbe(out, runId, data.rows));
  else printRun(out, runId, data, v.probe);
}

async function judgeCommand(out: string, runId: string, v: Values) {
  const budget = budgetOf(v.budget);
  const dir = runDir(out, runId);
  const manifest = readJson<Manifest>(join(dir, "manifest.json"));
  if (!manifest) throw new Error(`No run ${runId}`);
  const data = evalData(out);
  const { scored } = scoreRequests(manifest, dir, data);
  const judgedPath = join(dir, "judged.json");
  const runtime = await runtimeFor(out, [JUDGES.opus.model, JUDGES.gpt.model]);
  if (!v["dry-run"]) requireGatewayKey();
  const result = await runJudges(runtime, {
    run: `${runId}-judge`,
    dir: join(dir, "judge"),
    cases: runJudgeCases(scored, data),
    existing: readJson<Record<string, JudgedRows>>(judgedPath) ?? {},
    budget,
    dryRun: Boolean(v["dry-run"]),
    retry: Boolean(v["retry-failed"]),
    source: runId,
  });
  if (result.failed.length)
    console.log(
      `Judge calls that failed outright, waiting for --retry-failed: ${result.failed.join(", ")}`,
    );
  if (v["dry-run"])
    return console.log(
      `Dry run: ${result.requests} judge calls, expected ${usd(result.projected)}, worst case ${usd(result.worst)}; spent so far ${usd(spentSoFar(runtime))}; ${result.refused ? `REFUSED: ${result.refused}` : "within budget and cap"}. No call made.`,
    );
  console.log(
    `${result.reused} rows took both rulings from earlier judging of the same translation (verdicts.json).`,
  );
  writeJson(judgedPath, result.judged);
  console.log("Judged:", judgedCounts(Object.values(result.judged)));
  printRun(out, runId, data, v.probe);
}

async function judgeA1(out: string, v: Values) {
  const budget = budgetOf(v.budget);
  const data = evalData(out);
  const flat = readJson<JudgedRows>(a1JudgedPath(out)) ?? {};
  const cases = a1JudgeCases(data, flat);
  const existing = Object.fromEntries(
    cases.map((one) => [
      one.answer,
      Object.fromEntries(
        Object.entries(flat).filter(([row]) => row.startsWith(`${one.key}.`)),
      ),
    ]),
  );
  const runtime = await runtimeFor(out, [JUDGES.opus.model, JUDGES.gpt.model]);
  if (!v["dry-run"]) requireGatewayKey();
  const result = await runJudges(runtime, {
    run: "a1-judge",
    dir: join(out, "a1", "judge"),
    cases,
    existing,
    budget,
    dryRun: Boolean(v["dry-run"]),
    retry: Boolean(v["retry-failed"]),
    source: "A1",
  });
  if (result.failed.length)
    console.log(
      `Judge calls that failed outright, waiting for --retry-failed: ${result.failed.join(", ")}`,
    );
  if (v["dry-run"])
    return console.log(
      `Dry run: ${result.requests} judge calls over ${cases.reduce((a, one) => a + one.rows.length, 0)} rows, expected ${usd(result.projected)}, worst case ${usd(result.worst)}; spent so far ${usd(spentSoFar(runtime))}; ${result.refused ? `REFUSED: ${result.refused}` : "within budget and cap"}. No call made.`,
    );
  console.log(
    `${result.reused} rows took both rulings from earlier judging of the same translation (verdicts.json).`,
  );
  const merged: JudgedRows = { ...flat };
  for (const rows of Object.values(result.judged)) Object.assign(merged, rows);
  writeJson(a1JudgedPath(out), merged);
  console.log("A1 judged:", judgedCounts([merged]));
  console.log(
    "Run `pnpm translate-eval:baseline` to see A1's figures with them.",
  );
}

async function probeCommand(out: string, v: Values) {
  const budget = budgetOf(v.budget);
  if (v["retry-failed"]) return rerun(out, v["retry-failed"], v, "retry");
  if (v.resume) return rerun(out, v.resume, v, "resume");
  const model = modelId(v.model ?? "opus");
  const [effort, ...more] = efforts(v.effort ?? "medium");
  if (more.length) throw new Error("probe takes one --effort");
  const data = evalData(out);
  const plan = probePlan(data.rows, parseKeys(v.keys), model, effort);
  const requests = plan.map((one) => one.request);
  const runtime = await runtimeFor(out, [model]);
  const refused = summarise(runtime, requests, "sync", budget);
  if (v["dry-run"]) return console.log("Dry run: no call made.");
  if (refused) throw new Error(`Refused: ${refused}`);
  requireGatewayKey();
  const runId = newRunId(v.label ?? `probe-${shortName(model)}`);
  const dir = createRunDir(out, runId);
  writeJson(join(dir, "prices.json"), runtime.prices);
  writeJson(join(dir, "manifest.json"), {
    runId,
    kind: "probe",
    createdAt: new Date().toISOString(),
    transport: "sync",
    budget,
    projection: costs(runtime, requests, "sync").expected,
    worstCase: costs(runtime, requests, "sync").worst,
    requests: plan.map((one) => one.manifest),
  } satisfies Manifest);
  console.log(`Run ${runId}`);
  await execute(runtime, {
    run: runId,
    dir,
    requests,
    transport: "sync",
    budget,
  });
  printProbe(scoreProbe(out, runId, data.rows));
}

function printProbe(file: ProbeFile) {
  console.table(
    Object.entries(file.keys).map(([key, one]) => ({
      key: Number(key),
      english: one.english ? `${one.english.matched}/${one.english.rows}` : "–",
      enochian: one.enochian
        ? `${one.enochian.matched}/${one.enochian.rows}`
        : "–",
      flagged: one.flagged ? "yes" : "",
      note: [
        one.incomplete ? "incomplete" : "",
        one.english?.error || one.enochian?.error ? "reply not as asked" : "",
      ]
        .filter(Boolean)
        .join(", "),
    })),
  );
  console.log(
    `Flagged (recited at least half in order): ${file.flagged.join(", ") || "none"}. Written to runs/${file.runId}/probe.json`,
  );
}

/** Scores a run from its saved replies and prints it, with the bars it allows. */
function printRun(
  out: string,
  runId: string,
  data: EvalData,
  probeRun?: string,
) {
  const result = scoreRun(out, runId, data);
  for (const group of result.groups)
    console.log(
      line(`${group.name} (Keys ${group.keys.join(",")})`, group.report),
    );
  for (const one of result.scored.filter((s) => s.failure))
    console.log(`  ${one.id}: ${one.failure} (every row counted missing)`);
  if (result.notRun.length) console.log(`Not run: ${result.notRun.join(", ")}`);
  const judged = readJson<Record<string, JudgedRows>>(
    join(runDir(out, runId), "judged.json"),
  );
  if (judged) console.log("Judged:", judgedCounts(Object.values(judged)));
  const flagsFor = (model: string, need: readonly number[]) => {
    const flags = loadProbeFlags(out, model, probeRun, need);
    if (flags)
      console.log(
        `Probe ${flags.run} (${shortName(model)}): probed ${[...flags.probed].join(",")}; flagged ${[...flags.flagged].join(",") || "none"}`,
      );
    return flags;
  };
  for (const bars of runBars(result.groups, flagsFor)) {
    console.log(
      `Bars, ${shortName(bars.model)} ${bars.effort} (on the Keys this run has):`,
    );
    if (bars.error) console.log(`  not measured: ${bars.error}`);
    else if (bars.results) console.table(barRows(bars.results));
  }
  console.log(`Written to ${runDir(out, runId)}`);
}

async function spentCommand(out: string, v: Values) {
  if (v.reconcile) {
    requireGatewayKey();
    const runtime = await runtimeFor(out, [], { prices: {} });
    const done = await reconcile(runtime);
    console.log(
      `Reconciled ${done.fixed} failed calls (change ${usd(done.change)}).${done.left.length ? ` Still unknown, kept at worst case: ${done.left.join(", ")}` : ""}`,
    );
  }
  const totals = ledgerTotals(new Ledger(ledgerPath(out)).entries());
  if (!Object.keys(totals.byRun).length)
    console.log("No calls in the ledger yet.");
  const table = (rows: typeof totals.byModel) =>
    console.table(
      Object.entries(rows).map(([name, one]) => ({
        name,
        calls: one.calls,
        cost: usd(one.cost),
        estimated: usd(one.estimated),
        "unknown (worst case)": usd(one.unknown),
      })),
    );
  if (Object.keys(totals.byRun).length) {
    table(totals.byModel);
    table(totals.byRun);
  }
  const held = reserved(out);
  console.log(
    `Spent ${usd(totals.total)}${totals.unknown ? ` (${usd(totals.unknown)} of it failed calls booked at worst case; \`spent --reconcile\` looks them up)` : ""}${held ? ` + ${usd(held)} reserved for batches not yet collected` : ""} of the ${usd(EXPERIMENT_CAP_USD)} cap.`,
  );
}

// --- Arguments ----------------------------------------------------------------

const OPTIONS = {
  out: { type: "string", default: DEFAULT_OUT },
  keys: { type: "string" },
  arms: { type: "string" },
  tasks: { type: "string" },
  books: { type: "string" },
  model: { type: "string" },
  effort: { type: "string" },
  transport: { type: "string" },
  budget: { type: "string" },
  label: { type: "string" },
  probe: { type: "string" },
  concurrency: { type: "string" },
  "retry-failed": { type: "string" },
  resume: { type: "string" },
  "max-requests": { type: "string" },
  "dry-run": { type: "boolean" },
  wait: { type: "boolean" },
  reconcile: { type: "boolean" },
} as const;

type Values = Partial<
  Record<
    Exclude<keyof typeof OPTIONS, "dry-run" | "wait" | "reconcile">,
    string
  >
> & { "dry-run"?: boolean; wait?: boolean; reconcile?: boolean };

const USAGE = `usage: cli.ts <command> [options]
  testset | baseline                       offline: the test set; arm A1
  run --keys K --model opus|fable|gpt --effort high,medium --arms A0,A2,A2c,A3
      --tasks 1,2 --books open,closed --transport sync|batch --budget USD
      [--dry-run] [--label L] [--max-requests N]
  run --retry-failed RUN --budget USD      re-run the run's failed requests
  run --resume RUN --budget USD            run the requests it never ran
  collect RUN [--wait]                     finish a batch run
  judge RUN --budget USD [--dry-run] [--retry-failed]
  judge-a1 --budget USD [--dry-run] [--retry-failed]
  probe --keys K --model M --effort E --budget USD [--dry-run]
  report RUN [--probe RUN]                 re-score from saved replies
  spent [--reconcile]                      the ledger's totals; look up the
                                           real cost of failed calls
  (all take --out DIR; default ${DEFAULT_OUT})

The budget check and the cap read one ledger, in one --out, as one process
sees it: never run two of these commands at once, and use the same --out
(the default) for every run of the experiment.`;

async function main() {
  // pnpm passes a script's "--" through; parseArgs would read the rest as
  // positionals.
  const args = process.argv.slice(2);
  const dashes = args.indexOf("--");
  if (dashes >= 0) args.splice(dashes, 1);
  // `judge --retry-failed` takes no run id; let the flag stand alone there.
  const { values, positionals } = parseArgs({
    args: args.map((one) =>
      one === "--retry-failed" && args[0]?.startsWith("judge")
        ? "--retry-failed=1"
        : one,
    ),
    allowPositionals: true,
    options: OPTIONS,
  });
  const out = values.out as string;
  const [command, runId] = positionals;
  const needRun = () => {
    if (!runId) throw new Error(`${command} needs a run id`);
    return runId;
  };
  if (command === "testset") testset(out);
  else if (command === "baseline") baseline(out);
  else if (command === "run") await run(out, values);
  else if (command === "collect") await collectCommand(out, needRun(), values);
  else if (command === "judge") await judgeCommand(out, needRun(), values);
  else if (command === "judge-a1") await judgeA1(out, values);
  else if (command === "probe") await probeCommand(out, values);
  else if (command === "report")
    printRun(out, needRun(), evalData(out), values.probe);
  else if (command === "spent") await spentCommand(out, values);
  else {
    console.error(USAGE);
    process.exitCode = 2;
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
