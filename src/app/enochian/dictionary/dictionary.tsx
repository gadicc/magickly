"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, IconButton, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import dictionary from "magick-data/enochian/dictionary";
import * as React from "react";
import EnochianFont from "@/fonts/enochian";
import { visuallyHidden } from "@/ui/visuallyHidden";
import { LINE_STYLES } from "../translate/lineStyles";
import { wordCount } from "../translate/tokens";
import Entry from "./Entry";
import EntrySheet from "./EntrySheet";
import InTheKeys from "./InTheKeys";
import Keypad from "./Keypad";
import { LABELS } from "./labels";
import PreviewShell, { PreviewBoundary } from "./PreviewShell";
import Related from "./Related";
import SourceName from "./SourceName";
import {
  buildIndex,
  firstKnownMeaning,
  type Hit,
  highlight,
  searchDictionary,
} from "./search";
import { useDictionaryUrl } from "./urlState";
import { useKeypadBox } from "./useKeypadBox";

/**
 * The Enochian dictionary (plan 074): one query in two boxes, Latin and
 * Enochian, searched both ways at once; rows that carry a meaning; and the
 * chosen word's entry in a pane beside the list on desktop, or a sheet over
 * it on phones.
 *
 * On desktop it fills the window below the app bar, and the list and the
 * pane scroll on their own; the pane holds the page's text until a word is
 * chosen. On a phone the page scrolls as one, and an info button shows the
 * text above the list. The text is in the HTML once either way, for search
 * engines and site search, and CSS alone decides where it shows, since
 * which screen it is on is known only after hydration.
 *
 * With no query the list is every word, which is what the prerendered HTML
 * holds (decision 7). Its UI words come from `labels.ts`, out of site
 * search's index (decision 11).
 */

/**
 * The translator's preview as a lazy component: loaded, with the lookup
 * and the Keys, only for a query of `PREVIEW_WORDS` words or more (plan
 * 081, decisions 3 and 19), so the dictionary's own load doesn't grow.
 */
const lazyPreview = () => React.lazy(() => import("./SentencePreview"));
/** The fewest words a query has for the translator's preview. */
const PREVIEW_WORDS = 3;

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

