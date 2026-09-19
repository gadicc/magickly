import rows from "../dist/enochian/letters.json";
import type { Links, Raw } from "../types";

/** A letter's key, which is its Latin transliteration. */
type LetterId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type EnochianLetter = Raw<"enochianLetter"> &
  Partial<Links<"*", "enochianLetter">>;

/** Every Enochian letter, by key. */
type EnochianLetters = Record<LetterId, EnochianLetter>;

export type { EnochianLetter, EnochianLetters, LetterId };
export default rows;
