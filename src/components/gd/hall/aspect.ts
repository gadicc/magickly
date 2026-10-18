import { booleanAttr, clamp, numberAttr, stringAttr } from "./attributes";
import {
  BANNER_ROW_GAP,
  CAPTION_GAP,
  CAPTION_SIZE,
  COMPASS_GAP,
  COORDINATE_RANGE,
  DEFAULT_DAIS,
  DEFAULT_PADDING,
  FLOOR_SIZE,
  LABEL_GAP,
  WALL_GAP,
  WALL_STROKE,
} from "./dimensions";
import type { HallNode } from "./types";

/**
 * Figures the layout takes from its font metrics and scales, which this
 * module may not import (they would bring the resolver's code with them);
 * `aspect.test.ts` holds them equal to the layout's.
 */
/** The compass words' letters, top to bottom, at COMPASS_SIZE. */
export const COMPASS_LETTER_DEPTH = 0.408;
/** One line of label ink at the default label size. */
export const LABEL_LINE = 0.43;
/** A caption line's advance. */
export const CAPTION_LINE = CAPTION_SIZE * 1.15;
/** The Hebrew letter banners' default scale. */
export const HEBREW_LETTER_SCALE = 1.475;
/** An object's cell at scale 1, in squares. */
const CELL = 2;
/**
 * The widest and tallest shapes the placeholder takes. Coordinates are
 * clamped as the resolver clamps them, but objects at the range's far
 * ends could still ask for a strip; no real hall comes near either bound.
 */
export const ASPECT_RANGE = [0.25, 4] as const;

type Box = { x0: number; y0: number; x1: number; y1: number };

const rows = (node: unknown): HallNode[] =>
  node !== null &&
  typeof node === "object" &&
  Array.isArray((node as HallNode).children)
    ? ((node as HallNode).children as unknown[]).filter(
        (child): child is HallNode =>
          child !== null && typeof child === "object" && !Array.isArray(child),
      )
    : [];

/** How far an object reaches from its centre: half its cell, and a label. */
const reach = (node: HallNode) => {
  const scale = clamp(
    numberAttr(node, "scale") ??
      (node.type === "hebrewLetter" ? HEBREW_LETTER_SCALE : 1),
    0.05,
    10,
  );
  const labelled =
    node.type === "officer" || stringAttr(node, "label") !== undefined;
  return {
    half: (CELL * scale) / 2,
    label: labelled ? LABEL_GAP + LABEL_LINE : 0,
  };
};

/**
 * An estimate of a hall's drawn aspect ratio (width over height), for the
 * placeholder the reader shows while the renderer loads (plan 061,
 * decision 1). It reads the hall's structure only: the dais, the compass,
 * banner rows, floor objects placed beyond the walls, the caption, padding
 * and margins; never the art or the label layout, whose code it would
 * need. Every preset comes within 2 % of its drawing with the app's art
 * (`src/app/gd/hall/presets.test.tsx`), and simpler halls within 2 % of
 * the package's (`aspect.test.ts`). Never throws, whatever the content.
 */
export function estimateHallAspect(hall: HallNode): number {
  const dais = clamp(numberAttr(hall, "dais") ?? DEFAULT_DAIS, 0, 16);
  const compass = booleanAttr(hall, "compass") ?? true;
  const padding = clamp(numberAttr(hall, "padding") ?? DEFAULT_PADDING, 0, 16);
  const outer: Box = {
    x0: -WALL_GAP,
    y0: -Math.max(dais, WALL_GAP),
    x1: FLOOR_SIZE + WALL_GAP,
    y1: FLOOR_SIZE + WALL_GAP,
  };
  const wall = compass ? COMPASS_GAP + COMPASS_LETTER_DEPTH : WALL_STROKE / 2;
  const bounds: Box = {
    x0: outer.x0 - wall,
    y0: outer.y0 - wall,
    x1: outer.x1 + wall,
    y1: outer.y1 + wall,
  };
  const clearance = compass
    ? COMPASS_GAP + COMPASS_LETTER_DEPTH + BANNER_ROW_GAP
    : COMPASS_GAP;
  let captionText: string | undefined;
  const placed: HallNode[] = [];
  for (const child of rows(hall)) {
    if (child.type === "caption")
      captionText = stringAttr(child, "text", 200) ?? captionText;
    else if (child.type === "floor") placed.push(...rows(child));
    else if (child.type === "banners") {
      // Rows on one side share one line beyond the compass words.
      const depth = Math.max(
        0,
        ...rows(child).map((item) => {
          const { half, label } = reach(item);
          return 2 * half + label;
        }),
      );
      const side = stringAttr(child, "side");
      if (side === "west")
        bounds.y1 = Math.max(bounds.y1, outer.y1 + clearance + depth);
      else if (side === "north")
        bounds.x0 = Math.min(bounds.x0, outer.x0 - clearance - depth);
      else if (side === "south")
        bounds.x1 = Math.max(bounds.x1, outer.x1 + clearance + depth);
      else bounds.y0 = Math.min(bounds.y0, outer.y0 - clearance - depth);
    } else if (child.type !== "dais" && child.type !== "door")
      placed.push(child);
  }
  // Floor objects stand where their coordinates say, perhaps beyond a wall.
  for (const node of placed) {
    const rawX = numberAttr(node, "x");
    const rawY = numberAttr(node, "y");
    if (rawX === undefined || rawY === undefined) continue;
    const x = clamp(rawX, ...COORDINATE_RANGE);
    const y = clamp(rawY, ...COORDINATE_RANGE);
    const { half, label } = reach(node);
    bounds.x0 = Math.min(bounds.x0, x - half);
    bounds.x1 = Math.max(bounds.x1, x + half);
    bounds.y0 = Math.min(bounds.y0, y - half - label);
    bounds.y1 = Math.max(bounds.y1, y + half + label);
  }
  if (captionText) {
    // About half an em a character, at most six lines.
    const lines = clamp(
      Math.ceil((captionText.length * CAPTION_SIZE * 0.5) / FLOOR_SIZE),
      1,
      6,
    );
    bounds.y1 += CAPTION_GAP + lines * CAPTION_LINE;
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
  const width =
    (south === undefined ? bounds.x1 + padding : outer.x1 + south) -
    (north === undefined ? bounds.x0 - padding : outer.x0 - north);
  const height =
    (west === undefined ? bounds.y1 + padding : outer.y1 + west) -
    (east === undefined ? bounds.y0 - padding : outer.y0 - east);
  const aspect = width / height;
  return Number.isFinite(aspect) && aspect > 0
    ? clamp(aspect, ...ASPECT_RANGE)
    : 3 / 4;
}
