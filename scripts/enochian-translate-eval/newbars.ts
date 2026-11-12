import {
  type FigureGroup,
  type NewFigures,
  type Share,
  share,
  wilson,
} from "./newscore.ts";
import type { Task3Figures } from "./task3.ts";

/**
 * Measuring the bars for the new text (plan 077, "Bars for the new text").
 * The values aren't settled: they are settled after A1 and A1k are scored
 * on the new text and before any model runs on it, then go into
 * `src/app/enochian/translate/bars.ts` in place of the withdrawn design's.
 * Until then they come in from the caller (`PROPOSED_NEW_BARS`, or a JSON
 * file of the same shape), and each bar is measured as a count over its
 * rows, with its Wilson interval, and called marginal within one row of its
 * line (one top-up may then decide it).
 */

/** Every bar's value, as plan 077's table proposes them. */
export interface NewBarValues {
  /** Task 1, unchanged and swapped rows: A1k's judged share less this. */
  toEnglishMargin: number;
  /** Task 2, unchanged and swapped rows: A1k's share less this. */
  toEnochianMargin: number;
  /** Task 1, swapped rows right: at least this share. */
  swappedRight: number;
  /** Task 1, swapped rows recalled: at most this share. */
  recalled: number;
  /** Plants given as attested or guessed without support: at most, each task. */
  plantFailures: number;
  /** Task 1, planted knowns right: at least this many rows. */
  knownsRight: number;
  /** ...with A0 right on at most this many. */
  knownsA0: number;
  /** Task 1, new joins right (both parts): at least this share. */
  joinsRight: number;
  /** Silent inventions per 100 rows (task 3: per 100 items), every task. */
  silentPer100: number;
  /** Task 3, both judges accept: A1's share plus this... */
  task3AcceptMargin: number;
  /** ...or this, whichever is lower. */
  task3AcceptCap: number;
  /** Task 3, round trip keeps the meaning: at least this share... */
  task3RoundTrip: number;
  /** ...and no more than this below A1's. */
  task3RoundTripMargin: number;
  /** Task 3, content words given an attested form where one exists. */
  task3AttestedForms: number;
  /** Opus translation calls blocked by the provider's filter: at most. */
  blocked: number;
}

/** Plan 077's proposed values (12 November 2026). */
export const PROPOSED_NEW_BARS: NewBarValues = {
  toEnglishMargin: 0.02,
  toEnochianMargin: 0.03,
  swappedRight: 0.9,
  recalled: 0.05,
  plantFailures: 0.1,
  knownsRight: 18,
  knownsA0: 1,
  joinsRight: 0.8,
  silentPer100: 2,
  task3AcceptMargin: 0.15,
  task3AcceptCap: 0.9,
  task3RoundTrip: 2 / 3,
  task3RoundTripMargin: 0.1,
  task3AttestedForms: 0.9,
  blocked: 0.05,
};

/** Reads proposed values: any left out keep the plan's. */
export function barValues(given: Partial<NewBarValues> = {}): NewBarValues {
  for (const [name, value] of Object.entries(given))
    if (!(name in PROPOSED_NEW_BARS) || typeof value !== "number")
      throw new Error(`Bar value ${name}: not a bar, or not a number`);
  return { ...PROPOSED_NEW_BARS, ...given };
}

/** A new-text report's groups, as `newReport` gives them. */
export type NewTextReport = Record<FigureGroup, NewFigures>;

/** What the bars are measured from. Leave out what hasn't run yet. */
export interface NewBarInputs {
  /** Opus A3 (the arm the bars are for), tasks 1 and 2, all 600 rows. */
  a3Task1?: NewTextReport;
  a3Task2?: NewTextReport;
  /** Opus A0, task 1: the planted knowns' memory check and A3 − A0. */
  a0Task1?: NewTextReport;
  /** A1k on the new text, task 1 judged. */
  a1kTask1?: NewTextReport;
  a1kTask2?: NewTextReport;
  /** Task 3's figures for Opus A3 and for A1, and the controls' verdict. */
  task3?: {
    a3?: Task3Figures;
    a1?: Task3Figures;
    /**
     * Why the damaged controls don't let the bars be measured (too few
     * counted, or too many accepted: `task3Report`), if they don't.
     */
    controlsUnmeasurable?: string;
    /** Controls still waiting for both judges. */
    controlsWaiting?: number;
  };
  /** Opus's translation calls, every attempt, and those blocked. */
  blocked?: { calls: number; blocked: number };
}

