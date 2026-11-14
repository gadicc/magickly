"use client";

import CloseIcon from "@mui/icons-material/Close";
import { Box, IconButton, Popover, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import dictionary from "magick-data/enochian/dictionary";
import * as React from "react";
import EnochianFont from "@/fonts/enochian";
import Link from "@/ui/Link";
import { visuallyHidden } from "@/ui/visuallyHidden";
import Entry, { ENTRY_STYLES } from "../dictionary/Entry";
import EntrySheet from "../dictionary/EntrySheet";
import InTheKeys, { keysLink } from "../dictionary/InTheKeys";
import Keypad from "../dictionary/Keypad";
import { LABELS as DICTIONARY_LABELS } from "../dictionary/labels";
import { useKeypadBox } from "../dictionary/useKeypadBox";
import {
  fragmentOf,
  readFragment,
  type TranslateState,
  useTranslateFragment,
} from "./fragment";
import { LABELS } from "./labels";
import { TRANSLATOR_LIMITATIONS } from "./limitations";
import { useTranslator } from "./load";
import type {
  EnochianToken,
  FormOption,
  FormToken,
  KeyPlace,
  Language,
  LineSegment,
  Reading,
  ReadToken,
  ReadWord,
  RuleId,
  TileChip,
  ToEnglish,
  ToEnochian,
  Translation,
} from "./lookup";
import type { RuleNotes } from "./ruleNotes";

/**
 * The Enochian translator (plan 081, decisions 4, 5 and 17–20): one text
 * in two boxes, Latin letters and the Enochian script; the direction
 * guessed, with a switch; English into Enochian as tiles, rule chips and
 * gaps, and Enochian into English as a reading line and tiles. A tile
 * opens its word's entry beside the results on desktop, or in a sheet on
 * phones, as the dictionary does.
 *
 * Nothing leaves the browser: the lookup runs here, the text lives in the
 * URL's fragment, and the one request, for the Keys table, carries none
 * of it. The UI words come from `labels.ts`, out of site search's index.
 */

/** How long typing waits before the text is written to the URL. */
const URL_DELAY = 300;
/** Room left under the results for the docked keypad. */
const KEYPAD_ROOM = 240;

/** What a tile opens: a word's dictionary entries, or its Key rows. */
interface Opened {
  word: string;
  /** Dictionary keys; none for a word only in the Keys. */
  entries: readonly string[];
  /** Dee's rows, for a word with no entry. */
  rows: readonly KeyPlace[];
  /** Said of the word above its rows (Crowley's form for a lost word). */
  note?: string;
}

const button = {
  font: "inherit",
  color: "inherit",
  background: "none",
  border: 0,
  padding: 0,
  cursor: "pointer",
  textAlign: "inherit",
} as const;

const styles = {
  display: { md: "grid" },
  gridTemplateColumns: { md: "minmax(0, 1fr) 400px" },
  alignItems: "start",
  "& .tr-main": {
    minWidth: 0,
    borderRight: { md: 1 },
    borderColor: { md: "divider" },
    padding: "12px 16px 24px",
  },
  "& .tr-boxes": {
    display: "grid",
    gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "1fr 1fr" },
    gap: "10px",
  },
  "& .tr-field": { minWidth: 0, display: "flex", flexDirection: "column" },
  "& .tr-box": {
    width: "100%",
    minWidth: 0,
    minHeight: 76,
    padding: "10px 12px",
    font: "inherit",
    fontSize: 16,
    lineHeight: 1.4,
    color: "text.primary",
    bgcolor: "background.paper",
    border: 1,
    borderColor: "divider",
    borderRadius: 1,
    outline: "none",
    resize: "vertical",
    // Grows with the text where the browser can.
    fieldSizing: "content",
    "&:focus": { borderColor: "primary.main", boxShadow: 1 },
  },
  "& .tr-box-enochian": { fontSize: 22, textTransform: "uppercase" },
  "& .tr-label": { fontSize: 12, color: "text.secondary", mt: 0.5 },
  "& .tr-guess": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: "4px 8px",
    mt: 1,
    fontSize: 14,
    color: "text.secondary",
    minHeight: 24,
  },
  "& .tr-switch": {
    ...button,
    color: "primary.main",
    fontWeight: 500,
    "&:hover, &:focus-visible": { textDecoration: "underline" },
  },
  "& .tr-status": { mt: 2, color: "text.secondary" },
  "& .tr-result": { mt: 3 },
  "& .tr-result h2": {
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "primary.main",
    margin: "0 0 8px",
  },
  "& .tr-result h3": {
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "text.secondary",
    margin: "16px 0 4px",
  },
  "& .tr-notice": {
    borderLeft: 4,
    borderColor: "warning.main",
    bgcolor: "action.hover",
    padding: "8px 12px",
    margin: "0 0 12px",
    fontSize: 14,
  },
  "& .tr-caveats": {
    display: "grid",
    gridTemplateColumns: { md: "minmax(0, 2fr) minmax(0, 3fr)" },
    gap: "4px 20px",
    alignItems: "start",
    mb: 1.5,
    "& .tr-notice": { margin: 0 },
    "& h3": { mt: { md: 0 } },
  },
  "& .tr-tiles": {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  "& .tr-tile": {
    minWidth: 0,
    maxWidth: "100%",
    border: 1,
    borderColor: "divider",
    borderRadius: 1,
    padding: "6px 10px 8px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  // Told apart by their words; the borders only help.
  "& .tr-gap": { borderStyle: "dashed" },
  "& .tr-chip": { borderStyle: "dotted", bgcolor: "action.hover" },
  "& .tr-open": {
    ...button,
    display: "flex",
    flexDirection: "column",
    borderRadius: 0.5,
    "&:hover .tr-form": { textDecoration: "underline" },
    "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
  },
  "& .tr-form": {
    fontSize: 18,
    fontWeight: 500,
    letterSpacing: "0.02em",
    overflowWrap: "anywhere",
  },
  "& .tr-script": { fontSize: 18, color: "text.secondary", lineHeight: 1.2 },
  "& .tr-english": {
    fontSize: 14,
    color: "text.secondary",
    overflowWrap: "anywhere",
  },
  "& .tr-marker": { fontStyle: "italic", fontWeight: 400, fontSize: 15 },
  "& .tr-meta": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: "2px 8px",
    fontSize: 12,
    color: "text.secondary",
    maxWidth: 320,
  },
  "& .tr-near": {
    ...button,
    color: "primary.main",
    fontWeight: 500,
    "&:hover, &:focus-visible": { textDecoration: "underline" },
  },
  "& .pop-source": { ml: 0.5 },
  "& .tr-reading + .tr-reading": {
    borderTop: 1,
    borderColor: "divider",
    pt: 0.5,
    mt: 0.5,
  },
  "& .tr-words": { display: "flex", flexWrap: "wrap", gap: "4px 12px" },
  "& .tr-or": { fontSize: 12, color: "text.secondary" },
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
  "& .tr-limits": {
    margin: "4px 0 0",
    paddingLeft: "20px",
    fontSize: 14,
    color: "text.secondary",
    "& li": { margin: "2px 0" },
  },
  "& .tr-pane": {
    display: { xs: "none", md: "block" },
    position: "sticky",
    top: 0,
    maxHeight: "100vh",
    overflowY: "auto",
    bgcolor: "action.hover",
    minHeight: "60vh",
  },
  "& .tr-choose": { padding: "32px 40px", color: "text.secondary" },
} as const;

