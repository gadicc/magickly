import {
  inksOf,
  PYRAMID_SYMBOL_TURNS,
  sideSymbol,
} from "magick-components/enochian/pyramidMarks";
import Tablet, { PYRAMID_COLOURS } from "magick-components/enochian/Tablet";
import { tabletPyramids } from "magick-data/enochian/tabletPyramids";
import enochianTablets, {
  TABLET_VERSIONS,
  type TabletView,
  tabletVersion,
} from "magick-data/enochian/tablets";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MARKS_SHEET } from "./marksSheet.generated";
import {
  markKey,
  srgbToLinear,
  type Tablet3DModel,
  tabletModel,
} from "./model";
import {
  PYRAMID_HEIGHT,
  PYRAMID_TOP,
  type PyramidGeometry,
  pickSquare,
  pyramidGeometry,
  SYMBOL_FILL,
  type Vec3,
} from "./pyramidGeometry";

/** The flat drawing's square, `SQUARE` in `tabletSvg.tsx`, in every grid. */
const SQUARE = 20;
/** Its coordinates are rounded to thousandths (`unit`). */
const FLAT = 0.01;
const TABLETS = ["earth", "air", "water", "fire", "union"] as const;
const PYRAMID_VERSIONS = ["gd", "regardie", "equinox"] as const;
const CASES = PYRAMID_VERSIONS.flatMap((version) =>
  TABLETS.map((tablet) => [version, tablet] as const),
);

const viewOf = (tablet: string, version: string) =>
  tabletVersion(
    enochianTablets[tablet as keyof typeof enochianTablets],
    version as TabletView["version"],
  ) as TabletView;

const attributes = (tag: string) =>
  Object.fromEntries(
    [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]),
  );

/**
 * The flat drawing with pyramids and symbols facing out, as the page
 * draws it: each side's outline and fill, each symbol's transform, each
 * top, and which letters are mirrored, by "row,column".
 */
function flatDrawing(tablet: string, version: string) {
  const svg = renderToStaticMarkup(
    createElement(Tablet, {
      tablet,
      version: version as TabletView["version"],
      pyramids: true,
      pyramidSymbols: "outward",
    }),
  );
  const sides = new Map<string, { points: number[][]; fill: string }>();
  const symbols = new Map<
    string,
    { at: number[]; scale: number; turn: number }
  >();
  const mirrored = new Set<string>();
  let pyramid = "";
  let origin = [0, 0];
  for (const [tag, name] of svg.matchAll(/<(g|polygon|text)\b[^>]*>/g)) {
    const a = attributes(tag);
    if (a["data-pyramid"]) pyramid = a["data-pyramid"];
    else if (name === "polygon" && a["data-side"]) {
      const points = a.points.split(" ").map((p) => p.split(",").map(Number));
      if (pyramid === "0,0" && a["data-side"] === "1") origin = points[0];
      const fill = /fill:([^;]+)/.exec(a.style)?.[1] ?? "";
      sides.set(`${pyramid},${a["data-side"]}`, { points, fill });
    } else if (a["data-symbol"]) {
      const [x, y, scale, turn] = (a.transform.match(/-?[\d.]+/g) ?? []).map(
        Number,
      );
      symbols.set(`${pyramid},${a["data-symbol"]}`, {
        at: [x, y],
        scale,
        turn,
      });
    } else if (name === "text" && a.transform?.includes("scale(-1 1)")) {
      const [column, row] = [
        Math.floor((Number(a.x) - origin[0]) / SQUARE),
        Math.floor((Number(a.y) - origin[1]) / SQUARE),
      ];
      mirrored.add(`${row},${column}`);
    }
  }
  return { sides, symbols, mirrored, origin };
}

const vertexOf = (geometry: PyramidGeometry, vertex: number) => [
  ...geometry.positions.subarray(vertex * 3, vertex * 3 + 3),
];
const sub = (a: readonly number[], b: readonly number[]) =>
  a.map((value, i) => value - b[i]);
const dot = (a: readonly number[], b: readonly number[]) =>
  a.reduce((sum, value, i) => sum + value * b[i], 0);
