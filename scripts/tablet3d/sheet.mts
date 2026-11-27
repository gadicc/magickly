/**
 * Draws the 3D tablet's mark sheet (plan 101) into
 * `src/app/enochian/tablets/three/marksSheet.generated.ts`: every mark a
 * side of any tablet's pyramids shows, in any version, drawn by `SideMark`
 * at the Squares tab's outline widths (`MARK_OUTLINES`, thicker than the
 * flat tablet's, for the larger faces: Gadi's choice from stage 3's
 * frames, 27 November 2026), and every top's letter, as the flat drawing
 * sets it. The text is outlined to paths by the image route's
 * `outlineComponentImage` with its pinned fonts, so the browser rasterises
 * the sheet without fonts. `marksSheet.test.ts` fails when the committed
 * module differs from a fresh draw; run `pnpm tablet3d:sheet` after a
 * change to the marks, the letters or the fonts, and commit the module.
 *
 * Two channels, on opaque black: red is the ink's coverage, green the
 * outline's, the ink drawn over the outline. A pixel is therefore
 * `ink × r + outline × g + ground × (1 − r − g)`. The ground is opaque so
 * that a rasterised edge keeps its coverage in r and g, which a
 * transparent ground would leave to alpha and the upload unpremultiply.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import {
  MARK_OUTLINES,
  SideMark,
  type SideSymbol,
  sideSymbol,
} from "magick-components/enochian/pyramidMarks";
import { tabletPyramids } from "magick-data/enochian/tabletPyramids";
import enochianTablets, {
  TABLET_VERSIONS,
  tabletVersion,
} from "magick-data/enochian/tablets";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type MarksSheet, markKey } from "@/app/enochian/tablets/three/model";

/** The module the 3D view imports. */
export const SHEET_MODULE = fileURLToPath(
  new URL(
    "../../src/app/enochian/tablets/three/marksSheet.generated.ts",
    import.meta.url,
  ),
);

/** A cell's side: a mark's box and a margin that keeps mipmaps apart. */
export const SHEET_CELL = 48;
/** The box `SideMark` draws a mark in, centred on 0, 0. */
export const SHEET_MARK_BOX = 34;
/** A letter cell's flat top, centred in the cell. */
export const SHEET_TOP = 40;
/**
 * A letter's size on its top, and its baseline below the top's middle,
 * as the flat drawing sets a top's letter: `(SQUARE − 2) × share` on a
 * top of `SQUARE × share`, the baseline a third of the size down. A
 * descender (g, p, y) reaches about a unit past the top, which the 3D
 * top clips, where the flat drawing lets it spill onto the sides.
 */
export const SHEET_LETTER_SIZE = (SHEET_TOP * 18) / 20;
export const SHEET_LETTER_BASELINE = SHEET_LETTER_SIZE / 3;

const INK = "#ff0000";
const OUTLINE = "#00ff00";

/** Every distinct mark and letter on any version's pyramids, in order. */
export function sheetContents() {
  const marks = new Map<string, SideSymbol>();
  const letters = new Set<string>();
  for (const version of TABLET_VERSIONS)
    for (const tablet of Object.values(enochianTablets)) {
      const view = tabletVersion(tablet, version);
      if (!view) continue;
      for (const pyramid of tabletPyramids(view)) {
        for (const side of pyramid.sides) {
          const symbol = sideSymbol(side);
          marks.set(markKey(symbol), symbol);
        }
        const letter = view.grid[pyramid.row][pyramid.column];
        if (letter) letters.add(letter);
      }
    }
  // Code-unit order, which no locale moves.
  const order = (a: string, b: string) => (a < b ? -1 : 1);
  return {
    marks: [...marks].sort(([a], [b]) => order(a, b)),
    letters: [...letters].sort(order),
  };
}

/**
 * An SVG drawn as the sheet is, its text outlined to paths with the image
 * route's renderer and the pyramids' image's fonts: Frank Ruhl Libre for
 * the Hebrew marks; the signs, planets and letters are in the base set.
 */
