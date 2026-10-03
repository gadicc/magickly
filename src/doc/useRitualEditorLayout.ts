"use client";

import React from "react";

export type RitualEditorLayout = "visual" | "source" | "split";
export const RITUAL_EDITOR_LAYOUT_KEY = "magickli:ritual-editor-layout:v1";

/** Browser-only presentation preference; recovery changes never persist implicitly. */
export function useRitualEditorLayout(
  initialLayout: RitualEditorLayout = "split",
) {
  const [fallback] = React.useState(initialLayout);
  const [layout, setLayout] = React.useState(fallback);
  // SSR and hydration start with the same layout. Restore before the client paint.
  React.useLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem(RITUAL_EDITOR_LAYOUT_KEY);
      if (stored === "visual" || stored === "source" || stored === "split")
        setLayout(stored);
    } catch {
      // A blocked storage API must not prevent editing.
    }
  }, []);
  const chooseLayout = React.useCallback((next: RitualEditorLayout) => {
    setLayout(next);
    try {
      window.localStorage.setItem(RITUAL_EDITOR_LAYOUT_KEY, next);
    } catch {
      // The choice still applies for this mounted editor.
    }
  }, []);
  return [layout, chooseLayout, setLayout] as const;
}
