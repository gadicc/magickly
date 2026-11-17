// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Data from "magick-data";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlanetaryHoursPage from "./page";

// The place store reads storage and fetches `/api/geo`; a fixed answer
// stands in for it. It is one object per test, as the store's snapshot is:
// the page's effect depends on the place, and a new one each render would
// loop.
const london = {
  name: "London",
  region: "England",
  country: "GB",
  latitude: 51.5245,
  longitude: -0.1567,
  timezone: "Europe/London",
  source: "ip",
};
const geo = vi.hoisted(() => ({
  state: { status: "ready", place: null as unknown },
}));
vi.mock("@/geo/usePlace", () => ({
  default: () => ({ ...geo.state, setPlace: () => {}, clearPlace: () => {} }),
}));
const ready = (place: unknown) => ({ status: "ready", place });
beforeEach(() => {
  geo.state = ready(london);
  // The picker searches only when typed into; nothing here fetches.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("no network in tests"))),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Pretends the device's clock is in `zone`, for the time-zone note. */
function deviceZone(zone: string) {
  const real = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(
    function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), timeZone: zone };
    },
  );
}

/**
 * The planetary hours page's select, which reads the Key of Solomon from the
 * planet data (plan 039, decision 6).
 *
 * The seven texts were written into the client component until the planet
 * rows took them; the server page now passes them down. This renders the
 * route's page, opens the select, and holds each option to its planet's
 * `keyOfSolomon.en`, in the order and with the values the select has always
 * had, so the page reads as it did.
 */
