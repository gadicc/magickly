import {
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
/**
 * A grammar word in a tail, pronouns included: WE's "servants, his"
 * inverts as "PEACE, IN" does, and is "his servants", never "his". At
 * the head a pronoun is the meaning: TILB "HER, OF" is "of her".
 */
const isTailWord = (word: string) => isFunction(word) || PRONOUNS.has(word);
const hasContent = (text: string) => !englishWords(text).every(isFunction);

/** Its pieces at commas, trimmed. */
const piecesOf = (text: string) =>
  text
    .split(",")
    .map((one) => one.trim())
    .filter(Boolean);

/** A meaning's glosses, in order (see the module's comment). */
export function dictionaryGlosses(meaning: string): string[] {
  const out: string[] = [];
  for (const raw of meaning.split(";")) {
    if (REFERENCE.test(raw)) continue;
    const sense = raw.replace(SEE, " ");
    const pieces = piecesOf(sense.replace(NOTES, " "));
    // An inversion is a meaning and then only grammar words: "PEACE, IN",
    // "govern, to", "harlot, (of an)". "in, with" and "flame, fire" are
    // two meanings, not one inverted.
    const whole = piecesOf(sense.replace(/[()[\]]/g, " "));
    const tail = whole.length === 2 ? englishWords(whole[1]) : [];
    const inverted =
      tail.length > 0 && hasContent(whole[0]) && tail.every(isTailWord);
    // Read only forwards when the tail is a real preposition alone
    // (decision 7): "PEACE, IN" is "in peace", never "peace". With a
    // pronoun ("BEAUTY, IN THEIR") the head stays a gloss too, as before.
    const onlyForwards =
      inverted &&
      !tail.some((one) => PRONOUNS.has(one)) &&
      tail.some((one) => PREPOSITIONS.has(one) && one !== "of" && one !== "to");
    const firstHasContent = pieces.length > 0 && hasContent(pieces[0]);
    pieces.forEach((piece, at) => {
      if (at === 0) {
        if (!onlyForwards) out.push(piece);
        return;
      }
      // A later piece of grammar words (an inverted tail, "his" or "of")
      // is no gloss of its own unless the first piece is grammar too.
      const words = englishWords(piece);
      if (!words.every(isTailWord) || !firstHasContent) out.push(piece);
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
