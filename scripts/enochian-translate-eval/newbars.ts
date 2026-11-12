import {
  type BarId,
  barById,
  countLine,
  ROUND_TRIP_KINDS,
  type TranslatorBar,
} from "../../src/app/enochian/translate/bars.ts";
import {
  type FigureGroup,
  type NewFigures,
  type Share,
  share,
  wilson,
} from "./newscore.ts";
import type { Task3Figures } from "./task3.ts";

/**
 * Measuring the bars for the new text (plan 077, "Bars for the new text"),
 * settled 12 November 2026. Their values live only in
 * `src/app/enochian/translate/bars.ts`, and can't be overridden. Each bar is
 * measured as a count over its rows, with its Wilson interval, against a
 * line in whole rows, and called marginal within one row of the line (one
 * top-up may then decide it).
 */

/** A new-text report's groups, as `newReport` gives them. */
export type NewTextReport = Record<FigureGroup, NewFigures>;

/** What the bars are measured from. Leave out what hasn't run yet. */
export interface NewBarInputs {
  /** Opus A3 (the arm the bars are for), tasks 1 and 2, all 600 rows. */
  a3Task1?: NewTextReport;
  a3Task2?: NewTextReport;
  /** Opus A0, task 1: the planted knowns' memory check and A3 − A0. */
  a0Task1?: NewTextReport;
  /** A1k on the same rows, for context only: the bars are fixed figures. */
  a1kTask1?: NewTextReport;
  a1kTask2?: NewTextReport;
  /** Task 3's figures for Opus A3 (and A1, for context), and the controls. */
  task3?: {
    a3?: Task3Figures;
    a1?: Task3Figures;
    /**
     * Why the damaged controls don't let the bars be measured (too few
     * counted, or too many accepted: `task3Report`), if they don't.
     */
    controlsUnmeasurable?: string;
    /** Controls, or their originals, still waiting for both judges. */
    controlsWaiting?: number;
  };
  /**
   * Opus's translation calls, every attempt (round trips included), and
   * those blocked. Measured only once A3 task 1 or 2 is in.
   */
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
  /** The line in the same units, exactly: the bar's value times the rows. */
  line?: number;
  /** The count the bar needs: at least (min) or at most (max) this. */
  needs?: number;
  met?: boolean;
  /** Within one row of the line. */
  marginal?: boolean;
  /** Why it can't be measured yet. */
  unmeasurable?: string;
}

const pct = (x: number) => `${Math.round(1000 * x) / 10}%`;

/**
 * A bar on a count. Met and marginal are decided in whole numbers: the
 * count against `countLine`, and the distance to the line (value × rows)
 * as count × denominator against numerator × rows, so a figure exactly at
 * the line can't come out a hair either side of it. It fails closed: with
 * no rows, or (a bar on fixed rows) with other than the rows planned, it
 * is unmeasurable, never met.
 */
export function measure(
  id: string,
  bar: TranslatorBar,
  measured: Share,
  rule = bar.rule,
): NewBarMeasure {
  if (!measured.rows)
    return { ...missing(id, bar, "no rows to measure", rule), measured };
  if (bar.fixedRows && measured.rows !== bar.planned)
    return {
      ...missing(
        id,
        bar,
        `measured on ${measured.rows} rows, not the ${bar.planned} it is set on`,
        rule,
      ),
      measured,
    };
  const [of, per] = bar.value;
  const needs = countLine(bar, measured.rows);
  // The line in units of 1/per of a row, and the count likewise.
  const scaledLine = of * measured.rows;
  const scaledCount = measured.count * per;
  return {
    id,
    rule,
    kind: bar.kind,
    measured,
    line: scaledLine / per,
    needs,
    met: bar.kind === "min" ? measured.count >= needs : measured.count <= needs,
    marginal: Math.abs(scaledCount - scaledLine) <= per,
  };
}

const missing = (
  id: string,
  bar: TranslatorBar,
  why: string,
  rule = bar.rule,
) => ({ id, rule, kind: bar.kind, unmeasurable: why }) satisfies NewBarMeasure;

