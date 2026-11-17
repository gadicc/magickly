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
import AiReading from "./AiReading";
import {
  fragmentOf,
  readFragment,
  type TranslateState,
  useTranslateFragment,
} from "./fragment";
import type { Hint } from "./hints/format";
import { useHints } from "./hints/load";
import { LABELS } from "./labels";
import { TRANSLATOR_LIMITATIONS } from "./limitations";
import { Guess, Ours, ReadingLine } from "./lineParts";
import { LINE_STYLES } from "./lineStyles";
import { useTranslator } from "./load";
import {
  type EnochianToken,
  type FormOption,
  type FormToken,
  type GapToken,
  glossOptions,
  isContent,
  type KeyPlace,
  type Language,
  type Translator as Lookup,
  type Reading,
  type ReadToken,
  type ReadWord,
  type RuleId,
  type TileChip,
  type ToEnglish,
  type ToEnochian,
  type Translation,
} from "./lookup";
import type { RuleNotes } from "./ruleNotes";
import { firstWords, MAX_WORDS } from "./tokens";

/**
 * The Enochian translator (plan 081, decisions 4, 5 and 17–20): one text
 * in two boxes, Latin letters and the Enochian script; the direction
 * guessed, with a switch; English into Enochian as tiles, rule chips and
 * gaps, and Enochian into English as a reading line and tiles. A tile
 * opens its word's entry beside the results on desktop, or in a sheet on
 * phones, as the dictionary does.
 *
 * The lookup sends nothing: it runs here, the text lives in the URL's
 * fragment, and its one request, for the Keys table, carries none of it.
 * Only the AI reading sends the text, when the reader asks for one, in a
 * request's body (`AiReading`, plan 081 stage 2). The UI words come from
 * `labels.ts`, out of site search's index.
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
  "& .tr-hint-note": { fontStyle: "italic" },
  "& .tr-reading + .tr-reading": {
    borderTop: 1,
    borderColor: "divider",
    pt: 0.5,
    mt: 0.5,
  },
  "& .tr-words": { display: "flex", flexWrap: "wrap", gap: "4px 12px" },
  "& .tr-or": { fontSize: 12, color: "text.secondary" },
  ...LINE_STYLES,
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

/**
 * A note a rule put on a tile: what it carries, moved, or read plain; or
 * a superlative read as its base, a near match no rule explains.
 */
function ChipNote({ chip }: { chip: TileChip }) {
  if (chip.kind === "carries") return <span>{LABELS.carries(chip.word)}</span>;
  if (chip.kind === "base") return <span>{LABELS.base(chip.plain)}</span>;
  return (
    <span>
      {chip.kind === "reordered" ? LABELS.reordered : LABELS.tense(chip.plain)}{" "}
      <RuleChip id={chip.rule} />
    </span>
  );
}

/** A key for a tile's chip: a tile has at most one of each kind and rule. */
const chipKey = (chip: TileChip) =>
  `${chip.kind}-${
    chip.kind === "carries"
      ? chip.word
      : chip.kind === "base"
        ? chip.plain
        : chip.rule
  }`;

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

/** A gap's hint as shown: the gloss, and the forms that open. */
interface ShownHint {
  gloss: string;
  options: readonly FormOption[];
}

/** Whether a gap could take a hint: one content word (plan 081, S11). */
const hintable = (token: EnochianToken): token is GapToken =>
  token.kind === "gap" && token.words.length === 1 && isContent(token.words[0]);

/**
 * A gap's hint (plan 081, S11): the table's gloss for its word, with the
 * forms the lookup shows for that gloss that the table names; none when
 * the table has no row for the word, or the lookup no longer has the
 * gloss.
 */
function hintFor(
  translator: Lookup,
  hints: ReadonlyMap<string, Hint> | undefined,
  token: EnochianToken,
): ShownHint | undefined {
  if (!hints || !hintable(token)) return undefined;
  const hint = hints.get(token.words[0]);
  if (!hint) return undefined;
  const options = glossOptions(translator.lookup, hint.gloss).filter((option) =>
    hint.forms.includes(option.form),
  );
  return options.length ? { gloss: hint.gloss, options } : undefined;
}

