/**
 * The dictionary's UI words, kept out of JSX text on purpose: site search
 * indexes a page's JSX text ([plan 070](../../../../plans/070-site-search.md)),
 * and labels such as "Show all 30" are not prose a search should find
 * (plan 074, decision 11). The page's prose is `DictionaryText.tsx`.
 */
export const LABELS = {
  latinBox: "English or Latin letters",
  enochianBox: "Enochian, right to left",
  latinPlaceholder: "light, OL…",
  word: "Enochian word",
  means: (query: string) => `Means “${query}”`,
  mentions: (query: string) => `Meanings that mention “${query}”`,
  spelled: (query: string) => `Spelled with “${query}”`,
  allWords: "All words",
  showAll: (count: number) => `Show all ${count.toLocaleString("en")}`,
  nothing: (query: string) => `Nothing found for “${query}”.`,
  found: (count: number) =>
    count === 1 ? "1 word found" : `${count.toLocaleString("en")} words found`,
  unknown: "meaning unknown",
  results: "Words",
  /** The phone's button that shows the page's text above the list. */
  about: "About the dictionary",
  said: "Said",
  /** Around a pronunciation's source: "ah (EMPM)". */
  saidSourceOpen: " (",
  saidSourceClose: ")",
  meanings: "Meanings",
  gematria: "Gematria",
  /** A source's full name, shown on hovering its short form. */
  sourceNames: {
    EMPM: "Gerald Schueler, Enochian Magic: A Practical Manual",
    WE: "The Whole Enochian Dictionary",
  } as Readonly<Record<string, string>>,
  copyLink: "Copy link",
  copied: "Link copied",
  close: "Close",
  keypad: "Enochian letters",
  keypadHint: "Enochian letters · tap to type",
  backspace: "Delete a letter",
  backspaceKey: "⌫",
  done: "Done",
  inTheKeys: "In the Keys",
  place: (use: { key: number; aethyr?: number }) =>
    use.aethyr === undefined
      ? `Key ${use.key}`
      : `Key 19, the Call of Aethyr ${use.aethyr}`,
  inPart: (word: string) => `as part of ${word}`,
  quoteOpen: (before: string) => (before ? `“…${before} ` : "“"),
  quoteClose: (after: string) => (after ? ` ${after}…”` : "”"),
  moreUses: (count: number) => `and ${count} more`,
  // The translator's preview, for a query of three words or more (plan
  // 081, decision 3).
  preview: "As a sentence",
  previewDirection: (english: boolean) =>
    english ? "English → Enochian" : "Enochian → English",
  previewWaiting: "…",
  previewLoading: "Translating…",
  /** Read between the preview's name and its direction. */
  previewSeparator: ", ",
  /** Read after a line's label, which stands on a line of its own. */
  previewLabelEnd: ": ",
  previewGapOpen: "[",
  previewGapClose: "]",
  previewNoForm: "(no form)",
  previewForms: (leftOut: number) =>
    leftOut === 0
      ? "Word by word"
      : leftOut === 1
        ? "Word by word, 1 word left out by rule"
        : `Word by word, ${leftOut.toLocaleString("en")} words left out by rule`,
  /** Under English into Enochian: the page's notice in short (decision 5). */
  previewUnreviewed: "No one who reads Enochian has reviewed this.",
  /** Read between the line and the note under it. */
  previewNoteBefore: ". ",
  previewCut: (max: number) =>
    `Only the first ${max.toLocaleString("en")} words are read.`,
  openInTranslator: "Open in the translator",
} as const;
