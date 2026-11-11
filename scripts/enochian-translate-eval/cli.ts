import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
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
import { normEnochian } from "./normalise.ts";
import { joinScores, type Report, report } from "./score.ts";
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

/**
 * The offline half of plan 077's experiment.
 *
 *   pnpm translate-eval:testset [--out DIR]   the test set and its contexts
 *   pnpm translate-eval:baseline [--out DIR]  arm A1's scores
 *
 * Outputs go outside the repository (default below): the runner's raw
 * output will sit beside them, and that never enters the repository.
 */

const DEFAULT_OUT = join(
  homedir(),
  "Documents/Magick/Enochian/derived/translate-eval",
);

const pad = (n: number) => String(n).padStart(2, "0");
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

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
  markHard(folds, data.dictionary);
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

function line(name: string, r: Report) {
  const p = r.pooled;
  const scored = p.knowable ?? p.all;
  const extra = p.unknown
    ? ` | knowable ${scored.rows} rows; unknown P ${pct(p.unknown.precision)} R ${pct(p.unknown.recall)}`
    : "";
  return [
    `${name}: ${pct(p.headline)} (if judged ${pct(scored.accuracyIfJudged)}) over ${scored.rows} rows`,
    `per Key ${pct(r.spread.mean)} ± ${pct(r.spread.sd)} [${pct(r.spread.min)}–${pct(r.spread.max)}]`,
    `hard ${pct(r.hard.headline)} of ${r.hard.all.rows}, with A1's to-judge ${pct(r.hardWithA1ToJudge.headline)} of ${r.hardWithA1ToJudge.all.rows}`,
    `silent inventions ${p.all.silentInventionsPer100.toFixed(2)}/100, malformed refs ${p.all.malformedRefs}, unaligned ${p.all.unaligned}, knowable unknowns ${p.all.knowableUnknowns}${extra}`,
  ].join("; ");
}

function baseline(out: string) {
  const data = source();
  const folds = buildTestSet(data);
  const open = markHard(folds, data.dictionary);
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

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string", default: DEFAULT_OUT } },
});
const out = values.out as string;
const command = positionals[0];
if (command === "testset") testset(out);
else if (command === "baseline") baseline(out);
else {
  console.error("usage: cli.ts testset|baseline [--out DIR]");
  process.exitCode = 2;
}
