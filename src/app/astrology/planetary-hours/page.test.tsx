// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Data from "magick-data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlanetaryHoursPage from "./page";

// The GeoIP lookup is a fetch; a fixed place stands in for it. It is one
// object per test, as the hook's state is: the page's effect depends on it,
// and a new one each render would loop.
const london = {
  city: "London",
  country: "United Kingdom",
  latitude: 51.5245,
  longitude: -0.1567,
};
const geo = vi.hoisted(() => ({ place: null as unknown }));
vi.mock("@magick-components/hooks/useGeoIP", () => ({
  default: () => geo.place,
}));
beforeEach(() => {
  geo.place = london;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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
      city: "Tromsø",
      country: "Norway",
      latitude: 69.65,
      longitude: 18.96,
    };
    const NO_SUNRISE = "The sun does not rise here on this day.";
    const NO_SUNSET = "The sun does not set here on this day.";
    const NO_NIGHT_HOURS =
      "This night has no hours here, since the sun neither rises nor sets the next day.";

    function renderTromsoOn(iso: string) {
      geo.place = tromso;
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
});
