import type { ReadToken, Translator } from "../lookup.ts";
import { numberedInput } from "./numbering.ts";

/**
 * Which passages the AI reading takes (plan 081, S2 and S3), and how one is
 * laid out for the prompt and broken into parts (S5). Pure, with no I/O, so
 * the route admits with it and the card (step 2E) can offer the reading only
 * when the route would take it.
 *
 * A word is the lookup's token (`toEnglish`), as the checker counts it
 * (plan 081, "2C build notes"): one of Crowley's spaced forms, "das iod", is
 * one word.
 */

/** The most words a reading takes (S3). */
export const MAX_READING_WORDS = 150;
/** The most characters a reading's text may have (S3). */
export const MAX_READING_CHARS = 1200;
/** The most letters one word may have (S3). */
export const MAX_WORD_LETTERS = 30;
/** The fewest words a reading takes (S2). */
export const MIN_READING_WORDS = 2;
/** The share of the words that must be ours (S3). */
export const MIN_OURS_SHARE = 0.8;
/** The most words that may not be ours, whatever the share (S3). */
export const MAX_NOT_OURS = 10;
/** The most words one model call reads (S5). */
export const PART_WORDS = 75;
/**
 * The version of how a passage is laid out, broken into parts and numbered
 * (`admitReading`'s passage, `readingParts`), part of the shared store's key
 * (`readingStoreVersion`): bump it when either changes, since a stored
 * reading's parts and numbering follow it.
 */
export const PARTS_VERSION = 2;
/** A reading costs one unit, plus one for each full this many words (S4). */
export const WORDS_PER_EXTRA_UNIT = 100;

/**
 * What a reading's text may hold: the letters A to Z, white space, and the
 * punctuation a passage copied from the Keys or typed by a reader carries,
 * which the lookup's tokeniser passes over (`enochianWords`) and the prompt
 * never sees. An apostrophe or a hyphen inside a word joins it, as the
 * lookup reads Crowley's "ta-el-o".
 */
