/**
 * Related words on dictionary entries (plan 081, S11, step 2G): gloss to
 * gloss, on the gap hints' glosses and their cached vectors. For each
 * gloss, its cosine to every other, z-scored against its own cosines to
 * all the others; for an entry, the other glosses that stand out most
 * from any of its own (the best z across them), above a cut-off, at
 * most three.
 */
import { createHash } from "node:crypto";
import {
  RELATED_TABLE_FORMAT,
  type RelatedForm,
  type RelatedGloss,
  type RelatedTable,
} from "../../src/app/enochian/dictionary/related/format.ts";
import {
  glossOptions,
  type Translator,
} from "../../src/app/enochian/translate/lookup.ts";
import { fold } from "../../src/app/enochian/translate/lookupData.ts";
import { type HintGloss, HUB_FORMS } from "./glosses.ts";
import type { HintRecipe } from "./recipe.ts";
import { drawSample, raiseToFit } from "./table.ts";

/** Where the committed table lives, from the repository's root. */
export const RELATED_TABLE_FILE =
  "src/app/enochian/dictionary/related/table.json";

/**
 * The cut-off the first build starts at (see plan 081's 2G build notes
 * for why): judging decides the one that ships.
 */
export const RELATED_START_CUTOFF = 6;

/** The first related sample's seed; a fresh sample takes a new one. */
export const RELATED_SAMPLE_SEED = 1;

/** The most related words an entry shows. */
export const MAX_RELATED = 3;

/** A form a gloss names, and the dictionary entry it opens. */
export interface Link {
  form: string;
  entry: string;
}

/**
 * The forms a gloss shows (its `forms`, hub words already out) that open
 * an entry of their own: a form of the Keys the dictionary lacks, or one
 * the lookup splits into parts, has none here and is left out.
 */
export function glossLinks(translator: Translator, gloss: HintGloss): Link[] {
  const links: Link[] = [];
  for (const option of glossOptions(translator.lookup, gloss.text)) {
    if (!gloss.forms.includes(option.form)) continue;
    const [entry] = option.entries;
    const own = translator.lookup.dictionary.get(fold(option.form));
    if (
      entry &&
      own?.headwords.includes(entry) &&
      !links.some((link) => link.entry === entry)
    )
      links.push({ form: option.form, entry });
  }
  return links;
}

/**
 * The dictionary entries a gloss is a meaning of: every entry whose
 * headword folds as a form the lookup gives for it, whether from the
 * dictionary's meanings or Dee's English, hub words included.
 */
export function glossMembers(
  translator: Translator,
  gloss: HintGloss,
): string[] {
  const members = new Set<string>();
  for (const option of glossOptions(translator.lookup, gloss.text)) {
    if (option.source.kind === "dictionary")
      members.add(option.source.headword);
    for (const headword of translator.lookup.dictionary.get(fold(option.form))
      ?.headwords ?? [])
      members.add(headword);
  }
  return [...members].sort();
}

/** What the relation needs to know of each gloss. */
export interface RelatedGlossInfo extends HintGloss {
  /** The entries it is a meaning of (`glossMembers`). */
  members: readonly string[];
  /** Its forms that open an entry (`glossLinks`). */
  links: readonly Link[];
}

/** Each gloss with its members and links. */
export function relatedGlosses(
  translator: Translator,
  glosses: readonly HintGloss[],
): RelatedGlossInfo[] {
  return glosses.map((one) => ({
    ...one,
    members: glossMembers(translator, one),
    links: glossLinks(translator, one),
  }));
}

/**
 * Each entry's own glosses (indices into `glosses`), by its key: an entry
 * with none in the set has no row; neither has a hub word, whose many
 * short meanings would relate it to everything.
 */
export function entryGlosses(
  glosses: readonly Pick<RelatedGlossInfo, "members">[],
): Map<string, number[]> {
  const byEntry = new Map<string, number[]>();
  glosses.forEach((one, at) => {
    for (const entry of one.members) {
      if (HUB_FORMS.has(fold(entry))) continue;
      const list = byEntry.get(entry) ?? [];
      list.push(at);
      byEntry.set(entry, list);
    }
  });
  return byEntry;
}

/**
 * Every gloss's z-scores against every other: row `g`, column `h` is the
 * cosine of g and h less g's mean cosine to all the others, over their
 * standard deviation (the population's, as `bestGloss` computes it); the
 * diagonal is `NaN`. `vectors` holds `count` unit vectors end to end.
 */
