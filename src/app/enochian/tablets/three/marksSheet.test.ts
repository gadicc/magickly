import { readFileSync } from "node:fs";
import {
  SideMark,
  TABLET_MARK_OUTLINES,
} from "magick-components/enochian/pyramidMarks";
import Tablet from "magick-components/enochian/Tablet";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  outlineSheet,
  SHEET_LETTER_BASELINE,
  SHEET_LETTER_SIZE,
  SHEET_MODULE,
  SHEET_TOP,
  sheetContents,
  sheetModule,
} from "../../../../../scripts/tablet3d/sheet.mts";
import { MARKS_SHEET, MARKS_SHEET_SVG } from "./marksSheet.generated";

const INKS = {
  ink: "#ff0000",
  outline: "#00ff00",
  outlines: TABLET_MARK_OUTLINES,
};

/** Every subpath of an SVG's paths, moved to start at 0, 0. */
const shapes = (svg: string) =>
  [...svg.matchAll(/ d="([^"]*)"/g)].flatMap(([, d]) =>
    d.split(/(?=M)/).map((subpath) => {
      const start = (subpath.match(/-?[\d.]+/g) ?? []).map(Number);
      let at = 0;
      return subpath.replace(/-?[\d.]+/g, (number) =>
        (Number(number) - start[at++ % 2]).toFixed(2),
      );
    }),
  );

describe("the 3D tablet's mark sheet", () => {
  it("is what the script draws now (run `pnpm tablet3d:sheet` if not)", async () => {
    expect(readFileSync(SHEET_MODULE, "utf8")).toBe(await sheetModule());
  });

  it("holds every mark and letter of every version's pyramids", () => {
    const { marks, letters } = sheetContents();
    expect(Object.keys(MARKS_SHEET.marks)).toEqual(marks.map(([key]) => key));
    expect(Object.keys(MARKS_SHEET.letters)).toEqual(letters);
    expect(MARKS_SHEET.columns * MARKS_SHEET.rows).toBeGreaterThanOrEqual(
      marks.length + letters.length,
    );
  });

  it("sets a letter on its top as the flat drawing does", () => {
    const svg = renderToStaticMarkup(
      createElement(Tablet, {
        tablet: "earth",
        pyramids: true,
        pyramidSymbols: "outward",
      }),
    );
    const top =
      /<rect data-top="" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)"/.exec(svg);
    const letter =
      /<text x="[\d.]+" y="([\d.]+)"[^>]*font-size:([\d.]+)px/.exec(svg);
    if (!top || !letter)
      throw new Error("No top or letter in the flat drawing");
    const [, , y, side] = top.map(Number);
    const [, baseline, size] = letter.map(Number);
    expect(SHEET_LETTER_SIZE / SHEET_TOP).toBeCloseTo(size / side, 2);
    expect(SHEET_LETTER_BASELINE / SHEET_LETTER_SIZE).toBeCloseTo(
      (baseline - (y + side / 2)) / size,
      2,
    );
  });

  it("outlines no glyph a font lacks, at any size it sets", async () => {
    // A glyph a font lacks outlines to its .notdef box (or to nothing, as
    // Frank Ruhl Libre's does), never to an error: draw one at each size
    // the sheet sets text in (a sign 32, a Hebrew letter 34, a top's
    // letter 36) and look for its box among the sheet's paths.
    const missing = ["\uE000", "\u{13000}"].flatMap((text) => [
      createElement(SideMark, { symbol: { kind: "text", text }, ...INKS }),
      createElement(SideMark, {
        symbol: { kind: "text", text, hebrew: true },
        ...INKS,
      }),
      createElement(
        "text",
        { style: { fontSize: SHEET_LETTER_SIZE, fill: "#ff0000" } },
        text,
      ),
    ]);
    const probe = await outlineSheet(
      renderToStaticMarkup(
        createElement(
          "svg",
          { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 48 48" },
          ...missing.map((drawing, key) =>
            createElement("g", { key, transform: "translate(24 24)" }, drawing),
          ),
        ),
      ),
      48,
      48,
    );
    const notdef = new Set(shapes(probe));
    // Each of the two sizes that draw a box draws two rectangles.
    expect(notdef.size).toBe(4);
    expect(
      shapes(MARKS_SHEET_SVG).filter((shape) => notdef.has(shape)),
    ).toEqual([]);
  });

  it("fills every cell with its mark or letter, clear of the cell's edge", async () => {
    // Fine enough that a figure's thin outline shows: 2 pixels a unit.
    const pixels = 96;
    const { columns, rows, cell } = MARKS_SHEET;
    const unit = pixels / cell;
    const { data, info } = await sharp(Buffer.from(MARKS_SHEET_SVG), {
      density: (72 * pixels) / cell,
    })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([
      columns * pixels,
      rows * pixels,
    ]);
    /** A cell's ink and outline: pixels, extent and margin, in units. */
    const drawn = (index: number) => {
      const [x0, y0] = [
        (index % columns) * pixels,
        Math.floor(index / columns) * pixels,
      ];
      const found = { ink: 0, outline: 0, other: 0 };
      const box = [pixels, pixels, -1, -1];
      for (let y = 0; y < pixels; y += 1)
        for (let x = 0; x < pixels; x += 1) {
          const at = ((y0 + y) * info.width + x0 + x) * info.channels;
          if (data[at] > 96) found.ink += 1;
          if (data[at + 1] > 96) found.outline += 1;
          if (data[at + 2] > 8) found.other += 1;
          // Any trace, however faint, for the margin.
          if (data[at] > 8 || data[at + 1] > 8)
            box.splice(
              0,
              4,
              ...[
                Math.min(box[0], x),
                Math.min(box[1], y),
                Math.max(box[2], x),
                Math.max(box[3], y),
              ],
            );
        }
      const extent = Math.max(box[2] - box[0], box[3] - box[1]) / unit;
      const margin =
        Math.min(box[0], box[1], pixels - 1 - box[2], pixels - 1 - box[3]) /
        unit;
      return { ...found, extent, margin };
    };
    const wrong: string[] = [];
    const cells = [
      ...Object.entries(MARKS_SHEET.marks).map(
        ([key, at]) => [key, at, true] as const,
      ),
      ...Object.entries(MARKS_SHEET.letters).map(
        ([key, at]) => [key, at, false] as const,
      ),
    ];
    for (const [key, index, isMark] of cells) {
      const { ink, outline, other, extent, margin } = drawn(index);
      // At least a fifth of a cell across: the smallest, a yod, is 15
      // units; a mark drawn at a tenth of its size would be 3 at most.
      if (extent < cell / 5) wrong.push(`${key}: ${extent} units across`);
      // Ink, an outline on a mark and none on a letter, nothing in blue.
      if (!ink || !outline !== !isMark || other)
        wrong.push(`${key}: ${ink}/${outline}/${other}`);
      // Clear of the cell's edge by 2.5 units, faint edges included, so
      // that no mipmap level averages one cell's mark into the next until
      // a cell is about 20 px. The descenders of g, p and y come nearest,
      // at 3 units; the half unit below that is one pixel's slack here.
      if (margin < 2.5) wrong.push(`${key}: ${margin} units from the edge`);
    }
    expect(wrong).toEqual([]);
    // The cells past the last are empty, as the measure must find them.
    for (let index = cells.length; index < columns * rows; index += 1)
      expect(drawn(index)).toMatchObject({ ink: 0, outline: 0, other: 0 });
  });
});
