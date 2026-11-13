import type { Lookup } from "./lookupData.ts";
import type { RuleId } from "./toEnochian.ts";

/**
 * Joined words split by rule (plan 081, decision 15), for a word not found
 * whole. In front, G26's small words and OD (G30), I and L only before a
 * Key word, since alone they split too much; behind, TOX and TILB (G22).
 * The rest must be a known word of three letters or more, allowing G27's
 * shared letter (DS + SONF is DSONF). Q is not a prefix: in the spike it
 * made two wrong splits, no right ones, and a third of the false splits
 * of typos.
 */

/** A small word written in front, with its English and its rule. */
export const FRONT: readonly (readonly [string, string, RuleId])[] = [
  ["DS", "which", "G26"],
  ["I", "is", "G26"],
  ["CHIS", "are", "G26"],
  ["TA", "as", "G26"],
  ["L", "one", "G26"],
  ["AR", "that", "G26"],
  ["OI", "this", "G26"],
  ["AG", "no", "G26"],
  ["OD", "and", "G30"],
];

/** A possessive written behind (G22). */
export const BEHIND: readonly (readonly [string, string, RuleId])[] = [
  ["TOX", "his", "G22"],
  ["TILB", "her", "G22"],
];

/** Small words that only split off before one of Dee's own words. */
const ONLY_BEFORE_KEY_WORDS: ReadonlySet<string> = new Set(["I", "L"]);

/** The shortest word left beside a small one. */
const SHORTEST_REST = 3;

/** One way to split a joined word. */
export interface JoinSplit {
  /** The two words, folded, in order. */
  parts: readonly [string, string];
  /** The rules that made it: G26, G30 or G22, then G27 for a shared letter. */
  rules: readonly RuleId[];
}

/** Whether a folded word is known whole: Dee's, Crowley's or the dictionary's. */
function knownWhole(
  lookup: Lookup,
  word: string,
  exclude: ReadonlySet<string> = new Set(),
): boolean {
  return (
    !exclude.has(word) &&
    (lookup.keyForms.has(word) ||
      lookup.gdForms.has(word) ||
      lookup.dictionary.has(word))
  );
}

/**
 * Every way the rule splits a folded word, in the rule's order: front
 * words first, then behind. Two are shown when two fit (OISALMAN is OI
 * SALMAN or OI ISALMAN). `exclude` holds words out of the known ones, to
 * test the rule on words it would otherwise find whole.
 */
export function joinSplits(
  lookup: Lookup,
  word: string,
  exclude: ReadonlySet<string> = new Set(),
): JoinSplit[] {
  const out: JoinSplit[] = [];
  const add = (one: JoinSplit) => {
    if (
      !out.some(
        (had) => had.parts[0] === one.parts[0] && had.parts[1] === one.parts[1],
      )
    )
      out.push(one);
  };
  for (const [small, , rule] of FRONT) {
    if (!word.startsWith(small) || word.length <= small.length) continue;
    const rest = word.slice(small.length);
    for (const [candidate, shared] of [
      [rest, false],
      [small.at(-1) + rest, true],
    ] as const) {
      if (candidate.length < SHORTEST_REST) continue;
      if (!knownWhole(lookup, candidate, exclude)) continue;
      if (ONLY_BEFORE_KEY_WORDS.has(small) && !lookup.keyForms.has(candidate))
        continue;
      add({
        parts: [small, candidate],
        rules: shared ? [rule, "G27"] : [rule],
      });
    }
  }
  for (const [small, , rule] of BEHIND) {
    if (!word.endsWith(small) || word.length <= small.length) continue;
    const stem = word.slice(0, -small.length);
    for (const [candidate, shared] of [
      [stem, false],
      [stem + small[0], true],
    ] as const) {
      if (candidate.length < SHORTEST_REST) continue;
      if (!knownWhole(lookup, candidate, exclude)) continue;
      add({
        parts: [candidate, small],
        rules: shared ? [rule, "G27"] : [rule],
      });
    }
  }
  return out;
}
