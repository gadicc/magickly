"use client";

import * as React from "react";
import {
  DEFAULT_ORATION_VERSION,
  ORATION_VERSIONS,
  type OrationVersion,
} from "./readings";

/**
 * The Oration's version in its URL, `?version=james`, so a reader can share
 * the wording they follow. Read from `window.location` rather than
 * `useSearchParams`, as the tablets' `urlState.ts` does, so the default
 * version stays in the prerendered HTML.
 */

/** The version in a query string; a missing or unknown one is Dee's. */
export function parseOrationQuery(search: string): OrationVersion {
  const value = new URLSearchParams(search).get("version");
  return (
    ORATION_VERSIONS.find((each) => each === value) ?? DEFAULT_ORATION_VERSION
  );
}

/** Fired after this module changes the URL; `popstate` covers the rest. */
const CHANGED = "oration-url";

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
 * The version from the URL, and a way to change it that replaces the URL,
 * keeping other params and the hash.
 */
export function useOrationVersion(): [
  OrationVersion,
  (version: OrationVersion) => void,
] {
  const search = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const version = parseOrationQuery(search);
  const setVersion = React.useCallback((next: OrationVersion) => {
    const url = new URL(window.location.href);
    if (next === DEFAULT_ORATION_VERSION) url.searchParams.delete("version");
    else url.searchParams.set("version", next);
    // Our own state only, as the tablets' and dictionary's URL state do.
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return [version, setVersion];
}
