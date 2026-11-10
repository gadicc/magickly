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
  choose: "Choose a word to see its entry.",
  said: "Said",
  meanings: "Meanings",
  gematria: "Gematria",
  copyLink: "Copy link",
  copied: "Link copied",
  close: "Close",
  entry: (word: string) => `Entry for ${word}`,
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
} as const;
