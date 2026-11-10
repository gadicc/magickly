// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Place } from "./place";
import {
  CHOSEN_PLACE_KEY,
  createPlaceStore,
  DETECTED_PLACE_KEY,
  PLACE_LOOKUP_TIMEOUT_MS,
  type PlaceStore,
} from "./usePlace";

const london: Place = {
  name: "London",
  region: "England",
  country: "GB",
  latitude: 51.5085,
  longitude: -0.1257,
  timezone: "Europe/London",
};
const tokyo: Place = {
  name: "Tokyo",
  country: "JP",
  latitude: 35.6895,
  longitude: 139.6917,
  timezone: "Asia/Tokyo",
};

/** A `/api/geo` response. */
const answer = (body: unknown, status = 200) =>
  ({ ok: status === 200, status, json: async () => body }) as Response;

/** A fetch that answers when the test says, or fails when aborted. */
function deferredFetch() {
  const pending: { resolve(response: Response): void; signal: AbortSignal }[] =
    [];
  const fetch = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const signal = init.signal as AbortSignal;
        signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
        pending.push({ resolve, signal });
      }),
  );
  return { fetch, pending };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const stored = (place: unknown, source = "chosen", version = 1) =>
  JSON.stringify({ version, source, place });

let store: PlaceStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fetchMock = vi.fn(async () => answer({ place: london }));
  vi.stubGlobal("fetch", fetchMock);
  store = createPlaceStore();
});

