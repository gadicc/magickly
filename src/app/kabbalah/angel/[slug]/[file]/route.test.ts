import { createHash } from "node:crypto";
import angels from "magick-data/kabbalah/seventyTwoAngels";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { angelSlug } from "@/lib/angelSlugs";
import { renderComponentImage } from "@/render/componentImage";
import { GET, generateStaticParams } from "./route";

function get(slug: string, file: string) {
  return GET(new Request("https://magick.ly/kabbalah/angel"), {
    params: Promise.resolve({ slug, file }),
  });
}

describe("/kabbalah/angel/[slug]/[file]", () => {
  it("prerenders a PNG and an SVG for each of the 72, named by its slug", () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(144);
    expect(params).toEqual(
      angels.flatMap((angel) => {
        const slug = angelSlug(angel.no);
        return [
          { slug, file: `${slug}-rose-cross-sigil.png` },
          { slug, file: `${slug}-rose-cross-sigil.svg` },
        ];
      }),
    );
    expect(params.slice(0, 2)).toEqual([
      { slug: "vehuiah", file: "vehuiah-rose-cross-sigil.png" },
      { slug: "vehuiah", file: "vehuiah-rose-cross-sigil.svg" },
    ]);
    // Lauviah is the 11th and the 17th; each keeps its number.
    expect(params).toContainEqual({
      slug: "lauviah-17",
      file: "lauviah-17-rose-cross-sigil.svg",
    });
  });

  it("serves the same bytes as the image route draws for the name", async () => {
    const png = await get("vehuiah", "vehuiah-rose-cross-sigil.png");
    expect(png.status).toBe(200);
    expect(png.headers.get("content-type")).toBe("image/png");
    expect(png.headers.get("content-disposition")).toBe(
      'inline; filename="vehuiah-rose-cross-sigil.png"',
    );
    expect(png.headers.get("x-content-type-options")).toBe("nosniff");
    // Stable names, not content-addressed: revalidated against the ETag.
    expect(png.headers.get("cache-control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    // Indexable: the static files are the canonical copies.
    expect(png.headers.get("x-robots-tag")).toBeNull();
    const bytes = Buffer.from(await png.arrayBuffer());
    const drawn = await renderComponentImage(
      "rose-sigil",
      new URLSearchParams({ text: "והויה", fmt: "png" }),
    );
    expect(bytes.equals(drawn.bytes)).toBe(true);
    expect(png.headers.get("etag")).toBe(
      `"${createHash("sha256").update(bytes).digest("hex")}"`,
    );
    expect(await sharp(bytes).metadata()).toMatchObject({
      width: 1024,
      height: 1024,
    });

    const svg = await get("vehuiah", "vehuiah-rose-cross-sigil.svg");
    expect(svg.headers.get("content-type")).toBe("image/svg+xml");
    const text = await svg.text();
    expect(text).toBe(
      (
        await renderComponentImage(
          "rose-sigil",
          new URLSearchParams({ text: "והויה" }),
        )
      ).bytes.toString("utf8"),
    );
  });

  it("answers 404 for any other name", async () => {
    for (const [slug, file] of [
      ["vehuiah", "jeliel-rose-cross-sigil.png"],
      ["vehuiah", "vehuiah-rose-cross-sigil.jpg"],
      ["vehuiah", "vehuiah-rose-cross-sigil-small.png"],
      ["lauviah", "lauviah-rose-cross-sigil.png"],
      ["vehuiah", "vehuiah.png"],
    ])
      expect((await get(slug, file)).status).toBe(404);
  });
});
