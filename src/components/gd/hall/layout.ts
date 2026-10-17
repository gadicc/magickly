import {
  attr,
  booleanAttr,
  clamp,
  enumAttr,
  numberAttr,
  stringAttr,
} from "./attributes";
import {
  compassFont,
  LABEL_SIZE,
  LINE_HEIGHT,
  labelFont,
  type TextLine,
  wrapText,
} from "./labels";
import type { HallArt, HallArtBox, HallArtRegistry, HallNode } from "./types";
import { hallArtKey, hallTagSpec } from "./validate";
import {
  BANNER_SIDES,
  type BannerSide,
  COORDINATE_RANGE,
  HALL_POINT_OFFSETS,
  HALL_POINTS,
  type HallPoint,
  hallPoint,
  LABEL_POSITIONS,
  type LabelPosition,
  MAX_HALL_DEPTH,
  MAX_HALL_NODES,
  RESERVED_TAGS,
  roleName,
  SCALE_RANGE,
  SIZE_RANGE,
} from "./vocabulary";

/**
 * The layout resolver (plan 061, decision 4): pure functions from a hall
 * node to positions, sizes, labels and bounds, in checker squares. The
 * floor frame has its origin at the floor's North-East corner; x runs
 * North → South (0–16) and y East → West (0–16), so on screen East is at
 * the top and North on the left.
 */

/** The floor is 16 squares each way. */
export const FLOOR_SIZE = 16;
/** Default dais depth in squares (the Neophyte drawing; Zelator uses 5). */
export const DEFAULT_DAIS = 4;
/** Gap between the floor's edge and the outer wall line, from the drawings. */
export const WALL_GAP = 0.31;
/** Stroke widths of the floor outline and the outer wall. */
export const FLOOR_STROKE = 0.14;
export const WALL_STROKE = 0.16;
/** Space between an object and its label's ink. */
export const LABEL_GAP = 0.15;
/** Compass label size and its distance from the wall line. */
export const COMPASS_SIZE = 0.53;
export const COMPASS_GAP = 0.3;
/** Space between the compass labels and a banner row beyond them. */
export const BANNER_ROW_GAP = 0.25;
/** Caption size and its distance below everything else. */
export const CAPTION_SIZE = 0.75;
export const CAPTION_GAP = 0.3;
/** Default padding around the content, in squares. */
export const DEFAULT_PADDING = 0.5;

/**
 * Default scales by kind (decision 4): `scale=1` fits an object's nominal
 * box into 2 × 2 squares, so a scale is half the longer side in squares.
 * "drawing" values are measured on the five drawings in `public/pics`
 * (6.6182 mm squares); "uniform" draws the officers one size everywhere so
 * the two can be compared. These are a layout contract: changing one moves
 * things in saved halls.
 *
 * | Kind | Drawing | Uniform | Source |
 * | --- | --- | --- | --- |
 * | officer, lamen on the floor | 0.83 | 1 | floor lamens 1.66 squares across |
 * | officer, lamen on the dais | 1.155 | 1 | dais lamens 2.31 across |
 * | altar, pillar | 1 | 1 | 2 × 2 squares |
 * | banner | 1 | 1 | Neophyte banners 1.51 × 2.02 |
 * | hebrewLetter | 1.475 | 1.475 | Zelator and Theoricus letter banners 2.95 × 2.71 |
 * | marker | 0.6 | 0.6 | none drawn; a 1.2-square box |
 * | platform, throne, board | 1 | 1 | sized in squares by `w` and `h` |
 * | item cross | 0.235 | 0.235 | Neophyte altar cross 0.35 × 0.47 |
 * | item triangle, pentagram | 0.42 | 0.42 | Neophyte altar triangle 0.84 × 0.73 |
 * | item rose | 0.85 | 0.85 | Neophyte 1.70 × 0.74 |
 * | item cup | 0.39 | 0.39 | Neophyte 0.62 × 0.79 |
 * | item salt | 0.45 | 0.45 | Neophyte 0.54 × 0.90 |
 * | item bread | 0.36 | 0.36 | Neophyte 0.72 × 0.72 |
 * | item lamp | 0.54 | 0.54 | Neophyte 0.74 × 1.08 |
 * | item lantern | 1.08 | 1.08 | Zelator floor lantern 0.94 × 2.15 |
 * | other items | 0.4 | 0.4 | none |
 * | unknown tags (placeholder) | 0.5 | 0.5 | a 1-square box |
 */
