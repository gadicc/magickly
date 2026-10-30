"use client";

import { GdHall } from "@magick-components/gd/hall/GdHall";
import {
  HALL_PRESETS,
  type HallPreset,
  hallPreset,
  hallSourceText,
  hallSourceUrl,
} from "@magick-components/gd/hall/presets";
import type { HallNode } from "@magick-components/gd/hall/types";
import Apps from "@mui/icons-material/Apps";
import Redo from "@mui/icons-material/Redo";
import Undo from "@mui/icons-material/Undo";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
} from "@mui/material";
import React from "react";
import { GdHallEditor } from "@/doc/gdHallEditor/GdHallEditor";
import { type HallElement, hallRowOf } from "@/doc/gdHallEditor/hallModel";
import { gdHallPug, printHallSource } from "@/doc/gdHallPug";
import { gdHallSource } from "@/doc/gdHallRows";
import linkedCaret from "@/doc/linkedCaret.module.css";
import { RitualLayoutSwitch } from "@/doc/RitualLayoutSwitch";
import RitualSourceEditor from "@/doc/RitualSourceEditor";
import type { RitualSourceDiagnostic } from "@/doc/ritualSourceDiagnostics";
import { validateRitualSemantic } from "@/doc/semantic";
import { useRitualEditorLayout } from "@/doc/useRitualEditorLayout";
import ExportControls from "@/export/ExportControls";
import { copyText } from "@/export/exportRuntime";
import { GD_HALLS, gdHall, gdHallFileBase } from "@/render/contracts/gdHall";
import { gdHallArt } from "../art";
import { hallArtCredit } from "./exportCredit";
import { embedGdHallFonts } from "./exportFonts";
import {
  draftStorage,
  HALL_DRAFT_KEY,
  MAX_HALL_DRAFT,
  readHallDraft,
  writeHallDraft,
} from "./hallDraft";
import {
  canRedo,
  canUndo,
  entryOfHall,
  entryOfSource,
  type HallEntry,
  type HallHistoryAction,
  hallHistoryReducer,
  initialHistory,
} from "./hallHistory";
import { hallNodeCount, MAX_KEPT_HALL_NODES, tooManyNodes } from "./hallLimits";
import styles from "./hallPlayground.module.css";
import { useHallSelectionLink } from "./hallSelectionLink";
import {
  isPresetHash,
  isShareHash,
  MAX_SHARE_FRAGMENT,
  MAX_SHARED_BYTES,
  presetHashSlug,
  readShareHash,
  type ShareFragment,
  shareFragment,
} from "./hallShare";

/** The page's own layout preference (plan 049's, under another key). */
export const HALL_LAYOUT_KEY = "magickli:gd-hall-editor-layout:v1";

/**
 * How long typing in the source rests before it is read as a hall and
 * drawn, as the ritual editor applies its source: the text shows at once,
 * and a large hall is not parsed and laid out at every keystroke.
 */
const READ_TYPING = 200;
/** How long typing in the source pauses before it is one undo step. */
const SETTLE_TYPING = 700;
/** How long the hall rests before the draft is written. */
const SAVE_DRAFT = 400;

/** A fresh copy of a preset: every node with a new ID. */
export const presetEntry = (preset: HallPreset): HallEntry =>
  entryOfHall(gdHallSource(preset.hall));

let presetsByPug: Map<string, HallPreset> | undefined;

/**
 * The preset a hall is an unchanged copy of (its Pug without IDs is the
 * preset's), if any. Undefined for source that holds no hall.
 */
export function matchingPreset(entry: HallEntry): HallPreset | undefined {
  if (!entry.hall) return undefined;
  presetsByPug ??= new Map(
    HALL_PRESETS.map((preset) => [gdHallPug(preset.hall), preset]),
  );
  return presetsByPug.get(printHallSource(entry.hall, { ids: false }));
}

/**
 * Whether a hall the visual editor hands over is valid ritual source, as
 * the ritual editor checks before writing one (`writeHallToAtom`); the
 * editor is told otherwise, and keeps the page's hall.
 */
export const validHall = (hall: HallElement) =>
  validateRitualSemantic({
    format: "magickli-ritual",
    version: 1,
    nodes: [hall],
  }).length === 0;

/**
 * The export's file name: an unchanged preset's is its published image's
 * (`golden-dawn-zelator-1-temple`, plan 062), any other hall's
 * `gd-hall-custom`.
 */