/** The pill a rule chip shows, and its popover's look. */
const ruleStyles = {
  "& .tr-rule": {
    ...button,
    fontSize: 12,
    lineHeight: "18px",
    padding: "0 6px",
    border: 1,
    borderColor: "primary.main",
    color: "primary.main",
    borderRadius: 4,
    whiteSpace: "nowrap",
    "&:hover, &:focus-visible": { bgcolor: "action.hover" },
  },
} as const;

const popoverPaper = {
  // MUI's own cap keeps 16px clear of a phone's edges; keep it there.
  maxWidth: "min(380px, calc(100% - 32px))",
  padding: "12px 16px",
  "& .pop-title": { fontWeight: 500, mb: 0.5 },
  "& p": { margin: "4px 0", fontSize: 14 },
  "& .pop-sources": { color: "text.secondary", fontSize: 12.5 },
  "& ul": { listStyle: "none", margin: 0, padding: 0 },
  "& li": { margin: "6px 0" },
  "& .tr-near": {
    ...button,
    color: "primary.main",
    fontWeight: 500,
    "&:hover, &:focus-visible": { textDecoration: "underline" },
  },
  "& .pop-source": { color: "text.secondary", fontSize: 12.5, ml: 1 },
} as const;

/** The grammar notes a chip opens, and what a tile opens. */
const Context = React.createContext<{
  notes: RuleNotes;
  open: (opened: Opened) => void;
}>({ notes: {}, open: () => {} });

