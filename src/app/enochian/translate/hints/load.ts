"use client";

import * as React from "react";
import { type Hint, type HintTable, hintIndex } from "./format.ts";

/**
 * The gap hints in the browser (plan 081, S11): the whole table fetched
 * from `HINTS_URL` once per page load, when the first English-into-
 * Enochian result is shown (gap or none, so the request tells nothing of
 * the text), and looked up here. The request carries nothing of the
 * text, as the Keys table's doesn't (decision 19).
 */

/** Where the page fetches the table (`hints.json/route.ts` serves it). */
export const HINTS_URL = "/enochian/translate/hints.json";

let loading: Promise<ReadonlyMap<string, Hint>> | undefined;

/** The hints, fetched and indexed once; a failure may be retried. */
export function loadHints(): Promise<ReadonlyMap<string, Hint>> {
  // The page's address holds the text in its fragment: send only the origin.
  loading ??= fetch(HINTS_URL, { referrerPolicy: "origin" })
    .then((response) => {
      if (!response.ok) throw new Error(`${HINTS_URL}: ${response.status}`);
      return response.json() as Promise<HintTable>;
    })
    .then(hintIndex)
    .catch((error) => {
      loading = undefined;
      throw error;
    });
  return loading;
}

/** Forgets the hints, so the next load fetches again (for tests). */
export function forgetHints() {
  loading = undefined;
}

/**
 * The hints, fetched when the first English-into-Enochian result is
 * shown, whatever it holds, so the request says nothing about the text.
 * `result` is that result: a hint is extra, so a failed load shows none,
 * and the next result shown tries again.
 */
export function useHints(
  result: unknown,
): ReadonlyMap<string, Hint> | undefined {
  const [hints, setHints] = React.useState<ReadonlyMap<string, Hint>>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new `result` retries
  React.useEffect(() => {
    if (hints) return;
    let live = true;
    // While a load is on its way, this is the same request.
    loadHints().then(
      (loaded) => {
        if (live) setHints(loaded);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [result, hints]);
  return hints;
}