const length = (a: readonly number[]) => Math.hypot(...a);
const cross = (a: readonly number[], b: readonly number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const near = (a: readonly number[], b: readonly number[], tolerance = 1e-4) =>
  a.length === b.length &&
  a.every((value, i) => Math.abs(value - b[i]) <= tolerance);

/**
 * A face's mapping from the sheet onto it: the point at a uv, and how far
 * it moves for a unit of u and of v (from three of its corners).
 */
function faceMapping(geometry: PyramidGeometry, first: number) {
  const p = [0, 1, 3].map((at) => vertexOf(geometry, first + at));
  const uv = [0, 1, 3].map((at) => [
    ...geometry.uvs.subarray((first + at) * 2, (first + at) * 2 + 2),
  ]);
  const [e1, e2] = [sub(p[1], p[0]), sub(p[2], p[0])];
  const [du1, dv1, du2, dv2] = [...sub(uv[1], uv[0]), ...sub(uv[2], uv[0])];
  const det = du1 * dv2 - du2 * dv1;
  const perU = e1.map((value, i) => (value * dv2 - e2[i] * dv1) / det);
  const perV = e1.map((value, i) => (e2[i] * du1 - value * du2) / det);
  const at = (u: number, v: number) =>
    p[0].map(
      (value, i) => value + perU[i] * (u - uv[0][0]) + perV[i] * (v - uv[0][1]),
    );
  return { perU, perV, at };
}

/** The flat drawing's point for a point of the tablet seen from above. */
const flatPoint = (
  model: Tablet3DModel,
  origin: number[],
  [x, , z]: readonly number[],
) => [
  origin[0] + (x + model.columns / 2) * SQUARE,
  origin[1] + (z + model.rows / 2) * SQUARE,
];

describe("the 3D tablet's geometry", () => {
  it("is drawn for exactly the versions with pyramids", () => {
    const withPyramids = TABLET_VERSIONS.filter(
      (version) => tabletPyramids(viewOf("earth", version)).length > 0,
    );
    expect(withPyramids).toEqual([...PYRAMID_VERSIONS]);
  });

  it.each(CASES)(
    "%s %s is the flat drawing's plan, from the same sources",
    (version, tablet) => {
      const view = viewOf(tablet, version);
      const sources = tabletPyramids(view);
      const model = tabletModel(view, MARKS_SHEET);
      const geometry = pyramidGeometry(model, MARKS_SHEET);
      const flat = flatDrawing(tablet, version);
      const errors: string[] = [];
      const fail = (message: string) =>
        errors.length < 20 && errors.push(message);
      const sheetWidth = MARKS_SHEET.columns * MARKS_SHEET.cell;
      const sheetHeight = MARKS_SHEET.rows * MARKS_SHEET.cell;

      expect(model.pyramids).toHaveLength(sources.length);
      expect(sources.length).toBe(model.rows * model.columns);
      expect(geometry.positions).toHaveLength(sources.length * 5 * 4 * 3);
      expect(flat.sides.size).toBe(sources.length * 4);

      model.pyramids.forEach((pyramid, square) => {
        const key = `${pyramid.row},${pyramid.column}`;
        const source = sources[square];
        expect(`${source.row},${source.column}`).toBe(key);
        const centre = [
          pyramid.column + 0.5 - model.columns / 2,
          0,
          pyramid.row + 0.5 - model.rows / 2,
        ];
        const faceCentres: number[][] = [];
        for (let face = 0; face < 5; face += 1) {
          const first = (square * 5 + face) * 4;
          const corners = [0, 1, 2, 3].map((at) =>
            vertexOf(geometry, first + at),
          );
          faceCentres.push(
            corners.reduce((s, c) => s.map((v, i) => v + c[i] / 4), [0, 0, 0]),
          );
          const normal = [
            ...geometry.normals.subarray(first * 3, first * 3 + 3),
          ];
          // Every corner of a face shares its normal, square and paint.
          for (let at = 0; at < 4; at += 1) {
            const v = first + at;
            if (!near([...geometry.normals.subarray(v * 3, v * 3 + 3)], normal))
              fail(`${key} face ${face}: normals differ`);
            if (geometry.squares[v] !== square) fail(`${key}: square index`);
            const expected = corners[at][1] === 0 ? 0 : 1;
            if (geometry.valleys[v] !== expected) fail(`${key}: valley`);
          }
          if (Math.abs(length(normal) - 1) > 1e-5)
            fail(`${key}: normal not unit`);
          // Both triangles wound counter-clockwise from outside.
          for (const t of [0, 1]) {
            const [a, b, c] = [
              ...geometry.index.subarray(
                first * 1.5 + t * 3,
                first * 1.5 + t * 3 + 3,
              ),
            ].map((v) => vertexOf(geometry, v));
            if (dot(cross(sub(b, a), sub(c, a)), normal) <= 0)
              fail(`${key} face ${face}: winding`);
          }
          for (const corner of corners)
            if (Math.abs(dot(sub(corner, corners[0]), normal)) > 1e-5)
              fail(`${key}: face not planar`);

          const { perU, perV, at } = faceMapping(geometry, first);
          // No mark stretched: a sheet unit as long across as down, square on.
          const [acrossUnit, downUnit] = [
            length(perU) / sheetWidth,
            length(perV) / sheetHeight,
          ];
          if (Math.abs(acrossUnit / downUnit - 1) > 1e-4)
            fail(`${key} face ${face}: aspect`);
          if (Math.abs(dot(perU, perV)) > 1e-4 * length(perU) * length(perV))
            fail(`${key} face ${face}: skewed`);
          const box = [...geometry.cells.subarray(first * 4, first * 4 + 4)];
          const cellCentre = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];

          if (face === 4) {
            expect(normal).toEqual([0, 1, 0]);
            for (const corner of corners)
              if (Math.abs(corner[1] - PYRAMID_HEIGHT) > 1e-6)
                fail(`${key}: top height`);
            if (
              !near(
                [...geometry.colours.subarray(first * 3, first * 3 + 3)],
                [1, 1, 1],
              )
            )
              fail(`${key}: top not white`);
            if (
              !near(
                [...geometry.inks.subarray(first * 3, first * 3 + 3)],
                [0, 0, 0],
              )
            )
              fail(`${key}: letter not black`);
            const letterCell =
              MARKS_SHEET.letters[view.grid[pyramid.row][pyramid.column] ?? ""];
            const column = letterCell % MARKS_SHEET.columns;
            const row = Math.floor(letterCell / MARKS_SHEET.columns);
            if (
              !near(
                box,
                [
                  column / MARKS_SHEET.columns,
                  row / MARKS_SHEET.rows,
                  (column + 1) / MARKS_SHEET.columns,
                  (row + 1) / MARKS_SHEET.rows,
                ],
                1e-6,
              )
            )
              fail(`${key}: letter cell`);
            // The letter centred on the top, upright toward row 0, the top
            // `top` units of the sheet, mirrored where the flat one is.
            if (
              !near(
                at(cellCentre[0], cellCentre[1]),
                [centre[0], PYRAMID_HEIGHT, centre[2]],
                1e-5,
              )
            )
              fail(`${key}: letter not centred`);
            const flip = flat.mirrored.has(key) ? -1 : 1;
            if (
              !near(
                perU.map((v) => v / length(perU)),
                [flip, 0, 0],
              )
            )
              fail(`${key}: letter's right`);
            if (
              !near(
                perV.map((v) => v / length(perV)),
                [0, 0, 1],
              )
            )
              fail(`${key}: letter's head`);
            if (Math.abs(downUnit * MARKS_SHEET.top - PYRAMID_TOP) > 1e-5)
              fail(`${key}: letter's size`);
            continue;
          }

          const sideNumber = face + 1;
          const flatSide = flat.sides.get(`${key},${sideNumber}`);
          if (!flatSide) {
            fail(`${key} side ${sideNumber}: not in the flat drawing`);
            continue;
          }
          // Its corners, seen from above, on the flat drawing's outline.
          const projected = corners.map((corner) =>
            flatPoint(model, flat.origin, corner),
          );
          for (const point of flatSide.points)
            if (!projected.some((p) => near(p, point, FLAT)))
              fail(
                `${key} side ${sideNumber}: ${point} not a corner (${projected.join(" ")})`,
              );
          // Out and up.
          const outward = sub(faceCentres[face], centre);
          if (!(normal[1] > 0 && dot([normal[0], 0, normal[2]], outward) > 0))
            fail(`${key} side ${sideNumber}: normal not out and up`);
          // Its paint, from the sources and as the flat drawing fills it.
          const side = source.sides[face];
          const paint = {
            colours: srgbToLinear(
              PYRAMID_COLOURS[
                (side.elementId ?? "none") as keyof typeof PYRAMID_COLOURS
              ],
            ),
            inks: srgbToLinear(inksOf(side).ink),
            outlines: srgbToLinear(inksOf(side).outline),
          };
          for (const [name, expected] of Object.entries(paint))
            for (let at = 0; at < 4; at += 1) {
              const array = geometry[name as keyof typeof paint];
              if (
                !near(
                  [...array.subarray((first + at) * 3, (first + at) * 3 + 3)],
                  expected,
                  1e-6,
                )
              )
                fail(`${key} side ${sideNumber}: ${name}`);
            }
          if (!near(srgbToLinear(flatSide.fill), paint.colours, 1e-9))
            fail(`${key}: flat fill`);
          const cell = MARKS_SHEET.marks[markKey(sideSymbol(side))];
          const column = cell % MARKS_SHEET.columns;
          const row = Math.floor(cell / MARKS_SHEET.columns);
          if (
            !near(
              box,
              [
                column / MARKS_SHEET.columns,
                row / MARKS_SHEET.rows,
                (column + 1) / MARKS_SHEET.columns,
                (row + 1) / MARKS_SHEET.rows,
              ],
              1e-6,
            )
          )
            fail(`${key} side ${sideNumber}: mark's cell`);

          // The mark: its head, seen from above, as the flat one turns it,
          // which is toward the top; its right likewise (so not mirrored).
          const symbol = flat.symbols.get(`${key},${sideNumber}`);
          const turn = (PYRAMID_SYMBOL_TURNS[face] * Math.PI) / 180;
          expect(symbol?.turn).toBe(PYRAMID_SYMBOL_TURNS[face]);
          const head = [-perV[0], -perV[2]];
          const right = [perU[0], perU[2]];
          const flatHead = [Math.sin(turn), -Math.cos(turn)];
          if (
            !near(
              head.map((v) => v / length(head)),
              flatHead,
              1e-6,
            )
          )
            fail(`${key} side ${sideNumber}: head ${head} not ${flatHead}`);
          if (
            !near(
              right.map((v) => v / length(right)),
              [Math.cos(turn), Math.sin(turn)],
              1e-6,
            )
          )
            fail(`${key} side ${sideNumber}: mirrored`);
          if (dot(head, [outward[0], outward[2]]) >= 0)
            fail(`${key}: head not toward the top`);
          // Centred in its band as the flat one is, and as large for the
          // band's depth, which on the face is its slant.
          const middle = at(cellCentre[0], cellCentre[1]);
          if (
            !symbol ||
            !near(flatPoint(model, flat.origin, middle), symbol.at, FLAT)
          )
            fail(
              `${key} side ${sideNumber}: mark at ${flatPoint(model, flat.origin, middle)}`,
            );
          const slant = Math.hypot((1 - PYRAMID_TOP) / 2, PYRAMID_HEIGHT);
          // The flat band's depth: side 1's, from the square's edge inward.
          const [edge, inner] = flat.sides.get(`${key},1`)?.points ?? [];
          const flatShare =
            ((symbol?.scale ?? 0) * MARKS_SHEET.markBox) / (inner[0] - edge[0]);
          const share = (downUnit * MARKS_SHEET.markBox) / slant;
          if (
            Math.abs(share - SYMBOL_FILL) > 1e-5 ||
            Math.abs(share - flatShare) > 0.005
          )
            fail(
              `${key} side ${sideNumber}: mark fills ${share}, flat ${flatShare}`,
            );
        }
        // Side 2 nearest row 0, side 4 farthest; side 1 left, side 3 right.
        const [left, upper, right, lower] = faceCentres;
        if (
          !(
            upper[2] < centre[2] &&
            lower[2] > centre[2] &&
            left[0] < centre[0] &&
            right[0] > centre[0]
          )
        )
          fail(`${key}: sides out of place`);
      });
      expect(errors).toEqual([]);
      expect(
        new Set(
          model.pyramids
            .filter((p) => p.mirrored)
            .map((p) => `${p.row},${p.column}`),
        ),
      ).toEqual(flat.mirrored);
    },
  );

  it("indexes a mesh too large for 16 bits with 32", () => {
    const pyramid = tabletModel(viewOf("earth", "gd"), MARKS_SHEET).pyramids[0];
    const columns = 60;
    const pyramids = Array.from({ length: columns * columns }, (_, i) => ({
      ...pyramid,
      row: Math.floor(i / columns),
      column: i % columns,
    }));
    const geometry = pyramidGeometry(
      { rows: columns, columns, pyramids, squares: pyramids.map((_, i) => i) },
      MARKS_SHEET,
    );
    expect(geometry.index).toBeInstanceOf(Uint32Array);
    expect(geometry.index.at(-1)).toBe(columns * columns * 20 - 1);
  });

  it("leaves a face with no mark outside every cell", () => {
    const model = tabletModel(viewOf("union", "gd"), MARKS_SHEET);
    const pyramids = model.pyramids.map((p) => ({
      ...p,
      letter: null,
      letterCell: -1,
    }));
    const geometry = pyramidGeometry({ ...model, pyramids }, MARKS_SHEET);
    const top = 4 * 4;
    expect([...geometry.cells.subarray(top * 4, top * 4 + 4)]).toEqual([
      -1, -1, -1, -1,
    ]);
    expect([...geometry.uvs.subarray(top * 2, top * 2 + 2)]).toEqual([0, 0]);
  });
});

