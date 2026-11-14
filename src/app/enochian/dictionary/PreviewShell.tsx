"use client";

import * as React from "react";
import Link from "@/ui/Link";
import { visuallyHidden } from "@/ui/visuallyHidden";
import { LABELS } from "./labels";

/**
 * The translator page on `query` (plan 081, decision 19): the text goes in
 * the fragment only, which no browser sends to a server. No `dir`: the
 * page guesses the direction with the same code, so it reads the text as
 * the preview did (decision 4).
 */
export function translatorLink(query: string) {
  return `/enochian/translate#${new URLSearchParams({ q: query })}`;
}

/** The line's place while it loads: "…", read as "Translating…". */
function Waiting() {
  return (
    <p className="tr-line">
      <span className="tr-line-label" />
      <span className="tr-line-text">
        <span aria-hidden>{LABELS.previewWaiting}</span>
        <span style={visuallyHidden}>{LABELS.previewLoading}</span>
      </span>
    </p>
  );
}

/**
 * The frame of the dictionary's "as a sentence" preview (plan 081,
 * decision 3): its heading, one line and the link to the translator. It
 * is in the dictionary's own bundle, so the frame stands at once, with
 * room kept for its line, while the translator's code and the Keys load
 * behind `SentencePreview`.
 */
export default function PreviewShell({
  query,
  direction,
  children,
}: {
  /** The dictionary's query, trimmed. */
  query: string;
  /** "English → Enochian", once the guess is known. */
  direction?: string;
  /** The line; while it loads, a placeholder. */
  children?: React.ReactNode;
}) {
  return (
    // Named in words, not from the heading's two parts, which would run
    // together ("As a sentenceEnglish → Enochian").
    <section
      className="dict-preview"
      aria-label={
        direction
          ? `${LABELS.preview}${LABELS.previewSeparator}${direction}`
          : LABELS.preview
      }
    >
      <div className="dict-group" aria-hidden>
        <span>{LABELS.preview}</span>
        <span className="dict-count">{direction}</span>
      </div>
      <div className="dict-preview-line">{children ?? <Waiting />}</div>
      <div className="dict-preview-open">
        <Link href={translatorLink(query)} prefetch={false}>
          {LABELS.openInTranslator}
        </Link>
      </div>
    </section>
  );
}

/**
 * Shows nothing in place of the preview when its code fails to load (an
 * old tab after a deploy, or offline) or fails to render, so the
 * dictionary itself never breaks; `onError` lets the page try again on
 * the next query.
 */
export class PreviewBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
