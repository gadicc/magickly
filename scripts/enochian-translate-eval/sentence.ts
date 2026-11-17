import type { Translator } from "../../src/app/enochian/translate/lookup.ts";
import type { AnswerItem } from "./answer.ts";
import { contentStems, englishWords } from "./normalise.ts";

/**
 * Plan 081's sentence rule (S7): the model's sentence is shown only when
 * most of its content words appear in the word readings or the lookup's
 * glosses; otherwise it is withheld, saying so. One place, so stage 2's
 * checker (2C) and card (2E) take it from here; it reads only
 * `normalise.ts`, which moves into the app with the checker.
 *
 * Words are compared as the checker compares English: lower-cased, Dee's
 * spellings folded, function words left out (`FUNCTION_WORDS`) and the
 * rest stemmed (`contentStems`). "Most" (plan 081, S7) is more than half
 * of the sentence's distinct content words. "Sentence" is the reply's field: the whole
 * passage read as English, in as many sentences as it needs; the rule
 * reads it as one text.
 */

/** The share of a sentence's content words the evidence must exceed. */
export const SENTENCE_RULE_SHARE = 0.5;

/** What the rule decides for one sentence, and why. */
export interface SentenceVerdict {
  /** Whether the card may show the sentence. */
  shown: boolean;
  /** The sentence's distinct content words, stemmed. */
  contentWords: number;
  /** How many of them the evidence holds. */
  supported: number;
  /** `supported / contentWords`, or 0 when it has none. */
  share: number;
  /** The content words the evidence lacks, stemmed, in order. */
  unsupported: string[];
  /** Why it is withheld, when it is. */
  withheld?: "no sentence" | "no content words" | "too few supported";
}

/**
 * S7's rule on one sentence, against the English it may draw on (`evidence`:
 * the word readings' English and the lookup's glosses, `sentenceEvidence`).
 * Fails closed: no sentence, or one with no content words, is withheld, as
 * it says nothing a reader could check.
 */
export function sentenceRule(
  sentence: string | undefined,
  evidence: readonly string[],
): SentenceVerdict {
  if (!sentence?.trim())
    return {
      shown: false,
      contentWords: 0,
      supported: 0,
      share: 0,
      unsupported: [],
      withheld: "no sentence",
    };
  const words = [...new Set(contentStems(sentence))];
  if (!words.length)
    return {
      shown: false,
      contentWords: 0,
      supported: 0,
      share: 0,
      unsupported: [],
      withheld: "no content words",
    };
  const known = new Set(evidence.flatMap((one) => contentStems(one)));
  const unsupported = words.filter((one) => !known.has(one));
  const supported = words.length - unsupported.length;
  const share = supported / words.length;
  const shown = share > SENTENCE_RULE_SHARE;
  return {
    shown,
    contentWords: words.length,
    supported,
    share,
    unsupported,
    ...(shown ? {} : { withheld: "too few supported" as const }),
  };
}

/**
 * The English a sentence may draw on: the model's word readings (each
 * item's target, except a reading given as "unknown") and the lookup's
 * glosses for the passage (`lookupGlosses`).
 */
export function sentenceEvidence(
  items: readonly AnswerItem[],
  glosses: readonly string[],
): string[] {
  return [
    ...items.filter((one) => one.basis !== "unknown").map((one) => one.target),
    ...glosses,
  ];
}

/**
 * The lookup's glosses for a passage, as the page's lookup reads it
 * (`Translator.toEnglish`): for every word, every reading it offers (not
 * only the line's first), each of the reading's words' gloss, the English
 * of the Key rows it stands for, and every meaning of the dictionary
 * entries it opens. So a sentence may use any sense our data gives a word
 * of the passage, as the card's reader could find it.
 */
export function lookupGlosses(
  translator: Translator,
  passage: string,
): string[] {
  const { source } = translator.lookup;
  const out: string[] = [];
  for (const token of translator.toEnglish(passage).tokens)
    for (const reading of token.readings)
      for (const word of reading.words) {
        if (word.gloss) out.push(word.gloss);
        for (const row of word.rows) if (row.english) out.push(row.english);
        for (const entry of word.entries)
          for (const one of source[entry]?.meanings ?? [])
            out.push(one.meaning);
      }
  return out;
}

/** A text's length in English words, as the checker counts them. */
export function englishLength(text: string): number {
  return englishWords(text).length;
}
