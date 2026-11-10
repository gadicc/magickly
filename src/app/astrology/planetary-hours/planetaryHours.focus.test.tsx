// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEARCH_DEBOUNCE_MS } from "@/geo/PlacePicker";
import { resetPlaceStore } from "@/geo/usePlace";
import PlanetaryHours, { type HourPlanet } from "./planetaryHours";

const paris = {
  name: "Paris",
  region: "Île-de-France",
  country: "FR",
  latitude: 48.8534,
  longitude: 2.3488,
  timezone: "Europe/Paris",
};

const json = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;

const keyOfSolomon = Object.fromEntries(
  ["sol", "venus", "mercury", "luna", "saturn", "jupiter", "mars"].map((p) => [
    p,
    `${p} text`,
  ]),
) as Record<HourPlanet, string>;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  resetPlaceStore();
  // The IP lookup knows no place; the search finds Paris.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      json(url === "/api/geo" ? { place: null } : { places: [paris] }),
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

describe("the planetary hours for an unknown location", () => {
  it("moves the focus to the place line once a place is chosen", async () => {
    render(<PlanetaryHours keyOfSolomon={keyOfSolomon} />);
    await wait(0);
    const input = screen.getByRole("combobox", { name: "Find a place" });
    input.focus();
    fireEvent.change(input, { target: { value: "paris" } });
    await wait(SEARCH_DEBOUNCE_MS);
    fireEvent.click(screen.getByRole("option", { name: /Paris/ }));

    expect(screen.queryByRole("combobox", { name: "Find a place" })).toBeNull();
    expect(document.body.textContent).toContain(
      "Paris, Île-de-France, France (48.853, 2.349)",
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Change place" }),
    );
  });

  it("doesn't take the focus for a place it found itself", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ place: paris })),
    );
    render(<PlanetaryHours keyOfSolomon={keyOfSolomon} />);
    await wait(0);
    expect(screen.getByRole("button", { name: "Change place" })).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
  });
});
