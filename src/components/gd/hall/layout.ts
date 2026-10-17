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
import {
  hallArtKey,
  hallNodesInBounds,
  hallPlacement,
  hallRole,
  hallTagSpec,
  pathKey,
} from "./spec";
import type { HallArt, HallArtBox, HallArtRegistry, HallNode } from "./types";
import {
  BANNER_SIDES,
  type BannerSide,
  COORDINATE_RANGE,
  HALL_POINT_OFFSETS,
  HALL_POINTS,
  type HallPoint,
  type HallTagRole,
  hallPoint,
  IDENTIFIER,
  LABEL_POSITIONS,
  type LabelPosition,
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
 * The narrowest box a label wraps in, in squares: a label under an item
 * or a scaled-down officer wraps as if 1.5 squares wide (a floor lamen is
 * 1.66), so it never breaks after every word.
 */
export const MIN_LABEL_WIDTH = 1.5;
/**
 * The most label lines one hall draws, free labels and markers' text
 * included and the caption not; lines beyond it are dropped in layout
 * order. The largest preset draws 16 (Theoricus 2, with its three
 * markers), so a fully labelled hall has room to spare, while
 * untrusted content (up to MAX_HALL_NODES labels of MAX_LABEL_LINES
 * lines each) cannot make the SVG grow without bound.
 */
export const MAX_HALL_LABEL_LINES = 500;
/**
 * A marker's text: smaller than labels (a marker is only 1.2 squares
 * wide), wrapped to this share of the marker's drawn width and centred in
 * it. It counts against MAX_HALL_LABEL_LINES like any label.
 */
export const MARKER_TEXT_SCALE = 0.7;
export const MARKER_TEXT_WIDTH = 0.84;

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
 * | item rose | 0.75 | 0.75 | Neophyte 1.51 × 0.55 |
 * | item cup | 0.35 | 0.35 | Neophyte 0.54 × 0.70 |
 * | item chalice | 0.47 | 0.47 | Zelator 2 altar 0.52 × 0.93 |
 * | item salt | 0.31 | 0.31 | Neophyte 0.26 × 0.62 |
 * | item bread | 0.335 | 0.335 | Neophyte 0.67 × 0.67 |
 * | item lamp | 0.47 | 0.47 | Neophyte altar 0.57 × 0.94 |
 * | item lantern | 1.19 | 1.19 | Zelator floor lantern 1.43 × 2.38 |
 * | item censer | 0.53 | 0.53 | Zelator 2 altar 0.78 × 1.06 |
 * | item fan | 0.99 | 0.99 | Theoricus 1 altar 1.98 × 1.25 |
 * | item pantacle | 1 | 1 | Theoricus badge 2 × 2 |
 * | item lightning | 0.49 | 0.49 | Theoricus 2 Flaming Sword 0.56 × 0.98 |
 * | tarotKey | 0.81 | 0.81 | Theoricus 1 altar card 0.94 × 1.62 |
 * | tablet | 1.345 | 1.345 | Theoricus Air tablet board 1.91 × 2.69 |
 * | shewbread, candlestick | 1.25 | 1.25 | Zelator 2: the outer circle 2 squares across |
 * | other items | 0.4 | 0.4 | none |
 * | unknown tags (placeholder) | 0.5 | 0.5 | a 1-square box |
 *
 * Items are measured on their own geometry, glow filters left out, in the
 * drawing where each first appears; a drawing that draws one larger (the
 * Theoricus altar's cup, the Zelator Earth tablet's larger board) is a
 * preset's `scale`, not a second default.
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
    ["item:rose", [0.75, 0.75]],
    ["item:cup", [0.35, 0.35]],
    ["item:chalice", [0.47, 0.47]],
    ["item:salt", [0.31, 0.31]],
    ["item:bread", [0.335, 0.335]],
    ["item:lamp", [0.47, 0.47]],
    ["item:lantern", [1.19, 1.19]],
    ["item:censer", [0.53, 0.53]],
    ["item:fan", [0.99, 0.99]],
    ["item:pantacle", [1, 1]],
    ["item:lightning", [0.49, 0.49]],
    ["tarotKey", [0.81, 0.81]],
    ["tablet", [1.345, 1.345]],
    ["shewbread", [1.25, 1.25]],
    ["candlestick", [1.25, 1.25]],
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
  /** Text drawn inside the object over its art: a marker's `text`. */
  inner?: ResolvedLabel;
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
  /** What the layout had to cut, which the validator reports. */
  cuts: ResolvedCuts;
}

