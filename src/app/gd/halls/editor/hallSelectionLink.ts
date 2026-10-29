"use client";

import React from "react";
import type {
  HallSelection,
  HallSelectionRequest,
} from "@/doc/gdHallEditor/GdHallEditor";
import { indexHall, rowPathKey } from "@/doc/gdHallEditor/hallModel";
import {
  type HallSourcePlace,
  hallSourceMap,
} from "@/doc/gdHallEditor/hallSourceMap";
import type { RitualSourceCursor } from "@/doc/RitualSourceEditor";
import type { RitualEditorLayout } from "@/doc/useRitualEditorLayout";
import type { HallEntry } from "./hallHistory";

/**
 * Split view lays the panels side by side from this width, the source
 * panel sticky below the app bar (`hallPlayground.module.css`): there a
 * selection from the source may scroll the page (Gadi, 29 October 2026),
 * which leaves the source where it is. Stacked, it would carry the
 * source away from the caret.
 */
const SIDE_BY_SIDE = "(min-width: 900px)";
/** The app bar's height from 600 px wide, which the page keeps clear. */
const APP_BAR = 64;

const sideBySide = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia(SIDE_BY_SIDE).matches;

/** The panel the link follows: the one that last had the focus. */
type Panel = "source" | "drawing";

/**
 * The `/gd/halls/editor` page's link between its source and its drawing
 * in split view (plan 063): the drawing's selection puts the source
 * caret on the selected tag, and the source caret selects the item it
 * is in.
 *
 * The link follows the panel that last had the focus, so neither panel
 * answers what the other did on its behalf. The focus and the caret are
 * kept in refs: they decide what the next change does, and are no reason
 * to draw again. The page draws again only when the caret comes to
 * another item.
 */
export function useHallSelectionLink({
  linked,
  present,
  typed,
  text,
}: {
  /** Split view: both panels are showing. */
  linked: boolean;
  /** The entry the drawing shows (when it holds a hall). */
  present: HallEntry;
  /** Typing not yet read, which the source panel shows instead. */
  typed: string | null;
  /** The source panel's text now, read or not. */
  text: () => string;
}) {
  const origin = React.useRef<Panel>("drawing");
  const [selection, setSelection] = React.useState<HallSelection | null>(null);
  // Built from the entry itself: the printer's layout, or the parse that
  // read it. Nothing is parsed here.
  const map = React.useMemo(
    () =>
      linked && present.hall
        ? hallSourceMap(present.hall, present.source, present.locations)
        : null,
    [linked, present],
  );
  const index = React.useMemo(
    () => (map && present.hall ? indexHall(present.hall) : null),
    [map, present.hall],
  );

  // The drawing's selection, at its tag: again for each new source, as
  // an edit there rewrites it. By ID, so a node an edit moved is found
  // where it went before the drawing reports its new path.
  const cursor = React.useMemo((): RitualSourceCursor | null => {
    if (origin.current !== "drawing" || !selection || typed !== null)
      return null;
    const path = index?.byId.get(selection.id)?.rowPath;
    const place = path && map?.placeOf(path);
    return place ? { ...place, source: present.source } : null;
  }, [map, index, selection, typed, present.source]);

  // The source caret, with the text it was in: typing not yet read holds
  // it until the read makes that text the hall's, which selects again
  // (Gadi, 29 October 2026); anything else replacing the text drops it.
  const caret = React.useRef<(HallSourcePlace & { source: string }) | null>(
    null,
  );
  /** The item the caret was last found in, and in which text. */
  const found = React.useRef<{ source: string; key: string } | null>(null);
  const [moved, setMoved] = React.useState(0);
  // The caret the link puts in the source is the source's caret too: on
  // entering split view from the source, it is that caret which leads.
  React.useEffect(() => {
    if (cursor) caret.current = cursor;
  }, [cursor]);
  const latest = React.useRef({ map, present, text });
  latest.current = { map, present, text };
  const onCursor = React.useCallback((at: HallSourcePlace) => {
    const { map, present, text } = latest.current;
    origin.current = "source";
    const source = text();
    caret.current = { ...at, source };
    if (!map || source !== present.source) return;
    const path = map.pathAt(at);
    const key = path ? rowPathKey(path) : "-";
    if (found.current?.source === source && found.current.key === key) return;
    found.current = { source, key };
    setMoved((count) => count + 1);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `moved` is the caret's ref changing
  const selectPath = React.useMemo((): HallSelectionRequest | null => {
    const at = caret.current;
    if (
      origin.current !== "source" ||
      !at ||
      !map ||
      !present.hall ||
      at.source !== present.source
    )
      return null;
    return {
      path: map.pathAt(at),
      hall: present.hall,
      ...(sideBySide() && { pageInset: APP_BAR }),
    };
  }, [map, present, moved]);

  return {
    cursor,
    onCursor,
    selectPath,
    onSelectionChange: setSelection,
    /**
     * The source panel marks the caret's line while something is selected
     * and the source holds the hall drawn (its map is live).
     */
    marked: linked && selection !== null && map !== null,
    onSourceFocus: () => {
      origin.current = "source";
      // A caret in the item the drawing moved away from selects it again.
      found.current = null;
    },
    onDrawingFocus: () => {
      origin.current = "drawing";
    },
    /**
     * Called as the layout changes: entering split view, the panel that
     * was showing leads.
     */
    onLayout: (next: RitualEditorLayout, from: RitualEditorLayout) => {
      if (next === "split" && from !== "split")
        origin.current = from === "source" ? "source" : "drawing";
      // The source panel goes, and its caret with it.
      if (next === "visual") {
        caret.current = null;
        found.current = null;
      }
    },
  };
}
