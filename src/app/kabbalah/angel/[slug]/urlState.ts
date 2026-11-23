"use client";

import * as React from "react";
import {
  ANGEL_SIGIL_STYLES,
  type AngelSigilStyle,
} from "@/render/contracts/angelSigil";

/**
 * The angel page's sigil style in its URL (plan 096, "URL state"):
 * `?style=bare|rose|talisman`, so a style can be shared. The band, the
 * default, is never written, and nothing is stored (decision 5): a link
 * without `?style=` always shows the band.
 *
 * Read from `window.location`, as the tablets page reads its choices
 * (`src/app/enochian/tablets/urlState.ts`), rather than `useSearchParams`,
 * which would render the section in the browser only, up to its Suspense
 * boundary, and draw the figure twice. The server snapshot is empty, so
 * the prerendered HTML carries the band and a shared link shows its style
 * once hydrated. The canonical URL stays the bare path.
 */

/** The style a URL without one shows. */
export const DEFAULT_STYLE: AngelSigilStyle = "band";

/** The style in a query string ("?style=talisman"); unknown is the band. */
export function parseStyleQuery(search: string): AngelSigilStyle {
  const value = new URLSearchParams(search).get("style");
  return ANGEL_SIGIL_STYLES.find((style) => style === value) ?? DEFAULT_STYLE;
}

/** The query string for a style, "" for the band. */
export const styleQuery = (style: AngelSigilStyle): string =>
  style === DEFAULT_STYLE ? "" : `?style=${style}`;

/** Fired after this module changes the URL; `popstate` covers the rest. */
const CHANGED = "angel-sigil-url";

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(CHANGED, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(CHANGED, callback);
  };
}

const getSnapshot = () => window.location.search;
const getServerSnapshot = () => "";

/**
 * The style in the page's URL, and a way to change it that replaces the
 * URL: no navigation, no scroll and no history entry for each style a
 * reader tries. Other params and the hash are kept.
 */
export function useSigilStyleUrl(): [
  AngelSigilStyle,
  (style: AngelSigilStyle) => void,
] {
  const search = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const style = React.useMemo(() => parseStyleQuery(search), [search]);
  const setStyle = React.useCallback((next: AngelSigilStyle) => {
    const url = new URL(window.location.href);
    if (next === DEFAULT_STYLE) url.searchParams.delete("style");
    else url.searchParams.set("style", next);
    // Our own state only: Next's patched history methods add theirs and
    // sync its router (see the dictionary's `urlState.ts`).
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return [style, setStyle];
}
