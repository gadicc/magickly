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
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
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
  rowDragPreview,
  scalable,
  selectableForPath,
  setNodeAttr,
  stepInRow,
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
  dropTarget,
  type HallDropTarget,
  reparentNode,
  standsOn,
} from "./hallHosts";
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
import { reorderable, rowPlace, spreadRowEvenly } from "./hallRows";

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
   * host that does not take it (refused, or dropped on the way) must
   * return false: the editor then shows the host's hall and says so.
   */
  onChange: (next: HallElement) => boolean | void;
  /** Leaves edit mode: Done, or Escape with nothing selected. */
  onDone: () => void;
  /** The host's undo and redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y). */
  onUndo?: () => void;
  onRedo?: () => void;
  /** False while the host cannot take changes; the editor only shows. */
  editable?: boolean;
  /**
   * Where the focus goes on arriving: the drawing (by default), or the
   * first of the hall's warnings, for an author who asked to see them.
   */
  initialFocus?: "drawing" | "warnings";
  /** IDs for new and copied nodes; the ritual editor's by default. */
  createId?: () => string;
}

/**
 * A pointer gesture: which node it acts on and where it began, never the
 * hall itself. Each preview and the release apply the gesture to the hall
 * the editor holds at that moment, so a field written as the press began,
 * or a hall the host echoes back mid-drag, is built on, not reverted.
 */
