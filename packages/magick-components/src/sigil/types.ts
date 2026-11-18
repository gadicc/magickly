/**
 * The contract between a sigil's layout, its rules and its drawing
 * (plan 088). A layout knows where things are and nothing of the rules; a
 * plan says what each vertex of a sigil is and nothing of where it is
 * drawn; placement and the renderer turn the two into a figure. Nothing
 * here is specific to the Golden Dawn's rose, so a rose with petals or a
 * kamea is another layout.
 */

/** A point in a layout's coordinates. */
export interface Point {
  x: number;
  y: number;
}

/**
 * A place on a layout, by a stable id: a letter's place on the rose
 * ("ש"), a cell on a kamea ("3,4"). Repeats and revisits are decided on
 * places, not tokens, so two tokens that share a place repeat.
 */
export type PlaceId = string;

/** Where a layout's places are, and how far a visit may stray from one. */
export interface SigilLayout<Token = string> {
  /** The place a token is drawn at, or `null` for a token the layout leaves out. */
  place(token: Token): PlaceId | null;
  /** Where a first visit to a place is drawn. */
  anchor(place: PlaceId): Point;
  /** How far, in layout coordinates, a visit may move from its anchor and still read as that place. */
  slack(place: PlaceId): number;
  /** The place a point reads as, or `null` if it is near none (for read-back). */
  placeAt(point: Point): PlaceId | null;
  /**
   * Layout coordinates per sigil unit. The rose's rings are 10 units
   * apart; a layout scales marks, offsets and tolerances, which profiles
   * give in units, by this.
   */
  unit: number;
  /** Every place, in a stable order. */
  places: readonly PlaceId[];
}

/**
 * A mark at a vertex. `start`: the circle at a word's first vertex (R1).
 * `crook`: one wave per merged repeat (R3). `noose`: the loop where the
 * line passes straight through a letter of the name (R4). `end`: the bar
 * at a word's last vertex (R5).
 */
export type SigilMark = "start" | "crook" | "noose" | "end";

/** The order marks are listed in, so plans compare with deep equality. */
export const SIGIL_MARK_ORDER: readonly SigilMark[] = [
  "start",
  "crook",
  "noose",
  "end",
];

/** One vertex of a word's path: a place, visited once, with its marks. */
export interface SigilVertex {
  place: PlaceId;
  /**
   * 0 for the word's first vertex at this place, 1 for the next, and so on.
   * A run of one place is one vertex, so it counts once.
   */
  visit: number;
  /** Letters merged into this vertex after the first: one crook each (R3). */
  crooks: number;
  /** In `SIGIL_MARK_ORDER`, each at most once. */
  marks: readonly SigilMark[];
}

/** One word's vertices, in the order the line visits them. */
export type SigilWord = readonly SigilVertex[];

/** A text's plan: one sigil per word (R2), in reading order. */
export type SigilPlan = readonly SigilWord[];

/** A vertex with the point it is drawn at. */
export interface PlacedVertex extends SigilVertex {
  point: Point;
}

/** A word with its vertices placed. */
export type PlacedWord = readonly PlacedVertex[];

/**
 * A tradition's settings for the rules. Distances are in sigil units
 * (`SigilLayout.unit`).
 */
export interface SigilProfile {
  id: string;
  /**
   * R4: how far a vertex's anchor may lie from the chord between its
   * neighbours' anchors and still be "passed through" (decision 2).
   */
  nooseTolerance: number;
}