export function exportFilename(preset: HallPreset | undefined): string {
  const hall = preset && GD_HALLS.find((entry) => entry.preset === preset.id);
  return hall ? gdHallFileBase(hall) : "gd-hall-custom";
}

/** A message above the editor, until the author dismisses or acts on it. */
type Note =
  | { kind: "restored" }
  | { kind: "unreadable-draft" }
  /**
   * A hall opened from a share link. `draft`: what this browser held as
   * the link opened: a draft, none, or one that could not be read.
   */
  | {
      kind: "shared";
      draft: "kept" | "none" | "unreadable";
      /** The preset a `#preset=` link opened; a share link's hall otherwise. */
      preset?: string;
    }
  /** A link that did not open; `preset` for a `#preset=` link. */
  | { kind: "share-failed"; reason: string; preset?: boolean }
  /**
   * Another tab wrote a newer draft. `conflict`: this tab has changes of
   * its own too, which are not written over it until the author chooses.
   */
  | { kind: "other-tab"; conflict: boolean };

/** A note's buttons go below its text where both do not fit beside it. */
const NOTE_LAYOUT = {
  flexWrap: "wrap",
  "& .MuiAlert-message": { flex: "1 1 14rem" },
  "& .MuiAlert-action": { ml: "auto", whiteSpace: "nowrap" },
} as const;

/** The longest part of a parser's message a note repeats. */
const MAX_REASON = 120;

/** `text` cut to `MAX_REASON` characters: a link's text is anyone's. */
export const clipped = (text: string) =>
  text.length > MAX_REASON ? `${text.slice(0, MAX_REASON - 1)}…` : text;

/** What a note says. */
function noteText(note: Note): string {
  switch (note.kind) {
    case "restored":
      return "Draft restored.";
    case "unreadable-draft":
      return "The draft kept in this browser could not be read, so the editor starts from the Neophyte hall.";
    case "shared": {
      const opened = note.preset
        ? `Opened the ${note.preset}.`
        : "Opened a hall from a share link.";
      return note.draft === "kept"
        ? `${opened} Your own draft stays in this browser until you change this hall; Undo goes back to the hall you had.`
        : note.draft === "unreadable"
          ? `${opened} The draft kept in this browser could not be read; once you change this hall, it is kept as the draft in its place.`
          : `${opened} Once you change it, it is kept as a draft in this browser.`;
    }
    case "share-failed":
      return `This ${note.preset ? "preset" : "share"} link could not be opened: ${note.reason}.`;
    case "other-tab":
      return note.conflict
        ? "Another tab kept a newer draft while this one has changes of its own. Neither is written over until you choose: load it (Undo brings yours back), or keep yours."
        : "A newer draft from another tab.";
  }
}

/** Where the page starts: the draft, or the first preset. */
function startingPoint(): {
  entry: HallEntry;
  note: Note | null;
} {
  const reading = readHallDraft(draftStorage());
  const entry =
    reading.status === "found" ? entryOfSource(reading.draft.source) : null;
  // A draft this page would not have kept is not restored.
  const oversized = !!entry?.hall && tooManyNodes(entry.hall);
  if (entry && !oversized) {
    return {
      entry,
      note: matchingPreset(entry) ? null : { kind: "restored" },
    };
  }
  return {
    entry: presetEntry(HALL_PRESETS[0]),
    note:
      oversized ||
      reading.status === "corrupt" ||
      reading.status === "oversized"
        ? { kind: "unreadable-draft" }
        : null,
  };
}

/**
 * Keeps `--panels-top` on the panels at their distance from the top of
 * the page, which the source panel's Source-view height subtracts to end
 * at the viewport's foot (`hallPlayground.module.css`). Measured again
 * whenever anything above them can have moved them: a resize of any of
 * their ancestors or of the elements before each (the notes, the
 * toolbar, the page's text), of the window, or the fonts' loading. A
 * dozen or so elements are observed; a measurement that finds the same
 * top changes nothing, so the panel's own resizing settles at once.
 */
