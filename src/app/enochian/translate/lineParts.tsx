"use client";

import * as React from "react";
import { visuallyHidden } from "@/ui/visuallyHidden";
import { LABELS } from "./labels";
import type { Language, LineSegment, Translation } from "./lookup";

/**
 * The translator's two lines, apart from its page so the dictionary's
 * preview can show the reading line without loading the page's tool:
 * the reading line (decision 14), with our division of Dee's English
 * marked, and the direction's line beside the boxes (decision 4). Their
 * look is `lineStyles.ts`'s.
 */

/** Our division of Dee's English, marked by text, not colour alone. */
export function Ours({ text }: { text: string }) {
  return (
    <span className="tr-ours">
      <span aria-hidden>{LABELS.oursOpen}</span>
      {text}
      <span aria-hidden>{LABELS.oursClose}</span>
      <span style={visuallyHidden}>{` (${LABELS.ours})`}</span>
    </span>
  );
}

/** A segment of the reading line. */
function Segment({ segment }: { segment: LineSegment }) {
  if (segment.kind === "ours") return <Ours text={segment.text} />;
  if (segment.kind === "missing")
    return (
      <span className="tr-missing">
        [{segment.text}?]
        <span style={visuallyHidden}>{` (${LABELS.notFound})`}</span>
      </span>
    );
  if (segment.kind === "unglossed")
    return <span className="tr-missing">({LABELS.unknown})</span>;
  return <>{segment.text}</>;
}

/**
 * The reading line (decision 14): Dee's own English for a run of his
 * lines, and the rest word by word, tagged so; a word read two ways shows
 * both, "/" between.
 */
export function ReadingLine({ line }: { line: readonly LineSegment[] }) {
  const words = line.filter((one) => one.kind !== "dee").length;
  const label =
    words === 0
      ? LABELS.deeLine
      : words === line.length
        ? LABELS.wordByWord
        : LABELS.mixedLine;
  // Runs of segments: Dee's, or word by word.
  const groups: { dee: boolean; from: number; to: number }[] = [];
  line.forEach((one, at) => {
    const dee = one.kind === "dee";
    const last = groups[groups.length - 1];
    if (last && last.dee === dee) last.to = at + 1;
    else groups.push({ dee, from: at, to: at + 1 });
  });
  const mixed = groups.length > 1;
  const pieces = (from: number, to: number) => {
    const out: React.ReactNode[] = [];
    for (let at = from; at < to; at++) {
      const one = line[at];
      const before = line[at - 1];
      if (at > from) {
        const second =
          one.reading !== undefined &&
          before?.tokens[0] === one.tokens[0] &&
          before.reading !== one.reading;
        out.push(
          second ? (
            <React.Fragment key={`or-${at}`}>
              {" "}
              <span aria-hidden>/</span>
              <span style={visuallyHidden}>{LABELS.or}</span>{" "}
            </React.Fragment>
          ) : (
            " "
          ),
        );
      }
      out.push(<Segment key={at} segment={one} />);
    }
    return out;
  };
  return (
    <p className="tr-line">
      <span className="tr-line-label">
        {label}
        <span style={visuallyHidden}>{LABELS.lineLabelEnd}</span>
      </span>
      <span className="tr-line-text">
        {groups.map((group, index) => (
          <React.Fragment key={group.from}>
            {index > 0 && " "}
            {group.dee || !mixed ? (
              pieces(group.from, group.to)
            ) : (
              <span className="tr-wbw">
                <span className="tr-tag">{LABELS.wordByWord}</span>
                <span style={visuallyHidden}>{LABELS.lineLabelEnd}</span>
                {pieces(group.from, group.to)}
              </span>
            )}
          </React.Fragment>
        ))}
      </span>
    </p>
  );
}

/**
 * The direction's line beside the boxes (decision 4): what the text is
 * read as, and the switch.
 */
export function Guess({
  translation,
  chosen,
  onChoose,
}: {
  translation: Translation;
  chosen: Language | null;
  onChoose: (language: Language | null) => void;
}) {
  const { guess } = translation;
  const other = (language: Language): Language =>
    language === "english" ? "enochian" : "english";
  if (!chosen && guess.both)
    return (
      <>
        <span>{LABELS.readingBoth}</span>
        <span aria-hidden>·</span>
        <button
          type="button"
          className="tr-switch"
          onClick={() => onChoose("english")}
        >
          {LABELS.onlyAs("english")}
        </button>
        <span aria-hidden>·</span>
        <button
          type="button"
          className="tr-switch"
          onClick={() => onChoose("enochian")}
        >
          {LABELS.onlyAs("enochian")}
        </button>
      </>
    );
  const reading = chosen ?? guess.language;
  const next = other(reading);
  return (
    <>
      <span>
        {LABELS.readingAs(reading)}
        {chosen && ` (${LABELS.chosen})`}
      </span>
      <span aria-hidden>·</span>
      <button
        type="button"
        className="tr-switch"
        // Back to the guess when that is where the switch goes.
        onClick={() =>
          onChoose(next === guess.language && !guess.both ? null : next)
        }
      >
        {LABELS.switchTo}
      </button>
      {chosen && guess.both && (
        <>
          <span aria-hidden>·</span>
          <button
            type="button"
            className="tr-switch"
            onClick={() => onChoose(null)}
          >
            {LABELS.bothWays}
          </button>
        </>
      )}
    </>
  );
}
