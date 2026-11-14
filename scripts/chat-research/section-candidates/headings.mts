/** Offline documentary candidates only. UTF-16 coordinates refer to this canonical view, never raw PDF/page offsets. */
export const SECTION_NORMALIZER = "nfc-paragraph-utf16-v1";
export const SECTION_ERROR = "Offline section candidates unavailable";
export function sectionCheck(value: unknown): asserts value {
  if (!value) throw Error(SECTION_ERROR);
}
/** Canonical search view compatible with ordinary NFC paragraph text; exact unit matches are still required. */
export function normalizeSectionPage(text: string) {
  return text
    .replace(/\f/g, "")
    .normalize("NFC")
    .trim()
    .split(/\n\s*\n/u)
    .map((p) => p.replace(/\s+/gu, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}
const roman = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
  "XXI",
  "XXII",
  "XXIII",
  "XXIV",
  "XXV",
  "XXVI",
  "XXVII",
  "XXVIII",
  "XXIX",
  "XXX",
  "XXXI",
  "XXXII",
];
/** Canonical Roman I–XXXII or Arabic 1–32 only; OCR guesses and malformed numerals remain unresolved. */
export function sectionOrdinal(marker: string): number | undefined {
  if (/^[1-9][0-9]?$/u.test(marker)) {
    const n = Number(marker);
    return n <= 32 ? n : undefined;
  }
  const n = roman.indexOf(marker.toUpperCase());
  return n > 0 ? n : undefined;
}
/** A possible step heading. Titles are private derived metadata, not permission or semantic labels. */
export interface StepHeading {
  readonly ordinal: number | undefined;
  readonly uncertain_marker: boolean;
  readonly title: string;
  readonly start: number;
  readonly end: number;
  readonly contents_candidate: boolean;
}
/** Preserve contents candidates; detect only standalone Step markers or colon/dash-delimited inline headings. */
export function scanStepHeadings(canonical: string): StepHeading[] {
  const blocks = canonical.split("\n\n");
  const contents = blocks
    .slice(0, 6)
    .some((p) => /^(?:table of )?contents$/iu.test(p));
  const output: StepHeading[] = [];
  let at = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i],
      standalone = /^step\s+([a-z0-9]+)$/iu.exec(block),
      inline = /^step\s+([a-z0-9]+)\s*[:—–-]\s*(.*)$/iu.exec(block),
      match = standalone ?? inline;
    if (match) {
      const ordinal = sectionOrdinal(match[1]);
      const title = standalone ? blocks[i + 1] : inline![2];
      const validTitle =
        !!title &&
        title.length <= 120 &&
        !/^step\s/iu.test(title) &&
        title.split(/\s/u).length <= 16;
      // Unresolved standalone markers remain barriers to a complete section.
      output.push({
        ordinal,
        uncertain_marker: ordinal === undefined || !validTitle,
        title: validTitle ? title : "",
        start: at,
        end:
          at +
          (standalone && validTitle
            ? block.length + 2 + title.length
            : block.length),
        contents_candidate:
          contents || (validTitle && /\.{2,}|…|\s[0-9]+$/u.test(title)),
      });
      sectionCheck(output.length <= 64);
    }
    at += block.length + 2;
  }
  return output;
}
const ordinalWords = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
];
/** Conservative candidate intent only. An opening exercise can suggest ordinal one, with an explicit ambiguity flag. */
export function offlineOrdinalIntent(query: string) {
  const none = { ordinal: undefined, opening_inferred: false };
  // Prefer baseline fallback for any negation; this is a candidate grammar, not NLU.
  const negated =
    /\b(?:not|never|except|rather\s+than|other\s+than|instead\s+of|don['’]?t)\b/iu;
  if (
    negated.test(query) ||
    /\b(?:opening\s+ritual|first\s+system|second\s+book|both\s+books)\b/iu.test(
      query,
    )
  )
    return none;
  const coordinatedWords = new RegExp(
    "\\b(?:" +
      ordinalWords.join("|") +
      ")(?:\\s+(?:step|exercise))?\\s*(?:,|and|or|&|/|[-–—]|to|through|until)\\s*(?:the\\s+)?(?:" +
      ordinalWords.join("|") +
      ")\\b",
    "iu",
  );
  if (
    coordinatedWords.test(query) ||
    /\bstep\s+[a-z0-9]+\s*(?:,|and|or|&|\/|[-–—]|to|through|until)\s*(?:[ivxlcdm]+|[1-9][0-9]?)\b/iu.test(
      query,
    )
  )
    return none;
  const ordinals = new Set<number>();
  let invalid = false;
  for (const match of query.matchAll(
    /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+(?:step|exercise)\b|\bstep\s+([a-z0-9]+)\b|\b(opening\s+exercise)\b/giu,
  )) {
    const n = match[1]
      ? ordinalWords.indexOf(match[1].toLowerCase()) + 1
      : match[2]
        ? sectionOrdinal(match[2])
        : 1;
    if (n === undefined) invalid = true;
    else ordinals.add(n);
  }
  return !invalid && ordinals.size === 1
    ? {
        ordinal: [...ordinals][0],
        opening_inferred: /\bopening\s+exercise\b/iu.test(query),
      }
    : none;
}
