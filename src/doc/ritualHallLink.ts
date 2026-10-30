"use client";

import { createContext, useCallback, useContext, useEffect } from "react";
import type { GdHallEditorProps } from "./gdHallEditor/GdHallEditor";
import type { HallElement } from "./gdHallEditor/hallModel";

/**
 * The ritual editor's side of the link between a hall open for editing
 * and the ritual source (plan 064), given to the hall editors in its
 * visual panel through `RitualHallLinkContext`.
 */
export interface RitualHallLink {
  /** Split view: both panels are showing. */
  linked: boolean;
  /** An open hall editor, as it mounts. Returns its cleanup. */
  open(hallId: string): () => void;
  /** The open hall's selected node, on mount and whenever it changes. */
  selected(hallId: string, id: string | null): void;
}

/** Provided by the ritual editor around its visual panel; null elsewhere. */
export const RitualHallLinkContext = createContext<RitualHallLink | null>(null);

/**
 * The hall editor's half of the link (plan 064): registers the open hall
 * and reports its selection. Without a provider (any other host) it
 * gives nothing, and the hall editor behaves as before.
 */
export function useLinkedHall(
  hall: HallElement,
): Pick<GdHallEditorProps, "onSelectionChange"> {
  const link = useContext(RitualHallLinkContext);
  const open = link?.open;
  const selected = link?.selected;
  const hallId = hall.id;
  useEffect(() => open?.(hallId), [open, hallId]);
  const onSelectionChange = useCallback<
    NonNullable<GdHallEditorProps["onSelectionChange"]>
  >(
    (selection) => selected?.(hallId, selection?.id ?? null),
    [selected, hallId],
  );
  return link ? { onSelectionChange } : {};
}