const ADMITTED = /^[A-Za-z\s.,;:!?'’‘"“”()-]*$/;

/**
 * The lookup's Enochian words (`enochianWords`) on admitted text, with
 * where each ends: on text of the letters A to Z, `\p{L}` is `[A-Za-z]` and
 * taking accents off changes nothing.
 */
const WORD = /[A-Za-z]+(?:['-][A-Za-z]+)*/g;

/** Punctuation or a line break after a word ends its sentence. */
const SENTENCE_END = /[.!?;:\n]/;

/** Why a text isn't read. */
export type AdmissionRefusal =
  /** More than `MAX_READING_CHARS` characters. */
  | "too long"
  /** A character other than A to Z and the admitted separators. */
  | "characters"
  /** A word of more than `MAX_WORD_LETTERS` letters. */
  | "long word"
  /** Fewer than `MIN_READING_WORDS` words. */
  | "too few words"
  /** More than `MAX_READING_WORDS` words. */
  | "too many words"
  /** Too few of its words are ours (S3). */
  | "not ours"
  /** Every word is in a run of Dee's Key rows, whose English the lookup shows (S2). */
  | "dee's lines";

/** A text the reading takes. */
export interface Admitted {
  ok: true;
  /** Its words, as the lookup counts them. */
  words: number;
  /** What a reading of it costs from the daily allowance (S4). */
  units: number;
  /**
   * The passage as the prompt carries it: a sentence a line, single
   * spaces, our words as typed (keeping a hyphen or apostrophe inside one,
   * as in Crowley's "ta-el-o") and words not ours as their letters only; no
   * other punctuation. The store keys on it (S7), so two texts differing
   * only in spacing or punctuation between words are one reading.
   */
  passage: string;
}

/** The outcome of `admitReading`. */
export type Admission =
  | Admitted
  | { ok: false; reason: AdmissionRefusal; words: number };

/** What a reading of `words` words costs: one, plus one per full 100. */
export const readingUnits = (words: number) =>
  1 + Math.floor(words / WORDS_PER_EXTRA_UNIT);

/** A text laid out as the lookup reads it, a sentence a line. */
interface Layout {
  tokens: readonly ReadToken[];
  /** The tokens' indices, a sentence a line. */
  lines: readonly (readonly number[])[];
}

/**
 * The lookup's tokens for a text and where its sentences end. A token ends
 * a line when its last typed word is followed by a sentence's end.
 */
function layout(translator: Translator, text: string): Layout {
  const { tokens } = translator.toEnglish(text);
  const ends: boolean[] = [];
  const found = [...text.matchAll(WORD)];
  found.forEach((match, at) => {
    const next = found[at + 1]?.index ?? text.length;
    ends.push(
      SENTENCE_END.test(text.slice(match.index + match[0].length, next)),
    );
  });
  const lines: number[][] = [[]];
  tokens.forEach((token, at) => {
    lines[lines.length - 1].push(at);
    if (ends[token.span[1] - 1] && at < tokens.length - 1) lines.push([]);
  });
  return { tokens, lines: lines.filter((line) => line.length) };
}

/** The lines' words as typed, joined as the prompt carries them. */
/**
 * A word as the prompt carries it: one of ours as typed (Crowley's
 * "ta-el-o" keeps its hyphens, as the lookup reads it), one not ours as its
 * letters only, so nothing but letters of a reader's own reaches the model.
 */
const carried = (token: ReadToken) =>
  token.readings.length ? token.input : token.input.replace(/['-]/g, "");

const linesText = (
  tokens: readonly ReadToken[],
  lines: readonly (readonly number[])[],
) =>
  lines
    .map((line) => line.map((at) => carried(tokens[at])).join(" "))
    .join("\n");

/**
 * Whether the reading takes a text (S2, S3): at most 1,200 characters, A to
 * Z and the admitted separators only, no word over 30 letters, at most 150
 * words as typed; from 2 to 150 words as the lookup reads them, of which at least 80% and all but 10 are ours (any reading the
 * lookup has: a Key word, a headword, a Golden Dawn or Leitch spelling, a
 * join the rule splits); and at least one word outside a run of Dee's Key
 * rows, so it is never offered and then refused.
 */
export function admitReading(translator: Translator, text: string): Admission {
  if (text.length > MAX_READING_CHARS)
    return { ok: false, reason: "too long", words: 0 };
  if (!ADMITTED.test(text))
    return { ok: false, reason: "characters", words: 0 };
  const typed: readonly string[] = text.match(WORD) ?? [];
  if (typed.some((word) => word.replace(/['-]/g, "").length > MAX_WORD_LETTERS))
    return { ok: false, reason: "long word", words: 0 };
  // Counted as typed before the lookup reads any: a token is one typed word
  // or more (Crowley's "das iod"), so no text refused here has 150 tokens
  // or fewer but by a spaced form, and an oversized text costs no lookup.
  if (typed.length > MAX_READING_WORDS)
    return { ok: false, reason: "too many words", words: typed.length };
  const { tokens, lines } = layout(translator, text);
  const words = tokens.length;
  const refuse = (reason: AdmissionRefusal): Admission => ({
    ok: false,
    reason,
    words,
  });
  if (words < MIN_READING_WORDS) return refuse("too few words");
  if (words > MAX_READING_WORDS) return refuse("too many words");
  const ours = tokens.filter((token) => token.readings.length > 0).length;
  if (ours < MIN_OURS_SHARE * words || words - ours > MAX_NOT_OURS)
    return refuse("not ours");
  if (tokens.every((token) => token.run !== undefined))
    return refuse("dee's lines");
  return {
    ok: true,
    words,
    units: readingUnits(words),
    passage: linesText(tokens, lines),
  };
}

/** One part of a reading: one model call (S5). */
export interface ReadingPart {
  /** The part's passage, a sentence a line, as the checker reads it. */
  text: string;
  /** Task 1's input for it: its words numbered from 1, a sentence a line. */
  input: string;
  /** Its words, as the lookup counts them in the part. */
  words: number;
}

/**
 * Where to end the first part, in tokens: the most even break that leaves
 * neither part over `PART_WORDS`, at a sentence's end if one is in reach,
 * else between runs of Dee's lines (or outside one), else at the middle.
 */
function breakAt({ tokens, lines }: Layout): number {
  const n = tokens.length;
  const from = n - PART_WORDS;
  const to = PART_WORDS;
  const middle = n / 2;
  const nearest = (candidates: number[]) =>
    candidates.reduce<number | undefined>(
      (best, k) =>
        best === undefined || Math.abs(k - middle) < Math.abs(best - middle)
          ? k
          : best,
      undefined,
    );
  const inReach = (k: number) => k >= from && k <= to;
  const sentenceEnds: number[] = [];
  let count = 0;
  for (const line of lines) {
    count += line.length;
    if (count < n && inReach(count)) sentenceEnds.push(count);
  }
  const runEnds: number[] = [];
  for (let k = Math.max(1, from); k <= to; k++) {
    const before = tokens[k - 1].run;
    if (before === undefined || before !== tokens[k].run) runEnds.push(k);
  }
  return (
    nearest(sentenceEnds) ??
    nearest(runEnds) ??
    Math.min(to, Math.max(from, Math.round(middle)))
  );
}

/**
 * An admitted passage's parts: one of up to `PART_WORDS` words, or two,
 * broken where the text allows (`breakAt`). Each part is laid out again on
 * its own, so its words are numbered as the checker will read them.
 */
export function readingParts(
  translator: Translator,
  passage: string,
): ReadingPart[] {
  const whole = layout(translator, passage);
  const n = whole.tokens.length;
  const ranges: [number, number][] =
    n <= PART_WORDS
      ? [[0, n]]
      : [
          [0, breakAt(whole)],
          [breakAt(whole), n],
        ];
  return ranges.map(([from, to]) => {
    const lines = whole.lines
      .map((line) => line.filter((at) => at >= from && at < to))
      .filter((line) => line.length);
    const text = linesText(whole.tokens, lines);
    const own = layout(translator, text);
    return {
      text,
      input: numberedInput(
        own.lines.map((line) => line.map((at) => carried(own.tokens[at]))),
      ),
      words: own.tokens.length,
    };
  });
}
