/**
 * The look of the translator's reading line (`lineParts.tsx`), shared by
 * its page and the dictionary's preview, each of which spreads it into its
 * own styles: the line, its label on a line of its own, the word-by-word
 * stretch and its tag, and a word we don't have, in italics. A plain
 * object, so the dictionary's first load gets these few rules and no code.
 */
export const LINE_STYLES = {
  "& .tr-line": { fontSize: 18, margin: "0 0 12px", overflowWrap: "anywhere" },
  "& .tr-line-label": {
    display: "block",
    fontSize: 12,
    color: "text.secondary",
  },
  "& .tr-wbw": {
    borderBottom: "1px dotted",
    borderColor: "text.secondary",
  },
  "& .tr-tag": {
    fontSize: 11,
    color: "text.secondary",
    border: 1,
    borderColor: "divider",
    borderRadius: 0.5,
    padding: "0 4px",
    marginRight: "4px",
    verticalAlign: "middle",
  },
  "& .tr-missing": { fontStyle: "italic" },
} as const;
