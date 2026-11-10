"use client";

import * as React from "react";

/**
 * The dictionary's state in its URL (plan 074, decision 8): `?q=` the query
 * and `?w=` the open word, so a search or an entry can be shared and Back
 * closes an entry.
 *
 * It is read from `window.location` rather than `useSearchParams`, which
 * would render the list in the browser only and drop it from the
 * prerendered HTML that search engines read (decision 7). The server
 * snapshot is empty, so a shared link first renders the whole list, then
 * its query and entry once hydrated.
 */

/** Marks the history entry pushed when a word opens, so closing goes back. */
const MARK = "dictionaryEntry";
/** Fired after this module changes the URL; `popstate` covers the rest. */
const CHANGED = "dictionary-url";

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

/** The URL with its `q` and `w` changed; `null` removes one. */
function withParams(changes: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [name, value] of Object.entries(changes))
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
  return url.pathname + url.search + url.hash;
}

/**
 * Writes the URL with only our own state: Next's patched history methods
 * copy its internals in and sync its router (`useSearchParams`, the
 * sign-in link's return URL), but skip state that already carries them.
 */
function write(how: "push" | "replace", url: string, mark: boolean) {
  const state = mark ? { [MARK]: true } : null;
  if (how === "push") window.history.pushState(state, "", url);
  else window.history.replaceState(state, "", url);
  window.dispatchEvent(new Event(CHANGED));
}

/** The query and open word in the URL, and ways to change them. */
export function useDictionaryUrl() {
  const search = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const params = React.useMemo(() => new URLSearchParams(search), [search]);
  const query = params.get("q") ?? "";
  const word = params.get("w");

  /** Keeps the query in the URL, without a history entry per keystroke. */
  const setQuery = React.useCallback((text: string) => {
    const marked = Boolean(window.history.state?.[MARK]);
    write("replace", withParams({ q: text.trim() || null }), marked);
  }, []);

  /**
   * Opens a word: one history entry, however many words follow it. On a
   * link that arrived with a word, the new word replaces it, so one close
   * leaves the entries.
   */
  const open = React.useCallback((key: string) => {
    const marked = Boolean(window.history.state?.[MARK]);
    const arrived =
      !marked && new URL(window.location.href).searchParams.has("w");
    write(
      marked || arrived ? "replace" : "push",
      withParams({ w: key }),
      !arrived,
    );
  }, []);

  // Set while a close goes back, until the traversal lands.
  const closing = React.useRef(false);
  React.useEffect(() => {
    const done = () => {
      closing.current = false;
    };
    window.addEventListener("popstate", done);
    return () => window.removeEventListener("popstate", done);
  }, []);

  /**
   * Closes the word: back past the entry this page pushed, or, on a link
   * that arrived with `?w=`, drops it, so closing never leaves the site.
   */
  const close = React.useCallback(() => {
    // A double tap must not go back twice and leave the page.
    if (closing.current) return;
    if (window.history.state?.[MARK]) {
      closing.current = true;
      window.history.back();
    } else write("replace", withParams({ w: null }), false);
  }, []);

  return { query, word, setQuery, open, close };
}

/** The link to share for a word. */
export function wordLink(key: string) {
  const url = new URL("/enochian/dictionary", window.location.origin);
  url.searchParams.set("w", key);
  return url.toString();
}
