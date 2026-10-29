"use client";

import React from "react";
import type { HallSelection } from "@/doc/gdHallEditor/GdHallEditor";
import { indexHall } from "@/doc/gdHallEditor/hallModel";
import { hallSourceMap } from "@/doc/gdHallEditor/hallSourceMap";
import type { RitualSourceCursor } from "@/doc/RitualSourceEditor";
import type { RitualEditorLayout } from "@/doc/useRitualEditorLayout";
import type { HallEntry } from "./hallHistory";

/** The panel the link follows: the one that last had the focus. */
type Panel = "source" | "drawing";

/**
 * The `/gd/halls/editor` page's link between its source and its drawing
 * in split view (plan 063): the drawing's selection puts the source
 * caret on the selected tag.
 *
 * The link follows the panel that last had the focus, so neither panel
 * answers what the other did on its behalf. The focus is kept in a ref:
 * it decides what the next change does, and is no reason to draw again.
 */
export function useHallSelectionLink({
  linked,
  present,
  typed,
}: {
  /** Split view: both panels are showing. */
  linked: boolean;
  /** The entry the drawing shows (when it holds a hall). */
  present: HallEntry;
  /** Typing not yet read, which the source panel shows instead. */
  typed: string | null;
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

  return {
    cursor,
    onSelectionChange: setSelection,
    /**
     * The source panel marks the caret's line while something is selected
     * and the source holds the hall drawn (its map is live).
     */
    marked: linked && selection !== null && map !== null,
    onSourceFocus: () => {
      origin.current = "source";
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
    },
  };
}
