/**
 * Builds the gap hints' table (plan 081, S11) from vectors: each word's
 * best gloss by the recipe, kept when its z-score reaches the cut-off,
 * the cut-off raised until the served table fits its budget; and the
 * judges' sample and the scorer for their verdicts.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import {
  HINT_TABLE_FORMAT,
  type HintGroup,
  type HintTable,
} from "../../src/app/enochian/translate/hints/format.ts";
import { LABELS } from "../../src/app/enochian/translate/labels.ts";
import type { HintGloss } from "./glosses.ts";
import { type Best, bestGloss } from "./recipe.ts";

/** Where the committed table lives, from the repository's root. */
export const HINT_TABLE_FILE = "src/app/enochian/translate/hints/table.json";

/** The cut-off S11 starts at: the spike's z ≥ 5.5, 95% good or loose. */
export const START_CUTOFF = 5.5;
/** The served table's budget, gzipped (S11). */
export const BUDGET_BYTES = 150 * 1024;
/** How far the cut-off rises each time the table is over budget. */
export const CUTOFF_STEP = 0.1;

/** A word and its best gloss. */
export interface Scored extends Best {
  word: string;
}

/**
 * Each word's best gloss. `vectorOf` gives a text's unit vector; every
 * word and gloss must have one.
 */
export function scoreWords(
  words: readonly string[],
  glosses: readonly HintGloss[],
  vectorOf: (text: string) => Float32Array,
  dimensions: number,
): Scored[] {
  const matrix = new Float32Array(glosses.length * dimensions);
  glosses.forEach((gloss, row) => {
    matrix.set(vectorOf(gloss.text), row * dimensions);
  });
  return words.map((word) => ({
    word,
    ...bestGloss(vectorOf(word), matrix, dimensions),
  }));
}

/** What the table records about how it was made. */
export type TableHead = Pick<
  HintTable,
  "notice" | "source" | "recipe" | "asked" | "glossHash"
>;

/** The table at a cut-off: words grouped under their gloss, both sorted. */
export function tableAt(
  scored: readonly Scored[],
  glosses: readonly HintGloss[],
  cutoff: number,
  head: TableHead,
): HintTable {
  const groups = new Map<number, string[]>();
  let rows = 0;
  for (const one of scored) {
    if (one.z < cutoff) continue;
    const list = groups.get(one.gloss) ?? [];
    list.push(one.word);
    groups.set(one.gloss, list);
    rows++;
  }
  const hints: HintGroup[] = [...groups]
    .sort(([a], [b]) => a - b)
    .map(([gloss, words]) => [
      glosses[gloss].shown,
      glosses[gloss].forms,
      [...words].sort().join(" "),
    ]);
  return {
    format: HINT_TABLE_FORMAT,
    ...head,
    cutoff,
    rows,
    hints,
  };
}

/** The table's bytes as the route serves it: compact JSON, and gzipped. */
export function servedBytes(table: HintTable): { raw: number; gzip: number } {
  const json = Buffer.from(JSON.stringify(table));
  return { raw: json.length, gzip: gzipSync(json).length };
}

/**
 * The table at `asked`, or at the lowest cut-off a step at a time above
 * it whose served table fits `budget` gzipped bytes.
 */
export function fitBudget(
  scored: readonly Scored[],
  glosses: readonly HintGloss[],
  head: TableHead,
  budget = BUDGET_BYTES,
  step = CUTOFF_STEP,
): HintTable {
  for (let steps = 0; ; steps++) {
    // Counted in steps, so the cut-off is 5.7, not 5.700000000000001.
    const cutoff = Number((head.asked + steps * step).toFixed(6));
    const table = tableAt(scored, glosses, cutoff, head);
    if (servedBytes(table).gzip <= budget) return table;
    if (!table.rows)
      throw new Error(`Even an empty table is over ${budget} bytes gzipped`);
  }
}

/** A hint as the page words it: "related: RNAH ‘sunrise’". */
export const hintText = (gloss: HintGloss) =>
  `${LABELS.gapHint.related} ${gloss.forms.join(", ")} ${LABELS.gapHint.gloss(gloss.shown)}`;

/** A seeded generator of numbers in [0, 1) (mulberry32). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The sample's size and first seed (S11: 200 random hints). The first
 * judged sample, at z >= 5.5, was drawn with 81; a fresh sample takes a
 * new seed (`--seed`).
 */
