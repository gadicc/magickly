import type { ReactNode } from "react";

const HEBREW = /[\u0590-\u05FF\uFB1D-\uFB4F]+/;

/**
 * A text cut at its runs of Hebrew, each run handed to `mark` to be set in
 * its own language and direction, the rest left as it is. Shared by the
 * reading edition and the angels' pages, so that Hebrew inside an editorial
 * note is marked the same way wherever the note is shown.
 */
export function hebrewRuns(
  text: string,
  keyPrefix: string,
  mark: (run: string, key: string) => ReactNode,
): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let index = 0;
  while (rest) {
    const found = rest.match(HEBREW);
    if (!found || found.index === undefined) {
      out.push(rest);
      break;
    }
    if (found.index > 0) out.push(rest.slice(0, found.index));
    out.push(mark(found[0], `${keyPrefix}-he-${index}`));
    rest = rest.slice(found.index + found[0].length);
    index++;
  }
  return out;
}