function usePanelsTop(panels: React.RefObject<HTMLDivElement | null>) {
  React.useLayoutEffect(() => {
    const element = panels.current;
    if (!element) return;
    let top = "";
    const measure = () => {
      const next = `${Math.round(element.getBoundingClientRect().top + window.scrollY)}px`;
      if (next === top) return;
      top = next;
      element.style.setProperty("--panels-top", top);
    };
    measure();
    // jsdom has no ResizeObserver; the window's resize still measures.
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    for (
      let node = element.parentElement;
      node && node !== document.body;
      node = node.parentElement
    ) {
      observer?.observe(node);
      for (
        let before = node.previousElementSibling;
        before;
        before = before.previousElementSibling
      )
        observer?.observe(before);
    }
    for (
      let before = element.previousElementSibling;
      before;
      before = before.previousElementSibling
    )
      observer?.observe(before);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [panels]);
}

/** The address bar without the share fragment, nothing reloaded. */
function clearShareHash() {
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search,
  );
}

/**
 * The hall the export draws: the drawing alone, without the editor's
 * overlay, drawn again only when the hall changes.
 */
const ExportDrawing = React.memo(function ExportDrawing({
  hall,
  drawing,
}: {
  hall: HallNode;
  drawing: React.Ref<SVGSVGElement>;
}) {
  return <GdHall ref={drawing} hall={hall} art={gdHallArt} />;
});

/**
 * The `/gd/halls/editor` hall editor (plan 061, stage E): source, visual and
 * split views of one hall, with the ritual editor's source panel and the
 * visual hall editor; presets, undo and redo, a draft in this browser, a
 * share link, export and the hall's Pug.
 */
