import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { expectEntityPage, textOf } from "../../../../../tests/entityPage";

vi.mock("server-only", () => ({}));
// The "Jump to hall" select pushes a route; no app router is mounted here.
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", async (importActual) => ({
  ...(await importActual<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
}));

import { GD_HALLS, gdHall, gdHallTitle } from "@/render/contracts/gdHall";
import { hallFiles, hallJsonLd, hallMetadata } from "@/seo/halls";
import HallPage from "./HallPage";
import { BLANK, RAIL_MEDIA } from "./HallRail";
import Hall, { generateMetadata, generateStaticParams } from "./page";

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

  it("sets every hall beside it, the current one marked", () => {
    const markup = html("practicus-1");
    const rail =
      markup.match(/<nav aria-label="All temple halls"[\s\S]*?<\/nav>/)?.[0] ??
      "";
    // Last in the markup, after the page's own words.
    expect(markup.indexOf(rail)).toBeGreaterThan(
      markup.indexOf('id="licence"'),
    );
    const links = [...rail.matchAll(/<a[^>]*href="([^"]+)"[^>]*>/g)];
    expect(links.map(([, href]) => href)).toEqual([
      "/gd/halls",
      ...GD_HALLS.map((hall) => `/gd/halls/${hall.slug}`),
    ]);
    const current = links.filter(([tag]) =>
      tag.includes('aria-current="page"'),
    );
    expect(current.map(([, href]) => href)).toEqual(["/gd/halls/practicus-1"]);
    expect(rail.match(/loading="lazy"/g)).toHaveLength(14);
    // Only a screen wide enough to show the rail fetches its thumbnails:
    // each is a source for that width, over an inline blank.
    for (const hall of GD_HALLS)
      expect(rail).toContain(
        `<source media="${RAIL_MEDIA}" srcSet="${hallFiles(hall).small.path}"`,
      );
    expect(rail.match(/<img [^>]*src="([^"]+)"/g)?.length).toBe(14);
    for (const [, src] of rail.matchAll(/<img [^>]*src="([^"]+)"/g))
      expect(src).toBe(BLANK);
    expect(textOf(rail)).toContain("Practicus 3=8, 31st path");
  });

  it("offers every hall in a select grouped by grade, the current one chosen", () => {
    const markup = html("theoricus-2");
    const select = markup.match(/<select[\s\S]*?<\/select>/)?.[0] ?? "";
    expect(
      [...select.matchAll(/<optgroup label="([^"]+)"/g)].map(
        ([, name]) => name,
      ),
    ).toEqual([
      "Neophyte 0=0",
      "Zelator 1=10",
      "Theoricus 2=9",
      "Practicus 3=8",
      "Philosophus 4=7",
      "Portal",
    ]);
    const options = [
      ...select.matchAll(/<option[^>]*value="([^"]+)"[^>]*>([^<]+)</g),
    ];
    expect(options).toHaveLength(14);
    expect(options[4].slice(1)).toEqual([
      "/gd/halls/theoricus-2",
      "Theoricus · Part 2 · In Yesod",
    ]);
    expect(options[4][0]).toContain('selected=""');
    expect(textOf(markup)).toContain("Jump to hall");
  });

  it("routes a slug to its hall and anything else to a 404", async () => {
    const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
    expect(await generateMetadata(params("zelator-1") as never)).toEqual(
      hallMetadata("zelator-1"),
    );
    const page = await Hall(params("zelator-1") as never);
    expect(page.props.hall).toBe(gdHall("zelator-1"));
    // notFound() throws Next's own 404 error.
    for (const call of [
      () => generateMetadata(params("editor") as never),
      () => Hall(params("nope") as never),
    ])
      await expect(call()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

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
