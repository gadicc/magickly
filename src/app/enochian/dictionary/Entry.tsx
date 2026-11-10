"use client";

import CloseIcon from "@mui/icons-material/Close";
import LinkIcon from "@mui/icons-material/Link";
import { Box, Button, IconButton } from "@mui/material";
import type { EnochianEntry } from "magick-data/enochian/dictionary";
import * as React from "react";
import EnochianFont from "../../../components/enochian/enochianFont";
import { LABELS } from "./labels";
import { wordLink } from "./urlState";

const styles = {
  padding: { xs: "8px 16px 20px", md: "32px 40px" },
  "& .entry-head": {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 2,
  },
  "& h2": {
    margin: 0,
    fontSize: { xs: 24, md: 34 },
    fontWeight: 500,
    letterSpacing: "0.03em",
    overflowWrap: "anywhere",
  },
  "& .entry-script": { fontSize: { xs: 34, md: 48 }, lineHeight: 1 },
  "& .entry-said": { color: "text.secondary", fontSize: 14, mt: 0.5 },
  "& h3": {
    margin: "16px 0 4px",
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "text.secondary",
  },
  "& ol": { margin: 0, paddingLeft: "22px" },
  "& li": { margin: "3px 0" },
  "& .entry-source": { color: "text.secondary", fontSize: 12 },
  "& .entry-note": { color: "text.secondary", fontSize: 13 },
  "& .entry-actions": { display: "flex", gap: 1, mt: 2, alignItems: "center" },
  "& .entry-uses": { listStyle: "none", margin: 0, padding: 0 },
  "& .entry-uses li": { margin: "6px 0" },
  "& .entry-uses a": { color: "primary.main", fontWeight: 500 },
  "& .entry-quote": { fontSize: 14, color: "text.secondary" },
  "& .entry-quote b": { color: "text.primary", fontWeight: 500 },
} as const;

/** "ah (EMPM)" for each of a word's pronunciations. */
function said(entry: EnochianEntry) {
  return entry.pronounciations
    .map((one) =>
      [one.pronounciation, one.source && `(${one.source})`]
        .filter(Boolean)
        .join(" "),
    )
    .join("; ");
}

/** "WE, Holy Table of Practice perimeter": a meaning's sources. */
const sources = (meaning: EnochianEntry["meanings"][number]) =>
  [meaning.source, meaning.source2].filter(Boolean).join(", ");

/**
 * One word's entry, in the desktop pane or the phone's sheet (plan 074,
 * decision 3): the word in Latin letters and in the script, how it is said,
 * each meaning with its source, and its gematria.
 */
export default function Entry({
  word,
  entry,
  onClose,
  headingId,
  children,
}: {
  word: string;
  entry: EnochianEntry;
  onClose: () => void;
  /** The heading's id, which labels the pane or sheet. */
  headingId: string;
  /** Sections after the meanings ("In the Keys"). */
  children?: React.ReactNode;
}) {
  // The page keys the entry by its word, so "Link copied" resets.
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(wordLink(word));
      setCopied(true);
    } catch {
      // No clipboard (an insecure origin, a refused permission): the URL
      // bar holds the same link.
    }
  };
  const pronunciation = said(entry);
  return (
    <Box sx={styles}>
      <div className="entry-head">
        <h2 id={headingId}>{word}</h2>
        <span className="entry-script" style={EnochianFont.style}>
          {word}
        </span>
      </div>
      {pronunciation && (
        <div className="entry-said">
          {LABELS.said} {pronunciation}
        </div>
      )}
      <h3>{LABELS.meanings}</h3>
      <ol>
        {entry.meanings.map((meaning, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the entry's own order
          <li key={i}>
            {meaning.meaning}
            {sources(meaning) && (
              <span className="entry-source">{` ${sources(meaning)}`}</span>
            )}
            {meaning.note && <div className="entry-note">{meaning.note}</div>}
          </li>
        ))}
      </ol>
      {entry.gematria.length > 0 && (
        <>
          <h3>{LABELS.gematria}</h3>
          <div>{entry.gematria.join(", ")}</div>
        </>
      )}
      {children}
      <div className="entry-actions">
        <Button size="small" startIcon={<LinkIcon />} onClick={copy}>
          {copied ? LABELS.copied : LABELS.copyLink}
        </Button>
        <Box sx={{ flex: 1 }} />
        <IconButton aria-label={LABELS.close} onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>
    </Box>
  );
}
