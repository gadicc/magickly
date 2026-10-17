import { describe, expect, it } from "vitest";
import {
  compassFont,
  LABEL_SIZE,
  LINE_HEIGHT,
  labelFont,
  MAX_LABEL_LINES,
  wrapText,
} from "./labels";
import {
  BANNER_ROW_GAP,
  CAPTION_GAP,
  COMPASS_GAP,
  COMPASS_SIZE,
  DEFAULT_SCALES,
  LABEL_GAP,
  MAX_HALL_LABEL_LINES,
  MIN_LABEL_WIDTH,
  type ResolvedObject,
  resolveHall,
  WALL_GAP,
  WALL_STROKE,
} from "./layout";
import type { HallArt, HallNode } from "./types";
import { validateHall } from "./validate";
import { MAX_HALL_DEPTH, MAX_HALL_NODES } from "./vocabulary";

const provenance = {
  origin: "original",
  author: "test",
  licence: "MIT",
} as const;
const drawing = (width: number, height = width): HallArt => ({
  Component: () => null,
  box: { width, height },
  provenance,
});
const art = new Map<string, HallArt>([
  ["lamen", drawing(100)],
  ["altar", drawing(100)],
  ["pillar", drawing(100)],
  ["banner", drawing(100, 125)],
  ["hebrewLetter", drawing(100, 92)],
  ["item:cross", drawing(60, 100)],
  [
    "platform",
    {
      Component: () => null,
      box: (node) => ({
        width: Number(node.w ?? 4),
        height: Number(node.h ?? 3),
      }),
      fit: "squares",
      provenance,
    },
  ],
  [
    "throne",
    { Component: () => null, box: () => ({ width: 0, height: 1 }), provenance },
  ],
]);

const hall = (attrs: Record<string, unknown>, ...children: unknown[]) =>
  ({ type: "gdHall", ...attrs, children }) as HallNode;
const floor = (...children: unknown[]) => ({ type: "floor", children });
const resolve = (node: HallNode) => resolveHall(node, { art });
const only = (node: HallNode) => {
  const { objects } = resolve(node);
  return objects;
};
const at = (objects: readonly ResolvedObject[], path: number[]) =>
  objects.find(
    (object) => object.path.join() === path.join(),
  ) as ResolvedObject;
const labelDepth = (lines = 1, size = LABEL_SIZE) =>
  LABEL_GAP +
  (labelFont.top + labelFont.bottom) * size +
  (lines - 1) * size * LINE_HEIGHT;

describe("resolveHall: the floor frame", () => {
  it("places by x and y from the North-East corner, coercing strings", () => {
    const [pillar, other] = only(
      hall(
        {},
        floor(
          { type: "pillar", kind: "black", x: 4, y: 3 },
          { type: "pillar", kind: "white", x: "12", y: "3" },
        ),
      ),
    );
    expect(pillar).toMatchObject({ cx: 4, cy: 3, width: 2, height: 2 });
    expect(pillar.k).toBeCloseTo(0.02, 10);
    expect(other).toMatchObject({ cx: 12, cy: 3 });
  });

  it("defaults missing coordinates to the floor's centre", () => {
    const [altar] = only(hall({}, floor({ type: "altar", x: 2 })));
    expect(altar).toMatchObject({ cx: 2, cy: 8 });
  });

  it("measures x and y from an `at` point on the floor", () => {
    const objects = only(
      hall(
        {},
        floor(
          { type: "altar", at: "centre" },
          { type: "altar", at: "north", x: 1 },
          { type: "altar", at: "northEast" },
          { type: "altar", at: "southWest", x: -1, y: -1 },
          { type: "altar", at: "center" },
          { type: "altar", at: "east" },
          { type: "altar", at: "middle", x: 3, y: 4 },
        ),
      ),
    );
    expect(objects.map((object) => [object.cx, object.cy])).toEqual([
      [8, 8],
      [1, 8],
      [0, 0],
      [15, 15],
      [8, 8],
      [8, 0],
      [3, 4],
    ]);
  });

  it("places by an anchor point instead of the centre", () => {
    const objects = only(
      hall(
        {},
        floor(
          { type: "pillar", x: 4, y: 3, anchor: "north" },
          { type: "pillar", x: 4, y: 3, anchor: "southWest" },
          { type: "pillar", at: "northEast", anchor: "northEast" },
        ),
      ),
    );
    expect(objects.map((object) => [object.cx, object.cy])).toEqual([
      [5, 3],
      [3, 2],
      [1, 1],
    ]);
  });

  it("clamps coordinates and scales, and ignores malformed values", () => {
    const [far, big, bad] = only(
      hall(
        {},
        floor(
          { type: "pillar", x: 1000, y: -1000 },
          { type: "pillar", scale: 500 },
          { type: "pillar", x: "abc", y: "1e999", scale: "NaN" },
        ),
      ),
    );
    expect(far).toMatchObject({ cx: 64, cy: -48 });
    expect(big.width).toBe(20);
    expect(bad).toMatchObject({ cx: 8, cy: 8, width: 2 });
  });
});

