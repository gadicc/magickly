"use client";

import { GdHall } from "@magick-components/gd/hall/GdHall";
import type { Rect } from "@magick-components/gd/hall/layout";
import type { HallArtRegistry } from "@magick-components/gd/hall/types";
import { validateHall } from "@magick-components/gd/hall/validate";
import Add from "@mui/icons-material/Add";
import Check from "@mui/icons-material/Check";
import Redo from "@mui/icons-material/Redo";
import Undo from "@mui/icons-material/Undo";
import {
  Button,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRitualNodeId } from "../ritualNodeIds";
import type { JsonValue } from "../semantic";
import styles from "./gdHallEditor.module.css";
import { HallProperties } from "./HallProperties";
import {
  deleteNode,
  dragScaleNode,
  duplicateNode,
  type HallSelectable,
  type HallView,
  hallNodeName,
  hallView,
  moveNode,
  nudgeNode,
  scalable,
  selectableForPath,
  setNodeAttr,
  stepScaleNode,
} from "./hallEdits";
import {
  doorRect,
  hitRects,
  hitTest,
  objectRect,
  type Point,
  round2,
} from "./hallGeometry";
import {
  type HallElement,
  indexHall,
  insertHallNode,
  normalizeHall,
  removeHallNode,
  rowPathKey,
  updateHallAttrs,
} from "./hallModel";
import {
  type HallPaletteEntry,
  hallPalette,
  insertFromPalette,
} from "./hallPalette";

/** SVG user units per square, as `GdHall` draws. */
const UNIT = 100;
/** A pointer must travel this far, in CSS pixels, before a press drags. */
const DRAG_THRESHOLD = 4;
/** Warnings listed under the drawing; the rest are counted. */
const MAX_WARNINGS = 20;

/** Props of the visual hall editor. */
export interface GdHallEditorProps {
  /**
   * The hall: the semantic `gdHall` element with its subtree and IDs, as
   * ritual source holds it.
   */
  hall: HallElement;
  /** The art the hall is drawn with (the app's `gdHallArt`). */
  art: HallArtRegistry;
  /**
   * Called once per completed gesture (a drag, a key press, a field
   * written, an object added) with the next hall, normalised as
   * `normalizeHall` writes it. The host stores it as one undo step and
   * gives it back as `hall`; until then the editor shows it as sent. A
   * host that cannot take it returns false.
   */
  onChange: (next: HallElement) => boolean | void;
  /** Leaves edit mode: Done, or Escape with nothing selected. */
  onDone: () => void;
  /** The host's undo and redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y). */
  onUndo?: () => void;
  onRedo?: () => void;
  /** False while the host cannot take changes; the editor only shows. */
  editable?: boolean;
  /** IDs for new and copied nodes; the ritual editor's by default. */
  createId?: () => string;
}

type Gesture = {
  kind: "move" | "scale";
  id: string;
  pointerId: number;
  /** The hall as laid out when the gesture began; moves are measured from it. */
  view: HallView;
  startClient: Point;
  start: Point;
  /** CSS pixels per square at the start. */
  pixels: number;
  moved: boolean;
  snap: boolean;
  latest: Point;
};

const CORNERS = [
  ["nw", 0, 0],
  ["ne", 1, 0],
  ["sw", 0, 1],
  ["se", 1, 1],
] as const;

/** The live region's sentence for a position. */
const at = (point: { x?: unknown; y?: unknown }) =>
  [
    point.x === undefined ? undefined : `x ${point.x}`,
    point.y === undefined ? undefined : `y ${point.y}`,
  ]
    .filter(Boolean)
    .join(", ");

/**
 * The visual hall editor (plan 061, decision 11): the hall drawn with
 * selection, moving, scaling, keyboard editing, a properties panel, a
 * palette and the hall's warnings. Host-agnostic: it holds no history
 * and no document, only the hall it is given, and hands every completed
 * gesture to `onChange` as the next hall.
 */
