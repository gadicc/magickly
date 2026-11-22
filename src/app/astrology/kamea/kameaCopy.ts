import type { KameaPlanetId } from "./kameaPlanets";

/**
 * The kamea pages' copy that differs from square to square (plan 093,
 * K4), as Lingui messages, in a plain module so that the page and the
 * search catalogue's adapter read the same words: the catalogue builds
 * each square's search document from these, for its own planet only, as
 * the extraction of a page's literal JSX cannot (it would give every
 * square every branch).
 */

/**
 * Something a later printing of a square does otherwise than the square
 * the site draws, or a slip in Agrippa's own, as plan 093 records them
 * (Discrepancies 8 and 9, and magick-data's `kameas.ts`): read once, on
 * the leaf given. Facts only: Regardie's plates are in copyright where the
 * site is read (plan 091), so they are described, not shown.
 */
export interface SquareNote {
  witness: "agrippa1533" | "regardie1940";
  leaf: number;
  message: string;
}

export const SQUARE_NOTES: Record<KameaPlanetId, SquareNote[]> = {
  saturn: [],
  jupiter: [],
  mars: [
    {
      witness: "agrippa1533",
      leaf: 165,
      message:
        /*i18n*/ "In Agrippa's square the number in row 1, column 2 is damaged in the print; his Hebrew table beside it has 24, which the square needs.",
    },
  ],
  sol: [],
  venus: [
    {
      witness: "agrippa1533",
      leaf: 166,
      message:
        /*i18n*/ "Agrippa's square prints 45 in row 4, column 5, where his Hebrew table has 43, which the square needs; the square here has 43.",
    },
    {
      witness: "regardie1940",
      leaf: 78,
      message:
        /*i18n*/ "Regardie's volume 4 prints 43 in row 2, column 3, where Agrippa has 48, so that 43 stands in the square twice.",
    },
  ],
  mercury: [
    {
      witness: "agrippa1533",
      leaf: 167,
      message: /*i18n*/ "Agrippa's Hebrew table leaves the cell of 10 blank.",
    },
    {
      witness: "regardie1940",
      leaf: 79,
      message:
        /*i18n*/ "Regardie's volume 4 swaps three pairs of numbers: 45 and 48 in row 3, and 35 and 38, and 25 and 28, in row 4. Its rows still add up to 260; its columns do not. None of the swapped cells is one that Taphthartharath's sigil passes through.",
    },
  ],
  luna: [
    {
      witness: "agrippa1533",
      leaf: 168,
      message:
        /*i18n*/ "Agrippa prints 45 in row 1, column 8, in both his tables, where the square needs 54; the square here has 54.",
    },
    {
      witness: "regardie1940",
      leaf: 80,
      message:
        /*i18n*/ "Regardie's volume 4 prints 54 there, as the square needs.",
    },
  ],
};

/** The kamea page's opening sentence, with the square's four numbers. */
export const KAMEA_LEDE_MESSAGE =
  /*i18n*/ "A magic square of {order} by {order}: the numbers 1 to {cells}, set so that every row, every column and both diagonals add up to {line}, and all of them together to {total}.";

/** How each kind of square is made (`kameaConstruction`). */
export const CONSTRUCTION_MESSAGES = {
  odd: /*i18n*/ "Agrippa's square is the one this rule makes: 1 goes in the cell just below the centre, and each next number one cell down and one to the right, wrapping round at the edges, or two cells down where that cell is taken.",
  doublyEven:
    /*i18n*/ "Agrippa's square is the one this rule makes: write the numbers 1 to {cells} in order, row by row; exchange every number on a diagonal of each four-by-four block for {complement} less that number; then read the rows from the bottom up.",
  written:
    /*i18n*/ "No rule as simple as the odd squares' or those of four and eight makes a square of six, and the square here is Agrippa's as he prints it.",
} as const;

/**
 * Where Agrippa and Regardie print a square, and what Agrippa's leaf has
 * beside it: the seal and the characters of the names he gives the
 * planet, which for Venus include the Bne Seraphim and for the Moon are
 * its spirit, its spirit of spirits and its intelligence of intelligences
 * (n166, n168).
 */