/**
 * A gap's hint, beside it and never in its place: "related: RNAH
 * ‘sunrise’", marked as a suggestion. A form opens its entry, as a
 * nearest form does; the translation stays as it is.
 */
function HintNote({ hint }: { hint: ShownHint }) {
  const { open } = React.useContext(Context);
  return (
    <span className="tr-hint">
      {LABELS.gapHint.related}{" "}
      {hint.options.map((option, at) => (
        <React.Fragment key={option.form}>
          {at > 0 && ", "}
          <button
            type="button"
            className="tr-near"
            onClick={() => open(openedOf(option))}
          >
            {option.form}
          </button>
        </React.Fragment>
      ))}{" "}
      {LABELS.gapHint.gloss(hint.gloss)}{" "}
      <span className="tr-hint-note">{LABELS.gapHint.note}</span>
    </span>
  );
}

/** One item of English into Enochian: a form, a rule chip or a gap. */
function EnochianTile({
  token,
  hint,
}: {
  token: EnochianToken;
  /** A gap's hint, when the table has one for it. */
  hint?: ShownHint;
}) {
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
          contraction ||
          hint) && (
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
            {hint && <HintNote hint={hint} />}
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
 * The lookup's limitations, all seven (decision 20). The page shows them
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
 * limitations beside it, then the tiles, chips and gaps, a gap with its
 * hint when the table has one (plan 081, S11; the table is fetched with
 * the first result, gap or none, so the fetch says nothing of the text).
 */
function ToEnochianResult({
  result,
  translator,
}: {
  result: ToEnochian;
  translator: Lookup;
}) {
  const headingId = React.useId();
  const hints = useHints(result);
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
          <EnochianTile
            key={token.span.join("-")}
            token={token}
            hint={hintFor(translator, hints, token)}
          />
        ))}
      </ol>
    </section>
  );
}

/**
 * Enochian into English (decisions 13–17): the reading line, the AI
 * reading's offer or card (stage 2), then each word's tile, then the
 * limitations unless the other direction shows them.
 */
function ToEnglishResult({
  result,
  limitations,
  translator,
  text,
}: {
  result: ToEnglish;
  /** Show the limitations after the tiles: no English→Enochian beside it. */
  limitations: boolean;
  translator: Lookup;
  /** The text the lookup read, which an AI reading sends. */
  text: string;
}) {
  const headingId = React.useId();
  return (
    <section className="tr-result" aria-labelledby={headingId}>
      <h2 id={headingId}>{LABELS.resultsHeading("enochian")}</h2>
      <ReadingLine line={result.line} />
      <AiReading translator={translator} text={text} />
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
  // Only the first `MAX_WORDS` words are read; the fragment keeps all.
  const read = React.useMemo(() => firstWords(deferred), [deferred]);
  // A text with no words ("?", "123") is no result: no notice, no tiles.
  const translation = React.useMemo(() => {
    if (!translator.translator || !read.text) return null;
    const found = translator.translator.translate(
      read.text,
      chosen ?? undefined,
    );
    const tokens =
      (found.toEnochian?.tokens.length ?? 0) +
      (found.toEnglish?.tokens.length ?? 0);
    return tokens ? found : null;
  }, [translator.translator, read.text, chosen]);
  const cut = translation !== null && read.cut;
  // The live region speaks once typing pauses, as the URL is written, not
  // at every keystroke.
  const [announced, setAnnounced] = React.useState("");
  React.useEffect(() => {
    const summary = translation
      ? [summarise(translation), cut && LABELS.cut(MAX_WORDS)]
          .filter(Boolean)
          .join(" ")
      : "";
    const timer = setTimeout(() => setAnnounced(summary), URL_DELAY);
    return () => clearTimeout(timer);
  }, [translation, cut]);

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
          ? translation.toEnochian &&
            translator.translator && (
              <ToEnochianResult
                key={language}
                result={translation.toEnochian}
                translator={translator.translator}
              />
            )
          : translation.toEnglish &&
            translator.translator && (
              <ToEnglishResult
                key={language}
                result={translation.toEnglish}
                limitations={!translation.toEnochian}
                translator={translator.translator}
                text={read.text}
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
          {cut && <p className="tr-status">{LABELS.cut(MAX_WORDS)}</p>}
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