export const DEFAULT_SCALES: ReadonlyMap<string, readonly [number, number]> =
  new Map<string, readonly [number, number]>([
    ["lamen:floor", [0.83, 1]],
    ["lamen:dais", [1.155, 1]],
    ["altar", [1, 1]],
    ["pillar", [1, 1]],
    ["banner", [1, 1]],
    ["hebrewLetter", [1.475, 1.475]],
    ["marker", [0.6, 0.6]],
    ["platform", [1, 1]],
    ["throne", [1, 1]],
    ["board", [1, 1]],
    ["item:cross", [0.235, 0.235]],
    ["item:triangle", [0.42, 0.42]],
    ["item:pentagram", [0.42, 0.42]],
    ["item:rose", [0.85, 0.85]],
    ["item:cup", [0.39, 0.39]],
    ["item:salt", [0.45, 0.45]],
    ["item:bread", [0.36, 0.36]],
    ["item:lamp", [0.54, 0.54]],
    ["item:lantern", [1.08, 1.08]],
    ["item", [0.4, 0.4]],
    ["unknown", [0.5, 0.5]],
  ]);

/** The placeholder's nominal box. */
export const PLACEHOLDER_BOX: HallArtBox = { width: 100, height: 100 };

/** An axis-aligned rectangle in floor squares. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A laid-out label: lines with baselines, in floor squares. */
export interface ResolvedLabel {
  lines: readonly { text: string; x: number; y: number }[];
  size: number;
  anchor: "start" | "middle" | "end";
  bounds: Rect;
}

/** A placed object: its art, centre, scale and labels. */
export interface ResolvedObject {
  /** Child indices from the root; also a stable React key. */
  path: readonly number[];
  node: HallNode;
  /** The art registry key (`altar`, `lamen`, `item:cup`), or "label". */
  artKey: string;
  /** No art for `artKey`: drawn as the placeholder. */
  missing: boolean;
  /** The nominal box the art draws in, in art units. */
  box: HallArtBox;
  /** Centre, in floor squares. */
  cx: number;
  cy: number;
  /** Floor squares per art unit. */
  k: number;
  /** Drawn size, in squares. */
  width: number;
  height: number;
  labels: readonly ResolvedLabel[];
  /** Lines of a free `label`, which draws as text instead of art. */
  text?: ResolvedLabel;
}

/** A gap in a wall. */
export interface ResolvedDoor {
  side: BannerSide;
  /** Along the wall: x for East and West, y for North and South. */
  from: number;
  to: number;
}

/** A compass word, its baseline point and rotation. */
export interface ResolvedCompassLabel {
  text: "East" | "West" | "North" | "South";
  x: number;
  y: number;
  rotate: 0 | 90 | -90;
  size: number;
}

/** Everything the renderer needs, in floor squares. */
export interface ResolvedHall {
  dais: number;
  wall: "plain" | "gradient";
  /** The outer wall line (centre of its stroke). */
  outer: Rect;
  doors: readonly ResolvedDoor[];
  objects: readonly ResolvedObject[];
  compass: readonly ResolvedCompassLabel[];
  caption?: ResolvedLabel;
  captionText?: string;
  labelSize: number;
  viewBox: Rect;
}

/** What the resolver needs besides the hall. */
export interface ResolveHallOptions {
  art?: HallArtRegistry;
}

interface Frame {
  /** Origin in floor squares. */
  ox: number;
  oy: number;
  /** Floor squares per frame unit. */
  unit: number;
  /** The parent's box in frame units, for `at`. */
  box: Rect;
}

type Context = "floor" | "dais";

interface Prepared {
  node: HallNode;
  path: readonly number[];
  artKey: string;
  art: HallArt | undefined;
  box: HallArtBox;
  /** Size before the frame's unit, in frame units. */
  w: number;
  h: number;
  /** Frame units per art unit. */
  k: number;
  /** The scale used, given or default. */
  scale: number;
  isHost: boolean;
  labels: PreparedLabel[];
  text?: { lines: TextLine[]; size: number };
  children: { node: HallNode; path: readonly number[] }[];
}

interface PreparedLabel {
  lines: TextLine[];
  size: number;
  pos: LabelPosition;
}

