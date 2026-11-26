import { describe, expect, it } from "vitest";
import { tabletExportLink } from "@/app/enochian/tablets/exportLink";
import { PNG_FORMAT, SVG_FORMAT } from "@/export/formats";
import { CONTRACTS } from "@/render/contracts";
import { contractRasterDefault } from "@/render/contracts/types";
import {
  allTabletFiles,
  type TabletDrawing,
  tabletFileLink,
  tabletFileQuery,
  tabletFiles,
} from "./tablets";

const TABLETS = ["earth", "air", "water", "fire", "union"] as const;

/**
 * The image link the tool's export box gives for a drawing: the tool's
 * own link (`tabletExportLink`, as `tablets.tsx` calls it) for the tablet
 * in Latin letters in the Golden Dawn's version, flat or as pyramids with
 * *Symbols on the sides* facing out, through the export box's own format
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