afterEach(() => {
  store.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the place store", () => {
  it("is loading, then has the IP's place", async () => {
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.getSnapshot()).toEqual({ status: "loading", place: null });
    await flush();
    expect(store.getSnapshot()).toEqual({
      status: "ready",
      place: { ...london, source: "ip" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/geo");
    expect(listener).toHaveBeenCalled();
  });

  it("asks once for every component that subscribes", async () => {
    store.subscribe(() => {});
    store.subscribe(() => {});
    store.subscribe(() => {});
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the same snapshot until something changes", async () => {
    store.subscribe(() => {});
    await flush();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("prefers a chosen place and then asks nothing", async () => {
    localStorage.setItem(CHOSEN_PLACE_KEY, stored(tokyo));
    store.subscribe(() => {});
    expect(store.getSnapshot()).toEqual({
      status: "ready",
      place: { ...tokyo, source: "chosen" },
    });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["corrupt JSON", "{not json"],
    ["another version", stored(tokyo, "chosen", 2)],
    ["no version", JSON.stringify({ source: "chosen", place: tokyo })],
    ["a source that can't be chosen", stored(tokyo, "ip")],
    ["a latitude out of range", stored({ ...tokyo, latitude: 91 })],
    ["coordinates as strings", stored({ ...tokyo, latitude: "35.7" })],
    ["no name", stored({ ...tokyo, name: "" })],
    ["not an object", "42"],
  ])("ignores a stored place with %s", async (_why, raw) => {
    localStorage.setItem(CHOSEN_PLACE_KEY, raw);
    store.subscribe(() => {});
    await flush();
    expect(store.getSnapshot().place).toEqual({ ...london, source: "ip" });
  });

  it("works for the page load when storage throws", async () => {
    const blocked = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(blocked);

    store.subscribe(() => {});
    await flush();
    expect(store.getSnapshot().place?.source).toBe("ip");
    store.setPlace(tokyo, "chosen");
    expect(store.getSnapshot().place).toEqual({ ...tokyo, source: "chosen" });
    store.clearPlace();
    expect(store.getSnapshot().place?.source).toBe("ip");
  });

  it("remembers the IP's place for the session, so the next page asks nothing", async () => {
    store.subscribe(() => {});
    await flush();
    expect(
      JSON.parse(sessionStorage.getItem(DETECTED_PLACE_KEY) ?? ""),
    ).toEqual({ version: 1, place: london });

    const next = createPlaceStore();
    next.subscribe(() => {});
    expect(next.getSnapshot()).toEqual({
      status: "ready",
      place: { ...london, source: "ip" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    next.dispose();
  });

  it("is unknown when the server doesn't know, and asks again next page load", async () => {
    fetchMock.mockImplementation(async () => answer({ place: null }));
    store.subscribe(() => {});
    await flush();
    expect(store.getSnapshot()).toEqual({ status: "unknown", place: null });
    expect(sessionStorage.getItem(DETECTED_PLACE_KEY)).toBeNull();
  });

  it.each([
    ["the network fails", () => Promise.reject(new TypeError("offline"))],
    ["an error status", async () => answer({ error: "down" }, 503)],
    ["an answer without a place", async () => answer({ city: "London" })],
    [
      "a place out of range",
      async () => answer({ place: { ...london, latitude: 200 } }),
    ],
    [
      "not JSON",
      async () =>
        ({
          ok: true,
          json: () => Promise.reject(new SyntaxError("x")),
        }) as unknown as Response,
    ],
  ])(
    "is unknown when %s, and tries again on the next page",
    async (_why, fail) => {
      fetchMock.mockImplementation(fail);
      const unsubscribe = store.subscribe(() => {});
      await flush();
      expect(store.getSnapshot()).toEqual({ status: "unknown", place: null });
      expect(sessionStorage.getItem(DETECTED_PLACE_KEY)).toBeNull();

      // Another component on the same page doesn't retry.
      store.subscribe(() => {})();
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // The next page's first component does, and stays unknown meanwhile.
      unsubscribe();
      const lookup = deferredFetch();
      vi.stubGlobal("fetch", lookup.fetch);
      store.subscribe(() => {});
      expect(lookup.fetch).toHaveBeenCalledTimes(1);
      expect(store.getSnapshot().status).toBe("unknown");
      lookup.pending[0].resolve(answer({ place: london }));
      await flush();
      expect(store.getSnapshot().place).toEqual({ ...london, source: "ip" });
    },
  );

  it("gives up after 5 seconds", async () => {
    vi.useFakeTimers();
    const lookup = deferredFetch();
    vi.stubGlobal("fetch", lookup.fetch);
    store.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(PLACE_LOOKUP_TIMEOUT_MS - 1);
    expect(store.getSnapshot().status).toBe("loading");
    await vi.advanceTimersByTimeAsync(1);
    expect(lookup.pending[0].signal.aborted).toBe(true);
    expect(store.getSnapshot()).toEqual({ status: "unknown", place: null });
  });

  it("tries again when the browser comes back online", async () => {
    fetchMock.mockImplementation(() =>
      Promise.reject(new TypeError("offline")),
    );
    store.subscribe(() => {});
    await flush();
    expect(store.getSnapshot().status).toBe("unknown");

    fetchMock.mockImplementation(async () => answer({ place: london }));
    window.dispatchEvent(new Event("online"));
    expect(store.getSnapshot().status).toBe("unknown");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().place).toEqual({ ...london, source: "ip" });
  });

  it("doesn't retry on a new page while the browser is offline", async () => {
    fetchMock.mockImplementation(() =>
      Promise.reject(new TypeError("offline")),
    );
    store.subscribe(() => {})();
    await flush();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    store.subscribe(() => {});
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tells every subscriber, and stores a versioned place, when one is chosen", async () => {
    const first = vi.fn();
    const second = vi.fn();
    store.subscribe(first);
    store.subscribe(second);
    await flush();
    first.mockClear();
    second.mockClear();

    store.setPlace(tokyo, "chosen");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({
      status: "ready",
      place: { ...tokyo, source: "chosen" },
    });
    expect(JSON.parse(localStorage.getItem(CHOSEN_PLACE_KEY) ?? "")).toEqual({
      version: 1,
      source: "chosen",
      place: tokyo,
    });
  });

  /** Pretends the device's clock is in `zone`. */
  function deviceZone(zone: string) {
    const real = Intl.DateTimeFormat.prototype.resolvedOptions;
    vi.spyOn(
      Intl.DateTimeFormat.prototype,
      "resolvedOptions",
    ).mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), timeZone: zone };
    });
  }

  it("rounds the device's position to 3 decimals and gives it the device's zone", () => {
    deviceZone("Pacific/Apia");
    store.setPlace(
      { name: "Your location", latitude: 51.508_53, longitude: -0.125_74 },
      "device",
    );
    const expected = {
      name: "Your location",
      latitude: 51.509,
      longitude: -0.126,
      timezone: "Pacific/Apia",
    };
    expect(store.getSnapshot().place).toEqual({
      ...expected,
      source: "device",
    });
    expect(
      JSON.parse(localStorage.getItem(CHOSEN_PLACE_KEY) ?? "").place,
    ).toEqual(expected);
  });

  it("keeps a device position without a zone when the device's is unusable", () => {
    deviceZone("Not/A_Zone");
    store.setPlace(
      { name: "Your location", latitude: 51.5, longitude: -0.1 },
      "device",
    );
    expect(store.getSnapshot().place).toEqual({
      name: "Your location",
      latitude: 51.5,
      longitude: -0.1,
      source: "device",
    });
  });

  it("gives a searched place no zone but its own", () => {
    deviceZone("Pacific/Apia");
    const { timezone: _, ...noZone } = tokyo;
    store.setPlace(noZone, "chosen");
    expect(store.getSnapshot().place?.timezone).toBeUndefined();
  });

  it("keeps a searched place's coordinates as they are", () => {
    store.setPlace(london, "chosen");
    expect(store.getSnapshot().place?.latitude).toBe(51.5085);
  });

  it("refuses a place that isn't one", () => {
    expect(() =>
      store.setPlace(
        { name: "Nowhere", latitude: Number.NaN, longitude: 0 },
        "chosen",
      ),
    ).toThrow(RangeError);
    expect(localStorage.getItem(CHOSEN_PLACE_KEY)).toBeNull();
  });

  it("goes back to the IP's place when the chosen one is cleared", async () => {
    localStorage.setItem(CHOSEN_PLACE_KEY, stored(tokyo));
    store.subscribe(() => {});
    store.clearPlace();
    expect(localStorage.getItem(CHOSEN_PLACE_KEY)).toBeNull();
    expect(store.getSnapshot().status).toBe("loading");
    await flush();
    expect(store.getSnapshot().place).toEqual({ ...london, source: "ip" });
  });

  it("follows a place chosen or cleared in another tab", async () => {
    store.subscribe(() => {});
    await flush();

    localStorage.setItem(CHOSEN_PLACE_KEY, stored(tokyo));
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    expect(store.getSnapshot().place?.source).toBe("ip");
    window.dispatchEvent(
      new StorageEvent("storage", { key: CHOSEN_PLACE_KEY }),
    );
    expect(store.getSnapshot().place).toEqual({ ...tokyo, source: "chosen" });

    localStorage.removeItem(CHOSEN_PLACE_KEY);
    window.dispatchEvent(
      new StorageEvent("storage", { key: CHOSEN_PLACE_KEY }),
    );
    expect(store.getSnapshot().place).toEqual({ ...london, source: "ip" });
  });

  it("stops listening when the last component unsubscribes", async () => {
    const unsubscribe = store.subscribe(() => {});
    await flush();
    unsubscribe();
    localStorage.setItem(CHOSEN_PLACE_KEY, stored(tokyo));
    window.dispatchEvent(
      new StorageEvent("storage", { key: CHOSEN_PLACE_KEY }),
    );
    expect(store.getSnapshot().place?.source).toBe("ip");
  });
});
