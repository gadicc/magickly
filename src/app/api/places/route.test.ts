import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@/geo/server/places", () => ({ searchPlaces: mocks.search }));

const london = {
  name: "London",
  region: "England",
  country: "GB",
  latitude: 51.509,
  longitude: -0.126,
  timezone: "Europe/London",
};
const get = (query: string) =>
  GET(new Request(`https://magickly.example.test/api/places${query}`));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.search.mockReturnValue([london]);
});

describe("place search endpoint", () => {
  it("answers the search for q, cacheable by browsers and the CDN", async () => {
    const response = get("?q=lond%C3%B3n%2C%20gb");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=86400, s-maxage=604800",
    );
    expect(await response.json()).toEqual({ places: [london] });
    expect(mocks.search).toHaveBeenCalledWith("londón, gb");
  });

  it("treats a missing q as an empty search, not an error", async () => {
    mocks.search.mockReturnValue([]);
    const response = get("");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ places: [] });
    expect(mocks.search).toHaveBeenCalledWith("");
  });

  it("answers 503, uncached, when the data can't be read", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.search.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const response = get("?q=london");
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
