import { englishWords, wordKey } from "./english.ts";
import { type JoinSplit, joinSplits } from "./joins.ts";
import type { KeysTable } from "./keysTable.ts";
import {
  buildLookup,
  enochianWords,
  fold,
  type Lookup,
  type LookupDictionary,
} from "./lookupData.ts";
import { type ToEnglish, toEnglish } from "./toEnglish.ts";
import { type ToEnochian, toEnochian } from "./toEnochian.ts";
import { wordCount } from "./tokens.ts";

/**
 * The Enochian translator's lookup (plan 081, stage 1): a pure module,
 * the same in the browser and on the server, with no model and nothing
 * sent anywhere. Build one with `createTranslator` from the slim Keys
 * table (`keysTable.ts`) and the dictionary (its meanings and their
 * sources are all it reads); it indexes them once.
 */

export type { LookupDictionary } from "./lookupData.ts";
export type {
  LineSegment,
  Reading,
  ReadToken,
  ReadVia,
  ReadWord,
  ToEnglish,
} from "./toEnglish.ts";
export { lineText, readingGloss } from "./toEnglish.ts";

/**
 * Where the page fetches the slim Keys table (`keys.json/route.ts`
 * serves it). Here rather than in the route, which imports the Keys.
 */
export const KEYS_TABLE_URL = "/enochian/translate/keys.json";
export type {
  ChipToken,
  EnochianToken,
  FormOption,
  FormSource,
  FormToken,
  GapToken,
  KeyPlace,
  RuleId,
  TileChip,
  ToEnochian,
} from "./toEnochian.ts";

/** The language a text is in. */
export type Language = "english" | "enochian";

/** The direction guess (decision 4). */
export interface DirectionGuess {
  /** What the text is read as. */
  language: Language;
  /** The share of its words that are English, 0 to 1. */
  english: number;
  /** The share that are Enochian: Dee's, Crowley's, Leitch's or headwords. */
  enochian: number;
  /** One or two words that score on both sides: show both readings. */
  both: boolean;
}

/** What `translate` gives: one reading, or both for an ambiguous input. */
export interface Translation {
  guess: DirectionGuess;
  /** English into Enochian, when read as English or both. */
  toEnochian?: ToEnochian;
  /** Enochian into English, when read as Enochian or both. */
  toEnglish?: ToEnglish;
}

/** The translator, its index built. */
export interface Translator {
  /** English into Enochian (decisions 6–12). */
  toEnochian(text: string): ToEnochian;
  /** Enochian into English (decisions 13–16). */
  toEnglish(text: string): ToEnglish;
  /** Which way a text goes (decision 4). */
  guessDirection(text: string): DirectionGuess;
  /**
   * The guessed reading, or the one asked for; both for a short input
   * that scores both ways, unless a language is asked for.
   */
  translate(text: string, language?: Language): Translation;
  /** The join rule on a folded word (decision 15); see `joinSplits`. */
  joinSplits(word: string, exclude?: ReadonlySet<string>): JoinSplit[];
  /** The index, for the figures script and tests. */
  lookup: Lookup;
}

/** The most words an input may have for both readings to be shown. */
const BOTH_UP_TO = 2;

/**
 * Scores both readings (decision 4): the share of words that are English
 * against the share that are Enochian (ours, Crowley's, Leitch's, or one
 * the join rule splits); English wins a tie.
 */
export function guessDirection(lookup: Lookup, text: string): DirectionGuess {
  const english = englishWords(text);
  const enochian = enochianWords(text).map(fold);
  const share = (hits: number, of: number) => (of ? hits / of : 0);
  const englishScore = share(
    english.filter((word) => lookup.englishVocabulary.has(wordKey(word)))
      .length,
    english.length,
  );
  // A word the join rule reads (DSSALMAN) is Enochian too (decision 15).
  const enochianScore = share(
    enochian.filter(
      (word) =>
        lookup.enochianWords.has(word) || joinSplits(lookup, word).length > 0,
    ).length,
    enochian.length,
  );
  const typed = wordCount(text);
  return {
    language: enochianScore > englishScore ? "enochian" : "english",
    english: englishScore,
    enochian: enochianScore,
    both: typed <= BOTH_UP_TO && englishScore > 0 && enochianScore > 0,
  };
}

/** Builds the translator (see the module's comment). */
export function createTranslator(
  table: KeysTable,
  dictionary: LookupDictionary,
): Translator {
  const lookup = buildLookup(table, dictionary);
  return {
    lookup,
    toEnochian: (text) => toEnochian(lookup, text),
    toEnglish: (text) => toEnglish(lookup, text),
    guessDirection: (text) => guessDirection(lookup, text),
    joinSplits: (word, exclude) => joinSplits(lookup, word, exclude),
    translate(text, language) {
      const guess = guessDirection(lookup, text);
      const english = language
        ? language === "english"
        : guess.language === "english" || guess.both;
      const enochian = language
        ? language === "enochian"
        : guess.language === "enochian" || guess.both;
      return {
        guess,
        ...(english ? { toEnochian: toEnochian(lookup, text) } : {}),
        ...(enochian ? { toEnglish: toEnglish(lookup, text) } : {}),
      };
    },
  };
}
