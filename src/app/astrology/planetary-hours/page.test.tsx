// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Data from "@/../data/data";
import PlanetaryHoursPage from "./page";

// The GeoIP lookup is a fetch; a fixed place stands in for it, since the
// hours themselves are not under test. It is one object, as the hook's state
// is: the page's effect depends on it, and a new one each render would loop.
vi.mock("@magick-components/hooks/useGeoIP", () => {
  const london = {
    city: "London",
    country: "United Kingdom",
    latitude: 51.5245,
    longitude: -0.1567,
  };
  return { default: () => london };
});

afterEach(cleanup);

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
});