/** One bar, measured. */
export interface NewBarMeasure {
  id: string;
  /** The bar in words, with its value. */
  rule: string;
  kind: "min" | "max";
  /** The count measured over its rows (or calls, or words). */
  measured?: Share;
  /** The line in the same units: at least (min) or at most (max) this. */
  line?: number;
  met?: boolean;
  /** Within one row of the line. */
  marginal?: boolean;
  /** Why it can't be measured yet. */
  unmeasurable?: string;
}

const pct = (x: number) => `${Math.round(1000 * x) / 10}%`;
const points = (x: number) => `${Math.round(1000 * x) / 10} points`;

/** A bar on a count: met and marginal by the line in rows. */
function measure(
  id: string,
  rule: string,
  kind: "min" | "max",
  measured: Share,
  threshold: number,
): NewBarMeasure {
  const line = threshold * measured.rows;
  const epsilon = 1e-9;
  return {
    id,
    rule,
    kind,
    measured,
    line,
    met:
      kind === "min"
        ? measured.count >= line - epsilon
        : measured.count <= line + epsilon,
    marginal: Math.abs(measured.count - line) <= 1 + epsilon,
  };
}

/** A count-line bar (knowns: "at least 18 of 20"). */
function measureCount(
  id: string,
  rule: string,
  kind: "min" | "max",
  measured: Share,
  line: number,
): NewBarMeasure {
  return measure(
    id,
    rule,
    kind,
    measured,
    measured.rows ? line / measured.rows : 0,
  );
}

const missing = (id: string, rule: string, kind: "min" | "max", why: string) =>
  ({ id, rule, kind, unmeasurable: why }) satisfies NewBarMeasure;

/** Why a task-1 report can't be used yet: rows still waiting for judges. */
function waiting(name: string, report: NewTextReport | undefined) {
  if (!report) return `no ${name}`;
  const rows = report.all.toJudge;
  return rows
    ? `${name}: ${rows} rows still waiting for the judges`
    : undefined;
}

/**
 * The difference of two shares with Newcombe's hybrid score interval (95%),
 * from each share's Wilson interval: for A3 − A0 on swapped rows.
 */
export function difference(a: Share, b: Share) {
  const [la, ua] = wilson(a.count, a.rows);
  const [lb, ub] = wilson(b.count, b.rows);
  const d = a.share - b.share;
  return {
    difference: d,
    interval: [
      d - Math.sqrt((a.share - la) ** 2 + (ub - b.share) ** 2),
      d + Math.sqrt((ua - a.share) ** 2 + (b.share - lb) ** 2),
    ] as [number, number],
  };
}

/**
 * Every bar in the plan's table, in its order, from what has run; a bar
 * whose inputs are missing or still waiting for the judges says why. The
 * non-inferiority bars are on unchanged and swapped rows only, against
 * A1k's judged figure; A1k's own interval isn't carried into the line.
 */
