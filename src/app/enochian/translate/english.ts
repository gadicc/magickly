export {
  deaccent,
  type EnglishToken,
  englishTokens,
  englishWords,
} from "./tokens.ts";

/**
 * English as the translator compares it (plan 081, decisions 6, 7 and 9):
 * the reader's text and every gloss go through the same tokens and keys,
 * so "came" meets Dee's "come" and "firmamets" meets "firmaments".
 * Each word has two keys, its bucket as written and `wordKey`, which also
 * reads an irregular verb as its plain form; a lookup tries the first
 * before the second, so "a rose" is not "rise". A key only finds
 * candidates: two words match when `sameWord` says they are one word or
 * regular inflections of one ("making", "make"), never merely alike once
 * a final e is gone ("stare", "star").
 */

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

/** -est words that are not superlatives or old second persons. */
const NOT_EST: ReadonlySet<string> = new Set([
  "forest",
  "highest",
  "honest",
  "interest",
]);

/**
 * Adjectives in "-ern" and the word each is of: a compass point's, read
 * as it ("eastern" as Dee's "East"), with a near-match chip as for a
 * superlative. Only these four: "-ern" is no ending of "stern", "modern"
 * or "govern".
 */
const ERN: Readonly<Record<string, string>> = {
  eastern: "east",
  northern: "north",
  southern: "south",
  western: "west",
};

/** An "-ern" adjective's compass point (`ERN`), or the word. */
const ofErn = (word: string) => (Object.hasOwn(ERN, word) ? ERN[word] : word);

/**
 * The regular endings `bases` takes off, longest first, with the shortest
 * word each applies to: as `search.ts`'s `stem`, so "sing" keeps its
 * "-ing" and "is" its "s", plus Dee's "-eth" and the superlative's "-est".
 */
function suffixOf(
  word: string,
): "ies" | "ied" | "eth" | "ing" | "est" | "ed" | "s" | undefined {
  if (word.length > 4 && /ie[sd]$/.test(word))
    return word.endsWith("s") ? "ies" : "ied";
  if (word.length > 5 && word.endsWith("eth")) return "eth";
  if (word.length > 5 && word.endsWith("ing")) return "ing";
  if (word.length > 6 && word.endsWith("est") && !NOT_EST.has(word))
    return "est";
  if (word.length > 4 && word.endsWith("ed")) return "ed";
  if (word.length >= 4 && /[^su]s$/.test(word)) return "s";
  return undefined;
}

/**
 * A one-syllable stem ending in a single vowel and consonant ("star",
 * "lov"), whose own inflections double the consonant ("starred"): so
 * "stared" and "loving" are not of "star" or "lov", but of "stare" and
 * "love".
 */
const SHORT_STEM = /^[^aeiouy]*[aeiou][^aeiouwxy]$/;

/**
 * Grammar words, which are never an inflection's base or its inflected
 * side: "hissing" is not of "his", "herring" not of "her", "butting" not
 * of "but", "untilled" not of "until", "canned" not of "can".
 */
const GRAMMAR: ReadonlySet<string> = new Set([
  ...ARTICLES,
  ...PREPOSITIONS,
  ...PRONOUNS,
  ...NEGATION,
  ...BE,
  "and",
  "but",
  "can",
  "could",
  "if",
  "may",
  "might",
  "must",
  "nor",
  "or",
  "shall",
  "shalt",
  "should",
  "than",
  "that",
  "these",
  "this",
  "those",
  "unless",
  "until",
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "would",
]);

/** Its vowel groups: "equal" has two, "call" one. */
const syllables = (word: string) => word.match(/[aeiouy]+/g)?.length ?? 0;

/**
 * The words a word may be a regular inflection of, and itself: "stars"
 * is "star", "loved" "love", "stopped" "stop", "glories" "glory", "walketh"
 * "walk", "greatest" "great". Only regular endings: an irregular verb's
 * other form ("does") is its own word here, read as its plain form only
 * by `wordKey`'s second try. "Stare" is no inflection of "star", nor
 * "mane" of "man", nor "doe" of "does", and no grammar word is either
 * side (`GRAMMAR`). `loose` leaves out a doubled consonant made single,
 * which two inflections may share only by chance ("marred" and "mars").
 */
function bases(word: string, loose = false): string[] {
  if (Object.hasOwn(ERN, word)) return [word, ERN[word]];
  const out = [word];
  const suffix = suffixOf(word);
  if (!suffix || Object.hasOwn(IRREGULAR, word) || GRAMMAR.has(word))
    return out;
  if (suffix === "ies" || suffix === "ied") out.push(`${word.slice(0, -3)}y`);
  else if (suffix === "s") {
    out.push(word.slice(0, -1));
    // "boxes", "churches", "echoes": "-es" after s, x, z, ch, sh or o.
    if (/(?:[sxzo]|[cs]h)es$/.test(word)) out.push(word.slice(0, -2));
  } else {
    // "-ed", "-ing", "-eth", "-est": the stem, the stem with its e back
    // ("loved", "making"), or with a doubled consonant single
    // ("stopped", "equalled"), as English doubles it: after one short
    // vowel ("stop", not "call"), or at the end of a longer word.
    const stem = word.slice(0, suffix === "ed" ? -2 : -3);
    if (!SHORT_STEM.test(stem)) out.push(stem);
    out.push(`${stem}e`);
    const single = stem.slice(0, -1);
    if (
      !loose &&
      /([^aeiou])\1$/.test(stem) &&
      (syllables(single) > 1 ||
        (SHORT_STEM.test(single) && !"lsfz".includes(stem.at(-1) as string)))
    )
      out.push(single);
  }
  return out.filter((one) => one === word || !GRAMMAR.has(one));
}

