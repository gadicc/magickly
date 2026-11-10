import { describe, expect, it } from "vitest";
import { placeFromVercelHeaders, UNNAMED_PLACE } from "./vercelGeo";

const LONDON = {
  "x-vercel-ip-latitude": "51.5074",
  "x-vercel-ip-longitude": "-0.1278",
  "x-vercel-ip-city": "London",
  "x-vercel-ip-country": "GB",
  "x-vercel-ip-country-region": "ENG",
  "x-vercel-ip-timezone": "Europe/London",
};

function parse(overrides: Record<string, string | null> = {}) {
  const headers = new Headers();
  for (const [key, value] of Object.entries({ ...LONDON, ...overrides })) {
    if (value !== null) headers.set(key, value);
  }
  return placeFromVercelHeaders(headers);
}

describe("placeFromVercelHeaders", () => {
  it("reads every header, leaving the region code out", () => {
    expect(parse()).toEqual({
      name: "London",
      country: "GB",
      latitude: 51.5074,
      longitude: -0.1278,
      timezone: "Europe/London",
    });
  });

  it("decodes an RFC 3986-encoded city", () => {
    expect(parse({ "x-vercel-ip-city": "S%C3%A3o%20Paulo" })?.name).toBe(
      "São Paulo",
    );
  });

  it("names a place after its country when the city is malformed", () => {
    const place = parse({ "x-vercel-ip-city": "Bad%E0%A4%A" });
    expect(place).toMatchObject({ name: "United Kingdom", latitude: 51.5074 });
  });

  it("names a place after its country when there is no city", () => {
    expect(parse({ "x-vercel-ip-city": null })?.name).toBe("United Kingdom");
  });

  it("falls back to a generic name with no city or country", () => {
    const place = parse({
      "x-vercel-ip-city": null,
      "x-vercel-ip-country": null,
    });
    expect(place?.name).toBe(UNNAMED_PLACE);
    expect(place).not.toHaveProperty("country");
  });

  it.each([
    ["latitude missing", { "x-vercel-ip-latitude": null }],
    ["longitude missing", { "x-vercel-ip-longitude": null }],
    ["latitude empty", { "x-vercel-ip-latitude": "" }],
    ["latitude not a number", { "x-vercel-ip-latitude": "north" }],
    ["latitude in exponent form", { "x-vercel-ip-latitude": "5e1" }],
    ["latitude out of range", { "x-vercel-ip-latitude": "90.5" }],
    ["longitude out of range", { "x-vercel-ip-longitude": "-181" }],
  ])("is null with %s", (_label, overrides) => {
    expect(parse(overrides)).toBeNull();
  });

  it("drops a malformed country or an unknown time zone", () => {
    const place = parse({
      "x-vercel-ip-city": null,
      "x-vercel-ip-country": "GBR",
      "x-vercel-ip-timezone": "Not/AZone",
    });
    expect(place).toEqual({
      name: UNNAMED_PLACE,
      latitude: 51.5074,
      longitude: -0.1278,
    });
  });
});
