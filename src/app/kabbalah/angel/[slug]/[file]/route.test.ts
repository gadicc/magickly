import { createHash } from "node:crypto";
import angels from "magick-data/kabbalah/seventyTwoAngels";
import { isHTTPAccessFallbackError } from "next/dist/client/components/http-access-fallback/http-access-fallback";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Counted, so that a name the route refuses is seen to draw nothing.
vi.mock("@/render/componentImage", async (original) => {
  const actual = await original<typeof import("@/render/componentImage")>();
  return { renderComponentImage: vi.fn(actual.renderComponentImage) };
});

import { angelSlug } from "@/lib/angelSlugs";
import { renderComponentImage } from "@/render/componentImage";
import * as route from "./route";

const { GET, generateStaticParams } = route;

function get(slug: string, file: string) {
  return GET(new Request("https://magick.ly/kabbalah/angel"), {
    params: Promise.resolve({ slug, file }),
  });
}

describe("/kabbalah/angel/[slug]/[file]", () => {
  it("prerenders the band's and the rose's PNG and SVG for each of the 72", () => {
    // The bare and talisman files are drawn on their first request and
    // kept (plan 096, decision 3): `force-static`, no `revalidate`, and
    // names the build did not list let through to the handler.
    expect(route.dynamic).toBe("force-static");
    expect(route.dynamicParams).toBe(true);
    expect("revalidate" in route).toBe(false);
    const params = generateStaticParams();
    expect(params).toHaveLength(288);
    expect(params).toEqual(
      angels.flatMap((angel) => {
        const slug = angelSlug(angel.no);
        return [
          { slug, file: `${slug}-rose-cross-sigil-band.png` },
          { slug, file: `${slug}-rose-cross-sigil-band.svg` },
          { slug, file: `${slug}-rose-cross-sigil.png` },
          { slug, file: `${slug}-rose-cross-sigil.svg` },
        ];
      }),
    );
    expect(params.slice(0, 4)).toEqual([
      { slug: "vehuiah", file: "vehuiah-rose-cross-sigil-band.png" },
      { slug: "vehuiah", file: "vehuiah-rose-cross-sigil-band.svg" },
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

  it.each([
    ["band", "vehuiah", "angel=vehuiah"],
    ["bare", "nith-haiah", "angel=nith-haiah&style=bare"],
    ["talisman", "jabamiah", "angel=jabamiah&style=talisman"],
  ])(
    "serves the %s's files as angel-sigil draws them",
    async (style, slug, query) => {
      for (const format of ["png", "svg"] as const) {
        const name = `${slug}-rose-cross-sigil-${style}.${format}`;
        const response = await get(slug, name);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe(
          format === "png" ? "image/png" : "image/svg+xml",
        );
        expect(response.headers.get("content-disposition")).toBe(
          `inline; filename="${name}"`,
        );
        expect(response.headers.get("cache-control")).toBe(
          "public, max-age=0, must-revalidate",
        );
        // Indexable: no noindex on any style's file.
        expect(response.headers.get("x-robots-tag")).toBeNull();
        const bytes = Buffer.from(await response.arrayBuffer());
        const drawn = await renderComponentImage(
          "angel-sigil",
          new URLSearchParams(format === "png" ? `${query}&fmt=png` : query),
        );
        expect(bytes.equals(drawn.bytes)).toBe(true);
        expect(response.headers.get("etag")).toBe(`"${drawn.sha256}"`);
        if (format === "png")
          expect(await sharp(bytes).metadata()).toMatchObject({
            width: 1024,
            height: 1024,
          });
      }
    },
    60_000,
  );

  it("draws nothing for any other name", async () => {
    vi.mocked(renderComponentImage).mockClear();
    // `src/proxy.ts` keeps such names from the route (its test has the
    // list); this is the last guard, `notFound()`, before anything is drawn.
    for (const [slug, file] of [
      ["vehuiah", "jeliel-rose-cross-sigil.png"],
      ["vehuiah", "jeliel-rose-cross-sigil-band.png"],
      ["vehuiah", "vehuiah-rose-cross-sigil.jpg"],
      ["vehuiah", "vehuiah-rose-cross-sigil-small.png"],
      ["vehuiah", "vehuiah-rose-cross-sigil-rose.png"],
      ["vehuiah", "vehuiah-rose-cross-sigil-Band.png"],
      ["vehuiah", "vehuiah-rose-cross-sigil-lamen.svg"],
      ["lauviah", "lauviah-rose-cross-sigil.png"],
      ["lauviah", "lauviah-rose-cross-sigil-talisman.png"],
      ["constructor", "constructor-rose-cross-sigil-band.png"],
      ["vehuiah", "vehuiah.png"],
    ]) {
      const error = await get(slug, file).catch((thrown: unknown) => thrown);
      expect(isHTTPAccessFallbackError(error), `${slug}/${file}`).toBe(true);
    }
    expect(renderComponentImage).not.toHaveBeenCalled();
  });
});