type Gesture = {
  kind: "move" | "scale";
  id: string;
  pointerId: number;
  startClient: Point;
  /** Where the press began, in squares (a scale is measured from it). */
  start: Point;
  /** The drawing's view box when the press began, held for the gesture. */
  box: Rect;
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

/** What the author is told when the host does not take a change. */
const REFUSED = "That change was not made; the hall is as it was.";

/** Cut, copy and paste, with Ctrl or Cmd. */
const CLIPBOARD_KEYS = new Set(["x", "c", "v"]);

/**
 * Clears the page's text selection when it lies outside `root`. A text
 * selection left in the ritual stays live under the hall editor's
 * drawing, which is focused but not editable: the browser sends cut,
 * copy and paste (from the keyboard or its menus) to the selection, so
 * Ctrl+X in the hall editor cut ritual text the author could not see.
 * Only the DOM selection goes: ProseMirror keeps its own, and puts it
 * back, without scrolling, when the ritual is focused again.
 */
function clearOutsideSelection(root: Element | null) {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  if (root && selection.anchorNode && root.contains(selection.anchorNode))
    return;
  selection.removeAllRanges();
}

/** Keys that only modify others: they never end or disturb a gesture. */
const MODIFIER_KEYS = new Set(["Alt", "Control", "Meta", "Shift"]);

/** Whether two halls are the same source (an echo of one sent). */
const sameHall = (a: HallElement, b: HallElement) =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

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
  initialFocus = "drawing",
  createId = createRitualNodeId,
}: GdHallEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<HallElement | null>(null);
  const [announcement, setAnnouncement] = useState("");
  /** Why the last change was not made, until the next one is. */
  const [notice, setNotice] = useState<string | null>(null);
  const [gestureKind, setGestureKind] = useState<Gesture["kind"] | null>(null);
  /** The node a running drag moves, for the host it would land on. */
  const [gestureNode, setGestureNode] = useState<string | null>(null);
  /** Where a row child being reordered will land, marked on the drawing. */
  const [slot, setSlot] = useState<Rect | null>(null);
  const [paletteAnchor, setPaletteAnchor] = useState<HTMLElement | null>(null);
  const [pixelsPerSquare, setPixelsPerSquare] = useState(30);
  const [coarse, setCoarse] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const overlay = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  /**
   * The hall last handed to `onChange`, shown until the host gives back a
   * new `hall`: a host may draw it a frame later (a node view's React
   * renderer does), and the next key press must build on it, not on the
   * hall before it. Any new `hall` from the host replaces it (an undo may
   * give back the very hall it was built on).
   */
  const [sent, setSent] = useState<HallElement | null>(null);
  const [hallShown, setHallShown] = useState(hall);
  if (hallShown !== hall) {
    setHallShown(hall);
    setSent(null);
  }
  /** The hall the editor holds: the one it sent, or the host's. */
  const current = (hallShown === hall && sent) || hall;
  /**
   * `current`, also updated the moment a change is sent, so a second
   * change in the same event (a field written on blur as a drag begins)
   * builds on the first.
   */
  const currentRef = useRef(current);
  /** The last hall sent, until the host echoes it back as `hall`. */
  const echo = useRef<HallElement | null>(null);
  /** The view box held while a gesture runs (the drawing does not rescale). */
  const [heldBox, setHeldBox] = useState<Rect | null>(null);
  /** The palette's choice moves the focus to the drawing, not back to Add. */
  const [paletteChosen, setPaletteChosen] = useState(false);
  const frame = useRef<number | null>(null);
  const helpId = useId();
  const selectionId = useId();

  const committed = useMemo(() => hallView(current, art), [current, art]);
  const viewCache = useRef(committed);
  useLayoutEffect(() => {
    currentRef.current = current;
    viewCache.current = committed;
  });
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

  /** The view of the hall the editor holds now, laid out at most once. */
  const currentView = () => {
    if (viewCache.current.hall !== currentRef.current)
      viewCache.current = hallView(currentRef.current, art);
    return viewCache.current;
  };

  /** Ends a gesture without writing anything. */
  const cancelGesture = () => {
    const current = gesture.current;
    if (!current) return;
    gesture.current = null;
    setGestureKind(null);
    setGestureNode(null);
    setSlot(null);
    setHeldBox(null);
    setPreview(null);
    if (frame.current !== null) {
      if (frame.current >= 0) cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    if (surface.current?.hasPointerCapture?.(current.pointerId))
      surface.current.releasePointerCapture(current.pointerId);
  };

  // A new hall from the host, other than the echo of the one sent, ends a
  // gesture in progress: it was begun on a hall that is no longer there.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a new hall only
  useEffect(() => {
    const sentHall = echo.current;
    echo.current = null;
    if (sentHall && sameHall(sentHall, hall)) return;
    cancelGesture();
  }, [hall]);

  // So does the host locking: the gesture would be written later, on a
  // hall the host may by then have changed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a lock only
  useEffect(() => {
    if (!editable) cancelGesture();
  }, [editable]);

  // A touch screen gets larger handles; a tablet's keyboard or mouse can
  // come and go.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  // Handles and hit areas are sized in pixels, whatever the drawing's size.
  useEffect(() => {
    const element = overlay.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const box = committed.resolved?.viewBox;
      const width = element.getBoundingClientRect().width;
      if (box && width > 0) setPixelsPerSquare(width / (box.x1 - box.x0));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [committed.resolved]);

  // Editing starts with the drawing focused, so keys work at once, if the
  // author is still waiting on this hall: the focus is nowhere (Edit hall,
  // which opened it, is gone) or in the editor. An author who moved on
  // while its code loaded keeps their place. The last pending frame goes
  // with the editor.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on arriving only
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || root.current?.contains(active)) {
      const warning =
        initialFocus === "warnings"
          ? root.current?.querySelector<HTMLElement>("[data-hall-warning]")
          : null;
      if (warning) {
        warning.focus({ preventScroll: true });
        warning.scrollIntoView?.({ block: "nearest" });
      } else surface.current?.focus({ preventScroll: true });
    }
    return () => {
      if (frame.current !== null && frame.current >= 0)
        cancelAnimationFrame(frame.current);
    };
  }, []);

  const focusSurface = useCallback(() => {
    surface.current?.focus({ preventScroll: true });
  }, []);

  /**
   * Hands a completed gesture's hall, built on `currentView()`, to the
   * host, once. False when it was not taken.
   */
  const commit = (
    next: HallElement,
    message: string,
    select?: string | null,
  ): boolean => {
    setPreview(null);
    setSlot(null);
    if (select !== undefined) setSelectedId(select);
    // A change that ends as the host locks is dropped, as if cancelled.
    if (!editable) return false;
    const base = currentRef.current;
    if (next === base) return true;
    const normal = normalizeHall(next, art);
    // A host that refuses the change says so; the hall stays as the host
    // has it, and the author is told.
    if (onChange(normal) === false) {
      setNotice(REFUSED);
      setAnnouncement(REFUSED);
      return false;
    }
    currentRef.current = normal;
    echo.current = normal;
    setSent(normal);
    setNotice(null);
    setAnnouncement(message);
    return true;
  };

  const select = useCallback((entry: HallSelectable | undefined) => {
    setSelectedId(entry?.id ?? null);
    setAnnouncement(entry ? `Selected ${hallNodeName(entry.node)}` : "");
  }, []);

  const toSquares = (clientX: number, clientY: number): Point | null => {
    const box = heldBox ?? view.resolved?.viewBox;
    const element = overlay.current;
    if (!box || !element) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: box.x0 + ((clientX - rect.left) / rect.width) * (box.x1 - box.x0),
      y: box.y0 + ((clientY - rect.top) / rect.height) * (box.y1 - box.y0),
    };
  };

  /**
   * The gesture applied, for the pointer at `latest`, to the hall the
   * editor holds now; null when its node is gone.
   */
  const gestureHall = (current: Gesture): HallElement | null => {
    const base = currentView();
    if (!base.byId.has(current.id)) return null;
    const delta = {
      x: (current.latest.x - current.startClient.x) / current.pixels,
      y: (current.latest.y - current.startClient.y) / current.pixels,
    };
    if (current.kind === "move")
      return moveNode(base, current.id, delta, current.snap);
    return dragScaleNode(base, current.id, current.start, {
      x: current.start.x + delta.x,
      y: current.start.y + delta.y,
    });
  };

  /**
   * What a gesture shows before release: the hall it would write, or for
   * a row child being reordered the row in its new order with the child
   * under the pointer, and where it lands. Null when its node is gone.
   */
  const gesturePreview = (
    current: Gesture,
  ): { hall: HallElement; slot?: Rect } | null => {
    if (current.kind === "move" && current.snap) {
      const base = currentView();
      if (!base.byId.has(current.id)) return null;
      const row = rowDragPreview(
        base,
        current.id,
        {
          x: (current.latest.x - current.startClient.x) / current.pixels,
          y: (current.latest.y - current.startClient.y) / current.pixels,
        },
        art,
      );
      if (row) return { hall: row.preview, slot: row.slot };
    }
    const next = gestureHall(current);
    return next ? { hall: next } : null;
  };

  /**
   * A move's hall on release, and what it did: a row child reordered, an
   * object onto a host or off one to the floor (converted so it stays
   * where it is drawn), or moved where it stands.
   */
  const releaseHall = (
    current: Gesture,
    entry: HallSelectable,
    next: HallElement,
  ): { hall: HallElement; message: string } => {
    const name = hallNodeName(entry.node);
    if (current.kind === "scale")
      return { hall: next, message: scaled(entry, next) };
    const base = currentView();
    if (current.snap && reorderable(base, current.id)) {
      const place = rowPlace(hallView(next, art), current.id);
      const index =
        place?.spread.findIndex((child) => child.id === current.id) ?? -1;
      return {
        hall: next,
        message: place
          ? `Moved ${name} to place ${index + 1} of ${place.spread.length} in its row`
          : moved(entry, next),
      };
    }
    const nextView = hallView(next, art);
    const object = nextView.byId.get(current.id)?.object;
    const target: HallDropTarget | undefined =
      object &&
      dropTarget(nextView, current.id, { x: object.cx, y: object.cy });
    if (!target || standsOn(nextView, current.id, target))
      return { hall: next, message: moved(entry, next) };
    const host =
      target.kind === "host" ? nextView.byId.get(target.id) : undefined;
    return {
      hall: reparentNode(nextView, current.id, target, createId),
      message: host
        ? `Moved ${name} onto the ${hallNodeName(host.node)}`
        : `Moved ${name} to the floor`,
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // One gesture at a time: a second finger does not take over a drag.
    if (gesture.current) return;
    if (!editable || (event.pointerType === "mouse" && event.button !== 0))
      return;
    // A field left by this press writes its value now, before the gesture.
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
      startClient: { x: event.clientX, y: event.clientY },
      start: point,
      box,
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
      setGestureNode(current.id);
      setHeldBox(current.box);
    }
    // One layout per frame, however fast the pointer reports.
    if (frame.current !== null) return;
    // Pending until the frame runs, which may be at once.
    frame.current = -1;
    const id = requestAnimationFrame(() => {
      frame.current = null;
      if (gesture.current !== current) return;
      const next = gesturePreview(current);
      if (!next) {
        cancelGesture();
        return;
      }
      setPreview(next.hall);
      setSlot(next.slot ?? null);
    });
    if (frame.current === -1) frame.current = id;
  };

  const endGesture = (event: PointerEvent<HTMLDivElement>, cancel: boolean) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    cancelGesture();
    if (cancel || !current.moved || !editable) return;
    current.latest = { x: event.clientX, y: event.clientY };
    const next = gestureHall(current);
    const entry = currentView().byId.get(current.id);
    if (!next || !entry) return;
    const released = releaseHall(current, entry, next);
    commit(released.hall, released.message);
  };

  // Keys, buttons and fields edit the hall the editor holds now (see
  // `currentView`), by node ID.
  const nudge = (entry: HallSelectable, step: Point) => {
    const next = nudgeNode(currentView(), entry.id, step);
    commit(next, moved(entry, next));
  };

  /** One place earlier (-1) or later (1) in its row (Alt+arrows, the panel). */
  const reorderStep = (entry: HallSelectable, step: -1 | 1) => {
    const next = stepInRow(currentView(), entry.id, step);
    const place = rowPlace(hallView(next, art), entry.id);
    const index = place?.spread.findIndex((child) => child.id === entry.id);
    commit(
      next,
      `Moved ${hallNodeName(entry.node)} to place ${(index ?? 0) + 1} of ${place?.spread.length ?? 0} in its row`,
    );
  };

  /** "Spread evenly again": the row's positions along it taken away. */
  const spreadRow = (entry: HallSelectable) => {
    commit(spreadRowEvenly(currentView(), entry.id), "Spread the row evenly");
  };

  /** The panel's "Stands on": the floor or a host, kept where it is drawn. */
  const standOn = (entry: HallSelectable, value: string) => {
    const base = currentView();
    const target: HallDropTarget =
      value === "floor" ? { kind: "floor" } : { kind: "host", id: value };
    const host = target.kind === "host" ? base.byId.get(target.id) : undefined;
    commit(
      reparentNode(base, entry.id, target, createId),
      host
        ? `Moved ${hallNodeName(entry.node)} onto the ${hallNodeName(host.node)}`
        : `Moved ${hallNodeName(entry.node)} to the floor`,
    );
  };

  const scaleStep = (entry: HallSelectable, up: boolean) => {
    const next = stepScaleNode(currentView(), entry.id, up);
    commit(next, scaled(entry, next));
  };

  const remove = (entry: HallSelectable) => {
    commit(
      deleteNode(currentView(), entry.id),
      `Deleted ${hallNodeName(entry.node)}`,
      null,
    );
    focusSurface();
  };

  const duplicate = (entry: HallSelectable) => {
    const copy = duplicateNode(currentView(), entry.id, createId);
    if (!copy) return;
    commit(copy.hall, `Duplicated ${hallNodeName(entry.node)}`, copy.id);
    focusSurface();
  };

  const add = (entry: HallPaletteEntry) => {
    setPaletteChosen(true);
    setPaletteAnchor(null);
    const base = currentView();
    if (!base.resolved) return;
    const inserted = insertFromPalette(
      base.hall,
      base.resolved,
      entry,
      selectedId ?? undefined,
      createId,
    );
    commit(inserted.hall, `Added ${entry.label}`, inserted.id);
    focusSurface();
  };

  const setAttr = (id: string, name: string, value: JsonValue | undefined) =>
    commit(
      setNodeAttr(currentView(), id, name, value),
      value === undefined ? `Removed ${name}` : `Set ${name} to ${value}`,
    );

  const setCaption = (text: string | undefined): boolean => {
    const base = currentRef.current;
    const caption = base.children?.find(
      (child): child is HallElement =>
        child.kind === "element" && child.tag === "caption",
    );
    if (caption)
      return commit(
        text === undefined
          ? removeHallNode(base, caption.id)
          : updateHallAttrs(base, caption.id, { text }),
        text === undefined ? "Removed the caption" : "Set the caption",
      );
    if (text === undefined) return true;
    return commit(
      insertHallNode(base, base.id, {
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
    const history = modifier && (key === "z" || key === "Z" || key === "y");
    // No clipboard for objects yet: cut, copy and paste do nothing here,
    // and never reach a selection elsewhere on the page.
    if (modifier && !event.altKey && CLIPBOARD_KEYS.has(key.toLowerCase())) {
      event.preventDefault();
      return;
    }
    if (gesture.current) {
      // Escape, undo, redo and Delete end a gesture without writing it;
      // other keys wait for the pointer to be released.
      const ends =
        key === "Escape" || key === "Delete" || key === "Backspace" || history;
      if (!ends || key === "Escape") {
        if (!MODIFIER_KEYS.has(key)) event.preventDefault();
        if (key === "Escape") cancelGesture();
        return;
      }
      cancelGesture();
    }
    if (history) {
      event.preventDefault();
      // The host's history is not this editor's to move while it is locked.
      if (!editable) return;
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
    // Alt and an arrow along its row move a spread row child one place.
    const place =
      event.altKey && key in moves && !modifier
        ? rowPlace(currentView(), selected.id)
        : undefined;
    const rowStep =
      place && reorderable(currentView(), selected.id)
        ? place.along === "x"
          ? moves[key].x
          : moves[key].y
        : 0;
    if (rowStep !== 0) {
      event.preventDefault();
      reorderStep(selected, rowStep < 0 ? -1 : 1);
    } else if (key in moves && !modifier) {
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

  // The host a dragged object would land on, highlighted while it is over
  // one that takes it.
  const dropHost = useMemo(() => {
    if (gestureKind !== "move" || !gestureNode || !previewView) return null;
    const object = previewView.byId.get(gestureNode)?.object;
    const target =
      object &&
      dropTarget(previewView, gestureNode, { x: object.cx, y: object.cy });
    const host =
      target?.kind === "host" ? previewView.byId.get(target.id) : undefined;
    return host?.object ? objectRect(host.object) : null;
  }, [gestureKind, gestureNode, previewView]);

  // The drawing's view box, held still while a gesture runs: a drag past
  // the drawing's edge would otherwise rescale it under the pointer.
  const box = heldBox ?? view.resolved?.viewBox;
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
    <div ref={root} className={styles.editor} data-gd-hall-controls>
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
            // The name stays put; what is selected is described, read when
            // the drawing takes the focus, and announced by the live region
            // as it changes (a changing name was announced twice on Tab).
            aria-label="Temple hall editor"
            aria-describedby={`${selectionId} ${helpId}`}
            aria-disabled={!editable || undefined}
            tabIndex={0}
            data-gesture={gestureKind ?? undefined}
            onKeyDown={onKeyDown}
            onFocus={() => clearOutsideSelection(root.current)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => endGesture(event, false)}
            onPointerCancel={(event) => endGesture(event, true)}
          >
            {view.row && view.resolved && box && (
              <div
                className={styles.frame}
                style={{
                  aspectRatio: `${box.x1 - box.x0} / ${box.y1 - box.y0}`,
                }}
              >
                <GdHall
                  hall={view.row}
                  art={art}
                  className={styles.drawing}
                  style={placeWithin(view.resolved.viewBox, box)}
                />
              </div>
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
                {dropHost && (
                  <g data-hall-drop>
                    <SquareRect rect={dropHost} className={styles.dropHost} />
                  </g>
                )}
                {slot && (
                  <g data-hall-slot>
                    <SquareRect rect={slot} className={styles.slot} />
                  </g>
                )}
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
          {notice && (
            <p className={styles.notice} data-hall-notice>
              {notice}
            </p>
          )}
          <p id={selectionId} className={styles.visuallyHidden}>
            {selected
              ? `${hallNodeName(selected.node)} selected`
              : "Nothing selected"}
          </p>
          <p id={helpId} className={styles.hint}>
            {!editable
              ? "The hall cannot be edited while the ritual is updating."
              : coarse
                ? "Tap to select, drag to move (along a row: to reorder; onto or off an altar, platform or throne: to stand there), drag a corner to scale; the panel edits the rest."
                : `Click to select, drag to move (Alt: no snapping), drag a corner to scale. Dragged along a row, an officer or banner changes places (Alt: places it freely); dropped on an altar, platform or throne it stands there, and dragged off, on the floor. Keys: Tab selects the next object, arrows nudge (Shift: a square; Alt: a place along its row), + and − scale, Delete removes, Ctrl+D duplicates, Escape deselects, then finishes.`}
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
          onStepInRow={reorderStep}
          onSpreadRow={spreadRow}
          onStandOn={standOn}
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

/**
 * Where a drawing of `drawn` stands in a frame showing `frame`, in
 * percent of the frame: the whole frame when they agree, beyond it where
 * a drag has taken an object past the held view box.
 */
const placeWithin = (drawn: Rect, frame: Rect): CSSProperties => {
  const width = frame.x1 - frame.x0;
  const height = frame.y1 - frame.y0;
  return {
    left: `${((drawn.x0 - frame.x0) / width) * 100}%`,
    top: `${((drawn.y0 - frame.y0) / height) * 100}%`,
    width: `${((drawn.x1 - drawn.x0) / width) * 100}%`,
    height: `${((drawn.y1 - drawn.y0) / height) * 100}%`,
  };
};

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
              data-hall-warning
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