/**
 * A word's bucket: one ending off and every final e, a doubled final
 * consonant single, so that a word and each of its `bases` share one
 * ("loved", "love" and "lov" are all "lov"). Distinct words share
 * buckets too ("stare", "star"): a bucket finds candidates, and
 * `sameWord` decides.
 */
function bucket(word: string): string {
  if (Object.hasOwn(ERN, word)) return bucket(ERN[word]);
  const suffix = suffixOf(word);
  let out =
    suffix === "ies" || suffix === "ied"
      ? `${word.slice(0, -3)}y`
      : suffix === "s"
        ? word.slice(0, -1)
        : suffix
          ? word.slice(0, -suffix.length)
          : word;
  // Never under three letters, so "see" and "use" stay apart from "s"
  // and "us", as `stem` leaves short words alone.
  while (out.length > 3 && out.endsWith("e")) out = out.slice(0, -1);
  if (out.length > 3 && /([^aeiou])\1$/.test(out)) out = out.slice(0, -1);
  return out;
}

/** An irregular verb's plain form ("came" is "come"), or the word. */
const plainForm = (word: string) =>
  Object.hasOwn(IRREGULAR, word) ? IRREGULAR[word] : word;

/**
 * A word's key, as an index files it: its bucket (see `bucket`), after
 * reading an irregular verb as its plain form (G16). A lookup tries the
 * word as written (`coreKeys`' `literal`) before this, so "a rose" is not
 * "rise".
 */
export function wordKey(word: string): string {
  return bucket(plainForm(word));
}

/**
 * Whether a typed word and a gloss's word are the same word, or one a
 * regular inflection of the other, or both of one word: "making" and
 * "make", "stars" and "star", "loved" and "loving", but never "stare" and
 * "star", "hissing" and "his", or "marred" and "mars". `literal` compares them as written; otherwise irregular verbs
 * are read plain first ("came" is "come").
 */
export function sameWord(
  typed: string,
  gloss: string,
  literal = false,
): boolean {
  const [a, b] = literal
    ? [typed, gloss]
    : [plainForm(typed), plainForm(gloss)];
  if (a === b) return true;
  if (bucket(a) !== bucket(b)) return false;
  // One an inflection of the other, or both of one word.
  if (bases(a).includes(b) || bases(b).includes(a)) return true;
  const theirs = bases(b, true);
  return bases(a, true).some((one) => theirs.includes(one));
}

/** Irregular verbs' plain forms ("know", "speak"): verbs, surely. */
const PLAIN_VERBS: ReadonlySet<string> = new Set(Object.values(IRREGULAR));

/**
 * Whether a word is a verb by its own form: an irregular verb, either
 * form ("knew", "know"), or a word ending "-ed", "-eth" or "-ing".
 */
export function isVerbWord(word: string): boolean {
  if (Object.hasOwn(IRREGULAR, word) || PLAIN_VERBS.has(word)) return true;
  const suffix = suffixOf(word);
  return suffix === "ed" || suffix === "eth" || suffix === "ing";
}

/**
 * How a typed word met a different word of its gloss, for its chip: as a
 * verb in another tense or person (`tense`, G16's to show: "killed" for
 * "kill", "walketh", "came" for "come", "knowest" for "know"), as a
 * superlative or an "-ern" adjective read as its base or the other way
 * (`base`, a near match no rule explains: "greatest" for "great",
 * "eastern" for "east"), or neither (`undefined`: "stars" for "star").
 * An "-est" is a verb's second person where the gloss's word is a verb
 * (`glossIsVerb`: "know", "speaking", "reign"), and a superlative
 * otherwise ("great", "bright"), "thou" before it or not.
 */
export function readAs(
  typed: string,
  gloss: string,
  glossIsVerb: boolean,
): "tense" | "base" | undefined {
  if (typed === gloss) return undefined;
  if (ofErn(typed) !== typed || ofErn(gloss) !== gloss) return "base";
  if (Object.hasOwn(IRREGULAR, typed)) return "tense";
  const mine = suffixOf(typed);
  if (mine === "ed" || mine === "eth") return "tense";
  if (mine !== "est" && suffixOf(gloss) !== "est") return undefined;
  return glossIsVerb ? "tense" : "base";
}

/**
 * A run of words as matched: articles out, each word by its key, as
 * written (`literal`) or with irregular verbs read plain (the default).
 */
export function coreKeys(
  wordsOf: readonly string[],
  literal = false,
): string[] {
  return coreWords(wordsOf).map(literal ? bucket : wordKey);
}

/** A run of words with its articles out, as `coreKeys` keys them. */
export function coreWords(wordsOf: readonly string[]): string[] {
  return wordsOf.filter((one) => !ARTICLES.has(one));
}

/** Tier 2's form of a core: without a leading "of" or "to". */
export function withoutLeadingOfTo(core: readonly string[]): string[] {
  return core.length && OF_TO.has(core[0]) ? core.slice(1) : [...core];
}
