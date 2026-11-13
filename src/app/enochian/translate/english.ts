import { stem, words } from "../dictionary/search.ts";

/**
 * English as the translator compares it (plan 081, decisions 6, 7 and 9):
 * the reader's text and every gloss go through the same tokens and keys,
 * so "came" meets Dee's "come" and "firmamets" meets "firmaments".
 * Each word has two keys: `literalKey`, the word as written, stemmed,
 * and `wordKey`, which also reads an irregular verb as its plain form.
 * A lookup tries the first before the second, so "a rose" is not "rise".
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
 * Irregular verbs to their plain form (G16: a verb has one form, so tense
 * and person come from the English). Applied to both sides.
 */
export const IRREGULAR: Readonly<Record<string, string>> = {
  ate: "eat",
  began: "begin",
  begun: "begin",
  bore: "bear",
  born: "bear",
  borne: "bear",
  bought: "buy",
  bound: "bind",
  brake: "break",
  broke: "break",
  broken: "break",
  brought: "bring",
  built: "build",
  came: "come",
  caught: "catch",
  chose: "choose",
  chosen: "choose",
  did: "do",
  does: "do",
  done: "do",
  drank: "drink",
  drawn: "draw",
  drew: "draw",
  drunk: "drink",
  dwelt: "dwell",
  eaten: "eat",
  fallen: "fall",
  fed: "feed",
  fell: "fall",
  felt: "feel",
  fled: "flee",
  flew: "fly",
  flown: "fly",
  forgot: "forget",
  forgotten: "forget",
  fought: "fight",
  found: "find",
  gat: "get",
  gave: "give",
  given: "give",
  gone: "go",
  got: "get",
  gotten: "get",
  grew: "grow",
  ground: "grind",
  grown: "grow",
  had: "have",
  has: "have",
  heard: "hear",
  held: "hold",
  hid: "hide",
  hidden: "hide",
  kept: "keep",
  knew: "know",
  known: "know",
  laid: "lay",
  lay: "lie",
  led: "lead",
  left: "leave",
  lost: "lose",
  made: "make",
  meant: "mean",
  met: "meet",
  paid: "pay",
  ran: "run",
  risen: "rise",
  rose: "rise",
  said: "say",
  sang: "sing",
  sat: "sit",
  saw: "see",
  seen: "see",
  sent: "send",
  setteth: "set",
  shone: "shine",
  showed: "show",
  shown: "show",
  slain: "slay",
  slept: "sleep",
  slew: "slay",
  sold: "sell",
  sought: "seek",
  spake: "speak",
  spent: "spend",
  spoke: "speak",
  spoken: "speak",
  spread: "spread",
  stole: "steal",
  stood: "stand",
  struck: "strike",
  sung: "sing",
  swore: "swear",
  sworn: "swear",
  taken: "take",
  taught: "teach",
  thought: "think",
  threw: "throw",
  thrown: "throw",
  told: "tell",
  took: "take",
  understood: "understand",
  went: "go",
  woke: "wake",
  won: "win",
  wore: "wear",
  wound: "wind",
  wrote: "write",
  written: "write",
  wrought: "work",
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

/** G4 (and the vocative "O", G39): never written. */
export const ARTICLES: ReadonlySet<string> = new Set(["a", "an", "the", "o"]);

/** Tier 2: a leading one of these may differ (decision 7). */
const OF_TO: ReadonlySet<string> = new Set(["of", "to"]);

/** Tier 3: a gloss may carry one of these more than the English. */
export const PREPOSITIONS: ReadonlySet<string> = new Set([
  "about",
  "above",
  "after",
  "against",
  "among",
  "amongst",
  "at",
  "before",
  "below",
  "beneath",
  "between",
  "by",
  "down",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "out",
  "over",
  "than",
  "through",
  "to",
  "toward",
  "towards",
  "under",
  "underneath",
  "unto",
  "up",
  "upon",
  "with",
  "within",
  "without",
]);

/** Forms of "be": never ignored in a match, so ZIRDO "I am" is not "I". */
export const BE: ReadonlySet<string> = new Set([
  "am",
  "are",
  "art",
  "be",
  "been",
  "being",
  "is",
  "was",
  "wast",
  "were",
  "wert",
]);

/** Negation, never ignored either. */
export const NEGATION: ReadonlySet<string> = new Set([
  "never",
  "no",
  "none",
  "nor",
  "not",
  "nothing",
]);

/** Pronouns, never ignored: "he killed her" is not "she killed him". */
export const PRONOUNS: ReadonlySet<string> = new Set([
  "he",
  "her",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "i",
  "it",
  "its",
  "itself",
  "me",
  "mine",
  "my",
  "myself",
  "our",
  "ours",
  "ourselves",
  "she",
  "thee",
  "their",
  "theirs",
  "them",
  "themselves",
  "they",
  "thine",
  "thou",
  "thy",
  "thyself",
  "us",
  "we",
  "ye",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
]);

/** Auxiliaries G16 leaves out before a verb. */
export const AUXILIARIES: ReadonlySet<string> = new Set([
  "did",
  "do",
  "does",
  "doth",
  "had",
  "has",
  "hast",
  "hath",
  "have",
  "shall",
  "shalt",
  "will",
  "wilt",
]);

/** Words that are only grammar: a gloss of nothing else is no meaning. */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  ...ARTICLES,
  ...PREPOSITIONS,
  "and",
  "have",
  "i",
  "or",
]);

/** Final-e words whose e stays, so "come" is not "com". */
const KEEP_E: ReadonlySet<string> = new Set(
  "bite came cane care come cure dine done fate fire gone hate here home hope line made mate name none note pine plane rate ride same shine some time tone wine".split(
    " ",
  ),
);

/** -est words that are not superlatives or old second persons. */
const NOT_EST: ReadonlySet<string> = new Set([
  "forest",
  "highest",
  "honest",
  "interest",
]);

/**
 * A word's key as written: `search.ts`'s stem, with two more steps the
 * Keys need: Dee's "-est" ("walkest") and a final e ("spirite", "shine"
 * kept by `KEEP_E`).
 */
function literalKey(plain: string): string {
  if (plain.length < 4) return plain;
  let out: string;
  if (plain.endsWith("est") && plain.length > 6 && !NOT_EST.has(plain)) {
    out = plain.slice(0, -3);
    if (out.length > 4 && out.endsWith("e")) out = out.slice(0, -1);
  } else out = stem(plain);
  if (out.length >= 4 && out.endsWith("e") && !KEEP_E.has(out))
    out = out.slice(0, -1);
  return out;
}

/** A word's key with an irregular verb read as its plain form (G16). */
export function wordKey(word: string): string {
  return literalKey(IRREGULAR[word] ?? word);
}

/**
 * Whether a word came to its key by losing a verb ending ("killed",
 * "walketh"), or is an irregular verb's other form ("came"): its tense or
 * person is then G16's to show.
 */
export function isVerbForm(word: string): boolean {
  if (IRREGULAR[word]) return true;
  return /(?:ed|eth|est)$/.test(word) && literalKey(word) !== word;
}

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

/**
 * A run of words as matched: articles out, each word by its key, as
 * written (`literal`) or with irregular verbs read plain (the default).
 */
export function coreKeys(
  wordsOf: readonly string[],
  literal = false,
): string[] {
  return wordsOf
    .filter((one) => !ARTICLES.has(one))
    .map(literal ? literalKey : wordKey);
}

/** Tier 2's form of a core: without a leading "of" or "to". */
export function withoutLeadingOfTo(core: readonly string[]): string[] {
  return core.length && OF_TO.has(core[0]) ? core.slice(1) : [...core];
}
