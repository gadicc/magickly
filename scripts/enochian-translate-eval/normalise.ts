import {
  foldSpelling,
  stem,
  words,
} from "../../src/app/enochian/dictionary/search.ts";

/**
 * Normalising both sides of the translator experiment (plan 077): Enochian
 * spellings, compared after folding case, U/V, I/J, hyphens and spaces; and
 * English, compared as content words after a light stemmer and folding
 * Dee's spelling ("Raign" → "reign").
 *
 * The English side reuses the dictionary search's `words` and `stem`
 * (plan 074, decision 5) so the experiment and the page agree on what a word
 * is.
 */

/**
 * An Enochian form as compared: capitals, letters only (Crowley's hyphens,
 * spaces, apostrophes and accents go), J as I and V as U. Only the folds the
 * plan names; C/K and Y/I stay distinct.
 */
export function normEnochian(form: string): string {
  return form
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .replaceAll("J", "I")
    .replaceAll("V", "U");
}

/**
 * A form folded wider than `normEnochian`, for the closed book only: the
 * letters Enochian writes as one (C/K, I/Y/J, U/V/W, per `letters.json5`)
 * taken as one, as the dictionary's search takes them. The dictionary has
 * twins this catches (BALYE and BALIE, YLS and ILS); scoring keeps the
 * plan's narrower fold.
 */
export function foldVariants(form: string): string {
  return foldSpelling(form.normalize("NFD"));
}

/** Levenshtein distance, for task 2's "near" (within two letters). */
export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = current;
  }
  return previous[b.length];
}

/**
 * Words that carry grammar rather than sense. A row of Dee's English made
 * only of these ("is", "as", "I") must be matched exactly. Negation and
 * directions ("not" aside) are kept short of this list on purpose: "up",
 * "down", "same" and "selves" are content.
 */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set(
  (
    "a an the and or nor but if of to in into unto on upon at by for from with " +
    "within as than then so o yea not no " +
    "is are am be was were been being art have has had hast do did shall " +
    "shalt will may can let " +
    "i me my mine thou thee thy thine ye you your he him his she her it its " +
    "we us our they them their this that these those which who whom whose what"
  ).split(" "),
);

/**
 * Dee's (Casaubon's) spellings and verb forms folded to modern ones. Small on
 * purpose: only the forms that occur in the Keys' English, so a meaning or an
 * answer in modern spelling meets them. Applied to both sides. "unto" and
 * "does" fold too, so rows of function words compare as Dee meant them.
 */
const ARCHAIC: Readonly<Record<string, string>> = {
  adde: "add",
  alwayes: "always",
  apparaild: "apparelled",
  ballance: "balance",
  binde: "bind",
  bloud: "blood",
  creatour: "creator",
  does: "do",
  doth: "do",
  drinesse: "dryness",
  encrease: "increase",
  extream: "extreme",
  fiers: "fierce",
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
  rejoyceth: "rejoiceth",
  runne: "run",
  saith: "say",
  sayth: "say",
  setled: "settled",
  sware: "swore",
  shew: "show",
  skyrts: "skirts",
  terrour: "terror",
  unto: "to",
  untill: "until",
  voyce: "voice",
  walkest: "walk",
  whome: "whom",
  windes: "winds",
  wo: "woe",
};

/** One English word folded to modern spelling. */
export function foldArchaic(word: string): string {
  const mapped = ARCHAIC[word];
  if (mapped) return mapped;
  return word.replace(/^raign/, "reign").replace(/nesse$/, "ness");
}

/** Lower-cased English words, archaic spellings folded. */
export function englishWords(text: string): string[] {
  return words(text).map(foldArchaic);
}

/**
 * Words whose final e, dropped, would leave another word: "fire" is not
 * "fir", nor "note" "not" (plan 074's guard). The first six are every case
 * in our meanings and the Keys' English; the rest are common ones a model
 * might answer.
 */
const KEEP_FINAL_E: ReadonlySet<string> = new Set(
  (
    "done fire here line none ride " +
    "bite cane care cure dine fate hate hope made mate note pine plane rate " +
    "shine tone wine"
  ).split(" "),
);

/**
 * The search's stem, then a final e dropped from what is left, so "live",
 * "liveth" and "living" meet; except where that would make another word
 * (`KEEP_FINAL_E`). Both sides go through it.
 */
export function stemEnglish(word: string): string {
  const out = stem(word);
  return out.length >= 4 && out.endsWith("e") && !KEEP_FINAL_E.has(out)
    ? out.slice(0, -1)
    : out;
}

/** The stems of an English text's content words. */
export function contentStems(text: string): string[] {
  return englishWords(text)
    .filter((one) => !FUNCTION_WORDS.has(one))
    .map(stemEnglish);
}

/** Whether a text has words and every one is a function word. */
export function isFunctionOnly(text: string): boolean {
  const all = englishWords(text);
  return all.length > 0 && all.every((one) => FUNCTION_WORDS.has(one));
}

/** Whether two English texts share a content word, after stemming. */
export function sharesContentWord(a: string, b: string): boolean {
  const left = new Set(contentStems(a));
  return contentStems(b).some((one) => left.has(one));
}

/**
 * Two English texts as the same set of words, after folding: order aside, so
 * the dictionary's inverted "HER, IN" is "in her".
 */
export function sameEnglish(a: string, b: string): boolean {
  const left = new Set(englishWords(a).map(stemEnglish));
  const right = new Set(englishWords(b).map(stemEnglish));
  return (
    left.size > 0 &&
    left.size === right.size &&
    [...left].every((one) => right.has(one))
  );
}

/**
 * Whether an answer's English agrees with Dee's: a shared content word, or,
 * where Dee's has only function words, the same set of words.
 */
export function englishAgrees(dee: string, answer: string): boolean {
  return isFunctionOnly(dee)
    ? sameEnglish(dee, answer)
    : sharesContentWord(dee, answer);
}

/**
 * Whether a meaning (a dictionary's, a Key row's or an answer's) agrees with
 * some English, either way round, as a whole or in any comma- or
 * semicolon-separated piece, with or without its brackets, so "I, my" and
 * "ARE, ART (to be)" agree with "I" and "art".
 */
export function meaningAgrees(english: string, meaning: string): boolean {
  const bare = meaning.replace(/\([^)]*\)|\[[^\]]*\]/g, " ");
  return [meaning, ...meaning.split(/[,;]/), ...bare.split(/[,;]/)].some(
    (piece) => englishAgrees(english, piece) || englishAgrees(piece, english),
  );
}
