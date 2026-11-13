// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import data from "magick-data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GeomancyReading from "./reading";
import { readingFromSearchParams } from "./readingState";

// The spirit sigils are left out; see reading.test.tsx.
vi.mock("@/components/astrology/planetarySpirits", () => ({
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

/** The planet select: the one whose closed text names the reading's planet. */
const planetSelect = () =>
  screen
    .getAllByRole("combobox")
    .find((box) => box.id === "planet-select") as HTMLElement;

const saturn = data.planet.saturn.keyOfSolomon?.en as string;

describe("the geomancy reading's planetary hints", () => {
  it("shows each planet's Key of Solomon sentence, clamped, in the open menu only", () => {
    render(
      <GeomancyReading
        initial={readingFromSearchParams(new URLSearchParams({ house: "1" }))}
      />,
    );
    fireEvent.mouseDown(planetSelect());
    expect(screen.queryAllByTestId("planet-hint")).toHaveLength(0);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });

    fireEvent.click(screen.getByRole("switch"));
    // The closed select keeps to one line.
    expect(within(planetSelect()).queryByTestId("planet-hint")).toBeNull();

    fireEvent.mouseDown(planetSelect());
    const hints = within(screen.getByRole("listbox")).getAllByTestId(
      "planet-hint",
    );
    expect(hints).toHaveLength(7);
    const hint = hints.find((h) => h.title === saturn) as HTMLElement;
    expect(hint).toBeDefined();
    expect(hint.textContent).toBe(`“${saturn}”`);
    expect(hint.style.webkitLineClamp).toBe("3");
    expect(hint.style.overflow).toBe("hidden");
  });
});
