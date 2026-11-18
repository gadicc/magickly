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
  /**
   * A gap's hint (plan 081, S11): "related: RNAH ‘sunrise’", forms whose
   * gloss is close in meaning, marked as a machine's suggestion.
   */
  gapHint: {
    related: "related:",
    gloss: (gloss: string) => `‘${gloss}’`,
    note: "suggested by meaning, not reviewed",
  },
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
  // The AI reading (plan 081, stage 2: S2, S7).
  reading: {
    offer: "Read with AI",
    again: "Read again",
    retry: "Try again",
    retryFailed: "Try the failed part again",
    /**
     * What a request will use: of a signed-in reader's own allowance, or of
     * the pool signed-out readers share, with the cap on one client.
     */
    uses: (
      units: number,
      signedIn: boolean,
      limit: number,
      cap: number,
      atMost = false,
    ) =>
      `uses ${atMost ? "at most " : ""}${units} of today’s ${
        signedIn
          ? limit
          : `allowance shared by readers not signed in, at most ${cap} a day for each address`
      }`,
    againNote: "a new reading, which replaces this one",
    heading: "AI reading",
    who: "GPT-6.1 Terra, each word checked against our data",
    starting: "Reading with AI…",
    readingPart: (part: number, parts: number) =>
      parts > 1 ? `Reading part ${part} of ${parts}…` : "Reading…",
    sentenceLabel: "The model’s sentence, not checked",
    withheld: (reason: string, part?: number) =>
      part === undefined
        ? `The model’s sentence is withheld: ${reason}`
        : `The model’s sentence for part ${part} is withheld: ${reason}`,
    withheldReason: {
      "no sentence": "the model gave none.",
      "no content words": "it has no words of meaning to compare.",
      "too few supported":
        "too few of its words are in the word readings or our data.",
      "too long": "it is far longer than your text.",
      link: "it holds a link.",
      unreadable: "it has letters or symbols our check can’t read.",
    } as Record<string, string>,
    wordsLabel: "Each word",
    state: {
      confirmed: "confirmed",
      unconfirmed: "not confirmed",
      guess: "the model’s guess",
      none: "no reading",
    },
    headword: (headword: string) => `dictionary, ${headword}`,
    row: (key: number, row: number, word: string, aethyr?: number) =>
      aethyr === undefined
        ? `Key ${key}.${row} ${word}`
        : `Key ${key}.${row}, the Aethyr ${word} (${aethyr})`,
    /** A part with no reading, in its words' place. */
    partFailed: (text: string, part: number, parts: number) =>
      parts > 1 ? `Part ${part} of ${parts}: ${text}` : text,
    failure: {
      refused: "the provider refused to read this passage.",
      truncated: "the model’s answer was cut off.",
      unreadable: "the model’s answer couldn’t be read.",
      routing:
        "not shown, since the provider’s privacy terms couldn’t be confirmed.",
      timeout: "the model took too long.",
      failed: "the model failed.",
      "not read": "not sent.",
      unavailable: "not sent: something went wrong on our side.",
      off: "not sent: AI readings were turned off.",
    } as Record<string, string>,
    lost: "The reading stopped arriving.",
    /**
     * After the answer stopped (S8): the route's calls go on without the
     * reader, so the rest may still be read and kept, and a retry then
     * costs less, or nothing. Sure the text was sent once a part arrived;
     * before then, it may have been. The keeping is said as the AI
     * reading's limitation says it.
     */
    lostSent: (sure: boolean) =>
      `${
        sure
          ? "Your text was sent for this reading, and the rest of it"
          : "Your text may have been sent for this reading, and if so it"
      } may still be read. Our server keeps the text and its reading for a day and deletes them within two days, so trying again may use less, or none.`,
    /** After a part the gateway didn't route as asked (S5): no retry. */
    stoppedRouting:
      "The reading stopped because the provider’s privacy terms (OpenAI, keeping no copy) couldn’t be confirmed, and nothing more was sent.",
    refusal: {
      busy: "This text is being read just now. Try again shortly.",
      off: "AI readings are turned off for now.",
      ceiling: (time: string) =>
        `AI readings have stopped for everyone today: the day’s spending limit is reached. They start again at ${time}.`,
      user: (units: number, left: number, limit: number, time: string) =>
        `This reading needs ${units}, and you have ${left} of today’s ${limit} left. They renew at ${time}.`,
      anonymous: (units: number, left: number, time: string) =>
        `${
          left > 0
            ? `Too little is left of today’s allowance shared by readers not signed in: this reading needs ${units}, and ${left} ${left === 1 ? "is" : "are"} left.`
            : "Readers not signed in have used today’s shared allowance."
        } It renews at ${time}; signed in, you have your own.`,
      client: (units: number, left: number, cap: number, time: string) =>
        `This reading needs ${units}, and ${left} ${left === 1 ? "is" : "are"} left of the ${cap} a day for each address not signed in (readers sharing an address share them). They renew at ${time}.`,
      unavailable:
        "Something went wrong on our side, so the reading didn’t start. Nothing was sent.",
      other: "This text can’t be read with AI.",
    },
    /**
     * Where the text went and what the reading used (S7): to OpenAI, or
     * through Vercel unconfirmed after a routing failure; kept with its
     * reading, or not at all when no part was read (the route keeps no
     * passage without a reading).
     */
    went: (kept: boolean, confirmed: boolean) =>
      `${
        confirmed
          ? "Your text went to OpenAI through Vercel for this reading"
          : "Your text went through Vercel for this reading, which didn’t confirm that it reached OpenAI with no copy kept"
      }${
        kept
          ? ", and our server keeps it and the reading for a day."
          : "; with no part read, our server keeps none of it."
      }`,
    fromStore:
      "This text was read in the last day, so the reading came from our server and nothing went to OpenAI.",
    used: (units: number, signedIn: boolean, limit: number) =>
      units === 0
        ? "It used none of your allowance."
        : signedIn
          ? `It used ${units} of today’s ${limit}.`
          : `It used ${units} of today’s shared allowance.`,
    limitationsHeading: "What the AI reading can’t do",
    /** The card's live region: a few words as each part lands. */
    announce: (part: number, parts: number, confirmed: number, words: number) =>
      `${parts > 1 ? `Part ${part} of ${parts} read: ` : "AI reading: "}${confirmed} of ${count(words, "word", "words")} confirmed.`,
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
