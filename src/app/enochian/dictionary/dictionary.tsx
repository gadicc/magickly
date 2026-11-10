"use client";

import { Box, SwipeableDrawer, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import dictionary from "magick-data/enochian/dictionary";
import * as React from "react";
import EnochianFont from "../../../components/enochian/enochianFont";
import Entry from "./Entry";
import InTheKeys from "./InTheKeys";
import Keypad from "./Keypad";
import { LABELS } from "./labels";
import {
  buildIndex,
  firstKnownMeaning,
  type Hit,
  highlight,
  searchDictionary,
} from "./search";
import { useDictionaryUrl } from "./urlState";

/**
 * The Enochian dictionary (plan 074): one query in two boxes, Latin and
 * Enochian, searched both ways at once; rows that carry a meaning; and the
 * chosen word's entry in a pane beside the list on desktop, or a sheet over
 * it on phones.
 *
 * With no query the list is every word, which is what the prerendered HTML
 * holds (decision 7). Its UI words come from `labels.ts`, out of site
 * search's index (decision 11).
 */

/** Rows a group shows before "Show all". */
const GROUP_ROWS = 30;
/** How long typing waits before the query is written to the URL. */
const URL_DELAY = 300;
const NO_TERMS: string[] = [];
/** Room left under the list for the docked keypad, so no row hides under it. */
const KEYPAD_ROOM = 240;

/** Every word, with its first known meaning: the list with no query. */
const ALL: Hit[] = Object.entries(dictionary).map(([word, entry]) => ({
  word,
  ...firstKnownMeaning(entry),
  tier: 0,
}));

const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

const styles = {
  display: { md: "grid" },
  gridTemplateColumns: { md: "440px minmax(0, 1fr)" },
  alignItems: "start",
  "& .dict-left": {
    borderRight: { md: 1 },
    borderColor: { md: "divider" },
    minWidth: 0,
  },
  "& .dict-search": {
    position: "sticky",
    top: 0,
    zIndex: 2,
    bgcolor: "background.paper",
    borderBottom: 1,
    borderColor: "divider",
    padding: "12px 16px 8px",
  },
  "& .dict-boxes": {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  "& .dict-box": {
    width: "100%",
    minWidth: 0,
    height: 44,
    padding: "0 12px",
    font: "inherit",
    fontSize: 16,
    color: "text.primary",
    bgcolor: "background.paper",
    border: 1,
    borderColor: "divider",
    borderRadius: 1,
    outline: "none",
    "&:focus": { borderColor: "primary.main", boxShadow: 1 },
  },
  "& .dict-box-enochian": { fontSize: 22, textTransform: "uppercase" },
  "& .dict-labels": {
    display: "flex",
    justifyContent: "space-between",
    gap: 1,
    fontSize: 12,
    color: "text.secondary",
    mt: 0.5,
  },
  "& .dict-group": {
    display: "flex",
    justifyContent: "space-between",
    padding: "14px 16px 6px",
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    color: "primary.main",
  },
  "& .dict-count": { color: "text.secondary", fontWeight: 400 },
  "& .dict-row": {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    columnGap: "12px",
    padding: "8px 16px",
    borderBottom: 1,
    borderColor: "divider",
    cursor: "pointer",
    // Clear of the sticky boxes, and of the docked keypad when it is up.
    scrollMarginTop: 96,
    scrollMarginBottom: "var(--dict-keypad, 0px)",
    "&:hover": { bgcolor: "action.hover" },
    "&[aria-selected=true]": { bgcolor: "action.selected" },
    "&.dict-active": {
      outline: "2px solid",
      outlineColor: "primary.main",
      outlineOffset: -2,
    },
  },
  "& .dict-word": {
    fontWeight: 500,
    letterSpacing: "0.02em",
    overflowWrap: "anywhere",
  },
  "& .dict-script": {
    gridRow: "span 2",
    alignSelf: "center",
    fontSize: 20,
    color: "text.secondary",
  },
  "& .dict-meaning": {
    fontSize: 14,
    color: "text.secondary",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    "& b": { color: "text.primary" },
  },
  "& .dict-unknown": { fontStyle: "italic" },
  "& .dict-source": { fontSize: 11.5 },
  "& .dict-more": {
    padding: "12px 16px",
    color: "primary.main",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    "&.dict-active": { textDecoration: "underline" },
  },
  "& .dict-nothing": { padding: "16px", color: "text.secondary" },
  "& .dict-pane": {
    display: { xs: "none", md: "block" },
    position: "sticky",
    top: 0,
    maxHeight: "100vh",
    overflowY: "auto",
    bgcolor: "action.hover",
    height: "100vh",
  },
  "& .dict-choose": { padding: "32px 40px", color: "text.secondary" },
} as const;

/** One word's row: the word, its script, and a meaning with its source. */
const Row = React.memo(function Row({
  id,
  hit,
  terms,
  selected,
  active,
  onOpen,
}: {
  id: string;
  hit: Hit;
  terms: string[];
  selected: boolean;
  active: boolean;
  onOpen: (word: string) => void;
}) {
  const source =
    hit.meaningIndex >= 0
      ? dictionary[hit.word].meanings[hit.meaningIndex].source
      : "";
  return (
    // The box that owns the list (a combobox) moves through the rows with
    // the arrow keys, so the rows themselves take no focus.
    <div
      id={id}
      role="option"
      aria-selected={selected}
      className={active ? "dict-row dict-active" : "dict-row"}
      onClick={() => onOpen(hit.word)}
    >
      <span className="dict-word">{hit.word}</span>
      <span className="dict-script" style={EnochianFont.style} aria-hidden>
        {hit.word}
      </span>
      {hit.meaning === null ? (
        <span className="dict-meaning dict-unknown">{LABELS.unknown}</span>
      ) : (
        <span className="dict-meaning">
          {highlight(hit.meaning, terms).map((segment, i) =>
            segment.match ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: the text's own order
              <b key={i}>{segment.text}</b>
            ) : (
              segment.text
            ),
          )}
          {source && <span className="dict-source">{` ${source}`}</span>}
        </span>
      )}
    </div>
  );
});

/** A group of rows as the list shows it. */
interface Section {
  id: string;
  title: string;
  hits: Hit[];
  /** Rows beyond the cap, which "Show all" reveals; 0 when all are shown. */
  hidden: number;
}

export default function Dictionary({
  uses,
}: {
  /** How often the Keys say each word, which breaks search's ties. */
  uses: Readonly<Record<string, number>>;
}) {
  const url = useDictionaryUrl();
  const [text, setText] = React.useState("");
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [active, setActive] = React.useState(-1);
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // A touch screen gets the keypad in place of its own keyboard; read after
  // hydration, so the server's HTML has no `inputmode` (decision 2).
  const coarse = useMediaQuery("(pointer: coarse)");
  const idPrefix = React.useId();
  const enochianBox = React.useRef<HTMLInputElement>(null);
  const [keypad, setKeypad] = React.useState(false);
  // Where the caret goes once the keypad's change has rendered.
  const caret = React.useRef<number | null>(null);
  React.useLayoutEffect(() => {
    if (caret.current === null) return;
    enochianBox.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  /** Puts `letter` at the Enochian box's caret, or deletes before it. */
  const edit = (letter: string | null) => {
    const box = enochianBox.current;
    if (!box) return;
    const start = box.selectionStart ?? text.length;
    const end = box.selectionEnd ?? text.length;
    const from =
      letter === null && start === end ? Math.max(0, start - 1) : start;
    caret.current = from + (letter?.length ?? 0);
    setText(text.slice(0, from) + (letter ?? "") + text.slice(end));
  };

  // The URL's query fills the boxes on load and on Back; the boxes write it
  // back after a pause. `written` tells our own writes from the others.
  // Closing an entry keeps what the boxes hold, though the history entry
  // it goes back to may hold an older query.
  const written = React.useRef<string | null>(null);
  const textNow = React.useRef(text);
  textNow.current = text;
  const lastWord = React.useRef<string | null>(null);
  const { setQuery } = url;
  React.useEffect(() => {
    const closed = lastWord.current !== null && url.word === null;
    lastWord.current = url.word;
    if (closed) {
      const kept = textNow.current.trim();
      if (kept !== url.query) {
        written.current = kept;
        setQuery(kept);
      }
      return;
    }
    if (url.query !== written.current) setText(url.query);
  }, [url.query, url.word, setQuery]);
  React.useEffect(() => {
    const trimmed = text.trim();
    if (trimmed === url.query) return;
    const timer = setTimeout(() => {
      written.current = trimmed;
      url.setQuery(trimmed);
    }, URL_DELAY);
    return () => clearTimeout(timer);
  }, [text, url.query, url.setQuery]);

  const index = React.useMemo(() => buildIndex(dictionary, uses), [uses]);
  // The list can lag a keystroke behind the boxes, so typing stays quick.
  const deferred = React.useDeferredValue(text.trim());
  const result = React.useMemo(
    () => (deferred ? searchDictionary(index, deferred) : null),
    [index, deferred],
  );
  // A new query starts with its groups capped and nothing active.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on a new query
  React.useEffect(() => {
    setExpanded({});
    setActive(-1);
  }, [deferred]);

  const sections = React.useMemo((): Section[] => {
    if (!result)
      return [{ id: "all", title: LABELS.allWords, hits: ALL, hidden: 0 }];
    const english = [
      { id: "means", title: LABELS.means(deferred), hits: result.means },
      {
        id: "mentions",
        title: LABELS.mentions(deferred),
        hits: result.mentions,
      },
    ];
    const spelled = [
      { id: "spelled", title: LABELS.spelled(deferred), hits: result.spelled },
    ];
    return [
      { id: "word", title: LABELS.word, hits: result.word },
      ...(result.lead === "english"
        ? [...english, ...spelled]
        : [...spelled, ...english]),
    ]
      .filter((one) => one.hits.length)
      .map((one) => {
        const all = expanded[one.id] || one.hits.length <= GROUP_ROWS;
        return {
          ...one,
          hits: all ? one.hits : one.hits.slice(0, GROUP_ROWS),
          hidden: all ? 0 : one.hits.length - GROUP_ROWS,
        };
      });
  }, [result, deferred, expanded]);

  // What the arrow keys move through: each row, and each "Show all".
  const options = React.useMemo(
    () =>
      sections.flatMap((section) => [
        ...section.hits.map((hit) => ({ word: hit.word, section: section.id })),
        ...(section.hidden ? [{ word: null, section: section.id }] : []),
      ]),
    [sections],
  );
  const optionId = (at: number) => `${idPrefix}-option-${at}`;

  const entry =
    url.word && Object.hasOwn(dictionary, url.word)
      ? dictionary[url.word]
      : undefined;
  const { close } = url;
  // Writes a query still waiting on its pause before the word's history
  // entry is pushed, so going back finds it.
  const open = React.useCallback(
    (key: string) => {
      const trimmed = textNow.current.trim();
      if (trimmed !== url.query) {
        written.current = trimmed;
        setQuery(trimmed);
      }
      url.open(key);
    },
    [url.query, url.open, setQuery],
  );
  const choose = React.useCallback(
    (at: number) => {
      const option = options[at];
      if (!option) return;
      if (option.word) open(option.word);
      else setExpanded((was) => ({ ...was, [option.section]: true }));
    },
    [options, open],
  );

  // Scrolls only when the arrow keys move, not on every render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on `active` alone
  React.useEffect(() => {
    if (active >= 0)
      document.getElementById(optionId(active))?.scrollIntoView({
        block: "nearest",
      });
  }, [active]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((at) => Math.min(at + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((at) => Math.max(at - 1, 0));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(active);
    }
  };

  const listId = `${idPrefix}-list`;
  const headingId = `${idPrefix}-entry`;
  const total = result
    ? new Set(
        [result.word, result.means, result.mentions, result.spelled]
          .flat()
          .map((hit) => hit.word),
      ).size
    : ALL.length;
  const entryOf = (word: string) => (
    <Entry
      key={word}
      word={word}
      entry={dictionary[word]}
      onClose={close}
      headingId={headingId}
    >
      <InTheKeys word={word} />
    </Entry>
  );
  const shown = entry && url.word ? entryOf(url.word) : null;
  // The sheet keeps its last entry while it slides away.
  const lastShown = React.useRef<string | null>(null);
  if (entry && url.word) lastShown.current = url.word;

  let at = -1;
  return (
    <Box sx={styles}>
      <div
        className="dict-left"
        style={
          keypad && !desktop
            ? ({
                paddingBottom: KEYPAD_ROOM,
                "--dict-keypad": `${KEYPAD_ROOM}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div className="dict-search">
          <div className="dict-boxes">
            <input
              className="dict-box"
              type="search"
              role="combobox"
              aria-label={LABELS.latinBox}
              aria-controls={listId}
              aria-expanded
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? optionId(active) : undefined}
              placeholder={LABELS.latinPlaceholder}
              autoComplete="off"
              spellCheck={false}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <input
              className="dict-box dict-box-enochian"
              type="text"
              aria-label={LABELS.enochianBox}
              autoComplete="off"
              spellCheck={false}
              inputMode={coarse ? "none" : undefined}
              ref={enochianBox}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setKeypad(false);
              }}
              onFocus={() => setKeypad(true)}
              onClick={() => setKeypad(true)}
              onBlur={() => setKeypad(false)}
              style={EnochianFont.style}
            />
          </div>
          <div className="dict-labels" aria-hidden>
            <span>{LABELS.latinBox}</span>
            <span>{LABELS.enochianBox}</span>
          </div>
          {keypad && (
            <Keypad
              docked={!desktop}
              onLetter={(letter) => edit(letter)}
              onBackspace={() => edit(null)}
              onDone={() => enochianBox.current?.blur()}
            />
          )}
        </div>
        <Box component="div" aria-live="polite" sx={visuallyHidden}>
          {result ? LABELS.found(total) : ""}
        </Box>
        <div id={listId} role="listbox" aria-label={LABELS.results}>
          {sections.map((section) => {
            const groupId = `${idPrefix}-${section.id}`;
            return (
              <div key={section.id} role="group" aria-labelledby={groupId}>
                <div className="dict-group" id={groupId} role="presentation">
                  <span>{section.title}</span>
                  <span className="dict-count">
                    {(section.hits.length + section.hidden).toLocaleString(
                      "en",
                    )}
                  </span>
                </div>
                {section.hits.map((hit) => {
                  at++;
                  return (
                    <Row
                      key={hit.word}
                      id={optionId(at)}
                      hit={hit}
                      terms={result?.terms ?? NO_TERMS}
                      selected={hit.word === url.word}
                      active={at === active}
                      onOpen={open}
                    />
                  );
                })}
                {section.hidden > 0 &&
                  (() => {
                    at++;
                    const mine = at;
                    return (
                      <div
                        id={optionId(mine)}
                        role="option"
                        aria-selected={false}
                        className={
                          mine === active
                            ? "dict-more dict-active"
                            : "dict-more"
                        }
                        onClick={() => choose(mine)}
                      >
                        {LABELS.showAll(section.hits.length + section.hidden)}
                      </div>
                    );
                  })()}
              </div>
            );
          })}
        </div>
        {result && !total && (
          <div className="dict-nothing">{LABELS.nothing(deferred)}</div>
        )}
      </div>
      <section
        className="dict-pane"
        aria-labelledby={shown && desktop ? headingId : undefined}
        aria-label={shown && desktop ? undefined : LABELS.choose}
      >
        {desktop && shown ? (
          shown
        ) : (
          <div className="dict-choose">{LABELS.choose}</div>
        )}
      </section>
      <SwipeableDrawer
        anchor="bottom"
        open={!desktop && Boolean(shown)}
        onClose={close}
        onOpen={() => {}}
        disableSwipeToOpen
        transitionDuration={reducedMotion ? 0 : undefined}
        slotProps={{
          paper: {
            role: "dialog",
            "aria-modal": true,
            "aria-labelledby": headingId,
            sx: { borderRadius: "14px 14px 0 0", maxHeight: "85vh" },
          },
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 36,
            height: 4,
            borderRadius: 2,
            bgcolor: "divider",
            mx: "auto",
            mt: 1,
          }}
        />
        {!desktop && lastShown.current && entryOf(lastShown.current)}
      </SwipeableDrawer>
    </Box>
  );
}
