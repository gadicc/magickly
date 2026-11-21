"use client";
import {
  type KameaSigilFigure,
  kameaSigil,
} from "magick-components/astrology/KameaSigil";
import type { KameaPlanetId } from "magick-data/astrology/kameas";
import React from "react";
import { kameaSigilKey } from "./kameaSigilState";

/** A text to trace, as the worker is sent it. */
export interface KameaSigilRequest {
  id: number;
  planet: KameaPlanetId;
  text: string;
  finals: boolean;
}

/** The worker's answer: the figure, or why there is none. */
export type KameaSigilResponse =
  | { id: number; sigil: KameaSigilFigure }
  | { id: number; error: string };

/** How long typing must pause before a text is placed, in milliseconds. */
export const KAMEA_SIGIL_DEBOUNCE = 250;

/** Figures kept for texts placed before, so going back is instant. */
const CACHE_SIZE = 32;

const figureKey = (sigil: KameaSigilFigure) =>
  kameaSigilKey(sigil.planet, sigil.text, sigil.finals);

/** What the hook says about the figure for its arguments. */
export interface KameaSigilPlacement {
  /** The newest figure placed, for these arguments or the last ones. */
  sigil: KameaSigilFigure | null;
  /** True until the figure for these arguments is placed. */
  pending: boolean;
  /**
   * True while a placement for these arguments has actually started
   * (after the debounce): never in the server's HTML.
   */
  placing: boolean;
  /** Why the figure for these arguments could not be worked out at all. */
  error?: string;
}

interface State {
  key: string | null;
  sigil: KameaSigilFigure | null;
  placing: boolean;
  error?: string;
}

/**
 * The figure for `planet`, `text` and `finals`, placed off the main thread
 * (plan 093, K3): a word placement cannot clear costs seconds of
 * synchronous work. Placement waits for typing to pause
 * (`KAMEA_SIGIL_DEBOUNCE`) and runs in a worker; a worker still busy when
 * newer input arrives is ended and another started, so the newest text is
 * never queued behind an old one. Until its figure comes back the last one
 * stays, with `pending` set. Every figure that comes back is kept by its
 * own key, a superseded one too, so returning to a text is instant.
 *
 * Where there is no worker (a test's DOM), or one cannot be started or
 * fails (a sandbox, a content security policy, a script that will not
 * load), placement falls back to the main thread in the same debounced
 * callback, for the rest of the page's life.
 *
 * `seed`, a figure the server worked out for the first arguments, is
 * drawn at once and kept, so the page's HTML has it.
 */
export function useKameaSigil(
  planet: KameaPlanetId,
  text: string,
  finals: boolean,
  seed?: KameaSigilFigure | null,
): KameaSigilPlacement {
  const key = kameaSigilKey(planet, text, finals);
  const cache = React.useRef<Map<string, KameaSigilFigure> | null>(null);
  if (!cache.current)
    cache.current = new Map(seed ? [[figureKey(seed), seed]] : []);
  const worker = React.useRef<{ worker: Worker; busy: number | null } | null>(
    null,
  );
  // Set once a worker could not be started or failed: the main thread
  // places from then on.
  const noWorker = React.useRef(false);
  // The newest request: an answer to any other is stale.
  const latest = React.useRef<KameaSigilRequest & { key: string }>({
    id: 0,
    key: "",
    planet,
    text,
    finals,
  });
  const [state, setState] = React.useState<State>(() => ({
    key: seed ? figureKey(seed) : null,
    sigil: seed ?? null,
    placing: false,
  }));

  React.useEffect(
    () => () => {
      worker.current?.worker.terminate();
      worker.current = null;
    },
    [],
  );

  React.useEffect(() => {
    const request = { id: latest.current.id + 1, key, planet, text, finals };
    latest.current = request;
    const store = cache.current as Map<string, KameaSigilFigure>;
    const remember = (sigil: KameaSigilFigure) => {
      const at = figureKey(sigil);
      store.delete(at);
      store.set(at, sigil);
      if (store.size > CACHE_SIZE)
        store.delete(store.keys().next().value as string);
    };
    const isLatest = () => latest.current.id === request.id;
    const known = store.get(key);
    if (known) {
      setState({ key, sigil: known, placing: false });
      return;
    }
    /** Places the newest request here, on the main thread. */
    const placeHere = () => {
      const newest = latest.current;
      try {
        const sigil = kameaSigil(newest.planet, newest.text, {
          finals: newest.finals,
        });
        remember(sigil);
        if (latest.current.id === newest.id)
          setState({ key: newest.key, sigil, placing: false });
      } catch (error) {
        if (latest.current.id === newest.id)
          setState((last) => ({
            ...last,
            key: newest.key,
            placing: false,
            error: String(error),
          }));
      }
    };
    /** Gives up on workers for this page; the main thread places. */
    const fallBack = () => {
      noWorker.current = true;
      worker.current?.worker.terminate();
      worker.current = null;
      // Let the status paint before the main thread is busy.
      setTimeout(placeHere, 0);
    };
    const timer = setTimeout(() => {
      setState((last) => ({ ...last, placing: true }));
      if (noWorker.current || typeof Worker === "undefined") {
        setTimeout(placeHere, 0);
        return;
      }
      // A worker still placing an older text is ended, not waited for.
      if (worker.current?.busy != null) {
        worker.current.worker.terminate();
        worker.current = null;
      }
      if (!worker.current) {
        let created: Worker;
        try {
          created = new Worker(
            new URL("./kameaSigil.worker.ts", import.meta.url),
            { type: "module" },
          );
        } catch {
          fallBack();
          return;
        }
        const own = { worker: created, busy: null as number | null };
        created.onmessage = (event: MessageEvent<KameaSigilResponse>) => {
          own.busy = null;
          const response = event.data;
          // A superseded figure is still kept for its own text.
          if ("sigil" in response) remember(response.sigil);
          if (response.id !== latest.current.id) return;
          const { key: at } = latest.current;
          if ("sigil" in response)
            setState({ key: at, sigil: response.sigil, placing: false });
          else
            setState((last) => ({
              ...last,
              key: at,
              placing: false,
              error: response.error,
            }));
        };
        // A worker that cannot load, or whose answer cannot be read.
        const failed = () => {
          if (worker.current !== own) {
            created.terminate();
            return;
          }
          fallBack();
        };
        created.onerror = failed;
        created.onmessageerror = failed;
        worker.current = own;
      }
      if (!isLatest()) return;
      worker.current.busy = request.id;
      worker.current.worker.postMessage({
        id: request.id,
        planet,
        text,
        finals,
      } satisfies KameaSigilRequest);
    }, KAMEA_SIGIL_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [key, planet, text, finals]);

  return {
    sigil: state.sigil,
    pending: state.key !== key,
    placing: state.placing && state.key !== key,
    error: state.key === key ? state.error : undefined,
  };
}