export function GdHallEditor({
  hall,
  art,
  onChange,
  onDone,
  onUndo,
  onRedo,
  editable = true,
  createId = createRitualNodeId,
}: GdHallEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<HallElement | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [gestureKind, setGestureKind] = useState<Gesture["kind"] | null>(null);
  const [paletteAnchor, setPaletteAnchor] = useState<HTMLElement | null>(null);
  const [pixelsPerSquare, setPixelsPerSquare] = useState(30);
  const [coarse, setCoarse] = useState(false);
  const surface = useRef<HTMLDivElement>(null);
  const overlay = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  /**
   * The hall last handed to `onChange`, shown until the host gives back a
   * new `hall`: a host may draw it a frame later (a node view's React
   * renderer does), and the next key press must build on it, not on the
   * hall before it.
   */
  const [sent, setSent] = useState<HallElement | null>(null);
  /** The palette's choice moves the focus to the drawing, not back to Add. */
  const [paletteChosen, setPaletteChosen] = useState(false);
  const frame = useRef<number | null>(null);
  const helpId = useId();

  const committed = useMemo(
    () => hallView(sent ?? hall, art),
    [sent, hall, art],
  );
  const previewView = useMemo(
    () => (preview ? hallView(preview, art) : null),
    [preview, art],
  );
  const view = previewView ?? committed;
  const palette = useMemo(() => hallPalette(art), [art]);
  const selected = selectedId ? view.byId.get(selectedId) : undefined;
  const warnings = useMemo(
    () => (committed.row ? validateHall(committed.row, { art }) : []),
    [committed.row, art],
  );

  // An undo, or the source, can take the selected node away.
  useEffect(() => {
    if (selectedId && !committed.byId.has(selectedId)) setSelectedId(null);
  }, [committed, selectedId]);

  // A new hall from the host replaces whatever was drawn over the old one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a new hall only
  useEffect(() => {
    setPreview(null);
    setSent(null);
  }, [hall]);

  // Handles and hit areas are sized in pixels, whatever the drawing's size.
  useEffect(() => {
    const element = overlay.current;
    const query =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(pointer: coarse)")
        : undefined;
    setCoarse(!!query?.matches);
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const box = committed.resolved?.viewBox;
      const width = element.getBoundingClientRect().width;
      if (box && width > 0) setPixelsPerSquare(width / (box.x1 - box.x0));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [committed.resolved]);

  // Editing starts with the drawing focused, so keys work at once; the
  // last pending frame goes with the editor.
  useEffect(() => {
    surface.current?.focus({ preventScroll: true });
    return () => {
      if (frame.current !== null && frame.current >= 0)
        cancelAnimationFrame(frame.current);
    };
  }, []);

  const focusSurface = useCallback(() => {
    surface.current?.focus({ preventScroll: true });
  }, []);

  /** Hands a completed gesture's hall to the host, once. */
  const commit = useCallback(
    (next: HallElement, message: string, select?: string | null) => {
      setPreview(null);
      if (select !== undefined) setSelectedId(select);
      if (next === committed.hall || next === view.hall) return;
      const normal = normalizeHall(next, art);
      // A host that refuses the change says so; the hall stays as it was.
      if (onChange(normal) === false) return;
      setSent(normal);
      setAnnouncement(message);
    },
    [committed.hall, view.hall, art, onChange],
  );

  const select = useCallback((entry: HallSelectable | undefined) => {
    setSelectedId(entry?.id ?? null);
    setAnnouncement(entry ? `Selected ${hallNodeName(entry.node)}` : "");
  }, []);

  const toSquares = (clientX: number, clientY: number): Point | null => {
    const box = view.resolved?.viewBox;
    const element = overlay.current;
    if (!box || !element) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: box.x0 + ((clientX - rect.left) / rect.width) * (box.x1 - box.x0),
      y: box.y0 + ((clientY - rect.top) / rect.height) * (box.y1 - box.y0),
    };
  };

  /** The gesture's hall for the pointer at `latest`. */
  const gestureHall = (current: Gesture): HallElement => {
    const delta = {
      x: (current.latest.x - current.startClient.x) / current.pixels,
      y: (current.latest.y - current.startClient.y) / current.pixels,
    };
    if (current.kind === "move")
      return moveNode(current.view, current.id, delta, current.snap);
    return dragScaleNode(current.view, current.id, current.start, {
      x: current.start.x + delta.x,
      y: current.start.y + delta.y,
    });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!editable || (event.pointerType === "mouse" && event.button !== 0))
      return;
    focusSurface();
    const point = toSquares(event.clientX, event.clientY);
    const box = view.resolved?.viewBox;
    const rect = overlay.current?.getBoundingClientRect();
    if (!point || !box || !rect) return;
    const target = event.target as Element;
    const corner = target.closest?.("[data-corner]");
    let kind: Gesture["kind"] = "move";
    let entry: HallSelectable | undefined;
    if (corner && selected && scalable(selected)) {
      kind = "scale";
      entry = selected;
    } else {
      const hit = view.resolved ? hitTest(view.resolved, point) : null;
      const id = hit && view.index.byRowPath.get(rowPathKey(hit.path));
      entry = id ? view.byId.get(id) : undefined;
      if (entry?.id !== selectedId) select(entry);
    }
    if (!entry) return;
    // No text selection, no compatibility mouse events for ProseMirror.
    event.preventDefault();
    surface.current?.setPointerCapture?.(event.pointerId);
    gesture.current = {
      kind,
      id: entry.id,
      pointerId: event.pointerId,
      view,
      startClient: { x: event.clientX, y: event.clientY },
      start: point,
      pixels: rect.width / (box.x1 - box.x0),
      moved: false,
      snap: !event.altKey,
      latest: { x: event.clientX, y: event.clientY },
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.latest = { x: event.clientX, y: event.clientY };
    current.snap = !event.altKey;
    if (
      !current.moved &&
      Math.hypot(
        event.clientX - current.startClient.x,
        event.clientY - current.startClient.y,
      ) < DRAG_THRESHOLD
    )
      return;
    if (!current.moved) {
      current.moved = true;
      setGestureKind(current.kind);
    }
    // One layout per frame, however fast the pointer reports.
    if (frame.current !== null) return;
    // Pending until the frame runs, which may be at once.
    frame.current = -1;
    const id = requestAnimationFrame(() => {
      frame.current = null;
      if (gesture.current === current) setPreview(gestureHall(current));
    });
    if (frame.current === -1) frame.current = id;
  };

  const endGesture = (event: PointerEvent<HTMLDivElement>, cancel: boolean) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    setGestureKind(null);
    if (frame.current !== null) {
      if (frame.current >= 0) cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    if (surface.current?.hasPointerCapture?.(event.pointerId))
      surface.current.releasePointerCapture(event.pointerId);
    if (cancel || !current.moved) {
      setPreview(null);
      return;
    }
    current.latest = { x: event.clientX, y: event.clientY };
    const next = gestureHall(current);
    const entry = current.view.byId.get(current.id) as HallSelectable;
    commit(
      next,
      current.kind === "move" ? moved(entry, next) : scaled(entry, next),
    );
  };

  const nudge = (entry: HallSelectable, step: Point) => {
    const next = nudgeNode(view, entry.id, step);
    commit(next, moved(entry, next));
  };

  const scaleStep = (entry: HallSelectable, up: boolean) => {
    const next = stepScaleNode(view, entry.id, up);
    commit(next, scaled(entry, next));
  };

  const remove = (entry: HallSelectable) => {
    commit(
      deleteNode(view, entry.id),
      `Deleted ${hallNodeName(entry.node)}`,
      null,
    );
    focusSurface();
  };

  const duplicate = (entry: HallSelectable) => {
    const copy = duplicateNode(view, entry.id, createId);
    if (!copy) return;
    commit(copy.hall, `Duplicated ${hallNodeName(entry.node)}`, copy.id);
    focusSurface();
  };

  const add = (entry: HallPaletteEntry) => {
    setPaletteChosen(true);
    setPaletteAnchor(null);
    if (!view.resolved) return;
    const inserted = insertFromPalette(
      view.hall,
      view.resolved,
      entry,
      selectedId ?? undefined,
      createId,
    );
    commit(inserted.hall, `Added ${entry.label}`, inserted.id);
    focusSurface();
  };

  const setAttr = (id: string, name: string, value: JsonValue | undefined) =>
    commit(
      setNodeAttr(view, id, name, value),
      value === undefined ? `Removed ${name}` : `Set ${name} to ${value}`,
    );

  const setCaption = (text: string | undefined) => {
    const caption = view.hall.children?.find(
      (child): child is HallElement =>
        child.kind === "element" && child.tag === "caption",
    );
    if (caption)
      commit(
        text === undefined
          ? removeHallNode(view.hall, caption.id)
          : updateHallAttrs(view.hall, caption.id, { text }),
        text === undefined ? "Removed the caption" : "Set the caption",
      );
    else if (text !== undefined)
      commit(
        insertHallNode(view.hall, view.hall.id, {
          kind: "element",
          id: createId(),
          tag: "caption",
          attrs: { text },
          children: [],
        }),
        "Set the caption",
      );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key;
    if (modifier && (key === "z" || key === "Z" || key === "y")) {
      event.preventDefault();
      if (key === "y" || event.shiftKey) onRedo?.();
      else onUndo?.();
      return;
    }
    if (key === "Escape") {
      event.preventDefault();
      if (selectedId) select(undefined);
      else onDone();
      return;
    }
    if (key === "Tab" && !modifier && !event.altKey) {
      const list = view.selectables;
      const index = selected ? list.indexOf(selected) : -1;
      const next = event.shiftKey
        ? index > 0
          ? list[index - 1]
          : undefined
        : list[index + 1];
      // Past either end, Tab leaves the drawing for the toolbar or panel.
      if (!next || (event.shiftKey && index < 0)) return;
      event.preventDefault();
      select(next);
      return;
    }
    if (!selected || !editable) return;
    const step = event.shiftKey ? 1 : 0.5;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    if (key in moves && !modifier) {
      event.preventDefault();
      nudge(selected, moves[key]);
    } else if ((key === "+" || key === "=") && !modifier) {
      event.preventDefault();
      scaleStep(selected, true);
    } else if ((key === "-" || key === "_") && !modifier) {
      event.preventDefault();
      scaleStep(selected, false);
    } else if ((key === "Delete" || key === "Backspace") && !modifier) {
      event.preventDefault();
      remove(selected);
    } else if (modifier && (key === "d" || key === "D")) {
      event.preventDefault();
      duplicate(selected);
    }
  };

  const box = view.resolved?.viewBox;
  const handleMark = (coarse ? 16 : 10) / pixelsPerSquare;
  const handleHit = (coarse ? 40 : 22) / pixelsPerSquare;
  const selectedRect = selected?.object
    ? objectRect(selected.object)
    : selected?.door && view.resolved
      ? doorRect(selected.door, view.resolved.outer)
      : undefined;

  // On a touch screen a finger-sized handle would cover a small object
  // and take its drags: such objects scale from the panel instead (plan
  // 050's rule for small handles).
  const roomForHandles =
    !!selectedRect &&
    (!coarse ||
      Math.min(
        selectedRect.x1 - selectedRect.x0,
        selectedRect.y1 - selectedRect.y0,
      ) >=
        1.5 * handleHit);
  const handles =
    editable && selectedRect && scalable(selected) && roomForHandles
      ? CORNERS.map(([corner, fx, fy]) => {
          // Just outside the corner, so a small object stays draggable.
          const cx =
            (fx ? selectedRect.x1 : selectedRect.x0) +
            (fx ? 1 : -1) * (handleMark / 2);
          const cy =
            (fy ? selectedRect.y1 : selectedRect.y0) +
            (fy ? 1 : -1) * (handleMark / 2);
          return {
            corner,
            mark: square(cx, cy, handleMark),
            hit: square(cx, cy, handleHit),
          };
        })
      : [];

  return (
    <div className={styles.editor} data-gd-hall-controls>
      <div className={styles.toolbar}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Add fontSize="small" />}
          disabled={!editable || !view.resolved}
          aria-haspopup="menu"
          onClick={(event) => {
            setPaletteChosen(false);
            setPaletteAnchor(event.currentTarget);
          }}
        >
          Add
        </Button>
        <Menu
          anchorEl={paletteAnchor}
          open={!!paletteAnchor}
          onClose={() => setPaletteAnchor(null)}
          disableRestoreFocus={paletteChosen}
          slotProps={{
            paper: { sx: { maxHeight: "60vh" } },
            transition: {
              onExited: () => {
                if (paletteChosen) focusSurface();
              },
            },
          }}
        >
          {paletteItems(palette, add)}
        </Menu>
        {onUndo && (
          <Tooltip title="Undo">
            <span>
              <IconButton
                size="small"
                aria-label="Undo"
                disabled={!editable}
                onClick={onUndo}
              >
                <Undo fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {onRedo && (
          <Tooltip title="Redo">
            <span>
              <IconButton
                size="small"
                aria-label="Redo"
                disabled={!editable}
                onClick={onRedo}
              >
                <Redo fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <span className={styles.spacer} />
        <Button
          size="small"
          variant="contained"
          startIcon={<Check fontSize="small" />}
          onClick={onDone}
        >
          Done
        </Button>
      </div>
      <div className={styles.body}>
        <div className={styles.drawingColumn}>
          <div
            ref={surface}
            className={styles.surface}
            role="application"
            aria-roledescription="hall editor"
            aria-label={
              selected
                ? `Temple hall editor, ${hallNodeName(selected.node)} selected`
                : "Temple hall editor"
            }
            aria-describedby={helpId}
            aria-disabled={!editable || undefined}
            tabIndex={0}
            data-gesture={gestureKind ?? undefined}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => endGesture(event, false)}
            onPointerCancel={(event) => endGesture(event, true)}
          >
            {view.row && (
              <GdHall hall={view.row} art={art} className={styles.drawing} />
            )}
            {box && view.resolved && (
              <svg
                ref={overlay}
                className={styles.overlay}
                viewBox={[
                  box.x0 * UNIT,
                  box.y0 * UNIT,
                  (box.x1 - box.x0) * UNIT,
                  (box.y1 - box.y0) * UNIT,
                ].join(" ")}
                aria-hidden="true"
              >
                {selected && selectedRect && (
                  <>
                    {selected.object?.labels.map((label, index) => (
                      <SquareRect
                        // biome-ignore lint/suspicious/noArrayIndexKey: labels keep their order
                        key={index}
                        rect={label.bounds}
                        className={styles.labelHighlight}
                      />
                    ))}
                    <SquareRect
                      rect={selectedRect}
                      className={styles.selection}
                    />
                    {handles.map(({ corner, mark }) => (
                      <SquareRect
                        key={corner}
                        rect={mark}
                        className={styles.handleMark}
                      />
                    ))}
                  </>
                )}
              </svg>
            )}
            {box && editable && (
              // Pointer input lands on HTML boxes over the objects and
              // handles: Chromium honours `touch-action` on them, not on
              // SVG shapes, so a touch on an object drags it while a touch
              // on the empty floor still scrolls the page.
              <div className={styles.hitLayer} aria-hidden="true">
                {view.selectables.map((entry) =>
                  (entry.object
                    ? hitRects(entry.object)
                    : view.resolved && entry.door
                      ? [doorRect(entry.door, view.resolved.outer)]
                      : []
                  ).map((rect, index) => (
                    <HitBox
                      // biome-ignore lint/suspicious/noArrayIndexKey: an object's rects keep their order
                      key={`${entry.id}-${index}`}
                      rect={rect}
                      box={box}
                      className={styles.hit}
                    />
                  )),
                )}
                {handles.map(({ corner, hit }) => (
                  <HitBox
                    key={corner}
                    rect={hit}
                    box={box}
                    className={styles.handle}
                    corner={corner}
                  />
                ))}
              </div>
            )}
          </div>
          <p id={helpId} className={styles.hint}>
            {!editable
              ? "The hall cannot be edited while the ritual is updating."
              : coarse
                ? "Tap to select, drag to move, drag a corner to scale; the panel edits the rest."
                : "Click to select, drag to move (Alt: no snapping), drag a corner to scale. Keys: Tab selects the next object, arrows nudge (Shift: a square), + and − scale, Delete removes, Ctrl+D duplicates, Escape deselects, then finishes."}
          </p>
          {warnings.length > 0 && (
            <Warnings
              view={committed}
              warnings={warnings}
              onSelect={(entry) => {
                select(entry);
                focusSurface();
              }}
            />
          )}
        </div>
        <HallProperties
          view={view}
          selected={selected}
          art={art}
          disabled={!editable}
          onSetAttr={setAttr}
          onSetCaption={setCaption}
          onScaleStep={scaleStep}
          onDuplicate={duplicate}
          onDelete={remove}
        />
      </div>
      <div className={styles.visuallyHidden} aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}

/** The attributes of `entry`'s node in `hall`, rounded for a sentence. */
function attrsIn(
  hall: HallElement,
  entry: HallSelectable,
): Record<string, JsonValue> {
  const node = indexHall(hall).byId.get(entry.id)?.node ?? entry.node;
  return Object.fromEntries(
    Object.entries(node.attrs).map(([name, value]) => [
      name,
      typeof value === "number" ? round2(value) : value,
    ]),
  );
}

/** The live region's sentence for a move: "Moved Hegemon to x 9.5, y 3". */
const moved = (entry: HallSelectable, hall: HallElement) =>
  `Moved ${hallNodeName(entry.node)} to ${at(attrsIn(hall, entry))}`;

/** The live region's sentence for a scale. */
const scaled = (entry: HallSelectable, hall: HallElement) =>
  `Scaled ${hallNodeName(entry.node)} to ${attrsIn(hall, entry).scale}`;

/** A square of `size` centred on a point, in squares. */
const square = (cx: number, cy: number, size: number): Rect => ({
  x0: cx - size / 2,
  y0: cy - size / 2,
  x1: cx + size / 2,
  y1: cy + size / 2,
});

/** A rectangle in squares, drawn in the overlay's user units. */
function SquareRect({ rect, className }: { rect: Rect; className: string }) {
  return (
    <rect
      x={rect.x0 * UNIT}
      y={rect.y0 * UNIT}
      width={(rect.x1 - rect.x0) * UNIT}
      height={(rect.y1 - rect.y0) * UNIT}
      className={className}
    />
  );
}

/** A rectangle in squares as a box over the drawing, placed in percent. */
function HitBox({
  rect,
  box,
  className,
  corner,
}: {
  rect: Rect;
  box: Rect;
  className: string;
  corner?: string;
}) {
  const width = box.x1 - box.x0;
  const height = box.y1 - box.y0;
  const percent = (value: number) => `${value * 100}%`;
  return (
    <div
      className={className}
      data-corner={corner}
      style={{
        left: percent((rect.x0 - box.x0) / width),
        top: percent((rect.y0 - box.y0) / height),
        width: percent((rect.x1 - rect.x0) / width),
        height: percent((rect.y1 - rect.y0) / height),
      }}
    />
  );
}

/** The palette's menu items, grouped. */
function paletteItems(
  palette: readonly HallPaletteEntry[],
  add: (entry: HallPaletteEntry) => void,
) {
  const items: ReactNode[] = [];
  let group: string | undefined;
  for (const entry of palette) {
    if (entry.group !== group) {
      group = entry.group;
      items.push(<ListSubheader key={`group-${group}`}>{group}</ListSubheader>);
    }
    items.push(
      <MenuItem key={entry.key} dense onClick={() => add(entry)}>
        {entry.label}
      </MenuItem>,
    );
  }
  return items;
}

/** The hall's warnings; choosing one selects the object it names. */
function Warnings({
  view,
  warnings,
  onSelect,
}: {
  view: HallView;
  warnings: ReturnType<typeof validateHall>;
  onSelect: (entry: HallSelectable | undefined) => void;
}) {
  const shown = warnings.slice(0, MAX_WARNINGS);
  return (
    <section aria-label="Hall warnings">
      <ul className={styles.warnings}>
        {shown.map((warning, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: warnings keep their order for one hall
          <li key={index}>
            <button
              type="button"
              className={styles.warning}
              data-severity={warning.severity}
              onClick={() => onSelect(selectableForPath(view, warning.path))}
            >
              <span aria-hidden="true">
                {warning.severity === "error" ? "✕" : "⚠"}
              </span>
              <span>{warning.message}</span>
            </button>
          </li>
        ))}
      </ul>
      {warnings.length > shown.length && (
        <p className={styles.hint}>
          {warnings.length - shown.length} more warnings, listed in the source
          view.
        </p>
      )}
    </section>
  );
}