describe("resolveHall: scales", () => {
  it("uses the per-kind defaults from the drawings", () => {
    const objects = only(
      hall(
        {},
        { type: "dais", children: [{ type: "officer", role: "hierophant" }] },
        floor(
          { type: "officer", role: "hegemon", x: 8, y: 3 },
          { type: "banner", kind: "east", x: 9.4, y: 0 },
          { type: "hebrewLetter", letter: "shin", x: 2, y: 2 },
          { type: "unicorn" },
        ),
      ),
    );
    const width = (path: number[]) => at(objects, path).width;
    expect(width([1, 0])).toBeCloseTo(1.66, 10);
    expect(width([0, 0])).toBeCloseTo(2.31, 10);
    expect(at(objects, [1, 1]).height).toBeCloseTo(2, 10);
    expect(width([1, 2])).toBeCloseTo(2.95, 10);
    expect(width([1, 3])).toBe(1);
    expect(at(objects, [1, 3]).missing).toBe(true);
  });

  it("draws the officers one size with sizes=uniform or officerScale", () => {
    const officers = (attrs: Record<string, unknown>) =>
      only(
        hall(
          attrs,
          { type: "dais", children: [{ type: "officer", role: "imperator" }] },
          floor({ type: "officer", role: "keryx" }, { type: "altar" }),
        ),
      ).map((object) => object.width);
    expect(officers({ sizes: "uniform" })).toEqual([2, 2, 2]);
    expect(officers({ officerScale: 0.5 })).toEqual([1, 2, 1]);
    expect(officers({ officerScale: "0.5", sizes: "uniform" })).toEqual([
      1, 2, 1,
    ]);
  });

  it("documents every default in one table", () => {
    expect(DEFAULT_SCALES.get("lamen:floor")).toEqual([0.83, 1]);
    expect(DEFAULT_SCALES.get("lamen:dais")).toEqual([1.155, 1]);
    expect(DEFAULT_SCALES.get("item:cross")).toEqual([0.235, 0.235]);
  });
});

describe("resolveHall: hosts", () => {
  it("gives children a frame centred on the host, in its squares", () => {
    const objects = only(
      hall(
        {},
        floor({
          type: "altar",
          at: "centre",
          children: [
            { type: "item", kind: "cross", y: -0.4 },
            { type: "item", kind: "cross", at: "east" },
            { type: "item", kind: "cross", at: "north", y: 0.35 },
            { type: "label", text: "attached" },
          ],
        }),
      ),
    );
    expect(objects).toHaveLength(4);
    expect([at(objects, [0, 0, 0]).cx, at(objects, [0, 0, 0]).cy]).toEqual([
      8, 7.6,
    ]);
    expect(at(objects, [0, 0, 0]).height).toBeCloseTo(0.47, 10);
    expect([at(objects, [0, 0, 1]).cx, at(objects, [0, 0, 1]).cy]).toEqual([
      8, 7,
    ]);
    expect([at(objects, [0, 0, 2]).cx, at(objects, [0, 0, 2]).cy]).toEqual([
      7, 8.35,
    ]);
    expect(at(objects, [0, 0]).labels[0].lines[0].text).toBe("attached");
  });

  it("scales and moves the children with the host", () => {
    const objects = only(
      hall(
        {},
        floor({
          type: "altar",
          x: 8,
          y: 8,
          scale: 2,
          children: [
            { type: "item", kind: "cross", y: -0.4 },
            { type: "item", kind: "cross", at: "east" },
          ],
        }),
      ),
    );
    expect(at(objects, [0, 0]).width).toBe(4);
    expect(at(objects, [0, 0, 0]).cy).toBeCloseTo(7.2, 10);
    expect(at(objects, [0, 0, 0]).height).toBeCloseTo(0.94, 10);
    expect(at(objects, [0, 0, 1]).cy).toBe(6);
  });

  it("sizes platforms in squares and places their officers", () => {
    const objects = only(
      hall(
        {},
        floor({
          type: "platform",
          x: 8,
          y: 14.5,
          w: 4,
          h: 3,
          children: [
            { type: "officer", role: "hiereus", labelPos: "top" },
            { type: "officer", role: "hiereus", at: "north", x: 0.5 },
          ],
        }),
      ),
    );
    expect(at(objects, [0, 0])).toMatchObject({ width: 4, height: 3 });
    expect(at(objects, [0, 0, 0])).toMatchObject({ cx: 8, cy: 14.5 });
    expect(at(objects, [0, 0, 0]).width).toBeCloseTo(1.66, 10);
    expect(at(objects, [0, 0, 1])).toMatchObject({ cx: 6.5, cy: 14.5 });
  });

  it("ignores children of placeables that are not labels", () => {
    const objects = only(
      hall(
        {},
        floor({ type: "pillar", children: [{ type: "pillar" }, "text", {}] }),
      ),
    );
    expect(objects).toHaveLength(1);
  });
});

