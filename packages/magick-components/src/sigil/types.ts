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

/**
 * Where a layout's places are, and how far a visit may stray from one.
 * Placement keeps placed words by the layout object's identity, so a
 * layout must not change after it is first used: make a new object.
 */
export interface SigilLayout<Token = string> {
  /** The place a token is drawn at, or `null` for a token the layout leaves out. */
  place(token: Token): PlaceId | null;
  /** Where a first visit to a place is drawn. */
  anchor(place: PlaceId): Point;
  /** How far, in layout coordinates, a visit may move from its anchor and still read as that place. */
  slack(place: PlaceId): number;
  /**
   * The place a point reads as, or `null` if it is near none. Planning,
   * placement and drawing never call it; it is required because reading a
   * figure back from its ink (plan 088's O3, the check that a sigil reads
   * as its name) maps the vertices it finds to places with it.
   */
  placeAt(point: Point): PlaceId | null;
  /**
   * Layout coordinates per sigil unit. The rose's rings are 10 units
   * apart; a layout scales marks, offsets and tolerances, which profiles
   * give in units, by this.
   */
  unit: number;
  /** Every place, in a stable order. */
  places: readonly PlaceId[];
  /**
   * The bound a word's ink keeps within and the pitch words are set at,
   * when the layout has its own (a kamea's square). Without one, the
   * frame is the disc about the anchors that reaches every place's slack
   * (`sigilFrame`), as on the rose.
   */
  frame?: SigilLayoutFrame;
  /**
   * Lines the layout draws under a figure, which its ink should not run
   * along (a kamea's cell rules): placement keeps strokes off them when
   * its settings give a `lineRun`. Without any, nothing is checked.
   */
  lines?: readonly SigilLayoutLine[];
}

/**
 * A line a layout draws under a figure (plan 093, K3), in layout
 * coordinates: from `a` to `b`, `width` wide.
 */
export interface SigilLayoutLine {
  a: Point;
  b: Point;
  /** The line's drawn width, in layout coordinates. */
  width: number;
}

/**
 * A layout's own frame (plan 093, "Engine"), in layout coordinates: every
 * mark of a word stays within `radius` of `center`, measured as `shape`
 * says, and word `i` is drawn `i × pitch` to the left of the first.
 */
export interface SigilLayoutFrame {
  /** The bound's centre. */
  center: Point;
  /**
   * `disc`: within `radius` of `center`. `square`: within `radius` of it
   * along each axis, a square `2 × radius` across, as a kamea's is.
   */
  shape: "disc" | "square";
  /** The disc's radius, or half the square's side. */
  radius: number;
  /** Each word's square region's side; at least the bound's width. */
  pitch: number;
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
  /**
   * For a crook or a noose, the side of its line it is drawn on: +1 is
   * the line's direction turned a quarter clockwise on the page, −1 the
   * other way. Placement chooses it; without it the renderer's default
   * (`defaultSide`) applies.
   */
  side?: 1 | -1;
}

/** A word with its vertices placed. */
export type PlacedWord = readonly PlacedVertex[];

/**
 * A tradition's settings for the rules. Distances are in sigil units
 * (`SigilLayout.unit`). Placement keeps placed words by the profile
 * object's identity, so a profile must not change after it is first
 * used: make a new object.
 */
export interface SigilProfile {
  id: string;
  /**
   * R4: how far a vertex's anchor may lie from the chord between its
   * neighbours' anchors and still be "passed through" (decision 2).
   */
  nooseTolerance: number;
  /** Mark sizes for the renderer; `DEFAULT_SIGIL_MARKS` when not given. */
  marks?: SigilMarkSizes;
  /** Rule placement's settings; `DEFAULT_SIGIL_PLACEMENT` when not given. */
  placement?: SigilPlacementSettings;
  /**
   * The ink's width in layout coordinates, not sigil units: a weight
   * fixed against the layout rather than scaled with its unit, as a
   * kamea's is against its square. `SigilImage` draws with it unless told
   * otherwise; without it, the stroke is `layout.unit` wide, the figure
   * grammar's one unit.
   */
  strokeWidth?: number;
}

/**
 * How big the renderer draws each mark, in sigil units, inside the ranges
 * plan 088's O2 allows (start circle radius 1–2.5, cups 2–3.5 wide and 1–2
 * deep, noose radius 1–2, bar 3–6 long), which keep marks legible at the
 * smallest size a sigil is published.
 */
export interface SigilMarkSizes {
  /** R1: the start circle's radius. */
  startRadius: number;
  /** R3: the widest a crook's cup is drawn, along the line. */
  cupChord: number;
  /** R3: the narrowest, when a short stroke must hold the wave. */
  cupMinChord: number;
  /** R3: how far a cup bulges from the line. */
  cupDepth: number;
  /** R4: the noose's radius. */
  nooseRadius: number;
  /** R5: the end bar's length. */
  barLength: number;
  /** Straight line a stroke keeps beside its marks, so its direction shows. */
  minStraight: number;
}

/**
 * Rule placement's settings (plan 088, "Placement: by rule, not by
 * solver"), in sigil units.
 */
export interface SigilPlacementSettings {
  /**
   * How far a revisit sits beside its place's earlier visit, sideways
   * from the stroke into it (F1).
   */
  revisitOffset: number;
  /**
   * The steps a vertex may move from its rule position when a check fails,
   * tried in order, each in the directions placement lists; capped by the
   * place's slack less `slackMargin`.
   */
  steps: readonly number[];
  /** Kept between a moved vertex and the edge of its place's slack. */
  slackMargin: number;
  /**
   * How much checking work placement may do on one word before it keeps
   * the best figure found: one unit per element looked at or pair of
   * elements checked. It bounds the time a long word takes.
   */
  budget: number;
  /**
   * Also search from starts that set every first visit at its slack's
   * edge, square to the stroke into it, on sides that alternate in pairs
   * along the word (+ + − −, and its shifts and mirror), so that where the
   * line turns back along itself the visits either side of the turn stand
   * apart and its wedge opens (plan 093: a kamea folds runs of letters
   * onto one line). Tried after the first rule start. Off unless set.
   */
  laneStarts?: boolean;
  /**
   * The longest stretch, in sigil units, a stroke may run within touching
   * distance of one of the layout's `lines`: its centre line within half
   * the stroke's width (the profile's `strokeWidth`, or one unit) and
   * half the line's of the line's centre line
   * (plan 093, K3). Longer, the stroke reads as lying on the line, and
   * the eye cannot tell which side of it, which cell, it is in. Measured
   * per stroke and line as the length of the stroke inside that band,
   * so a stroke that crosses a line at a shallow angle counts as well as
   * one that runs beside it. Not checked unless set; a layout without
   * lines has nothing to check.
   */
  lineRun?: number;
  /**
   * A last resort for a word the search above leaves failing: up to
   * `starts` more starts, each vertex at a random point in its slack, from
   * a generator seeded by the plan word (so by the text and the layout's
   * places, and the same in every engine), each searched as the others
   * are, until one passes or `budget` more units of work are spent. A
   * text's words share one `budget` between them, in order. Off unless
   * set (plan 093, K3: a kamea's few words that fold onto one column).
   */
  fallback?: { starts: number; budget: number };
}
