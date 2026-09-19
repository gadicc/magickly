import _angels from "./seventyTwoAngels.json5" with { type: "json" };

/**
 * One of Lenain's seventy-two genii, as his entry gives it. Everything his
 * four tables make derivable — degrees, sign, dates, hour, decade, planet,
 * choir — is in seventyTwoAngelsDerived.ts instead, and the entry's prose is
 * in seventyTwoAngelsText, which loads only when a reader opens one.
 *
 * Several fields are empty where an entry simply does not say: not every one
 * names a nation, cites a psalm, or describes the character of a person born
 * under its genius. The twenty-second has no attribute at all, its heading
 * having vanished at a page break.
 *
 * There is no Hebrew name. The scan cannot supply one; see plan 031.
 */
interface Angel {
  no: number;
  name: { en: string };
  attribute: { en: string; fr: string };
  /** The nation this genius rules. */
  people: { en: string; fr: string };
  /** That nation's name for God. */
  godName: string;
  /** `psalm` is 0 where the entry cites something else, or nothing. */
  psalm: { psalm: number; verse: number; la: string };
  invokedFor: { en: string };
  governs: { en: string };
  bornUnder: { en: string };
  /** What the contrary genius rules. */
  contrary: { en: string };
}

type Angels = Angel[];

const angels: Angels = _angels as Angels;

export type { Angel, Angels };
export default angels;
