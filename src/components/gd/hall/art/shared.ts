import type { HallArtProvenance } from "../types";

/** Provenance of art drawn for this package from geometry. */
export function original(notes: string): HallArtProvenance {
  return {
    origin: "original",
    author: "Gadi Cohen (the gdHall package)",
    licence: "MIT",
    notes,
  };
}

/** `HallArt.variant` for art that draws every node alike. */
export const sameForEveryNode = (): string => "";

/** `HallArt.variant` from the normalised values a drawing reads. */
export const variantOf = (
  ...values: readonly (string | number | boolean | undefined)[]
): string => JSON.stringify(values);

/** The hall's palette (plan 061, decision 13: light only for now). */
export const PALETTE = {
  ink: "#000000",
  paper: "#ffffff",
  checkerLight: "#f9f9f9",
  checkerDark: "#ececec",
  rim: "#cccccc",
  glow: "#ff0000",
  bannerDark: "#252524",
  bannerLightFrom: "#e0e0e0",
  bannerLightTo: "#ffffff",
  knob: "#ffe600",
  tassel: "#d92128",
  gold: "#fae513",
  water: "#406ab3",
  fire: "#d92128",
  tau: "#f9f9f9",
  placeholder: "#888888",
  veil: "#c8b8e0",
  veilPleat: "#7a64a0",
  bronze: "#b08d3c",
  flame: "#ff9a1f",
  wax: "#fffbe8",
  // The items (stage H): flat fills, one per material.
  /** Gold's deep tone: rims, knops and bands on gold. */
  goldDeep: "#d4a017",
  silver: "#d3d7dc",
  wine: "#7a0c1e",
  bread: "#e3a857",
  /** Where a loaf's crust opens. */
  crumb: "#f6d79a",
  green: "#108010",
  rose: "#d92128",
  /** Air's yellow: the fan. */
  air: "#ffe000",
  /** A light's glass, by the colour of its light. */
  glassRed: "#ff9a8a",
  glassYellow: "#fbf0b8",
  glassWhite: "#ffffff",
  // Malkuth's four colours, as the Pantacle quarters them; shared with
  // the lamens (stage H, part 2).
  citrine: "#a9aa66",
  olive: "#444f41",
  russet: "#8f5642",
  earthBlack: "#2c2b29",
  /** The Third Adept's octagram. */
  orange: "#ff8c1a",
} as const;

/**
 * The items' one outline (plan 061, stage H): black, 3.6 units in a
 * drawing 100 units on its longer side, round joins. Set on a drawing's
 * group, so its shapes give only their fills; inner lines are
 * `ITEM_DETAIL` wide.
 */
export const ITEM_OUTLINE = {
  stroke: PALETTE.ink,
  strokeWidth: 3.6,
  strokeLinejoin: "round",
  strokeLinecap: "round",
} as const;

/** The width of the few lines drawn inside an item's outline. */
export const ITEM_DETAIL = 2.4;

/**
 * The one white highlight a metal item carries (direction C's, kept flat):
 * a stroke along the lit side of the form, drawn over the fill.
 */
export const HIGHLIGHT = {
  fill: "none",
  stroke: PALETTE.paper,
  strokeWidth: 2.6,
} as const;
