import type { TabletNameKind } from "magick-data/enochian/tabletNames";
import tabletNotes from "magick-data/enochian/tabletNotes";
import { describe, expect, it } from "vitest";
import { tabletExportLink } from "@/app/enochian/tablets/exportLink";
import { displayName } from "@/app/enochian/tablets/nameWords";
import { gdNames } from "@/app/enochian/tablets/tabletPageData";
import {
  TABLET_PAGE_IDS,
  WATCHTOWER_QUARTERS,
} from "@/app/enochian/tablets/tabletPages";
import { PNG_FORMAT, SVG_FORMAT } from "@/export/formats";
import { CONTRACTS } from "@/render/contracts";
import { contractRasterDefault } from "@/render/contracts/types";
import { cardArtRequest, socialCard } from "./cards";
import { pageMetadata } from "./metadata";
import { PUBLIC_PAGES } from "./pages";
import {
  allTabletFiles,
  type TabletDrawing,
  tabletAltEnglish,
  tabletFileLink,
  tabletFileQuery,
  tabletFiles,
  tabletJsonLd,
  tabletSocialImage,
} from "./tablets";

const TABLETS = ["earth", "air", "water", "fire", "union"] as const;

/**
 * The image link the tool's export box gives for a drawing: the tool's
 * own link (`tabletExportLink`, as `tablets.tsx` calls it) for the tablet
 * in Latin letters in the Golden Dawn's version, flat or as pyramids with
 * *Symbols on the sides* outward, through the export box's own format
 * rows (`src/export/formats.ts`).
 */
function toolExport(
  id: (typeof TABLETS)[number],
  drawing: TabletDrawing,
  format: "png" | "svg",
) {
  const { link } = tabletExportLink({
    id,
    font: "latin",
    version: "gd",
    pyramids: drawing === "pyramids",
    symbols: drawing === "pyramids" ? "outward" : undefined,
  });
  return (format === "png" ? PNG_FORMAT : SVG_FORMAT).link?.(link);
}

describe("the tablets' static files", () => {
  it("names four files under each tablet's page, the PNGs first", () => {
    const files = allTabletFiles();
    expect(files).toHaveLength(20);
    expect(new Set(files.map(({ file }) => file.path)).size).toBe(20);
    expect(files.map(({ tablet }) => tablet)).toEqual(
      TABLETS.flatMap((id) => [id, id, id, id]),
    );
    for (const { tablet, file } of files)
      expect(file.path).toBe(`/enochian/tablets/${tablet}/${file.name}`);
    expect(
      files.filter(({ tablet }) => tablet === "fire").map(({ file }) => file),
    ).toEqual([
      {
        name: "enochian-fire-tablet.png",
        path: "/enochian/tablets/fire/enochian-fire-tablet.png",
        drawing: "flat",
        format: "png",
        width: 840,
        height: 1188,
      },
      {
        name: "enochian-fire-tablet-pyramids.png",
        path: "/enochian/tablets/fire/enochian-fire-tablet-pyramids.png",
        drawing: "pyramids",
        format: "png",
        width: 840,
        height: 1188,
      },
      {
        name: "enochian-fire-tablet.svg",
        path: "/enochian/tablets/fire/enochian-fire-tablet.svg",
        drawing: "flat",
        format: "svg",
      },
      {
        name: "enochian-fire-tablet-pyramids.svg",
        path: "/enochian/tablets/fire/enochian-fire-tablet-pyramids.svg",
        drawing: "pyramids",
        format: "svg",
      },
    ]);
    // The Union by the words a search uses.
    expect(tabletFiles("union").flat.png).toEqual({
      name: "enochian-tablet-of-union.png",
      path: "/enochian/tablets/union/enochian-tablet-of-union.png",
      drawing: "flat",
      format: "png",
      width: 496,
      height: 416,
    });
    expect(tabletFiles("union").pyramids.svg.name).toBe(
      "enochian-tablet-of-union-pyramids.svg",
    );
  });

  it("draws each file as the tool's export does, at the contract's raster default", () => {
    for (const { tablet, file } of allTabletFiles()) {
      const link = tabletFileLink(tablet, file.drawing);
      const query = tabletFileQuery(tablet, file).toString();
      expect(`/api/render/${link.slug}${query ? `?${query}` : ""}`).toBe(
        toolExport(tablet, file.drawing, file.format),
      );
      if (file.format === "png") {
        const params = new URLSearchParams(query);
        const flat = CONTRACTS["enochian-tablet"];
        const pyramids = CONTRACTS["enochian-tablet-pyramids"];
        expect(
          file.drawing === "flat"
            ? contractRasterDefault(flat, flat.parse(params))
            : contractRasterDefault(pyramids, pyramids.parse(params)),
          file.path,
        ).toEqual({ width: file.width, height: file.height });
      }
    }
    // The queries themselves: Earth and the Golden Dawn's are defaults.
    const earth = tabletFiles("earth");
    expect(tabletFileQuery("earth", earth.flat.svg).toString()).toBe("");
    expect(tabletFileQuery("earth", earth.flat.png).toString()).toBe("fmt=png");
    const fire = tabletFiles("fire");
    expect(tabletFileQuery("fire", fire.pyramids.png).toString()).toBe(
      "fmt=png&id=fire&symbols=outward",
    );
    expect(tabletFileQuery("fire", fire.flat.svg).toString()).toBe("id=fire");
  });

  it("keeps the route's copies out of the index; these are the ones in it", () => {
    expect(CONTRACTS["enochian-tablet"].indexed).toBe(false);
    expect(CONTRACTS["enochian-tablet-pyramids"].indexed).toBe(false);
  });
});

