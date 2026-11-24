// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shareRowText } from "../../../../tests/exportControls";
import { renderWithShare, tapShare } from "../../../../tests/pageShare";
import GeomancyReading from "./reading";
import { readingFromSearchParams, readingSearchParams } from "./readingState";

// As in reading.hint.test.tsx: no spirit sigils, no place, no network.
vi.mock("magick-components/astrology/PlanetarySpirit", () => ({
  default: () => null,
}));
vi.mock("@/geo/usePlace", () => ({
  default: () => ({
    status: "loading",
    place: null,
    setPlace: () => {},
    clearPlace: () => {},
  }),
}));

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

// The reading stays out of the address (plan 027), so Share sends the
// link the page registers: the one "Copy page link" copied before.
describe("the geomancy reading's Share", () => {
  it("sends the link that restores the reading, as personal", () => {
    const initial = readingFromSearchParams(
      new URLSearchParams({
        m: "1121212211122112",
        house: "7",
        planet: "mars",
      }),
    );
    const { shared } = renderWithShare(<GeomancyReading initial={initial} />);
    expect(shared()?.url()).toBe(
      `/geomancy/reading?${readingSearchParams(initial)}`,
    );
    expect(shared()?.url()).toContain("m=1121212211122112");
    expect(shared()?.url()).toContain("house=7");
    expect(shared()?.url()).toContain("planet=mars");
    expect(shared()?.personal).toBe(true);
    expect(shareRowText()).toEqual(["This page", "Includes what you entered"]);
  });

  it("follows the reading as it changes", async () => {
    const initial = readingFromSearchParams(new URLSearchParams());
    renderWithShare(<GeomancyReading initial={initial} />);
    const before = await tapShare();
    expect(before.copied).toEqual([
      `${window.location.origin}/geomancy/reading?${readingSearchParams(initial)}`,
    ]);
    expect(before.said).toBe(
      "Copied link to this page. It includes what you entered here.",
    );
    fireEvent.mouseDown(
      screen
        .getAllByRole("combobox")
        .find((box) => box.id === "house-select") as HTMLElement,
    );
    fireEvent.click(screen.getByRole("option", { name: /^7th House/ }));
    expect((await tapShare()).copied).toEqual([
      `${window.location.origin}/geomancy/reading?${readingSearchParams({ ...initial, house: "7" })}`,
    ]);
  });
});
