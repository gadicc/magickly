"use client";

import React from "react";

export type RitualEditorLayout = "visual" | "source" | "split";
export const RITUAL_EDITOR_LAYOUT_KEY = "magickli:ritual-editor-layout:v1";

/**
 * Browser-only presentation preference; recovery changes never persist
 * implicitly. `storageKey` gives another editor (the `/gd/hall` page's)
 * a preference of its own.
 */
export function useRitualEditorLayout(
  initialLayout: RitualEditorLayout = "split",
  storageKey: string = RITUAL_EDITOR_LAYOUT_KEY,
) {
  const [fallback] = React.useState(initialLayout);
  const [layout, setLayout] = React.useState(fallback);
  // SSR and hydration start with the same layout. Restore before the client paint.
  React.useLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "visual" || stored === "source" || stored === "split")
        setLayout(stored);
    } catch {
      // A blocked storage API must not prevent editing.
    }
  }, [storageKey]);
  const chooseLayout = React.useCallback(
    (next: RitualEditorLayout) => {
      setLayout(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // The choice still applies for this mounted editor.
      }
    },
    [storageKey],
  );
  return [layout, chooseLayout, setLayout] as const;
}