const point = (box: Rect, name: HallPoint): [number, number] => {
  const [fx, fy] = HALL_POINT_OFFSETS.get(name) as readonly [number, number];
  return [
    (box.x0 + box.x1) / 2 + (fx * (box.x1 - box.x0)) / 2,
    (box.y0 + box.y1) / 2 + (fy * (box.y1 - box.y0)) / 2,
  ];
};

const union = (a: Rect, b: Rect): Rect => ({
  x0: Math.min(a.x0, b.x0),
  y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1),
  y1: Math.max(a.y1, b.y1),
});

const coordinate = (value: number | undefined) =>
  value === undefined ? undefined : clamp(value, ...COORDINATE_RANGE);

const isNode = (value: unknown): value is HallNode =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { type?: unknown }).type === "string";

const childrenOf = (node: HallNode) =>
  Array.isArray(node.children) ? (node.children as unknown[]) : [];

/** Ink depth of a label block: what it adds beside its object. */
const labelDepth = (label: PreparedLabel) =>
  label.pos === "left" || label.pos === "right"
    ? LABEL_GAP + Math.max(0, ...label.lines.map((line) => line.width))
    : LABEL_GAP +
      (labelFont.top + labelFont.bottom) * label.size +
      (label.lines.length - 1) * label.size * LINE_HEIGHT;

/** Height of a text block from the first line's ink top to the last's descent. */
const textHeight = (lines: number, size: number) =>
  (labelFont.top + labelFont.bottom) * size + (lines - 1) * size * LINE_HEIGHT;

/** Lays out the lines of a label around an object's box. */
function placeLabel(label: PreparedLabel, object: Rect): ResolvedLabel {
  const { lines, size, pos } = label;
  const advance = size * LINE_HEIGHT;
  const cx = (object.x0 + object.x1) / 2;
  const widest = Math.max(0, ...lines.map((line) => line.width));
  const height = textHeight(lines.length, size);
  let firstBaseline: number;
  let x: number;
  let anchor: ResolvedLabel["anchor"] = "middle";
  if (pos === "bottom") {
    firstBaseline = object.y1 + LABEL_GAP + labelFont.top * size;
    x = cx;
  } else if (pos === "top") {
    firstBaseline =
      object.y0 -
      LABEL_GAP -
      labelFont.bottom * size -
      (lines.length - 1) * advance;
    x = cx;
  } else {
    firstBaseline =
      (object.y0 + object.y1) / 2 - height / 2 + labelFont.top * size;
    anchor = pos === "left" ? "end" : "start";
    x = pos === "left" ? object.x0 - LABEL_GAP : object.x1 + LABEL_GAP;
  }
  const top = firstBaseline - labelFont.top * size;
  const left =
    anchor === "middle" ? x - widest / 2 : anchor === "end" ? x - widest : x;
  return {
    lines: lines.map((line, index) => ({
      text: line.text,
      x,
      y: firstBaseline + index * advance,
    })),
    size,
    anchor,
    bounds: { x0: left, y0: top, x1: left + widest, y1: top + height },
  };
}

/** Lays out a free label's lines centred in its own box. */
function placeText(
  text: { lines: TextLine[]; size: number },
  box: Rect,
): ResolvedLabel {
  const x = (box.x0 + box.x1) / 2;
  const first = box.y0 + labelFont.top * text.size;
  return {
    lines: text.lines.map((line, index) => ({
      text: line.text,
      x,
      y: first + index * text.size * LINE_HEIGHT,
    })),
    size: text.size,
    anchor: "middle",
    bounds: box,
  };
}

/**
 * Resolves a hall to drawable geometry. Never throws for bad content:
 * malformed values are ignored, out-of-range ones clamped, numeric strings
 * coerced, and unknown tags kept as placeholders.
 */