const styles = {
  display: { md: "grid" },
  gridTemplateColumns: { md: "440px minmax(0, 1fr)" },
  gridTemplateRows: { md: "auto minmax(0, 1fr)" },
  gridTemplateAreas: { md: '"search pane" "list pane"' },
  // The window below the bar, though never so short the list vanishes.
  height: { md: "calc(100dvh - var(--app-bar, 64px))" },
  minHeight: { md: 480 },
  "& .dict-left": {
    gridArea: "list",
    borderRight: { md: 1 },
    borderColor: { md: "divider" },
    minWidth: 0,
    overflowY: { md: "auto" },
    // Its end doesn't scroll the window on to the footer; the pane's does.
    overscrollBehavior: { md: "contain" },
  },
  "& .dict-search": {
    gridArea: "search",
    // On a phone it stays at the top as the page scrolls, under the app
    // bar while the bar shows, moving as the bar hides and comes back
    // (`data-app-bar-hidden`, from MyAppBar's HideOnScroll).
    position: { xs: "sticky", md: "static" },
    top: "var(--app-bar, 56px)",
    transition: "top 200ms ease-out",
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
    zIndex: 2,
    bgcolor: "background.paper",
    borderBottom: 1,
    borderColor: "divider",
    // After `borderColor`, whose colour the `1px solid` would reset.
    borderRight: { md: 1 },
    borderRightColor: { md: "divider" },
    padding: "12px 16px 8px",
  },
  "[data-app-bar-hidden] & .dict-search": { top: 0 },
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
    alignItems: "center",
    gap: 1,
    fontSize: 12,
    color: "text.secondary",
    mt: 0.5,
  },
  "& .dict-labels-end": { display: "flex", alignItems: "center", gap: "2px" },
  // A 24px target that doesn't make the row of labels taller.
  "& .dict-info": {
    display: { md: "none" },
    padding: "3px",
    my: "-5px",
    mr: "-3px",
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
    // Clear of the phone's sticky boxes and the bar above them, and of
    // the docked keypad when it is up; on desktop the list scrolls below
    // the boxes.
    scrollMarginTop: { xs: "calc(96px + var(--app-bar, 56px))", md: 0 },
    scrollMarginBottom: "var(--dict-keypad, 0px)",
    "&:hover": { bgcolor: "action.hover" },
    "&[aria-selected=true]": { bgcolor: "action.selected" },
    "&.dict-active": {
      outline: "2px solid",
      outlineColor: "primary.main",
      outlineOffset: -2,
    },
  },
  "[data-app-bar-hidden] & .dict-row": { scrollMarginTop: { xs: 96, md: 0 } },
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
  "& abbr[title]": { textDecoration: "none", cursor: "help" },
  "& .dict-more": {
    padding: "12px 16px",
    color: "primary.main",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    "&.dict-active": { textDecoration: "underline" },
  },
  "& .dict-nothing": { padding: "16px", color: "text.secondary" },
  // The translator's preview: a group of one line and a link.
  "& .dict-preview": { borderBottom: 1, borderColor: "divider" },
  "& .dict-preview-line": {
    ...LINE_STYLES,
    padding: "0 16px",
    // The label's line, two of text and the note under English into
    // Enochian (18 px), kept while it loads, so the frame never grows when
    // the line arrives, whichever way it reads.
    minHeight: 84,
    "& .tr-line": { margin: 0, fontSize: 16 },
    "& .tr-line-label": { minHeight: 18, lineHeight: "18px" },
    // Two lines at most, then an ellipsis; the link opens the whole. The
    // text is only clipped, so screen readers still read all of it.
    "& .tr-line-text": {
      display: "-webkit-box",
      WebkitBoxOrient: "vertical",
      WebkitLineClamp: 2,
      overflow: "hidden",
      lineHeight: "24px",
    },
  },
  // The preview's notes under its line: unreviewed, or cut short.
  "& .dict-preview-note": {
    display: "block",
    margin: 0,
    fontSize: 12,
    lineHeight: "18px",
    color: "text.secondary",
  },
  "& .dict-preview-open": { padding: "4px 16px 10px", fontSize: 14 },
  "& .dict-pane": {
    gridArea: "pane",
    minWidth: 0,
    overflowY: { md: "auto" },
    bgcolor: "action.hover",
  },
  "& .dict-pane-entry": { maxWidth: 760 },
  // The page's text: in the pane on desktop until a word is chosen, and
  // above the list on a phone when its info button is pressed.
  // `flow-root` keeps the text's margins inside its shaded box.
  "& .dict-about": {
    display: { xs: "none", md: "flow-root" },
    borderBottom: { xs: 1, md: 0 },
    // After the border, whose `1px solid` would reset its colour.
    borderBottomColor: { xs: "divider" },
    // Lined up with an entry's text rather than centred in the pane.
    "& > section": { mx: { md: 0 }, px: { md: 5 } },
  },
  "& .dict-about.dict-about-open": { display: "flow-root" },
  "& .dict-about.dict-about-off": { display: { md: "none" } },
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
          {source && (
            <span className="dict-source">
              {" "}
              <SourceName name={source} />
            </span>
          )}
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
  children: about,
}: {
  /** How often the Keys say each word, which breaks search's ties. */
  uses: Readonly<Record<string, number>>;
  /** The page's text, for the pane until a word is chosen. */
  children?: React.ReactNode;
}) {
  const url = useDictionaryUrl();
  const [text, setText] = React.useState("");
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [active, setActive] = React.useState(-1);
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  // A touch screen gets the keypad in place of its own keyboard; read after
  // hydration, so the server's HTML has no `inputmode` (decision 2).
  const coarse = useMediaQuery("(pointer: coarse)");
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  /** Whether a word has been revealed in the list, or opened from it. */
  const revealed = React.useRef(false);
  const paneRef = React.useRef<HTMLElement>(null);
  const idPrefix = React.useId();
  const {
    box: enochianBox,
    keypad,
    setKeypad,
    edit,
  } = useKeypadBox<HTMLInputElement>(text, setText);

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
  // The translator's preview, from three words (plan 081, decision 3). If
  // its code fails to load, React.lazy keeps the failure, so the next
  // query makes a fresh one and tries again.
  const showPreview = React.useMemo(
    () => wordCount(deferred) >= PREVIEW_WORDS,
    [deferred],
  );
  const [SentencePreview, setSentencePreview] = React.useState(lazyPreview);
  const [previewAttempt, setPreviewAttempt] = React.useState(0);
  const previewFailedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    const failed = previewFailedFor.current;
    if (failed === null || failed === deferred) return;
    previewFailedFor.current = null;
    setSentencePreview(lazyPreview);
    setPreviewAttempt((n) => n + 1);
  }, [deferred]);
  const result = React.useMemo(
    () => (deferred ? searchDictionary(index, deferred) : null),
    [index, deferred],
  );
  // A new query starts with its groups capped, nothing active, and the
  // desktop's list at its top.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on a new query
  React.useEffect(() => {
    setExpanded({});
    setActive(-1);
    if (listRef.current) listRef.current.scrollTop = 0;
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
      // A word opened here is in view; only a shared link's is revealed.
      revealed.current = true;
      url.open(key);
    },
    [url.query, url.open, setQuery],
  );
  // A related word opens its entry as a row does; the button it was
  // goes with the old entry, so focus moves to the new one's heading.
  const focusEntry = React.useRef(false);
  const openRelated = React.useCallback(
    (key: string) => {
      focusEntry.current = true;
      open(key);
    },
    [open],
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
      <Related word={word} onOpen={openRelated} />
    </Entry>
  );
  const shown = entry && url.word ? entryOf(url.word) : null;
  const inPane = desktop && Boolean(shown);
  // The sheet keeps its last entry while it slides away.
  const lastShown = React.useRef<string | null>(null);
  if (entry && url.word) lastShown.current = url.word;

  // A shared link's word is shown in the desktop's list once, when its
  // query's results are in, so the list doesn't open far above it.
  React.useEffect(() => {
    if (revealed.current || !desktop || !url.word || deferred !== url.query)
      return;
    revealed.current = true;
    // The list alone: scrollIntoView would move the window as well.
    const list = listRef.current;
    const row = list?.querySelector('[aria-selected="true"]');
    if (!list || !row) return;
    const rowBox = row.getBoundingClientRect();
    list.scrollTop +=
      rowBox.top -
      list.getBoundingClientRect().top -
      (list.clientHeight - rowBox.height) / 2;
  }, [desktop, url.word, url.query, deferred]);

  // Each entry, and the text after one, starts at the pane's top.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on the word alone
  React.useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = 0;
    if (focusEntry.current) {
      focusEntry.current = false;
      document.getElementById(headingId)?.focus({ preventScroll: true });
    }
  }, [url.word]);

  // Escape closes the desktop's entry from anywhere on the page, before
  // the search box's own Escape clears the query; not from the keypad,
  // whose Escape closes it, nor from a menu or dialog elsewhere.
  React.useEffect(() => {
    if (!inPane) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing)
        return;
      const target = event.target as Node;
      if (target !== document.body && !rootRef.current?.contains(target))
        return;
      event.preventDefault();
      close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [inPane, close]);

  const aboutId = `${idPrefix}-about`;
  const toggleAbout = () => {
    // Opened above the list, so it is brought into view.
    if (!aboutOpen) window.scrollTo({ top: 0 });
    setAboutOpen(!aboutOpen);
  };

  let at = -1;
  return (
    <Box sx={styles} ref={rootRef}>
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
              if (event.key !== "Escape") return;
              // Closes the keypad, not the entry as well (see above).
              if (keypad) event.preventDefault();
              setKeypad(false);
            }}
            onFocus={() => setKeypad(true)}
            onClick={() => setKeypad(true)}
            onBlur={() => setKeypad(false)}
            style={EnochianFont.style}
          />
        </div>
        <div className="dict-labels">
          <span aria-hidden>{LABELS.latinBox}</span>
          <span className="dict-labels-end">
            <span aria-hidden>{LABELS.enochianBox}</span>
            <IconButton
              className="dict-info"
              size="small"
              aria-label={LABELS.about}
              aria-expanded={aboutOpen}
              aria-controls={aboutId}
              onClick={toggleAbout}
            >
              <InfoOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
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
      <section
        className="dict-pane"
        ref={paneRef}
        aria-labelledby={inPane ? headingId : undefined}
      >
        {inPane && <div className="dict-pane-entry">{shown}</div>}
        <div
          id={aboutId}
          className={[
            "dict-about",
            aboutOpen && "dict-about-open",
            inPane && "dict-about-off",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {about}
        </div>
      </section>
      <div
        className="dict-left"
        ref={listRef}
        style={
          keypad && !desktop
            ? ({
                paddingBottom: KEYPAD_ROOM,
                "--dict-keypad": `${KEYPAD_ROOM}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div aria-live="polite" style={visuallyHidden}>
          {result ? LABELS.found(total) : ""}
        </div>
        {
          // Outside the listbox, which may hold only options: the preview
          // holds a line and a link (plan 081, decision 3).
          showPreview && (
            <PreviewBoundary
              key={previewAttempt}
              onError={() => {
                previewFailedFor.current = deferred;
              }}
            >
              <React.Suspense fallback={<PreviewShell query={deferred} />}>
                <SentencePreview query={deferred} />
              </React.Suspense>
            </PreviewBoundary>
          )
        }
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
      <EntrySheet
        open={!desktop && Boolean(shown)}
        onClose={close}
        headingId={headingId}
        shown={lastShown.current}
      >
        {!desktop && lastShown.current && entryOf(lastShown.current)}
      </EntrySheet>
    </Box>
  );
}
