import type { KeyPlace, Language } from "./lookup.ts";

/**
 * The translator's UI words, kept out of JSX text on purpose: site search
 * indexes a page's JSX text (plan 070), and labels are not prose a search
 * should find (plan 074, decision 11). The page's prose is
 * `TranslatorText.tsx`.
 */

const NAMES: Record<Language, string> = {
  english: "English",
  enochian: "Enochian",
};

const other = (language: Language): Language =>
  language === "english" ? "enochian" : "english";

/** "English → Enochian": reading a text as `language`. */
export const direction = (language: Language) =>
  `${NAMES[language]} → ${NAMES[other(language)]}`;

/** "Key 1.3": a Key and its word (row), as the grammar notes write it. */
export const place = (one: Pick<KeyPlace, "key" | "row">) =>
  `Key ${one.key}.${one.row}`;

/** A word's places: the first, and how many more. */
export const places = (rows: readonly Pick<KeyPlace, "key" | "row">[]) =>
  rows.length
    ? rows.length > 1
      ? `${place(rows[0])} and ${rows.length - 1} more`
      : place(rows[0])
    : "";

const count = (n: number, one: string, many: string) =>
  `${n.toLocaleString("en")} ${n === 1 ? one : many}`;

const percent = (part: number, whole: number) =>
  whole ? `${Math.round((part / whole) * 100)}%` : "0%";

/**
 * Whole percentages of parts that make up `whole`, summing to 100: each
 * rounded down, then the points left over given to the largest remainders
 * (the first on a tie), so 45% + 18% + 36% (99) is shown 45% + 18% + 37%.
 */
export function shares(parts: readonly number[], whole: number): number[] {
  if (!whole) return parts.map(() => 0);
  const exact = parts.map((part) => (part / whole) * 100);
  const out = exact.map(Math.floor);
  const left = 100 - out.reduce((sum, one) => sum + one, 0);
  const order = exact
    .map((one, at) => ({ at, remainder: one - Math.floor(one) }))
    .sort((a, b) => b.remainder - a.remainder || a.at - b.at);
  for (const { at } of order.slice(0, Math.max(0, left))) out[at]++;
  return out;
}

export const LABELS = {
  latinBox: "English or Latin letters",
  enochianBox: "Enochian, right to left",
  latinPlaceholder: "light of God, OL SONF…",
  hint: "Type a word or a sentence, in English or in Enochian.",
  readingAs: (language: Language) => `Reading as ${direction(language)}`,
  readingBoth: "Reading both ways",
  chosen: "your choice",
  switchTo: "switch",
  onlyAs: (language: Language) => `only as ${NAMES[language]}`,
  bothWays: "both ways",
  loading: "Loading the Keys…",
  cut: (max: number) =>
    `Only the first ${max.toLocaleString("en")} words are read.`,
  failed: "The Keys didn’t load.",
  retry: "Try again",
  resultsHeading: (language: Language) => direction(language),
  notice:
    "No one who reads Enochian has reviewed this. It is reconstruction from Dee’s words and our grammar notes, word by word, and a gap is a word we have no form for.",
  limitationsHeading: "What it can’t do",
  results: "Translation",
  // English into Enochian.
  source: {
    keys: (rows: readonly KeyPlace[]) => places(rows),
    dictionary: (work: string) => `dictionary, ${work}`,
    joined: (rows: readonly KeyPlace[]) => `joined, ${places(rows)}`,
  },
  inKeysToo: "also in the Keys",
  tier: (tier: 2 | 3) =>
    tier === 2
      ? "near match: without “of” or “to”"
      : "near match: but for a preposition",
  byRule: "by rule",
  carries: (word: string) => `carries “${word}”`,
  base: (plain: string) => `near match: read as “${plain}”`,
  reordered: "moved after its noun,",
  tense: (plain: string) => `read as “${plain}”,`,
  contraction: (from: string) => `from “${from}”`,
  alternatives: (n: number) => count(n, "other form", "other forms"),
  alternativesTitle: (english: string) => `Other forms for “${english}”`,
  leftOut: "left out",
  gap: "no form",
  nearest: "nearest:",
  // Enochian into English.
  readingLine: "Reading",
  deeLine: "Dee’s own English",
  wordByWord: "word by word",
  mixedLine: "Dee’s own English, and word by word where marked",
  /** Read after the line's label, which stands on a line of its own. */
  lineLabelEnd: ": ",
  ours: "our division of Dee’s English",
  oursOpen: "‹",
  oursClose: "›",
  or: "or",
  unknown: "meaning unknown",
  notFound: "not in our data",
  nearestSpellings: "nearest spellings:",
  via: {
    keys: (rows: readonly KeyPlace[]) => places(rows),
    gd: "Golden Dawn form (Crowley, 1912)",
    leitch: (page?: number) =>
      page === undefined
        ? "Leitch’s spelling"
        : `Leitch’s spelling, vol. II p. ${page}`,
    dictionary: (work?: string) =>
      work ? `dictionary, ${work}` : "dictionary",
    split: "split by rule",
  },
  notInCasaubon: "Crowley’s form: Casaubon’s print lost Dee’s word",
  // Rule chips.
  rule: (id: string) => `rule ${id}`,
  ruleName: (id: string, title?: string) =>
    title ? `Rule ${id}, ${title}` : `Rule ${id}`,
  sources: "Sources:",
  // The entry for a word only in the Keys.
  onlyInKeys: "This word is in Dee’s Keys but not in our dictionary.",
  choose: "Choose a word to see its entry.",
  close: "Close",
  // The live region: a short summary, not the output.
  summary: {
    toEnochian: (forms: number, chips: number, gaps: number) =>
      `English into Enochian: ${count(forms, "form", "forms")}, ${count(chips, "word", "words")} left out by rule, ${count(gaps, "gap", "gaps")}.`,
    toEnglish: (read: number, missing: number) =>
      `Enochian into English: ${count(read, "word", "words")} read${missing ? `, ${count(missing, "word", "words")} not in our data` : ""}.`,
  },
  // The figures (decision 21).
  figures: {
    heading: "How well it does",
    date: (date: string) =>
      `Measured ${new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })}, on the code this page runs.`,
    coverageHeading: "New English, 60 sentences",
    coverageAbout:
      "Sentences with no answer to check against, written for plan 077’s test: 20 a practitioner might want in Enochian, 20 everyday ones, and 20 that use only words found in Dee’s English. Each English word gets a form, a rule chip or a gap.",
    coverage: (forms: number, chips: number, gaps: number, words: number) => {
      const [f, c, g] = shares([forms, chips, gaps], words);
      return [
        `forms ${f}%`,
        `rule chips ${c}%`,
        `gaps ${g}%`,
        `of ${count(words, "word", "words")}`,
      ] as const;
    },
    gapFreeHeading: "Sentences with no gap",
    gapFree: (kind: string, n: number, of: number) => `${kind} ${n} of ${of}`,
    kinds: {
      practitioner: "practitioner",
      everyday: "everyday",
      attested: "attested",
    } as Record<string, string>,
    selfHeading: "Dee’s English in, his word back",
    selfAbout:
      "A self-consistency check, not a test: each Key’s English given as running text, and how many of Dee’s words come back where he wrote them. It looks in the Keys themselves, so it shows only that the lookup finds what is there.",
    self: (found: number, rows: number) =>
      `${found.toLocaleString("en")} of ${rows.toLocaleString("en")} words (${percent(found, rows)})`,
  },
} as const;
