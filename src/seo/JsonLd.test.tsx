import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import JsonLd, { SITE_JSON_LD, SITE_LOGO } from "./JsonLd";
import { SITE_ORGANIZATION } from "./site";

type Node = Record<string, unknown> & { "@id"?: string; "@type"?: string };

/** Every `{ "@id" }` reference anywhere under a value. */
function references(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) for (const item of value) references(item, found);
  else if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === "@id")
      found.push((value as { "@id": string })["@id"]);
    else for (const item of Object.values(value)) references(item, found);
  }
  return found;
}

describe("JsonLd", () => {
  const html = renderToStaticMarkup(<JsonLd data={SITE_JSON_LD} />);
  const graph = JSON.parse(
    html.match(/^<script type="application\/ld\+json">(.*)<\/script>$/)?.[1] ??
      "",
  ) as { "@context": string; "@graph": Node[] };
  const byType = (type: string) =>
    graph["@graph"].find((node) => node["@type"] === type) as Node;

  it("names the site, its publisher and the app in one graph", () => {
    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"].map((node) => [node["@type"], node["@id"]])).toEqual(
      [
        ["WebSite", "https://magick.ly/#website"],
        ["Organization", "https://magick.ly/#organization"],
        ["WebApplication", "https://magick.ly/#app"],
      ],
    );
    expect(byType("WebSite")).toMatchObject({
      name: "Magick.ly",
      alternateName: "magick.ly",
      url: "https://magick.ly/",
      publisher: { "@id": "https://magick.ly/#organization" },
    });
    expect(byType("Organization")).toMatchObject({
      ...SITE_ORGANIZATION,
      sameAs: ["https://github.com/gadicc/magickly"],
    });
    const app = byType("WebApplication");
    expect(app).toMatchObject({
      name: "Magick.ly",
      url: "https://magick.ly/",
      description: byType("WebSite").description,
      applicationCategory: "ReferenceApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": "https://magick.ly/#organization" },
    });
    // No ratings: the app earns no rich result, and claims none.
    expect(app).not.toHaveProperty("aggregateRating");
    expect(app).not.toHaveProperty("review");
  });

  it("points every @id reference at a node in the same graph", () => {
    const ids = new Set(graph["@graph"].map((node) => node["@id"]));
    const refs = references(graph["@graph"]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(ids).toContain(ref);
  });

  it("gives a logo that is served, square and at least 112 px", async () => {
    const logo = byType("Organization").logo as Record<string, unknown>;
    expect(logo.url).toBe(`https://magick.ly${SITE_LOGO.path}`);
    const file = readFileSync(
      path.join(import.meta.dirname, "../../public", SITE_LOGO.path),
    );
    const { width, height, format } = await sharp(file).metadata();
    expect({ width, height, format }).toEqual({
      width: SITE_LOGO.width,
      height: SITE_LOGO.height,
      format: "png",
    });
    expect([logo.width, logo.height]).toEqual([width, height]);
    expect(width).toBeGreaterThanOrEqual(112);
    expect(width).toBe(height);
    // It is the app's own icon.
    const manifest = readFileSync(
      path.join(import.meta.dirname, "../app/manifest.json"),
      "utf8",
    );
    expect(manifest).toContain(SITE_LOGO.path.replaceAll("/", "\\/"));
  });

  it("cannot be closed by a value", () => {
    const html = renderToStaticMarkup(
      <JsonLd data={{ name: "</script><script>alert(1)</script>" }} />,
    );
    expect(html).toBe(
      '<script type="application/ld+json">{"name":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}</script>',
    );
    expect(JSON.parse(html.slice(35, -9))).toEqual({
      name: "</script><script>alert(1)</script>",
    });
  });
});