export const SAMPLE_SIZE = 200;
export const SAMPLE_SEED = 81;

/**
 * Where `build` writes a sample: named by its seed and cut-off, so a new
 * sample never lands on a judged one (`build` also refuses an existing
 * file).
 */
export const sampleName = (seed: number, cutoff: number) =>
  `sample-seed${seed}-z${cutoff}.tsv`;

/**
 * `size` of the kept hints, chosen at random from a fixed seed, so a
 * rebuild of the same table draws the same sample; in word order.
 */
export function sampleHints(
  kept: readonly Scored[],
  size = SAMPLE_SIZE,
  seed = SAMPLE_SEED,
): Scored[] {
  const pool = [...kept].sort((a, b) => (a.word < b.word ? -1 : 1));
  const next = random(seed);
  // A partial Fisher-Yates shuffle: the first `size` places.
  for (let at = 0; at < Math.min(size, pool.length); at++) {
    const pick = at + Math.floor(next() * (pool.length - at));
    [pool[at], pool[pick]] = [pool[pick], pool[at]];
  }
  return pool
    .slice(0, size)
    .sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
}

/**
 * Writes a sample to a file that must not exist yet, so a judged sample
 * is never written over; throws, writing nothing, when it does.
 */
export function writeNewSample(file: string, text: string): void {
  if (existsSync(file))
    throw new Error(
      `${file} exists (it may be judged): pass another --seed or --sample, or --no-sample`,
    );
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text, { flag: "wx" });
}

/** The judges' file: the rubric, then one hint a line, verdicts empty. */
export function sampleFile(
  sample: readonly Scored[],
  glosses: readonly HintGloss[],
  cutoff: number,
  seed: number = SAMPLE_SEED,
): string {
  const head = [
    `# Gap hints to judge (plan 081, S11): ${sample.length} drawn at random (seed ${seed}) from the table at z >= ${cutoff}.`,
    "# Judge each hint as the meaning spike did, for the English word alone:",
    "#   good  - the gloss means the word (the same sense, or as near as a synonym);",
    "#   loose - related in meaning, a fair pointer, not the same word;",
    "#   wrong - anything else.",
    "# Write good, loose or wrong in the last column, then: pnpm enochian:hints score <this file>",
    ["n", "word", "hint", "z", "verdict"].join("\t"),
  ];
  const lines = sample.map((one, at) =>
    // z to six places, so the scorer's cut-off falls where the table's does.
    [at + 1, one.word, hintText(glosses[one.gloss]), one.z.toFixed(6), ""].join(
      "\t",
    ),
  );
  return `${[...head, ...lines].join("\n")}\n`;
}

/** A judge's verdict on one hint. */
export type Verdict = "good" | "loose" | "wrong";

/** One judged hint, read back from the judges' file. */
export interface Judged {
  word: string;
  z: number;
  verdict: Verdict;
  /** The hint as judged ("related: RNAH ‘sunrise’"), when read from a file. */
  hint?: string;
}

const VERDICTS: Readonly<Record<string, Verdict>> = {
  good: "good",
  g: "good",
  loose: "loose",
  l: "loose",
  wrong: "wrong",
  w: "wrong",
};

/** The judged hints of a judges' file; unjudged lines are counted apart. */
export function readVerdicts(text: string): {
  judged: Judged[];
  unjudged: number;
} {
  const judged: Judged[] = [];
  let unjudged = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#") || line.startsWith("n\t"))
      continue;
    const cells = line.split("\t");
    const [, word, hint = "", z, said = ""] = cells;
    const verdict = VERDICTS[said.trim().toLowerCase()];
    if (!said.trim()) {
      unjudged++;
      continue;
    }
    if (!verdict || !word || !Number.isFinite(Number(z)))
      throw new Error(`Can't read this judged line: ${line}`);
    judged.push({ word, z: Number(z), verdict, hint });
  }
  return { judged, unjudged };
}

/** S11's bar: at least 90% good or loose, at most 5% wrong. */
export const PASS = { goodOrLoose: 0.9, wrong: 0.05 } as const;

