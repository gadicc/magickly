"use client";
import { useColorScheme } from "@mui/material/styles";
import { useEffect } from "react";
import { THEME_COLOR } from "@/colorScheme";

const SELECTOR = 'meta[name="theme-color"]';

/**
 * Points every `theme-color` meta at the reader's scheme. The layout gives
 * one per `prefers-color-scheme` (`viewport.themeColor`); after an explicit
 * Light or Dark both get that scheme's colour, and with System each gets its
 * own media's colour back.
 */
export function applyThemeColor(mode: string | undefined) {
  for (const meta of document.querySelectorAll<HTMLMetaElement>(SELECTOR)) {
    const scheme =
      mode === "light" || mode === "dark"
        ? mode
        : /dark/.test(meta.media)
          ? "dark"
          : "light";
    const color = THEME_COLOR[scheme];
    // Only on a change, so the observer below does not wake itself.
    if (meta.content !== color) meta.content = color;
  }
}

/**
 * Keeps the browser's toolbar on the reader's chosen scheme (plan 076,
 * decision 5). Renders nothing: `mode` is undefined until after hydration,
 * and only the effect reads it. Next owns the metas and may put fresh ones
 * in the head on a navigation, so a `MutationObserver` re-applies the choice
 * whenever the head changes.
 */
export default function ThemeColorMeta() {
  const { mode } = useColorScheme();
  useEffect(() => {
    if (!mode) return;
    applyThemeColor(mode);
    const observer = new MutationObserver(() => applyThemeColor(mode));
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["content", "media"],
    });
    return () => observer.disconnect();
  }, [mode]);
  return null;
}