describe("resolveHall: rows", () => {
  const dais = (children: unknown[], attrs = {}) => ({
    type: "dais",
    ...attrs,
    children,
  });
  const officer = (role: string, attrs = {}) => ({
    type: "officer",
    role,
    ...attrs,
  });

  it("spreads the dais officers evenly and centres the row in the band", () => {
    const objects = only(
      hall(
        { dais: 4 },
        dais(
          ["imperator", "cancellarius", "hierophant", "keryx", "sentinel"].map(
            (role) => officer(role),
          ),
        ),
      ),
    );
    expect(objects.map((object) => object.cx)).toEqual([
      1.6, 4.8, 8, 11.2, 14.4,
    ]);
    const line = -2 + labelDepth() / 2;
    for (const object of objects) expect(object.cy).toBeCloseTo(line, 10);
    // The drawings put the dais lamens' centres 1.73 squares above the floor.
    expect(line).toBeCloseTo(-1.71, 2);
  });

  it("keeps given positions and spreads the rest", () => {
    const objects = only(
      hall(
        { dais: 5 },
        dais([
          officer("imperator"),
          officer("hierophant", { x: 3 }),
          officer("cancellarius"),
          officer("keryx", { y: -1 }),
          officer("sentinel", { at: "east" }),
        ]),
      ),
    );
    expect(objects.map((object) => object.cx)).toEqual([
      16 / 6,
      3,
      8,
      (2.5 * 16) / 3,
      8,
    ]);
    expect(objects[3].cy).toBe(-1);
    expect(objects[4].cy).toBe(0);
  });

  it("puts the ends on the corners with spread=ends", () => {
    const ends = (count: number) =>
      only(
        hall(
          {},
          {
            type: "banners",
            spread: "ends",
            children: Array.from({ length: count }, () => ({
              type: "hebrewLetter",
              letter: "shin",
            })),
          },
        ),
      ).map((object) => object.cx);
    expect(ends(3)).toEqual([0, 8, 16]);
    expect(ends(1)).toEqual([8]);
  });

  it("wraps a two-line dais label upwards and keeps the lamens in line", () => {
    const objects = only(
      hall({}, dais([officer("hierophant"), officer("pastHierophant")])),
    );
    expect(objects[0].cy).toBe(objects[1].cy);
    const [past] = objects[1].labels;
    expect(past.lines.map((line) => line.text)).toEqual(["Past", "Hierophant"]);
    const top = objects[1].cy - objects[1].height / 2;
    expect(past.lines[1].y).toBeCloseTo(
      top - LABEL_GAP - labelFont.bottom * LABEL_SIZE,
      10,
    );
    expect(past.lines[0].y).toBeCloseTo(
      past.lines[1].y - LABEL_SIZE * LINE_HEIGHT,
      10,
    );
    expect(objects[1].cy).toBeCloseTo(-2 + labelDepth(2) / 2, 10);
  });

  it("stands banner rows beyond the compass labels on every side", () => {
    const row = (side: string, attrs = {}) =>
      resolve(
        hall(attrs, {
          type: "banners",
          side,
          children: [{ type: "banner", kind: "east" }],
        }),
      );
    const clearance =
      COMPASS_GAP +
      (compassFont.top + compassFont.bottom) * COMPASS_SIZE +
      BANNER_ROW_GAP;
    const east = row("east");
    const [banner] = east.objects;
    expect(banner.cy + banner.height / 2).toBeCloseTo(
      east.outer.y0 - clearance,
      10,
    );
    const west = row("west").objects[0];
    expect(west.cy - west.height / 2).toBeCloseTo(
      16 + WALL_GAP + clearance,
      10,
    );
    const north = row("north").objects[0];
    expect(north.cx + north.width / 2).toBeCloseTo(-WALL_GAP - clearance, 10);
    expect(north.cy).toBe(8);
    const south = row("south").objects[0];
    expect(south.cx - south.width / 2).toBeCloseTo(
      16 + WALL_GAP + clearance,
      10,
    );
    const bare = row("east", { compass: false }).objects[0];
    expect(bare.cy + bare.height / 2).toBeCloseTo(-4 - COMPASS_GAP, 10);
  });

  it("counts a side label towards the hall in a North row", () => {
    const [banner] = only(
      hall(
        {},
        {
          type: "banners",
          side: "north",
          children: [{ type: "banner", label: "Banner", labelPos: "right" }],
        },
      ),
    );
    const [bare] = only(
      hall(
        {},
        { type: "banners", side: "north", children: [{ type: "banner" }] },
      ),
    );
    expect(banner.labels[0].bounds.x1).toBeCloseTo(
      bare.cx + bare.width / 2,
      10,
    );
  });

  it("counts a label wider than its banner in a North row", () => {
    const [banner] = only(
      hall(
        {},
        {
          type: "banners",
          side: "north",
          children: [{ type: "banner", label: "Praemonstratorship" }],
        },
      ),
    );
    const clearance =
      COMPASS_GAP +
      (compassFont.top + compassFont.bottom) * COMPASS_SIZE +
      BANNER_ROW_GAP;
    const [label] = banner.labels;
    expect(label.bounds.x1 - label.bounds.x0).toBeGreaterThan(banner.width);
    expect(label.bounds.x1).toBeCloseTo(-WALL_GAP - clearance, 10);
  });

  it("counts a side label taller than its banner in an East row", () => {
    const [banner] = only(
      hall(
        {},
        {
          type: "banners",
          children: [
            {
              type: "banner",
              labelPos: "right",
              label: "1\n2\n3\n4\n5\n6",
            },
          ],
        },
      ),
    );
    const [label] = banner.labels;
    expect(label.bounds.y1 - label.bounds.y0).toBeGreaterThan(banner.height);
    const { outer } = resolve(hall({}));
    expect(label.bounds.y1).toBeLessThanOrEqual(outer.y0);
  });

  it("counts a banner's label towards the hall when placing the row", () => {
    const [banner] = only(
      hall(
        {},
        {
          type: "banners",
          children: [{ type: "banner", kind: "west", label: "Banner" }],
        },
      ),
    );
    const below = banner.labels[0].bounds.y1;
    const [bare] = only(
      hall({}, { type: "banners", children: [{ type: "banner" }] }),
    );
    expect(below).toBeCloseTo(bare.cy + bare.height / 2, 10);
  });
});