export function measureNewTextBars(
  inputs: NewBarInputs,
  given: Partial<NewBarValues> = {},
): {
  bars: NewBarMeasure[];
  a3MinusA0Swapped?: ReturnType<typeof difference> & { a3: Share; a0: Share };
} {
  const v = barValues(given);
  const bars: NewBarMeasure[] = [];
  const t1 = waiting("A3 task 1", inputs.a3Task1);
  const k1 = waiting("A1k task 1", inputs.a1kTask1);
  const a3t1 = t1 ? undefined : inputs.a3Task1;

  {
    const rule = `Enochian to English, unchanged and swapped rows: at least A1k's judged figure less ${points(v.toEnglishMargin)}`;
    if (t1 || k1)
      bars.push(missing("toEnglish", rule, "min", (t1 ?? k1) as string));
    else {
      const a1k = (inputs.a1kTask1 as NewTextReport).unchangedAndSwapped.right;
      bars.push(
        measure(
          "toEnglish",
          `${rule} (${pct(a1k.share)} − ${pct(v.toEnglishMargin)})`,
          "min",
          (a3t1 as NewTextReport).unchangedAndSwapped.right,
          a1k.share - v.toEnglishMargin,
        ),
      );
    }
  }
  {
    const rule = `English to Enochian, unchanged and swapped rows: at least A1k's figure less ${points(v.toEnochianMargin)}`;
    if (!inputs.a3Task2 || !inputs.a1kTask2)
      bars.push(missing("toEnochian", rule, "min", "no A3 or A1k task 2"));
    else {
      const a1k = inputs.a1kTask2.unchangedAndSwapped.right;
      bars.push(
        measure(
          "toEnochian",
          `${rule} (${pct(a1k.share)} − ${pct(v.toEnochianMargin)})`,
          "min",
          inputs.a3Task2.unchangedAndSwapped.right,
          a1k.share - v.toEnochianMargin,
        ),
      );
    }
  }
  const task1 = (
    id: string,
    rule: string,
    kind: "min" | "max",
    pick: (r: NewTextReport) => Share,
    threshold: number,
  ) =>
    bars.push(
      a3t1
        ? measure(id, rule, kind, pick(a3t1), threshold)
        : missing(id, rule, kind, t1 as string),
    );
  task1(
    "swappedRight",
    `Swapped rows right, task 1: at least ${pct(v.swappedRight)}`,
    "min",
    (r) => r.swapped.right,
    v.swappedRight,
  );
  task1(
    "recalled",
    `Recalled answers, task 1: at most ${pct(v.recalled)} of swapped rows`,
    "max",
    (r) => r.swapped.recalled,
    v.recalled,
  );
  for (const [task, report] of [
    [1, inputs.a3Task1],
    [2, inputs.a3Task2],
  ] as const) {
    const id = `plantFailures${task}`;
    const rule = `Planted unknowns given as attested, or guessed without support, task ${task}: at most ${pct(v.plantFailures)}`;
    bars.push(
      report
        ? measure(id, rule, "max", report.plant.plantFailures, v.plantFailures)
        : missing(id, rule, "max", `no A3 task ${task}`),
    );
  }
  {
    const rule = `Planted knowns right, task 1: at least ${v.knownsRight}, with A0 at most ${v.knownsA0}`;
    if (!a3t1) bars.push(missing("knownsRight", rule, "min", t1 as string));
    else {
      const a3 = measureCount(
        "knownsRight",
        rule,
        "min",
        a3t1.known.right,
        v.knownsRight,
      );
      const a0w = waiting("A0 task 1", inputs.a0Task1);
      if (a0w) bars.push({ ...a3, met: undefined, unmeasurable: a0w });
      else {
        const a0 = (inputs.a0Task1 as NewTextReport).known.right;
        const a0ok = a0.count <= v.knownsA0;
        bars.push({
          ...a3,
          rule: `${rule} (A0: ${a0.count} of ${a0.rows})`,
          met: Boolean(a3.met) && a0ok,
          // Marginal on the model's count only: A0's ceiling is a check of
          // memory, not a bar a top-up could move.
          marginal: a3.marginal,
        });
      }
    }
  }
  task1(
    "joinsRight",
    `New joins right, both parts, task 1: at least ${pct(v.joinsRight)}`,
    "min",
    (r) => r.join.right,
    v.joinsRight,
  );
  for (const [task, report] of [
    [1, inputs.a3Task1],
    [2, inputs.a3Task2],
  ] as const) {
    const id = `silentInventions${task}`;
    const rule = `Silent inventions, task ${task}: at most ${v.silentPer100} per 100 rows`;
    bars.push(
      report
        ? measure(
            id,
            rule,
            "max",
            share(report.all.silentInventions, report.all.rows),
            v.silentPer100 / 100,
          )
        : missing(id, rule, "max", `no A3 task ${task}`),
    );
  }
  const t3 = inputs.task3;
  const t3why =
    !t3?.a3 || !t3.a1
      ? "no task 3 for A3 and A1"
      : t3.controlsUnmeasurable
        ? t3.controlsUnmeasurable
        : t3.controlsWaiting
          ? `${t3.controlsWaiting} damaged controls still waiting for the judges`
          : t3.a3.waiting || t3.a1.waiting
            ? "task-3 translations still waiting for the judges"
            : undefined;
  {
    const id = "silentInventions3";
    const rule = `Silent inventions, task 3: at most ${v.silentPer100} per 100 words given`;
    bars.push(
      t3?.a3
        ? measure(
            id,
            rule,
            "max",
            share(t3.a3.silentInventions, t3.a3.items),
            v.silentPer100 / 100,
          )
        : missing(id, rule, "max", "no task 3 for A3"),
    );
  }
  {
    const rule = `Task 3, both judges accept: at least A1's share plus ${points(v.task3AcceptMargin)}, or ${pct(v.task3AcceptCap)}, whichever is lower`;
    if (t3why || !t3?.a3 || !t3.a1)
      bars.push(missing("task3Accept", rule, "min", t3why as string));
    else {
      const line = Math.min(
        t3.a1.accepted.share + v.task3AcceptMargin,
        v.task3AcceptCap,
      );
      bars.push(
        measure(
          "task3Accept",
          `${rule} (${pct(line)})`,
          "min",
          t3.a3.accepted,
          line,
        ),
      );
    }
  }
  {
    const rule = `Task 3, round trip keeps the meaning: at least ${pct(v.task3RoundTrip)}, and no more than ${points(v.task3RoundTripMargin)} below A1`;
    const tripWhy =
      t3why ??
      (t3?.a3?.roundTripWaiting || t3?.a1?.roundTripWaiting
        ? "round trips still waiting for the judges"
        : undefined);
    if (tripWhy || !t3?.a3 || !t3.a1)
      bars.push(missing("task3RoundTrip", rule, "min", tripWhy as string));
    else {
      const line = Math.max(
        v.task3RoundTrip,
        t3.a1.roundTrip.share - v.task3RoundTripMargin,
      );
      bars.push(
        measure(
          "task3RoundTrip",
          `${rule} (${pct(line)})`,
          "min",
          t3.a3.roundTrip,
          line,
        ),
      );
    }
  }
  {
    const rule = `Task 3, content words given an attested form where one exists: at least ${pct(v.task3AttestedForms)}`;
    bars.push(
      t3?.a3
        ? measure(
            "task3AttestedForms",
            rule,
            "min",
            t3.a3.attestedForms,
            v.task3AttestedForms,
          )
        : missing("task3AttestedForms", rule, "min", "no task 3 for A3"),
    );
  }
  {
    const rule = `Opus translation calls blocked by the provider's filter: at most ${pct(v.blocked)}, counted over every call`;
    bars.push(
      inputs.blocked
        ? measure(
            "blocked",
            rule,
            "max",
            share(inputs.blocked.blocked, inputs.blocked.calls),
            v.blocked,
          )
        : missing("blocked", rule, "max", "no Opus translation calls"),
    );
  }
  const a0w = waiting("A0 task 1", inputs.a0Task1);
  return {
    bars,
    ...(a3t1 && !a0w && inputs.a0Task1
      ? {
          a3MinusA0Swapped: {
            a3: a3t1.swapped.right,
            a0: inputs.a0Task1.swapped.right,
            ...difference(a3t1.swapped.right, inputs.a0Task1.swapped.right),
          },
        }
      : {}),
  };
}
