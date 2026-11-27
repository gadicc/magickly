import { readFileSync } from "node:fs";
import Tablet from "magick-components/enochian/Tablet";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  SHEET_LETTER_BASELINE,
  SHEET_LETTER_SIZE,
  SHEET_MODULE,
  SHEET_TOP,
  sheetContents,
  sheetModule,
} from "../../../../../scripts/tablet3d/sheet.mts";
import { MARKS_SHEET, MARKS_SHEET_SVG } from "./marksSheet.generated";

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

  it("draws something in every cell: a mark's ink and outline, a letter's ink", async () => {
    // Fine enough that a figure's thin outline shows, as at the view's cells.
    const pixels = 96;
    const { columns, rows, cell } = MARKS_SHEET;
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
    const coverage = (index: number) => {
      const [x0, y0] = [
        (index % columns) * pixels,
        Math.floor(index / columns) * pixels,
      ];
      let [ink, outline, other] = [0, 0, 0];
      for (let y = y0; y < y0 + pixels; y += 1)
        for (let x = x0; x < x0 + pixels; x += 1) {
          const at = (y * info.width + x) * info.channels;
          if (data[at] > 96) ink += 1;
          if (data[at + 1] > 96) outline += 1;
          if (data[at + 2] > 8) other += 1;
        }
      return { ink, outline, other };
    };
    const blank: string[] = [];
    for (const [key, index] of Object.entries(MARKS_SHEET.marks)) {
      const { ink, outline, other } = coverage(index);
      if (ink < 4 || outline < 4 || other)
        blank.push(`${key}: ${ink}/${outline}/${other}`);
    }
    for (const [key, index] of Object.entries(MARKS_SHEET.letters)) {
      const { ink, outline, other } = coverage(index);
      if (ink < 4 || outline || other)
        blank.push(`${key}: ${ink}/${outline}/${other}`);
    }
    expect(blank).toEqual([]);
    // The cells past the last are empty, as the measure must find them.
    const used =
      Object.keys(MARKS_SHEET.marks).length +
      Object.keys(MARKS_SHEET.letters).length;
    for (let index = used; index < columns * rows; index += 1)
      expect(coverage(index)).toEqual({ ink: 0, outline: 0, other: 0 });
  });
});