describe("resolveHall: labels", () => {
  it("labels officers with their role, below on the floor", () => {
    const [hegemon] = only(
      hall({}, floor({ type: "officer", role: "hegemon", x: 8, y: 3 })),
    );
    const [label] = hegemon.labels;
    expect(label.anchor).toBe("middle");
    expect(label.lines).toEqual([
      {
        text: "Hegemon",
        x: 8,
        y: 3 + 0.83 + LABEL_GAP + labelFont.top * LABEL_SIZE,
      },
    ]);
    expect(label.bounds.y0).toBeCloseTo(3 + 0.83 + LABEL_GAP, 10);
    expect(label.bounds.x1 - label.bounds.x0).toBeCloseTo(
      labelFont.width("Hegemon", LABEL_SIZE),
      10,
    );
  });

  it("follows labelPos, label text, label children and the hall size", () => {
    const objects = only(
      hall(
        { labelSize: 0.5 },
        floor(
          { type: "officer", role: "keryx", labelPos: "left", x: 8, y: 8 },
          { type: "officer", role: "keryx", labelPos: "right", x: 8, y: 8 },
          { type: "officer", role: "keryx", label: "" },
          { type: "pillar", label: "Pillar of Mercy", labelPos: "top" },
          {
            type: "officer",
            role: "keryx",
            children: [
              { type: "label", text: "Keryx", pos: "top", size: 0.3 },
              { type: "label", text: "Two words", width: 0.5 },
              { type: "label" },
            ],
          },
          { type: "officer", role: "unknownRole" },
          { type: "officer" },
        ),
      ),
    );
    const [left, right, hidden, pillar, keryx, unknown, roleless] = objects;
    expect(left.labels[0]).toMatchObject({ anchor: "end", size: 0.5 });
    expect(left.labels[0].lines[0].x).toBeCloseTo(8 - 0.83 - LABEL_GAP, 10);
    expect(left.labels[0].bounds.x1).toBeCloseTo(8 - 0.83 - LABEL_GAP, 10);
    expect(right.labels[0].anchor).toBe("start");
    expect(right.labels[0].bounds.x0).toBeCloseTo(8 + 0.83 + LABEL_GAP, 10);
    // A side label is centred on the object's centre line.
    const middle = (right.labels[0].bounds.y0 + right.labels[0].bounds.y1) / 2;
    expect(middle).toBeCloseTo(8, 10);
    expect(hidden.labels).toEqual([]);
    expect(pillar.labels[0].lines.map((line) => line.text)).toEqual([
      "Pillar of",
      "Mercy",
    ]);
    expect(keryx.labels.map((label) => label.size)).toEqual([0.3, 0.5]);
    expect(keryx.labels[1].lines.map((line) => line.text)).toEqual([
      "Two",
      "words",
    ]);
    expect(unknown.labels[0].lines.map((line) => line.text)).toEqual([
      "Unknown",
      "Role",
    ]);
    expect(roleless.labels).toEqual([]);
  });

  it("stacks labels on one side, each beyond the one before", () => {
    const [keryx] = only(
      hall(
        {},
        floor({
          type: "officer",
          role: "keryx",
          x: 8,
          y: 8,
          children: [
            { type: "label", text: "One" },
            { type: "label", text: "Two", pos: "top" },
            { type: "label", text: "Three" },
            { type: "label", text: "Four", pos: "left" },
            { type: "label", text: "Five", pos: "left" },
          ],
        }),
      ),
    );
    const [one, two, three, four, five] = keryx.labels;
    expect(one.bounds.y0).toBeCloseTo(8 + 0.83 + LABEL_GAP, 10);
    expect(three.bounds.y0).toBeCloseTo(one.bounds.y1 + LABEL_GAP, 10);
    expect(two.bounds.y1).toBeCloseTo(8 - 0.83 - LABEL_GAP, 10);
    expect(four.bounds.x1).toBeCloseTo(8 - 0.83 - LABEL_GAP, 10);
    expect(five.bounds.x1).toBeCloseTo(four.bounds.x0 - LABEL_GAP, 10);
  });

  it("wraps a host's children's labels at their drawn width", () => {
    const text = "Banner of the West";
    const [altar, cross] = only(
      hall(
        {},
        floor({
          type: "altar",
          scale: 3,
          children: [{ type: "item", kind: "cross", scale: 1, label: text }],
        }),
      ),
    );
    expect(altar.width).toBe(6);
    expect(cross.width).toBeCloseTo(3.6, 10);
    const lines = (width: number) =>
      wrapText(text, width, LABEL_SIZE).map((line) => line.text);
    expect(cross.labels[0].lines.map((line) => line.text)).toEqual(lines(3.6));
    expect(lines(3.6)).not.toEqual(lines(1.5));
  });

  it("draws free labels as centred text", () => {
    const objects = only(
      hall(
        {},
        floor(
          { type: "label", text: "Altar of the Universe", x: 8, y: 10 },
          {
            type: "label",
            text: "Banner of the West",
            x: 4,
            y: 12,
            width: 2.31,
          },
        ),
      ),
    );
    const [plain, wrapped] = objects;
    expect(plain.artKey).toBe("label");
    expect(plain.missing).toBe(false);
    expect(plain.text?.lines).toHaveLength(1);
    expect(plain.text?.lines[0].x).toBe(8);
    expect(plain.width).toBeCloseTo(
      labelFont.width("Altar of the Universe", LABEL_SIZE),
      10,
    );
    expect(wrapped.width).toBe(2.31);
    expect(wrapped.text?.lines.map((line) => line.text)).toEqual([
      "Banner of",
      "the West",
    ]);
    expect(wrapped.text?.lines[0].y).toBeCloseTo(
      12 - wrapped.height / 2 + labelFont.top * LABEL_SIZE,
      10,
    );
  });
});