describe("the planetary hours page", () => {
  it("labels each planet with its Key of Solomon text from the planet data", () => {
    render(<PlanetaryHoursPage />);
    fireEvent.mouseDown(screen.getByRole("combobox"));
    const options = screen.getAllByRole("option").map((option) => ({
      value: option.getAttribute("data-value"),
      text: option.textContent,
    }));

    const order = [
      "sol",
      "venus",
      "mercury",
      "luna",
      "saturn",
      "jupiter",
      "mars",
    ] as const;
    expect(options).toEqual(
      order.map((id) => ({
        value: id,
        text: `${id[0].toUpperCase()}${id.slice(1)}: ${Data.planet[id].keyOfSolomon?.en}`,
      })),
    );
    // Every text is there: none of the seven reads "undefined".
    for (const option of options)
      expect(option.text).not.toContain("undefined");
  });

  it("still cites the Key of Solomon", () => {
    render(<PlanetaryHoursPage />);
    expect(document.body.textContent).toContain(
      "Planetary influences sourced from The Key of Solomon, chapter 2 (MacGregor Mathers, 1888).",
    );
  });

  describe("inside the polar circles", () => {
    const tromso = {
      name: "Tromsø",
      country: "NO",
      latitude: 69.65,
      longitude: 18.96,
      source: "ip",
    };
    const NO_SUNRISE = "The sun does not rise here on this day.";
    const NO_SUNSET = "The sun does not set here on this day.";
    const NO_NIGHT_HOURS =
      "This night has no hours here, since the sun neither rises nor sets the next day.";

    function renderTromsoOn(iso: string) {
      geo.state = ready(tromso);
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(iso));
      render(<PlanetaryHoursPage />);
      return document.body.textContent ?? "";
    }

    /** How many times the text appears in the page. */
    const count = (text: string, sentence: string) =>
      text.split(sentence).length - 1;

    it("says the sun does not rise on each day of the polar night", () => {
      const text = renderTromsoOn("2026-12-01T12:00:00Z");
      expect(count(text, NO_SUNRISE)).toBe(7);
      expect(document.querySelector("table")).toBeNull();
      expect(text).toContain("Tuesday (Dec 1)");
    });

    it("says the sun does not set on each day of the midnight sun", () => {
      const text = renderTromsoOn("2026-06-10T12:00:00Z");
      expect(count(text, NO_SUNSET)).toBe(7);
      expect(document.querySelector("table")).toBeNull();
    });

    it("shows the hours up to the polar night, and the last night without them", () => {
      // The 25th, 26th and 27th have hours; from the 28th the sun does not rise.
      const text = renderTromsoOn("2026-11-25T12:00:00Z");
      // Collapsed days are in the page but hidden, so not queried by role.
      const tables = document.querySelectorAll("table");
      expect(tables).toHaveLength(3);
      expect(tables[0].querySelectorAll("tr")).toHaveLength(24);
      expect(tables[2].querySelectorAll("tr")).toHaveLength(12);
      expect(count(text, NO_NIGHT_HOURS)).toBe(1);
      expect(count(text, NO_SUNRISE)).toBe(4);
    });
  });

  describe("the place", () => {
    it("says it is finding the location while loading, and shows no hours", () => {
      geo.state = { status: "loading", place: null };
      render(<PlanetaryHoursPage />);
      expect(screen.getByRole("status").textContent).toBe(
        "Finding your location…",
      );
      expect(screen.queryByRole("combobox")).toBeNull();
      expect(document.querySelector("table")).toBeNull();
    });

    it("prerenders the loading line", () => {
      geo.state = { status: "loading", place: null };
      expect(renderToString(<PlanetaryHoursPage />)).toContain(
        "Finding your location…",
      );
    });

    it("offers the picker when the location is unknown", () => {
      geo.state = { status: "unknown", place: null };
      render(<PlanetaryHoursPage />);
      expect(document.body.textContent).toContain(
        "Your location couldn't be found. Choose a place to see its planetary hours.",
      );
      expect(
        screen.getByRole("combobox", { name: "Find a place" }),
      ).toBeTruthy();
      expect(document.querySelector("table")).toBeNull();
    });

    it("names the place, with its coordinates and a way to change it", () => {
      render(<PlanetaryHoursPage />);
      expect(document.body.textContent).toContain(
        "London, England, United Kingdom (51.525, -0.157)",
      );
      expect(
        screen.queryByRole("combobox", { name: "Find a place" }),
      ).toBeNull();
      const change = screen.getByRole("button", { name: "Change place" });
      expect(change.textContent).toBe("Change");
      expect(change.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(change);
      expect(change.getAttribute("aria-expanded")).toBe("true");
      expect(
        screen.getByRole("combobox", { name: "Find a place" }),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Close place search" })).toBe(
        change,
      );
    });

    it("notes the device's time zone for a place on another clock", () => {
      deviceZone("Europe/London");
      geo.state = ready({
        name: "Tokyo",
        country: "JP",
        latitude: 35.6895,
        longitude: 139.6917,
        timezone: "Asia/Tokyo",
        source: "chosen",
      });
      render(<PlanetaryHoursPage />);
      expect(document.body.textContent).toContain(
        "Times are in your device's time zone (Europe/London).",
      );
    });

    it("has no note when the zones differ only in name", () => {
      deviceZone("Asia/Calcutta");
      geo.state = ready({
        name: "Kolkata",
        region: "West Bengal",
        country: "IN",
        latitude: 22.5626,
        longitude: 88.363,
        timezone: "Asia/Kolkata",
        source: "chosen",
      });
      render(<PlanetaryHoursPage />);
      expect(document.body.textContent).toContain(
        "Kolkata, West Bengal, India",
      );
      expect(document.body.textContent).not.toContain("Times are in");
    });

    it("has no note for the device's own position", () => {
      deviceZone("Europe/London");
      geo.state = ready({
        name: "Your location",
        latitude: 35.69,
        longitude: 139.692,
        timezone: "Asia/Tokyo",
        source: "device",
      });
      render(<PlanetaryHoursPage />);
      expect(document.body.textContent).toContain(
        "Your location (35.690, 139.692)",
      );
      expect(document.body.textContent).not.toContain("Times are in");
    });
  });
});