/** What the layout cut to stay bounded or to honour a margin. */
export interface ResolvedCuts {
  /** Nodes with a label, free text or caption cut to MAX_LABEL_LINES. */
  truncated: readonly (readonly number[])[];
  /** The first node whose label lines the hall's line budget dropped. */
  overBudget?: readonly number[];
  /** Sides where a `margin*` cuts into the drawing. */
  clipped: readonly BannerSide[];
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
  /** Text to wrap inside the object once its drawn width is known. */
  inner?: string;
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

/** The box a compass word's letters fill, in floor squares. */
function compassBox(label: ResolvedCompassLabel): Rect {
  const width = compassFont.width(label.text, label.size);
  const up = compassFont.top * label.size;
  const down = compassFont.bottom * label.size;
  return label.rotate === 0
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
        };
}

/**
 * Moves a compass word outward, away from the floor, until it clears every
 * rectangle beside it by `COMPASS_GAP`: an Earth tablet hung outside the
 * North wall would otherwise cover "North". One pass, nearest first, so
 * thousands of objects cost a sort.
 */
function clearOf(
  label: ResolvedCompassLabel,
  rects: readonly Rect[],
): ResolvedCompassLabel {
  const box = compassBox(label);
  // Distances outward from the floor along the label's side, and the span
  // across it that a rectangle must share to be in the way.
  const side = {
    East: { sign: -1, along: "y", across: "x" },
    West: { sign: 1, along: "y", across: "x" },
    North: { sign: -1, along: "x", across: "y" },
    South: { sign: 1, along: "x", across: "y" },
  }[label.text];
  const out = (rect: Rect) => {
    const lo = side.along === "x" ? rect.x0 : rect.y0;
    const hi = side.along === "x" ? rect.x1 : rect.y1;
    return side.sign > 0 ? [lo, hi] : [-hi, -lo];
  };
  const [start, end] = out(box);
  const depth = end - start;
  const across = (rect: Rect) =>
    side.across === "x" ? [rect.x0, rect.x1] : [rect.y0, rect.y1];
  const [c0, c1] = across(box);
  const inTheWay = rects
    .filter((rect) => {
      const [r0, r1] = across(rect);
      return r0 < c1 && c0 < r1;
    })
    .map(out)
    .sort((a, b) => a[0] - b[0]);
  let at = start;
  for (const [near, far] of inTheWay) {
    if (near >= at + depth) break;
    if (far > at) at = far + COMPASS_GAP;
  }
  const shift = (at - start) * side.sign;
  return side.along === "x"
    ? { ...label, x: label.x + shift }
    : { ...label, y: label.y + shift };
}

const coordinate = (value: number | undefined) =>
  value === undefined ? undefined : clamp(value, ...COORDINATE_RANGE);

/**
 * A node the resolver may draw: an object whose tag is an identifier. The
 * validator ignores anything else ("a node without a valid tag"), so a
 * registry key such as `item:cup` or `<b>` used as a tag draws nothing.
 */
const isNode = (value: unknown): value is HallNode =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { type?: unknown }).type === "string" &&
  IDENTIFIER.test((value as { type: string }).type);

const childrenOf = (node: HallNode) =>
  Array.isArray(node.children) ? (node.children as unknown[]) : [];

