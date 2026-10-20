"use client";

import {
  type RefObject,
  useCallback,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Where the hall editor's properties panel goes (Gadi, 20 October 2026;
 * plan 061, "Follow-ups after stage F"): beside the drawing whenever the
 * editor is wide enough for both, otherwise docked at the foot of the
 * screen as a short strip the author can hide.
 */
export type HallPanelPlace = "beside" | "docked";

/**
 * The editor's narrowest width, in CSS pixels, that takes the drawing and
 * the panel side by side: the drawing's 30rem (480 px), the panel's 15rem
 * and the 0.75rem gap, as `gdHallEditor.module.css` lays them out. Beside,
 * the drawing never falls below 480 px; docked just under this width, it
 * is at most its 40rem.
 */
export const PANEL_BESIDE_MIN_WIDTH = 732;

/**
 * How much wider than `PANEL_BESIDE_MIN_WIDTH` a docked panel's editor
 * must grow before the panel goes beside the drawing: more than a classic
 * scrollbar (15 px), so a scrollbar that comes and goes as the panel
 * moves cannot make it flap.
 */
export const PANEL_BESIDE_HYSTERESIS = 16;

/**
 * Where the panel goes in an editor this wide, given where it is: beside
 * from `PANEL_BESIDE_MIN_WIDTH`, but a docked panel stays docked until the
 * editor is `PANEL_BESIDE_HYSTERESIS` wider. Unknown without a width.
 */
export function panelPlaceFor(
  width: number,
  current?: HallPanelPlace,
): HallPanelPlace | undefined {
  if (!(width > 0)) return undefined;
  if (width < PANEL_BESIDE_MIN_WIDTH) return "docked";
  if (
    current === "docked" &&
    width < PANEL_BESIDE_MIN_WIDTH + PANEL_BESIDE_HYSTERESIS
  )
    return "docked";
  return "beside";
}

/**
 * The least height, in CSS pixels, of the box a docked panel sticks in.
 * In a shorter one (the ritual editor's visual panel on a landscape phone,
 * under its header and toolbars) even the panel's title bar and caption
 * would cover most of the drawing, so the panel stays in the flow below
 * the drawing instead, as it stood before the dock.
 */
export const DOCK_MIN_ROOM = 400;

/** Whether a docked panel sticks at the foot of a box this tall. */
export function dockSticks(room: number | undefined): boolean {
  return room === undefined || room >= DOCK_MIN_ROOM;
}

/** A ResizeObserver entry's border-box width, or its content width. */
export function entryWidth(entry: ResizeObserverEntry): number {
  const size = entry.borderBoxSize as
    | ResizeObserverSize
    | readonly ResizeObserverSize[]
    | undefined;
  const box = Array.isArray(size) ? size[0] : (size as ResizeObserverSize);
  return box?.inlineSize ?? entry.contentRect.width;
}

/**
 * The nearest ancestor of `element` that scrolls vertically (the ritual
 * editor's visual panel), or null for the page itself.
 */
export function scrollingAncestor(element: Element | null): HTMLElement | null {
  for (let node = element?.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(node).overflowY))
      return node;
  }
  return null;
}

/**
 * How far to scroll so that `item` (client pixels, top and bottom) lies
 * within `port`: positive scrolls down. An item taller than the port is
 * shown from its top.
 */
export function revealDelta(
  item: { top: number; bottom: number },
  port: { top: number; bottom: number },
): number {
  let delta = 0;
  if (item.bottom > port.bottom) delta = item.bottom - port.bottom;
  if (item.top - delta < port.top) delta = item.top - port.top;
  return delta;
}

/**
 * The window's height for the dock: the layout viewport's
 * (`documentElement.clientHeight`), which does not count a page wider
 * than the screen and holds still under a phone's address bar, or
 * `innerHeight` where the document has no height yet.
 */
export function windowRoom(): number {
  return document.documentElement.clientHeight || window.innerHeight;
}

/**
 * The panel's place in the editor `root`, and the height of the box the
 * docked panel sticks in (`room`, CSS pixels): the nearest scrolling
 * ancestor, or the window. The place is measured before the first paint,
 * then from the observer's border-box sizes. Until the editor has a width
 * the place is unknown (`undefined`): the editor then lays the drawing
 * and the panel in one column, which fits any width. A beside layout
 * before measuring would ask 748 px of a phone's 358, and a phone's
 * browser, shrinking the page to fit, would report a window twice its
 * size to the measurement.
 */
export function useHallPanelDock(root: RefObject<HTMLElement | null>): {
  place: HallPanelPlace | undefined;
  room: number | undefined;
} {
  const [place, setPlace] = useState<HallPanelPlace | undefined>(undefined);
  const [room, setRoom] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    let current: HallPanelPlace | undefined;
    const placeAt = (width: number) => {
      const next = panelPlaceFor(width, current);
      if (!next) return;
      current = next;
      setPlace(next);
    };
    const scroller = scrollingAncestor(element);
    const measureRoom = () => {
      const height = scroller ? scroller.clientHeight : windowRoom();
      setRoom(height > 0 ? height : undefined);
    };
    placeAt(element.getBoundingClientRect().width);
    measureRoom();
    const viewport = window.visualViewport;
    if (!scroller) {
      window.addEventListener("resize", measureRoom);
      viewport?.addEventListener("resize", measureRoom);
    }
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === element) placeAt(entryWidth(entry));
          else measureRoom();
        }
      });
      observer.observe(element);
      if (scroller) observer.observe(scroller);
    }
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureRoom);
      viewport?.removeEventListener("resize", measureRoom);
    };
  }, [root]);
  return { place, room };
}

/**
 * Whether this viewer hid the docked panel, kept in this browser across
 * halls, rituals and visits, and shared by every editor open: those in
 * this page hear of a change directly, other tabs by the `storage` event.
 */
export const PANEL_COLLAPSED_KEY = "magickli:gd-hall-panel-collapsed:v1";

const listeners = new Set<() => void>();

/** The viewer's kept choice: hidden, or (by default) shown. */
export function readPanelCollapsed(): boolean {
  try {
    return window.localStorage.getItem(PANEL_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Keeps the viewer's choice (nothing is kept for a shown panel) and tells
 * the editors open in this page. False when storage refused it.
 */
export function writePanelCollapsed(collapsed: boolean): boolean {
  try {
    if (collapsed) window.localStorage.setItem(PANEL_COLLAPSED_KEY, "1");
    else window.localStorage.removeItem(PANEL_COLLAPSED_KEY);
  } catch {
    return false;
  }
  for (const listener of listeners) listener();
  return true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === PANEL_COLLAPSED_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * The viewer's choice to hide the docked panel, and a setter that keeps
 * it. Where storage is blocked or full, the choice lasts for this editor.
 */
export function usePanelCollapsed(): [boolean, (collapsed: boolean) => void] {
  const kept = useSyncExternalStore(subscribe, readPanelCollapsed, () => false);
  const [unkept, setUnkept] = useState<boolean | null>(null);
  const set = useCallback((collapsed: boolean) => {
    setUnkept(writePanelCollapsed(collapsed) ? null : collapsed);
  }, []);
  return [unkept ?? kept, set];
}
