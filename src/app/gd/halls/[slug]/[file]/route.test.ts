import { createHash } from "node:crypto";
import { match } from "next/dist/compiled/path-to-regexp";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { allHallFiles } from "@/seo/halls";
import nextConfig from "../../../../../../next.config";
import { GET, generateStaticParams } from "./route";

function get(slug: string, file: string) {
  return GET(new Request("https://magick.ly/gd/halls"), {
    params: Promise.resolve({ slug, file }),
  });
}

describe("/gd/halls/[slug]/[file]", () => {
  it("prerenders each hall's four files", () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(56);
    expect(params.slice(0, 4)).toEqual([
      { slug: "neophyte", file: "golden-dawn-neophyte-temple.png" },
      { slug: "neophyte", file: "golden-dawn-neophyte-temple-medium.png" },
      { slug: "neophyte", file: "golden-dawn-neophyte-temple-small.png" },
      { slug: "neophyte", file: "golden-dawn-neophyte-temple.svg" },
    ]);
  });

  it("serves a hall's PNG and SVG under their names", async () => {
    const png = await get(
      "zelator-1",
      "golden-dawn-zelator-1-temple-small.png",
    );
    expect(png.status).toBe(200);
    expect(png.headers.get("content-type")).toBe("image/png");
    expect(png.headers.get("content-disposition")).toBe(
      'inline; filename="golden-dawn-zelator-1-temple-small.png"',
    );
    // Stable names, not content-addressed: revalidated against the ETag.
    expect(png.headers.get("cache-control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    const bytes = Buffer.from(await png.clone().arrayBuffer());
    expect(png.headers.get("etag")).toBe(
      `"${createHash("sha256").update(bytes).digest("hex")}"`,
    );
    expect(
      await sharp(Buffer.from(await png.arrayBuffer())).metadata(),
    ).toMatchObject({ width: 360, height: 525 });
    const svg = await get("zelator-1", "golden-dawn-zelator-1-temple.svg");
    expect(svg.headers.get("content-type")).toBe("image/svg+xml");
    expect(await svg.text()).toContain(
      "<title>Golden Dawn Zelator Temple, part 1 (1=10): floor plan</title>",
    );
  });

  it("answers 404 for any other name", async () => {
    for (const [slug, file] of [
      ["zelator-1", "golden-dawn-neophyte-temple.png"],
      ["zelator1", "golden-dawn-zelator1-temple.png"],
      ["zelator-1", "golden-dawn-zelator-1-temple-large.png"],
    ])
      expect((await get(slug, file)).status).toBe(404);
  });

  it("keeps the medium and small PNGs, and only those, out of the index", async () => {
    const config = await nextConfig("phase-hall-headers-test");
    const rules = (await config.headers?.()) ?? [];
    const smaller = rules.filter((rule) =>
      rule.headers.some(
        (header) => header.key === "X-Robots-Tag" && header.value === "noindex",
      ),
    );
    const noindex = (path: string) =>
      smaller.some((rule) => match(rule.source)(path) !== false);
    for (const { file } of allHallFiles())
      expect([file.path, noindex(file.path)]).toEqual([
        file.path,
        !file.indexed,
      ]);
    expect(noindex("/gd/halls/neophyte")).toBe(false);
  });
});
