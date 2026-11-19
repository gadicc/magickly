"use client";

import {
  DEFAULT_TABLET_VERSION,
  TABLET_VERSIONS,
  type TabletVersionId,
} from "magick-data/enochian/tablets";
import * as React from "react";
import { TABLET_IDS } from "@/render/contracts/enochianTablet";

/**
 * The tablets page's choices in its URL (plan 090, decision 1):
 * `?tablet=` and `?version=`, so a view can be shared.
 *
 * Read from `window.location` rather than `useSearchParams`, which would
 * render the page in the browser only and drop it from the prerendered
 * HTML, as the dictionary's `urlState.ts` does. The server snapshot is
 * empty, so only the default view is prerendered and a shared link shows
 * its tablet once hydrated.
 */

/** A tablet the page offers. */
export type TabletId = (typeof TABLET_IDS)[number];

/** The page's choices that its URL holds. */
export interface TabletChoice {
  tablet: TabletId;
  version: TabletVersionId;
}

/** The view a URL without choices shows: Earth, the default version. */
export const DEFAULT_CHOICE: TabletChoice = {
  tablet: "earth",
  version: DEFAULT_TABLET_VERSION,
};

const oneOf = <T extends string>(
  value: string | null,
  values: readonly T[],
): T | undefined => values.find((each) => each === value);

/**
 * The choices in a query string ("?tablet=air&version=dee"); a missing
 * or unknown value is the default's.
 */
export function parseTabletQuery(search: string): TabletChoice {
  const params = new URLSearchParams(search);
  return {
    tablet: oneOf(params.get("tablet"), TABLET_IDS) ?? DEFAULT_CHOICE.tablet,
    version:
      oneOf(params.get("version"), TABLET_VERSIONS) ?? DEFAULT_CHOICE.version,
  };
}

/** The choices' own params, the defaults left out. */
function choiceParams(choice: TabletChoice): Record<string, string | null> {
  return {
    tablet: choice.tablet === DEFAULT_CHOICE.tablet ? null : choice.tablet,
    version: choice.version === DEFAULT_CHOICE.version ? null : choice.version,
  };
}

/**
 * The query string for the choices, "" for the default view
 * ("?tablet=air&version=dee", "?version=dee").
 */
export function tabletQuery(choice: TabletChoice): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(choiceParams(choice)))
    if (value) params.set(name, value);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Fired after this module changes the URL; `popstate` covers the rest. */
const CHANGED = "tablets-url";

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
 * The page's choices from its URL, and a way to change them that replaces
 * the URL: a reader trying the tablets in turn gets no history entry for
 * each. Other params and the hash are kept.
 */
export function useTabletUrl(): [
  TabletChoice,
  (change: Partial<TabletChoice>) => void,
] {
  const search = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const choice = React.useMemo(() => parseTabletQuery(search), [search]);
  const setChoice = React.useCallback((change: Partial<TabletChoice>) => {
    const url = new URL(window.location.href);
    const next = { ...parseTabletQuery(url.search), ...change };
    for (const [name, value] of Object.entries(choiceParams(next)))
      if (value) url.searchParams.set(name, value);
      else url.searchParams.delete(name);
    // Our own state only: Next's patched history methods add theirs and
    // sync its router (see the dictionary's `urlState.ts`).
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return [choice, setChoice];
}
