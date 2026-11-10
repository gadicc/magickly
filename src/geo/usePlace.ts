import { useSyncExternalStore } from "react";
import {
  CHOSEN_PLACE_KEY,
  DETECTED_PLACE_KEY,
  takeEarlyPlaceLookup,
} from "./earlyPlaceLookup";
import { type Place, toPlace } from "./place";
import { deviceTimeZone } from "./timeZone";

/**
 * Where a place came from: searched for and chosen, the visitor's IP
 * (`/api/geo`), or the device's own position ("Use my precise location").
 */
export type PlaceSource = "chosen" | "ip" | "device";

/** A place and where it came from. */
export type SourcedPlace = Place & { source: PlaceSource };

/**
 * `loading` until the place is known or known to be unknown: on the server,
 * while hydrating, and during the first IP lookup. `unknown` when nothing was
 * chosen and the lookup failed, timed out or found nothing; pages then offer
 * the place picker.
 */
export type PlaceStatus = "loading" | "ready" | "unknown";

/** What `usePlace` reads: a place exactly when `status` is `ready`. */
export interface PlaceSnapshot {
  status: PlaceStatus;
  place: SourcedPlace | null;
}

/** A place store; `usePlace` uses one per page load. */
export interface PlaceStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): PlaceSnapshot;
  /**
   * Remembers a place the reader chose, in this tab, the others and later
   * visits (`localStorage`). A device position is rounded to 3 decimals
   * (about 100 m) first, and given the device's time zone unless it has
   * one, so that the planetary hours know its date past the date line.
   * Throws a RangeError for coordinates out of range.
   */
  setPlace(place: Place, source: "chosen" | "device"): void;
  /** Forgets the chosen place, going back to the IP lookup's. */
  clearPlace(): void;
  /** Stops listening and abandons a lookup in flight; for tests. */
  dispose(): void;
}

export { CHOSEN_PLACE_KEY, DETECTED_PLACE_KEY };

const VERSION = 1;
/** How long the IP lookup may take before the place is `unknown`. */
export const PLACE_LOOKUP_TIMEOUT_MS = 5000;

const LOADING: PlaceSnapshot = Object.freeze({
  status: "loading",
  place: null,
});
const UNKNOWN: PlaceSnapshot = Object.freeze({
  status: "unknown",
  place: null,
});

