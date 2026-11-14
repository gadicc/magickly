import { englishTokens } from "./english.ts";
import type { EnochianToken, Translator } from "./lookup.ts";

/**
 * The translator's two figures (plan 081, decision 21), computed from the
 * shipped lookup code. `scripts/enochian-translator-figures.ts` writes
 * them, with the date it ran, to `figures.json` beside this file, which
 * the page reads; `figures.test.ts` checks that file against a fresh run.
 * Whole counts only: the page turns them into shares.
 *
 * - **Coverage** on plan 077's task 3, the 60 sentences in
 *   `scripts/enochian-translate-eval/data/task3-sentences.json`
 *   (`TASK3_SENTENCES`): what each English word was given.
 * - **Dee's English in, Dee's Enochian out**: a self-consistency check,
 *   since the tool looks in the Keys themselves.
 */

/** The numbers file the script writes, from the repository's root. */
export const FIGURES_FILE = "src/app/enochian/translate/figures.json";

/** Where the coverage figure's sentences live, from the repository's root. */
export const TASK3_SENTENCES =
  "scripts/enochian-translate-eval/data/task3-sentences.json";

/** The three kinds of task 3's sentences, 20 of each. */
export const SENTENCE_KINDS = ["practitioner", "everyday", "attested"] as const;

/** A kind of task 3's sentences. */
export type SentenceKind = (typeof SENTENCE_KINDS)[number];

/** One of task 3's sentences, as `TASK3_SENTENCES` has it. */
export interface Task3Sentence {
  id: string;
  kind: SentenceKind;
  english: string;
}

/** What a word was given: a form, a rule chip or a gap. */
export type WordClass = "form" | "chip" | "gap";

/** What a set of task 3's sentences gave: all of them, or one kind's. */
export interface Counts {
  sentences: number;
  /** Of `sentences`, those with no gap. */
  gapFree: number;
  /** English words, each counted once (see `givenWords`). */
  words: number;
  /** Words given a form by lookup: from the Keys or the dictionary. */
  forms: number;
  /**
   * Words given a rule chip: one a grammar note leaves out (an article,
   * "of", an auxiliary), or a form a rule gives (a form of "to be", a
   * negation, a pronoun), since each shows its chip.
   */
  chips: number;
  /** Of `chips`, the words a rule gave a form. */
  ruleForms: number;
  /** Words with no form. */
  gaps: number;
  /** Of `gaps`, those shown with at least one nearest form. */
  gapsWithNearest: number;
}

/** Coverage on task 3's sentences (decision 21's main figure). */
export interface Coverage extends Counts {
  /** The same counts for each kind of sentence. */
  byKind: Record<SentenceKind, Counts>;
}

/** Dee's English in, Dee's Enochian out (decision 21's second figure). */
export interface SelfCheck {
  /** Dee's content rows: a word in Casaubon's print and English to match. */
  rows: number;
  /** Of `rows`, those whose word comes back for the Key's English. */
  found: number;
}

/** Both figures, as `figures.json` has them less its date. */
export interface TranslatorFigures {
  coverage: Coverage;
  selfCheck: SelfCheck;
}

/** `figures.json` as the script writes it: the figures and their date. */
export interface FiguresFile extends TranslatorFigures {
  /**
   * The day the script ran (YYYY-MM-DD, its local calendar); a rerun that
   * changes no number still rewrites it.
   */
  date: string;
}

/** The class a token gives each word it covers (decision 21). */
function classOf(token: EnochianToken): WordClass {
  if (token.kind === "form") return token.rule ? "chip" : "form";
  return token.kind;
}

/** One English word of a sentence, and what it was given. */
export interface GivenWord {
  given: WordClass;
  /** A chip that a rule's form stands behind (ZIR for "am"). */
  ruleForm: boolean;
  /** A gap shown with at least one nearest form. */
  nearest: boolean;
}