export default function HallPlayground() {
  const [start] = React.useState(startingPoint);
  const [initial] = React.useState(() => initialHistory(start.entry));
  /**
   * The history as of the last action, ahead of the render that draws it:
   * typing read as its wait ends is drawn a task later, and a link that
   * opens, or a page that goes, in between keeps that hall, not the one
   * last drawn.
   */
  const now = React.useRef(initial);
  const [history, setHistory] = React.useState(initial);
  const dispatch = React.useCallback((action: HallHistoryAction) => {
    now.current = hallHistoryReducer(now.current, action);
    setHistory(now.current);
  }, []);
  const [notes, setNotes] = React.useState<readonly Note[]>(() =>
    start.note ? [start.note] : [],
  );
  /** Shows `note` in place of any of the kinds listed. */
  const showNote = React.useCallback(
    (note: Note, replacing: readonly Note["kind"][]) =>
      setNotes((shown) => [
        ...shown.filter(
          (other) =>
            other.kind !== note.kind && !replacing.includes(other.kind),
        ),
        note,
      ]),
    [],
  );
  const [mode, chooseMode] = useRitualEditorLayout("split", HALL_LAYOUT_KEY);
  const [replacing, setReplacing] = React.useState<HallPreset | null>(null);
  const [draftKept, setDraftKept] = React.useState<
    "saved" | "too-large" | "failed"
  >("saved");
  const [share, setShare] = React.useState<{
    source: string;
    result: ShareFragment | { tooMany: number } | "failed";
  } | null>(null);
  const [status, setStatus] = React.useState("");
  const drawing = React.useRef<SVGSVGElement>(null);
  const panels = React.useRef<HTMLDivElement>(null);
  usePanelsTop(panels);
  const present = history.present;
  // Source typed but not yet read (`READ_TYPING`): what the panel shows.
  const [typed, setTyped] = React.useState<string | null>(null);
  const unread = React.useRef<string | null>(null);
  /** The source of the hall drawn, which a visual gesture builds on. */
  const drawnSource = React.useRef(present.source);
  drawnSource.current = present.source;
  /** The hall the last gesture taken gave, which the next may build on. */
  const sentSource = React.useRef<string | null>(null);
  const preset = React.useMemo(() => matchingPreset(present), [present]);

  // The last hall the source held, shown (read-only) while it holds none.
  const lastHall = React.useRef<HallElement | null>(present.hall);
  if (present.hall) lastHall.current = present.hall;
  const shownHall = present.hall ?? lastHall.current;
  const row = React.useMemo(
    () => (shownHall ? hallRowOf(shownHall) : null),
    [shownHall],
  );
  const displayMode = !shownHall && mode === "visual" ? "source" : mode;
  // In split view the source and the drawing select together (plan 063).
  const sourceText = React.useCallback(
    () => unread.current ?? now.current.present.source,
    [],
  );
  const link = useHallSelectionLink({
    linked: displayMode === "split",
    present,
    typed,
    text: sourceText,
  });

  // Typed source is read once typing rests. Anything else the author does
  // reads it first, so it is never lost or undone out of order.
  const readTyped = React.useCallback((): HallEntry | null => {
    const source = unread.current;
    if (source === null) return null;
    unread.current = null;
    setTyped(null);
    const entry = entryOfSource(source);
    dispatch({ type: "typed", entry });
    return entry;
  }, [dispatch]);
  React.useEffect(() => {
    if (typed === null) return;
    const timer = window.setTimeout(readTyped, READ_TYPING);
    return () => window.clearTimeout(timer);
  }, [typed, readTyped]);

  // Typing becomes one undo step once it pauses: each keystroke starts
  // the wait again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: restarts per keystroke
  React.useEffect(() => {
    if (!history.typingFrom) return;
    const timer = window.setTimeout(
      () => dispatch({ type: "settle" }),
      SETTLE_TYPING,
    );
    return () => window.clearTimeout(timer);
  }, [history.typingFrom, present.source]);

  // The draft follows the hall, a moment after it rests, and as the page
  // goes, but only with what this tab changed: a tab left open on an old
  // draft never writes it back over a newer one from another tab. A hall
  // opened from a share link is not written over the draft until it is
  // changed, whatever Undo and Redo do meanwhile.
  /** The draft as this tab last read or wrote it. */
  const synced = React.useRef(start.entry.source);
  /** A shared hall the draft is not written with until it is changed. */
  const holdDraft = React.useRef<string | null>(null);
  /** A newer draft from another tab, until it is loaded or overruled. */
  const otherTab = React.useRef<string | null>(null);
  /** Keeps `entry` as the draft, if this tab changed it. */
  const writeDraft = React.useCallback(
    (entry: HallEntry) => {
      const { source } = entry;
      if (source === synced.current || source === holdDraft.current) return;
      if (otherTab.current !== null) {
        // Both tabs changed the hall: the author chooses which is kept.
        showNote({ kind: "other-tab", conflict: true }, []);
        return;
      }
      // Too many nodes to keep (the length `writeHallDraft` checks).
      if (entry.hall && tooManyNodes(entry.hall)) {
        setDraftKept("too-large");
        return;
      }
      const kept = writeHallDraft(draftStorage(), source);
      if (kept === "saved") {
        synced.current = source;
        holdDraft.current = null;
      }
      setDraftKept(kept);
    },
    [showNote],
  );
  /** Keeps the hall as it is now as the draft, typing read first. */
  const saveNow = React.useCallback(() => {
    readTyped();
    writeDraft(now.current.present);
  }, [readTyped, writeDraft]);
  // While typing waits to be read, it is not kept: the hall it gives is,
  // a moment after it is read.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new source only
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (unread.current === null) writeDraft(now.current.present);
    }, SAVE_DRAFT);
    return () => window.clearTimeout(timer);
  }, [present.source, writeDraft]);
  React.useEffect(() => {
    window.addEventListener("pagehide", saveNow);
    return () => window.removeEventListener("pagehide", saveNow);
  }, [saveNow]);

  // Another tab's draft: offered here, never written over unasked.
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== HALL_DRAFT_KEY || event.newValue === null) return;
      const value = event.newValue;
      const reading = readHallDraft({ getItem: () => value });
      if (reading.status !== "found") return;
      const theirs = reading.draft.source;
      if (theirs === synced.current) return;
      const mine = unread.current ?? now.current.present.source;
      if (theirs === mine) {
        // Both tabs hold the same hall: in step again.
        synced.current = theirs;
        otherTab.current = null;
        setNotes((shown) => shown.filter((note) => note.kind !== "other-tab"));
        return;
      }
      otherTab.current = theirs;
      showNote(
        {
          kind: "other-tab",
          conflict: mine !== synced.current && mine !== holdDraft.current,
        },
        [],
      );
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [showNote]);
  /** Loads the other tab's draft here, as one step: Undo comes back. */
  const loadOtherTab = () => {
    const theirs = otherTab.current;
    if (theirs === null) return;
    otherTab.current = null;
    synced.current = theirs;
    holdDraft.current = null;
    readTyped();
    dispatch({ type: "load", entry: entryOfSource(theirs) });
    setNotes((shown) => shown.filter((note) => note.kind !== "other-tab"));
  };
  /** Keeps this tab's hall as the draft, over the other tab's. */
  const keepThisTab = () => {
    otherTab.current = null;
    setNotes((shown) => shown.filter((note) => note.kind !== "other-tab"));
    saveNow();
  };

  // A share link opens its hall, as one step: undo goes back to the draft.
  React.useEffect(() => {
    let current = true;
    const open = async () => {
      const hash = window.location.hash;
      let entry: HallEntry;
      let preset: HallPreset | undefined;
      if (isPresetHash(hash)) {
        // A hall page's "Open in the editor": the preset, as a fresh copy.
        const slug = presetHashSlug(hash);
        const id = gdHall(slug)?.preset;
        preset = id === undefined ? undefined : hallPreset(id);
        clearShareHash();
        if (!preset) {
          failed(
            `no preset hall is called ${clipped(JSON.stringify(slug))}`,
            true,
          );
          return;
        }
        entry = presetEntry(preset);
      } else if (!isShareHash(hash)) return;
      else
        try {
          entry = entryOfSource(await readShareHash(hash));
        } catch (error) {
          if (!current) return;
          clearShareHash();
          // `readShareHash` says why in a `ShareLinkError`.
          failed(clipped((error as Error).message));
          return;
        }
      if (!current) return;
      clearShareHash();
      if (!entry.hall) {
        failed(
          `its hall does not read (${clipped((entry.diagnostic as RitualSourceDiagnostic).message)})`,
        );
        return;
      }
      if (tooManyNodes(entry.hall)) {
        failed(
          `its hall holds more than ${MAX_KEPT_HALL_NODES.toLocaleString("en")} nodes, more than a shared hall may`,
        );
        return;
      }
      // What this tab changed is kept first, so the note says what the
      // browser holds as the link opens, and Undo comes back to it.
      saveNow();
      const reading = readHallDraft(draftStorage());
      holdDraft.current = entry.source;
      dispatch({ type: "load", entry });
      showNote(
        {
          kind: "shared",
          ...(preset && { preset: preset.title }),
          draft:
            reading.status === "found"
              ? "kept"
              : reading.status === "corrupt" || reading.status === "oversized"
                ? "unreadable"
                : "none",
        },
        ["restored", "unreadable-draft", "share-failed"],
      );
    };
    const failed = (reason: string, preset?: boolean) =>
      showNote({ kind: "share-failed", reason, preset }, ["shared"]);
    open();
    window.addEventListener("hashchange", open);
    return () => {
      current = false;
      window.removeEventListener("hashchange", open);
    };
  }, [saveNow, showNote, dispatch]);

  // The share link for the hall as it is, ready for the click (copying
  // keeps the click's permission only if it starts at once).
  React.useEffect(() => {
    const hall = present.hall;
    if (!hall) return;
    let current = true;
    const timer = window.setTimeout(() => {
      const nodes = hallNodeCount(hall);
      if (nodes > MAX_KEPT_HALL_NODES) {
        setShare({ source: present.source, result: { tooMany: nodes } });
        return;
      }
      shareFragment(printHallSource(hall, { ids: false }))
        .then((result) => {
          if (current) setShare({ source: present.source, result });
        })
        .catch(() => {
          if (current) setShare({ source: present.source, result: "failed" });
        });
    }, 300);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [present]);
  // No link while typed source waits to be read: it would be the last hall's.
  const shared =
    typed === null && share?.source === present.source ? share.result : null;

  // A status belongs to the hall it was about.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a new hall only
  React.useEffect(() => setStatus(""), [present.source]);

  const loadPreset = (chosen: HallPreset) => {
    setReplacing(null);
    // Another tab's draft is still on offer.
    setNotes((shown) => shown.filter((note) => note.kind === "other-tab"));
    readTyped();
    dispatch({ type: "load", entry: presetEntry(chosen) });
  };
  const choosePreset = (id: string) => {
    // The picker offers presets only.
    const chosen = HALL_PRESETS.find(
      (candidate) => candidate.id === id,
    ) as HallPreset;
    // Changes would be lost from the draft: ask first. Typing counts,
    // read or not, drawn or not.
    readTyped();
    if (matchingPreset(now.current.present)) loadPreset(chosen);
    else setReplacing(chosen);
  };

  /** A visual gesture's hall, refused unless it is valid ritual source. */
  const onVisualChange = React.useCallback(
    (hall: HallElement) => {
      if (!validHall(hall)) return false;
      // A gesture builds on the hall drawn. One made after the hall moved
      // on and before it is drawn (typing, unread or just read; a link
      // just opened) would write over that: it is refused, and the typing
      // read. A second change in one event builds on the first, which is
      // not yet drawn either: it is taken.
      readTyped();
      const latest = now.current.present.source;
      if (latest !== drawnSource.current && latest !== sentSource.current)
        return false;
      dispatch({ type: "visual", hall });
      sentSource.current = now.current.present.source;
      return true;
    },
    [readTyped, dispatch],
  );
  const undo = React.useCallback(() => {
    readTyped();
    dispatch({ type: "undo" });
  }, [readTyped, dispatch]);
  const redo = React.useCallback(() => {
    readTyped();
    dispatch({ type: "redo" });
  }, [readTyped, dispatch]);
  const onSourceChange = React.useCallback((source: string) => {
    unread.current = source;
    setTyped(source);
  }, []);

  // Both buttons are enabled only with a hall, and a link, to copy.
  const copyPug = async () => {
    readTyped();
    const { hall } = now.current.present;
    if (!hall) {
      setStatus("Correct the source to copy the hall.");
      return;
    }
    const text = printHallSource(hall, { ids: false });
    try {
      await copyText(text);
      setStatus("Copied the Pug source. Paste it into a ritual's source.");
    } catch {
      setStatus("Could not copy: the browser refused the clipboard.");
    }
  };
  const copyShareLink = async () => {
    const { fragment } = shared as { fragment: string };
    const url = `${window.location.origin}${window.location.pathname}#${fragment}`;
    try {
      await copyText(url);
      setStatus(
        "Copied a link to this hall as it is now. It holds the hall itself; anyone with it can open it.",
      );
    } catch {
      setStatus("Could not copy: the browser refused the clipboard.");
    }
  };

  // Said, not announced: a source is wrong for a moment at many a
  // keystroke, and the source panel announces its own error.
  const sourceProblem =
    !present.hall && !status ? "Correct the source to share the hall." : null;
  const shareProblem = !present.hall
    ? null
    : shared === "failed"
      ? "This browser could not make a share link."
      : shared && "tooLong" in shared
        ? `This hall is too large for a share link (${shared.tooLong.toLocaleString("en")} characters; the most is ${MAX_SHARE_FRAGMENT.toLocaleString("en")}). Copy its Pug source instead.`
        : shared && "tooLarge" in shared
          ? `This hall is too large for a share link (${Math.ceil(shared.tooLarge / 1024).toLocaleString("en")} KB of Pug; the most is ${MAX_SHARED_BYTES / 1024} KB). Copy its Pug source instead.`
          : shared && "tooMany" in shared
            ? `This hall is too large for a share link (${shared.tooMany.toLocaleString("en")} nodes; the most is ${MAX_KEPT_HALL_NODES.toLocaleString("en")}). Copy its Pug source instead.`
            : null;

  return (
    <div className={styles.playground} data-layout={displayMode}>
      {notes.map((note) => (
        <Alert
          key={note.kind}
          sx={NOTE_LAYOUT}
          severity={
            note.kind === "share-failed" ||
            (note.kind === "other-tab" && note.conflict)
              ? "warning"
              : "info"
          }
          onClose={() =>
            setNotes((shown) => shown.filter((other) => other !== note))
          }
          action={
            note.kind === "restored" ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => loadPreset(HALL_PRESETS[0])}
              >
                Start over
              </Button>
            ) : note.kind === "other-tab" ? (
              <>
                <Button color="inherit" size="small" onClick={loadOtherTab}>
                  Load it
                </Button>
                {note.conflict && (
                  <Button color="inherit" size="small" onClick={keepThisTab}>
                    Keep mine
                  </Button>
                )}
              </>
            ) : undefined
          }
        >
          {noteText(note)}
        </Alert>
      ))}
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label="Temple hall editor"
      >
        <TextField
          select
          size="small"
          label="Preset"
          value={preset?.id ?? ""}
          onChange={(event) => choosePreset(event.target.value)}
          className={styles.presetPicker}
          slotProps={{
            select: {
              displayEmpty: true,
              renderValue: (value) =>
                HALL_PRESETS.find((candidate) => candidate.id === value)
                  ?.title ?? "Your hall (changed)",
            },
            inputLabel: { shrink: true },
          }}
        >
          {HALL_PRESETS.map((candidate) => (
            <MenuItem key={candidate.id} value={candidate.id}>
              {candidate.title} ({candidate.grade})
            </MenuItem>
          ))}
        </TextField>
        {/* Browsing is its own page (plan 062's amendment, A5): the
            dropdown is for people who know the hall's name. */}
        <Button
          variant="outlined"
          href="/gd/halls"
          startIcon={<Apps />}
          className={styles.browse}
        >
          Browse halls
        </Button>
        <span>
          <Tooltip title="Undo">
            <span>
              <IconButton
                aria-label="Undo"
                disabled={
                  !canUndo(history) &&
                  (typed === null || typed === present.source)
                }
                onClick={undo}
              >
                <Undo />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo">
            <span>
              <IconButton
                aria-label="Redo"
                disabled={!canRedo(history)}
                onClick={redo}
              >
                <Redo />
              </IconButton>
            </span>
          </Tooltip>
        </span>
        <RitualLayoutSwitch
          label="Hall editor layout"
          value={displayMode}
          onChoose={(next) => {
            link.onLayout(next, displayMode);
            chooseMode(next);
          }}
          isDisabled={(value) => value === "visual" && !shownHall}
        />
      </div>
      <div ref={panels} className={styles.panels} data-layout={displayMode}>
        {displayMode !== "visual" && (
          <section
            className={`${styles.panel} ${styles.sourcePanel} ${linkedCaret.panel}`}
            aria-label="Temple hall source panel"
            data-linked-caret={link.marked || undefined}
            onFocus={link.onSourceFocus}
          >
            <RitualSourceEditor
              fill
              value={typed ?? present.source}
              dialect="pug"
              headerless
              disabled={false}
              label="Temple hall source"
              diagnostic={present.diagnostic}
              header={<h2 className={styles.panelTitle}>Pug source</h2>}
              onChange={onSourceChange}
              cursor={link.cursor}
              onCursor={link.onCursor}
            />
          </section>
        )}
        {displayMode !== "source" && (
          <section
            className={styles.panel}
            aria-label="Temple hall visual panel"
            onFocus={link.onDrawingFocus}
          >
            {shownHall ? (
              <GdHallEditor
                hall={shownHall}
                art={gdHallArt}
                editable={!!present.hall}
                lockedNote="The source has an error: correct it to edit the drawing again."
                historyButtons={false}
                onChange={onVisualChange}
                onUndo={undo}
                onRedo={redo}
                onSelectionChange={link.onSelectionChange}
                selectPath={link.selectPath}
              />
            ) : (
              <p className={styles.empty}>
                Correct the source to see the hall.
              </p>
            )}
          </section>
        )}
      </div>
      <section className={styles.share} aria-label="Export and share">
        {row && (
          <div className={styles.exportDrawing} hidden>
            <ExportDrawing hall={row} drawing={drawing} />
          </div>
        )}
        <ExportControls
          target={drawing}
          filename={exportFilename(preset)}
          prepare={embedGdHallFonts}
          credit={hallArtCredit}
        />
        <div className={styles.shareButtons}>
          <Button
            size="small"
            variant="outlined"
            disabled={!present.hall}
            title="Ritual Pug without IDs, for the top level of a ritual's source; indent it to put the hall in a note"
            onClick={copyPug}
          >
            Copy Pug source
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!shared || shared === "failed" || !("fragment" in shared)}
            onClick={copyShareLink}
          >
            Copy share link
          </Button>
        </div>
        <p className={styles.status}>
          <span role="status">{status || shareProblem}</span>
          {sourceProblem}
        </p>
        {draftKept !== "saved" && (
          <p className={styles.status}>
            {draftKept === "too-large"
              ? `This hall is too large to keep as a draft in this browser: a draft holds at most ${MAX_KEPT_HALL_NODES.toLocaleString("en")} nodes and ${MAX_HALL_DRAFT.toLocaleString("en")} characters.`
              : "This browser is not keeping a draft: its storage is unavailable or full."}
          </p>
        )}
      </section>
      {preset && (
        <section aria-label="Sources">
          <h2 className={styles.panelTitle}>Sources of the {preset.title}</h2>
          <ul className={styles.sources}>
            {preset.sources.map((source) => (
              <li key={hallSourceText(source)}>
                <a href={hallSourceUrl(source)}>{hallSourceText(source)}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Dialog
        open={!!replacing}
        onClose={() => setReplacing(null)}
        aria-labelledby="gd-hall-replace-title"
      >
        <DialogTitle id="gd-hall-replace-title">Replace your hall?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your hall has changes. Loading the {replacing?.title} replaces it
            here and in this browser's draft; Undo brings it back while this
            page stays open.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplacing(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => replacing && loadPreset(replacing)}
          >
            Replace
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