export const IN_PRINT_MESSAGES: Record<KameaPlanetId, string> = {
  saturn:
    /*i18n*/ "Agrippa prints the square in <0>De occulta philosophia</0> (Cologne, 1533), book II, chapter 22, on <1>page {page}</1>, in numbers and again in Hebrew letters, with the planet's seal and the characters of its intelligence and its spirit. Regardie's plates in <2>The Golden Dawn</2>, volume 4 (1940), draw it again, on <3>page {regardiePage}</3>.",
  jupiter:
    /*i18n*/ "Agrippa prints the square in <0>De occulta philosophia</0> (Cologne, 1533), book II, chapter 22, on <1>page {page}</1>, in numbers and again in Hebrew letters, with the planet's seal and the characters of its intelligence and its spirit. Regardie's plates in <2>The Golden Dawn</2>, volume 4 (1940), draw it again, on <3>page {regardiePage}</3>.",
  mars: /*i18n*/ "Agrippa prints the square in <0>De occulta philosophia</0> (Cologne, 1533), book II, chapter 22, on <1>page {page}</1>, in numbers and again in Hebrew letters, with the planet's seal and the characters of its intelligence and its spirit. Regardie's plates in <2>The Golden Dawn</2>, volume 4 (1940), draw it again, on <3>page {regardiePage}</3>.",
  sol: /*i18n*/ "Agrippa prints the square in <0>De occulta philosophia</0> (Cologne, 1533), book II, chapter 22, on <1>page {page}</1>, in numbers and again in Hebrew letters, with the planet's seal and the characters of its intelligence and its spirit. Regardie's plates in <2>The Golden Dawn</2>, volume 4 (1940), draw it again, on <3>page {regardiePage}</3>.",
  venus:
    /*i18n*/ "Agrippa prints the square in <0>De occulta philosophia</0> (Cologne, 1533), book II, chapter 22, on <1>page {page}</1>, in numbers and again in Hebrew letters, with the planet's seal and the characters of its intelligence, its spirit and its intelligences, the Bne Seraphim. Regardie's plates in <2>The Golden Dawn</2>, volume 4 (1940), draw it again, on <3>page {regardiePage}</3>.",
  mercury:
    /*i18n*/ "Agrippa prints the square in <0>De occulta philosophia</0> (Cologne, 1533), book II, chapter 22, on <1>page {page}</1>, in numbers and again in Hebrew letters, with the planet's seal and the characters of its intelligence and its spirit. Regardie's plates in <2>The Golden Dawn</2>, volume 4 (1940), draw it again, on <3>page {regardiePage}</3>.",
  luna: /*i18n*/ "Agrippa prints the square in <0>De occulta philosophia</0> (Cologne, 1533), book II, chapter 22, on <1>page {page}</1>, in numbers and again in Hebrew letters, with the planet's seal and the characters of its spirit, its spirit of spirits and its intelligence of intelligences. Regardie's plates in <2>The Golden Dawn</2>, volume 4 (1940), draw it again, on <3>page {regardiePage}</3>.",
};

/**
 * Whether the square here is Agrippa's as printed, or corrected by a cell
 * (`CORRECTED_PLANETS`, Venus' and the Moon's, `SQUARE_NOTES`); whose the
 * slip is, the author's or the printer's, the evidence read does not
 * settle.
 */
export { CORRECTED_PLANETS } from "./kameaPlanets";

export const AS_PRINTED_MESSAGE =
  /*i18n*/ "The square here is Agrippa's as the 1533 printing gives it.";

export const CORRECTED_MESSAGE =
  /*i18n*/ "The square here is Agrippa's with the slip of the 1533 printing noted below corrected; whether it is the author's or the printer's, the evidence read does not settle.";

/** The Moon's names, which no other square has. */
export const MOON_NAMES_MESSAGE =
  /*i18n*/ "Agrippa gives the Moon no single intelligence. In its place he names an intelligence of intelligences, and beside its spirit a spirit of spirits, both numbered 3321, the sum of the square, which their letters reach only with the final letters counted at 500 to 900. Shelachel, the Moon's intelligence in present-day sources, comes last.";

/** The Moon's column, which only its page explains. */
export const MOON_COLUMN_MESSAGE =
  /*i18n*/ "On the Moon's square the tens from 10 to 80 stand in one column, the fourth, with 9 among them. The method Regardie sets out keeps a letter's number where the square has it and takes a larger one down to its tens or units, so every letter from Yod to Tav falls in that column: Yod to Peh keep their tens, Tzadi's 90 becomes 9, and Qof to Tav become 10 to 40. A long name's sigil on this square runs up and down that one column, and its marks are hard to set clear of each other, as the <0>generator</0> shows. This is the method's doing, not a fault of the square.";