/**
 * Each English word of `text` and what it was given, in the input's
 * order. A word is one of `englishTokens`: a contraction counts as the
 * words it expands to ("don't" is "do" and "not", each classed on its
 * own), and a possessive's "'s" is part of its word. A token covers its
 * `span` of those words, so a phrase counts once per word it takes, its
 * articles and "of" among them ("the house" is two words given SALMAN),
 * and is a form or a chip by its own `rule`: "I am" found as Dee's phrase
 * ZIR is two forms. Reordering moves tokens, not spans, so it changes
 * nothing here. Throws if any word is covered twice or not at all.
 */
export function givenWords(translator: Translator, text: string): GivenWord[] {
  const out: (GivenWord | undefined)[] = new Array(
    englishTokens(text).length,
  ).fill(undefined);
  for (const token of translator.toEnochian(text).tokens) {
    const [from, to] = token.span;
    for (let at = from; at < to; at++) {
      if (at >= out.length || out[at])
        throw new Error(`"${text}": word ${at} is covered twice or is extra`);
      out[at] = {
        given: classOf(token),
        ruleForm: token.kind === "form" && !!token.rule,
        nearest: token.kind === "gap" && token.nearest.length > 0,
      };
    }
  }
  const missing = out.indexOf(undefined);
  if (missing >= 0)
    throw new Error(`"${text}": word ${missing} is given nothing`);
  return out as GivenWord[];
}

/** Coverage on the sentences (see `givenWords` for how words count). */
export function coverage(
  translator: Translator,
  sentences: readonly Task3Sentence[],
): Coverage {
  const zero = (): Counts => ({
    sentences: 0,
    gapFree: 0,
    words: 0,
    forms: 0,
    chips: 0,
    ruleForms: 0,
    gaps: 0,
    gapsWithNearest: 0,
  });
  const out: Coverage = {
    ...zero(),
    byKind: {
      practitioner: zero(),
      everyday: zero(),
      attested: zero(),
    },
  };
  const plural = { form: "forms", chip: "chips", gap: "gaps" } as const;
  for (const { kind, english } of sentences) {
    if (!Object.hasOwn(out.byKind, kind))
      throw new Error(`"${english}": unknown kind ${kind}`);
    const words = givenWords(translator, english);
    for (const counts of [out, out.byKind[kind]]) {
      counts.sentences++;
      if (!words.some((word) => word.given === "gap")) counts.gapFree++;
      counts.words += words.length;
      for (const word of words) {
        counts[plural[word.given]]++;
        if (word.ruleForm) counts.ruleForms++;
        if (word.nearest) counts.gapsWithNearest++;
      }
    }
  }
  return out;
}

/**
 * Dee's English in, Dee's Enochian out: each Key's English as running
 * text, one input per Key, and the share of his content rows whose own
 * word comes back as a form whose span overlaps the row's English. A
 * phrase across rows that takes another word, or another form for the
 * same English, is a miss.
 */
export function selfCheck(translator: Translator): SelfCheck {
  const { lookup } = translator;
  let rows = 0;
  let found = 0;
  for (const [key, keyRows] of lookup.keyRows) {
    const text = keyRows.map((row) => row.english).join(" ");
    const { tokens } = translator.toEnochian(text);
    const rowWords: string[] = [];
    let at = 0;
    for (const row of keyRows) {
      const from = at;
      const words = englishTokens(row.english).map((one) => one.word);
      rowWords.push(...words);
      at += words.length;
      if (!row.word || !row.core.length) continue;
      rows++;
      if (
        tokens.some(
          (one) =>
            one.kind === "form" &&
            one.span[0] < at &&
            one.span[1] > from &&
            lookup.display.get(row.folded) === one.form,
        )
      )
        found++;
    }
    // The rows' words, taken apart, must be the running text's, or the
    // spans above point at the wrong row.
    const textWords = englishTokens(text).map((one) => one.word);
    if (rowWords.join(" ") !== textWords.join(" "))
      throw new Error(`Key ${key}: rows and text disagree`);
  }
  return { rows, found };
}

/** Both figures (see the module's comment). */
export function translatorFigures(
  translator: Translator,
  sentences: readonly Task3Sentence[],
): TranslatorFigures {
  return {
    coverage: coverage(translator, sentences),
    selfCheck: selfCheck(translator),
  };
}