/** A popover anchored to its button, labelled by its title. */
function usePopover() {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const titleId = React.useId();
  return {
    anchor,
    titleId,
    show: (event: React.MouseEvent<HTMLElement>) =>
      setAnchor(event.currentTarget),
    close: () => setAnchor(null),
    props: {
      open: Boolean(anchor),
      anchorEl: anchor,
      onClose: () => setAnchor(null),
      anchorOrigin: { vertical: "bottom", horizontal: "left" },
      slotProps: {
        paper: {
          role: "dialog",
          "aria-labelledby": titleId,
          sx: popoverPaper,
        },
      },
    } as const,
  };
}

/**
 * A rule chip (decision 18): names a grammar note and opens it, its title,
 * text and sources from `grammar.md`.
 */
function RuleChip({ id }: { id: RuleId }) {
  const { notes } = React.useContext(Context);
  const note = notes[id];
  const popover = usePopover();
  return (
    <>
      <button
        type="button"
        className="tr-rule"
        aria-haspopup="dialog"
        aria-expanded={Boolean(popover.anchor)}
        aria-label={LABELS.ruleName(id, note?.title)}
        onClick={popover.show}
      >
        {LABELS.rule(id)}
      </button>
      <Popover {...popover.props}>
        <div className="pop-title" id={popover.titleId}>
          {note ? `${id}. ${note.title}` : id}
        </div>
        {note && <p>{note.text}</p>}
        {note && note.sources.length > 0 && (
          <p className="pop-sources">
            {LABELS.sources} {note.sources.join("; ")}
          </p>
        )}
      </Popover>
    </>
  );
}

/** Where a form comes from, in a few words. */
function sourceText(option: FormOption): string {
  const { source } = option;
  if (source.kind === "keys") return LABELS.source.keys(source.rows);
  if (source.kind === "dictionary")
    return LABELS.source.dictionary(source.work);
  return source.rows.length
    ? LABELS.source.keys(source.rows)
    : LABELS.source.joined(source.joined);
}

/** What opening a form shows: its entries, or Dee's rows for it. */
function openedOf(option: FormOption): Opened {
  const { source } = option;
  return {
    word: option.form,
    entries: option.entries,
    rows:
      source.kind === "dictionary"
        ? []
        : source.kind === "rule"
          ? [...source.rows, ...source.joined]
          : source.rows,
  };
}

/** A form offered beside another: its spelling, opening it, and its source. */
function OptionItem({
  option,
  onOpen,
}: {
  option: FormOption;
  /** Called as it opens, to close the popover it is listed in. */
  onOpen?: () => void;
}) {
  const { open } = React.useContext(Context);
  return (
    <>
      <button
        type="button"
        className="tr-near"
        onClick={() => {
          onOpen?.();
          open(openedOf(option));
        }}
      >
        {option.form}
      </button>
      <span className="pop-source">{sourceText(option)}</span>
    </>
  );
}

/** The mark on a tile with other forms; it lists each with its source. */
function Alternatives({ token }: { token: FormToken }) {
  const popover = usePopover();
  return (
    <>
      <button
        type="button"
        className="tr-near"
        aria-haspopup="dialog"
        aria-expanded={Boolean(popover.anchor)}
        onClick={popover.show}
      >
        {LABELS.alternatives(token.alternatives.length)}
      </button>
      <Popover {...popover.props}>
        <div className="pop-title" id={popover.titleId}>
          {LABELS.alternativesTitle(token.english)}
        </div>
        <ul>
          {token.alternatives.map((option) => (
            <li key={option.form}>
              <OptionItem option={option} onOpen={popover.close} />
            </li>
          ))}
        </ul>
      </Popover>
    </>
  );
}

