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
 * having vanished at a page break. Twenty entries have no Hebrew name, so
 * `name.he` is `string | undefined`; `psalm.psalm` is `0` where the entry
 * cites something else, or nothing; and `godName` is that nation's name for
 * God, not a link to the god names of the Tree.
 */
type Angel = Raw<"seventyTwoAngel"> & Partial<Links<"*", "seventyTwoAngel">>;

/** The seventy-two in Lenain's order, so that the nth is at index n - 1. */
type Angels = Angel[];

export type { Angel, Angels };
export default rows;
