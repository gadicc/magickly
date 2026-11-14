"use client";

import * as React from "react";
import type { Language } from "./lookup.ts";

/**
 * The translator's state in the URL's fragment (plan 081, decision 19):
 * `#q=` the text and `#dir=` a direction the reader chose, so a
 * translation can be shared. Never the query string: a fragment stays in
 * the browser, so the text never reaches the server, its logs or
 * analytics (which send no fragment either).
 *
 * Read from `window.location` with an empty server snapshot, so the
 * prerendered page is the empty tool and a shared link fills in once
 * hydrated.
 */

/** What the fragment holds. */
export interface TranslateState {
  /** The text, as typed (trimmed). */
  q: string;
  /** The direction the reader chose with the switch; null to guess. */
  dir: Language | null;
}

/** Fired after this module changes the fragment; `hashchange` covers the rest. */
const CHANGED = "translate-fragment";

/**
 * Calls `callback` whenever the fragment may have changed: typed or
 * followed (`hashchange`), Back or Forward (`popstate`), or written here.
 */
function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  window.addEventListener(CHANGED, callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
    window.removeEventListener(CHANGED, callback);
  };
}

/** The fragment now, as typed into the address bar or written here. */
const getSnapshot = () => window.location.hash;
/** On the server, and while hydrating, there is none: the empty tool. */
const getServerSnapshot = () => "";

/**
 * The state a fragment holds; an unknown `dir` is a guess. Null for a
 * fragment that isn't ours, an anchor such as `#translator-text`, which
 * leaves the text alone; no fragment at all is the empty state.
 */
export function readFragment(hash: string): TranslateState | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (hash.replace(/^#/, "") && !params.has("q") && !params.has("dir"))
    return null;
  const dir = params.get("dir");
  return {
    q: params.get("q") ?? "",
    dir: dir === "english" || dir === "enochian" ? dir : null,
  };
}

/** The fragment for a state, "" for an empty one. */
export function fragmentOf({ q, dir }: TranslateState): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (dir) params.set("dir", dir);
  const text = params.toString();
  return text ? `#${text}` : "";
}

/**
 * The fragment's state (null when it isn't ours), and a way to write it:
 * replacing the history entry, so typing adds none, and keeping the path
 * and any query.
 */
export function useTranslateFragment() {
  const hash = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const state = React.useMemo(() => readFragment(hash), [hash]);
  const write = React.useCallback((next: TranslateState) => {
    const { pathname, search } = window.location;
    window.history.replaceState(null, "", pathname + search + fragmentOf(next));
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return { state, write };
}
