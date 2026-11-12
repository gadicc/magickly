/**
 * Whose the dictionary's gematria is, for the dictionary's entries and the
 * Keys' word panel. Every value in `dictionary.json5` comes from Gerald
 * Schueler's *Enochian Magic: A Practical Manual* (1985), cited as EMPM, and
 * the numbers are his own derivation. Neither Dee's angels nor the Golden Dawn
 * assigned the Enochian letters number values, as Aaron Leitch, *The
 * Angelical Language* vol. I ch. 5, and Donald Laycock, *The Complete
 * Enochian Dictionary* pp. 43–44, both note. The Keys' number-words, such
 * as `OL`, "24", are words, not letter values.
 *
 * Kept out of JSX text, like the dictionary's `LABELS`: site search indexes
 * a page's literal JSX text (plan 070), and this note belongs to the entry
 * and the panel, not to the page. The pages' own prose (`DictionaryText.tsx`, `KeysText.tsx`) says the
 * same for search.
 */

/** The gematria's source, named as the entries name a meaning's. */
export const GEMATRIA_SOURCE = "EMPM";

/** A short note under a word's gematria: what it is, and that it is modern. */
export const GEMATRIA_NOTE =
  "Gerald Schueler's modern system (1985): he numbers the letters from " +
  "Hebrew letter values through the Golden Dawn's attributions, some " +
  "letters two ways, so some words have two values. Neither Dee's angels " +
  "nor the Golden Dawn assigned the Enochian letters number values " +
  "(Leitch, vol. I, ch. 5; Laycock, pp. 43–44).";