/** A note a rule put on a tile: what it carries, moved, or read plain. */
function ChipNote({ chip }: { chip: TileChip }) {
  if (chip.kind === "carries")
    return <span>{LABELS.carries(chip.preposition)}</span>;
  return (
    <span>
      {chip.kind === "reordered" ? LABELS.reordered : LABELS.tense(chip.plain)}{" "}
      <RuleChip id={chip.rule} />
    </span>
  );
}

/** A key for a tile's chip: a tile has at most one of each kind and rule. */
const chipKey = (chip: TileChip) =>
  `${chip.kind}-${chip.kind === "carries" ? chip.preposition : chip.rule}`;

/** The form, its script and its English, which opens the word. */
function FormButton({
  form,
  english,
  onOpen,
}: {
  form: string;
  english: React.ReactNode;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="tr-open" onClick={onOpen}>
      <span className="tr-form">{form}</span>
      <span className="tr-script" style={EnochianFont.style} aria-hidden>
        {form}
      </span>
      <span className="tr-english">{english}</span>
    </button>
  );
}

/** One item of English into Enochian: a form, a rule chip or a gap. */
function EnochianTile({ token }: { token: EnochianToken }) {
  const { open } = React.useContext(Context);
  const contraction = token.contraction && (
    <span>{LABELS.contraction(token.contraction)}</span>
  );
  if (token.kind === "chip")
    return (
      <li className="tr-tile tr-chip">
        <span className="tr-form tr-marker">{LABELS.leftOut}</span>
        <span className="tr-english">{token.english}</span>
        <span className="tr-meta">
          <RuleChip id={token.rule} />
          {contraction}
        </span>
      </li>
    );
  if (token.kind === "gap")
    return (
      <li className="tr-tile tr-gap">
        <span className="tr-form tr-marker">{LABELS.gap}</span>
        <span className="tr-english">{token.english}</span>
        {(token.nearest.length > 0 ||
          token.chips.length > 0 ||
          contraction) && (
          <span className="tr-meta">
            {token.nearest.length > 0 && <span>{LABELS.nearest}</span>}
            {token.nearest.map((option) => (
              <span key={option.form}>
                <OptionItem option={option} />
              </span>
            ))}
            {token.chips.map((chip) => (
              <ChipNote key={chipKey(chip)} chip={chip} />
            ))}
            {contraction}
          </span>
        )}
      </li>
    );
  const inKeysToo = token.source.kind === "dictionary" && token.source.inKeys;
  return (
    <li className="tr-tile">
      <FormButton
        form={token.form}
        english={token.english}
        onOpen={() => open(openedOf(token))}
      />
      <span className="tr-meta">
        <span>{sourceText(token)}</span>
        {inKeysToo && <span>{LABELS.inKeysToo}</span>}
        {token.tier !== undefined && token.tier > 1 && (
          <span>{LABELS.tier(token.tier as 2 | 3)}</span>
        )}
        {token.rule && (
          <span>
            {LABELS.byRule} <RuleChip id={token.rule} />
          </span>
        )}
        {token.chips.map((chip) => (
          <ChipNote key={chipKey(chip)} chip={chip} />
        ))}
        {contraction}
        {token.alternatives.length > 0 && <Alternatives token={token} />}
      </span>
    </li>
  );
}

/** Our division of Dee's English, marked by text, not colour alone. */
function Ours({ text }: { text: string }) {
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
function ReadingLine({ line }: { line: readonly LineSegment[] }) {
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
      <span className="tr-line-label">{label}</span>
      {groups.map((group, index) => (
        <React.Fragment key={group.from}>
          {index > 0 && " "}
          {group.dee || !mixed ? (
            pieces(group.from, group.to)
          ) : (
            <span className="tr-wbw">
              <span className="tr-tag">{LABELS.wordByWord}</span>
              {pieces(group.from, group.to)}
            </span>
          )}
        </React.Fragment>
      ))}
    </p>
  );
}

