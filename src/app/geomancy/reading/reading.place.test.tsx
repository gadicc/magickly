// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GeomancyReading from "./reading";
import { readingFromSearchParams } from "./readingState";

// The spirit sigils are SVG imports; see reading.test.tsx.
vi.mock("@/components/astrology/planetarySpirits", () => ({
  default: () => null,
}));

// One object per test, as the store's snapshot is.
const geo = vi.hoisted(() => ({
  state: { status: "loading", place: null as unknown },
}));
vi.mock("@/geo/usePlace", () => ({
  default: () => ({ ...geo.state, setPlace: () => {}, clearPlace: () => {} }),
}));

const london = {
  name: "London",
  region: "England",
  country: "GB",
  latitude: 51.5085,
  longitude: -0.1257,
  source: "ip",
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("no network in tests"))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderReading = () =>
  render(
    <GeomancyReading
      initial={readingFromSearchParams(new URLSearchParams({ house: "1" }))}
    />,
  );

/** The hours select: the one whose closed text names the planetary hour. */
const hoursSelect = () =>
  screen
    .getAllByRole("combobox")
    .find((box) =>
      box.textContent?.startsWith("Planetary Hour for"),
    ) as HTMLElement;

describe("the geomancy reading's planetary hours", () => {
  it("lists nothing, and names no place, while loading", () => {
    geo.state = { status: "loading", place: null };
    renderReading();
    expect(hoursSelect().textContent).toBe("Planetary Hour for Luna");
    expect(screen.queryByRole("button", { name: /place/ })).toBeNull();
    fireEvent.mouseDown(hoursSelect());
    expect(
      within(screen.getByRole("listbox")).getAllByRole("option"),
    ).toHaveLength(1);
  });

  it("says the location is unknown and offers to choose a place", () => {
    geo.state = { status: "unknown", place: null };
    renderReading();
    expect(document.body.textContent).toContain(
      "Your location couldn't be found, so there are no hours to list.",
    );
    expect(hoursSelect().textContent).toBe("Planetary Hour for Luna");
    fireEvent.click(screen.getByRole("button", { name: "Choose a place" }));
    expect(screen.getByRole("combobox", { name: "Find a place" })).toBeTruthy();
  });

  it("lists the hours in the place, with a way to change it", () => {
    geo.state = { status: "ready", place: london };
    renderReading();
    expect(hoursSelect().textContent).toBe("Planetary Hour for Luna in London");
    expect(screen.getByRole("button", { name: "Change place" })).toBeTruthy();
    fireEvent.mouseDown(hoursSelect());
    // Luna rules several hours in any week.
    expect(
      within(screen.getByRole("listbox")).getAllByRole("option").length,
    ).toBeGreaterThan(5);
  });

  it.each([
    [
      {
        name: "Your location",
        latitude: 51.5,
        longitude: -0.1,
        source: "device",
      },
      "at your location",
    ],
    [
      { name: "Your area", latitude: 51.5, longitude: -0.1, source: "ip" },
      "in your area",
    ],
    [
      {
        name: "United Kingdom",
        country: "GB",
        latitude: 51.5,
        longitude: -0.1,
        source: "ip",
      },
      "in United Kingdom",
    ],
  ])("words the place %#", (place, words) => {
    geo.state = { status: "ready", place };
    renderReading();
    expect(hoursSelect().textContent).toBe(`Planetary Hour for Luna ${words}`);
  });
});
