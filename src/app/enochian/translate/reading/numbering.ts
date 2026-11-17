/**
 * How task 1's input numbers its words, apart from `prompt.ts` so the page
 * (which lays out parts with `readingParts` to price a retry) bundles no
 * prompt text.
 */

/**
 * Task 1's input: a sentence a line, its words numbered in square brackets
 * from 1, counting on through the passage (`[1] OL [2] SONF`).
 */
export function numberedInput(lines: readonly (readonly string[])[]): string {
  let n = 0;
  return lines
    .map((line) => line.map((word) => `[${++n}] ${word}`).join(" "))
    .join("\n");
}