/** How a reading came: Dee's place, a source's form, or a split by rule. */
function ViaNote({ reading }: { reading: Reading }) {
  const first = reading.words[0];
  switch (reading.via) {
    case "keys":
      return <span>{LABELS.via.keys(first?.rows ?? [])}</span>;
    case "gd":
      return <span>{LABELS.via.gd}</span>;
    case "leitch":
      return <span>{LABELS.via.leitch(reading.leitchPage)}</span>;
    case "dictionary":
      return <span>{LABELS.via.dictionary(first?.work)}</span>;
    case "split":
      return (
        <span>
          {LABELS.via.split}{" "}
          {reading.rules.map((rule, at) => (
            <React.Fragment key={rule}>
              {at > 0 && " "}
              <RuleChip id={rule} />
            </React.Fragment>
          ))}
        </span>
      );
  }
}

/** What opening one of Dee's words (or a headword) shows. */
function openedOfWord(word: ReadWord): Opened {
  return {
    word: word.word,
    entries: word.entries,
    rows: word.rows,
    ...(word.notInCasaubon ? { note: LABELS.notInCasaubon } : {}),
  };
}

/** One word (or Golden Dawn form) of Enochian into English. */
function EnglishTile({ token }: { token: ReadToken }) {
  const { open } = React.useContext(Context);
  if (!token.readings.length)
    return (
      <li className="tr-tile tr-gap">
        <span className="tr-form">{token.input}</span>
        <span className="tr-english tr-missing">{LABELS.notFound}</span>
        {token.nearest.length > 0 && (
          <span className="tr-meta">
            {LABELS.nearestSpellings} {token.nearest.join(", ")}
          </span>
        )}
      </li>
    );
  return (
    <li className="tr-tile">
      {token.readings.map((reading, at) => (
        <div
          className="tr-reading"
          // biome-ignore lint/suspicious/noArrayIndexKey: the lookup's own order
          key={at}
        >
          {at > 0 && <span className="tr-or">{LABELS.or}</span>}
          <div className="tr-words">
            {reading.words.map((word, part) => (
              <FormButton
                // biome-ignore lint/suspicious/noArrayIndexKey: a reading's own order
                key={part}
                form={word.word}
                english={
                  word.ours ? (
                    <Ours text={word.gloss} />
                  ) : (
                    word.gloss || (
                      <span className="tr-missing">{LABELS.unknown}</span>
                    )
                  )
                }
                onOpen={() => open(openedOfWord(word))}
              />
            ))}
          </div>
          <span className="tr-meta">
            <ViaNote reading={reading} />
            {reading.words.some((word) => word.notInCasaubon) && (
              <span>{LABELS.notInCasaubon}</span>
            )}
          </span>
        </div>
      ))}
    </li>
  );
}

/**
 * The lookup's limitations, all six (decision 20). The page shows them
 * once: beside the notice when it reads English into Enochian, else after
 * the results.
 */