describe("the tablets' pages for search and sharing", () => {
  it("names each Watchtower's quarter as its note gives it", () => {
    for (const [id, quarter] of Object.entries(WATCHTOWER_QUARTERS)) {
      const note = tabletNotes.tablets[id as keyof typeof WATCHTOWER_QUARTERS];
      expect(note.text, id).toMatch(
        new RegExp(`^The Watchtower of the ${quarter}, `),
      );
      expect(
        PUBLIC_PAGES[`/enochian/tablets/${id}` as keyof typeof PUBLIC_PAGES]
          .title,
      ).toBe(
        `Enochian ${id[0]?.toUpperCase()}${id.slice(1)} Tablet: Watchtower of the ${quarter}`,
      );
    }
    expect(PUBLIC_PAGES["/enochian/tablets/union"].title).toBe(
      "Enochian Tablet of Union",
    );
  });

  it("leads each description with the tablet's holy names or lines", () => {
    for (const id of TABLET_PAGE_IDS) {
      const names = gdNames(id);
      const spellings = (kind: TabletNameKind) =>
        names
          .filter((name) => name.kind === kind)
          .map((name) => name.spelling.toUpperCase());
      const { description } = PUBLIC_PAGES[`/enochian/tablets/${id}` as const];
      if (id === "union") {
        const [first, second, third, fourth] = spellings("union");
        expect(description).toMatch(
          new RegExp(`^${first}, ${second}, ${third} and ${fourth}, `),
        );
      } else {
        expect(description, id).toMatch(
          new RegExp(`^${spellings("holyName").join(" ")}, `),
        );
        const king = names.find((name) => name.kind === "king");
        expect(description, id).toContain(
          `King ${displayName(king?.spelling ?? "")}`,
        );
      }
    }
  });

  it("describes each image in its own words, in English for the data", () => {
    expect(tabletAltEnglish("fire", "flat")).toBe(
      "The Enochian Fire tablet in the Golden Dawn's version: its sigil above a grid of thirteen rows of twelve letters",
    );
    expect(tabletAltEnglish("union", "flat")).toBe(
      "The Enochian Tablet of Union in the Golden Dawn's version: four rows of five letters, Exarp, Hcoma, Nanta and Bitom",
    );
    expect(tabletAltEnglish("water", "pyramids")).toMatch(
      /^The Enochian Water tablet in the Golden Dawn's version with every square drawn as a truncated pyramid/,
    );
  });

  it("gives each file an ImageObject based on the Regardie pages it follows", () => {
    for (const id of TABLET_PAGE_IDS) {
      const files = tabletFiles(id);
      const graph = tabletJsonLd(id)["@graph"];
      expect(graph.map((node) => node.contentUrl)).toEqual(
        [
          files.flat.png,
          files.flat.svg,
          files.pyramids.png,
          files.pyramids.svg,
        ].map((file) => `https://magick.ly${file.path}`),
      );
      for (const node of graph) {
        expect(node).toMatchObject({
          "@type": "ImageObject",
          url: `https://magick.ly/enochian/tablets/${id}`,
          license: "https://creativecommons.org/licenses/by/4.0/",
          creditText: "Magick.ly, drawn by magick-components (MIT)",
        });
        // The drawing follows Regardie; the note's other sources are
        // cited for Dee's names.
        expect(node.isBasedOn.length, id).toBeGreaterThan(0);
        for (const book of node.isBasedOn)
          expect(book.url).toMatch(
            /^https:\/\/archive\.org\/details\/IsraelRegardie-TheGoldenDawn-Vol4-1940\/page\/n\d+$/,
          );
      }
    }
    const [png, svg, pyramids] = tabletJsonLd("earth")["@graph"];
    expect(png).toMatchObject({
      name: "Enochian Earth Tablet",
      encodingFormat: "image/png",
      width: 840,
      height: 1188,
      caption: tabletAltEnglish("earth", "flat"),
      associatedMedia: { "@id": svg?.["@id"] },
    });
    expect(svg?.encodingFormat).toBe("image/svg+xml");
    expect(svg).not.toHaveProperty("width");
    expect(pyramids?.name).toBe("Enochian Earth Tablet as pyramids");
    expect(png?.isBasedOn[0]).toMatchObject({
      "@type": "Book",
      datePublished: "1940",
      description: "p.272, archive.org leaf n264",
    });
  });

  it("shares each page's own card, then its flat tablet's PNG", () => {
    for (const id of TABLET_PAGE_IDS) {
      const path = `/enochian/tablets/${id}` as const;
      const card = socialCard(path, "x");
      expect(card).toMatchObject({ section: "Enochian Magick" });
      expect(card.art).toMatchObject({
        kind: "diagram",
        slug: "enochian-tablet",
      });
      if (card.art.kind !== "diagram") throw new Error("not a diagram");
      expect(
        CONTRACTS["enochian-tablet"].parse(cardArtRequest(card.art)).id,
      ).toBe(id);
      const images = pageMetadata(path, { images: [tabletSocialImage(id)] })
        .openGraph?.images;
      expect(images).toEqual([
        {
          url: `/og/enochian/tablets/${id}.png`,
          width: 1200,
          height: 630,
          alt: PUBLIC_PAGES[path].title,
        },
        {
          url: tabletFiles(id).flat.png.path,
          width: tabletFiles(id).flat.png.width,
          height: tabletFiles(id).flat.png.height,
          alt: tabletAltEnglish(id, "flat"),
        },
      ]);
    }
    // The hub keeps Earth's.
    expect(socialCard("/enochian/tablets", "x").art).toEqual({
      kind: "diagram",
      slug: "enochian-tablet",
    });
  });
});