/** Height of a text block from the first line's ink top to the last's descent. */
const textHeight = (lines: number, size: number) =>
  lines === 0
    ? 0
    : (labelFont.top + labelFont.bottom) * size +
      (lines - 1) * size * LINE_HEIGHT;

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

/**
 * Lays out an object's labels. Labels on one side stack, each growing away
 * from the object beyond the one before it.
 */
function placeLabels(
  labels: readonly PreparedLabel[],
  object: Rect,
): ResolvedLabel[] {
  const edge = { ...object };
  return labels.map((label) => {
    const placed = placeLabel(label, edge);
    if (label.pos === "top") edge.y0 = placed.bounds.y0;
    else if (label.pos === "bottom") edge.y1 = placed.bounds.y1;
    else if (label.pos === "left") edge.x0 = placed.bounds.x0;
    else edge.x1 = placed.bounds.x1;
    return placed;
  });
}

/** Lays out lines centred on a point: a marker's text in its box. */
function placeInner(lines: TextLine[], size: number, cx: number, cy: number) {
  const advance = size * LINE_HEIGHT;
  const first =
    cy -
    ((lines.length - 1) * advance) / 2 +
    ((labelFont.top - labelFont.bottom) * size) / 2;
  const widest = Math.max(0, ...lines.map((line) => line.width));
  const top = first - labelFont.top * size;
  return {
    lines: lines.map((line, index) => ({
      text: line.text,
      x: cx,
      y: first + index * advance,
    })),
    size,
    anchor: "middle",
    bounds: {
      x0: cx - widest / 2,
      y0: top,
      x1: cx + widest / 2,
      y1: top + textHeight(lines.length, size),
    },
  } satisfies ResolvedLabel;
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

  // The validator's walk decides which nodes are inside the node and depth
  // bounds, labels included, so both stop at the same node.
  const inBounds = hallNodesInBounds(hall, art);
  let lineBudget = MAX_HALL_LABEL_LINES;
  const truncated = new Map<string, readonly number[]>();
  let overBudget: readonly number[] | undefined;
  /**
   * Wraps the label of the node at `path` within the hall's line budget,
   * no narrower than `minWidth`.
   */
  const wrapLabel = (
    path: readonly number[],
    text: string,
    width: number,
    size: number,
    minWidth = MIN_LABEL_WIDTH,
  ) => {
    const lines = wrapText(text, Math.max(width, minWidth), size);
    if (lines.at(-1)?.truncated) truncated.set(pathKey(path), path);
    const kept = lines.slice(0, Math.max(0, lineBudget));
    if (kept.length < lines.length) overBudget ??= path;
    lineBudget -= kept.length;
    return kept;
  };
  const objects: ResolvedObject[] = [];
  const doors: ResolvedDoor[] = [];
  const floorItems: { node: HallNode; path: readonly number[] }[] = [];
  const rows: {
    node: HallNode;
    path: readonly number[];
    kind: "dais" | BannerSide;
  }[] = [];
  let captionText: string | undefined;
  let captionPath: readonly number[] = [];

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
    path: readonly number[],
    tag: string,
    width: number,
    context: Context,
  ): PreparedLabel[] => {
    const fallbackPos: LabelPosition = context === "dais" ? "top" : "bottom";
    const pos = enumAttr(node, "labelPos", LABEL_POSITIONS) ?? fallbackPos;
    const labels: PreparedLabel[] = [];
    const own = stringAttr(node, "label", 200);
    // A label child is attached; children of unknown tags are never read.
    const labelChildren = childrenOf(node).flatMap(
      (child, index): [HallNode, readonly number[]][] => {
        const childPath = [...path, index];
        return enter(child, childPath) && child.type === "label"
          ? [[child, childPath]]
          : [];
      },
    );
    if (own !== undefined) {
      if (own !== "")
        labels.push({
          lines: wrapLabel(path, own, width, labelSize),
          size: labelSize,
          pos,
        });
    } else if (labelChildren.length === 0 && tag === "officer") {
      const role = stringAttr(node, "role", 200);
      if (role !== undefined)
        labels.push({
          lines: wrapLabel(path, roleName(role), width, labelSize),
          size: labelSize,
          pos,
        });
    }
    for (const [child, childPath] of labelChildren) {
      const size = clamp(numberAttr(child, "size") ?? labelSize, 0.05, 4);
      const boxWidth = numberAttr(child, "width");
      labels.push({
        lines: wrapLabel(
          childPath,
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
    /** Floor squares per frame unit: labels wrap at the drawn width. */
    unit = 1,
  ): Prepared => {
    const tag = node.type;
    if (tag === "label") {
      const size = clamp(numberAttr(node, "size") ?? labelSize, 0.05, 4);
      const text = stringAttr(node, "text", 200) ?? "";
      const given = numberAttr(node, "width");
      const width =
        given === undefined ? undefined : clamp(given, ...SIZE_RANGE);
      const lines = wrapLabel(
        path,
        text,
        width ?? Number.POSITIVE_INFINITY,
        size,
      );
      const w = width ?? Math.max(0, ...lines.map((line) => line.width));
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
      labels: prepareLabels(node, path, tag, w * unit, context),
      inner:
        tag === "marker" && !missing
          ? stringAttr(node, "text", 200)
          : undefined,
      children: isHost ? placeables(node, path, "host") : [],
    };
  };

  /** Places a prepared object in a frame and appends it (and a host's children). */
  const place = (
    item: Prepared,
    frame: Frame,
    defaults: { x?: number; y?: number },
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
    // Each frame clamps its own values; nested hosts multiply them, so the
    // result is clamped again in floor squares: positions to the coordinate
    // range, sizes (and with them a host's frame) to the largest size.
    const cx = clamp(frame.ox + localX * frame.unit, ...COORDINATE_RANGE);
    const cy = clamp(frame.oy + localY * frame.unit, ...COORDINATE_RANGE);
    const largest = SIZE_RANGE[1];
    const fit =
      largest / Math.max(largest, item.w * frame.unit, item.h * frame.unit);
    const unit = frame.unit * fit;
    const width = item.w * unit;
    const height = item.h * unit;
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
      k: item.k * unit,
      width,
      height,
      labels: placeLabels(item.labels, rect),
    };
    if (item.text) resolved.text = placeText(item.text, rect);
    if (item.inner) {
      // Inside the box, as the marker drew it before: no minimum width,
      // since the box is the limit, but every line counts.
      const size = labelSize * MARKER_TEXT_SCALE;
      const lines = wrapLabel(
        item.path,
        item.inner,
        MARKER_TEXT_WIDTH * width,
        size,
        0,
      );
      if (lines.length > 0) resolved.inner = placeInner(lines, size, cx, cy);
    }
    objects.push(resolved);
    if (!item.isHost) return;
    // A host's children live in its unscaled squares, centred on it, and
    // scale and move with it.
    const halfW = item.w / item.scale / 2;
    const halfH = item.h / item.scale / 2;
    const hostFrame: Frame = {
      ox: cx,
      oy: cy,
      unit: item.scale * unit,
      box: { x0: -halfW, y0: -halfH, x1: halfW, y1: halfH },
    };
    for (const child of item.children)
      place(
        prepare(child.node, child.path, "floor", hostFrame.unit),
        hostFrame,
        {},
      );
  };

  /** Whether a node is inside the bounds and a node at all. */
  function enter(node: unknown, path: readonly number[]): node is HallNode {
    return inBounds.has(pathKey(path)) && isNode(node);
  }

  /**
   * The placeables a floor, row or host draws, by the shared placement
   * rules: a host's `label` children are attached to it, not placed, and a
   * floor's doors cut the walls.
   */
  function placeables(
    node: HallNode,
    path: readonly number[],
    parent: HallTagRole,
  ) {
    return childrenOf(node).flatMap((child, index) => {
      const childPath = [...path, index];
      if (!enter(child, childPath)) return [];
      const role = hallRole(child.type, art);
      if (hallPlacement(parent, role) !== "allowed") return [];
      if (role === "door") {
        addDoor(child);
        return [];
      }
      if (parent === "host" && role === "label") return [];
      return [{ node: child, path: childPath }];
    });
  }

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
    const path = [index];
    if (!enter(child, path)) return;
    const placement = hallPlacement("root", hallRole(child.type, art));
    // Placeables directly under gdHall are drawn on the floor.
    if (placement === "floor") floorItems.push({ node: child, path });
    if (placement !== "allowed") return;
    switch (child.type) {
      case "floor":
        floorItems.push(...placeables(child, path, "floor"));
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
      case "caption": {
        const text = stringAttr(child, "text", 200);
        if (text !== undefined) {
          captionText = text;
          captionPath = path;
        }
        return;
      }
      case "door":
        addDoor(child);
        return;
    }
  });

  for (const item of floorItems)
    place(prepare(item.node, item.path, "floor"), floorFrame, {});

  // The compass labels sit just outside the wall lines, clear of anything
  // drawn there; banner rows beyond.
  const floorRects = objects.flatMap((object) => [
    {
      x0: object.cx - object.width / 2,
      y0: object.cy - object.height / 2,
      x1: object.cx + object.width / 2,
      y1: object.cy + object.height / 2,
    },
    ...object.labels.map((label) => label.bounds),
    ...(object.text ? [object.text.bounds] : []),
    ...(object.inner ? [object.inner.bounds] : []),
  ]);
  const compassDepth = (compassFont.top + compassFont.bottom) * COMPASS_SIZE;
  const clearance = showCompass
    ? COMPASS_GAP + compassDepth + BANNER_ROW_GAP
    : COMPASS_GAP;
  const besideWalls: ResolvedCompassLabel[] = showCompass
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
  const compass = besideWalls.map((label) => clearOf(label, floorRects));

  for (const row of rows) {
    const context: Context = row.kind === "dais" ? "dais" : "floor";
    const items = placeables(row.node, row.path, "row").map((item) =>
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
    // How far each item reaches before and after the row line, every label
    // included: a side label taller than a banner, or a label wider than
    // the banner it is under in a North or South row, reaches across.
    const reach = (item: Prepared, side: "before" | "after") => {
      const box: Rect = {
        x0: -item.w / 2,
        y0: -item.h / 2,
        x1: item.w / 2,
        y1: item.h / 2,
      };
      const bounds = placeLabels(item.labels, box)
        .map((label) => label.bounds)
        .reduce(union, box);
      if (vertical) return side === "before" ? -bounds.x0 : bounds.x1;
      return side === "before" ? -bounds.y0 : bounds.y1;
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
    if (object.inner) bounds = union(bounds, object.inner.bounds);
  }
  for (const label of compass) bounds = union(bounds, compassBox(label));
  let caption: ResolvedLabel | undefined;
  if (captionText) {
    const lines = wrapText(captionText, FLOOR_SIZE, CAPTION_SIZE);
    if (lines.at(-1)?.truncated)
      truncated.set(pathKey(captionPath), captionPath);
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
  // A margin narrower than the content cuts the drawing on that side.
  const clipped = (
    [
      ["north", viewBox.x0 > bounds.x0 + 1e-9],
      ["south", viewBox.x1 < bounds.x1 - 1e-9],
      ["east", viewBox.y0 > bounds.y0 + 1e-9],
      ["west", viewBox.y1 < bounds.y1 - 1e-9],
    ] as const
  ).flatMap(([name, cut]) => (cut ? [name] : []));

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
    cuts: { truncated: [...truncated.values()], overBudget, clipped },
  };
}