function Limitations() {
  return (
    <div className="tr-limits-box">
      <h3>{LABELS.limitationsHeading}</h3>
      <ul className="tr-limits">
        {TRANSLATOR_LIMITATIONS.lookup.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * English into Enochian (decisions 5–12, 17): the notice with the
 * limitations beside it, then the tiles, chips and gaps.
 */
function ToEnochianResult({ result }: { result: ToEnochian }) {
  const headingId = React.useId();
  return (
    <section className="tr-result" aria-labelledby={headingId}>
      <h2 id={headingId}>{LABELS.resultsHeading("english")}</h2>
      <div className="tr-caveats">
        <p className="tr-notice" role="note">
          {LABELS.notice}
        </p>
        <Limitations />
      </div>
      <ol className="tr-tiles">
        {result.tokens.map((token) => (
          <EnochianTile key={token.span.join("-")} token={token} />
        ))}
      </ol>
    </section>
  );
}

/**
 * Enochian into English (decisions 13–17): the reading line, then each
 * word's tile, then the limitations unless the other direction shows them.
 */
function ToEnglishResult({
  result,
  limitations,
}: {
  result: ToEnglish;
  /** Show the limitations after the tiles: no English→Enochian beside it. */
  limitations: boolean;
}) {
  const headingId = React.useId();
  return (
    <section className="tr-result" aria-labelledby={headingId}>
      <h2 id={headingId}>{LABELS.resultsHeading("enochian")}</h2>
      <ReadingLine line={result.line} />
      <ol className="tr-tiles">
        {result.tokens.map((token) => (
          <EnglishTile key={token.span.join("-")} token={token} />
        ))}
      </ol>
      {limitations && <Limitations />}
    </section>
  );
}

/** The live region's words: a count of what came back, not the output. */
function summarise({ guess, toEnochian, toEnglish }: Translation): string {
  const kinds = (kind: EnochianToken["kind"]) =>
    toEnochian?.tokens.filter((one) => one.kind === kind).length ?? 0;
  const english =
    toEnochian &&
    LABELS.summary.toEnochian(kinds("form"), kinds("chip"), kinds("gap"));
  const enochian =
    toEnglish &&
    LABELS.summary.toEnglish(
      toEnglish.tokens.filter((one) => one.readings.length).length,
      toEnglish.tokens.filter((one) => !one.readings.length).length,
    );
  return (
    guess.language === "english" ? [english, enochian] : [enochian, english]
  )
    .filter(Boolean)
    .join(" ");
}

/** A word only in the Keys: its rows, each linking to its place. */
function KeyRows({
  opened,
  headingId,
  onClose,
}: {
  opened: Opened;
  headingId: string;
  onClose: () => void;
}) {
  return (
    <Box sx={ENTRY_STYLES}>
      <div className="entry-head">
        <h2 id={headingId}>{opened.word}</h2>
        <span className="entry-script" style={EnochianFont.style}>
          {opened.word}
        </span>
      </div>
      <div className="entry-said">{opened.note ?? LABELS.onlyInKeys}</div>
      {opened.rows.length > 0 && (
        <>
          <h3>{DICTIONARY_LABELS.inTheKeys}</h3>
          <ul className="entry-uses">
            {opened.rows.map((row) => (
              <li key={`${row.key}-${row.row}`}>
                <Link href={keysLink(row)}>{LABELS.via.keys([row])}</Link>
                <div className="entry-quote">
                  {row.split ? (
                    // Dee's words, but where they start and stop is ours.
                    <b>
                      <Ours text={row.english} />
                    </b>
                  ) : (
                    <>
                      {DICTIONARY_LABELS.quoteOpen("")}
                      <b>{row.english}</b>
                      {DICTIONARY_LABELS.quoteClose("")}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="entry-actions">
        <Box sx={{ flex: 1 }} />
        <IconButton aria-label={LABELS.close} onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>
    </Box>
  );
}

/** What a tile opened: each dictionary entry, or the word's Key rows. */
function OpenedView({
  opened,
  headingId,
  onClose,
}: {
  opened: Opened;
  headingId: string;
  onClose: () => void;
}) {
  const keys = opened.entries.filter((key) => Object.hasOwn(dictionary, key));
  if (!keys.length)
    return <KeyRows opened={opened} headingId={headingId} onClose={onClose} />;
  return keys.map((key, at) => (
    <Entry
      key={key}
      word={key}
      entry={dictionary[key]}
      onClose={onClose}
      headingId={at ? `${headingId}-${at}` : headingId}
    >
      <InTheKeys word={key} />
    </Entry>
  ));
}

/**
 * The direction's line beside the boxes (decision 4): what the text is
 * read as, and the switch.
 */
function Guess({
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

/**
 * The translator's tool (see the module's comment): the boxes, the
 * direction, the results and the entry they open. `notes` are the
 * grammar notes its rule chips open, read from `grammar.md` on the server.
 */
export default function Translator({ notes }: { notes: RuleNotes }) {
  const fragment = useTranslateFragment();
  const [text, setText] = React.useState("");
  const [chosen, setChosen] = React.useState<Language | null>(null);
  const [asked, setAsked] = React.useState(false);
  const [opened, setOpened] = React.useState<Opened | null>(null);
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  // A touch screen gets the keypad in place of its own keyboard; read after
  // hydration, so the server's HTML has no `inputmode`.
  const coarse = useMediaQuery("(pointer: coarse)");
  const {
    box: enochianBox,
    keypad,
    setKeypad,
    edit,
  } = useKeypadBox<HTMLTextAreaElement>(text, setText);
  const headingId = React.useId();

  // The fragment fills the boxes on load and on Back or Forward; the boxes
  // write it back after a pause. `inUrl` is null for a fragment that isn't
  // ours (an anchor such as #translator-text), which changes no text.
  // `known` is the fragment the URL last held, read or written (null after
  // an anchor, which no state equals), so a pause writes only a change;
  // `now` is the boxes' state, so a fragment equal to it (our own write) is
  // passed over and any other is taken. A move through history cancels a
  // pending write, which would otherwise land on the entry moved to.
  const { state: inUrl, write } = fragment;
  const known = React.useRef<string | null>("");
  const now = React.useRef("");
  const pending = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const cancel = React.useCallback(() => {
    clearTimeout(pending.current);
    pending.current = undefined;
  }, []);
  React.useLayoutEffect(() => {
    now.current = fragmentOf({ q: text.trim(), dir: chosen });
  });
  /** Takes the URL's state, or notes that it holds an anchor instead. */
  const take = React.useCallback((state: TranslateState | null) => {
    if (!state) {
      known.current = null;
      return;
    }
    known.current = fragmentOf(state);
    if (known.current === now.current) return;
    setText(state.q);
    setChosen(state.dir);
  }, []);
  React.useEffect(() => {
    cancel();
    take(inUrl);
  }, [inUrl, cancel, take]);
  // Back or Forward to an entry whose fragment is the same string changes
  // no snapshot, so `inUrl` alone would miss it.
  React.useEffect(() => {
    const moved = () => {
      cancel();
      take(readFragment(window.location.hash));
    };
    window.addEventListener("popstate", moved);
    window.addEventListener("hashchange", moved);
    return () => {
      window.removeEventListener("popstate", moved);
      window.removeEventListener("hashchange", moved);
    };
  }, [cancel, take]);
  // The boxes' state when this last ran, to tell a change from a re-run.
  const ran = React.useRef("");
  React.useEffect(() => {
    const next = { q: text.trim(), dir: chosen };
    const key = fragmentOf(next);
    const changed = key !== ran.current;
    ran.current = key;
    if (key === known.current) return;
    // After an anchor, only a change is written: a first run on a link
    // to an anchor must not replace it.
    if (known.current === null && !changed) return;
    pending.current = setTimeout(() => {
      pending.current = undefined;
      known.current = fragmentOf(next);
      write(next);
    }, URL_DELAY);
    return cancel;
  }, [text, chosen, write, cancel]);
  /** The switch: written at once, with the text as it stands. */
  const choose = (language: Language | null) => {
    setChosen(language);
    const next = { q: text.trim(), dir: language };
    known.current = fragmentOf(next);
    write(next);
  };

  const trimmed = text.trim();
  const translator = useTranslator(asked || trimmed !== "");
  // The results can lag a keystroke behind the boxes, so typing stays quick.
  const deferred = React.useDeferredValue(trimmed);
  // A text with no words ("?", "123") is no result: no notice, no tiles.
  const translation = React.useMemo(() => {
    if (!translator.translator || !deferred) return null;
    const found = translator.translator.translate(
      deferred,
      chosen ?? undefined,
    );
    const tokens =
      (found.toEnochian?.tokens.length ?? 0) +
      (found.toEnglish?.tokens.length ?? 0);
    return tokens ? found : null;
  }, [translator.translator, deferred, chosen]);
  // The live region speaks once typing pauses, as the URL is written, not
  // at every keystroke.
  const [announced, setAnnounced] = React.useState("");
  React.useEffect(() => {
    const summary = translation ? summarise(translation) : "";
    const timer = setTimeout(() => setAnnounced(summary), URL_DELAY);
    return () => clearTimeout(timer);
  }, [translation]);

  const open = React.useCallback((one: Opened) => setOpened(one), []);
  const close = React.useCallback(() => setOpened(null), []);
  const context = React.useMemo(() => ({ notes, open }), [notes, open]);
  // The sheet keeps what it showed while it slides away.
  const lastOpened = React.useRef<Opened | null>(null);
  if (opened) lastOpened.current = opened;

  const results = translation && (
    <>
      {(translation.guess.language === "english"
        ? (["english", "enochian"] as const)
        : (["enochian", "english"] as const)
      ).map((language) =>
        language === "english"
          ? translation.toEnochian && (
              <ToEnochianResult
                key={language}
                result={translation.toEnochian}
              />
            )
          : translation.toEnglish && (
              <ToEnglishResult
                key={language}
                result={translation.toEnglish}
                limitations={!translation.toEnochian}
              />
            ),
      )}
    </>
  );

  return (
    <Context.Provider value={context}>
      <Box sx={[styles, ruleStyles]}>
        <div
          className="tr-main"
          style={
            keypad && !desktop ? { paddingBottom: KEYPAD_ROOM } : undefined
          }
        >
          <div className="tr-boxes">
            <label className="tr-field">
              <textarea
                className="tr-box"
                aria-label={LABELS.latinBox}
                placeholder={LABELS.latinPlaceholder}
                autoComplete="off"
                spellCheck={false}
                rows={2}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onFocus={() => setAsked(true)}
              />
              <span className="tr-label" aria-hidden>
                {LABELS.latinBox}
              </span>
            </label>
            <label className="tr-field">
              <textarea
                className="tr-box tr-box-enochian"
                aria-label={LABELS.enochianBox}
                autoComplete="off"
                spellCheck={false}
                rows={2}
                inputMode={coarse ? "none" : undefined}
                ref={enochianBox}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setKeypad(false);
                }}
                onFocus={() => {
                  setAsked(true);
                  setKeypad(true);
                }}
                onClick={() => setKeypad(true)}
                onBlur={() => setKeypad(false)}
                style={EnochianFont.style}
              />
              <span className="tr-label" aria-hidden>
                {LABELS.enochianBox}
              </span>
            </label>
          </div>
          {keypad && (
            <Keypad
              docked={!desktop}
              onLetter={(letter) => edit(letter)}
              onBackspace={() => edit(null)}
              onDone={() => enochianBox.current?.blur()}
            />
          )}
          <div className="tr-guess">
            {translation ? (
              <Guess
                translation={translation}
                chosen={chosen}
                onChoose={choose}
              />
            ) : (
              // Also for a text with no words in it, once it is read.
              (!trimmed || translator.status === "ready") && (
                <span>{LABELS.hint}</span>
              )
            )}
          </div>
          <div aria-live="polite" style={visuallyHidden}>
            {announced}
          </div>
          {trimmed && translator.status === "loading" && (
            <p className="tr-status">{LABELS.loading}</p>
          )}
          {translator.status === "failed" && (
            <p className="tr-status" role="alert">
              {LABELS.failed}{" "}
              <button
                type="button"
                className="tr-switch"
                onClick={translator.retry}
              >
                {LABELS.retry}
              </button>
            </p>
          )}
          <div aria-label={LABELS.results} role="region">
            {results}
          </div>
        </div>
        <section
          className="tr-pane"
          aria-labelledby={opened && desktop ? headingId : undefined}
          aria-label={opened && desktop ? undefined : LABELS.choose}
        >
          {desktop && opened ? (
            <OpenedView opened={opened} headingId={headingId} onClose={close} />
          ) : (
            <div className="tr-choose">{LABELS.choose}</div>
          )}
        </section>
        <EntrySheet
          open={!desktop && Boolean(opened)}
          onClose={close}
          headingId={headingId}
        >
          {!desktop && lastOpened.current && (
            <OpenedView
              opened={lastOpened.current}
              headingId={headingId}
              onClose={close}
            />
          )}
        </EntrySheet>
      </Box>
    </Context.Provider>
  );
}
