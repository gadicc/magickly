import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import { normEnochian } from "./normalise.ts";

/**
 * Arm A2c's letter substitution (plan 077, "Arms"): one fixed permutation
 * applied to every Enochian form in the context and the test, so a model
 * cannot match them to the Keys it may remember.
 *
 * It works on the 24 letters left after normalising (J is I, V is U), so it
 * commutes with normalising: deciphering a ciphered form gives the form
 * normalised, which is all scoring compares. Case and anything that is not
 * a letter (hyphens, spaces, brackets) pass through.
 */

/** The letters the cipher permutes: A–Z without J and V. */
const ALPHABET = "ABCDEFGHIKLMNOPQRSTUWXYZ";

/** The experiment's one seed; changing it changes every A2c prompt. */
export const CIPHER_SEED = 77;

/** A small seeded generator (mulberry32), so the cipher is reproducible. */
function generator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Cipher {
  /** Letter to letter, upper case. */
  forward: Readonly<Record<string, string>>;
  encipher(form: string): string;
  /** The inverse; gives the form as `normEnochian` would, case aside. */
  decipher(form: string): string;
}

/**
 * A cipher from a seed: a Fisher–Yates shuffle, redrawn until no letter
 * maps to itself.
 */
export function makeCipher(seed = CIPHER_SEED): Cipher {
  const random = generator(seed);
  const letters = [...ALPHABET];
  let shuffled: string[];
  do {
    shuffled = [...letters];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  } while (shuffled.some((one, i) => one === letters[i]));
  const forward = Object.fromEntries(
    letters.map((one, i) => [one, shuffled[i]]),
  );
  const backward = Object.fromEntries(
    letters.map((one, i) => [shuffled[i], one]),
  );
  const apply = (map: Record<string, string>) => (form: string) =>
    [...form.normalize("NFD").replace(/[̀-ͯ]/g, "")]
      .map((char) => {
        const upper = char.toUpperCase();
        if (!/[A-Z]/.test(upper)) return char;
        const out = map[upper === "J" ? "I" : upper === "V" ? "U" : upper];
        return char === upper ? out : out.toLowerCase();
      })
      .join("");
  return { forward, encipher: apply(forward), decipher: apply(backward) };
}

/** The experiment's cipher. */
export const cipher: Cipher = makeCipher();

/**
 * English words that are also headwords, which a meaning uses as English
 * ("Senior MARS of FIRE", "not the Son of Light", "to rest"). Found by
 * listing every meaning's words that match a headword; the rest of that
 * list (BRORGES, caosg, HAGONEL, …) is Enochian.
 */
export const ENGLISH_HOMOGRAPHS: ReadonlySet<string> = new Set(
  "ages an as do fire man mars me no nor not oh on or part pl rest servient var".split(
    " ",
  ),
);

/** Phrases after which the next word names an Enochian form. */
const MARKER =
  /\b(?:part in|var\.? (?:of|on)|variant of|see|cf\.?|vocative case of)\s*['"‘’“]?$/i;

/**
 * The names of the Enochian letters, as the dictionary gives them: the
 * headwords glossed "ENOCHIAN LETTER …" (GAL, DRUX, VAU, …), and the name
 * before a letter in brackets in the single-letter entries ("Pa (B)",
 * "Val (U, V, W)"). Upper case. English look-alikes ("OR") are left out,
 * and so is "hath" from "Na-hath", which `encipherMeaning` takes only
 * beside "Na-" or "ENOCHIAN LETTER".
 */
export function letterNames(dictionary: EnochianDictionary): Set<string> {
  const out = new Set<string>();
  const add = (name: string) => {
    for (const part of name.split("-")) {
      const upper = normEnochian(part);
      if (
        upper &&
        upper !== "HATH" &&
        !ENGLISH_HOMOGRAPHS.has(part.toLowerCase())
      )
        out.add(upper);
    }
  };
  for (const [headword, entry] of Object.entries(dictionary))
    for (const { meaning } of entry.meanings) {
      if (/\benochian letter\b/i.test(meaning)) add(headword);
      if (normEnochian(headword).length !== 1) continue;
      const named = meaning.match(
        /([A-Za-z][A-Za-z-]*)\s*\(\s*[A-Za-z](?:\s*,\s*[A-Za-z])*\s*\)/,
      );
      if (named) add(named[1]);
    }
  return out;
}

/** One letter, or a list of them ("I,Y", "C OR K", "'B'"), as a meaning names it. */
const LETTERS = String.raw`['"‘’]?[A-Za-z]['"‘’]?(?:\s*(?:,|\bor\b)\s*['"‘’]?[A-Za-z]['"‘’]?)*`;
/** "ENOCHIAN LETTER Z", "the English letter Z". */
const AFTER_LETTER = new RegExp(
  String.raw`(\bletters?\s+)(${LETTERS})(?![A-Za-z0-9])`,
  "gi",
);
/** "Un (A)", "Veh (C or K)", "U Val (U, V, W)". */
const IN_BRACKETS = new RegExp(String.raw`\((\s*${LETTERS}\s*)\)`, "g");

/**
 * Enciphers the Enochian quoted inside a meaning.
 *
 * - A word of two letters or more counts as Enochian when it is a headword
 *   and not one of the English homographs, or when it follows a marker such
 *   as "var of", "part in" or "see".
 * - A letter's name (`letterNames`: Un, Pa, Val, Drux, …) is enciphered
 *   wherever it stands; plain, "A Val" would show which letter Val is.
 * - A single letter is a letter of the alphabet, and is enciphered, where a
 *   meaning names one: in brackets ("Gal (D)"), after "letter" ("ENOCHIAN
 *   LETTER Z"), or as the entry's own headword ("U Val"). Left plain, these
 *   would print a letter beside its cipher. Other single letters are English
 *   ("I", "a") and stay.
 *
 * What this misses, an Enochian name that is not a headword, stays visible;
 * it is rare.
 */
export function encipherMeaning(
  meaning: string,
  headwords: ReadonlySet<string>,
  using: Cipher = cipher,
  headword?: string,
  names: ReadonlySet<string> = new Set(),
): string {
  const own = headword ? normEnochian(headword) : "";
  const named = namedLetters(meaning);
  return meaning.replace(/[A-Za-z]+/g, (token, at: number) => {
    if (token.length < 2)
      return named.has(at) || (own.length === 1 && token === own)
        ? using.encipher(token)
        : token;
    const known =
      headwords.has(normEnochian(token)) &&
      !ENGLISH_HOMOGRAPHS.has(token.toLowerCase());
    const name =
      names.has(normEnochian(token)) ||
      (/^hath$/i.test(token) &&
        (/na-$/i.test(meaning.slice(0, at)) ||
          /^\s+enochian letter\b/i.test(meaning.slice(at + token.length))));
    if (known || name || MARKER.test(meaning.slice(0, at)))
      return using.encipher(token);
    return token;
  });
}

/** Where a meaning names single letters: in brackets or after "letter". */
function namedLetters(meaning: string): Set<number> {
  const out = new Set<number>();
  const mark = (list: string, from: number) => {
    for (const one of list.matchAll(/(?<![A-Za-z])[A-Za-z](?![A-Za-z])/g))
      out.add(from + one.index);
  };
  for (const one of meaning.matchAll(AFTER_LETTER))
    mark(one[2], one.index + one[1].length);
  for (const one of meaning.matchAll(IN_BRACKETS)) mark(one[1], one.index + 1);
  return out;
}
