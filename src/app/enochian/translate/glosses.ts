import {
  AUXILIARIES,
  englishWords,
  FUNCTION_WORDS,
  PREPOSITIONS,
  PRONOUNS,
  wordKey,
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
 *
 * WE's editorial notes are no glosses either: a variant ("VAR. 4", "VAR ON
 * 'SOBA'"), a pointer ("ALT. PART IN LIN", "Name from T12Sqr"), a part of
 * speech ("n.Initiate", "v.") or a label ("phrase: ‘…’"). Its own
 * abbreviation of a sense's first word is read whole: IADNAMAD's
 * "KNOWLEDGE, UNDEFILED K." is "undefiled knowledge", MIAM's "long cont."
 * "long continuance".
 */

/** A sense that is a pointer or an admission, not a meaning. */
const REFERENCE =
  /^\s*\??\s*(?:(?:abbreviation for\s+)?(?:alt\.?\s+)?part in|var\b|variant of|name from|see)\b|meaning unknown|^\s*unknown\s*$/i;

/**
 * A piece that is an editorial note: a pointer, a variant's number, a
 * past tense explained ("p.t. 'to give'"), or a description of where a
 * name is from ("LETTERS OF T12SQR").
 */
const EDITORIAL =
  /^\s*\??\s*(?:var\b|variant\b|alt\.|abbreviation\b|name from\b|part in\b|p\.\s*t\.)|\bt12sqr\b/i;

/** A variant note ending a piece: "FIRST - VAR ON 'ILI'", "wrath. var on …". */
const VARIANT_TAIL = /\s*(?:[-–—.]\s*)?\??\s*(?<![([])\bvar\b.*$/i;

/** A part of speech at a piece's start or end: "n.Initiate", "visit; v.". */
const PART_OF_SPEECH = /^\s*(?:n|v|adj|adv)\.\s*|\s*\b(?:n|v|adj|adv)\.\s*$/gi;

/** A label before a quoted meaning: "phrase: ‘first,the …’", "meaning ‘…’". */
const LABEL = /^\s*(?:phrase|meaning)\s*:?\s*(?=[‘'"“])/i;

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
 * "Veh (C or K)" under C, "U Val (U, V, W)" under U, and the name before
 * "GAL, ENOCHIAN LETTER D". A letter's name is not its meaning, so "male"
 * never finds P through "Mals".
 */
const LETTER_NAME =
  /^\s*(?:[A-Z]\s+)?[\p{L}-]+\s*\(\s*[A-Z](?:\s*(?:,|or)\s*[A-Z])*\s*\)\s*$/u;
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

/** A straight quote that is no apostrophe ("'is moving", "yourself'"). */
const QUOTE = /(?<!\p{L})'|'(?!\p{L})|"/gu;

/**
 * A piece without its quotes when they don't pair: the curly half of a
 * mixed pair is gone ("'It ends with El’"), or the pair spans a comma
 * ("‘interiority: within, inside, self-hood'"). A pair stays.
 */
function withoutStrayQuotes(piece: string): string {
  return (piece.match(QUOTE)?.length ?? 0) % 2
    ? piece.replace(QUOTE, " ")
    : piece;
}

/**
 * A sense with WE's notes out (see the module's comment): its label, its
 * editorial pieces and variant tails, its parts of speech, and each
 * abbreviation of a word of its first piece ("K." for "KNOWLEDGE") read
 * whole. An abbreviation that is no such word is left as it is.
 */
function withoutEditing(sense: string): string {
  const pieces = sense
    .replace(LABEL, "")
    // Curly quotes are marks, not words; "God’s" keeps its apostrophe.
    .replace(/[‘“”]|’(?!\p{L})|(?<!\p{L})’/gu, " ")
    .split(",")
    .map((piece) =>
      EDITORIAL.test(piece)
        ? ""
        : withoutStrayQuotes(
            piece.replace(VARIANT_TAIL, "").replace(PART_OF_SPEECH, " "),
          ),
    );
  const first = englishWords(pieces[0] ?? "").length
    ? (pieces[0].match(/\p{L}+/gu) ?? [])
    : [];
  return pieces
    .map((piece, at) =>
      at === 0
        ? piece
        : piece.replace(
            /\b(\p{L}{1,4})\.(?=\s|$)/gu,
            (whole, short: string) => {
              const lower = short.toLowerCase();
              const word = first.find(
                (one) =>
                  one.length > short.length &&
                  one.toLowerCase().startsWith(lower),
              );
              return word ?? whole;
            },
          ),
    )
    .join(",");
}

/**
 * Whether a meaning only names an Enochian letter (`LETTER_NAME`: C's
 * "Veh (C or K)"), which is no reading of the word when it has another.
 */
export function namesALetter(meaning: string): boolean {
  return meaning.split(";").every((sense) => LETTER_NAME.test(sense));
}

/**
 * Two words Dee writes in this order, by their keys (`wordKey`), "tail
 * head": WE's "SICKLES, SHARP" is one meaning inverted, "sharp sickles",
 * where he writes "sharp sickles" (TAPVIN), not two.
 */
export type DeePairs = ReadonlySet<string>;

/** Dee's pairs in `words`, for `DeePairs`. */
export function pairsOf(words: readonly string[]): string[] {
  return words
    .slice(1)
    .map((one, at) => `${wordKey(words[at])} ${wordKey(one)}`);
}

/**
 * A meaning's glosses, in order (see the module's comment). `pairs`
 * reads an inverted adjective or verb as WE writes it (`DeePairs`).
 */
export function dictionaryGlosses(meaning: string, pairs?: DeePairs): string[] {
  return glossesOf(meaning, true, pairs);
}

/**
 * A meaning's glosses as English into Enochian looks them up: as
 * `dictionaryGlosses`, less a letter's name ("Mals" for P, "GAL" for
 * GAL), which reads as English but means nothing ("pale" is not "Pal").
 */
export function lookupGlosses(meaning: string, pairs?: DeePairs): string[] {
  return glossesOf(meaning, false, pairs);
}

function glossesOf(
  meaning: string,
  keepLetterNames: boolean,
  pairs?: DeePairs,
): string[] {
  const out: string[] = [];
  for (const raw of meaning.split(";")) {
    if (REFERENCE.test(raw)) continue;
    if (!keepLetterNames && LETTER_NAME.test(raw)) continue;
    const sense = withoutEditing(raw.replace(SEE, " "));
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
    // "SICKLES, SHARP" is "sharp sickles" where Dee writes that: one word
    // each side, the tail a word of content, in his order (`DeePairs`).
    const head = englishWords(whole[0] ?? "");
    const attested =
      !!pairs &&
      head.length === 1 &&
      tail.length === 1 &&
      hasContent(whole[0]) &&
      !isTailWord(tail[0]) &&
      pairs.has(`${wordKey(tail[0])} ${wordKey(head[0])}`);
    const inverted =
      attested ||
      (tail.length > 0 &&
        hasContent(whole[0]) &&
        tail.every(isTailWord) &&
        !(tail.some(isAuxiliary) && head.some(isAuxiliary)));
    // Read only forwards when the tail is a real preposition alone
    // (decision 7): "PEACE, IN" is "in peace", never "peace". With a
    // pronoun ("BEAUTY, IN THEIR") the head stays a gloss too, as before.
    const onlyForwards =
      inverted &&
      !tail.some((one) => PRONOUNS.has(one)) &&
      tail.some((one) => PREPOSITIONS.has(one) && one !== "of" && one !== "to");
    // "HIM, OF" is "of him", so "his": a pronoun head read as its
    // possessive (TILB's "HER, OF" stays "her").
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
      const tailOf = attested || (inverted && words.every(isTailWord));
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
