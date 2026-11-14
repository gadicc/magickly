import { words } from "../dictionary/search.ts";

/**
 * The translator's tokenisers (plan 081): its English words and its
 * Enochian words, as the lookup reads them. A module of their own, small
 * and with no tables but Dee's spellings, so the dictionary can count a
 * query's words for its preview without loading the lookup.
 */

/** One English word of the input, as compared and as typed. */
export interface EnglishToken {
  /** Lower case, apostrophes gone, Dee's old spellings modernised. */
  word: string;
  /** As typed (for a contraction, its expanded word). */
  surface: string;
  /** Typed with a possessive "'s" or "s'" ("God's", "Gods'"). */
  possessive: boolean;
  /** Followed by `.`, `!`, `?`, `;` or `:`, which no phrase crosses. */
  endsClause: boolean;
  /** The contraction it was expanded from ("it's"), if any. */
  contraction?: string;
}

/**
 * Dee's and Casaubon's spellings, modernised on both sides, so a reader's
 * "shew" or "show" meets either.
 */
const ARCHAIC: Readonly<Record<string, string>> = {
  adde: "add",
  alwayes: "always",
  apparaild: "apparelled",
  ballance: "balance",
  bee: "be",
  binde: "bind",
  bloud: "blood",
  creatour: "creator",
  doth: "do",
  drinesse: "dryness",
  encrease: "increase",
  extream: "extreme",
  fiers: "fires",
  firmamets: "firmaments",
  flowres: "flowers",
  furie: "fury",
  glorie: "glory",
  governour: "governor",
  harboured: "harbored",
  hast: "have",
  hath: "have",
  hiacinct: "hyacinth",
  hiacynth: "hyacinth",
  honour: "honor",
  labour: "labor",
  loynes: "loins",
  mee: "me",
  milstones: "millstones",
  minde: "mind",
  mosse: "moss",
  neasts: "nests",
  noyses: "noises",
  numbred: "numbered",
  openest: "open",
  parte: "part",
  powring: "pouring",
  poyson: "poison",
  raign: "reign",
  raigne: "reign",
  range: "reign",
  rejoyceth: "rejoiceth",
  righteousnesse: "righteousness",
  runne: "run",
  saith: "say",
  sayth: "say",
  selves: "self",
  setled: "settled",
  shew: "show",
  skyrts: "skirts",
  sware: "swore",
  terrour: "terror",
  untill: "until",
  voyce: "voice",
  walkest: "walk",
  whome: "whom",
  windes: "winds",
  wo: "woe",
  yee: "ye",
};

/**
 * Contractions, expanded before `words()` would strip "'s" (decision 6):
 * in order, since "can't" must not become "ca not".
 */
const CONTRACTIONS: readonly [RegExp, string][] = [
  [/\bcan't\b/, "can not"],
  [/\bwon't\b/, "will not"],
  [/\bshan't\b/, "shall not"],
  [/\blet's\b/, "let us"],
  [/n't\b/, " not"],
  [/'m\b/, " am"],
  [/'re\b/, " are"],
  [/'ve\b/, " have"],
  [/'ll\b/, " will"],
  [/'d\b/, " would"],
  [/\b(it|that|he|she|what|there|here|who|where|how|this)'s\b/, "$1 is"],
];

/** Accents off ("naïve" is "naive"), as for Crowley's forms. */
export function deaccent(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Bracketed and parenthesised text is a note, not English to translate.
 * No bracket inside, so each match stops at the next opening one and the
 * scan stays linear.
 */
const NOTES = /\[[^[\]]*\]|\([^()]*\)/g;

/** Punctuation that ends a clause: no phrase is matched across it. */
const CLAUSE_END = /[.!?;:]/;

/**
 * The English words of a text, contractions expanded, each with how it
 * was typed. Shared with `words()` from `search.ts`, which takes off a
 * possessive "'s"; here that is kept as a flag, since G5 moves the word.
 */
export function englishTokens(text: string): EnglishToken[] {
  const out: EnglishToken[] = [];
  const cleaned = deaccent(text).replaceAll("’", "'").replace(NOTES, " ");
  const found = [...cleaned.matchAll(/[A-Za-z0-9']+/g)];
  found.forEach((match, at) => {
    const [typed] = match;
    const end = match.index + typed.length;
    const between = cleaned.slice(end, found[at + 1]?.index ?? cleaned.length);
    const endsClause = CLAUSE_END.test(between);
    let expanded = typed.toLowerCase();
    for (const [pattern, replacement] of CONTRACTIONS)
      expanded = expanded.replace(pattern, replacement);
    const pieces = expanded.split(" ").filter(Boolean);
    const contraction = pieces.length > 1 ? typed : undefined;
    pieces.forEach((piece, index) => {
      const [word] = words(piece);
      if (!word) return;
      out.push({
        word: ARCHAIC[word] ?? word,
        surface: contraction ? piece : typed,
        possessive: !contraction && /(?:'s|s')$/i.test(typed),
        endsClause: endsClause && index === pieces.length - 1,
        ...(contraction ? { contraction } : {}),
      });
    });
  });
  return out;
}

/** The compared words of a text (a gloss, say). */
export function englishWords(text: string): string[] {
  return englishTokens(text).map((one) => one.word);
}

/** An Enochian text's words, as typed, with Crowley's hyphens kept in. */
export function enochianWords(text: string): string[] {
  return deaccent(text).match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) ?? [];
}

/**
 * How many words a text has, as typed: its runs between spaces that hold
 * a letter, so "I'm fire" is two and "1 2 3" or "? ! ." none. The
 * direction guess reads one or two such words both ways (decision 4),
 * and the dictionary's preview shows from three (decision 3), so the two
 * always agree.
 */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((word) => /\p{L}/u.test(word)).length;
}