/** Why a task-1 report can't be used yet: rows still waiting for judges. */
function waiting(name: string, report: NewTextReport | undefined) {
  if (!report) return `no ${name}`;
  const rows = report.all.toJudge;
  return rows
    ? `${name}: ${rows} rows still waiting for the judges`
    : undefined;
}

/** A bar's rule with a note before its full stop: "… (task 1)." */
const noted = (rule: string, note: string) =>
  `${rule.replace(/\.$/, "")} (${note}).`;

/** A1k's figure on the same rows, as context for a bar's rule. */
function a1kContext(rule: string, report: NewTextReport | undefined) {
  const right = report?.unchangedAndSwapped.right;
  if (!right || report?.all.toJudge) return rule;
  return noted(
    rule,
    `A1k on the same rows: ${right.count} of ${right.rows}, ${pct(right.share)}`,
  );
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

/** The round trip's barred sentences: the practitioner and attested ones. */
export function barredRoundTrip(figures: Task3Figures): {
  measured: Share;
  waiting: number;
  /** Barred kinds with no sentences in the figures. */
  absent: string[];
} {
  let count = 0;
  let rows = 0;
  let waitingRows = 0;
  const absent: string[] = [];
  for (const kind of ROUND_TRIP_KINDS) {
    const one = figures.byKind[kind];
    if (!one?.sentences) {
      absent.push(kind);
      continue;
    }
    count += one.roundTrip.count;
    rows += one.sentences;
    waitingRows += one.roundTripWaiting;
  }
  return { measured: share(count, rows), waiting: waitingRows, absent };
}

/**
 * Every bar in the plan's table, in its order, from what has run; a bar
 * whose inputs are missing or still waiting for the judges says why. A bar
 * measured on each task on its own is one line per task.
 */
export function measureNewTextBars(inputs: NewBarInputs): {
  bars: NewBarMeasure[];
  a3MinusA0Swapped?: ReturnType<typeof difference> & { a3: Share; a0: Share };
} {
  const bar = (id: BarId) => barById(id);
  const bars: NewBarMeasure[] = [];
  const t1 = waiting("A3 task 1", inputs.a3Task1);
  const a3t1 = t1 ? undefined : inputs.a3Task1;

  {
    const b = bar("toEnglish");
    const rule = a1kContext(b.rule, inputs.a1kTask1);
    bars.push(
      a3t1
        ? measure(b.id, b, a3t1.unchangedAndSwapped.right, rule)
        : missing(b.id, b, t1 as string, rule),
    );
  }
  {
    const b = bar("toEnochian");
    const rule = a1kContext(b.rule, inputs.a1kTask2);
    bars.push(
      inputs.a3Task2
        ? measure(b.id, b, inputs.a3Task2.unchangedAndSwapped.right, rule)
        : missing(b.id, b, "no A3 task 2", rule),
    );
  }
  const task1 = (id: BarId, pick: (r: NewTextReport) => Share) => {
    const b = bar(id);
    bars.push(a3t1 ? measure(id, b, pick(a3t1)) : missing(id, b, t1 as string));
  };
  task1("swappedRight", (r) => r.swapped.right);
  task1("recalled", (r) => r.swapped.recalled);
  for (const [task, report] of [
    [1, inputs.a3Task1],
    [2, inputs.a3Task2],
  ] as const) {
    const b = bar("plantFailures");
    const id = `plantFailures${task}`;
    const rule = noted(b.rule, `task ${task}`);
    bars.push(
      report
        ? measure(id, b, report.plant.plantFailures, rule)
        : missing(id, b, `no A3 task ${task}`, rule),
    );
  }
  {
    const b = bar("knownsRight");
    if (!a3t1) bars.push(missing(b.id, b, t1 as string));
    else {
      const a3 = measure(b.id, b, a3t1.known.right);
      const a0w = waiting("A0 task 1", inputs.a0Task1);
      const a0 = inputs.a0Task1?.known.right;
      // A0 isn't topped up: its ceiling is on the main set's knowns.
      const a0why =
        a0w ??
        (a0 && a0.rows !== b.planned
          ? `A0 task 1 has ${a0.rows} knowns, not the ${b.planned} of the main set`
          : undefined);
      if (a3.unmeasurable || a0why)
        bars.push({
          ...a3,
          met: undefined,
          unmeasurable: a3.unmeasurable ?? a0why,
        });
      else if (a0) {
        const a0ok = a0.count <= (b.a0AtMost ?? 0);
        bars.push({
          ...a3,
          rule: noted(b.rule, `A0: ${a0.count} of ${a0.rows}`),
          met: Boolean(a3.met) && a0ok,
          // Marginal on the model's count only: A0's ceiling is a check of
          // memory, not a bar a top-up could move.
          marginal: a3.marginal,
        });
      }
    }
  }
  task1("joinsRight", (r) => r.join.right);
  const silent = bar("silentInventions");
  for (const [task, report] of [
    [1, inputs.a3Task1],
    [2, inputs.a3Task2],
  ] as const) {
    const id = `silentInventions${task}`;
    const rule = noted(silent.rule, `task ${task}`);
    bars.push(
      report
        ? measure(
            id,
            silent,
            share(report.all.silentInventions, report.all.rows),
            rule,
          )
        : missing(id, silent, `no A3 task ${task}`, rule),
    );
  }
  const t3 = inputs.task3;
  const a1 = t3?.a1;
  // Both judged bars rest on the judges passing the controls.
  const t3why = !t3?.a3
    ? "no task 3 for A3"
    : t3.controlsUnmeasurable
      ? t3.controlsUnmeasurable
      : t3.controlsWaiting
        ? `${t3.controlsWaiting} damaged controls or originals still waiting for the judges`
        : undefined;
  {
    const id = "silentInventions3";
    const rule = noted(silent.rule, "task 3");
    bars.push(
      t3?.a3
        ? measure(id, silent, share(t3.a3.silentInventions, t3.a3.items), rule)
        : missing(id, silent, "no task 3 for A3", rule),
    );
  }
  {
    const b = bar("task3Accept");
    const rule = a1
      ? noted(b.rule, `A1: ${a1.accepted.count} of ${a1.accepted.rows}`)
      : b.rule;
    const why =
      t3why ??
      (t3?.a3?.waiting
        ? `${t3.a3.waiting} task-3 translations still waiting for the judges`
        : undefined);
    bars.push(
      why || !t3?.a3
        ? missing(b.id, b, why as string, rule)
        : measure(b.id, b, t3.a3.accepted, rule),
    );
  }
  {
    const b = bar("task3RoundTrip");
    const a1Trip = a1 && barredRoundTrip(a1).measured;
    const rule = a1Trip
      ? noted(b.rule, `A1: ${a1Trip.count} of ${a1Trip.rows}`)
      : b.rule;
    const trip = t3?.a3 && barredRoundTrip(t3.a3);
    const why =
      t3why ??
      (trip?.absent.length
        ? `no ${trip.absent.join(" or ")} sentences in task 3`
        : trip?.waiting
          ? `${trip.waiting} round trips still waiting for the judges`
          : undefined);
    bars.push(
      why || !trip
        ? missing(b.id, b, why as string, rule)
        : measure(b.id, b, trip.measured, rule),
    );
  }
  {
    const b = bar("task3AttestedForms");
    bars.push(
      t3?.a3
        ? measure(b.id, b, t3.a3.attestedForms)
        : missing(b.id, b, "no task 3 for A3"),
    );
  }
  {
    const b = bar("blocked");
    // Only once Opus A3 has translated the new text: before then, the few
    // calls made (a cache check, say) would pass it on nothing.
    bars.push(
      !inputs.a3Task1 && !inputs.a3Task2
        ? missing(b.id, b, "no Opus A3 run on the new text yet")
        : inputs.blocked
          ? measure(
              b.id,
              b,
              share(inputs.blocked.blocked, inputs.blocked.calls),
            )
          : missing(b.id, b, "no Opus translation calls"),
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