export async function outlineSheet(
  source: string,
  width: number,
  height: number,
): Promise<string> {
  // Imported here, so that the script's resolve hook for `server-only`
  // is registered before the module loads.
  const { outlineComponentImage } = await import("@/render/outlineTreeImage");
  const { bytes } = await outlineComponentImage(source, {
    profile: "magickli-tablet3d-marks-sheet-v1",
    inputsSha256: createHash("sha256").update(source).digest("hex"),
    viewBox: [0, 0, width, height],
    fonts: ["EnochianPlain.ttf", "FrankRuhlLibre-Bold-letters.ttf"],
  });
  return bytes.toString("utf8");
}

/** The sheet's outlined SVG and its layout. */
export async function drawSheet(): Promise<{ svg: string; sheet: MarksSheet }> {
  const { marks, letters } = sheetContents();
  const total = marks.length + letters.length;
  const columns = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / columns);
  const [width, height] = [columns * SHEET_CELL, rows * SHEET_CELL];
  const cells = [
    ...marks.map(([key, symbol]) =>
      createElement(SideMark, {
        key,
        symbol,
        ink: INK,
        outline: OUTLINE,
        outlines: MARK_OUTLINES,
      }),
    ),
    // No family, as the flat tablet's image sets its letters: the image
    // route's default, Noto Sans.
    ...letters.map((letter) =>
      createElement(
        "text",
        {
          key: `letter-${letter}`,
          y: SHEET_LETTER_BASELINE,
          style: {
            fontSize: SHEET_LETTER_SIZE,
            textAnchor: "middle",
            fill: INK,
          },
        },
        letter,
      ),
    ),
  ].map((drawing, index) =>
    createElement(
      "g",
      {
        key: index,
        transform: `translate(${(index % columns) * SHEET_CELL + SHEET_CELL / 2} ${Math.floor(index / columns) * SHEET_CELL + SHEET_CELL / 2})`,
      },
      drawing,
    ),
  );
  const source = renderToStaticMarkup(
    createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: `0 0 ${width} ${height}`,
        // An intrinsic size, without which a browser may not draw it.
        width,
        height,
      },
      createElement("rect", { width, height, fill: "#000000" }),
      ...cells,
    ),
  );
  const index = (keys: readonly string[], from: number) =>
    Object.fromEntries(keys.map((key, at) => [key, from + at]));
  return {
    svg: await outlineSheet(source, width, height),
    sheet: {
      columns,
      rows,
      cell: SHEET_CELL,
      markBox: SHEET_MARK_BOX,
      top: SHEET_TOP,
      marks: index(
        marks.map(([key]) => key),
        0,
      ),
      letters: index(letters, marks.length),
    },
  };
}

/** The generated module's text, from a fresh draw of the sheet. */
export async function sheetModule(): Promise<string> {
  const { svg, sheet } = await drawSheet();
  return [
    "// Generated by `pnpm tablet3d:sheet` (scripts/tablet3d/sheet.mts): do not edit.",
    'import type { MarksSheet } from "./model";',
    "",
    "/** Where each side's mark and each top's letter is in the sheet (plan 101). */",
    `export const MARKS_SHEET: MarksSheet = ${JSON.stringify(sheet)};`,
    "",
    "/** The sheet, outlined: red the ink's coverage, green the outline's, on black. */",
    `export const MARKS_SHEET_SVG =\n  ${JSON.stringify(svg)};`,
    "",
    "/**",
    " * The UVs run down from the sheet's top left: upload it with three's",
    " * `flipY = false`, and as `NoColorSpace`, its channels being coverage.",
    " */",
    "export const MARKS_SHEET_FLIP_Y = false;",
    "",
    "/**",
    " * The largest cell, in pixels, that keeps the sheet within the 2,048",
    " * pixels a side WebGL 2 guarantees a texture: the view clamps to it.",
    " */",
    `export const MARKS_SHEET_MAX_CELL_PX = ${Math.floor(2048 / Math.max(sheet.columns, sheet.rows))};`,
    "",
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier !== "server-only") return next(specifier, context);
      // The marker's empty module, as under the react-server condition.
      return next(specifier, { ...context, conditions: ["react-server"] });
    },
  });
  writeFileSync(SHEET_MODULE, await sheetModule());
  console.log(`Wrote ${SHEET_MODULE}`);
}
