"use client";

import React from "react";
import {
  clampTextSize,
  READER_TEXT_SIZE_DEFAULT,
  READER_TEXT_SIZE_KEY,
  READER_TEXT_SIZE_PROPERTY,
} from "./readerTextSize";

/**
 * The ritual reader's text size (plan 089, deferred item 3): a browser-only
 * presentation preference, the same in every ritual, the editor's preview
 * too, and kept across reloads. The reader's font size is the
 * `READER_FONT_SIZE` custom property, which the `<head>` script sets from
 * storage before the first paint and this hook keeps in step; the number it
 * returns is for the controls, the default until hydration. A blocked
 * storage API leaves the control working for the page as it is. Other tabs
 * keep their size until reloaded.
 */
export function useReaderTextSize() {
  const [size, setSize] = React.useState(READER_TEXT_SIZE_DEFAULT);
  const apply = React.useCallback((size: number) => {
    setSize(size);
    document.documentElement.style.setProperty(
      READER_TEXT_SIZE_PROPERTY,
      `${size}%`,
    );
  }, []);
  React.useLayoutEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(READER_TEXT_SIZE_KEY);
    } catch {
      // Unreadable storage: the default size.
    }
    // Also after a client-side navigation, when the script ran long ago.
    apply(stored === null ? READER_TEXT_SIZE_DEFAULT : clampTextSize(+stored));
  }, [apply]);
  const chooseSize = React.useCallback(
    (next: number) => {
      const size = clampTextSize(next);
      apply(size);
      try {
        if (size === READER_TEXT_SIZE_DEFAULT)
          window.localStorage.removeItem(READER_TEXT_SIZE_KEY);
        else window.localStorage.setItem(READER_TEXT_SIZE_KEY, String(size));
      } catch {
        // The size still applies to this page.
      }
    },
    [apply],
  );
  return [size, chooseSize] as const;
}
