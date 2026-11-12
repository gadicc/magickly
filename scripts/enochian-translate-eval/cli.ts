import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import dictionary from "magick-data/enochian/dictionary";
import keys from "magick-data/enochian/keys";
import {
  a1kNewText,
  a1NewText,
  a1Scores,
  type BaselineAnswers,
  markHard,
} from "./baseline.ts";
import { cipher } from "./cipher.ts";
import {
  serialiseContext,
  serialiseDictionary,
  task1Input,
  task2Input,
} from "./context.ts";
import { barRows, line, pct, usd } from "./format.ts";
import {
  JUDGES,
  type JudgedRows,
  judgedCounts,
  newJudgeRequest,
} from "./judge.ts";
import {
  CHARS_PER_TOKEN,
  EXPERIMENT_CAP_USD,
  fetchPrices,
  Ledger,
  ledgerTotals,
  type PriceList,
  planPriceList,
  type TransportName,
} from "./ledger.ts";
import {
  type Effort,
  efforts,
  MODELS,
  modelId,
  OUTPUT_ALLOWANCE,
  shortName,
} from "./models.ts";
import { barValues, measureNewTextBars, type NewBarInputs } from "./newbars.ts";
import {
  NEW_ARMS,
  type NewSpec,
  newRequest,
  planNewSpecs,
  SUBSETS,
  subsetSentences,
  type Task3Sentence,
} from "./newprompt.ts";
import {
  a1kPooled,
  BASELINE_ANSWERS,
  type BarRun,
  barGroup,
  cacheCheck,
  cacheProjection,
  judgeTask3,
  mergeRoundTrips,
  newBaselineDir,
  newBaselineJudgedPath,
  newBaselineScores,
  newGroupName,
  newRunJudgeCases,
  opusBlocked,
  retryBlocked,
  roundTripPlan,
  scoreNewRequests,
  scoreNewRun,
  task3Pool,
  task3Summary,
} from "./newrunner.ts";
import {
  applyNewVerdicts,
  FIGURE_GROUPS,
  type FigureGroup,
  measureNewBar,
  type NewFigures,
  type NewTextBar,
  newReport,
  newTextContext,
  scoreNewText,
} from "./newscore.ts";
import {
  aethyrSlots,
  buildNewText,
  leitchCounts,
  leitchMatches,
  NEWTEXT_DEFAULTS,
  type NewTextSet,
  newTextRows,
  topUpOptions,
  withPlantedKnowns,
} from "./newtext.ts";
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
  blockedAttempts,
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
  type RunKind,
  type Runtime,
  readJson,
  readRaw,
  rebuildRequests,
  reconcile,
  reserved,
  runBars,
  runDir,
  runJudgeCases,
  runJudges,
  runRefusal,
  runsDir,
  scoreProbe,
  scoreRequests,
  scoreRun,
  spentSoFar,
  writeJson,
} from "./runner.ts";
import { joinScores, report } from "./score.ts";
import {
  roundTripCases,
  roundTripJudgeRequest,
  rubricCases,
  rubricRequest,
  type Task3Report,
} from "./task3.ts";
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
 *   pnpm translate-eval:newtext [--seed N]    the new text, into data/
 *   pnpm translate-eval:newtext-baseline      A1 and A1k on the new text
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

// --- The new text ---------------------------------------------------------------

/** The committed new text (plan 077, "The new text"). */
const NEWTEXT = fileURLToPath(new URL("./data/newtext.json", import.meta.url));

const BIOME = fileURLToPath(
  new URL("../../node_modules/.bin/biome", import.meta.url),
);

/** The seed of the committed set: the plan's number. */
const NEWTEXT_SEED = 77;

/**
 * Leitch's lexicon, extracted from a copyrighted book: private, never in the
 * repository. Only its first column (the forms) is read, and only counts go
 * into the set file.
 */
const LEITCH = join(
  homedir(),
  "Documents/Magick/Enochian/derived/leitch-vol2/lexicon.tsv",
);

/** The forms of Leitch's lexicon (its `word` column), or none without it. */
function leitchForms(path: string) {
  if (!existsSync(path)) return undefined;
  const text = readFileSync(path);
  const forms = text
    .toString("utf8")
    .split("\n")
    .slice(1)
    .map((line) => line.split("\t")[0]?.trim() ?? "")
    .filter((one) => /^[A-Za-z]+$/.test(one));
  return { forms, sha256: createHash("sha256").update(text).digest("hex") };
}

function newtext(v: Values) {
  const seed = v.seed ? Number(v.seed) : NEWTEXT_SEED;
  if (!Number.isInteger(seed)) throw new Error("--seed must be an integer");
  const path = v.set ?? NEWTEXT;
  const rows = v.rows ? Number(v.rows) : NEWTEXT_DEFAULTS.rows;
  if (!Number.isInteger(rows) || rows < 50)
    throw new Error("--rows must be a whole number, 50 or more");
  if (
    (rows !== NEWTEXT_DEFAULTS.rows || seed !== NEWTEXT_SEED) &&
    path === NEWTEXT
  )
    throw new Error(
      "Only seed 77's full set is the committed one: give --set FILE for any other",
    );
  const set = buildNewText(
    { dictionary, rows: rowsFromKeys(keys), exclude: aethyrSlots(keys) },
    { seed, ...(rows === NEWTEXT_DEFAULTS.rows ? {} : topUpOptions(rows)) },
  );
  const leitch = leitchForms(v.leitch ?? LEITCH);
  if (leitch) {
    set.meta.leitch = leitchCounts(set, leitch.forms, leitch.sha256);
    // Headwords only, never a gloss.
    for (const one of leitchMatches(set, leitch.forms))
      console.log(
        `Leitch: ${one.row} ${one.word} is within one letter of ${one.leitch}`,
      );
  } else console.log("Leitch's lexicon not found: the check is left out.");
  write(path, json(set));
  // As the repository's formatter writes JSON, so a regenerated file passes
  // `biome check` and diffs cleanly; a file outside the repository (a
  // top-up set elsewhere) is left as written, since biome ignores it.
  const repo = fileURLToPath(new URL("../../", import.meta.url));
  if (resolve(path).startsWith(repo))
    execFileSync(BIOME, ["format", "--write", path], { stdio: "ignore" });
  const { leitch: counts, ...meta } = set.meta;
  console.log(JSON.stringify(meta, null, 2));
  if (counts) console.log("Leitch:", JSON.stringify(counts.groups));
  console.log(`Written to ${path}`);
}

