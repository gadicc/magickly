"use client";
import { ExpandMore } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Container,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Typography,
} from "@mui/material";
import React from "react";
import useEnochianFont, { EnochianFont } from "../useEnochianFont";
import {
  keysOf,
  lookupOf,
  type PageAethyr,
  type PageEntries,
  type PageEntry,
  type PageGdWord,
  type PageKey,
  type PageWord,
} from "./keyPage";

export type EnochianLang = "enochian" | "english" | "both";
export type Version = "dee" | "gd";

const VERSION_TITLES: Record<Version, string> = {
  dee: "Dee's",
  gd: "The Golden Dawn's",
};

/** What the Golden Dawn's version has in place of a word it does not print. */
const MARKER_TEXT = {
  joined: "joined to the word before",
  overlap: "run into the word before",
  absent: "not in this version",
} as const;

/** A word as shown: Dee's, with the Golden Dawn's form when that is shown. */
export interface ShownWord extends PageWord {
  row: number;
  gd?: PageGdWord;
}

/** A Key's words in a version, and on Key 19 for an Aethyr. */
export function shownWords(key: PageKey, version: Version, aethyr: number) {
  const changed = key.aethyrs?.[aethyr];
  const gd = version === "gd" ? key.gd : undefined;
  return key.words.map((word, index): ShownWord => {
    // An Aethyr's word replaces the first's whole, never merges into it.
    const shown: ShownWord = {
      ...(changed?.dee[index] ?? word),
      row: index + 1,
    };
    if (gd) shown.gd = changed?.gd?.[index] ?? gd[index];
    return shown;
  });
}

/** What a word shows in the Enochian: nothing where this version has none. */
const enochian = (word: ShownWord) => (word.gd ? word.gd.word : word.word);

/** Read by a screen reader, not shown. */
const VISUALLY_HIDDEN = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

/** Dee's version shows Crowley's form for this word. */
const isCrowley = (word: ShownWord) =>
  !word.gd && word.from === "equinox1912no8";

/**
 * How the words look, set once on the container rather than on each of
 * the thousand or so buttons: a word is a button that looks like text,
 * yellow when chosen, dotted when its reading is uncertain, and in italic
 * where the form is Crowley's, standing in for a word Casaubon's print lost.
 */
const WORDS_SX = {
  "& .key-text": { textAlign: "justify" },
  "& .key-word": {
    background: "none",
    border: 0,
    padding: 0,
    font: "inherit",
    color: "inherit",
    cursor: "pointer",
    textAlign: "inherit",
  },
  "& .key-word:focus-visible": { outline: "2px solid", outlineOffset: "1px" },
  "& .key-word[aria-pressed=true], & .key-selected": { background: "yellow" },
  "& .key-word[data-uncertain]": { textDecoration: "underline dotted" },
  "& .key-word[data-crowley]": { fontStyle: "italic" },
  "& .key-muted": { color: "#666", fontStyle: "italic" },
} as const;

