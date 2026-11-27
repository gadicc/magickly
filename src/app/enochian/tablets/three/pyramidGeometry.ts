/**
 * A tablet's pyramids as typed arrays for one merged mesh, and picking a
 * square by a ray (plan 101). Pure: no three.js and no DOM, so that a
 * WebXR controller's ray picks as the mouse's does.
 *
 * Tablet-local axes: one unit a square, x across the columns, z down the
 * rows, y up, the origin at the tablet's centre and the pyramids' bases
 * at y = 0. Seen from above, x is to the right and z down the page, as
 * the flat drawing has them, so side 1 faces −x, side 2 −z (toward row
 * 0), side 3 +x and side 4 +z.
 */
import { PYRAMID_SYMBOL_TURNS } from "magick-components/enochian/pyramidMarks";
import { PYRAMID_TOP_SYMBOLS } from "magick-components/enochian/Tablet";
import {
  type FacePaint,
  type MarksSheet,
  type Tablet3DModel,
  TOP_PAINT,
} from "./model";

/** A pyramid's height, a sixth of its square (Gadi, 26 November 2026). */
export const PYRAMID_HEIGHT = 1 / 6;

/** The flat top's side, a third of its square, as the flat drawing's. */
export const PYRAMID_TOP = PYRAMID_TOP_SYMBOLS;

/**
 * How much of a side's depth its mark's box fills: `SYMBOL_FILL` in the
 * flat drawing (`tabletSvg.tsx`), which does not export it; the geometry
 * test reads the flat drawing's scale to hold the two equal. On a face
 * the depth is the slant, so the mark keeps its shape there.
 */
export const SYMBOL_FILL = 0.78;

/** A point or direction in tablet-local space. */
export type Vec3 = readonly [x: number, y: number, z: number];

/**
 * The tablet's mesh, every face a quad of 4 vertices and 2 triangles,
 * counter-clockwise seen from outside. Per vertex: `positions`,
 * `normals` (flat per face), `uvs` into the sheet (u right, v down from
 * the sheet's top left, so the texture is uploaded without flipY; they
 * run past the mark's cell, which bounds them), `cells` (the cell's u0,
 * v0, u1, v1, all −1 for a face with no mark), the face's `colours`,
 * `inks` and `outlines` in linear RGB, `squares` (the pyramid's index in
 * the model, for highlights) and `valleys` (0 at a pyramid's base, 1 at
 * its top).
 */
export interface PyramidGeometry {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly cells: Float32Array;
  readonly colours: Float32Array;
  readonly inks: Float32Array;
  readonly outlines: Float32Array;
  readonly squares: Float32Array;
  readonly valleys: Float32Array;
  readonly index: Uint16Array | Uint32Array;
}

/** Each side's outward direction on the ground, as (x, z), sides 1 to 4. */
const OUTWARD = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
] as const;

const INSET = (1 - PYRAMID_TOP) / 2;
const SLANT = Math.hypot(INSET, PYRAMID_HEIGHT);