function readNewText(path: string): NewTextSet {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** A share as "12.5% [8.1–18.0]". */
const withInterval = (one: { share: number; interval: [number, number] }) =>
  `${pct(one.share)} [${pct(one.interval[0])}–${pct(one.interval[1])}]`;

/** One report's groups as a table's rows. */
function newTable(report: Record<FigureGroup, NewFigures>) {
  return (Object.keys(FIGURE_GROUPS) as FigureGroup[]).map((group) => {
    const one = report[group];
    return {
      group,
      rows: one.rows,
      right: `${one.right.count} ${withInterval(one.right)}`,
      "to judge": one.toJudge,
      "if judged": pct(one.ifJudged.share),
      recalled: one.recalled.rows ? one.recalled.count : "",
      "plant fails": one.plantFailures.rows ? one.plantFailures.count : "",
      "silent/100": one.silentInventionsPer100.toFixed(2),
      hedged: one.hedged,
      unknown: one.counts.unknown ?? 0,
    };
  });
}

/**
 * A1 and A1k on the new text, both tasks, scored by script, with the judges'
 * verdicts on their task-1 rows where `judge-newtext-a1` has them; rows not
 * yet judged stay to judge. With `--bars FILE` (a JSON list
 * of `NewTextBar`), each bar is measured on both arms.
 */
function newtextBaseline(out: string, v: Values) {
  const set = readNewText(v.set ?? NEWTEXT);
  const rows = newTextRows(set);
  const shown = withPlantedKnowns(dictionary, set.plantedKnowns);
  const keyRows = rowsFromKeys(keys);
  const context = newTextContext(shown, keyRows);
  const arms: Record<string, BaselineAnswers> = {
    A1: a1NewText(rows, shown, keyRows),
    A1k: a1kNewText(rows, shown, keyRows),
  };
  const bars: NewTextBar[] = v.bars
    ? JSON.parse(readFileSync(v.bars, "utf8"))
    : [];
  const reports: Record<string, unknown> = {};
  // The judges' verdicts on their task-1 rows (`judge-newtext-a1`).
  const judged =
    readJson<Record<string, JudgedRows>>(
      newBaselineJudgedPath(out, set.seed),
    ) ?? {};
  for (const [arm, answers] of Object.entries(arms))
    for (const task of [1, 2] as const) {
      const scores = scoreNewText(
        rows,
        task === 1 ? answers.task1 : answers.task2,
        task,
        context,
      );
      if (task === 1)
        applyNewVerdicts(
          scores,
          judged[BASELINE_ANSWERS[arm as keyof typeof BASELINE_ANSWERS]],
        );
      const report = newReport(scores);
      reports[`${arm}-task${task}`] = {
        report,
        bars: bars
          .filter((bar) => bar.task === task)
          .map((bar) => measureNewBar(report, bar)),
        rows: scores.rows,
      };
      console.log(
        `\n${arm}, task ${task} (unaligned items ${report.unaligned})`,
      );
      console.table(newTable(report));
      for (const bar of bars.filter((one) => one.task === task)) {
        const r = measureNewBar(report, bar);
        console.log(
          `  bar ${bar.id}: ${r.measured.count} of ${r.measured.rows} (${withInterval(r.measured)}) ${bar.kind === "min" ? "≥" : "≤"} ${pct(bar.value)}: ${r.met ? "met" : "not met"}${r.marginal ? ", marginal" : ""}`,
        );
      }
    }
  const dir = newBaselineDir(out, set.seed);
  write(join(dir, "report.json"), json(reports));
  write(join(dir, "answers.json"), json(arms));
  console.log(`\nWritten to ${dir}`);
}

// --- The model runner ---------------------------------------------------------

/** The grammar notes A3 adds, from the data package. */
const GRAMMAR = fileURLToPath(
  new URL(
    "../../packages/magick-data/src/enochian/grammar.md",
    import.meta.url,
  ),
);

/** Task 3's sentences (plan 077, "Tasks"), committed. */
const TASK3 = fileURLToPath(
  new URL("./data/task3-sentences.json", import.meta.url),
);

/**
 * The test set, its folds marked with A1's (judged) outcomes, the notes, the
 * new text (the committed set, or `newTextFile`) and task 3's sentences.
 */
function evalData(out: string, newTextFile?: string): EvalData {
  const data = source();
  return {
    ...data,
    grammar: readFileSync(GRAMMAR, "utf8"),
    folds: markFolds(buildTestSet(data), data.dictionary, out),
    newText: readNewText(newTextFile ?? NEWTEXT),
    task3: (
      JSON.parse(readFileSync(TASK3, "utf8")) as {
        sentences: Task3Sentence[];
      }
    ).sentences,
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
  const set = setOf(v.set);
  if (set !== "folds") return runNew(out, v, set, budget, transport);
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
    prices: await pricesFor(out, [model], v),
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
  const data = evalData(out, manifest.newTextFile);
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
  else printAny(out, runId, v.probe);
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
    const all = rebuildRequests(manifest, evalData(out, manifest.newTextFile));
    return all.filter((one) => ids.includes(one.id));
  };
  while (!(await collect(runtime, runId, dir, manifest.requests, rebuild))) {
    if (!v.wait)
      return console.log(
        "Not finished; run collect again later (or pass --wait).",
      );
    await setTimeout(60_000);
  }
  if (manifest.kind === "newtext" || manifest.kind === "task3") {
    const blocked = rebuildRequests(
      manifest,
      evalData(out, manifest.newTextFile),
    ).filter((one) => {
      const raw = readRaw(dir, one.id);
      return (
        raw?.finishReason === "content-filter" &&
        blockedAttempts(dir, one.id) === 1
      );
    });
    if (blocked.length)
      console.log(
        `Blocked by the provider's filter: ${blocked.map((one) => one.id).join(", ")}. Plan 077 retries each once: pnpm translate-eval:run -- --retry-failed ${runId} --budget USD`,
      );
  }
  printAny(out, runId, v.probe);
}

async function judgeCommand(out: string, runId: string, v: Values) {
  const budget = budgetOf(v.budget);
  const dir = runDir(out, runId);
  const manifest = readJson<Manifest>(join(dir, "manifest.json"));
  if (!manifest) throw new Error(`No run ${runId}`);
  const data = evalData(out, manifest.newTextFile);
  const isNew = manifest.kind === "newtext";
  const judgedPath = join(dir, "judged.json");
  const models = [JUDGES.opus.model, JUDGES.gpt.model];
  const runtime = await runtimeFor(out, models, {
    prices: await pricesFor(out, models, v),
  });
  if (!v["dry-run"]) requireGatewayKey();
  const result = await runJudges(runtime, {
    run: `${runId}-judge`,
    dir: join(dir, "judge"),
    cases: isNew
      ? newRunJudgeCases(scoreNewRequests(manifest, dir, data).scored, data)
      : runJudgeCases(scoreRequests(manifest, dir, data).scored, data),
    ...(isNew ? { request: newJudgeRequest } : {}),
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
  printAny(out, runId, v.probe);
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
  const judgeModels = [JUDGES.opus.model, JUDGES.gpt.model];
  const runtime = await runtimeFor(out, judgeModels, {
    prices: await pricesFor(out, judgeModels, v),
  });
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
  const runtime = await runtimeFor(out, [model], {
    prices: await pricesFor(out, [model], v),
  });
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

// --- The new text and task 3 ------------------------------------------------------

/**
 * Prices for a projection: `--prices FILE` (a saved list), or with
 * `--offline` the price lists saved by earlier runs, and plan 077's prices
 * for any model none has (`planPriceList`); otherwise fetched. Offline prices
 * are for dry runs only: a real run fetches the list and saves it.
 */
async function pricesFor(
  out: string,
  models: readonly string[],
  v: Values,
  planning = false,
): Promise<PriceList> {
  if ((v.prices || v.offline) && !v["dry-run"] && !planning)
    throw new Error("--offline and --prices are for --dry-run only");
  if (v.prices) return JSON.parse(readFileSync(v.prices, "utf8"));
  if (!v.offline) return fetchPrices(models);
  const saved: PriceList = {};
  const runs = runsDir(out);
  for (const name of existsSync(runs) ? readdirSync(runs).sort().reverse() : [])
    for (const [id, row] of Object.entries(
      readJson<PriceList>(join(runs, name, "prices.json")) ?? {},
    ))
      saved[id] ??= row;
  const wanted = [...new Set(models)];
  const missing = wanted.filter((one) => !saved[one] || !saved[`${one}-batch`]);
  const have = wanted.filter((one) => !missing.includes(one));
  console.log(
    `Offline prices: ${have.map(shortName).join(", ") || "none"} from a saved price list${missing.length ? `; ${missing.map(shortName).join(", ")} from plan 077's prices of 11 November` : ""}.`,
  );
  return {
    ...Object.fromEntries(
      have.flatMap((one) => [
        [one, saved[one]],
        [`${one}-batch`, saved[`${one}-batch`]],
      ]),
    ),
    ...planPriceList(missing),
  };
}

/**
 * The expected cost of some requests with cache reads and without (batch:
 * the same, since batch requests carry no cache breakpoints).
 */
function printCacheProjection(
  runtime: Runtime,
  requests: readonly ModelRequest[],
  transport: TransportName,
) {
  const { withReads, without } = cacheProjection(
    requests,
    runtime.prices,
    transport,
    runtime.calibration ?? {},
  );
  console.log(
    `Expected with cache reads ${usd(withReads)}, without ${usd(without)} (each prefix's first call writes it, the rest read it${transport === "batch" ? "; batch requests carry no cache breakpoints and are priced as plain input, so both are the same" : ""}).`,
  );
}

/** `--set`: which test `run` builds. */
function setOf(text: string | undefined): "folds" | "new" | "task3" {
  const out = text ?? "folds";
  if (out !== "folds" && out !== "new" && out !== "task3")
    throw new Error(`run --set takes folds, new or task3, not "${out}"`);
  return out;
}

/** A run on the new text (tasks 1 and 2) or task 3. */
async function runNew(
  out: string,
  v: Values,
  set: "new" | "task3",
  budget: number,
  transport: TransportName,
) {
  const data = evalData(out, v.newtext);
  const model = modelId(v.model ?? "opus");
  const [subset, ...more] = listOf("subset", v.subset ?? "all", SUBSETS);
  if (more.length) throw new Error("--subset takes one subset");
  const specs = planNewSpecs(
    {
      arms: listOf("arms", v.arms ?? "A0,A2,A3", NEW_ARMS),
      tasks:
        set === "task3"
          ? [3]
          : listOf("tasks", v.tasks ?? "1,2", [1, 2] as const),
      subset,
      model,
      efforts: efforts(v.effort ?? "medium"),
    },
    data,
  );
  const most = maxRequestsOf(v["max-requests"]);
  if (most !== undefined && specs.length > most) {
    console.log(
      `--max-requests ${most}: running the first ${most} of ${specs.length} requests`,
    );
    specs.length = most;
  }
  const requests = specs.map((spec) => newRequest(spec, data));
  const runtime = await runtimeFor(out, [model], {
    prices: await pricesFor(out, [model], v),
    concurrency: concurrencyOf(v.concurrency),
  });
  const bySpec = new Map(requests.map((one, i) => [one.id, specs[i]]));
  const refused = summarise(runtime, requests, transport, budget, (one) =>
    newGroupName(bySpec.get(one.id) as NewSpec),
  );
  printCacheProjection(runtime, requests, transport);
  if (v["dry-run"]) return console.log("Dry run: no call made.");
  if (refused) throw new Error(`Refused: ${refused}`);
  requireGatewayKey();
  const kind: RunKind = set === "task3" ? "task3" : "newtext";
  const runId = newRunId(v.label ?? `${kind}-${shortName(model)}`);
  const dir = createRunDir(out, runId);
  writeJson(join(dir, "prices.json"), runtime.prices);
  writeJson(join(dir, "manifest.json"), {
    runId,
    kind,
    createdAt: new Date().toISOString(),
    transport,
    budget,
    projection: costs(runtime, requests, transport).expected,
    worstCase: costs(runtime, requests, transport).worst,
    ...(v.newtext ? { newTextFile: v.newtext } : {}),
    requests: requests.map((one, i) =>
      manifestRequest(one, { newtext: specs[i] }),
    ),
  } satisfies Manifest);
  console.log(`Run ${runId}`);
  const before = runtime.ledger.total();
  await execute(runtime, { run: runId, dir, requests, transport, budget });
  if (transport === "batch")
    return console.log(
      `Batch started and saved. Finish it with: pnpm translate-eval:collect ${runId}`,
    );
  await retryBlocked(runtime, {
    run: runId,
    dir,
    requests,
    budget: budget - (runtime.ledger.total() - before),
  });
  printAny(out, runId, v.probe);
}

/** One new-text report as a table's rows. */
function printNewRun(out: string, runId: string, data: EvalData) {
  const result = scoreNewRun(out, runId, data);
  for (const group of result.groups) {
    console.log(`\n${group.name} (${group.parts} parts)`);
    console.table(newTable(group.report));
  }
  for (const one of result.scored.filter((s) => s.failure))
    console.log(`  ${one.id}: ${one.failure} (every row counted missing)`);
  if (result.notRun.length) console.log(`Not run: ${result.notRun.join(", ")}`);
  console.log(
    `Calls ${result.blocked.calls}, blocked by the provider's filter ${result.blocked.blocked}${result.blocked.ids.length ? ` (${result.blocked.ids.join(", ")})` : ""}.`,
  );
  const judged = readJson<Record<string, JudgedRows>>(
    join(runDir(out, runId), "judged.json"),
  );
  if (judged) console.log("Judged:", judgedCounts(Object.values(judged)));
  console.log(`Written to ${runDir(out, runId)}`);
}

/** Scores and prints a run of any kind from its saved replies. */
function printAny(out: string, runId: string, probeRun?: string) {
  const manifest = readJson<Manifest>(
    join(runDir(out, runId), "manifest.json"),
  );
  if (!manifest) throw new Error(`No run ${runId}`);
  const data = evalData(out, manifest.newTextFile);
  if (manifest.kind === "probe")
    return printProbe(scoreProbe(out, runId, data.rows));
  if (manifest.kind === "newtext") return printNewRun(out, runId, data);
  if (manifest.kind === "task3" || manifest.kind === "roundtrip") {
    const pool = task3Pool(out, data);
    if (manifest.kind === "roundtrip") {
      const merged = mergeRoundTrips(out, runId, pool.candidates);
      console.log(
        `Round trips saved: ${merged.added}${merged.left.length ? `; none for ${merged.left.length} (${merged.left.join(", ")})` : ""}.`,
      );
    }
    return printTask3(task3Summary(out, data, pool.candidates, pool.a1));
  }
  if (manifest.kind === "cache-check")
    return console.log(
      JSON.stringify(
        readJson(join(runDir(out, runId), "cache-check.json")),
        null,
        2,
      ),
    );
  printRun(out, runId, data, probeRun);
}

/**
 * Plan 077's first paid step: two A3 calls on the new text sharing one
 * context, one after the other; the second should read it from the cache.
 */
async function cacheCheckCommand(out: string, v: Values) {
  const budget = budgetOf(v.budget);
  const data = evalData(out);
  const model = modelId(v.model ?? "opus");
  const [effort, ...more] = efforts(v.effort ?? "medium");
  if (more.length) throw new Error("cache-check takes one --effort");
  const requests = cacheCheckRequests(data, model, effort);
  const runtime = await runtimeFor(out, [model], {
    prices: await pricesFor(out, [model], v),
    concurrency: 1,
  });
  const refused = summarise(runtime, requests, "sync", budget);
  printCacheProjection(runtime, requests, "sync");
  if (v["dry-run"]) return console.log("Dry run: no call made.");
  if (refused) throw new Error(`Refused: ${refused}`);
  requireGatewayKey();
  const runId = newRunId(v.label ?? `cache-check-${shortName(model)}`);
  const dir = createRunDir(out, runId);
  writeJson(join(dir, "prices.json"), runtime.prices);
  writeJson(join(dir, "manifest.json"), {
    runId,
    kind: "cache-check",
    createdAt: new Date().toISOString(),
    transport: "sync",
    budget,
    projection: costs(runtime, requests, "sync").expected,
    worstCase: costs(runtime, requests, "sync").worst,
    requests: requests.map((one) =>
      manifestRequest(one, {
        newtext: planNewSpecs(
          {
            arms: ["A3"],
            tasks: [1],
            subset: "all",
            model,
            efforts: [effort],
          },
          data,
        ).find((spec) => newRequest(spec, data).id === one.id),
      }),
    ),
  } satisfies Manifest);
  console.log(`Run ${runId}`);
  const result = await cacheCheck(runtime, {
    run: runId,
    dir,
    requests: requests as [ModelRequest, ModelRequest],
    budget,
  });
  console.table(
    result.calls.map((one) => ({
      call: one.id,
      ok: one.ok ? "yes" : "no",
      input: one.input,
      "cache read": one.cached,
      "cache write": one.cacheWrite,
      output: one.output,
      cost: `${one.exact ? "" : "~"}${usd(one.cost)}`,
      "gateway: cached": one.generation?.cachedTokens ?? "–",
      "gateway: written": one.generation?.cacheCreationTokens ?? "–",
      "gateway: cost": one.generation ? usd(one.generation.cost) : "–",
    })),
  );
  console.log(
    result.reads
      ? `The second call read ${pct(result.secondReadShare)} of its input from the cache: run by sync.`
      : `The second call read ${pct(result.secondReadShare)} of its input from the cache: no cache reads, so per plan 077 Opus runs by batch (--transport batch).`,
  );
  console.log(`Written to ${join(dir, "cache-check.json")}`);
}

/** The cache check's two calls: A3, task 1, the first two parts. */
function cacheCheckRequests(data: EvalData, model: string, effort: Effort) {
  return planNewSpecs(
    { arms: ["A3"], tasks: [1], subset: "all", model, efforts: [effort] },
    data,
  )
    .slice(0, 2)
    .map((spec) => newRequest(spec, data));
}

/** The judges on A1's and A1k's task-1 rows of the new text. */
async function judgeNewA1(out: string, v: Values) {
  const budget = budgetOf(v.budget);
  const data = evalData(out, v.newtext);
  const { cases, judged } = newBaselineScores(out, data);
  const seed = data.newText?.seed;
  const models = [JUDGES.opus.model, JUDGES.gpt.model];
  const runtime = await runtimeFor(out, models, {
    prices: await pricesFor(out, models, v),
  });
  if (!v["dry-run"]) requireGatewayKey();
  const result = await runJudges(runtime, {
    run: `newtext-a1-judge${seed === 77 ? "" : `-seed${seed}`}`,
    dir: join(newBaselineDir(out, seed), "judge"),
    cases,
    existing: judged,
    budget,
    dryRun: Boolean(v["dry-run"]),
    retry: Boolean(v["retry-failed"]),
    source: "A1-new",
    request: newJudgeRequest,
  });
  if (result.failed.length)
    console.log(
      `Judge calls that failed outright, waiting for --retry-failed: ${result.failed.join(", ")}`,
    );
  if (v["dry-run"])
    return console.log(
      `Dry run: ${result.requests} judge calls over ${cases.reduce((a, one) => a + one.rows.length, 0)} rows, expected ${usd(result.projected)}, worst case ${usd(result.worst)}; spent so far ${usd(spentSoFar(runtime))}; ${result.refused ? `REFUSED: ${result.refused}` : "within budget and cap"}. No call made.`,
    );
  writeJson(newBaselineJudgedPath(out, seed), result.judged);
  console.log("A1 and A1k judged:", judgedCounts(Object.values(result.judged)));
  console.log(
    "Run `pnpm translate-eval:newtext-baseline` to see their figures with them.",
  );
}

/** `--runs`: a comma-separated list of run ids. */
const runsOf = (text: string | undefined) =>
  text
    ?.split(",")
    .map((one) => one.trim())
    .filter(Boolean);

/**
 * Task 3's round trips: every candidate (A1's and each task-3 run's) not yet
 * put back into English, by one model with only the dictionary.
 */
async function roundTripCommand(out: string, v: Values) {
  const budget = budgetOf(v.budget);
  const transport = transportOf(v.transport);
  const data = evalData(out);
  const pool = task3Pool(out, data, runsOf(v.runs));
  const model = modelId(v.model ?? "opus");
  const [effort, ...more] = efforts(v.effort ?? "medium");
  if (more.length) throw new Error("roundtrip takes one --effort");
  const plan = roundTripPlan(out, pool.candidates, data, model, effort);
  const requests = plan.map((one) => one.request);
  console.log(
    `Task-3 runs in the pool: ${pool.runs.join(", ") || "none"}; ${pool.candidates.length} candidates.`,
  );
  if (!requests.length)
    return console.log("Every candidate has its round trip.");
  const runtime = await runtimeFor(out, [model], {
    prices: await pricesFor(out, [model], v),
    concurrency: concurrencyOf(v.concurrency),
  });
  const refused = summarise(runtime, requests, transport, budget);
  printCacheProjection(runtime, requests, transport);
  if (v["dry-run"]) return console.log("Dry run: no call made.");
  if (refused) throw new Error(`Refused: ${refused}`);
  requireGatewayKey();
  const runId = newRunId(v.label ?? `roundtrip-${shortName(model)}`);
  const dir = createRunDir(out, runId);
  writeJson(join(dir, "prices.json"), runtime.prices);
  writeJson(join(dir, "manifest.json"), {
    runId,
    kind: "roundtrip",
    createdAt: new Date().toISOString(),
    transport,
    budget,
    projection: costs(runtime, requests, transport).expected,
    worstCase: costs(runtime, requests, transport).worst,
    requests: plan.map((one) => one.manifest),
  } satisfies Manifest);
  console.log(`Run ${runId}`);
  const before = runtime.ledger.total();
  await execute(runtime, { run: runId, dir, requests, transport, budget });
  if (transport === "batch")
    return console.log(
      `Batch started and saved. Finish it with: pnpm translate-eval:collect ${runId}`,
    );
  await retryBlocked(runtime, {
    run: runId,
    dir,
    requests,
    budget: budget - (runtime.ledger.total() - before),
  });
  printAny(out, runId);
}

/** Task 3's judges: the rubric and the round trips, blind, both families. */
async function judgeTask3Command(out: string, v: Values) {
  const budget = budgetOf(v.budget);
  const data = evalData(out);
  const pool = task3Pool(out, data, runsOf(v.runs));
  const models = [JUDGES.opus.model, JUDGES.gpt.model];
  const runtime = await runtimeFor(out, models, {
    prices: await pricesFor(out, models, v),
  });
  if (!v["dry-run"]) requireGatewayKey();
  const result = await judgeTask3(runtime, {
    candidates: pool.candidates,
    data,
    budget,
    dryRun: Boolean(v["dry-run"]),
    retry: Boolean(v["retry-failed"]),
  });
  const missing = pool.candidates.filter(
    (one) => !one.damage && !one.missing && !result.trips.has(one.id),
  ).length;
  if (missing)
    console.log(
      `${missing} candidates have no round trip yet (run roundtrip first); their round trips aren't judged.`,
    );
  for (const [name, one] of [
    ["rubric", result.rubric],
    ["round trips", result.roundTrip],
  ] as const) {
    if (!one) continue;
    if (one.failed.length)
      console.log(
        `${name}: judge calls that failed outright, waiting for --retry-failed: ${one.failed.join(", ")}`,
      );
    if (v["dry-run"])
      console.log(
        `Dry run, ${name}: ${one.requests} judge calls, expected ${usd(one.projected)}, worst case ${usd(one.worst)}; ${one.refused ? `REFUSED: ${one.refused}` : "within budget and cap"}.`,
      );
  }
  if (v["dry-run"]) return console.log("Dry run: no call made.");
  printTask3(task3Summary(out, data, pool.candidates, pool.a1));
}

function task3ReportCommand(out: string, v: Values) {
  const data = evalData(out);
  const pool = task3Pool(out, data, runsOf(v.runs));
  printTask3(task3Summary(out, data, pool.candidates, pool.a1));
}

function printTask3(report: Task3Report) {
  console.table(
    Object.entries(report.sources).map(([source, one]) => ({
      source,
      accepted: `${one.accepted.count} ${withInterval(one.accepted)}`,
      "round trip": `${one.roundTrip.count} ${withInterval(one.roundTrip)}`,
      "attested forms": `${one.attestedForms.count}/${one.attestedForms.rows} ${pct(one.attestedForms.share)}`,
      waiting: one.waiting,
      "round trip waiting": one.roundTripWaiting,
      missing: one.missing,
      "silent inventions": `${one.silentInventions}/${one.items}`,
      split: one.split,
    })),
  );
  const c = report.controls;
  console.log(
    `Damaged controls: ${c.count} made (${Object.entries(c.byDamage)
      .map(([kind, one]) => `${kind} ${one.count}`)
      .join(
        ", ",
      )}); ${c.counted} count (their originals accepted), of which both judges accepted ${c.accepted} (${Object.entries(
      c.byDamage,
    )
      .map(([kind, one]) => `${kind} ${one.accepted}/${one.counted}`)
      .join(
        ", ",
      )})${c.originalNotAccepted ? `; ${c.originalNotAccepted} originals not accepted` : ""}${c.waiting ? `; ${c.waiting} waiting` : ""}.${c.unmeasurable ? ` The task-3 bars can't be measured: ${c.unmeasurable}.` : ""}`,
  );
}

/** The new text's bars, from the runs named (all new-text runs by default). */
function newBarsCommand(out: string, v: Values) {
  const data = evalData(out);
  const runs = runsOf(v.runs) ?? runsOfKind(out, "newtext");
  const opus = MODELS.opus;
  // Each run with the data of its set: the committed one, or a top-up's.
  const sets = new Map<string, EvalData>([["", data]]);
  const barRuns: BarRun[] = runs.flatMap((run) => {
    const manifest = readJson<Manifest>(
      join(runDir(out, run), "manifest.json"),
    );
    if (manifest?.kind !== "newtext") return [];
    const file = manifest.newTextFile ?? "";
    if (!sets.has(file)) sets.set(file, evalData(out, file));
    return [{ run, manifest, data: sets.get(file) as EvalData }];
  });
  const groups = {
    a3Task1: barGroup(out, barRuns, {
      arm: "A3",
      task: 1,
      model: opus,
      effort: "medium",
    }),
    a3Task2: barGroup(out, barRuns, {
      arm: "A3",
      task: 2,
      model: opus,
      effort: "medium",
    }),
    a0Task1: barGroup(out, barRuns, {
      arm: "A0",
      task: 1,
      model: opus,
      effort: "medium",
    }),
  };
  for (const [name, one] of Object.entries(groups))
    if (one) console.log(`${name}: runs ${one.runs.join(" + ")}`);
  // A1k on the same sets as A3, each with its own judged rows.
  const a1k1 = a1kPooled(out, groups.a3Task1?.sets ?? [data]);
  const a1k2 = a1kPooled(out, groups.a3Task2?.sets ?? [data]);
  const pool = task3Pool(out, data);
  const t3 = task3Summary(out, data, pool.candidates, pool.a1);
  const a3Source = Object.keys(t3.sources).find((one) =>
    one.endsWith(`:A3 ${shortName(opus)} medium`),
  );
  const inputs: NewBarInputs = {
    a3Task1: groups.a3Task1?.report,
    a3Task2: groups.a3Task2?.report,
    a0Task1: groups.a0Task1?.report,
    a1kTask1: a1k1.task1,
    a1kTask2: a1k2.task2,
    task3: {
      a3: a3Source ? t3.sources[a3Source] : undefined,
      a1: t3.sources.A1,
      controlsUnmeasurable: t3.controls.unmeasurable,
      controlsWaiting: t3.controls.waiting,
    },
    // Every Opus translation call: the cache check's, tasks 1 to 3, the
    // repeats, top-ups and round trips.
    blocked: opusBlocked(
      out,
      [
        ...runsOfKind(out, "cache-check"),
        ...runsOfKind(out, "newtext"),
        ...runsOfKind(out, "task3"),
        ...runsOfKind(out, "roundtrip"),
      ],
      opus,
    ),
  };
  if (!inputs.blocked?.calls) delete inputs.blocked;
  const values = barValues(
    v.values ? JSON.parse(readFileSync(v.values, "utf8")) : {},
  );
  const result = measureNewTextBars(inputs, values);
  console.table(
    result.bars.map((one) => ({
      bar: one.id,
      measured: one.measured
        ? `${one.measured.count} of ${one.measured.rows} ${withInterval(one.measured)}`
        : (one.unmeasurable ?? "not measured"),
      line:
        one.line === undefined
          ? ""
          : `${one.kind === "min" ? "≥" : "≤"} ${one.line.toFixed(1)}`,
      met: one.met === undefined ? "–" : one.met ? "yes" : "no",
      marginal: one.marginal ? "marginal" : "",
    })),
  );
  for (const one of result.bars) console.log(`  ${one.id}: ${one.rule}`);
  const d = result.a3MinusA0Swapped;
  if (d)
    console.log(
      `A3 − A0 on swapped rows: ${pct(d.a3.share)} − ${pct(d.a0.share)} = ${(100 * d.difference).toFixed(1)} points [${(100 * d.interval[0]).toFixed(1)} to ${(100 * d.interval[1]).toFixed(1)}]`,
    );
  write(
    join(out, "newbars.json"),
    json({ values, inputs: { runs }, ...result }),
  );
  console.log(`Written to ${join(out, "newbars.json")}`);
}

/** The runs of one kind in the output directory, oldest first. */
function runsOfKind(out: string, kind: RunKind): string[] {
  const runs = runsDir(out);
  if (!existsSync(runs)) return [];
  return readdirSync(runs)
    .sort()
    .filter(
      (name) =>
        readJson<Manifest>(join(runs, name, "manifest.json"))?.kind === kind,
    );
}

/**
 * What each planned run in plan 077's budget table should cost, with cache
 * reads and without, offline: the requests each run would send, built now.
 * Where a run's requests depend on replies not yet in (round trips, the
 * judges), stand-ins of the same size are built from A1's and A1k's answers.
 */
async function budgetCommand(out: string, v: Values) {
  const data = evalData(out);
  const models = [MODELS.opus, MODELS.fable, MODELS.gpt];
  const runtime = await runtimeFor(out, models, {
    prices: await pricesFor(out, models, v, true),
  });
  const plan = (choice: Parameters<typeof planNewSpecs>[0]) =>
    planNewSpecs(choice, data).map((spec) => newRequest(spec, data));
  const opus = MODELS.opus;
  const t12 = [1, 2] as const;
  const translations = [
    ...plan({
      arms: ["A0", "A2", "A3"],
      tasks: [3],
      subset: "all",
      model: opus,
      efforts: ["medium"],
    }),
    ...plan({
      arms: ["A3"],
      tasks: [3],
      subset: "all",
      model: MODELS.fable,
      efforts: ["high"],
    }),
    ...plan({
      arms: ["A3"],
      tasks: [3],
      subset: "all",
      model: MODELS.gpt,
      efforts: ["high"],
    }),
  ];
  // Stand-ins: each of the six sources' candidates as long as A1's.
  const pool = task3Pool(out, data, []);
  const a1 = pool.candidates.filter((one) => one.source === "A1");
  const sources = ["A1", "A0 opus", "A2 opus", "A3 opus", "A3 fable", "A3 gpt"];
  const standIns = sources.flatMap((source) =>
    a1.map((one) => ({
      ...one,
      source,
      id: `${one.id}${source.replace(/\W/g, "")}`,
    })),
  );
  const roundTrips = roundTripPlan(out, standIns, data, opus, "medium").map(
    (one) => one.request,
  );
  const controls = pool.candidates.filter((one) => one.damage);
  const rubric = rubricCases([...standIns, ...controls], data.rows);
  const trips = roundTripCases(
    standIns,
    new Map(standIns.map((one) => [one.id, one.english])),
  );
  const judgeBuild = rubricRequest({
    dictionary: data.dictionary,
    grammar: data.grammar,
  });
  const judgeNames = ["opus", "gpt"] as const;
  const task3Judges = [
    ...rubric.flatMap((item) => judgeNames.map((j) => judgeBuild(item, j))),
    ...trips.flatMap((item) =>
      judgeNames.map((j) => roundTripJudgeRequest(item, j)),
    ),
  ];
  // Task 1's judges: each run's to-judge rows taken as A1k's on its rows.
  const baseline = newBaselineScores(out, data);
  const a1kCase = baseline.cases.find(
    (one) => one.answer === BASELINE_ANSWERS.A1k,
  );
  const a1kRows = a1kCase?.rows ?? [];
  const inSubset = (subset: "all" | "first30" | "repeat") => {
    const ids = new Set(newTextRowsOf(data, subset).map((one) => one.id));
    return a1kRows.filter((one) => ids.has(one.row));
  };
  const task1Runs: ["all" | "first30" | "repeat", number][] = [
    ["all", 3], // Opus A0, A2, A3
    ["repeat", 2], // Opus A3 again, and at high
    ["first30", 2], // Fable, GPT
  ];
  const task1Judges = task1Runs.flatMap(([subset, times]) =>
    Array.from({ length: times }, (_, i) =>
      chunk(inSubset(subset), 75).flatMap((rows, part) =>
        judgeNames.map((j) =>
          newJudgeRequest(
            { answer: `stand-in-${subset}-${i}-${part}`, key: 0, rows },
            j,
          ),
        ),
      ),
    ).flat(),
  );
  const a1Judges = baseline.cases.flatMap((item) =>
    judgeNames.map((j) => newJudgeRequest(item, j)),
  );
  const parts: [string, ModelRequest[], TransportName][] = [
    [
      "The cache check (two A3 calls)",
      cacheCheckRequests(data, opus, "medium"),
      "sync",
    ],
    [
      "Opus, tasks 1 and 2 (A0, A2, A3 on 600 rows; A3 again and at high on 150)",
      [
        ...plan({
          arms: ["A0", "A2", "A3"],
          tasks: t12,
          subset: "all",
          model: opus,
          efforts: ["medium"],
        }),
        ...plan({
          arms: ["A3"],
          tasks: t12,
          subset: "repeat",
          model: opus,
          efforts: ["medium", "high"],
        }),
      ],
      "sync",
    ],
    [
      "Fable 5.2, A3 on 300 rows",
      plan({
        arms: ["A3"],
        tasks: t12,
        subset: "first30",
        model: MODELS.fable,
        efforts: ["high"],
      }),
      "sync",
    ],
    [
      "GPT-6.1 Sol, A3 on 300 rows",
      plan({
        arms: ["A3"],
        tasks: t12,
        subset: "first30",
        model: MODELS.gpt,
        efforts: ["high"],
      }),
      "sync",
    ],
    [
      "Task 3: six translations and their round trips",
      [...translations, ...roundTrips],
      "sync",
    ],
    ["Judges: A1 and A1k's task-1 rows", a1Judges, "sync"],
    ["Judges: task 3 (rubric and round trips)", task3Judges, "sync"],
    ["Judges: the runs' task-1 rows (as many as A1k's)", task1Judges, "sync"],
    [
      "The one top-up, if needed (Opus A3 on 200 rows, as the first 20 sentences)",
      plan({
        arms: ["A3"],
        tasks: t12,
        subset: "all",
        model: opus,
        efforts: ["medium"],
      }).filter((one) => Number(one.id.match(/-p(\d+)-/)?.[1]) <= 3),
      "sync",
    ],
  ];
  let withReads = 0;
  let without = 0;
  const rows = parts.map(([name, requests, transport]) => {
    const one = cacheProjection(
      requests,
      runtime.prices,
      transport,
      runtime.calibration ?? {},
    );
    const batch = cacheProjection(
      requests,
      runtime.prices,
      "batch",
      runtime.calibration ?? {},
    );
    withReads += one.withReads;
    without += one.without;
    return {
      part: name,
      calls: requests.length,
      "with cache reads": usd(one.withReads),
      without: usd(one.without),
      batch: usd(batch.without),
    };
  });
  console.table([
    ...rows,
    {
      part: "Total",
      calls: rows.reduce((n, one) => n + one.calls, 0),
      "with cache reads": usd(withReads),
      without: usd(without),
      batch: "",
    },
  ]);
  console.log(
    `Spent so far ${usd(spentSoFar(runtime))} of the ${usd(EXPERIMENT_CAP_USD)} cap. Expected cost: input at ${CHARS_PER_TOKEN} characters a token (or as runs have measured it), output at each kind's allowance (translate ${OUTPUT_ALLOWANCE.translate.medium}/${OUTPUT_ALLOWANCE.translate.high}, judge ${OUTPUT_ALLOWANCE.judge.medium}/${OUTPUT_ALLOWANCE.judge.high} at medium/high).`,
  );
}

/** A subset's rows of the new text. */
function newTextRowsOf(data: EvalData, subset: "all" | "first30" | "repeat") {
  return subsetSentences(data.newText as NewTextSet, subset).flatMap(
    (one) => one.rows,
  );
}

const chunk = <T>(list: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, (i + 1) * size),
  );

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
  seed: { type: "string" },
  set: { type: "string" },
  leitch: { type: "string" },
  bars: { type: "string" },
  subset: { type: "string" },
  rows: { type: "string" },
  newtext: { type: "string" },
  offline: { type: "boolean" },
  prices: { type: "string" },
  runs: { type: "string" },
  values: { type: "string" },
} as const;

type Values = Partial<
  Record<
    Exclude<keyof typeof OPTIONS, "dry-run" | "wait" | "reconcile" | "offline">,
    string
  >
> & {
  "dry-run"?: boolean;
  wait?: boolean;
  reconcile?: boolean;
  offline?: boolean;
};

const USAGE = `usage: cli.ts <command> [options]
  testset | baseline                       offline: the test set; arm A1
  newtext [--seed N] [--set FILE] [--leitch FILE] [--rows N]
                                           offline: the new text, into data/;
                                           with --rows 200 --seed 78 --set
                                           FILE, the top-up set
  newtext-baseline [--set FILE] [--bars FILE]
                                           offline: A1 and A1k on it, with
                                           the judges' verdicts where given
  judge-newtext-a1 --budget USD [--dry-run] [--retry-failed]
                                           judge A1's and A1k's task-1 rows
  budget [--offline | --prices FILE]       project every planned run's cost,
                                           with cache reads and without
  cache-check --budget USD [--model opus] [--effort medium] [--dry-run]
                                           two A3 calls sharing a context:
                                           does the second read the cache?
  run --set new --subset all|first30|repeat --model M --effort E
      --arms A0,A2,A3 --tasks 1,2 --transport sync|batch --budget USD
      [--dry-run [--offline | --prices FILE]] [--newtext FILE]
  run --set task3 --model M --effort E --arms A0,A2,A3 --budget USD
  roundtrip --budget USD [--runs RUN,…] [--model opus] [--dry-run]
                                           task 3's round trips (A1's and
                                           every task-3 run's)
  judge-task3 --budget USD [--runs RUN,…] [--dry-run] [--retry-failed]
                                           task 3's judges, blind, with the
                                           damaged controls
  task3-report [--runs RUN,…]              offline: task 3's figures
  newbars [--runs RUN,…] [--values FILE]   offline: the new text's bars
  run [--set folds] --keys K --model opus|fable|gpt --effort high,medium
      --arms A0,A2,A2c,A3 --tasks 1,2 --books open,closed
      --transport sync|batch --budget USD [--dry-run] [--label L]
      [--max-requests N]
  run --retry-failed RUN --budget USD      re-run the run's failed requests
  run --resume RUN --budget USD            run the requests it never ran
  collect RUN [--wait]                     finish a batch run
  judge RUN --budget USD [--dry-run] [--retry-failed]
  judge-a1 --budget USD [--dry-run] [--retry-failed]
  probe --keys K --model M --effort E --budget USD [--dry-run]
  report RUN [--probe RUN]                 re-score from saved replies
  (judge RUN and the dry runs take --offline or --prices FILE too)
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
  else if (command === "newtext") newtext(values);
  else if (command === "newtext-baseline") newtextBaseline(out, values);
  else if (command === "run") await run(out, values);
  else if (command === "collect") await collectCommand(out, needRun(), values);
  else if (command === "judge") await judgeCommand(out, needRun(), values);
  else if (command === "judge-a1") await judgeA1(out, values);
  else if (command === "probe") await probeCommand(out, values);
  else if (command === "report") printAny(out, needRun(), values.probe);
  else if (command === "spent") await spentCommand(out, values);
  else if (command === "cache-check") await cacheCheckCommand(out, values);
  else if (command === "judge-newtext-a1") await judgeNewA1(out, values);
  else if (command === "roundtrip") await roundTripCommand(out, values);
  else if (command === "judge-task3") await judgeTask3Command(out, values);
  else if (command === "task3-report") task3ReportCommand(out, values);
  else if (command === "newbars") newBarsCommand(out, values);
  else if (command === "budget") await budgetCommand(out, values);
  else {
    console.error(USAGE);
    process.exitCode = 2;
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
