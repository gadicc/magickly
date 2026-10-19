"use client";

import { GdHall } from "@magick-components/gd/hall/GdHall";
import {
  HALL_PRESETS,
  type HallPreset,
  hallSourceText,
  hallSourceUrl,
} from "@magick-components/gd/hall/presets";
import type { HallNode } from "@magick-components/gd/hall/types";
import Redo from "@mui/icons-material/Redo";
import Undo from "@mui/icons-material/Undo";
import {
  Alert,
  Button,
  ButtonGroup,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  Tooltip,
} from "@mui/material";
import React from "react";
import { GdHallEditor } from "@/doc/gdHallEditor/GdHallEditor";
import { type HallElement, hallRowOf } from "@/doc/gdHallEditor/hallModel";
import { gdHallPug, printHallSource } from "@/doc/gdHallPug";
import { gdHallSource } from "@/doc/gdHallRows";
import RitualSourceEditor from "@/doc/RitualSourceEditor";
import type { RitualSourceDiagnostic } from "@/doc/ritualSourceDiagnostics";
import { validateRitualSemantic } from "@/doc/semantic";
import { useRitualEditorLayout } from "@/doc/useRitualEditorLayout";
import ExportControls from "@/export/ExportControls";
import { copyText } from "@/export/exportRuntime";
import { gdHallArt } from "./art";
import { embedGdHallFonts } from "./exportFonts";
import {
  draftStorage,
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
  hallHistoryReducer,
  initialHistory,
} from "./hallHistory";
import { hallNodeCount, MAX_KEPT_HALL_NODES, tooManyNodes } from "./hallLimits";
import styles from "./hallPlayground.module.css";
import {
  isShareHash,
  MAX_SHARE_FRAGMENT,
  MAX_SHARED_BYTES,
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

/** The old drawing a preset was ported from, as served from `public`. */
export function originalDrawing(preset: HallPreset): string | undefined {
  const file = preset.sources.find((source) => source.kind === "drawing");
  return file && hallSourceUrl(file);
}

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

/** A message above the editor, until the author dismisses or acts on it. */
type Note =
  | { kind: "restored" }
  | { kind: "unreadable-draft" }
  /** `draft`: whether this browser held a draft of its own. */
  | { kind: "shared"; draft: boolean }
  | { kind: "share-failed"; reason: string };

/** Where the page starts: the draft, or the first preset. */
function startingPoint(): {
  entry: HallEntry;
  note: Note | null;
  draft: boolean;
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
      draft: true,
    };
  }
  return {
    entry: presetEntry(HALL_PRESETS[0]),
    draft: false,
    note:
      oversized ||
      reading.status === "corrupt" ||
      reading.status === "oversized"
        ? { kind: "unreadable-draft" }
        : null,
  };
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
 * The `/gd/hall` hall editor (plan 061, stage E): source, visual and
 * split views of one hall, with the ritual editor's source panel and the
 * visual hall editor; presets, undo and redo, a draft in this browser, a
 * share link, export and the hall's Pug.
 */
