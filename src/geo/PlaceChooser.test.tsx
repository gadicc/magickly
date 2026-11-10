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
import { CHOSEN_PLACE_KEY, resetPlaceStore } from "@/geo/usePlace";
import PlaceChooser from "./PlaceChooser";
import { SEARCH_DEBOUNCE_MS } from "./PlacePicker";

const london: Place = {
  name: "London",
  region: "England",
  country: "GB",
  latitude: 51.5085,
  longitude: -0.1257,
  timezone: "Europe/London",
};
const paris: Place = {
  name: "Paris",
  region: "Île-de-France",
  country: "FR",
  latitude: 48.8534,
  longitude: 2.3488,
  timezone: "Europe/Paris",
};

const json = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  resetPlaceStore();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      json(url === "/api/geo" ? { place: london } : { places: [paris] }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

async function renderChooser(label?: string) {
  render(<PlaceChooser summary="London" label={label} />);
  await wait(0);
}

describe("the place chooser", () => {
  it("names its button with the context its short text leaves out", async () => {
    await renderChooser();
    const toggle = screen.getByRole("button", { name: "Change place" });
    expect(toggle.textContent).toBe("Change");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Close place search" })).toBe(
      toggle,
    );
    expect(toggle.textContent).toBe("Close");
  });

  it("keeps a text that already says place", async () => {
    await renderChooser("Choose a place");
    expect(
      screen.getByRole("button", { name: "Choose a place" }).textContent,
    ).toBe("Choose a place");
  });

  it("puts the focus back on its button after a place is chosen", async () => {
    await renderChooser();
    const toggle = screen.getByRole("button", { name: "Change place" });
    fireEvent.click(toggle);
    const input = screen.getByRole("combobox", { name: "Find a place" });
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: "paris" } });
    await wait(SEARCH_DEBOUNCE_MS);
    fireEvent.click(screen.getByRole("option", { name: /Paris/ }));
    expect(localStorage.getItem(CHOSEN_PLACE_KEY)).toContain("Paris");
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    // Still there once the picker has collapsed and unmounted.
    await wait(1000);
    expect(screen.queryByRole("combobox", { name: "Find a place" })).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("puts the focus back on its button after going back to the detected place", async () => {
    localStorage.setItem(
      CHOSEN_PLACE_KEY,
      JSON.stringify({ version: 1, source: "chosen", place: paris }),
    );
    await renderChooser();
    const toggle = screen.getByRole("button", { name: "Change place" });
    fireEvent.click(toggle);
    fireEvent.click(
      screen.getByRole("button", { name: "Use detected location" }),
    );
    expect(document.activeElement).toBe(toggle);
  });
});