export function similarityZ(
  vectors: Float32Array,
  dimensions: number,
): Float64Array {
  const count = vectors.length / dimensions;
  if (count < 2) throw new Error("Need two glosses to relate");
  const cosines = new Float64Array(count * count);
  for (let g = 0; g < count; g++)
    for (let h = g + 1; h < count; h++) {
      let dot = 0;
      const a = g * dimensions;
      const b = h * dimensions;
      for (let i = 0; i < dimensions; i++)
        dot += vectors[a + i] * vectors[b + i];
      cosines[g * count + h] = dot;
      cosines[h * count + g] = dot;
    }
  const z = new Float64Array(count * count);
  for (let g = 0; g < count; g++) {
    let sum = 0;
    let squares = 0;
    for (let h = 0; h < count; h++) {
      if (h === g) continue;
      const cosine = cosines[g * count + h];
      sum += cosine;
      squares += cosine * cosine;
    }
    const others = count - 1;
    const mean = sum / others;
    const sd = Math.sqrt(Math.max(0, squares / others - mean * mean)) || 1;
    for (let h = 0; h < count; h++)
      z[g * count + h] =
        h === g ? Number.NaN : (cosines[g * count + h] - mean) / sd;
  }
  return z;
}

/**
 * One related word of an entry: a gloss, its best z from the entry's
 * own, and the forms it shows there.
 */
export interface Candidate {
  entry: string;
  gloss: number;
  z: number;
  /** The gloss's links less those a better related word already shows. */
  links: readonly Link[];
}

const UNITS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const ORDINAL_UNITS = [
  "zeroth",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
  "thirteenth",
  "fourteenth",
  "fifteenth",
  "sixteenth",
  "seventeenth",
  "eighteenth",
  "nineteenth",
];
const TENS = [
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

/** Number words to their values: cardinal and ordinal alike ("nine", "ninth"). */
const NUMBER_WORDS: ReadonlyMap<string, number> = new Map([
  ...UNITS.map((word, n) => [word, n] as const),
  ...ORDINAL_UNITS.map((word, n) => [word, n] as const),
  ...ORDINAL_UNITS.slice(3).map((word, n) => [`${word}s`, n + 3] as const),
  ...TENS.map((word, at) => [word, (at + 2) * 10] as const),
  ...TENS.map(
    (word, at) => [`${word.slice(0, -1)}ieth`, (at + 2) * 10] as const,
  ),
  ["hundred", 100],
  ["hundredth", 100],
  ["thousand", 1000],
  ["thousandth", 1000],
]);
/** Simple fractions, which differ from the ordinal ("a quarter" isn't "fourth"). */
const FRACTIONS: ReadonlyMap<string, string> = new Map([
  ["half", "1/2"],
  ["halves", "1/2"],
  ["quarter", "1/4"],
  ["quarters", "1/4"],
]);

/**
 * The numbers a gloss names, as strings: numerals, cardinal and ordinal
 * words by value ("twenty eight" and "28th" are 28; "nine" and "ninth"
 * are 9), and simple fractions ("half", "one half" and "a half" are
 * 1/2; "one fourth" is 1/4, as "a quarter" is). Empty when it names none.
 */
export function numbersIn(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z]+|\d+/g) ?? [];
  const found = new Set<string>();
  for (let at = 0; at < words.length; at++) {
    const word = words[at];
    const next = words[at + 1] ?? "";
    if (/^\d+$/.test(word)) found.add(String(Number(word)));
    else if (FRACTIONS.has(word)) found.add(FRACTIONS.get(word) as string);
    else if (word === "one" && FRACTIONS.has(next)) continue;
    else if (word === "one" && ORDINAL_UNITS.indexOf(next) >= 3) {
      // "one fourth": a fraction, not one and four.
      found.add(`1/${ORDINAL_UNITS.indexOf(next)}`);
      at++;
    } else if (NUMBER_WORDS.has(word)) {
      let value = NUMBER_WORDS.get(word) as number;
      const unit = NUMBER_WORDS.get(next);
      // "twenty eight", "twenty-eighth".
      if (
        value >= 20 &&
        value < 100 &&
        unit !== undefined &&
        unit > 0 &&
        unit < 10
      ) {
        value += unit;
        at++;
      } else if (value > 0 && value < 100 && (unit === 100 || unit === 1000)) {
        // "three hundred", "a thousand" is the thousand alone.
        value *= unit;
        at++;
      }
      found.add(String(value));
    }
  }
  return found;
}

