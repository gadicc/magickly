"use client";

import CloseIcon from "@mui/icons-material/Close";
import LinkIcon from "@mui/icons-material/Link";
import { Box, Button, IconButton } from "@mui/material";
import type { EnochianEntry } from "magick-data/enochian/dictionary";
import * as React from "react";
import EnochianFont from "@/fonts/enochian";
import { GEMATRIA_NOTE, GEMATRIA_SOURCE } from "../gematria";
import { LABELS } from "./labels";
import SourceName from "./SourceName";
import { wordLink } from "./urlState";

/** An entry's layout, shared with the translator's Key rows. */
export const ENTRY_STYLES = {
  padding: { xs: "8px 16px 20px", md: "32px 40px" },
  // The word and its script side by side; where both don't fit, the
  // script wraps below rather than the word breaking.
  "& .entry-head": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: 2,
  },
  "& h2": {
    margin: 0,
    fontSize: { xs: 24, md: 34 },
    fontWeight: 500,
    letterSpacing: "0.03em",
    // Unlike `anywhere`, `break-word` keeps the whole word as the
    // heading's narrowest width, so the script wraps first; capped at the
    // line, the word breaks only if it is wider than the pane by itself.
    overflowWrap: "break-word",
    maxWidth: "100%",
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
  "& abbr[title]": { textDecoration: "none", cursor: "help" },
  "& .entry-note": { color: "text.secondary", fontSize: 13 },
  "& .entry-actions": { display: "flex", gap: 1, mt: 2, alignItems: "center" },
  "& .entry-uses": { listStyle: "none", margin: 0, padding: 0 },
  "& .entry-uses li": { margin: "6px 0" },
  "& .entry-uses a": { color: "primary.main", fontWeight: 500 },
  "& .entry-quote": { fontSize: 14, color: "text.secondary" },
  "& .entry-quote b": { color: "text.primary", fontWeight: 500 },
  "& .entry-related": { listStyle: "none", margin: 0, padding: 0 },
  "& .entry-related li": { margin: "4px 0" },
  // A form that opens its entry: a button, worded as the Keys' links are.
  "& .entry-related-form": {
    font: "inherit",
    color: "primary.main",
    fontWeight: 500,
    background: "none",
    border: 0,
    padding: 0,
    cursor: "pointer",
    "&:hover, &:focus-visible": { textDecoration: "underline" },
  },
  // Focused when a related word opens its entry, for the keyboard's sake.
  "& h2:focus:not(:focus-visible)": { outline: "none" },
} as const;

/** "ah (EMPM)" for each of a word's pronunciations. */
function Said({ entry }: { entry: EnochianEntry }) {
  return entry.pronounciations.map((one, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: the entry's own order
    <React.Fragment key={i}>
      {i ? "; " : ""}
      {one.pronounciation}
      {one.source && (
        <>
          {LABELS.saidSourceOpen}
          <SourceName name={one.source} />
          {LABELS.saidSourceClose}
        </>
      )}
    </React.Fragment>
  ));
}

/** "WE, Holy Table of Practice perimeter": a meaning's sources. */
function Sources({ meaning }: { meaning: EnochianEntry["meanings"][number] }) {
  const names = [...new Set([meaning.source, meaning.source2])].filter(
    (name): name is string => Boolean(name),
  );
  if (!names.length) return null;
  return (
    <span className="entry-source">
      {names.map((name, i) => (
        <React.Fragment key={name}>
          {i ? ", " : " "}
          <SourceName name={name} />
        </React.Fragment>
      ))}
    </span>
  );
}

/**
 * One word's entry, in the desktop pane or the phone's sheet (plan 074,
 * decision 3): the word in Latin letters and in the script, how it is said,
 * each meaning with its source, and its gematria, named as Schueler's.
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
  return (
    <Box sx={ENTRY_STYLES}>
      <div className="entry-head">
        <h2 id={headingId} tabIndex={-1}>
          {word}
        </h2>
        <span className="entry-script" style={EnochianFont.style}>
          {word}
        </span>
      </div>
      {entry.pronounciations.length > 0 && (
        <div className="entry-said">
          {LABELS.said} <Said entry={entry} />
        </div>
      )}
      <h3>{LABELS.meanings}</h3>
      <ol>
        {entry.meanings.map((meaning, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the entry's own order
          <li key={i}>
            {meaning.meaning}
            <Sources meaning={meaning} />
            {meaning.note && <div className="entry-note">{meaning.note}</div>}
          </li>
        ))}
      </ol>
      {entry.gematria.length > 0 && (
        <>
          <h3>{LABELS.gematria}</h3>
          <div>
            {entry.gematria.join(", ")}
            <span className="entry-source">
              {" "}
              <SourceName name={GEMATRIA_SOURCE} />
            </span>
            <div className="entry-note">{GEMATRIA_NOTE}</div>
          </div>
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
