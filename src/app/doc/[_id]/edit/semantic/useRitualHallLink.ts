"use client";

import React from "react";
import type { RitualSourceCursor } from "@/doc/RitualSourceEditor";
import type { RitualHallLink } from "@/doc/ritualHallLink";
import { ritualPugLineOfId } from "@/doc/ritualPugIds";
import type { RitualSourceDialect } from "@/doc/ritualSource";
import type { RitualEditorLayout } from "@/doc/useRitualEditorLayout";

/**
 * What leads the link: the source's editor, an open hall's editor, or
 * neither (the focus went elsewhere in a panel, such as the visual
 * panel's text or a toolbar).
 */
type Lead = "source" | "drawing" | null;

/** An open hall's selected node, and whether the drawing chose it. */
interface LinkedSelection {
  hallId: string;
  id: string;
  /** Chosen while the drawing led: the source caret goes to it. */
  byDrawing: boolean;
}

/**
 * The caret at the start of the tag whose header line declares `id` in
 * ritual Pug `text` (plan 064), or null when no line does.
 */
export function ritualTagCursor(
  text: string,
  id: string,
): RitualSourceCursor | null {
  const line = ritualPugLineOfId(text, id);
  if (line === null) return null;
  const header = text.split("\n")[line - 1];
  const indent = header.length - header.trimStart().length;
  return { line, column: indent + 1, source: text };
}

/** The element matching `selector` that holds the focus event's target. */
const focusIn = (event: React.FocusEvent, selector: string) =>
  event.target instanceof Element ? event.target.closest(selector) : null;

/**
 * The ritual editor's side of the link between a hall open for editing
 * and its source in split view (plan 064): the hall's selection, made in
 * the drawing, puts the source caret on the item's line.
 *
 * The link follows what led last: an open hall's editor, or the source's
 * editor, by where the focus went. The focus anywhere else in a panel
 * (the visual panel's text, a toolbar) leaves neither leading, so typing
 * there never draws the source caret back to the hall. The lead is kept
 * in a ref, as it decides what the next report means and is no reason
 * to draw again. The link object is provided whatever the layout, so a
 * hall editor stays registered, and reports its selection, while the
 * source panel is away.
 */
export function useRitualHallLink({
  displayMode,
  source,
}: {
  /** The layout shown; the link acts in split view only. */
  displayMode: RitualEditorLayout;
  /** The source panel's state. */
  source: {
    text: string;
    dialect: RitualSourceDialect;
    dirty: boolean;
    conflict: boolean;
  };
}) {
  const linked = displayMode === "split";
  // Text the document was read from (or printed as): its IDs are the
  // document's. Typing not yet read, an error or a conflict is not.
  const read = source.dialect === "pug" && !source.dirty && !source.conflict;
  const lead = React.useRef<Lead>("drawing");
  const [selection, setSelection] = React.useState<LinkedSelection | null>(
    null,
  );
  /** Open hall editors by hall ID, counted (Strict Mode mounts twice). */
  const opened = React.useRef(new Map<string, number>());

  const open = React.useCallback((hallId: string) => {
    const halls = opened.current;
    halls.set(hallId, (halls.get(hallId) ?? 0) + 1);
    return () => {
      const left = (halls.get(hallId) ?? 1) - 1;
      if (left > 0) {
        halls.set(hallId, left);
        return;
      }
      halls.delete(hallId);
      // A closed hall's selection leads nowhere.
      setSelection((current) => (current?.hallId === hallId ? null : current));
    };
  }, []);
  const selected = React.useCallback((hallId: string, id: string | null) => {
    const byDrawing = lead.current === "drawing";
    setSelection((current) => {
      if (id === null) return current?.hallId === hallId ? null : current;
      return current?.hallId === hallId &&
        current.id === id &&
        current.byDrawing === byDrawing
        ? current
        : { hallId, id, byDrawing };
    });
  }, []);
  const link = React.useMemo<RitualHallLink>(
    () => ({ linked, open, selected }),
    [linked, open, selected],
  );

  /** No editor leads: the drawing's selection no longer moves the caret. */
  const noneLeads = React.useCallback(() => {
    lead.current = null;
    setSelection((current) =>
      current?.byDrawing ? { ...current, byDrawing: false } : current,
    );
  }, []);
  /**
   * An open hall's editor leads: its selection, even one the source
   * chose, puts the caret on its tag, as on the hall editor page.
   */
  const drawingLeads = React.useCallback((hallId?: string) => {
    lead.current = "drawing";
    setSelection((current) =>
      current &&
      !current.byDrawing &&
      (hallId === undefined || current.hallId === hallId)
        ? { ...current, byDrawing: true }
        : current,
    );
  }, []);

  // Entering split view from Visual, the drawing leads with what it
  // holds, whichever editor led before (plan 063's rule); not when the
  // author was last in the visual panel's text.
  const previous = React.useRef(displayMode);
  React.useEffect(() => {
    const from = previous.current;
    previous.current = displayMode;
    if (displayMode !== "split" || from !== "visual" || lead.current === null)
      return;
    drawingLeads();
  }, [displayMode, drawingLeads]);

  // The drawing's selection at its tag: again for each new text, as a
  // visual edit reprints the source.
  const cursor = React.useMemo(
    () =>
      linked && read && selection?.byDrawing
        ? ritualTagCursor(source.text, selection.id)
        : null,
    [linked, read, selection, source.text],
  );

  return {
    /** For `RitualHallLinkContext`, around the visual panel. */
    link,
    /** For the source panel's `cursor`. */
    cursor,
    /** The source panel marks the caret's line (`data-linked-caret`). */
    marked: cursor !== null,
    /**
     * The source section's `onFocus`: in its editor the source leads
     * (typing must not draw the caret back to the selected tag); on its
     * buttons and links, neither does.
     */
    onSourceFocus: React.useCallback(
      (event: React.FocusEvent) => {
        noneLeads();
        if (focusIn(event, ".cm-editor")) lead.current = "source";
      },
      [noneLeads],
    ),
    /**
     * The visual section's `onFocus`: in an open hall's editor that hall
     * leads; anywhere else in the panel, neither does.
     */
    onVisualFocus: React.useCallback(
      (event: React.FocusEvent) => {
        const hallId = focusIn(event, "[data-gd-hall-editing]")?.getAttribute(
          "data-gd-hall-editing",
        );
        if (hallId) drawingLeads(hallId);
        else noneLeads();
      },
      [drawingLeads, noneLeads],
    ),
  };
}
