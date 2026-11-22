import { createHash } from "node:crypto";
import { KAMEA_PLANETS } from "magick-data/astrology/kameas";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { renderComponentImage } from "@/render/componentImage";
import { GET, generateStaticParams } from "./route";

function get(planet: string, file: string) {
  return GET(new Request("https://magick.ly/astrology/kamea"), {
    params: Promise.resolve({ planet, file }),
  });
}

describe("/astrology/kamea/[planet]/[file]", () => {
  it("prerenders a PNG and an SVG for each of the seven, named for search", () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(14);
    expect(params.map((entry) => entry.planet)).toEqual(
      KAMEA_PLANETS.flatMap((planet) => [planet, planet]),
    );
    expect(params.slice(0, 2)).toEqual([
      { planet: "saturn", file: "kamea-of-saturn-magic-square.png" },
      { planet: "saturn", file: "kamea-of-saturn-magic-square.svg" },
    ]);
    // The Sun and the Moon by the words a search uses.
    expect(params).toContainEqual({
      planet: "sol",
      file: "kamea-of-the-sun-magic-square.svg",
    });
    expect(params).toContainEqual({
      planet: "luna",
      file: "kamea-of-the-moon-magic-square.png",
    });
  });

  it("serves the same bytes as the image route draws for the square", async () => {
    const png = await get("saturn", "kamea-of-saturn-magic-square.png");
    expect(png.status).toBe(200);
    expect(png.headers.get("content-type")).toBe("image/png");
    expect(png.headers.get("content-disposition")).toBe(
      'inline; filename="kamea-of-saturn-magic-square.png"',
    );
    expect(png.headers.get("x-content-type-options")).toBe("nosniff");
    expect(png.headers.get("cache-control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    // Indexable: the static files are the canonical copies.
    expect(png.headers.get("x-robots-tag")).toBeNull();
    const bytes = Buffer.from(await png.arrayBuffer());
    const drawn = await renderComponentImage(
      "kamea",
      new URLSearchParams({ planet: "saturn", fmt: "png" }),
    );
    expect(bytes.equals(drawn.bytes)).toBe(true);
    expect(png.headers.get("etag")).toBe(
      `"${createHash("sha256").update(bytes).digest("hex")}"`,
    );
    expect(await sharp(bytes).metadata()).toMatchObject({
      width: 1024,
      height: 1024,
    });

    const svg = await get("luna", "kamea-of-the-moon-magic-square.svg");
    expect(svg.headers.get("content-type")).toBe("image/svg+xml");
    expect(await svg.text()).toBe(
      (
        await renderComponentImage(
          "kamea",
          new URLSearchParams({ planet: "luna" }),
        )
      ).bytes.toString("utf8"),
    );
  });

  it("answers 404 for any other name", async () => {
    for (const [planet, file] of [
      ["saturn", "kamea-of-jupiter-magic-square.png"],
      ["saturn", "kamea-of-saturn-magic-square.jpg"],
      ["sol", "kamea-of-sol-magic-square.png"],
      ["sigils", "kamea-of-saturn-magic-square.png"],
      ["constructor", "kamea-of-saturn-magic-square.png"],
    ])
      expect((await get(planet, file)).status).toBe(404);
  });
});
