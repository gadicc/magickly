import type { BarResult } from "../../src/app/enochian/translate/bars.ts";
import { formatBarValue } from "../../src/app/enochian/translate/bars.ts";
import type { Report } from "./score.ts";

/** How the CLI prints figures. */

export const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

export const usd = (x: number) => `$${x.toFixed(2)}`;

/** One report as a line: headline, per-Key spread, hard rows, honesty. */
export function line(name: string, r: Report) {
  const p = r.pooled;
  const scored = p.knowable ?? p.all;
  const extra = p.unknown
    ? ` | knowable ${scored.rows} rows; unknown P ${pct(p.unknown.precision)} R ${pct(p.unknown.recall)}`
    : "";
  const judged = ["rejected", "split", "to judge"] as const;
  const counts = judged
    .filter((one) => p.all.counts[one])
    .map((one) => `${one} ${p.all.counts[one]}`)
    .join(", ");
  return [
    `${name}: ${pct(p.headline)} (if judged ${pct(scored.accuracyIfJudged)}) over ${scored.rows} rows${counts ? ` [${counts}]` : ""}`,
    `per Key ${pct(r.spread.mean)} ± ${pct(r.spread.sd)} [${pct(r.spread.min)}–${pct(r.spread.max)}]`,
    `hard ${pct(r.hard.headline)} of ${r.hard.all.rows}, with A1's to-judge ${pct(r.hardWithA1ToJudge.headline)} of ${r.hardWithA1ToJudge.all.rows}`,
    `silent inventions ${p.all.silentInventionsPer100.toFixed(2)}/100${p.all.judgedInventions ? ` (${p.all.judgedInventions} judged)` : ""}, malformed refs ${p.all.malformedRefs}, unaligned ${p.all.unaligned}, knowable unknowns ${p.all.knowableUnknowns}${p.all.multiSense ? `, multi-sense answers ${p.all.multiSense} (sent to the judges)` : ""}${extra}`,
  ].join("; ");
}

/** The bars as a table's rows. */
export function barRows(results: readonly BarResult[]) {
  return results.map((one) => ({
    bar: one.bar.id,
    needs: `${one.bar.kind === "min" ? "≥" : "≤"} ${formatBarValue(one.bar.value, one.bar.unit)}`,
    measured:
      one.measured === undefined
        ? (one.unmeasurable ?? "not measured")
        : one.bar.unit === "per100"
          ? one.measured.toFixed(2)
          : one.bar.unit === "points"
            ? `${(100 * one.measured).toFixed(1)} points`
            : pct(one.measured),
    met: one.met === undefined ? "–" : one.met ? "yes" : "no",
  }));
}