export function resolveHall(
  hall: HallNode,
  options: ResolveHallOptions = {},
): ResolvedHall {
  const art = options.art ?? new Map<string, HallArt>();
  const dais = clamp(numberAttr(hall, "dais") ?? DEFAULT_DAIS, 0, 16);
  const wall = enumAttr(hall, "wall", ["plain", "gradient"]) ?? "plain";
  const showCompass = booleanAttr(hall, "compass") ?? true;
  const sizes = enumAttr(hall, "sizes", ["drawing", "uniform"]) ?? "drawing";
  const padding = clamp(numberAttr(hall, "padding") ?? DEFAULT_PADDING, 0, 16);
  const labelSize = clamp(numberAttr(hall, "labelSize") ?? LABEL_SIZE, 0.05, 4);
  const officerScale = numberAttr(hall, "officerScale");

  const eastWall = -Math.max(dais, WALL_GAP);
  const outer: Rect = {
    x0: -WALL_GAP,
    y0: eastWall,
    x1: FLOOR_SIZE + WALL_GAP,
    y1: FLOOR_SIZE + WALL_GAP,
  };
  const floorBox: Rect = { x0: 0, y0: 0, x1: FLOOR_SIZE, y1: FLOOR_SIZE };
  const floorFrame: Frame = { ox: 0, oy: 0, unit: 1, box: floorBox };

  let visited = 0;
  const objects: ResolvedObject[] = [];
  const doors: ResolvedDoor[] = [];
  const floorItems: { node: HallNode; path: readonly number[] }[] = [];
  const rows: {
    node: HallNode;
    path: readonly number[];
    kind: "dais" | BannerSide;
  }[] = [];
  let captionText: string | undefined;

  const defaultScale = (artKey: string, tag: string, context: Context) => {
    if (artKey === "lamen") {
      if (officerScale !== undefined) return officerScale;
      return (DEFAULT_SCALES.get(`lamen:${context}`) as readonly number[])[
        sizes === "uniform" ? 1 : 0
      ];
    }
    const entry =
      DEFAULT_SCALES.get(artKey) ??
      (tag === "item" ? DEFAULT_SCALES.get("item") : undefined) ??
      (DEFAULT_SCALES.get("unknown") as readonly [number, number]);
    return entry[sizes === "uniform" ? 1 : 0];
  };

  const prepareLabels = (
    node: HallNode,
    tag: string,
    width: number,
    context: Context,
    children: unknown[],
  ): PreparedLabel[] => {
    const fallbackPos: LabelPosition = context === "dais" ? "top" : "bottom";
    const pos = enumAttr(node, "labelPos", LABEL_POSITIONS) ?? fallbackPos;
    const labels: PreparedLabel[] = [];
    const own = stringAttr(node, "label", 200);
    const labelChildren = children.filter(
      (child): child is HallNode => isNode(child) && child.type === "label",
    );
    if (own !== undefined) {
      if (own !== "")
        labels.push({
          lines: wrapText(own, width, labelSize),
          size: labelSize,
          pos,
        });
    } else if (labelChildren.length === 0 && tag === "officer") {
      const role = stringAttr(node, "role", 200);
      if (role !== undefined)
        labels.push({
          lines: wrapText(roleName(role), width, labelSize),
          size: labelSize,
          pos,
        });
    }
    for (const child of labelChildren) {
      const size = clamp(numberAttr(child, "size") ?? labelSize, 0.05, 4);
      const boxWidth = numberAttr(child, "width");
      labels.push({
        lines: wrapText(
          stringAttr(child, "text", 200) ?? "",
          boxWidth === undefined ? width : clamp(boxWidth, ...SIZE_RANGE),
          size,
        ),
        size,
        pos: enumAttr(child, "pos", LABEL_POSITIONS) ?? pos,
      });
    }
    return labels.filter((label) => label.lines.length > 0);
  };

  /** Size, art and labels of a placeable, before it is positioned. */
  const prepare = (
    node: HallNode,
    path: readonly number[],
    context: Context,
  ): Prepared => {
    const tag = node.type;
    const children = childrenOf(node);
    if (tag === "label") {
      const size = clamp(numberAttr(node, "size") ?? labelSize, 0.05, 4);
      const text = stringAttr(node, "text", 200) ?? "";
      const given = numberAttr(node, "width");
      const lines = wrapText(
        text,
        given === undefined
          ? Number.POSITIVE_INFINITY
          : clamp(given, ...SIZE_RANGE),
        size,
      );
      const w = given ?? Math.max(0, ...lines.map((line) => line.width));
      return {
        node,
        path,
        artKey: "label",
        art: undefined,
        box: { width: w, height: textHeight(lines.length, size) },
        w,
        h: textHeight(lines.length, size),
        k: 1,
        scale: 1,
        isHost: false,
        labels: [],
        text: { lines, size },
        children: [],
      };
    }
    const artKey = hallArtKey(node);
    const known =
      !RESERVED_TAGS.has(tag) && hallTagSpec(tag, art) !== undefined;
    const drawn = known ? art.get(artKey) : undefined;
    let box = PLACEHOLDER_BOX;
    let fit: HallArt["fit"] = "box";
    if (drawn) {
      const candidate =
        typeof drawn.box === "function" ? drawn.box(node) : drawn.box;
      if (
        Number.isFinite(candidate.width) &&
        Number.isFinite(candidate.height) &&
        candidate.width > 0 &&
        candidate.height > 0
      ) {
        box = candidate;
        fit = drawn.fit ?? "box";
      }
    }
    const missing = !drawn || box === PLACEHOLDER_BOX;
    const scale = clamp(
      numberAttr(node, "scale") ?? defaultScale(artKey, tag, context),
      ...SCALE_RANGE,
    );
    const unscaled =
      missing || fit === "box" ? 2 / Math.max(box.width, box.height) : 1;
    const k = unscaled * scale;
    const w = box.width * k;
    const h = box.height * k;
    const isHost = hallTagSpec(tag, art)?.role === "host";
    return {
      node,
      path,
      artKey,
      art: missing ? undefined : drawn,
      box,
      w,
      h,
      k,
      scale,
      isHost,
      labels: prepareLabels(node, tag, w, context, children),
      children: isHost
        ? children.flatMap((child, index) =>
            isNode(child) && child.type !== "label"
              ? [{ node: child, path: [...path, index] }]
              : [],
          )
        : [],
    };
  };

  /** Places a prepared object in a frame and appends it (and a host's children). */
  const place = (
    item: Prepared,
    frame: Frame,
    defaults: { x?: number; y?: number },
    depth: number,
  ) => {
    const node = item.node;
    const at = hallPoint(enumAttr(node, "at", [...HALL_POINTS, "center"]));
    const anchor =
      hallPoint(enumAttr(node, "anchor", [...HALL_POINTS, "center"])) ??
      "centre";
    const x = coordinate(numberAttr(node, "x"));
    const y = coordinate(numberAttr(node, "y"));
    let px: number;
    let py: number;
    if (at) {
      const [bx, by] = point(frame.box, at);
      px = bx + (x ?? 0);
      py = by + (y ?? 0);
    } else {
      const [cx, cy] = point(frame.box, "centre");
      px = x ?? defaults.x ?? cx;
      py = y ?? defaults.y ?? cy;
    }
    const [ax, ay] = HALL_POINT_OFFSETS.get(anchor) as readonly [
      number,
      number,
    ];
    const localX = px - (ax * item.w) / 2;
    const localY = py - (ay * item.h) / 2;
    const cx = frame.ox + localX * frame.unit;
    const cy = frame.oy + localY * frame.unit;
    const width = item.w * frame.unit;
    const height = item.h * frame.unit;
    const rect: Rect = {
      x0: cx - width / 2,
      y0: cy - height / 2,
      x1: cx + width / 2,
      y1: cy + height / 2,
    };
    const resolved: ResolvedObject = {
      path: item.path,
      node,
      artKey: item.artKey,
      missing: item.art === undefined && item.artKey !== "label",
      box: item.box,
      cx,
      cy,
      k: item.k * frame.unit,
      width,
      height,
      labels: item.labels.map((label) => placeLabel(label, rect)),
    };
    if (item.text) resolved.text = placeText(item.text, rect);
    objects.push(resolved);
    if (!item.isHost) return;
    // A host's children live in its unscaled squares, centred on it, and
    // scale and move with it.
    const halfW = item.w / item.scale / 2;
    const halfH = item.h / item.scale / 2;
    const hostFrame: Frame = {
      ox: cx,
      oy: cy,
      unit: item.scale * frame.unit,
      box: { x0: -halfW, y0: -halfH, x1: halfW, y1: halfH },
    };
    for (const child of item.children) {
      if (!enter(child.node, depth + 1)) continue;
      place(prepare(child.node, child.path, "floor"), hostFrame, {}, depth + 1);
    }
  };

  const enter = (node: unknown, depth: number): node is HallNode => {
    if (++visited > MAX_HALL_NODES || depth > MAX_HALL_DEPTH) return false;
    return isNode(node);
  };

  /** Placeables, free labels and doors under a floor or row node. */
  const placeables = (node: HallNode, path: readonly number[], depth: number) =>
    childrenOf(node).flatMap((child, index) => {
      if (!enter(child, depth + 1)) return [];
      const childPath = [...path, index];
      if (child.type === "door") {
        addDoor(child);
        return [];
      }
      const role = hallTagSpec(child.type, art)?.role;
      if (role && !["placeable", "host", "label"].includes(role)) return [];
      return [{ node: child, path: childPath }];
    });

  const addDoor = (node: HallNode) => {
    const side = enumAttr(node, "side", BANNER_SIDES) ?? "west";
    const along =
      side === "east" || side === "west"
        ? numberAttr(node, "x")
        : numberAttr(node, "y");
    const centre = clamp(along ?? FLOOR_SIZE / 2, 0, FLOOR_SIZE);
    const width = clamp(numberAttr(node, "width") ?? 2, 0, FLOOR_SIZE);
    doors.push({ side, from: centre - width / 2, to: centre + width / 2 });
  };

  // Gather the structure first: rows need the wall and compass geometry.
  childrenOf(hall).forEach((child, index) => {
    if (!enter(child, 1)) return;
    const path = [index];
    switch (child.type) {
      case "floor":
        floorItems.push(...placeables(child, path, 1));
        return;
      case "dais":
        rows.push({ node: child, path, kind: "dais" });
        return;
      case "banners":
        rows.push({
          node: child,
          path,
          kind: enumAttr(child, "side", BANNER_SIDES) ?? "east",
        });
        return;
      case "caption":
        captionText = stringAttr(child, "text", 200) ?? captionText;
        return;
      case "door":
        addDoor(child);
        return;
    }
    const role = hallTagSpec(child.type, art)?.role;
    // Placeables directly under gdHall are drawn on the floor.
    if (role === undefined || ["placeable", "host", "label"].includes(role))
      floorItems.push({ node: child, path });
  });

  for (const item of floorItems)
    place(prepare(item.node, item.path, "floor"), floorFrame, {}, 2);

  // The compass labels sit just outside the wall lines; banner rows beyond.
  const compassDepth = (compassFont.top + compassFont.bottom) * COMPASS_SIZE;
  const clearance = showCompass
    ? COMPASS_GAP + compassDepth + BANNER_ROW_GAP
    : COMPASS_GAP;
  const compass: ResolvedCompassLabel[] = showCompass
    ? [
        {
          text: "East",
          x: FLOOR_SIZE / 2,
          y: outer.y0 - COMPASS_GAP - compassFont.bottom * COMPASS_SIZE,
          rotate: 0,
          size: COMPASS_SIZE,
        },
        {
          text: "West",
          x: FLOOR_SIZE / 2,
          y: outer.y1 + COMPASS_GAP + compassFont.top * COMPASS_SIZE,
          rotate: 0,
          size: COMPASS_SIZE,
        },
        {
          text: "North",
          x: outer.x0 - COMPASS_GAP - compassFont.bottom * COMPASS_SIZE,
          y: FLOOR_SIZE / 2,
          rotate: -90,
          size: COMPASS_SIZE,
        },
        {
          text: "South",
          x: outer.x1 + COMPASS_GAP + compassFont.bottom * COMPASS_SIZE,
          y: FLOOR_SIZE / 2,
          rotate: 90,
          size: COMPASS_SIZE,
        },
      ]
    : [];

  for (const row of rows) {
    const context: Context = row.kind === "dais" ? "dais" : "floor";
    const items = placeables(row.node, row.path, 1).map((item) =>
      prepare(item.node, item.path, context),
    );
    const vertical = row.kind === "north" || row.kind === "south";
    const spreadAttr = vertical ? "y" : "x";
    const crossAttr = vertical ? "x" : "y";
    const free = (item: Prepared) =>
      attr(item.node, "at") === undefined ||
      enumAttr(item.node, "at", [...HALL_POINTS, "center"]) === undefined;
    const spread = items.filter(
      (item) => free(item) && numberAttr(item.node, spreadAttr) === undefined,
    );
    const lineItems = items.filter(
      (item) => free(item) && numberAttr(item.node, crossAttr) === undefined,
    );
    // How far each item reaches before and after the row line, labels included.
    const reach = (item: Prepared, side: "before" | "after") => {
      const half = (vertical ? item.w : item.h) / 2;
      const labelSide = vertical
        ? side === "before"
          ? "left"
          : "right"
        : side === "before"
          ? "top"
          : "bottom";
      return (
        half +
        Math.max(
          0,
          ...item.labels
            .filter((label) => label.pos === labelSide)
            .map(labelDepth),
        )
      );
    };
    const before = Math.max(
      0,
      ...lineItems.map((item) => reach(item, "before")),
    );
    const after = Math.max(0, ...lineItems.map((item) => reach(item, "after")));
    let line: number;
    switch (row.kind) {
      case "dais":
        // Centre the row's block, labels included, in the dais band.
        line = -dais / 2 - (after - before) / 2;
        break;
      case "east":
        line = outer.y0 - clearance - after;
        break;
      case "west":
        line = outer.y1 + clearance + before;
        break;
      case "north":
        line = outer.x0 - clearance - after;
        break;
      case "south":
        line = outer.x1 + clearance + before;
        break;
    }
    const ends = enumAttr(row.node, "spread", ["even", "ends"]) === "ends";
    const positions = new Map(
      spread.map((item, index) => [
        item,
        ends
          ? spread.length === 1
            ? FLOOR_SIZE / 2
            : (index * FLOOR_SIZE) / (spread.length - 1)
          : ((index + 0.5) * FLOOR_SIZE) / spread.length,
      ]),
    );
    for (const item of items) {
      const along = positions.get(item);
      place(
        item,
        floorFrame,
        vertical ? { x: line, y: along } : { x: along, y: line },
        2,
      );
    }
  }

  // Bounds: the walls, every object and label, then the caption below.
  let bounds: Rect = {
    x0: outer.x0 - WALL_STROKE / 2,
    y0: outer.y0 - WALL_STROKE / 2,
    x1: outer.x1 + WALL_STROKE / 2,
    y1: outer.y1 + WALL_STROKE / 2,
  };
  for (const object of objects) {
    bounds = union(bounds, {
      x0: object.cx - object.width / 2,
      y0: object.cy - object.height / 2,
      x1: object.cx + object.width / 2,
      y1: object.cy + object.height / 2,
    });
    for (const label of object.labels) bounds = union(bounds, label.bounds);
  }
  for (const label of compass) {
    const width = compassFont.width(label.text, label.size);
    const up = compassFont.top * label.size;
    const down = compassFont.bottom * label.size;
    bounds = union(
      bounds,
      label.rotate === 0
        ? {
            x0: label.x - width / 2,
            y0: label.y - up,
            x1: label.x + width / 2,
            y1: label.y + down,
          }
        : label.rotate === -90
          ? {
              x0: label.x - up,
              y0: label.y - width / 2,
              x1: label.x + down,
              y1: label.y + width / 2,
            }
          : {
              x0: label.x - down,
              y0: label.y - width / 2,
              x1: label.x + up,
              y1: label.y + width / 2,
            },
    );
  }
  let caption: ResolvedLabel | undefined;
  if (captionText) {
    const lines = wrapText(captionText, FLOOR_SIZE, CAPTION_SIZE);
    if (lines.length > 0) {
      caption = placeLabel(
        { lines, size: CAPTION_SIZE, pos: "bottom" },
        {
          x0: 0,
          x1: FLOOR_SIZE,
          y0: bounds.y1 + CAPTION_GAP - LABEL_GAP,
          y1: bounds.y1 + CAPTION_GAP - LABEL_GAP,
        },
      );
      bounds = union(bounds, caption.bounds);
    }
  }

  const margin = numberAttr(hall, "margin");
  const side = (name: string) => {
    const value = numberAttr(hall, name) ?? margin;
    return value === undefined ? undefined : clamp(value, 0, 48);
  };
  const north = side("marginNorth");
  const south = side("marginSouth");
  const east = side("marginEast");
  const west = side("marginWest");
  const viewBox: Rect = {
    x0: north === undefined ? bounds.x0 - padding : outer.x0 - north,
    x1: south === undefined ? bounds.x1 + padding : outer.x1 + south,
    y0: east === undefined ? bounds.y0 - padding : outer.y0 - east,
    y1: west === undefined ? bounds.y1 + padding : outer.y1 + west,
  };

  return {
    dais,
    wall,
    outer,
    doors,
    objects,
    compass,
    caption,
    captionText,
    labelSize,
    viewBox,
  };
}
