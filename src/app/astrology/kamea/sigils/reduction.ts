import { aiqBekar, letterValue } from "magick-data/astrology/aiqBekar";
import kameas, { type KameaPlanetId } from "magick-data/astrology/kameas";

/** One letter of a name traced on a kamea. */
export interface ReducedLetter {
  letter: string;
  /** Its value: א 1 to ת 400, a final at 500 to 900 with `finals`. */
  value: number;
  /** The number of the cell it falls on, the value reduced (`aiqBekar`). */
  cell: number;
}

/**
 * A text's letters reduced on `planet`'s square as the sigil traces them
 * (plan 093, decision 3; vol. 4, n73): each word's letters, each with its
 * value and the number of its cell. Anything that is not one of the 27
 * letters is left out, as the sigil leaves it out; an empty word too.
 */
export function reduceOnKamea(
  planet: KameaPlanetId,
  text: string,
  finals: boolean,
): ReducedLetter[][] {
  const cells = kameas[planet].length ** 2;
  return text
    .trim()
    .split(/\s+/)
    .map((word) =>
      [...word].flatMap((letter) => {
        try {
          const value = letterValue(letter, { finals });
          return [{ letter, value, cell: aiqBekar(value, cells) }];
        } catch {
          return [];
        }
      }),
    )
    .filter((word) => word.length > 0);
}