const add = (a: Vec3, b: Vec3, scale = 1): Vec3 => [
  a[0] + b[0] * scale,
  a[1] + b[1] * scale,
  a[2] + b[2] * scale,
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalise = (a: Vec3): Vec3 => {
  const length = Math.hypot(...a);
  return [a[0] / length, a[1] / length, a[2] / length];
};

/** A square's centre on the ground. */
const centreOf = (model: Tablet3DModel, row: number, column: number): Vec3 => [
  column + 0.5 - model.columns / 2,
  0,
  row + 0.5 - model.rows / 2,
];

/** A side's outward normal, out and up (unnormalised for the picking). */
const sideNormal = ([dx, dz]: readonly [number, number]): Vec3 => [
  dx * PYRAMID_HEIGHT,
  INSET,
  dz * PYRAMID_HEIGHT,
];

/**
 * A direction drawn on the ground, as the flat drawing turns a mark,
 * lifted onto the plane with `normal`: what is seen from above is kept.
 */
const lift = ([x, z]: readonly [number, number], normal: Vec3): Vec3 =>
  normalise([x, -(x * normal[0] + z * normal[2]) / normal[1], z]);

/** The geometry of a tablet's pyramids, from its model and the sheet. */
export function pyramidGeometry(
  model: Tablet3DModel,
  sheet: MarksSheet,
): PyramidGeometry {
  const count = model.pyramids.length * 5 * 4;
  const array = (size: number) => new Float32Array(count * size);
  const out = {
    positions: array(3),
    normals: array(3),
    uvs: array(2),
    cells: array(4),
    colours: array(3),
    inks: array(3),
    outlines: array(3),
    squares: array(1),
    valleys: array(1),
    // WebGL 2 always restarts primitives at index 0xffff, so 16 bits
    // hold only indices below it.
    index:
      count > 0xffff
        ? new Uint32Array((count / 4) * 6)
        : new Uint16Array((count / 4) * 6),
  };
  let vertex = 0;

  /**
   * A quad from its corners, counter-clockwise from outside: base left,
   * base right, top right, top left. A mark in `cell` is centred on
   * `centre`, its right and head along `right` and `head`, and the cell
   * `span` units a side.
   */
  const quad = (
    corners: readonly Vec3[],
    normal: Vec3,
    paint: FacePaint,
    square: number,
    mark: { cell: number; centre: Vec3; right: Vec3; head: Vec3; span: number },
  ) => {
    const { cell, centre, right, head, span } = mark;
    const column = cell % sheet.columns;
    const row = Math.floor(cell / sheet.columns);
    const box =
      cell < 0
        ? [-1, -1, -1, -1]
        : [
            column / sheet.columns,
            row / sheet.rows,
            (column + 1) / sheet.columns,
            (row + 1) / sheet.rows,
          ];
    const first = vertex;
    for (const corner of corners) {
      const from = add(corner, centre, -1);
      out.positions.set(corner, vertex * 3);
      out.normals.set(normal, vertex * 3);
      if (cell >= 0)
        out.uvs.set(
          [
            (column + 0.5 + dot(from, right) / span) / sheet.columns,
            (row + 0.5 - dot(from, head) / span) / sheet.rows,
          ],
          vertex * 2,
        );
      out.cells.set(box, vertex * 4);
      out.colours.set(paint.colour, vertex * 3);
      out.inks.set(paint.ink, vertex * 3);
      out.outlines.set(paint.outline, vertex * 3);
      out.squares[vertex] = square;
      out.valleys[vertex] = corner[1] / PYRAMID_HEIGHT;
      vertex += 1;
    }
    out.index.set(
      [first, first + 1, first + 2, first, first + 2, first + 3],
      (first / 4) * 6,
    );
  };

  const markSpan = (SYMBOL_FILL * SLANT * sheet.cell) / sheet.markBox;
  const letterSpan = (PYRAMID_TOP * sheet.cell) / sheet.top;
  model.pyramids.forEach((pyramid, square) => {
    const centre = centreOf(model, pyramid.row, pyramid.column);
    const top = add(centre, [0, PYRAMID_HEIGHT, 0]);
    pyramid.sides.forEach((side, at) => {
      const [dx, dz] = OUTWARD[at];
      // Right as seen from outside the face, along its base.
      const along: Vec3 = [dz, 0, -dx];
      const base = add(centre, [dx, 0, dz], 0.5);
      const edge = add(top, [dx, 0, dz], PYRAMID_TOP / 2);
      const normal = normalise(sideNormal(OUTWARD[at]));
      // The flat drawing's turn, as SVG's rotate() in its y-down frame,
      // whose x and y are this frame's x and z.
      const turn = (PYRAMID_SYMBOL_TURNS[at] * Math.PI) / 180;
      const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
      quad(
        [
          add(base, along, -0.5),
          add(base, along, 0.5),
          add(edge, along, PYRAMID_TOP / 2),
          add(edge, along, -PYRAMID_TOP / 2),
        ],
        normal,
        side,
        square,
        {
          cell: side.cell,
          centre: add(base, add(edge, base, -1), 0.5),
          right: lift([cos, sin], normal),
          head: lift([sin, -cos], normal),
          span: markSpan,
        },
      );
    });
    const half = PYRAMID_TOP / 2;
    quad(
      [
        add(top, [-half, 0, half]),
        add(top, [half, 0, half]),
        add(top, [half, 0, -half]),
        add(top, [-half, 0, -half]),
      ],
      [0, 1, 0],
      // The sheet draws a letter without an outline; any colour will do.
      { ...TOP_PAINT, outline: TOP_PAINT.ink },
      square,
      {
        cell: pyramid.letterCell,
        centre: top,
        right: [pyramid.mirrored ? -1 : 1, 0, 0],
        head: [0, 0, -1],
        span: letterSpan,
      },
    );
  });
  return out;
}

/** A square a ray picked: its row and column, and its pyramid's index. */
export interface PickedSquare {
  readonly row: number;
  readonly column: number;
  readonly index: number;
}

/** A plane: its outward normal and a point on it. */
type Plane = readonly [normal: Vec3, point: Vec3];

/**
 * The parameter at which a ray enters a convex solid bounded by planes,
 * or null for a miss (Kay and Kajiya's slabs, generalised).
 */
function enters(
  planes: readonly Plane[],
  origin: Vec3,
  direction: Vec3,
): number | null {
  let [near, far] = [0, Number.POSITIVE_INFINITY];
  for (const [normal, point] of planes) {
    const facing = dot(normal, direction);
    const outside = dot(normal, add(origin, point, -1));
    if (facing === 0) {
      if (outside > 0) return null;
    } else if (facing < 0) near = Math.max(near, -outside / facing);
    else far = Math.min(far, -outside / facing);
  }
  return near <= far ? near : null;
}

/** A box's six planes, from its least and its greatest corner. */
const boxPlanes = (low: Vec3, high: Vec3): Plane[] =>
  [0, 1, 2].flatMap((axis) => {
    const unit = [0, 1, 2].map((i) => (i === axis ? 1 : 0)) as unknown as Vec3;
    return [[add([0, 0, 0], unit, -1), low] as const, [unit, high] as const];
  });

/** A pyramid's solid: its base, its top and its four sides. */
const pyramidPlanes = (centre: Vec3): Plane[] => [
  [[0, -1, 0], centre],
  [[0, 1, 0], add(centre, [0, PYRAMID_HEIGHT, 0])],
  ...OUTWARD.map(
    (out) => [sideNormal(out), add(centre, [out[0], 0, out[1]], 0.5)] as const,
  ),
];

/**
 * The square whose pyramid a ray in tablet-local space meets first, or
 * null. It walks the squares the ray crosses over the tablet, nearest
 * first, and tests each one's pyramid, so a low ray picks the raised face
 * it meets, not the square behind it that a ground hit would give. A ray
 * from below the tablet's ground (y < 0) picks nothing.
 */
export function pickSquare(
  model: Tablet3DModel,
  origin: Vec3,
  direction: Vec3,
): PickedSquare | null {
  // From under the ground, which is drawn beneath the tablet and hides
  // it; and the mesh has no bases to pick.
  if (origin[1] < 0) return null;
  const { columns, rows } = model;
  const box = enters(
    boxPlanes(
      [-columns / 2, 0, -rows / 2],
      [columns / 2, PYRAMID_HEIGHT, rows / 2],
    ),
    origin,
    direction,
  );
  if (box === null) return null;
  // Amanatides and Woo's walk over the grid, from where the ray enters.
  const at = add(origin, direction, box);
  const start = [at[0] + columns / 2, at[2] + rows / 2];
  // Clamped, since the entry point lies on the tablet's edge.
  const cell = [
    Math.max(0, Math.min(columns - 1, Math.floor(start[0]))),
    Math.max(0, Math.min(rows - 1, Math.floor(start[1]))),
  ];
  const ray = [direction[0], direction[2]];
  const step = ray.map(Math.sign);
  const next = [0, 1].map((axis) =>
    step[axis] === 0
      ? Number.POSITIVE_INFINITY
      : box + (cell[axis] + (step[axis] > 0 ? 1 : 0) - start[axis]) / ray[axis],
  );
  const delta = ray.map((d) => Math.abs(1 / d));
  while (cell[0] >= 0 && cell[0] < columns && cell[1] >= 0 && cell[1] < rows) {
    const [column, row] = cell;
    const index = model.squares[row * columns + column];
    if (
      index >= 0 &&
      enters(pyramidPlanes(centreOf(model, row, column)), origin, direction) !==
        null
    )
      return { row, column, index };
    const axis = next[0] < next[1] ? 0 : 1;
    // A vertical ray crosses no other square.
    if (step[axis] === 0) return null;
    cell[axis] += step[axis];
    next[axis] += delta[axis];
  }
  return null;
}
