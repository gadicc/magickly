import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET } from "./route";

const get = (slug: string, query = "") =>
  GET(new Request(`https://magick.ly/api/render/${slug}${query}`), {
    params: Promise.resolve({ slug }),
  });

describe("/api/render/[slug]", () => {
  it.each([
    ["", "/gd/hall/neophyte/golden-dawn-neophyte-temple.svg"],
    [
      "?fmt=png&hall=zelator-1",
      "/gd/hall/zelator-1/golden-dawn-zelator-1-temple.png",
    ],
    [
      "?hall=portal-2&fmt=png&size=small&download=1",
      "/gd/hall/portal-2/golden-dawn-portal-2-temple-small.png",
    ],
    [
      "?size=medium&fmt=png&hall=theoricus-2",
      "/gd/hall/theoricus-2/golden-dawn-theoricus-2-temple-medium.png",
    ],
  ])("sends gd-hall%s to the hall's static file", async (query, path) => {
    const response = await get("gd-hall", query);
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(path);
  });

  it("refuses a gd-hall query the contract refuses", async () => {
    for (const query of ["?hall=nope", "?width=300", "?size=small"]) {
      const response = await get("gd-hall", query);
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("still draws every other slug", async () => {
    const response = await get("seven-branched-candlestick");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
  });
});
