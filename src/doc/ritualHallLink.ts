"use client";

import type { HallArtRegistry } from "@magick-components/gd/hall/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type {
  GdHallEditorProps,
  HallSelectionRequest,
} from "./gdHallEditor/GdHallEditor";
import {
  type HallView,
  hallView,
  selectableForPath,
} from "./gdHallEditor/hallEdits";
import {
  type HallElement,
  type HallIndex,
  indexHall,
} from "./gdHallEditor/hallModel";

/** The source caret's chain of node IDs, innermost first. */
export interface RitualHallCaret {
  ids: readonly string[];
  /** Increments for each move of the caret, so a repeat is a new ask. */
  key: number;
}

/** An open hall editor, as the ritual editor's link asks it. */
export interface RitualLinkedHall {
  /**
   * Whether a source caret with this chain would select, and so reveal,
   * a drawn node in this hall, which is itself drawn (a footnote's
   * canonical body is hidden). False for the hall's own line and lines
   * of its structure (`dais`, `floor`), which select nothing.
   */
  reveals(ids: readonly string[]): boolean;
}

/**
 * The ritual editor's side of the link between a hall open for editing
 * and the ritual source (plan 064), given to the hall editors in its
 * visual panel through `RitualHallLinkContext`.
 */
export interface RitualHallLink {
  /** Split view: both panels are showing. */
  linked: boolean;
  /**
   * The source caret, while the source leads and holds text the
   * document was read from; else null.
   */
  caret: RitualHallCaret | null;
  /** An open hall editor, as it mounts. Returns its cleanup. */
  open(hallId: string, hall: RitualLinkedHall): () => void;
  /** The open hall's selected node, on mount and whenever it changes. */
  selected(hallId: string, id: string | null): void;
}

/** Provided by the ritual editor around its visual panel; null elsewhere. */
export const RitualHallLinkContext = createContext<RitualHallLink | null>(null);

/**
 * The row path a source caret selects in a hall (plan 064): that of the
 * innermost node of its chain that the hall holds. An item's line gives
 * the item, a line within an item (a comment) the item, the hall's own
 * line and its comments `[]` (nothing selected); a caret outside the
 * hall null (nothing asked).
 */
export function hallCaretPath(
  ids: readonly string[],
  index: HallIndex,
): readonly number[] | null {
  for (const id of ids) {
    const entry = index.byId.get(id);
    if (entry) return entry.rowPath;
  }
  return null;
}

/**
 * The hall editor's half of the link (plan 064): registers the open hall,
 * reports its selection, and selects what the source caret is in. Without
 * a provider (any other host) it gives nothing, and the hall editor
 * behaves as before.
 */
export function useLinkedHall(
  hall: HallElement,
  art: HallArtRegistry,
  shown: () => boolean,
): Pick<GdHallEditorProps, "onSelectionChange" | "selectPath"> {
  const link = useContext(RitualHallLinkContext);
  const open = link?.open;
  const selected = link?.selected;
  const hallId = hall.id;
  // Registered once per hall; asked, it reads the latest hall and `shown`.
  const latest = useRef({ hall, art, shown });
  latest.current = { hall, art, shown };
  /** The hall laid out, once per hall, and only when asked. */
  const laidOut = useRef<HallView | null>(null);
  useEffect(
    () =>
      open?.(hallId, {
        reveals: (ids) => {
          const { hall, art, shown } = latest.current;
          if (laidOut.current?.hall !== hall)
            laidOut.current = hallView(hall, art);
          const path = hallCaretPath(ids, laidOut.current.index);
          return (
            !!path && !!selectableForPath(laidOut.current, path) && shown()
          );
        },
      }),
    [open, hallId],
  );
  const onSelectionChange = useCallback<
    NonNullable<GdHallEditorProps["onSelectionChange"]>
  >(
    (selection) => selected?.(hallId, selection?.id ?? null),
    [selected, hallId],
  );

  const caret = link?.caret ?? null;
  const linkedHere = link !== null;
  const index = useMemo(
    () => (linkedHere ? indexHall(hall) : null),
    [linkedHere, hall],
  );
  /** The caret key last asked for, so a read asks again without revealing. */
  const asked = useRef<number | null>(null);
  // Again for each new hall while the caret leads, which is a read of
  // the source: what the caret is in may have changed (plan 063's answer
  // 5). Only a caret that moved reveals a node already selected.
  const selectPath = useMemo((): HallSelectionRequest | null => {
    if (!caret || !index) return null;
    const path = hallCaretPath(caret.ids, index);
    return path && { path, hall, revealSelected: caret.key !== asked.current };
  }, [caret, index, hall]);
  useEffect(() => {
    if (selectPath && caret) asked.current = caret.key;
  }, [selectPath, caret]);
  return link ? { onSelectionChange, selectPath } : {};
}
