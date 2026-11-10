import { describe, expect, it } from "vitest";
import { countryName, placeKey, placeLabel } from "./placeLabel";

describe("placeLabel", () => {
  it("names the place, its region and its country", () => {
    expect(
      placeLabel({ name: "Springfield", region: "Illinois", country: "US" }),
    ).toBe("Springfield, Illinois, United States");
  });

  it("leaves out what it doesn't know", () => {
    expect(placeLabel({ name: "Tokyo", country: "JP" })).toBe("Tokyo, Japan");
    expect(placeLabel({ name: "Your location" })).toBe("Your location");
  });

  it("doesn't repeat a part", () => {
    // The IP lookup names a place without a city after its country.
    expect(placeLabel({ name: "United Kingdom", country: "GB" })).toBe(
      "United Kingdom",
    );
    expect(
      placeLabel({ name: "Singapore", region: "Singapore", country: "SG" }),
    ).toBe("Singapore");
    expect(placeLabel({ name: "Kyiv", region: "kyiv", country: "UA" })).toBe(
      "Kyiv, Ukraine",
    );
  });
});

describe("countryName", () => {
  it("gives the English name, or the code where there is none", () => {
    expect(countryName("GB")).toBe("United Kingdom");
    expect(countryName("ZZ")).toBe("Unknown Region");
    expect(countryName("not a code")).toBe("not a code");
  });
});

describe("placeKey", () => {
  it("tells apart places with the same label", () => {
    const a = {
      name: "Springfield",
      region: "Ohio",
      country: "US",
      latitude: 39.92,
      longitude: -83.81,
    };
    const b = { ...a, latitude: 40.1 };
    expect(placeKey(a)).not.toBe(placeKey(b));
    expect(placeKey(a)).toBe(placeKey({ ...a }));
  });
});