describe("picking a square by a ray", () => {
  const models = (["earth", "union"] as const).map((tablet) =>
    tabletModel(viewOf(tablet, "gd"), MARKS_SHEET),
  );
  const centreOf = (model: Tablet3DModel, row: number, column: number) =>
    [column + 0.5 - model.columns / 2, 0, row + 0.5 - model.rows / 2] as const;
  const toward = (target: readonly number[], direction: readonly number[]) => {
    const unit = direction.map((v) => v / length(direction));
    return [
      target.map((v, i) => v - unit[i] * 40) as unknown as Vec3,
      unit as unknown as Vec3,
    ] as const;
  };
  const degrees = (angle: number) => (angle * Math.PI) / 180;

  it.each(models.map((model) => [model.columns, model]))(
    "picks each square straight down through its centre (%i columns)",
    (_, model) => {
      for (const [index, { row, column }] of model.pyramids.entries()) {
        const [x, , z] = centreOf(model, row, column);
        expect(pickSquare(model, [x, 5, z], [0, -1, 0])).toEqual({
          row,
          column,
          index,
        });
      }
    },
  );

  it.each(models.map((model) => [model.columns, model]))(
    "picks the pyramid whose face a low ray is aimed at (%i columns)",
    (_, model) => {
      const missed: string[] = [];
      const slant = (1 - PYRAMID_TOP) / 4;
      for (const [index, { row, column }] of model.pyramids.entries()) {
        const centre = centreOf(model, row, column);
        const faces = [
          [-1, 0],
          [0, -1],
          [1, 0],
          [0, 1],
        ].map(([dx, dz]) => ({
          // The middle of the side's band, and its outward direction.
          at: [
            centre[0] + dx * (0.5 - slant),
            PYRAMID_HEIGHT / 2,
            centre[2] + dz * (0.5 - slant),
          ],
          out: [dx, dz],
        }));
        faces.push({ at: [centre[0], PYRAMID_HEIGHT, centre[2]], out: [1, 0] });
        faces.forEach(({ at, out }, face) => {
          const azimuths = face === 4 ? [0, 90, 180, 270, 35] : [-35, 0, 35];
          for (const azimuth of azimuths)
            for (const elevation of [15, 25, 40, 65]) {
              const [c, s] = [
                Math.cos(degrees(azimuth)),
                Math.sin(degrees(azimuth)),
              ];
              const ground = [out[0] * c - out[1] * s, out[0] * s + out[1] * c];
              const e = degrees(elevation);
              const [origin, direction] = toward(at, [
                -ground[0] * Math.cos(e),
                -Math.sin(e),
                -ground[1] * Math.cos(e),
              ]);
              const picked = pickSquare(model, origin, direction);
              if (picked?.index !== index)
                missed.push(
                  `${row},${column} face ${face} at ${azimuth}°/${elevation}°: ${JSON.stringify(picked)}`,
                );
            }
        });
      }
      expect(missed).toEqual([]);
    },
  );

  it("gives a low ray the raised face it meets, not the ground behind it", () => {
    const model = models[0];
    const [x, , z] = centreOf(model, 6, 5);
    // Aimed at the ground just inside the next square to the right, past
    // this pyramid's right side, which stands in the way.
    const e = degrees(10);
    const [origin, direction] = toward(
      [x + 0.55, 0, z],
      [Math.cos(e), -Math.sin(e), 0],
    );
    expect(pickSquare(model, origin, direction)).toMatchObject({
      row: 6,
      column: 5,
    });
    // Straight down at the same point, the next square.
    expect(pickSquare(model, [x + 0.55, 3, z], [0, -1, 0])).toMatchObject({
      row: 6,
      column: 6,
    });
  });

  it("lets a ray skimming over the tops land on the one it is aimed at", () => {
    const model = models[0];
    const [x, , z] = centreOf(model, 6, model.columns - 1);
    const e = degrees(1);
    const [origin, direction] = toward(
      [x, PYRAMID_HEIGHT, z],
      [Math.cos(e), -Math.sin(e), 0],
    );
    expect(pickSquare(model, origin, direction)).toMatchObject({
      row: 6,
      column: model.columns - 1,
    });
  });

  it("picks nothing for a ray that meets no pyramid", () => {
    const [model] = models;
    const [halfX, halfZ] = [model.columns / 2, model.rows / 2];
    const rays: [Vec3, Vec3][] = [
      [
        [halfX + 0.5, 3, 0],
        [0, -1, 0],
      ],
      [
        [0, 3, -halfZ - 0.01],
        [0, -1, 0],
      ],
      [
        [-20, PYRAMID_HEIGHT + 0.01, 0],
        [1, 0, 0],
      ],
      [
        [0, 3, 0],
        [0.3, 1, 0.2],
      ],
      [
        [-halfX - 1, 0.05, -halfZ - 1],
        [0, 0, 1],
      ],
      [
        [-halfX - 1, 0.05, -halfZ - 1],
        [-1, -0.01, -1],
      ],
      // Through the corner beyond the last square.
      [
        [halfX + 2, 1, halfZ - 1],
        [-1, -0.2, 2],
      ],
      // From over a side, just above it, rising past the top's edge: below
      // the planes of the sides there, but above the top.
      [
        [-0.7, 0.16, 0],
        [1, 0.3, 0],
      ],
    ];
    for (const [origin, direction] of rays)
      expect(pickSquare(model, origin, direction)).toBeNull();
  });

  it("enters from any edge and skips squares without a pyramid", () => {
    const [model] = models;
    const empty = { ...model, squares: model.squares.map(() => -1) };
    expect(pickSquare(empty, [0, 3, 0], [0, -1, 0])).toBeNull();
    expect(pickSquare(empty, [-10, 0.1, 0], [1, 0, 0])).toBeNull();
    // Low and level, so through the middle of a row or column.
    for (const [origin, direction] of [
      [
        [20, 0.05, 0],
        [-1, 0, 0],
      ],
      [
        [0.5, 0.05, 20],
        [0, 0, -1],
      ],
      [
        [0.5, 0.05, -20],
        [0, 0, 1],
      ],
      [
        [-20, 0.05, 0],
        [1, 0, 0],
      ],
    ] as [Vec3, Vec3][])
      expect(pickSquare(model, origin, direction)).not.toBeNull();
  });
});
