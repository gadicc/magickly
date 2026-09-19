import { readFileSync } from "node:fs";
import { ANGEL_COUNT } from "../../data/kabbalah/seventyTwoAngelsDerived";

/**
 * Cuts the OCR of Lenain's 1823 scan into one French region per genius.
 *
 * The scan is public domain — Lenain died in 1832 — but it is damaged, so this
 * is deliberately conservative: it finds the headings it can read, refuses to
 * guess at the ones it cannot, and hands the extraction a widened window there
 * instead. Nothing here repairs text; that is the model's job, and everything
 * derivable is checked against the arithmetic afterwards. See plan 031.
 */

export const SOURCE_PATH =
  "public/docs/Lenain - La Science Cabalistique (1823) - Google.txt";

/**
 * The sidecar holds the book twice, byte for byte: lines 164-6503 and
 * 6504-12843. Only the header and the OCR log above them are unique.
 */
const FIRST_COPY_LINES = 6503;

/**
 * A heading is an exact boundary, so a region that has one starts on it and
 * stops before the next. Padding the edges imported the previous entry's
 * closing paragraph about its contrary genius, and four entries absorbed one.
 */
const CONTEXT_LINES = 0;

/** The last entry runs to the chapter's end rather than to another heading. */
const END_OF_LAST_ENTRY_LINES = 30;

/**
 * Ordinals the scan mangled past recognition, and what the sequence shows they
 * are. Each is the heading's leading token as the file spells it.
 */
const MANGLED_ORDINALS = new Map<string, number>([
  ["369.", 46],
  ["645.", 54],
  ["g1€.", 51],
  ["J;e.", 53],
]);

/** Shapes the scan reads digits as, where the reading is unambiguous. */
const DIGIT_LOOKALIKES = new Map<string, string>([
  ["I", "1"],
  ["l", "1"],
  ["r", "1"],
  ["s", "5"],
  ["S", "5"],
  ["$", "5"],
  ["g", "9"],
]);

export interface AngelRegion {
  no: number;
  /** 0-based lines of the source file, `to` exclusive. */
  from: number;
  to: number;
  french: string;
  /**
   * False where the scan lost the heading, so the region spans its neighbours
   * and the model is told which genius to take from it.
   */
  headingFound: boolean;
}

export function readSource(path = SOURCE_PATH) {
  return readFileSync(path, "utf8").split("\n").slice(0, FIRST_COPY_LINES);
}

/** The leading token of a heading, as an ordinal, or null if unreadable. */
function parseOrdinal(before: string) {
  // The scan sometimes opens a heading with stray punctuation, as in "' 47*.".
  const token =
    before
      .trim()
      .replace(/^[^\p{L}\p{N}$]+/u, "")
      .split(/\s+/)[0] ?? "";
  const mangled = MANGLED_ORDINALS.get(token);
  if (mangled !== undefined) return mangled;

  const normalised = [...token]
    .map((char) => DIGIT_LOOKALIKES.get(char) ?? char)
    .join("");
  const digits = normalised.match(/^\D*(\d{1,3})/)?.[1];
  if (!digits) return null;

  // A trailing degree sign reads as a digit often enough that "109" is the
  // tenth and "219" the twenty-first; only two-digit ordinals exist here.
  for (const candidate of [digits, digits.slice(0, 2), digits.slice(0, 1)]) {
    const no = Number(candidate);
    if (no >= 1 && no <= ANGEL_COUNT) return no;
  }
  return null;
}

/** Lines that open an entry: a short lead, then the genius's attribute. */
function findHeadings(lines: string[]) {
  const first = lines.findIndex((line) => /Vehuiah/.test(line));
  const last = lines.findIndex((line, i) => i > first && /Mumiah/.test(line));
  if (first < 0 || last < 0)
    throw new Error("The genii section is not where it should be");

  const headings = new Map<number, number>();
  let expected = 1;
  for (let i = first; i <= last; i++) {
    const at = lines[i].search(/attribut/i);
    if (at < 0 || at > 45) continue;

    const no = parseOrdinal(lines[i].slice(0, at));
    // Only ever move forward, and only onto an ordinal the sequence is due.
    if (no === null || no < expected || no > expected + 1) continue;
    headings.set(no, i);
    expected = no + 1;
  }
  return { headings, first, last };
}

/** One French region per genius, in order, covering all seventy-two. */
export function findRegions(lines = readSource()): AngelRegion[] {
  const { headings, last } = findHeadings(lines);

  // Where a heading is missing the region runs from the previous one it has,
  // so the genius is certainly inside it even though its opening line is gone.
  const startOf = (no: number) => {
    for (let at = no; at >= 1; at--) {
      const line = headings.get(at);
      if (line !== undefined) return line;
    }
    throw new Error(`No heading at or before genius ${no}`);
  };
  const endOf = (no: number) => {
    for (let at = no + 1; at <= ANGEL_COUNT; at++) {
      const line = headings.get(at);
      if (line !== undefined) return line;
    }
    return last + END_OF_LAST_ENTRY_LINES;
  };

  return Array.from({ length: ANGEL_COUNT }, (_, i) => {
    const no = i + 1;
    const from = Math.max(0, startOf(no) - CONTEXT_LINES);
    const to = Math.min(lines.length, endOf(no) + CONTEXT_LINES);
    return {
      no,
      from,
      to,
      french: lines.slice(from, to).join("\n"),
      headingFound: headings.has(no),
    };
  });
}