/** Shares of a set of judged hints, and whether they meet the bar. */
export function shares(judged: readonly Judged[]) {
  const n = judged.length;
  const count = (verdict: Verdict) =>
    judged.filter((one) => one.verdict === verdict).length;
  const good = count("good");
  const loose = count("loose");
  const wrong = count("wrong");
  const passes =
    n > 0 && (good + loose) / n >= PASS.goodOrLoose && wrong / n <= PASS.wrong;
  return { n, good, loose, wrong, passes };
}

/** A cut-off and the shares of the judged hints at or above it. */
export interface Cut {
  cutoff: number;
  shares: ReturnType<typeof shares>;
}

/**
 * A short cut-off at or below `cut` (the z of the lowest judged hint
 * kept) that keeps the same judged hints: `cut` rounded down to two
 * places, or three, or `cut` itself, whichever first leaves every
 * excluded judged z at least `margin` below it. So the table built at
 * the cut-off keeps exactly the judged hints the shares are of, even
 * from z read to six places.
 */
export function roundCut(
  cut: number,
  judged: readonly Pick<Judged, "z">[],
  margin = 1e-6,
): number {
  const below = judged.filter((one) => one.z < cut).map((one) => one.z);
  const highest = below.length ? Math.max(...below) : Number.NEGATIVE_INFINITY;
  for (const places of [100, 1000]) {
    // The epsilon keeps 5.72 from reading as 571.999… hundredths.
    const rounded = Math.floor(cut * places + 1e-9) / places;
    if (rounded >= highest + margin) return rounded;
  }
  return cut;
}

/**
 * The lowest cut-off at which the judged hints at or above it pass
 * (`roundCut` applied, and the shares counted at the rounded cut-off),
 * or `null` when none does.
 */
export function lowestPassing(judged: readonly Judged[]): Cut | null {
  const cuts = [...new Set(judged.map((one) => one.z))].sort((a, b) => a - b);
  for (const cut of cuts) {
    if (!shares(judged.filter((one) => one.z >= cut)).passes) continue;
    const cutoff = roundCut(cut, judged);
    return {
      cutoff,
      shares: shares(judged.filter((one) => one.z >= cutoff)),
    };
  }
  return null;
}

/** What the verdicts say: the sample's shares, and if it fails, a fix. */
export interface Score {
  all: ReturnType<typeof shares>;
  /**
   * When the sample fails: the lowest cut-off at which the judged hints
   * at or above it pass, with exactly their shares (`lowestPassing`);
   * none if no cut-off passes.
   */
  raise?: Cut | null;
}

/** Scores the verdicts (see `Score`). */
export function score(judged: readonly Judged[]): Score {
  const all = shares(judged);
  if (all.passes) return { all };
  return { all, raise: lowestPassing(judged) };
}

/** A judged hint's gloss and forms, read back from "related: A, B ‘gloss’". */
export function judgedHint(
  hint: string,
): { forms: string[]; gloss: string } | null {
  const prefix = `${LABELS.gapHint.related} `;
  const open = hint.indexOf("‘");
  if (!hint.startsWith(prefix) || open < 0 || !hint.endsWith("’")) return null;
  return {
    forms: hint.slice(prefix.length, open).trim().split(", "),
    gloss: hint.slice(open + 1, -1),
  };
}

/**
 * The judged hints a rebuild leaves as they were: the word's best gloss
 * is the one judged (by its embedded text, which the first sample
 * showed), with the same forms. Each keeps its verdict and takes its
 * new z-score, since a smaller set of glosses moves every z. The others
 * changed or left the table, and need judging afresh.
 */
export function carryVerdicts(
  judged: readonly Judged[],
  scored: readonly Scored[],
  glosses: readonly HintGloss[],
): { carried: Judged[]; changed: string[] } {
  const now = new Map(scored.map((one) => [one.word, one]));
  const carried: Judged[] = [];
  const changed: string[] = [];
  for (const one of judged) {
    const was = one.hint ? judgedHint(one.hint) : null;
    const best = now.get(one.word);
    const gloss = best && glosses[best.gloss];
    if (
      was &&
      gloss &&
      (was.gloss === gloss.text || was.gloss === gloss.shown) &&
      was.forms.join(", ") === gloss.forms.join(", ")
    )
      carried.push({ ...one, z: (best as Scored).z, hint: hintText(gloss) });
    else changed.push(one.word);
  }
  return { carried, changed };
}
