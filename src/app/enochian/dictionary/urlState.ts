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

function write(how: "push" | "replace", url: string, mark: boolean) {
  const state = { ...window.history.state };
  if (mark) state[MARK] = true;
  else delete state[MARK];
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

  /** Opens a word: one history entry, however many words follow it. */
  const open = React.useCallback((key: string) => {
    const marked = Boolean(window.history.state?.[MARK]);
    write(marked ? "replace" : "push", withParams({ w: key }), true);
  }, []);

  /**
   * Closes the word: back past the entry this page pushed, or, on a link
   * that arrived with `?w=`, drops it, so closing never leaves the site.
   */
  const close = React.useCallback(() => {
    if (window.history.state?.[MARK]) window.history.back();
    else write("replace", withParams({ w: null }), false);
  }, []);

  return { query, word, setQuery, open, close };
}

/** The link to share for a word. */
export function wordLink(key: string) {
  const url = new URL("/enochian/dictionary", window.location.origin);
  url.searchParams.set("w", key);
  return url.toString();
}
