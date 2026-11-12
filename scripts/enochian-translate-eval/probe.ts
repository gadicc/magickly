import { z } from "zod";
import { type Effort, shortName } from "./models.ts";
import { englishAgrees, normEnochian } from "./normalise.ts";
import { lastJsonBlock, parseReply } from "./reply.ts";
import type { KeyRowRecord } from "./testset.ts";
import type { ModelRequest } from "./transport.ts";

/**
 * The recall probe (plan 077, "Tasks"): arm A0 only. Given a Key's number and
 * its first row, the model recites the rest of the Key, once in English and
 * once in Enochian. A Key is flagged when either recital gets at least half
 * its rows right in order; the memory bar (A2 against A2c) is measured on the
 * Keys not flagged.
 */

export type Side = "english" | "enochian";

export const SIDES: readonly Side[] = ["english", "enochian"];

/** A recital's share of rows right in order that flags its Key. */
export const FLAG_SHARE = 0.5;

const pad = (n: number) => String(n).padStart(2, "0");

export function probeId(
  key: number,
  side: Side,
  model: string,
  effort: Effort,
) {
  return `probe-${side}-k${pad(key)}-${shortName(model)}-${effort}`;
}

export const PROBE_INSTRUCTIONS = `You are asked about the nineteen Keys (Calls) in the Enochian language that John Dee and Edward Kelley recorded in 1584, as Meric Casaubon printed them in 1659 with Dee's English.

Answer from what you know. Work through it as you need to, then end your reply with one fenced code block marked json, holding an object with one field, "rows": a list of strings, one per Enochian word of the Key, in order. Give your best attempt at every word to the end of the Key, even where you are unsure of it. Write nothing after the block.`;

/** The rows a recital is scored on: those after the first with that side. */
export function probeRows(rows: readonly KeyRowRecord[], side: Side) {
  return rows
    .filter((row) => row.row > 1)
    .filter((row) => (side === "english" ? row.english : row.word));
}

/** A Key's two probe requests. `rows` are the Key's rows, in order. */
export function probeRequests(
  rows: readonly KeyRowRecord[],
  model: string,
  effort: Effort,
): ModelRequest[] {
  const first = rows.find((row) => row.row === 1);
  if (!first) throw new Error("A Key needs its first row");
  const key = first.key;
  const name =
    key === 19 ? "Key 19, the Call of the Thirty Aethyrs" : `Key ${key}`;
  const given = `${name} begins with the word ${first.word ?? first.gd}, which Dee rendered "${first.english}".`;
  const ask: Record<Side, string> = {
    english: `Write out the rest of Dee's English for this Key, after that first word: one string per Enochian word, giving Dee's English for that word, in order.`,
    enochian: `Write out the rest of this Key in Enochian, after that first word: one string per word, in Casaubon's spelling, in order.`,
  };
  return SIDES.map((side) => ({
    id: probeId(key, side, model, effort),
    kind: "probe" as const,
    model,
    effort,
    instructions: [PROBE_INSTRUCTIONS],
    prompt: `${given}\n\n${ask[side]}`,
  }));
}

const recitalSchema = z.object({ rows: z.array(z.string()) });

/**
 * A recital's units. The json block's list; failing that, the reply itself,
 * a line per unit in English and a word per unit in Enochian, so a reply in
 * the wrong shape can still flag its Key (the safer error here).
 */
export function recitalUnits(
  text: string,
  side: Side,
): {
  units: string[];
  error?: string;
} {
  const parsed = parseReply(text, recitalSchema);
  if (parsed.ok) return { units: parsed.value.rows };
  const body = lastJsonBlock(text) ?? text;
  const units =
    side === "english"
      ? body.split("\n").map((one) => one.trim())
      : body.split(/[^A-Za-z-]+/);
  return { units: units.filter(Boolean), error: parsed.error };
}

/**
 * The most rows matched in order (a longest common subsequence): an English
 * row by the scorer's comparison (`englishAgrees`), an Enochian one by its
 * normalised spelling (Casaubon's or the Golden Dawn's).
 */
export function inOrderMatches(
  rows: readonly KeyRowRecord[],
  units: readonly string[],
  side: Side,
): number {
  const matches = (row: KeyRowRecord, unit: string) => {
    if (side === "english") return englishAgrees(row.english, unit);
    const norm = normEnochian(unit);
    return (
      Boolean(norm) &&
      [row.word, row.gd].some((form) => form && normEnochian(form) === norm)
    );
  };
  let previous = new Array<number>(units.length + 1).fill(0);
  for (const row of rows) {
    const current = [0];
    for (let j = 1; j <= units.length; j++)
      current[j] = matches(row, units[j - 1])
        ? previous[j - 1] + 1
        : Math.max(previous[j], current[j - 1]);
    previous = current;
  }
  return previous[units.length];
}

export interface RecitalScore {
  matched: number;
  rows: number;
  share: number;
  units: number;
  error?: string;
}

export function scoreRecital(
  rows: readonly KeyRowRecord[],
  text: string,
  side: Side,
): RecitalScore {
  const scored = probeRows(rows, side);
  const { units, error } = recitalUnits(text, side);
  const matched = inOrderMatches(scored, units, side);
  const out: RecitalScore = {
    matched,
    rows: scored.length,
    share: scored.length ? matched / scored.length : 0,
    units: units.length,
  };
  if (error) out.error = error;
  return out;
}

/** A Key's probe: both recitals and whether it is flagged. */
export interface KeyProbe {
  english?: RecitalScore;
  enochian?: RecitalScore;
  /**
   * Set when a recital is missing: not run, its call failed or didn't finish
   * normally, or it came back empty. A Key with an incomplete side is never
   * counted as clear unless the other side flags it.
   */
  incomplete?: boolean;
  flagged: boolean;
}

export function probeKey(
  rows: readonly KeyRowRecord[],
  texts: Partial<Record<Side, string>>,
): KeyProbe {
  const out: KeyProbe = { flagged: false };
  for (const side of SIDES) {
    const text = texts[side];
    // A side whose call failed, was cut off or filtered, or came back empty
    // says nothing about memory: incomplete, never "not recited".
    if (text === undefined || !text.trim()) {
      out.incomplete = true;
      continue;
    }
    const score = scoreRecital(rows, text, side);
    out[side] = score;
    if (score.share >= FLAG_SHARE) out.flagged = true;
  }
  return out;
}
