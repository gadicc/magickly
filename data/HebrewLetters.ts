import rows from "./dist/hebrewLetters.json";
import type { Links, Raw } from "./types";

/** A letter's key, derived from the JSON: the twenty-two, and the five final forms. */
type HebrewLetterId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type HebrewLetter = Raw<"hebrewLetter"> & Partial<Links<"*", "hebrewLetter">>;

/** Every letter, by key. */
type HebrewLetters = Record<HebrewLetterId, HebrewLetter>;

export type { HebrewLetter, HebrewLetterId, HebrewLetters };
export default rows;