/**
 * Whether two glosses both name numbers and share none: "nine" isn't
 * related to "nineteen", nor "the fifth" to "the fourth", though the
 * model puts them close (plan 081, 2G's judging). Sharing one is
 * enough to keep them, since "one" and "first" also have senses that
 * aren't numbers: "the third arrives first" and "the third" both name
 * 3, "the three are One" and "all one" both 1.
 */
export function differentNumbers(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): boolean {
  if (!a.size || !b.size) return false;
  return ![...a].some((one) => b.has(one));
}

/**
 * Each entry's best related words, at most `max`, whatever the cut-off
 * (a table at a cut-off keeps those at or above it): each other gloss
 * ranked by its best z from any of the entry's own (then by its place),
 * leaving out the entry's own glosses, so never one whose forms include
 * the entry. A gloss that names a different number from the entry's
 * gloss it was matched by (`differentNumbers`) takes no place. Each
 * form shows once: a gloss's forms that a better one already shows are
 * left out of it, and a gloss with none left (or none that opens an
 * entry) takes no place, so "of death" doesn't follow "death" with the
 * same TELOCH. Glosses worded alike are one gloss already. In entry
 * order, then best first; since a better word never depends on a worse
 * one, the words at or above any cut-off are the same as ranking only
 * those. `dropped` hears of each word the number rule left out where
 * it would otherwise have taken a place.
 */
export function rankRelated(
  byEntry: ReadonlyMap<string, readonly number[]>,
  z: Float64Array,
  glosses: readonly Pick<RelatedGlossInfo, "links" | "text">[],
  max = MAX_RELATED,
  dropped?: (one: Candidate & { by: number }) => void,
): Candidate[] {
  const count = glosses.length;
  if (z.length !== count * count) throw new Error("z doesn't fit the glosses");
  const numbers = glosses.map((one) => numbersIn(one.text));
  const out: Candidate[] = [];
  for (const entry of [...byEntry.keys()].sort()) {
    const own = new Set(byEntry.get(entry));
    const best = new Float64Array(count).fill(Number.NEGATIVE_INFINITY);
    // The entry's gloss each best z came from.
    const by = new Int32Array(count).fill(-1);
    for (const g of own)
      for (let h = 0; h < count; h++) {
        const one = z[g * count + h];
        if (one > best[h]) {
          best[h] = one;
          by[h] = g;
        }
      }
    const ranked: number[] = [];
    for (let h = 0; h < count; h++)
      if (!own.has(h) && Number.isFinite(best[h])) ranked.push(h);
    ranked.sort((a, b) => best[b] - best[a] || a - b);
    const shown = new Set<string>();
    let taken = 0;
    for (const gloss of ranked) {
      if (taken >= max) break;
      const links = glosses[gloss].links.filter(
        (link) => !shown.has(link.entry),
      );
      if (!links.length) continue;
      const candidate = { entry, gloss, z: best[gloss], links };
      if (differentNumbers(numbers[by[gloss]], numbers[gloss])) {
        dropped?.({ ...candidate, by: by[gloss] });
        continue;
      }
      for (const link of links) shown.add(link.entry);
      out.push(candidate);
      taken++;
    }
  }
  return out;
}

/** What the table records about how it was made. */
export type RelatedHead = Pick<RelatedTable, "recipe" | "asked" | "glossHash">;

/** A link as the table writes it: the key alone when the form is the key. */
const writtenForm = (link: Link): RelatedForm =>
  link.form === link.entry ? link.entry : [link.form, link.entry];

/**
 * The table at a cut-off: each entry's related words at or above it.
 * A gloss shown with different forms in different entries is a row for
 * each; the rows are sorted by wording, regardless of case, so the
 * committed file reads in order.
 */
export function relatedTableAt(
  candidates: readonly Candidate[],
  glosses: readonly Pick<RelatedGlossInfo, "shown">[],
  cutoff: number,
  head: RelatedHead,
): RelatedTable {
  const kept = candidates.filter((one) => one.z >= cutoff);
  const rowOf = (one: Candidate) =>
    JSON.stringify([glosses[one.gloss].shown, one.links.map(writtenForm)]);
  const sortKey = (row: string) => {
    const [shown] = JSON.parse(row) as [string];
    return [shown.toLowerCase(), row];
  };
  const rows = [...new Set(kept.map(rowOf))].sort((a, b) => {
    const [x, x2] = sortKey(a);
    const [y, y2] = sortKey(b);
    return x < y ? -1 : x > y ? 1 : x2 < y2 ? -1 : x2 > y2 ? 1 : 0;
  });
  const place = new Map(rows.map((row, at) => [row, at]));
  const related: Record<string, number[]> = {};
  for (const one of kept)
    (related[one.entry] ??= []).push(place.get(rowOf(one)) as number);
  return {
    format: RELATED_TABLE_FORMAT,
    recipe: head.recipe,
    asked: head.asked,
    cutoff,
    glossHash: head.glossHash,
    entries: Object.keys(related).length,
    items: kept.length,
    glosses: rows.map((row) => JSON.parse(row) as RelatedGloss),
    related,
  };
}

