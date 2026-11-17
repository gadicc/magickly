/**
 * Our side of the gap hints (plan 081, S11): the glosses a word can be
 * close to, as the meaning spike built them. Every exact gloss of the
 * lookup (Dee's English for a row, or a dictionary meaning), in its
 * commonest tokenised wording (what is embedded), with the wording a
 * reader sees; grammar-only glosses, names (tablet and Aethyr names,
 * ministers, letters), notes rather than meanings, the denylist and the
 * hub words left out; glosses worded alike merged; each with the forms
 * the lookup shows for it. `englishOnly` then drops, at build time, any
 * gloss with a word outside SCOWL's lists.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  AUXILIARIES,
  BE,
  FUNCTION_WORDS,
  NEGATION,
  PRONOUNS,
} from "../../src/app/enochian/translate/english.ts";
import {
  glossOptions,
  isContent,
  type Translator,
} from "../../src/app/enochian/translate/lookup.ts";
import {
  fold,
  type IndexHit,
} from "../../src/app/enochian/translate/lookupData.ts";
import type { HintRecipe } from "./recipe.ts";

/** A gloss as embedded and shown, with the forms it leads to. */
export interface HintGloss {
  /** As embedded: the lookup's tokenised wording ("of justice"). */
  text: string;
  /** As a reader sees it: the dictionary's (or Dee's) own wording. */
  shown: string;
  /**
   * `shown` is Dee's English (no dictionary words it), whose old
   * spellings ("terrour") the word-list check reads through `text`.
   */
  dee?: true;
  /** As the lookup shows them, best first, at most `MAX_FORMS`. */
  forms: string[];
}

/** The most forms a hint names. */
export const MAX_FORMS = 3;

const MODALS = [
  "can",
  "could",
  "may",
  "might",
  "must",
  "should",
  "would",
  "shall",
  "will",
  "let",
  "to",
];
const WH = [
  "what",
  "who",
  "whom",
  "whose",
  "which",
  "when",
  "where",
  "why",
  "how",
  "that",
  "this",
  "these",
  "those",
  "there",
  "here",
];
/** The spike's grammar words: a gloss of nothing else is no meaning. */
const GRAMMAR: ReadonlySet<string> = new Set([
  ...FUNCTION_WORDS,
  ...PRONOUNS,
  ...AUXILIARIES,
  ...BE,
  ...NEGATION,
  ...MODALS,
  ...WH,
]);

/** Whether every word of a gloss is grammar (the spike's, or the lookup's). */
export const isGrammarGloss = (text: string) =>
  text.split(/\s+/).every((word) => GRAMMAR.has(word) || !isContent(word));

/**
 * Tablet and Aethyr names, ministers, letters: a name, not a meaning
 * (the spike's filter, unchanged). The tablets build them from shared
 * letters, so their glosses say nothing a reader's word could mean.
 */
const NAME =
  /^(servient|kerubic) (arch)?angel|^senior |^(\d+(st|nd|rd|th)|first|second|third|fourth|fifth|sixth) minister of|^\d+ ?(st|nd|rd|th) aethyr|^\w+th aethyr$|^the \d+ ?(st|nd|rd|th)? aethyr|^angel (of )?\w+ in \w+|king of \w+ tablet|god-names?\b|^enochian letter|^name of|angel's name|^warden of aethyr|^zodiacal king|elemental king|^(a )?holy name of/;
export const isNameGloss = (text: string) => NAME.test(text);

/**
 * The spike's hub words: forms whose many short meanings make them the
 * nearest to everything. They are never offered as a hint's form.
 */
export const HUB_FORMS: ReadonlySet<string> = new Set([
  "DE",
  "CHIS",
  "NONCF",
  "Q",
  "LAP",
  "GEH",
  "BRINTS",
]);

/**
 * The words that mark a gloss as a dictionary's note rather than a
 * meaning: "name of", "line of", "title of", "also a formal noun",
 * "shortened", "unk".
 */
const EDITORIAL =
  /\b(?:names?|line|root|form|title) of\b|\bword for\b|\b(?:also|noun|verb|adjective|shortened|abbreviation|abbreviated|var|alt|cf|unk|unknown|uncertain|probably|perhaps|possibly)\b/;

