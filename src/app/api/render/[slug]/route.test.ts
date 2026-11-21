import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET } from "./route";

const get = (slug: string, query = "") =>
  GET(new Request(`https://magick.ly/api/render/${slug}${query}`), {
    params: Promise.resolve({ slug }),
  });

describe("/api/render/[slug]", () => {
  it.each([
    ["", "/gd/halls/neophyte/golden-dawn-neophyte-temple.svg"],
    [
      "?fmt=png&hall=zelator-1",
      "/gd/halls/zelator-1/golden-dawn-zelator-1-temple.png",
    ],
    [
      "?hall=portal-2&fmt=png&size=small&download=1",
      "/gd/halls/portal-2/golden-dawn-portal-2-temple-small.png",
    ],
    [
      "?size=medium&fmt=png&hall=theoricus-2",
      "/gd/halls/theoricus-2/golden-dawn-theoricus-2-temple-medium.png",
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

  describe("kamea-sigil", () => {
    const he = (text: string) => encodeURIComponent(text);
    const canonical = (props: Record<string, string>) =>
      `/api/render/kamea-sigil?${new URLSearchParams(props)}`;

    it.each([
      [
        `?text=${he("אגיאל")}&planet=saturn`,
        canonical({ planet: "saturn", text: "אגיאל" }),
      ],
      [
        `?planet=saturn&text=${he("אגיאל")}&finals=false`,
        canonical({ planet: "saturn", text: "אגיאל" }),
      ],
      [
        `?planet=venus&text=${he(" בני  שרפים ")}`,
        canonical({ planet: "venus", text: "בני שרפים" }),
      ],
      [
        `?planet=venus&text=${he("בני שרפים")}`,
        canonical({ planet: "venus", text: "בני שרפים" }),
      ],
      [
        `?planet=luna&finals=true&text=${he("אלים")}&fmt=png&width=300`,
        `${canonical({ fmt: "png", planet: "luna", text: "אלים", finals: "true", width: "300" })}`,
      ],
      [
        `?download=1&planet=saturn&text=${he("זאזל")}`,
        `${canonical({ planet: "saturn", text: "זאזל", download: "1" })}`,
      ],
    ])(
      "sends %s to its canonical query",
      async (query, location) => {
        const response = await get("kamea-sigil", query);
        expect(response.status).toBe(308);
        expect(response.headers.get("location")).toBe(location);
        // The canonical query is drawn, not sent on again.
        const again = await GET(new Request(`https://magick.ly${location}`), {
          params: Promise.resolve({ slug: "kamea-sigil" }),
        });
        expect(again.status).toBe(200);
      },
      30_000,
    );

    it("draws a canonical query, and refuses a wrong one", async () => {
      const response = await get(
        "kamea-sigil",
        `?${new URLSearchParams({ planet: "saturn", text: "אגיאל" })}`,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/svg+xml");
      for (const query of [
        "?planet=saturn",
        "?planet=pluto&text=%D7%90",
        `?planet=saturn&text=${he("א")}&download=2`,
      ])
        expect((await get("kamea-sigil", query)).status).toBe(400);
    });
  });

  it("still draws every other slug", async () => {
    const response = await get("seven-branched-candlestick");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
  });
});
