/**
 * The hall's base dimensions, in checker squares (plan 061, decision 4):
 * the layout resolver's and the placeholder estimate's, kept free of the
 * resolver's imports so the reader can size a hall's placeholder without
 * loading it.
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
 * The coordinate range the resolver clamps positions to, in squares; here
 * so the placeholder estimate clamps as the resolver does.
 */
export const COORDINATE_RANGE = [-48, 64] as const;
