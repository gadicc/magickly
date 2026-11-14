import {
  AUXILIARIES,
  englishWords,
  FUNCTION_WORDS,
  PREPOSITIONS,
  PRONOUNS,
} from "./english.ts";

/**
 * The glosses a dictionary meaning offers for lookup (plan 081, decisions
 * 7 and 22). A meaning is free text from several hands (see `search.ts`):
 * cut at `;` into senses and at `,` into pieces, references and "meaning
 * unknown" dropped, and "(see …)" cross-references ignored, so CABA
 * "govern, to; (see 'cab')" is no match for "see".
 *
 * The Whole Enochian Dictionary inverts: "PEACE, IN" is "in peace", and is
 * read only forwards (decision 7), so ETHARZI is "peace" at tier 3, with
 * its "in" shown, and not at tier 1. A pronoun tail inverts too: CNOQOD
 * "servants, his" is "his servants" and "servants", not "his".
 */

/** A sense that is a pointer or an admission, not a meaning. */
const REFERENCE =
  /^\s*(?:part in|var of|variant of|name from|see)\b|meaning unknown|^\s*unknown\s*$/i;

/** "(see 'cab')": a cross-reference inside a sense (linear: no nesting). */
const SEE = /\(see [^()]*\)/gi;

/** Brackets and parentheses, contents and all (linear, as `english.ts`). */
const NOTES = /\([^()]*\)|\[[^[\]]*\]/g;

const isFunction = (word: string) => FUNCTION_WORDS.has(word);
/** Modals, which WE inverts like auxiliaries ("RISE, SHALL"). */
const MODALS: ReadonlySet<string> = new Set([
  "can",
  "could",
  "may",
  "might",
  "must",
  "should",
  "would",
]);

/**
 * A grammar word in a tail, pronouns and auxiliaries included: WE's
 * "servants, his" inverts as "PEACE, IN" does, and is "his servants",
 * never "his"; TORZUL's "RISE, SHALL" is "shall rise", never "shall". At
 * the head a pronoun is the meaning: TILB "HER, OF" is "of her".
 */
const isTailWord = (word: string) =>
  isFunction(word) || PRONOUNS.has(word) || isAuxiliary(word);

const isAuxiliary = (word: string) => AUXILIARIES.has(word) || MODALS.has(word);
const hasContent = (text: string) => !englishWords(text).every(isFunction);

/** Its pieces at commas, trimmed. */
const piecesOf = (text: string) =>
  text
    .split(",")
    .map((one) => one.trim())
    .filter(Boolean);

/**
 * A sense that only names an Enochian letter: WE's "Mals (P)" under P,
 * and the name before "GAL, ENOCHIAN LETTER D". A letter's name is not
 * its meaning, so "male" never finds P through "Mals".
 */
const LETTER_NAME = /^\s*[\p{L}-]+\s*\(\s*[A-Z](?:\s*,\s*[A-Z])*\s*\)\s*$/u;
const NAMES_A_LETTER = /\benochian letter\b/i;

/**
 * An object pronoun's possessive, for WE's "HIM, OF" (TOX), which is
 * "his": "of him" read forwards, never "him".
 */
const POSSESSIVE_OF: Readonly<Record<string, string>> = {
  her: "her",
  him: "his",
  it: "its",
  me: "my",
  them: "their",
  thee: "thy",
  us: "our",
  you: "your",
};

/** A meaning's glosses, in order (see the module's comment). */
export function dictionaryGlosses(meaning: string): string[] {
  return glossesOf(meaning, true);
}

/**
 * A meaning's glosses as English into Enochian looks them up: as
 * `dictionaryGlosses`, less a letter's name ("Mals" for P, "GAL" for
 * GAL), which reads as English but means nothing ("pale" is not "Pal").
 */
export function lookupGlosses(meaning: string): string[] {
  return glossesOf(meaning, false);
}

function glossesOf(meaning: string, keepLetterNames: boolean): string[] {
  const out: string[] = [];
  for (const raw of meaning.split(";")) {
    if (REFERENCE.test(raw)) continue;
    if (!keepLetterNames && LETTER_NAME.test(raw)) continue;
    const sense = raw.replace(SEE, " ");
    const letter = !keepLetterNames && NAMES_A_LETTER.test(sense);
    const pieces = piecesOf(sense.replace(NOTES, " ")).filter(
      (piece) => !letter || NAMES_A_LETTER.test(piece),
    );
    // An inversion is a meaning and then only grammar words: "PEACE, IN",
    // "govern, to", "harlot, (of an)". "in, with" and "flame, fire" are
    // two meanings, not one inverted.
    const whole = piecesOf(sense.replace(/[()[\]]/g, " "));
    const tail = whole.length === 2 ? englishWords(whole[1]) : [];
    // "DO, DOES" is two meanings, not "does do": an auxiliary tail
    // inverts only after a head that is no auxiliary itself.
    const inverted =
      tail.length > 0 &&
      hasContent(whole[0]) &&
      tail.every(isTailWord) &&
      !(tail.some(isAuxiliary) && englishWords(whole[0]).some(isAuxiliary));
    // Read only forwards when the tail is a real preposition alone
    // (decision 7): "PEACE, IN" is "in peace", never "peace". With a
    // pronoun ("BEAUTY, IN THEIR") the head stays a gloss too, as before.
    const onlyForwards =
      inverted &&
      !tail.some((one) => PRONOUNS.has(one)) &&
      tail.some((one) => PREPOSITIONS.has(one) && one !== "of" && one !== "to");
    // "HIM, OF" is "of him", so "his": a pronoun head read as its
    // possessive (TILB's "HER, OF" stays "her").
    const head = englishWords(whole[0] ?? "");
    const possessive =
      inverted &&
      tail.join(" ") === "of" &&
      head.length === 1 &&
      Object.hasOwn(POSSESSIVE_OF, head[0])
        ? POSSESSIVE_OF[head[0]]
        : undefined;
    const firstHasContent = pieces.length > 0 && hasContent(pieces[0]);
    pieces.forEach((piece, at) => {
      if (at === 0) {
        if (possessive)
          out.push(
            piece === piece.toUpperCase()
              ? possessive.toUpperCase()
              : possessive,
          );
        else if (!onlyForwards) out.push(piece);
        return;
      }
      // A later piece of grammar words (an inverted tail, "his" or "of")
      // is no gloss of its own unless the first piece is grammar too. An
      // auxiliary is one only as an inverted tail ("RISE, SHALL"), not as
      // a meaning of its own ("DO, DOES").
      const words = englishWords(piece);
      const grammar = words.every(
        (one) => isFunction(one) || PRONOUNS.has(one),
      );
      const tailOf = inverted && words.every(isTailWord);
      if (!(grammar || tailOf) || !firstHasContent) out.push(piece);
    });
    if (inverted) out.push(`${whole[1]} ${whole[0]}`);
  }
  return out.filter((one) => englishWords(one).length > 0);
}

/**
 * A gloss as the reading line shows it: notes and brackets out, Dee's
 * trailing punctuation stripped, spaces single (decision 14).
 */
export function cleanGloss(gloss: string): string {
  let out = gloss.replace(NOTES, " ").trim();
  // A loop, not /[;:,.?!]+$/, which backtracks on a run of punctuation.
  while (out && ";:,.?!".includes(out.at(-1) as string))
    out = out.slice(0, -1).trimEnd();
  return out.replace(/\s+/g, " ");
}