/**
 * The table at `head.asked`, or at the lowest cut-off a step above it
 * whose served table fits the budget (the gap hints' 150 KB, gzipped).
 */
export function fitRelated(
  candidates: readonly Candidate[],
  glosses: readonly Pick<RelatedGlossInfo, "shown">[],
  head: RelatedHead,
  budget?: number,
  step?: number,
): RelatedTable {
  return raiseToFit(
    head.asked,
    (cutoff) => relatedTableAt(candidates, glosses, cutoff, head),
    (table) => !table.items,
    budget,
    step,
  );
}

/**
 * The SHA-256 the table records: the recipe and every candidate gloss's
 * text, wording, forms, links and members (before `englishOnly`, which
 * needs SCOWL), so a dictionary or Keys change that alters any of them
 * fails the table's test.
 */
export function relatedHash(
  recipe: HintRecipe,
  glosses: readonly RelatedGlossInfo[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        recipe.id,
        "related-v1",
        glosses.map((one) => [
          one.text,
          one.shown,
          !!one.dee,
          one.forms,
          one.links.map((link) => [link.form, link.entry]),
          one.members,
        ]),
      ]),
    )
    .digest("hex");
}

/** A related word as the judges read it: "OLPIRT, OLPRT ‘light’". */
export const relatedText = (
  one: Pick<Candidate, "gloss" | "links">,
  glosses: readonly Pick<RelatedGlossInfo, "shown">[],
) =>
  `${one.links.map((link) => link.form).join(", ")} ‘${glosses[one.gloss].shown}’`;

/**
 * Where a related sample is written, named by its seed and cut-off: a
 * new sample never lands on a judged one (and is refused when it would).
 */
export const relatedSampleName = (seed: number, cutoff: number) =>
  `related-sample-seed${seed}-z${cutoff}.tsv`;

/** `size` of the kept (entry, related word) pairs, drawn from `seed`. */
export function sampleRelated<T extends Pick<Candidate, "entry" | "gloss">>(
  kept: readonly T[],
  size: number,
  seed: number,
): T[] {
  // Entry and gloss index name a pair; padded, so they sort as numbers.
  return drawSample(
    kept,
    (one) => `${one.entry}\t${String(one.gloss).padStart(6, "0")}`,
    size,
    seed,
  );
}

/** One line's cell: tabs and line breaks as spaces. */
const cell = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * The judges' file: the rubric, then one (entry, related word) pair a
 * line, with the entry's meanings, verdicts empty.
 */
export function relatedSampleFile(
  sample: readonly Candidate[],
  glosses: readonly Pick<RelatedGlossInfo, "shown">[],
  meaningsOf: (entry: string) => readonly string[],
  cutoff: number,
  seed: number,
): string {
  const head = [
    `# Related words to judge (plan 081, S11, step 2G): ${sample.length} (entry, related word) pairs drawn at random (seed ${seed}) from the table at z >= ${cutoff}.`,
    "# Judge each related word against the entry's meanings, as the meaning spike judged hints:",
    "#   good  - the related gloss means what the entry means (the same sense, or as near as a synonym);",
    "#   loose - related in meaning, a fair pointer for a reader of the entry, not the same meaning;",
    "#   wrong - anything else.",
    "# Write good, loose or wrong in the last column, then: pnpm enochian:hints related score <this file>",
    ["n", "entry", "meanings", "related", "z", "verdict"].join("\t"),
  ];
  const lines = sample.map((one, at) =>
    [
      at + 1,
      one.entry,
      cell(meaningsOf(one.entry).join(" / ")),
      relatedText(one, glosses),
      // z to six places, so the scorer's cut-off falls where the table's does.
      one.z.toFixed(6),
      "",
    ].join("\t"),
  );
  return `${[...head, ...lines].join("\n")}\n`;
}