type StorageKind = "localStorage" | "sessionStorage";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// Every storage access can throw: a SecurityError when site data is blocked,
// a QuotaExceededError on write, a SyntaxError from someone else's JSON.
function read(kind: StorageKind, key: string): unknown {
  try {
    const raw = window[kind].getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(kind: StorageKind, key: string, value: unknown) {
  try {
    window[kind].setItem(key, JSON.stringify(value));
  } catch {
    // Remembered for this page load only.
  }
}

function forget(kind: StorageKind, key: string) {
  try {
    window[kind].removeItem(key);
  } catch {
    // Nothing to forget, or no access to forget it.
  }
}

function readChosen(): SourcedPlace | null {
  const stored = read("localStorage", CHOSEN_PLACE_KEY);
  if (!isRecord(stored) || stored.version !== VERSION) return null;
  const { source } = stored;
  if (source !== "chosen" && source !== "device") return null;
  const place = toPlace(stored.place);
  return place && { ...place, source };
}

function readDetected(): SourcedPlace | null {
  const stored = read("sessionStorage", DETECTED_PLACE_KEY);
  if (!isRecord(stored) || stored.version !== VERSION) return null;
  const place = toPlace(stored.place);
  return place && { ...place, source: "ip" };
}

const round3 = (degrees: number) => Math.round(degrees * 1000) / 1000;

/** `/api/geo`'s parsed body, or `undefined` when it failed. */
async function fetchBody(signal: AbortSignal): Promise<unknown> {
  try {
    const response = await fetch("/api/geo", { cache: "no-store", signal });
    return response.ok ? await response.json() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The IP lookup: `/api/geo`'s place, `null` when it answered that it does
 * not know, or `undefined` when it failed (offline, timed out, an error
 * status or an answer that is not one). It takes the lookup the page's
 * `<head>` started, when there is one (`earlyPlaceLookup.ts`).
 */
async function lookUp(): Promise<Place | null | undefined> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<undefined>((resolve) => {
    timer = setTimeout(resolve, PLACE_LOOKUP_TIMEOUT_MS, undefined);
  });
  try {
    const body = await Promise.race([
      takeEarlyPlaceLookup() ?? fetchBody(controller.signal),
      timedOut,
    ]);
    if (!isRecord(body) || !("place" in body)) return undefined;
    if (body.place === null) return null;
    return toPlace(body.place) ?? undefined;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

/**
 * A place store (plan 072): the place the reader chose (`localStorage`),
 * else the IP lookup's, else unknown.
 *
 * The lookup starts when the first component subscribes, at most one at a
 * time for all of them. A place it finds is remembered for the tab's session
 * (`sessionStorage`), so moving between pages does not ask again; an answer
 * of "unknown" is kept for the page load. A failure is not remembered: the
 * next page, or the browser coming back `online`, tries again, and the
 * status stays `unknown` meanwhile rather than flickering to `loading`.
 */
export function createPlaceStore(): PlaceStore {
  const listeners = new Set<() => void>();
  let loaded = false;
  let chosen: SourcedPlace | null = null;
  let detected: SourcedPlace | null = null;
  let lookup: "idle" | "pending" | "answered" | "failed" = "idle";
  let hasFailed = false;
  let generation = 0;
  let snapshot = LOADING;

  function load() {
    if (loaded) return;
    loaded = true;
    chosen = readChosen();
    detected = readDetected();
    if (detected) lookup = "answered";
    // Whoever loads first, the subscriber or the snapshot, nobody has seen
    // the old snapshot, so it is replaced without telling anyone.
    snapshot = compute();
  }

  function compute(): PlaceSnapshot {
    const place = chosen ?? detected;
    if (place) return { status: "ready", place };
    if (lookup === "answered" || lookup === "failed" || hasFailed) {
      return UNKNOWN;
    }
    return LOADING;
  }

  function update() {
    const next = compute();
    if (next.status === snapshot.status && next.place === snapshot.place) {
      return;
    }
    snapshot = next;
    for (const listener of [...listeners]) listener();
  }

  async function runLookup() {
    const attempt = ++generation;
    lookup = "pending";
    update();
    const found = await lookUp();
    if (attempt !== generation) return; // disposed meanwhile
    if (found === undefined) {
      lookup = "failed";
      hasFailed = true;
    } else {
      lookup = "answered";
      if (found) {
        detected = { ...found, source: "ip" };
        write("sessionStorage", DETECTED_PLACE_KEY, {
          version: VERSION,
          place: found,
        });
      }
    }
    update();
  }

  /** Starts the lookup unless a place is known or a lookup is under way. */
  function lookUpIfNeeded(retry: boolean) {
    if (chosen || detected || lookup === "pending" || lookup === "answered") {
      return;
    }
    if (lookup === "failed" && (!retry || navigator.onLine === false)) return;
    void runLookup();
  }

  function onOnline() {
    lookUpIfNeeded(true);
  }

  function onStorage(event: StorageEvent) {
    // `key` is null when another tab cleared the whole storage.
    if (event.key !== CHOSEN_PLACE_KEY && event.key !== null) return;
    load();
    chosen = readChosen();
    update();
    lookUpIfNeeded(false);
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        window.addEventListener("online", onOnline);
        window.addEventListener("storage", onStorage);
      }
      load();
      // The first subscriber is a new page (or the first component on it):
      // a lookup that failed on the last one is worth trying again.
      lookUpIfNeeded(listeners.size === 1);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          window.removeEventListener("online", onOnline);
          window.removeEventListener("storage", onStorage);
        }
      };
    },

    getSnapshot() {
      load();
      return snapshot;
    },

    setPlace(place, source) {
      const valid = toPlace(
        source === "device"
          ? {
              ...place,
              latitude: round3(place.latitude),
              longitude: round3(place.longitude),
              timezone: place.timezone ?? deviceTimeZone(),
            }
          : place,
      );
      if (!valid) throw new RangeError("Not a place");
      load();
      chosen = { ...valid, source };
      write("localStorage", CHOSEN_PLACE_KEY, {
        version: VERSION,
        source,
        place: valid,
      });
      update();
    },

    clearPlace() {
      load();
      chosen = null;
      forget("localStorage", CHOSEN_PLACE_KEY);
      update();
      lookUpIfNeeded(true);
    },

    dispose() {
      generation++;
      for (const listener of [...listeners]) listeners.delete(listener);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("storage", onStorage);
    },
  };
}

let store = createPlaceStore();

/** Replaces the page's store with a fresh one; for tests. */
export function resetPlaceStore() {
  store.dispose();
  store = createPlaceStore();
}

const serverSnapshot = () => LOADING;

/**
 * The reader's place for the planetary hours, the moon and the geomancy
 * reading (plan 072), and the means to change it.
 *
 * `loading` on the server and in the first client render, so prerendered
 * HTML hydrates without a mismatch; then the chosen place, the IP lookup's,
 * or `unknown`. `setPlace` and `clearPlace` update every component using
 * the hook and the site's other tabs.
 */
export default function usePlace() {
  const current = store;
  const snapshot = useSyncExternalStore(
    current.subscribe,
    current.getSnapshot,
    serverSnapshot,
  );
  return {
    status: snapshot.status,
    place: snapshot.place,
    setPlace: current.setPlace,
    clearPlace: current.clearPlace,
  };
}
