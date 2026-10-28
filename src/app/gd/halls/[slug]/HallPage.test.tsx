import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { expectEntityPage, textOf } from "../../../../../tests/entityPage";

vi.mock("server-only", () => ({}));

import { GD_HALLS, gdHall, gdHallTitle } from "@/render/contracts/gdHall";
import { hallFiles, hallJsonLd, hallMetadata } from "@/seo/halls";
import HallPage from "./HallPage";
import { generateStaticParams } from "./page";

const html = (slug: string) =>
  renderToString(<HallPage hall={gdHall(slug) as never} />);

/** The page's JSON-LD, parsed. */
function jsonLd(markup: string) {
  const script = markup.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  )?.[1];
  return JSON.parse(script ?? "null");
}

/** Google's image licence fields (developers.google.com, plan 062). */
function expectLicensable(image: Record<string, unknown>) {
  expect(image["@type"]).toBe("ImageObject");
  for (const field of [
    "contentUrl",
    "license",
    "acquireLicensePage",
    "creator",
    "creditText",
    "copyrightNotice",
  ])
    expect(image[field], field).toBeTruthy();
  expect(image.license).toBe("https://creativecommons.org/licenses/by/4.0/");
  expect(image.creator).toEqual({
    "@type": "Organization",
    name: "Magick.ly",
    url: "https://magick.ly/",
  });
  expect(image.creditText).toBe("Magick.ly, CC BY 4.0");
  expect(image.copyrightNotice).toBe(
    "© 2026 Magick.ly. Licensed under CC BY 4.0",
  );
  expect(image.acquireLicensePage).toBe("https://magick.ly/about#licence");
}

describe("a temple hall's page", () => {
  it("prerenders every hall", () => {
    expect(generateStaticParams()).toEqual(
      GD_HALLS.map((hall) => ({ slug: hall.slug })),
    );
  });

  it.each(GD_HALLS.map((hall) => [hall.slug]))(
    "shows %s as a real image with its words, sources and licence",
    (slug) => {
      const hall = gdHall(slug) as never;
      const markup = html(slug);
      expectEntityPage(markup, gdHallTitle(hall));
      const files = hallFiles(hall);
      const img = markup.match(/<img\b[^>]*>/)?.[0] ?? "";
      expect(img).toContain(`src="${files.png.path}"`);
      expect(img).toContain(
        `srcSet="${files.medium.path} 750w, ${files.png.path} 1500w"`,
      );
      expect(img).toContain(`width="1500" height="${files.png.height}"`);
      expect(img).toMatch(/alt="Floor plan of the Golden Dawn [^"]+"/);
      expect(img).toContain('fetchPriority="high"');
      expect(markup).toContain(`href="/gd/halls/editor#preset=${slug}"`);
      for (const file of [files.png, files.svg]) {
        const link = markup.match(
          new RegExp(`<a[^>]*href="${file.path}"[^>]*>`),
        )?.[0];
        expect(link).toContain(`download="${file.name}"`);
      }
      const text = textOf(markup);
      expect(text).toContain(
        "Floor plan © 2026 Magick.ly, CC BY 4.0. Free to reuse with credit",
      );
      expect(text).toContain("Regardie 1938, vol. 2, p.");
      expect(text).not.toMatch(/public\/pics|older drawing/);

      // Structured data: the trail and both files, each licensable, each
      // contentUrl the URL the page shows it at.
      const data = jsonLd(markup);
      expect(data).toEqual(JSON.parse(JSON.stringify(hallJsonLd(hall))));
      const [trail, png, svg] = data["@graph"];
      expect(trail["@type"]).toBe("BreadcrumbList");
      expect(
        trail.itemListElement.map((item: { item: string }) => item.item),
      ).toEqual([
        "https://magick.ly/gd",
        "https://magick.ly/gd/halls",
        `https://magick.ly/gd/halls/${slug}`,
      ]);
      expectLicensable(png);
      expectLicensable(svg);
      expect(png.contentUrl).toBe(`https://magick.ly${files.png.path}`);
      expect(png.encodingFormat).toBe("image/png");
      expect(svg.contentUrl).toBe(`https://magick.ly${files.svg.path}`);
      expect(svg.encodingFormat).toBe("image/svg+xml");
      expect(png.associatedMedia).toEqual({ "@id": svg["@id"] });
      expect(png.isBasedOn.length).toBeGreaterThan(0);
      for (const book of png.isBasedOn) {
        expect(book).toMatchObject({
          "@type": "Book",
          name: "The Golden Dawn, vol. 2",
          author: { "@type": "Person", name: "Israel Regardie" },
          publisher: { "@type": "Organization", name: "Aries Press, Chicago" },
          datePublished: "1938",
        });
        expect(book.description).toMatch(/^p\.\d+, archive\.org leaf n\d+/);
      }
      // The figure's description is the stations' section, heading and
      // table together.
      expect(markup).toContain('aria-describedby="hall-stations"');
      expect(markup).toMatch(
        /<section id="hall-stations" aria-labelledby="hall-stations-heading"><h2 id="hall-stations-heading">In the hall<\/h2><table/,
      );
      expect(text).not.toContain("nothing");
    },
  );

  it("describes itself to search and sharing, the card first", () => {
    const metadata = hallMetadata("zelator-1");
    expect(metadata).toMatchObject({
      title: "Golden Dawn Zelator Temple, part 1 (1=10): floor plan",
      alternates: { canonical: "/gd/halls/zelator-1" },
      openGraph: { url: "/gd/halls/zelator-1", siteName: "Magick.ly" },
    });
    expect(metadata?.twitter).toBeUndefined();
    const images = metadata?.openGraph?.images as { url: string }[];
    expect(images.map((image) => image.url)).toEqual([
      "/og/gd/halls/zelator-1.png",
      "/gd/halls/zelator-1/golden-dawn-zelator-1-temple.png",
    ]);
    expect(hallMetadata("nope")).toBeNull();
  });
});