describe("resolveHall: bounded label output", () => {
  const lineCount = (objects: readonly ResolvedObject[]) =>
    objects.reduce(
      (sum, object) =>
        sum +
        (object.text?.lines.length ?? 0) +
        object.labels.reduce((n, label) => n + label.lines.length, 0),
      0,
    );

  it("wraps no narrower than MIN_LABEL_WIDTH", () => {
    const [cross, tiny] = only(
      hall(
        {},
        floor(
          { type: "item", kind: "cross", label: "Cross of the Elements" },
          { type: "officer", role: "pastHierophant", scale: 0.05 },
        ),
      ),
    );
    expect(cross.width).toBeLessThan(0.5);
    const texts = (width: number) =>
      wrapText("Cross of the Elements", width, LABEL_SIZE).map(
        (line) => line.text,
      );
    expect(texts(cross.width)).toHaveLength(4);
    expect(cross.labels[0].lines.map((line) => line.text)).toEqual(
      texts(MIN_LABEL_WIDTH),
    );
    expect(texts(MIN_LABEL_WIDTH)).toEqual(["Cross", "of the", "Elements"]);
    expect(tiny.labels[0].lines.map((line) => line.text)).toEqual([
      "Past",
      "Hierophant",
    ]);
  });

  it("draws at most MAX_HALL_LABEL_LINES lines in a hall", () => {
    // One-letter words at the smallest scale: six lines per label.
    const text = "a ".repeat(100);
    const objects = only(
      hall(
        {},
        floor(
          ...Array.from({ length: 200 }, () => ({
            type: "officer",
            scale: 0.05,
            label: text,
          })),
          ...Array.from({ length: 200 }, () => ({ type: "label", text })),
        ),
      ),
    );
    expect(objects).toHaveLength(400);
    expect(objects[0].labels[0].lines).toHaveLength(MAX_LABEL_LINES);
    expect(lineCount(objects)).toBe(MAX_HALL_LABEL_LINES);
    // Later labels lose their lines; nothing else changes.
    expect(objects[399].text?.lines).toEqual([]);
  });
});