/** A word to click or tab to, which opens its entry. */
function WordButton({
  word,
  selected,
  onSelect,
  children,
  muted,
  crowley,
}: {
  word: ShownWord;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  muted?: boolean;
  /** The text shown is Crowley's form, in Dee's version. */
  crowley?: boolean;
}) {
  // The note itself is in the word panel, which the button opens.
  const titles = [
    crowley ? "Crowley's form: not in Casaubon's print" : "",
    word.uncertain ? "Uncertain reading" : "",
  ].filter(Boolean);
  return (
    <button
      type="button"
      className={muted ? "key-word key-muted" : "key-word"}
      aria-pressed={selected}
      data-uncertain={word.uncertain ? "" : undefined}
      data-crowley={crowley ? "" : undefined}
      title={titles.length ? titles.join(". ") : undefined}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

function Entry({ dictKey, entry }: { dictKey: string; entry: PageEntry }) {
  return (
    <>
      <tr>
        <td style={{ width: "33%", textAlign: "left" }}>{dictKey}</td>
        <td style={{ width: "33%", textAlign: "center" }}>
          {entry.pronunciation}
        </td>
        <td style={{ width: "33%", textAlign: "right" }}>
          {entry.gematria ? `Gematria ${entry.gematria.join(", ")}` : ""}
        </td>
      </tr>
      {entry.meanings.map((meaning, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the entry's own order
        <tr key={i}>
          <td colSpan={3} style={{ textAlign: "center" }}>
            {meaning.meaning} ({meaning.source}) {meaning.source2}{" "}
            {meaning.note}
          </td>
        </tr>
      ))}
    </>
  );
}

/** The word panel: Dee's word, its entries, the English and any note. */
export function WordPanel({
  entries,
  keyNumber,
  word,
}: {
  entries: PageEntries;
  keyNumber: number;
  word: ShownWord;
}) {
  const lookup = lookupOf(word);
  const parts = lookup ? keysOf(entries, lookup) : undefined;
  const note = word.gd?.note ?? word.note;
  const gdForm = word.gd?.word;
  return (
    <table width="100%">
      <tbody>
        <tr>
          <td style={{ width: "33%", textAlign: "left" }}>
            {lookup ?? "(no Enochian)"}
          </td>
          <td style={{ width: "33%", textAlign: "center" }}>
            {gdForm && gdForm !== lookup ? `Golden Dawn: ${gdForm}` : ""}
          </td>
          <td
            style={{ width: "33%", textAlign: "right", ...EnochianFont.style }}
          >
            {lookup}
          </td>
        </tr>
        {parts?.length === 2 && (
          <tr>
            <td colSpan={3} style={{ textAlign: "center" }}>
              Found as two words: {parts[0]} and {parts[1]}
            </td>
          </tr>
        )}
        {parts?.map((part, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: two parts may share a key
          <Entry key={index} dictKey={part} entry={entries.entries[part]} />
        ))}
        {lookup && !parts && (
          <tr>
            <td colSpan={3} style={{ textAlign: "center" }}>
              Not in the dictionary.
            </td>
          </tr>
        )}
        <tr>
          <td colSpan={3} style={{ textAlign: "center" }}>
            {word.english} (Dee)
          </td>
        </tr>
        {(note || word.uncertain || word.from) && (
          <tr>
            <td colSpan={3} style={{ textAlign: "center" }}>
              {word.uncertain ? "Uncertain reading. " : ""}
              {word.from === "equinox1912no8"
                ? "Crowley's form, from The Equinox: not in Casaubon's print. "
                : ""}
              {note}
            </td>
          </tr>
        )}
        <tr>
          <td colSpan={3}>
            Key {keyNumber}, word {word.row}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export interface Selected {
  key: number;
  row: number;
}

export function KeyText({
  words,
  keyNumber,
  lang,
  enochianFont,
  selected,
  onSelect,
}: {
  words: ShownWord[];
  keyNumber: number;
  lang: EnochianLang;
  enochianFont: boolean;
  selected: Selected | null;
  onSelect: (row: number) => void;
}) {
  const isSelected = (word: ShownWord) =>
    selected?.key === keyNumber && selected.row === word.row;
  const font = enochianFont ? EnochianFont.style : undefined;

  if (lang === "both")
    return (
      <table>
        <tbody>
          {words.map((word) => {
            const shown = enochian(word);
            const marker = word.gd?.marker;
            return (
              <tr
                key={word.row}
                className={isSelected(word) ? "key-selected" : undefined}
              >
                <td>
                  {keyNumber}.{word.row}
                </td>
                <td style={shown ? font : undefined}>
                  {shown || word.unspoken || (marker && marker !== "split") ? (
                    <WordButton
                      word={word}
                      selected={isSelected(word)}
                      onSelect={() => onSelect(word.row)}
                      muted={!shown}
                      crowley={Boolean(shown && isCrowley(word))}
                    >
                      {shown ??
                        (word.unspoken
                          ? "(not spoken)"
                          : `(${MARKER_TEXT[marker as keyof typeof MARKER_TEXT]})`)}
                    </WordButton>
                  ) : (
                    // Nothing to look up: no button with nothing in it.
                    <span className="key-muted">(no Enochian yet)</span>
                  )}
                </td>
                <td>{word.english}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );

  const text = (word: ShownWord) =>
    lang === "english" ? word.english : enochian(word);
  return (
    <div className="key-text" style={lang === "enochian" ? font : undefined}>
      {words.map((word) => {
        const shown = text(word);
        // A word the version leaves out, or joins to another, is not said.
        if (!shown) return null;
        return (
          <React.Fragment key={word.row}>
            <WordButton
              word={word}
              selected={isSelected(word)}
              onSelect={() => onSelect(word.row)}
              crowley={lang === "enochian" && isCrowley(word)}
            >
              {shown}
            </WordButton>{" "}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** The Aethyr picker, for Key 19. */
function AethyrPicker({
  aethyrs,
  aethyr,
  setAethyr,
}: {
  aethyrs: readonly PageAethyr[];
  aethyr: number;
  setAethyr: (n: number) => void;
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <FormControl size="small">
        <InputLabel id="aethyr-select-label">Aethyr</InputLabel>
        <Select
          labelId="aethyr-select-label"
          id="aethyr-select"
          value={aethyr}
          label="Aethyr"
          onChange={(e) => setAethyr(Number(e.target.value))}
        >
          {aethyrs.map((each) => (
            <MenuItem key={each.n} value={each.n}>
              {each.n} {each.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Typography variant="body2" sx={{ mt: 1 }}>
        One Call for all thirty Aethyrs, with the Aethyr's name in it. Dee
        counted them as thirty Calls, 19 to 48, and so the 48 Claves Angelicae.
      </Typography>
    </Box>
  );
}

/** How long a linked Key takes to open before its word is scrolled to. */
const WORD_SCROLL_DELAY = 400;

/** Where a link into the page points (plan 074, decision 9). */
export interface Anchor {
  key: number;
  /** On Key 19: the Aethyr to show. */
  aethyr?: number;
  /** The word to select, by row from 1. */
  row?: number;
}

/**
 * Reads a link's hash: `#key-7`, `#key-7-word-12`, or `#aethyr-3-word-4`
 * for Key 19 as the third Aethyr's call. The dictionary's entries link here.
 */
export function readAnchor(hash: string): Anchor | null {
  const found = /^#(key|aethyr)-(\d+)(?:-word-(\d+))?$/.exec(hash);
  if (!found) return null;
  const n = Number(found[2]);
  const row = found[3] ? Number(found[3]) : undefined;
  const anchor: Anchor =
    found[1] === "aethyr" ? { key: 19, aethyr: n } : { key: n };
  if (row) anchor.row = row;
  return anchor;
}

export default function Keys({
  keys,
  aethyrs,
  entries,
}: {
  keys: readonly PageKey[];
  aethyrs: readonly PageAethyr[];
  entries: PageEntries;
}) {
  const [lang, setLang] = React.useState<EnochianLang>("english");
  const [version, setVersion] = React.useState<Version>("dee");
  const [aethyr, setAethyr] = React.useState(1);
  const { enochianFont, EnochianFontToggle } = useEnochianFont();
  const [selected, setSelected] = React.useState<Selected | null>(null);
  const [expanded, setExpanded] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const hasGd = keys.some((key) => key.gd);

  // A link such as the dictionary's opens its Key, its Aethyr and its word,
  // after hydration and whenever the hash changes.
  React.useEffect(() => {
    // Pending scrolls, cleared if the page goes before they run.
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const follow = () => {
      const anchor = readAnchor(window.location.hash);
      if (!anchor || !keys.some((key) => key.key === anchor.key)) return;
      setExpanded((was) => new Set(was).add(anchor.key));
      if (anchor.aethyr && aethyrs.some((one) => one.n === anchor.aethyr))
        setAethyr(anchor.aethyr);
      if (anchor.row) {
        // A link's row is Dee's, as the dictionary counts it.
        setVersion("dee");
        setSelected({ key: anchor.key, row: anchor.row });
      }
      const header = () => document.getElementById(`key-${anchor.key}-header`);
      frame = requestAnimationFrame(() =>
        header()?.scrollIntoView({ block: "start" }),
      );
      // Once the Key has opened, bring its word into view.
      clearTimeout(timer);
      if (anchor.row)
        timer = setTimeout(
          () =>
            header()
              ?.closest(".MuiAccordion-root")
              ?.querySelector(".key-word[aria-pressed=true]")
              ?.scrollIntoView({ block: "center" }),
          WORD_SCROLL_DELAY,
        );
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => {
      window.removeEventListener("hashchange", follow);
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [keys, aethyrs]);

  // Escape closes the word panel, wherever the focus is.
  React.useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [selected]);

  /** The version a Key is shown in: Dee's where it has no other. */
  const versionOf = (key: PageKey): Version =>
    version === "gd" && key.gd ? "gd" : "dee";
  const selectedKey = selected && keys.find((key) => key.key === selected.key);
  const selectedWord =
    selectedKey &&
    shownWords(selectedKey, versionOf(selectedKey), aethyr)[
      (selected?.row ?? 0) - 1
    ];

  return (
    <>
      <Container sx={{ background: "#fafafa", pt: 1.5 }}>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            alignItems: "center",
          }}
        >
          <FormControl>
            <RadioGroup
              aria-label="Show the Keys in"
              name="keys-language"
              value={lang}
              onChange={(e) => setLang(e.target.value as EnochianLang)}
              row
            >
              <FormControlLabel
                value="english"
                control={<Radio />}
                label="English"
              />
              <FormControlLabel
                value="enochian"
                control={<Radio />}
                label="Enochian"
              />
              <FormControlLabel value="both" control={<Radio />} label="Both" />
            </RadioGroup>
          </FormControl>
          {hasGd && (
            <FormControl size="small">
              <InputLabel id="keys-version-label">Version</InputLabel>
              <Select
                labelId="keys-version-label"
                id="keys-version"
                value={version}
                label="Version"
                onChange={(e) => setVersion(e.target.value as Version)}
              >
                <MenuItem value="dee">Dee's (default)</MenuItem>
                <MenuItem value="gd">The Golden Dawn's</MenuItem>
              </Select>
            </FormControl>
          )}
          {["enochian", "both"].includes(lang) && <EnochianFontToggle />}
        </Box>
      </Container>

      <Container sx={{ background: "#fafafa", ...WORDS_SX }}>
        {keys.map((key) => {
          // A Key without the Golden Dawn's reading shows Dee's, and says so.
          const keyVersion = versionOf(key);
          return (
            <Accordion
              key={key.key}
              expanded={expanded.has(key.key)}
              onChange={(_event, open) =>
                setExpanded((was) => {
                  const next = new Set(was);
                  if (open) next.add(key.key);
                  else next.delete(key.key);
                  return next;
                })
              }
              // Each Key is a section of the page under its h1.
              slotProps={{ heading: { component: "h2" } }}
            >
              <AccordionSummary
                expandIcon={<ExpandMore />}
                aria-controls={`key-${key.key}-content`}
                id={`key-${key.key}-header`}
              >
                <Typography component="span">{key.title}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {key.aethyrs && (
                  <AethyrPicker
                    aethyrs={aethyrs}
                    aethyr={aethyr}
                    setAethyr={setAethyr}
                  />
                )}
                {keyVersion !== version && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    No Golden Dawn reading of this Key yet: Dee's is shown.
                  </Typography>
                )}
                <KeyText
                  words={shownWords(key, keyVersion, aethyr)}
                  keyNumber={key.key}
                  lang={lang}
                  enochianFont={enochianFont}
                  selected={selected}
                  onSelect={(row) =>
                    setSelected(
                      selected?.key === key.key && selected.row === row
                        ? null
                        : { key: key.key, row },
                    )
                  }
                />
                <Typography
                  variant="caption"
                  component="p"
                  sx={{ mt: 2, color: "text.secondary" }}
                >
                  {VERSION_TITLES[keyVersion]} version. {key.checked}
                </Typography>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Container>
      {/* Says politely what opened; the panel itself is not a dialog. */}
      <Box aria-live="polite" sx={VISUALLY_HIDDEN}>
        {selectedWord
          ? `${lookupOf(selectedWord) ?? "No Enochian"}: ${selectedWord.english}. Escape closes.`
          : ""}
      </Box>
      {selectedWord && selected && (
        <Box
          sx={{
            p: 1,
            position: "sticky",
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            color: "#fafafa",
          }}
          onClick={() => setSelected(null)}
        >
          <WordPanel
            entries={entries}
            keyNumber={selected.key}
            word={selectedWord}
          />
        </Box>
      )}
    </>
  );
}
