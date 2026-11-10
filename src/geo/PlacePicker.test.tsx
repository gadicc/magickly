// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Place } from "@/geo/place";
import usePlace, { CHOSEN_PLACE_KEY, resetPlaceStore } from "@/geo/usePlace";
import PlacePicker, {
  isReaderEdit,
  LOCATION_MESSAGES,
  SEARCH_DEBOUNCE_MS,
} from "./PlacePicker";

const london: Place = {
  name: "London",
  region: "England",
  country: "GB",
  latitude: 51.5085,
  longitude: -0.1257,
  timezone: "Europe/London",
};
const kyiv: Place = {
  name: "Kyiv",
  region: "Kyiv City",
  country: "UA",
  latitude: 50.4547,
  longitude: 30.5238,
  timezone: "Europe/Kyiv",
};
const kievka: Place = {
  name: "Kiyevka",
  region: "Karaganda",
  country: "KZ",
  latitude: 50.2672,
  longitude: 71.5536,
  timezone: "Asia/Almaty",
};
const springfieldIL: Place = {
  name: "Springfield",
  region: "Illinois",
  country: "US",
  latitude: 39.8017,
  longitude: -89.6437,
  timezone: "America/Chicago",
};
const springfieldMO: Place = {
  ...springfieldIL,
  region: "Missouri",
  latitude: 37.2153,
  longitude: -93.2982,
};
const paris: Place = {
  name: "Paris",
  region: "Île-de-France",
  country: "FR",
  latitude: 48.8534,
  longitude: 2.3488,
  timezone: "Europe/Paris",
};
const parma: Place = {
  name: "Parma",
  region: "Emilia-Romagna",
  country: "IT",
  latitude: 44.8015,
  longitude: 10.328,
  timezone: "Europe/Rome",
};

const json = (body: unknown, status = 200) =>
  ({ ok: status === 200, status, json: async () => body }) as Response;

/** Pending `/api/places` requests, answered by the test. */
let searches: {
  q: string;
  signal: AbortSignal;
  resolve(response: Response): void;
  reject(error: unknown): void;
}[];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  resetPlaceStore();
  searches = [];
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === "/api/geo") return Promise.resolve(json({ place: london }));
    const q = new URL(url, "http://localhost").searchParams.get("q") ?? "";
    return new Promise<Response>((resolve, reject) => {
      searches.push({
        q,
        signal: init?.signal as AbortSignal,
        resolve,
        reject,
      });
    });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Shows what the store holds, beside the picker. */
function Shown() {
  const { place } = usePlace();
  return (
    <div data-testid="place">
      {place
        ? `${place.source} ${place.name} ${place.latitude} ${place.longitude}`
        : ""}
    </div>
  );
}

