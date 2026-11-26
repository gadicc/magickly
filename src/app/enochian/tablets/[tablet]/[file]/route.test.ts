import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { renderComponentImage } from "@/render/componentImage";
import { GET, generateStaticParams } from "./route";

function get(tablet: string, file: string) {
  return GET(new Request("https://magick.ly/enochian/tablets"), {
    params: Promise.resolve({ tablet, file }),
  });
}

describe("/enochian/tablets/[tablet]/[file]", () => {
  it("prerenders four files for each of the five tablets, named for search", () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(20);
    expect(params.slice(0, 4)).toEqual([
      { tablet: "earth", file: "enochian-earth-tablet.png" },
      { tablet: "earth", file: "enochian-earth-tablet-pyramids.png" },
      { tablet: "earth", file: "enochian-earth-tablet.svg" },
      { tablet: "earth", file: "enochian-earth-tablet-pyramids.svg" },
    ]);
    expect(params).toContainEqual({
      tablet: "union",
      file: "enochian-tablet-of-union-pyramids.png",
    });
  });

  it("serves the bytes the image route draws, the Union's as a sample", async () => {
    // The smallest drawings: the others take the same call, which the
    // files' own test holds to the tool's export (`src/seo/tablets.test.ts`).
    const png = await get("union", "enochian-tablet-of-union.png");
    expect(png.status).toBe(200);
    expect(png.headers.get("content-type")).toBe("image/png");
    expect(png.headers.get("content-disposition")).toBe(
      'inline; filename="enochian-tablet-of-union.png"',
    );
    expect(png.headers.get("x-content-type-options")).toBe("nosniff");
    expect(png.headers.get("cache-control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    // Indexable: the static files are the canonical copies.
    expect(png.headers.get("x-robots-tag")).toBeNull();
    const bytes = Buffer.from(await png.arrayBuffer());
    const drawn = await renderComponentImage(
      "enochian-tablet",
      new URLSearchParams("fmt=png&id=union"),
    );
    expect(bytes.equals(drawn.bytes)).toBe(true);
    expect(png.headers.get("etag")).toBe(
      `"${createHash("sha256").update(bytes).digest("hex")}"`,
    );
    expect(await sharp(bytes).metadata()).toMatchObject({
      width: 496,
      height: 416,
    });

    const svg = await get("union", "enochian-tablet-of-union-pyramids.svg");
    expect(svg.headers.get("content-type")).toBe("image/svg+xml");
    expect(await svg.text()).toBe(
      (
        await renderComponentImage(
          "enochian-tablet-pyramids",
          new URLSearchParams("id=union&symbols=outward"),
        )
      ).bytes.toString("utf8"),
    );
  });

  it("answers 404 for any other name", async () => {
    for (const [tablet, file] of [
      ["earth", "enochian-air-tablet.png"],
      ["earth", "enochian-earth-tablet.jpg"],
      ["earth", "enochian-earth-tablet-pyramids-symbols.png"],
      ["earth", "enochian-earth-tablet-dee.png"],
      ["union", "enochian-union-tablet.png"],
      ["spirit", "enochian-earth-tablet.png"],
      ["constructor", "enochian-earth-tablet.png"],
    ])
      expect((await get(tablet, file)).status).toBe(404);
  });
});