describe("resolveHall: walls, compass, caption and bounds", () => {
  it("draws the wall around the dais and the floor", () => {
    expect(resolve(hall({})).outer).toEqual({
      x0: -WALL_GAP,
      y0: -4,
      x1: 16 + WALL_GAP,
      y1: 16 + WALL_GAP,
    });
    expect(resolve(hall({ dais: 5 })).outer.y0).toBe(-5);
    expect(resolve(hall({ dais: "5" })).dais).toBe(5);
    expect(resolve(hall({ dais: 0 })).outer.y0).toBe(-WALL_GAP);
    expect(resolve(hall({ dais: 99 })).dais).toBe(16);
    expect(resolve(hall({ wall: "gradient" })).wall).toBe("gradient");
    expect(resolve(hall({ wall: "marble" })).wall).toBe("plain");
  });

  it("collects doors on any wall", () => {
    const { doors } = resolve(
      hall(
        {},
        floor({ type: "door", x: 14, width: 2 }),
        { type: "door", side: "north", y: 4, width: "1" },
        { type: "door", side: "east" },
        { type: "door", width: 40, x: -3 },
      ),
    );
    expect(doors).toEqual([
      { side: "west", from: 13, to: 15 },
      { side: "north", from: 3.5, to: 4.5 },
      { side: "east", from: 7, to: 9 },
      { side: "west", from: -8, to: 8 },
    ]);
  });

  it("writes the compass, rotated on the sides, unless turned off", () => {
    const { compass } = resolve(hall({}));
    expect(compass.map((label) => [label.text, label.rotate])).toEqual([
      ["East", 0],
      ["West", 0],
      ["North", -90],
      ["South", 90],
    ]);
    expect(compass[0].y).toBeLessThan(-4);
    expect(compass[1].y).toBeGreaterThan(16 + WALL_GAP);
    expect(compass[2].x).toBeLessThan(-WALL_GAP);
    expect(compass[3].x).toBeGreaterThan(16 + WALL_GAP);
    expect(resolve(hall({ compass: false })).compass).toEqual([]);
    expect(resolve(hall({ compass: "false" })).compass).toEqual([]);
  });

  it("moves a compass word out past whatever stands outside its wall", () => {
    const plain = resolve(hall({})).compass;
    // An altar (2 × 2) centred 1.5 squares outside the North wall, a
    // second beyond it overlapping the first, and one well clear of both.
    const tablet = resolve(
      hall(
        {},
        floor(
          { type: "altar", x: -1.5, y: 8 },
          { type: "altar", x: -3, y: 8.5 },
          { type: "altar", x: -9, y: 8 },
        ),
      ),
    );
    const north = tablet.compass.find((label) => label.text === "North");
    // Past the second altar's outer edge (x = -4) by the gap; the word
    // fits between it and the third.
    expect(north?.x).toBeCloseTo(
      -4 - COMPASS_GAP - compassFont.bottom * COMPASS_SIZE,
      10,
    );
    expect((north?.x ?? 0) - compassFont.top * COMPASS_SIZE).toBeGreaterThan(
      -8,
    );
    // The other words, with nothing beside them, stay where they were.
    expect(tablet.compass.filter((label) => label.text !== "North")).toEqual(
      plain.filter((label) => label.text !== "North"),
    );
    // Something on the floor itself never moves them.
    expect(
      resolve(hall({}, floor({ type: "altar", x: 1.5, y: 8 }))).compass,
    ).toEqual(plain);
    // Each side moves outward: South, East and West too.
    const around = resolve(
      hall(
        {},
        floor(
          { type: "altar", x: 17.5, y: 8 },
          { type: "altar", x: 8, y: -5.5 },
          { type: "altar", x: 8, y: 17.5 },
        ),
      ),
    ).compass;
    const at = (text: string) =>
      around.find((label) => label.text === text) as (typeof around)[number];
    expect(at("South").x).toBeCloseTo(
      18.5 + COMPASS_GAP + compassFont.bottom * COMPASS_SIZE,
      10,
    );
    expect(at("East").y).toBeCloseTo(
      -6.5 - COMPASS_GAP - compassFont.bottom * COMPASS_SIZE,
      10,
    );
    expect(at("West").y).toBeCloseTo(
      18.5 + COMPASS_GAP + compassFont.top * COMPASS_SIZE,
      10,
    );
  });

  it("puts the caption below everything and wraps it at the floor's width", () => {
    const resolved = resolve(
      hall(
        { compass: false },
        floor({ type: "officer", role: "sentinel", x: 14, y: 17.2 }),
        { type: "caption", text: "Neophyte Temple" },
      ),
    );
    const sentinel = resolved.objects[0];
    expect(resolved.captionText).toBe("Neophyte Temple");
    expect(resolved.caption?.lines).toHaveLength(1);
    expect(resolved.caption?.lines[0].x).toBe(8);
    expect(resolved.caption?.bounds.y0).toBeCloseTo(
      sentinel.labels[0].bounds.y1 + CAPTION_GAP,
      10,
    );
    const long = resolve(
      hall({}, { type: "caption", text: "word ".repeat(30) }),
    );
    expect(long.caption?.lines.length).toBeGreaterThan(1);
    expect(resolve(hall({}, { type: "caption", text: " " })).caption).toBe(
      undefined,
    );
  });

  it("bounds the view on the content plus padding", () => {
    const plain = resolve(hall({ compass: false }));
    expect(plain.viewBox).toEqual({
      x0: -WALL_GAP - WALL_STROKE / 2 - 0.5,
      y0: -4 - WALL_STROKE / 2 - 0.5,
      x1: 16 + WALL_GAP + WALL_STROKE / 2 + 0.5,
      y1: 16 + WALL_GAP + WALL_STROKE / 2 + 0.5,
    });
    const padded = resolve(hall({ compass: false, padding: 2 }));
    expect(padded.viewBox.x0).toBeCloseTo(plain.viewBox.x0 - 1.5, 10);
  });

  it("widens only the side an object outside the wall stands on", () => {
    const inside = resolve(hall({}));
    // An Earth tablet outside the North wall, as in the Zelator drawing.
    const outside = resolve(
      hall({}, floor({ type: "pillar", x: -3, y: 9, label: "" })),
    );
    expect(outside.viewBox.x0).toBeCloseTo(-3 - 1 - 0.5, 10);
    expect(outside.viewBox.x1).toBe(inside.viewBox.x1);
    expect(outside.viewBox.y0).toBe(inside.viewBox.y0);
    expect(outside.viewBox.y1).toBe(inside.viewBox.y1);
  });

  it("lets margins fix a side from the wall line", () => {
    const resolved = resolve(
      hall(
        { marginNorth: 1, marginWest: "2" },
        floor({ type: "pillar", x: -3, y: 9 }),
      ),
    );
    expect(resolved.viewBox.x0).toBe(-WALL_GAP - 1);
    expect(resolved.viewBox.y1).toBe(16 + WALL_GAP + 2);
    const all = resolve(hall({ margin: 1, marginEast: 3 }));
    expect(all.viewBox).toEqual({
      x0: -WALL_GAP - 1,
      y0: -4 - 3,
      x1: 16 + WALL_GAP + 1,
      y1: 16 + WALL_GAP + 1,
    });
    expect(resolve(hall({ margin: 100 })).viewBox.x0).toBe(-WALL_GAP - 48);
  });
});