/** Letters, with single spaces, hyphens or apostrophes between words. */
const PLAIN = /^[A-Za-z]+(?:[ '’-][A-Za-z]+)*$/;

/**
 * Whether a gloss reads as a note, not a meaning, by its wording: a
 * question mark or "unk", a numeral, anything but letters, spaces,
 * hyphens and apostrophes ("mean.unk.", "(R)", "inspiration— inertia"),
 * or an editorial word.
 */
export function isEditorialGloss(shown: string, text: string): boolean {
  return (
    /\d/.test(shown) ||
    /\d/.test(text) ||
    !PLAIN.test(shown) ||
    EDITORIAL.test(shown.toLowerCase()) ||
    EDITORIAL.test(text)
  );
}

/**
 * Glosses a rule can't catch, each reviewed and given its reason, in
 * `denylist.txt`: by the gloss as embedded (its `text`).
 */
export const DENYLIST: ReadonlySet<string> = new Set(
  readFileSync(new URL("./denylist.txt", import.meta.url), "utf8")
    .split("\n")
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean),
);

/**
 * How a hit words its meaning: the dictionary's gloss, or Dee's English
 * for the row, with runs of spaces closed up and the punctuation, quote
 * marks and dashes at its edges off ("—appear", "'to charge'").
 */
function wording(hit: IndexHit): string {
  const raw =
    hit.origin.kind === "key" ? hit.origin.row.english : hit.origin.gloss;
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:!'"‘’“”—–-]+|[\s,.;:!'"‘’“”—–-]+$/g, "");
}

/**
 * The wording a reader sees for a gloss, from its hits: a plain one
 * (`PLAIN`) before any other, a dictionary's before Dee's, one in lower
 * case before one in capitals, then the commonest, the shortest, the
 * first alphabetically; capitals alone ("LIGHT") lowered.
 */
function shownWording(hits: readonly IndexHit[]): {
  shown: string;
  dee: boolean;
} {
  const counts = new Map<string, { n: number; dictionary: boolean }>();
  for (const hit of hits) {
    const one = wording(hit);
    const was = counts.get(one) ?? { n: 0, dictionary: false };
    counts.set(one, {
      n: was.n + 1,
      dictionary: was.dictionary || hit.origin.kind === "dictionary",
    });
  }
  const lower = (one: string) => /[a-z]/.test(one);
  const [best, { dictionary }] = [...counts].sort(
    ([a, x], [b, y]) =>
      Number(PLAIN.test(b)) - Number(PLAIN.test(a)) ||
      Number(y.dictionary) - Number(x.dictionary) ||
      Number(lower(b)) - Number(lower(a)) ||
      y.n - x.n ||
      a.length - b.length ||
      (a < b ? -1 : a > b ? 1 : 0),
  )[0] ?? ["", { n: 0, dictionary: true }];
  return { shown: lower(best) ? best : best.toLowerCase(), dee: !dictionary };
}

/**
 * The candidate glosses, sorted by their text (see the module's
 * comment), before `englishOnly`: each tier-1 gloss in its commonest
 * tokenised wording (`text`, what was embedded; "of justice"), with the
 * wording a reader sees (`shown`), less names, grammar, notes
 * (`isEditorialGloss`), the denylist and hub forms.
 */
export function hintGlosses(translator: Translator): HintGloss[] {
  const { lookup } = translator;
  const [tier1] = lookup.tiers.literal;
  const merged = new Map<string, { hits: IndexHit[]; forms: string[] }>();
  for (const hits of tier1.values()) {
    // A core's commonest wording, as the spike embedded it: "of justic"
    // is "of justice".
    const counts = new Map<string, number>();
    for (const hit of hits) {
      const one = hit.words.join(" ");
      counts.set(one, (counts.get(one) ?? 0) + 1);
    }
    const [text] = [...counts].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0] ?? [""];
    if (!text || isNameGloss(text) || isGrammarGloss(text)) continue;
    const forms = glossOptions(lookup, text)
      .map((option) => option.form)
      .filter((form) => !HUB_FORMS.has(fold(form)));
    if (!forms.length) continue;
    const one = merged.get(text) ?? { hits: [], forms: [] };
    one.hits.push(...hits.filter((hit) => hit.words.join(" ") === text));
    for (const form of forms)
      if (!one.forms.includes(form)) one.forms.push(form);
    merged.set(text, one);
  }
  return [...merged]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([text, { hits, forms }]): HintGloss => {
      const { shown, dee } = shownWording(hits);
      return {
        text,
        shown,
        ...(dee ? { dee: true as const } : {}),
        forms: forms.slice(0, MAX_FORMS),
      };
    })
    .filter(
      (one) =>
        !DENYLIST.has(one.text) &&
        !isNameGloss(one.shown.toLowerCase()) &&
        !isEditorialGloss(one.shown, one.text),
    );
}

/** A wording's words for the word-list check: lower case, "'s" off. */
const checkedWords = (wordingOf: string) =>
  wordingOf
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/['’]/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean);

/**
 * The glosses whose every word, as embedded and as a dictionary shows
 * it, is in `english` (SCOWL's lists to size 70): no cut-short or
 * garbled word ("squar", "sangef", "not-ing") reaches a reader. Dee's
 * own wording is checked as the lookup reads it (`text`), so his
 * "terrour" passes as "terror". Run at build time, since the lists come
 * from the archive; it only removes glosses, so it needs no new vectors.
 */
export function englishOnly(
  glosses: readonly HintGloss[],
  english: ReadonlySet<string>,
): HintGloss[] {
  return glosses.filter((one) =>
    [
      ...checkedWords(one.text),
      ...(one.dee ? [] : checkedWords(one.shown)),
    ].every((word) => english.has(word)),
  );
}

/**
 * The SHA-256 the table records: the recipe and every candidate gloss's
 * text, wording and forms (before `englishOnly`, which needs SCOWL), so a dictionary or Keys change that alters any of them fails
 * the table's test.
 */
export function glossHash(recipe: HintRecipe, glosses: readonly HintGloss[]) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        recipe.id,
        glosses.map((one) => [one.text, one.shown, !!one.dee, one.forms]),
      ]),
    )
    .digest("hex");
}
