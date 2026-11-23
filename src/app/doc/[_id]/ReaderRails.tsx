"use client";

import {
  Add as AddIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  Remove as RemoveIcon,
} from "@mui/icons-material";
import GridOnIcon from "@mui/icons-material/GridOn";
import { Button, IconButton } from "@mui/material";
import type { ReactNode } from "react";
import type { NextLine } from "@/doc/readerPosition";
import { READER_TEXT_SIZE_RANGE } from "@/doc/readerTextSize";
import { revealHall } from "@/doc/revealHall";
import type { RitualContentsEntry, RitualHall } from "@/doc/ritualHalls";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import UiText from "@/i18n/UiText";
import shell from "../readerShell.module.css";

/*
 * The reader's side rails (plan 089, decision 2). Each control is drawn
 * once: the shell's grid shows the rails from 1,200 px and hides them
 * below, where the floating button does their work.
 */

/**
 * A rail's section: a small label over its content. A panel the column
 * shows too, below 1,200 px, keeps its label to the rail, where the panels
 * are cards side by side; at the top of the column its controls' own
 * labels say enough.
 */
export function RailPanel({
  label,
  railOnly = true,
  children,
}: {
  label?: string;
  /** Shown only in the rail, from 1,200 px. */
  railOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={railOnly ? `${shell.panel} ${shell.railOnly}` : shell.panel}
    >
      {label && (
        <h2
          className={
            railOnly ? shell.label : `${shell.label} ${shell.railOnly}`
          }
        >
          <UiText message={label} />
        </h2>
      )}
      {children}
    </section>
  );
}

/** The anchor `blocks.jsx` gives a title. */
const titleAnchor = (text: string) => text.replace(/ /g, "_");

/**
 * The Contents rail: titles, with their halls indented under them, as the
 * floating button's Contents lists them. `section` is the current
 * title's index among the titles; `onTitle` goes to a title by that index,
 * since titles' texts may repeat.
 */
export function ContentsRail({
  entries,
  section,
  onTitle,
}: {
  entries: readonly RitualContentsEntry[];
  section: number;
  onTitle: (index: number) => void;
}) {
  const { t } = useUiLanguage();
  if (entries.length === 0) return null;
  let title = -1;
  return (
    <nav
      className={`${shell.contents} ${shell.panel}`}
      aria-label={t(/*i18n*/ "Contents")}
    >
      <h2 className={shell.label}>
        <UiText message={/*i18n*/ "Contents"} />
      </h2>
      <ol className={shell.entries}>
        {entries.map((entry) => {
          if (entry.type === "title") {
            const index = ++title;
            return (
              <li key={`title-${index}`}>
                <a
                  href={`#${titleAnchor(entry.text)}`}
                  // Ritual text, in the ritual's own language and direction.
                  lang=""
                  dir="auto"
                  aria-current={index === section ? "location" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    onTitle(index);
                  }}
                >
                  {entry.text}
                </a>
              </li>
            );
          }
          const { ordinal, name } = entry.hall;
          return (
            <li key={`hall-${ordinal}`} className={shell.hallEntry}>
              <a
                href={`#hall-${ordinal}`}
                onClick={(event) => {
                  event.preventDefault();
                  revealHall(ordinal, document, { replace: true });
                }}
              >
                <GridOnIcon fontSize="inherit" aria-hidden="true" />
                <span lang="" dir="auto">
                  {name}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The count to the reader's next line, the jump to it, and back. */
export function NextLinePanel({
  next,
  jumpedBack,
  onJump,
  onBack,
}: {
  /** `undefined` until measured, `null` after the reader's last line. */
  next: NextLine | null | undefined;
  /** Whether a jump can be undone. */
  jumpedBack: boolean;
  onJump: () => void;
  onBack: () => void;
}) {
  return (
    <RailPanel label={/*i18n*/ "Your next line"}>
      <p className={shell.count}>
        {next === null ? (
          <UiText message={/*i18n*/ "No more lines"} />
        ) : next ? (
          <UiText
            message={
              /*i18n*/ "{count, plural, =0 {Your line is next} one {# line before yours} other {# lines before yours}}"
            }
            values={{ count: next.count }}
          />
        ) : null}
      </p>
      {/* Both while a jump is pending, so the reader can jump on again. */}
      <div className={shell.jumps}>
        <Button
          size="small"
          startIcon={<ArrowDownwardIcon />}
          disabled={!next}
          onClick={onJump}
        >
          <UiText message={/*i18n*/ "Jump to your next line"} />
        </Button>
        {jumpedBack && (
          <Button size="small" startIcon={<ArrowUpwardIcon />} onClick={onBack}>
            <UiText message={/*i18n*/ "Jump back"} />
          </Button>
        )}
      </div>
    </RailPanel>
  );
}

/** The ritual's halls, each opening the full-screen viewer at it. */
export function HallsPanel({
  halls,
  onOpen,
}: {
  halls: readonly RitualHall[];
  onOpen: (index: number) => void;
}) {
  return (
    <RailPanel label={/*i18n*/ "Halls"}>
      <ul className={shell.entries}>
        {halls.map((hall, index) => (
          <li key={hall.ordinal}>
            <Button
              size="small"
              startIcon={<GridOnIcon />}
              onClick={() => onOpen(index)}
              className={shell.hallButton}
            >
              <span lang="" dir="auto">
                {hall.name}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </RailPanel>
  );
}

/** The text-size control, as the floating button's Text size. */
export function TextSizePanel({
  fontSize,
  setFontSize,
}: {
  fontSize: number;
  setFontSize: (fontSize: number) => void;
}) {
  const { t } = useUiLanguage();
  return (
    <RailPanel label={/*i18n*/ "Text size"}>
      <div className={shell.textSize}>
        <IconButton
          size="small"
          aria-label={t(/*i18n*/ "decrease font size")}
          disabled={fontSize <= READER_TEXT_SIZE_RANGE[0]}
          onClick={() => setFontSize(fontSize - 5)}
        >
          <RemoveIcon />
        </IconButton>
        <span>{fontSize}%</span>
        <IconButton
          size="small"
          aria-label={t(/*i18n*/ "increase font size")}
          disabled={fontSize >= READER_TEXT_SIZE_RANGE[1]}
          onClick={() => setFontSize(fontSize + 5)}
        >
          <AddIcon />
        </IconButton>
      </div>
    </RailPanel>
  );
}
