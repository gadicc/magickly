import rows from "../dist/kabbalah/seventyTwoAngels.json";
import type { Links, Raw } from "../types";

/**
 * One of Lenain's seventy-two genii, as his entry gives it. Everything his
 * four tables make derivable — degrees, sign, dates, hour, decade, planet,
 * choir — is in seventyTwoAngelsDerived.ts instead, and the entry's prose is
 * in seventyTwoAngelsText, which loads only when a reader opens one.
 *
 * Several fields are empty where an entry simply does not say: not every one
 * names a nation, cites a psalm, or describes the character of a person born
 * under its genius. The twenty-second has no attribute at all, its heading
 * having vanished at a page break. `psalm.psalm` is `0` where the entry cites
 * something else, or nothing, and `godName` is that nation's name for God,
 * rather than a link to the god names of the Tree.
 *
 * Every genius has a Hebrew name, but they did not come the same way:
 * `heSource` says whether two readings of the scan agreed on it or a person
 * read it, and `hePointed` carries Lenain's marks where one did. He dots his
 * Hebrew above the letters, which is what defeated the machine — a reading
 * that took the dots for vowel points returned four letters where the page
 * prints five.
 */
type Angel = Raw<"seventyTwoAngel"> & Partial<Links<"*", "seventyTwoAngel">>;

/** The seventy-two in Lenain's order, so that the nth is at index n - 1. */
type Angels = Angel[];

export type { Angel, Angels };
export default rows;