export default function HallPlayground() {
  const [start] = React.useState(startingPoint);
  const [history, dispatch] = React.useReducer(
    hallHistoryReducer,
    start.entry,
    initialHistory,
  );
  const [note, setNote] = React.useState<Note | null>(() =>
    isShareHash(window.location.hash) ? null : start.note,
  );
  const [mode, chooseMode] = useRitualEditorLayout("split", HALL_LAYOUT_KEY);
  const [replacing, setReplacing] = React.useState<HallPreset | null>(null);
  const [compare, setCompare] = React.useState(false);
  const [draftKept, setDraftKept] = React.useState<
    "saved" | "too-large" | "failed"
  >("saved");
  const [share, setShare] = React.useState<{
    source: string;
    result: ShareFragment | { tooMany: number } | "failed";
  } | null>(null);
  const [status, setStatus] = React.useState("");
  const drawing = React.useRef<SVGSVGElement>(null);
  const present = history.present;
  // Source typed but not yet read (`READ_TYPING`): what the panel shows.
  const [typed, setTyped] = React.useState<string | null>(null);
  const unread = React.useRef<string | null>(null);
  const latestSource = React.useRef(present.source);
  latestSource.current = present.source;
  const latestHall = React.useRef(present);
  latestHall.current = present;
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
  }, []);
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
  // goes. A hall opened from a share link is not written over the draft
  // until it is changed.
  const holdDraft = React.useRef<string | null>(null);
  /** Keeps `entry` as the draft, unless it holds too many nodes. */
  const writeDraft = React.useCallback((entry: HallEntry) => {
    if (entry.source === holdDraft.current) return;
    holdDraft.current = null;
    // Too many nodes to keep (the length `writeHallDraft` checks).
    if (entry.hall && tooManyNodes(entry.hall)) {
      setDraftKept("too-large");
      return;
    }
    setDraftKept(writeHallDraft(draftStorage(), entry.source));
  }, []);
  /** Keeps the hall as it is now as the draft, typing read first. */
  const saveNow = React.useCallback(
    () => writeDraft(readTyped() ?? latestHall.current),
    [readTyped, writeDraft],
  );
  // While typing waits to be read, it is not kept: the hall it gives is,
  // a moment after it is read.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new source only
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (unread.current === null) writeDraft(latestHall.current);
    }, SAVE_DRAFT);
    return () => window.clearTimeout(timer);
  }, [present.source, writeDraft]);
  React.useEffect(() => {
    window.addEventListener("pagehide", saveNow);
    return () => window.removeEventListener("pagehide", saveNow);
  }, [saveNow]);

  // A share link opens its hall, as one step: undo goes back to the draft.
  React.useEffect(() => {
    let current = true;
    const open = async () => {
      const hash = window.location.hash;
      if (!isShareHash(hash)) return;
      let entry: HallEntry;
      try {
        entry = entryOfSource(await readShareHash(hash));
      } catch (error) {
        if (!current) return;
        clearShareHash();
        // `readShareHash` says why in a `ShareLinkError`.
        setNote({ kind: "share-failed", reason: (error as Error).message });
        return;
      }
      if (!current) return;
      clearShareHash();
      if (!entry.hall) {
        setNote({
          kind: "share-failed",
          reason: `its hall does not read (${(entry.diagnostic as RitualSourceDiagnostic).message})`,
        });
        return;
      }
      if (tooManyNodes(entry.hall)) {
        setNote({
          kind: "share-failed",
          reason: `its hall holds more than ${MAX_KEPT_HALL_NODES.toLocaleString("en")} nodes, more than a shared hall may`,
        });
        return;
      }
      holdDraft.current = entry.source;
      readTyped();
      dispatch({ type: "load", entry });
      setNote({ kind: "shared", draft: start.draft });
    };
    open();
    window.addEventListener("hashchange", open);
    return () => {
      current = false;
      window.removeEventListener("hashchange", open);
    };
  }, [start.draft, readTyped]);

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
    setNote(null);
    setCompare(false);
    readTyped();
    dispatch({ type: "load", entry: presetEntry(chosen) });
  };
  const choosePreset = (id: string) => {
    // The picker offers presets only.
    const chosen = HALL_PRESETS.find(
      (candidate) => candidate.id === id,
    ) as HallPreset;
    // Changes would be lost from the draft: ask first.
    if (preset) loadPreset(chosen);
    else setReplacing(chosen);
  };

  /** A visual gesture's hall, refused unless it is valid ritual source. */
  const onVisualChange = React.useCallback(
    (hall: HallElement) => {
      if (!validHall(hall)) return false;
      // A gesture on the hall drawn before typing that is still unread
      // would write over the typing: it is refused, and the typing read.
      const read = readTyped();
      if (read && read.source !== latestSource.current) return false;
      dispatch({ type: "visual", hall });
      return true;
    },
    [readTyped],
  );
  const undo = React.useCallback(() => {
    readTyped();
    dispatch({ type: "undo" });
  }, [readTyped]);
  const redo = React.useCallback(() => {
    readTyped();
    dispatch({ type: "redo" });
  }, [readTyped]);
  const onSourceChange = React.useCallback((source: string) => {
    unread.current = source;
    setTyped(source);
  }, []);

  // Both buttons are enabled only with a hall, and a link, to copy.
  const copyPug = async () => {
    const hall = (readTyped() ?? present).hall;
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

  const original = preset && originalDrawing(preset);
  const shareProblem = !present.hall
    ? "Correct the source to share the hall."
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
    <div className={styles.playground}>
      {note && (
        <Alert
          severity={note.kind === "share-failed" ? "warning" : "info"}
          onClose={() => setNote(null)}
          action={
            note.kind === "restored" ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => loadPreset(HALL_PRESETS[0])}
              >
                Start over
              </Button>
            ) : undefined
          }
        >
          {note.kind === "restored"
            ? "Draft restored."
            : note.kind === "unreadable-draft"
              ? "The draft kept in this browser could not be read, so the editor starts from the Neophyte hall."
              : note.kind === "shared"
                ? note.draft
                  ? "Opened a hall from a share link. Your own draft stays in this browser until you change this hall; Undo goes back to it."
                  : "Opened a hall from a share link. Once you change it, it is kept as a draft in this browser."
                : `This share link could not be opened: ${note.reason}.`}
        </Alert>
      )}
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
        <ButtonGroup size="small" aria-label="Hall editor layout">
          {(
            [
              ["visual", "Visual"],
              ["source", "Pug source"],
              ["split", "Split"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              aria-pressed={displayMode === value}
              disabled={value === "visual" && !shownHall}
              variant={displayMode === value ? "contained" : "outlined"}
              onClick={() => chooseMode(value)}
            >
              {label}
            </Button>
          ))}
        </ButtonGroup>
        {original && (
          <FormControlLabel
            control={
              <Switch
                checked={compare}
                onChange={(event) => setCompare(event.target.checked)}
              />
            }
            label="Compare with the original drawing"
          />
        )}
      </div>
      <div className={styles.panels} data-layout={displayMode}>
        {displayMode !== "visual" && (
          <section
            className={styles.panel}
            aria-label="Temple hall source panel"
          >
            <RitualSourceEditor
              value={typed ?? present.source}
              dialect="pug"
              headerless
              disabled={false}
              label="Temple hall source"
              diagnostic={present.diagnostic}
              header={<h2 className={styles.panelTitle}>Pug source</h2>}
              onChange={onSourceChange}
            />
          </section>
        )}
        {displayMode !== "source" && (
          <section
            className={styles.panel}
            aria-label="Temple hall visual panel"
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
              />
            ) : (
              <p className={styles.empty}>
                Correct the source to see the hall.
              </p>
            )}
          </section>
        )}
      </div>
      {compare && original && preset && (
        <figure className={styles.original}>
          <figcaption>Original drawing</figcaption>
          {/* biome-ignore lint/performance/noImgElement: a static SVG shown as drawn */}
          <img
            src={original}
            alt={`The original drawing of the ${preset.title}`}
          />
        </figure>
      )}
      <section className={styles.share} aria-label="Export and share">
        {row && (
          <div className={styles.exportDrawing} hidden>
            <ExportDrawing hall={row} drawing={drawing} />
          </div>
        )}
        <ExportControls
          target={drawing}
          filename={`gd-hall-${preset?.id ?? "custom"}`}
          prepare={embedGdHallFonts}
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
        <p className={styles.status} role="status">
          {status || shareProblem}
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
