"use client";

import dictionary from "magick-data/enochian/dictionary";
import * as React from "react";
import type { KeysTable } from "./keysTable.ts";
import { createTranslator, KEYS_TABLE_URL, type Translator } from "./lookup.ts";

/**
 * The translator in the browser (plan 081, decision 19): the slim Keys
 * table fetched from `KEYS_TABLE_URL` once per page load, the first time
 * a text needs it or a box is focused, and the index built once. The
 * request carries nothing of the text. The dictionary comes with the page,
 * as on the dictionary's own page, since its entries open from the tiles.
 */

let loading: Promise<Translator> | undefined;

/** The translator, fetched and built once; a failure may be retried. */
export function loadTranslator(): Promise<Translator> {
  // The dictionary's address holds its query: send only the origin.
  loading ??= fetch(KEYS_TABLE_URL, { referrerPolicy: "origin" })
    .then((response) => {
      if (!response.ok)
        throw new Error(`${KEYS_TABLE_URL}: ${response.status}`);
      return response.json() as Promise<KeysTable>;
    })
    .then((table) => createTranslator(table, dictionary))
    .catch((error) => {
      loading = undefined;
      throw error;
    });
  return loading;
}

/** Forgets the translator, so the next load fetches again (for tests). */
export function forgetTranslator() {
  loading = undefined;
}

/** Where the translator is: not asked for yet, on its way, built, or failed. */
export type TranslatorState =
  | { status: "idle" | "loading" | "failed"; translator?: undefined }
  | { status: "ready"; translator: Translator };

/**
 * The translator once `wanted` turns true, with a way to try again after
 * a failure.
 */
export function useTranslator(wanted: boolean) {
  const [state, setState] = React.useState<TranslatorState>({
    status: "idle",
  });
  const [attempt, setAttempt] = React.useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` retries
  React.useEffect(() => {
    if (!wanted) return;
    let live = true;
    setState((was) => (was.status === "ready" ? was : { status: "loading" }));
    loadTranslator().then(
      (translator) => {
        if (live) setState({ status: "ready", translator });
      },
      () => {
        if (live) setState({ status: "failed" });
      },
    );
    return () => {
      live = false;
    };
  }, [wanted, attempt]);
  const retry = React.useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
