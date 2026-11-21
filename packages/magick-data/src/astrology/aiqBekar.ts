import kameas, { type KameaPlanetId } from "./kameas.ts";

/**
 * Aiq Bekar, the Qabalah of Nine Chambers, and the reduction the Golden
 * Dawn makes with it to trace a name on a planet's square (Regardie, *The
 * Golden Dawn*, vol. 4, 1940, pp. 78–80, archive.org
 * IsraelRegardie-TheGoldenDawn-Vol4-1940, n72–n74; plan 093, decision 3).
 *
 * The table puts the letters in nine chambers by the first digit of their
 * value: units, tens and hundreds, with the final forms as the hundreds
 * from 500 to 900. A letter's value is kept if the square has a cell of
 * that number, and otherwise divided by ten until it has: Zazel on
 * Saturn's square keeps 7, 1, 7 and takes Lamed's 30 as 3, and
 * Taphthartharath on Mercury's takes 400 as 40. The Golden Dawn's two
 * worked examples have no final letter, so a final counts at its ordinary
 * value unless `finals` asks for the table's.
 */

/** One chamber: its name, and its letters by rank, units first. */
export interface AiqBekarChamber {
  /** The chamber's name, its three letters: `איק`. */
  readonly name: string;
  /** Its letters, worth the chamber's number times 1, 10 and 100. */
  readonly letters: readonly [string, string, string];
}

const chamber = (name: string): AiqBekarChamber =>
  Object.freeze({
    name,
    letters: Object.freeze([...name] as [string, string, string]),
  });

/**
 * The nine chambers, from 1 (א 1, י 10, ק 100) to 9 (ט 9, צ 90, ץ 900). A
 * letter's value is its chamber's number times ten to the power of its rank.
 */
export const AIQ_BEKAR: readonly AiqBekarChamber[] = Object.freeze(
  ["איק", "בכר", "גלש", "דמת", "הנך", "וסם", "זען", "חפף", "טצץ"].map(chamber),
);

/** Each final form and the letter whose ordinary value it has. */
const FINALS: Readonly<Record<string, string>> = Object.freeze({
  ך: "כ",
  ם: "מ",
  ן: "נ",
  ף: "פ",
  ץ: "צ",
});

/** Every letter's value in the table, finals at 500 to 900. */
const TABLE_VALUES: ReadonlyMap<string, number> = new Map(
  AIQ_BEKAR.flatMap(({ letters }, index) =>
    letters.map((letter, rank) => [letter, (index + 1) * 10 ** rank] as const),
  ),
);

/** How a name's letters are counted. */
export interface HebrewValueOptions {
  /**
   * Count the final forms at the table's 500 to 900 (ך 500, ם 600, ן 700,
   * ף 800, ץ 900) rather than at the value of the ordinary letter.
   */
  finals?: boolean;
}

/**
 * A Hebrew letter's value: א 1 to ת 400, a final form at its ordinary
 * letter's unless `finals` is set. Anything that is not one of the 27
 * letters, a vowel point among them, is a RangeError.
 */
export function letterValue(
  letter: string,
  { finals = false }: HebrewValueOptions = {},
): number {
  const value = TABLE_VALUES.get(finals ? letter : (FINALS[letter] ?? letter));
  if (value === undefined)
    throw new RangeError(`Not a Hebrew letter: ${JSON.stringify(letter)}`);
  return value;
}

/** The sum of a name's letters, every word together; spaces are skipped. */
export function hebrewValue(
  hebrew: string,
  options: HebrewValueOptions = {},
): number {
  let sum = 0;
  for (const letter of hebrew.replace(/\s/g, ""))
    sum += letterValue(letter, options);
  return sum;
}

/**
 * Reduces a letter's value to a number the square has, by the Golden
 * Dawn's rule: kept if it is from 1 to `cells`, otherwise divided by ten
 * until it is. `value` is a letter's value, a digit from 1 to 9 times a
 * power of ten; `cells` is the square's count of cells, n². Anything else,
 * or a value that no division brings within the square, is a RangeError.
 */
export function aiqBekar(value: number, cells: number): number {
  if (!Number.isInteger(cells) || cells < 1)
    throw new RangeError(`Not a count of cells: ${cells}`);
  // One significant digit, so that each division by ten is exact.
  if (!Number.isInteger(value) || !/^[1-9]0*$/.test(String(value)))
    throw new RangeError(`Not a letter's value: ${value}`);
  let reduced = value;
  while (reduced > cells && reduced >= 10) reduced /= 10;
  if (reduced > cells)
    throw new RangeError(
      `${value} reduces to no cell of a ${cells}-cell square`,
    );
  return reduced;
}

/**
 * A name traced on a planet's square: for each word, separated by spaces,
 * the cells its letters fall on, each letter's value reduced by `aiqBekar`.
 * Finals count at their ordinary values unless `finals` is set. Which
 * spelling to trace is the caller's: `tracedSpelling` gives Agrippa's.
 */
export function traceHebrew(
  hebrew: string,
  planet: KameaPlanetId,
  options: HebrewValueOptions = {},
): number[][] {
  const square = kameas[planet];
  if (!square) throw new RangeError(`Not a planet with a kamea: ${planet}`);
  const cells = square.length ** 2;
  return hebrew
    .trim()
    .split(/\s+/)
    .map((word) =>
      [...word].map((letter) => aiqBekar(letterValue(letter, options), cells)),
    );
}