describe("resolveHall: untrusted content", () => {
  it("draws unknown, reserved and art-less tags as placeholders", () => {
    const objects = only(
      hall(
        {},
        floor(
          { type: "unicorn" },
          { type: "text", value: "x" },
          { type: "item", kind: "cup" },
          { type: "item" },
          { type: "throne" },
        ),
        { type: "altar", x: 1, y: 1 },
        { type: "title" },
      ),
    );
    expect(
      objects.map((object) => [object.artKey, object.missing, object.width]),
    ).toEqual([
      ["unicorn", true, 1],
      ["text", true, 1],
      ["item:cup", true, 0.7],
      ["item:", true, 0.8],
      ["throne", true, 2],
      ["altar", false, 2],
      ["title", true, 1],
    ]);
  });

  it("skips what is not a node and what stands in the wrong place", () => {
    const objects = only(
      hall(
        {},
        "text",
        {},
        null,
        { type: "dais", children: [{ type: "floor" }, { type: "caption" }] },
        floor({ type: "floor" }, { type: "dais" }, 5),
      ),
    );
    expect(objects).toEqual([]);
  });

  it("follows the validator's placement rules", () => {
    const resolved = resolve(
      hall(
        {},
        { type: "dais", children: [{ type: "door", x: 3 }] },
        { type: "banners", children: [{ type: "door", side: "north" }] },
        floor(
          {
            type: "altar",
            children: [
              { type: "floor" },
              { type: "dais" },
              { type: "caption", text: "x" },
              { type: "door" },
              { type: "gdHall" },
              { type: "item", kind: "cross" },
            ],
          },
          { type: "pillar", children: [{ type: "unicorn" }] },
          {
            type: "unicorn",
            children: [{ type: "label", text: "not drawn" }],
          },
          { type: "item:cross" },
        ),
      ),
    );
    // Doors only cut walls from the floor or the hall; in a row they are
    // ignored, as the validator says.
    expect(resolved.doors).toEqual([]);
    expect(resolved.objects.map((object) => object.artKey)).toEqual([
      "altar",
      "item:cross",
      "pillar",
      "unicorn",
      "item:cross",
    ]);
    const [, , , unicorn, notATag] = resolved.objects;
    expect(unicorn.labels).toEqual([]);
    // A registry key is not a tag: drawn as a placeholder.
    expect(notATag.missing).toBe(true);
  });

  it("counts label children towards the node bound, as the validator does", () => {
    const labels = Array.from({ length: MAX_HALL_NODES + 10 }, (_, i) => ({
      type: "label",
      text: `L${i}`,
    }));
    const node = hall(
      {},
      floor({ type: "officer", children: labels }, { type: "altar" }),
    );
    const [overflow] = validateHall(node, { art }).filter((diagnostic) =>
      diagnostic.message.startsWith(`more than ${MAX_HALL_NODES} nodes`),
    );
    // gdHall, floor and officer count too.
    expect(overflow.path).toEqual([0, 0, MAX_HALL_NODES - 3]);
    // The altar comes after the labels, beyond the bound.
    expect(resolve(node).objects.map((object) => object.artKey)).toEqual([
      "lamen",
    ]);
  });

  it("clamps a free label's width", () => {
    const [wide, negative, empty] = only(
      hall(
        { compass: false },
        floor(
          { type: "label", text: "Wide", width: 1e9 },
          { type: "label", text: "Narrow", width: -5 },
          { type: "label", text: "" },
        ),
      ),
    );
    expect(wide.width).toBe(48);
    expect(negative.width).toBe(0.1);
    expect([empty.width, empty.height]).toEqual([0, 0]);
    const { viewBox } = resolve(
      hall({}, floor({ type: "label", text: "Wide", width: 1e9 })),
    );
    expect(viewBox.x1 - viewBox.x0).toBeLessThan(60);
  });

  it("clamps positions and sizes in floor squares through nested hosts", () => {
    let nested: unknown = { type: "altar", x: 64, y: 64, scale: 10 };
    for (let i = 0; i < 20; i++)
      nested = { type: "altar", x: 64, y: 64, scale: 10, children: [nested] };
    const resolved = resolve(hall({}, floor(nested)));
    expect(resolved.objects).toHaveLength(21);
    for (const object of resolved.objects) {
      expect(object.cx).toBeLessThanOrEqual(64);
      expect(object.cy).toBeLessThanOrEqual(64);
      expect(Math.max(object.width, object.height)).toBeLessThan(48 + 1e-9);
    }
    const { viewBox } = resolved;
    for (const value of Object.values(viewBox))
      expect(Math.abs(value)).toBeLessThan(100);
  });

  it("stops at the depth bound without throwing", () => {
    let deep: unknown = { type: "altar" };
    for (let i = 0; i < MAX_HALL_DEPTH + 5; i++)
      deep = { type: "altar", children: [deep] };
    const objects = only(hall({}, floor(deep)));
    expect(objects.length).toBeLessThan(MAX_HALL_DEPTH + 5);
    expect(objects.length).toBeGreaterThan(MAX_HALL_DEPTH - 5);
  });

  it("works without an art registry", () => {
    const resolved = resolveHall(
      hall({}, floor({ type: "altar" })) as HallNode,
    );
    expect(resolved.objects[0].missing).toBe(true);
  });
});