async function renderPicker(onDone = vi.fn()) {
  render(
    <>
      <PlacePicker onDone={onDone} />
      <Shown />
    </>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return onDone;
}

const input = () => screen.getByRole("combobox", { name: "Find a place" });
const type = (text: string) =>
  fireEvent.change(input(), { target: { value: text } });
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const answer = async (index: number, places: Place[]) => {
  await act(async () => {
    searches[index].resolve(json({ places }));
    await vi.advanceTimersByTimeAsync(0);
  });
};
const optionTexts = () =>
  screen.queryAllByRole("option").map((option) => option.textContent);
const placeSearches = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/places"));
/** What the open suggestions list says when it has no options. */
const popupText = () =>
  document.querySelector(".MuiAutocomplete-paper")?.textContent;
/** What the polite live region says. */
const status = () => screen.getByRole("status").textContent;

describe("the place picker", () => {
  it("has a visible label", async () => {
    await renderPicker();
    expect(screen.getByLabelText("Find a place")).toBe(input());
  });

  it("lists the server's places in its order, even when the label doesn't match", async () => {
    await renderPicker();
    type("kiev");
    await wait(SEARCH_DEBOUNCE_MS);
    expect(searches.map((s) => s.q)).toEqual(["kiev"]);
    // Neither label contains "kiev"; MUI's own filter would drop both.
    await answer(0, [kyiv, kievka]);
    expect(optionTexts()).toEqual([
      "Kyiv, Kyiv City, Ukraine",
      "Kiyevka, Karaganda, Kazakhstan",
    ]);
  });

  it("labels places that share a name by region and country", async () => {
    await renderPicker();
    type("springfield");
    await wait(SEARCH_DEBOUNCE_MS);
    await answer(0, [springfieldIL, springfieldMO]);
    expect(optionTexts()).toEqual([
      "Springfield, Illinois, United States",
      "Springfield, Missouri, United States",
    ]);
  });

  it("searches once typing pauses for 250 ms", async () => {
    await renderPicker();
    for (const text of ["p", "pa", "par", "pari", "paris"]) {
      type(text);
      await wait(100);
    }
    await wait(SEARCH_DEBOUNCE_MS - 101);
    expect(placeSearches()).toHaveLength(0);
    await wait(1);
    expect(searches.map((s) => s.q)).toEqual(["paris"]);
  });

  it("doesn't search under 2 characters", async () => {
    await renderPicker();
    type("p");
    await wait(1000);
    expect(placeSearches()).toHaveLength(0);
    expect(screen.getByText("Type at least 2 letters")).toBeTruthy();
  });

  it("ignores a late answer for what was typed before", async () => {
    await renderPicker();
    type("par");
    await wait(SEARCH_DEBOUNCE_MS);
    type("paris");
    await wait(SEARCH_DEBOUNCE_MS);
    expect(searches.map((s) => s.q)).toEqual(["par", "paris"]);
    expect(searches[0].signal.aborted).toBe(true);

    await answer(1, [paris]);
    await answer(0, [parma, paris]);
    expect(optionTexts()).toEqual(["Paris, Île-de-France, France"]);
  });

  it("says it is searching, then that nothing was found", async () => {
    await renderPicker();
    type("xq");
    expect(popupText()).toBe("Searching…");
    await wait(SEARCH_DEBOUNCE_MS);
    expect(popupText()).toBe("Searching…");
    expect(status()).toBe("");
    await answer(0, []);
    expect(popupText()).toBe("No places found");
    expect(status()).toBe("No places found");
  });

  it("announces how many places were found", async () => {
    await renderPicker();
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    type("kiev");
    await wait(SEARCH_DEBOUNCE_MS);
    await answer(0, [kyiv, kievka]);
    expect(status()).toBe("2 places found");
    type("kyiv");
    await wait(SEARCH_DEBOUNCE_MS);
    await answer(1, [kyiv]);
    expect(status()).toBe("1 place found");
  });

  it("keeps the last places on show until the next answer lands", async () => {
    await renderPicker();
    type("par");
    await wait(SEARCH_DEBOUNCE_MS);
    await answer(0, [parma, paris]);
    const both = [
      "Parma, Emilia-Romagna, Italy",
      "Paris, Île-de-France, France",
    ];
    expect(optionTexts()).toEqual(both);
    for (const text of ["pari", "paris"]) {
      type(text);
      expect(optionTexts()).toEqual(both);
      expect(popupText()).not.toContain("Searching…");
      await wait(100);
    }
    await wait(SEARCH_DEBOUNCE_MS);
    expect(optionTexts()).toEqual(both);
    await answer(1, [paris]);
    expect(optionTexts()).toEqual(["Paris, Île-de-France, France"]);
  });

  it.each([
    [
      "the request fails",
      (s: (typeof searches)[number]) => s.reject(new TypeError("offline")),
    ],
    [
      "the server fails",
      (s: (typeof searches)[number]) => s.resolve(json({ error: "x" }, 503)),
    ],
    [
      "the answer isn't a list",
      (s: (typeof searches)[number]) => s.resolve(json({ places: "x" })),
    ],
  ])("says search needs a connection when %s", async (_why, fail) => {
    await renderPicker();
    type("london");
    await wait(SEARCH_DEBOUNCE_MS);
    await act(async () => {
      fail(searches[0]);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(popupText()).toBe("Search needs a connection");
    expect(status()).toBe("Search needs a connection");
  });

  it("says search needs a connection without trying while offline", async () => {
    await renderPicker();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    type("london");
    await wait(SEARCH_DEBOUNCE_MS);
    expect(placeSearches()).toHaveLength(0);
    expect(popupText()).toBe("Search needs a connection");
    expect(status()).toBe("Search needs a connection");
  });

  it("searches again when the browser comes back online", async () => {
    await renderPicker();
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    type("london");
    await wait(SEARCH_DEBOUNCE_MS);
    expect(placeSearches()).toHaveLength(0);
    onLine.mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await wait(SEARCH_DEBOUNCE_MS);
    expect(searches.map((s) => s.q)).toEqual(["london"]);
    await answer(0, [london]);
    expect(optionTexts()).toEqual(["London, England, United Kingdom"]);
    // Only once: a later `online` with nothing failed asks nothing.
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await wait(SEARCH_DEBOUNCE_MS);
    expect(placeSearches()).toHaveLength(1);
  });

  it("takes only the reader's own edits as the search text", () => {
    // MUI 9 fills in the chosen option's label with "selectOption" and
    // resyncs an unfocused field with "reset"; neither is searched for.
    expect(isReaderEdit("input")).toBe(true);
    expect(isReaderEdit("clear")).toBe(true);
    expect(isReaderEdit("blur")).toBe(true);
    expect(isReaderEdit("selectOption")).toBe(false);
    expect(isReaderEdit("reset")).toBe(false);
    expect(isReaderEdit("removeOption")).toBe(false);
  });

  it("keeps a chosen place, and says it's done", async () => {
    const onDone = await renderPicker();
    type("paris");
    await wait(SEARCH_DEBOUNCE_MS);
    await answer(0, [paris]);
    fireEvent.click(screen.getByRole("option", { name: /Paris/ }));
    expect(screen.getByTestId("place").textContent).toBe(
      "chosen Paris 48.8534 2.3488",
    );
    expect(
      JSON.parse(localStorage.getItem(CHOSEN_PLACE_KEY) ?? "").place,
    ).toEqual(paris);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(input()).toHaveProperty("value", "");
    // Nor is the chosen place's label searched for.
    await wait(SEARCH_DEBOUNCE_MS);
    expect(placeSearches()).toHaveLength(1);
  });

  it("credits GeoNames", async () => {
    await renderPicker();
    const link = screen.getByRole("link", { name: "GeoNames" });
    expect(link.getAttribute("href")).toBe("https://www.geonames.org/");
    expect(
      screen.getByRole("link", { name: "CC BY 4.0" }).getAttribute("href"),
    ).toBe("https://creativecommons.org/licenses/by/4.0/");
  });

  describe("the device's precise location", () => {
    let getCurrentPosition: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      getCurrentPosition = vi.fn();
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: { getCurrentPosition },
      });
      Object.defineProperty(window, "isSecureContext", {
        configurable: true,
        value: true,
      });
    });

    afterEach(() => {
      Reflect.deleteProperty(navigator, "geolocation");
      Reflect.deleteProperty(window, "isSecureContext");
    });

    const useLocation = () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Use my precise location" }),
      );

    it("isn't asked for until the button is pressed", async () => {
      await renderPicker();
      expect(getCurrentPosition).not.toHaveBeenCalled();
    });

    it("keeps the position, rounded, as your location", async () => {
      const onDone = await renderPicker();
      getCurrentPosition.mockImplementation((success) =>
        success({ coords: { latitude: 51.508_53, longitude: -0.125_74 } }),
      );
      useLocation();
      expect(screen.getByTestId("place").textContent).toBe(
        "device Your location 51.509 -0.126",
      );
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("says it is finding the position meanwhile", async () => {
      await renderPicker();
      useLocation();
      expect(
        screen.getByRole("button", { name: "Finding your position…" }),
      ).toHaveProperty("disabled", true);
    });

    /** Holds the device's answer until the test gives it. */
    function slowDevice() {
      const answers: {
        success(position: unknown): void;
        failure(error: unknown): void;
      }[] = [];
      getCurrentPosition.mockImplementation((success, failure) =>
        answers.push({ success, failure }),
      );
      const position = {
        coords: { latitude: 35.69, longitude: 139.69 },
      };
      return {
        succeed: () =>
          act(async () => {
            answers[0].success(position);
          }),
        fail: () =>
          act(async () => {
            answers[0].failure({ code: 2 });
          }),
      };
    }

    it("ignores a late position once a place is chosen", async () => {
      const onDone = await renderPicker();
      const device = slowDevice();
      useLocation();
      type("paris");
      await wait(SEARCH_DEBOUNCE_MS);
      await answer(0, [paris]);
      fireEvent.click(screen.getByRole("option", { name: /Paris/ }));
      expect(
        screen.getByRole("button", { name: "Use my precise location" }),
      ).toHaveProperty("disabled", false);
      await device.succeed();
      expect(screen.getByTestId("place").textContent).toBe(
        "chosen Paris 48.8534 2.3488",
      );
      expect(onDone).toHaveBeenCalledTimes(1);
      await device.fail();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("ignores a late position once going back to the detected location", async () => {
      localStorage.setItem(
        CHOSEN_PLACE_KEY,
        JSON.stringify({ version: 1, source: "chosen", place: paris }),
      );
      const onDone = await renderPicker();
      const device = slowDevice();
      useLocation();
      fireEvent.click(
        screen.getByRole("button", { name: "Use detected location" }),
      );
      await wait(0);
      await device.succeed();
      expect(screen.getByTestId("place").textContent).toMatch(/^ip London/);
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("ignores a position that comes after the picker is gone", async () => {
      const onDone = await renderPicker();
      const device = slowDevice();
      useLocation();
      cleanup();
      await device.succeed();
      expect(localStorage.getItem(CHOSEN_PLACE_KEY)).toBeNull();
      expect(onDone).not.toHaveBeenCalled();
    });

    it.each([
      [1, LOCATION_MESSAGES.denied],
      [2, LOCATION_MESSAGES.unavailable],
      [3, LOCATION_MESSAGES.timeout],
    ])("explains error %i", async (code, message) => {
      const onDone = await renderPicker();
      getCurrentPosition.mockImplementation((_success, failure) =>
        failure({ code }),
      );
      useLocation();
      expect(screen.getByRole("alert").textContent).toBe(message);
      expect(screen.getByTestId("place").textContent).toBe(
        "ip London 51.5085 -0.1257",
      );
      expect(onDone).not.toHaveBeenCalled();
    });

    it("explains that it needs https", async () => {
      Object.defineProperty(window, "isSecureContext", {
        configurable: true,
        value: false,
      });
      await renderPicker();
      useLocation();
      expect(getCurrentPosition).not.toHaveBeenCalled();
      expect(screen.getByRole("alert").textContent).toBe(
        LOCATION_MESSAGES.insecure,
      );
    });

    it("explains when the browser has no geolocation", async () => {
      Reflect.deleteProperty(navigator, "geolocation");
      await renderPicker();
      useLocation();
      expect(screen.getByRole("alert").textContent).toBe(
        LOCATION_MESSAGES.unsupported,
      );
    });
  });

  describe("going back to the detected location", () => {
    const back = () =>
      screen.queryByRole("button", { name: "Use detected location" });

    it("isn't offered for the detected location itself", async () => {
      await renderPicker();
      expect(screen.getByTestId("place").textContent).toMatch(/^ip /);
      expect(back()).toBeNull();
    });

    it("forgets a chosen place", async () => {
      localStorage.setItem(
        CHOSEN_PLACE_KEY,
        JSON.stringify({ version: 1, source: "chosen", place: paris }),
      );
      const onDone = await renderPicker();
      expect(screen.getByTestId("place").textContent).toMatch(/^chosen Paris/);
      fireEvent.click(back() as HTMLElement);
      await wait(0);
      expect(localStorage.getItem(CHOSEN_PLACE_KEY)).toBeNull();
      expect(screen.getByTestId("place").textContent).toMatch(/^ip London/);
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("is offered for the device's position", async () => {
      localStorage.setItem(
        CHOSEN_PLACE_KEY,
        JSON.stringify({
          version: 1,
          source: "device",
          place: { name: "Your location", latitude: 1, longitude: 2 },
        }),
      );
      await renderPicker();
      expect(back()).toBeTruthy();
    });
  });
});
