/**
 * The oracle's hand fixtures (plan 088, O1): the sigils Regardie draws in
 * *The Golden Dawn*, vol. 4 (Aries Press, Chicago, 1940), "Sigils",
 * archive.org `IsraelRegardie-TheGoldenDawn-Vol4-1940`, with the plan
 * each must have under plan 088's rules and decisions, written out by
 * hand from the figures and the rule list, never from a planner's output.
 * The book is copyrighted; what is here is facts read off its figures
 * (which marks, which turns, which strokes cross), nothing copied.
 *
 * Besides the plan, each fixture records what the figure shows of the
 * path's shape, so that the layout is checked as well as the rules: a
 * mirrored rose or two letters swapped turn or cross differently.
 *
 * **Turns** are seen travelling along the path, on the page, whose y axis
 * points down as SVG's does: `right` is clockwise on the page, where the
 * cross product (V − P) × (N − V) = dx₁·dy₂ − dy₁·dx₂ of the strokes into
 * and out of V is positive; `left` is anticlockwise. `straight` is a
 * vertex the figure draws on an unbent line (a noose); `back` is a vertex
 * where the line returns along itself to a different place beyond its
 * start (Elohim's Lamed). A turn is recorded at every interior vertex
 * whose neighbours are at different places, and only there: where both
 * neighbours are one place (A-B-A) the figure's wedge is an artefact of
 * where the second visit is drawn, not of the layout.
 *
 * **Headings** give each stroke's direction on the page to the nearest of
 * eight compass points (N is up the page). They catch a rose turned
 * round, which keeps every turn and crossing.
 *
 * **Crossings** are the pairs of strokes, by index within the word
 * (stroke i runs from vertex i to vertex i + 1), that cross away from a
 * place they share. Where a revisit is drawn beside the first visit the
 * figure can show strokes crossing right at that place (יהוה's return to
 * He); at the anchors they only meet, so that is not a crossing.
 */

import type { KameaPlanetId } from "magick-data/astrology/kameas";
import type { PlaceId, SigilMark, SigilPlan, SigilVertex } from "../types.ts";

/** A turn at a vertex as the figure draws it; see the module's comment. */
export type FigureTurn = "left" | "right" | "straight" | "back";

/** A stroke's heading on the page, to the nearest of eight; N is up. */
export type Compass = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

/** What a figure shows of one word's path. */
export interface FigureWord {
  /**
   * One per vertex: the turn as drawn, or `null` at the ends and where
   * both neighbours are at one place.
   */
  turns: readonly (FigureTurn | null)[];
  /** One per stroke: its heading as drawn. */
  headings: readonly Compass[];
  /** Pairs of strokes, `[i, j]` with i + 1 < j, that cross. */
  crossings: readonly (readonly [number, number])[];
  /**
   * Places a stroke runs over without a mark, as plan 088's F2 and F3
   * record from tracing the figures on the rose: within the place's slack
   * of the stroke, its foot between the stroke's ends.
   */
  passes?: readonly { stroke: number; place: PlaceId }[];
}

/**
 * A proportion the figure shows that turns and crossings cannot: the
 * distance between two vertices of word `word` is under `factor` times
 * the distance between two others.
 */
export interface FigureProportion {
  word: number;
  /** Vertex indices of the shorter distance. */
  shorter: readonly [number, number];
  /** Vertex indices of the longer distance. */
  longer: readonly [number, number];
  factor: number;
}

/** Where a figure is: the book's page and the archive.org leaf. */
export interface FigureSource {
  page: number;
  leaf: number;
}

/** A hand fixture on the rose. */
export interface HandFixture {
  id: string;
  /** The name as the figure spells it. */
  text: string;
  sources: readonly FigureSource[];
  /** What plan 088's fixtures table says it shows. */
  shows: string;
  /** The plan under plan 088's rules on the `gd` rose, with `ROSE_SIGIL_PROFILE`. */
  plan: SigilPlan;
  /** One per word. */
  figure: readonly FigureWord[];
  proportions?: readonly FigureProportion[];
  /** Where the figure and our decisions part, or anything else worth knowing. */
  notes: readonly string[];
}

/** A hand fixture on a planet's kamea, traced from its letters. */
export interface KameaFixture {
  id: string;
  planet: KameaPlanetId;
  /** The name in Hebrew, as the text spells it. */
  text: string;
  /** The numbers, after Aiq Bekar's reduction, as the text gives them. */
  numbers: readonly number[];
  sources: readonly FigureSource[];
  /** The plan under plan 088's rules on the square, with `KAMEA_SIGIL_PROFILE`. */
  plan: SigilPlan;
  figure: readonly FigureWord[];
  notes: readonly string[];
}

/** A vertex, written short so the plans below read as a list. */
function v(
  place: string,
  visit: number,
  crooks: number,
  ...marks: SigilMark[]
): SigilVertex {
  return { place, visit, crooks, marks };
}

const P58 = { page: 58, leaf: 52 };
const P59 = { page: 59, leaf: 53 };
const P60 = { page: 60, leaf: 54 };

const ELOHIM_PLAN = [
  v("א", 0, 0, "start"),
  v("ל", 0, 0),
  v("ה", 0, 0),
  v("י", 0, 0),
  v("מ", 0, 0, "end"),
];
const ELOHIM_FIGURE: FigureWord = {
  turns: [null, "back", "left", "right", null],
  headings: ["S", "N", "S", "N"],
  crossings: [],
  passes: [
    { stroke: 0, place: "ד" },
    { stroke: 1, place: "ד" },
    { stroke: 1, place: "א" },
  ],
};

const YHVH_PLAN = [
  v("י", 0, 0, "start"),
  v("ה", 0, 0),
  v("ו", 0, 0),
  v("ה", 1, 0, "end"),
];
const YHVH_FIGURE: FigureWord = {
  turns: [null, "left", null, null],
  headings: ["N", "W", "E"],
  crossings: [],
};

/**
 * Plan 088's "Fixtures from the primary figures", one entry per row, plus
 * the p. 59 panel that draws יהוה and אלהים as two sigils side by side.
 */
export const HAND_FIXTURES: readonly HandFixture[] = [
  {
    id: "metatron",
    text: "מטטרון",
    sources: [P58],
    shows: "Crook at Teth, noose at Resh",
    plan: [
      [
        v("מ", 0, 0, "start"),
        v("ט", 0, 1, "crook"),
        v("ר", 0, 0, "noose"),
        v("ו", 0, 0),
        v("נ", 0, 0, "end"),
      ],
    ],
    figure: [
      {
        turns: [null, "right", "straight", "right", null],
        headings: ["SW", "N", "N", "SE"],
        crossings: [],
      },
    ],
    notes: [
      "p. 58: the crook is a small wave in the corner at Teth; the noose " +
        "is a small loop on the inner side of an unbent Teth→Vau line; " +
        "the end bar is at Nun.",
      "p. 58: Vau→Nun runs past the start circle on the right and through " +
        "the rose's centre (F4), with no mark.",
      "Final Nun is drawn at Nun's place (F5).",
    ],
  },
  {
    id: "elohim",
    text: "אלהים",
    sources: [P58, P59],
    shows:
      "F1 wedge at Lamed; F3 no noose past Aleph; F2 through Daleth; final Mem",
    plan: [ELOHIM_PLAN],
    figure: [ELOHIM_FIGURE],
    notes: [
      "pp. 58 and 59 draw it alike: down from the circle at Aleph to " +
        "Lamed, back up just beside that stroke to He, down to Yod and up " +
        "to the bar at Mem.",
      "Lamed is `back`: He lies beyond Aleph on the line back from Lamed, " +
        "so the return passes over Aleph's place with no noose (F3; " +
        "Aleph is not between its own neighbours there) and over Daleth, " +
        "which is not in the name (F2).",
      "Final Mem is drawn at Mem's place (F5).",
    ],
  },
  {
    id: "binah",
    text: "בינה",
    sources: [P59],
    shows: "Plain; F2 past Shin",
    plan: [
      [v("ב", 0, 0, "start"), v("י", 0, 0), v("נ", 0, 0), v("ה", 0, 0, "end")],
    ],
    figure: [
      {
        turns: [null, "left", "left", null],
        headings: ["S", "E", "N"],
        crossings: [],
        passes: [{ stroke: 2, place: "ש" }],
      },
    ],
    notes: [
      "p. 59: Nun→He passes Shin, which is not in the name, with no mark " +
        "(F2); on our rose Shin is about 1.5 units off that line.",
    ],
  },
  {
    id: "yhvh",
    text: "יהוה",
    sources: [P59],
    shows: "F1 wedge",
    plan: [YHVH_PLAN],
    figure: [YHVH_FIGURE],
    notes: [
      "p. 59: the second He is drawn just below and right of the first, " +
        "so the return from Vau crosses Yod→He just under He before its " +
        "bar; at the anchors the two strokes only meet at He, so no " +
        "crossing is recorded.",
    ],
  },
  {
    id: "yhvh-elohim",
    text: "יהוה אלהים",
    sources: [P59],
    shows: "R2: two words, two sigils side by side",
    plan: [YHVH_PLAN, ELOHIM_PLAN],
    figure: [YHVH_FIGURE, ELOHIM_FIGURE],
    notes: [
      "p. 59, panel 2 (YHVH ELOHIM): two sigils side by side, each with " +
        "its own start circle and end bar (R2).",
    ],
  },
  {
    id: "tzaphqiel",
    text: "צפקיאל",
    sources: [P59],
    shows: "Line near Kaph, no mark",
    plan: [
      [
        v("צ", 0, 0, "start"),
        v("פ", 0, 0),
        v("ק", 0, 0),
        v("י", 0, 0),
        v("א", 0, 0),
        v("ל", 0, 0, "end"),
      ],
    ],
    figure: [
      {
        turns: [null, "right", "right", "right", "right", null],
        headings: ["W", "E", "SW", "N", "S"],
        crossings: [
          [0, 2],
          [2, 4],
        ],
      },
    ],
    notes: [
      "p. 59: Tzaddi→Peh passes Kaph, not in the name, with no mark (F2); " +
        "that is Kaph on the gd rose and Tau on Regardie's 1939 rose, and " +
        "the figure cannot say which, so it is not recorded as a pass. " +
        "Qoph→Yod crosses Tzaddi→Peh and then Aleph→Lamed at the rose's " +
        "centre (F4).",
    ],
  },
  {
    id: "aralim",
    text: "אראלים",
    sources: [P59],
    shows: "F1 wedge; final Mem",
    plan: [
      [
        v("א", 0, 0, "start"),
        v("ר", 0, 0),
        v("א", 1, 0),
        v("ל", 0, 0),
        v("י", 0, 0),
        v("מ", 0, 0, "end"),
      ],
    ],
    figure: [
      {
        turns: [null, null, "right", "right", "right", null],
        headings: ["SW", "E", "S", "W", "N"],
        crossings: [],
        passes: [{ stroke: 2, place: "ד" }],
      },
    ],
    notes: [
      "p. 59: the return to Aleph is drawn just below and right of the " +
        "start circle (F1), with no mark.",
      "Aleph→Lamed passes Daleth, not in the name (F2). Final Mem is " +
        "drawn at Mem's place (F5).",
    ],
  },
  {
    id: "shabbathai",
    text: "שבתי",
    sources: [P60],
    shows: "R7; the figure omits the usual Aleph, so three strokes",
    plan: [
      [v("ש", 0, 0, "start"), v("ב", 0, 0), v("ת", 0, 0), v("י", 0, 0, "end")],
    ],
    figure: [
      {
        turns: [null, "right", "right", null],
        headings: ["W", "NE", "SW"],
        crossings: [[0, 2]],
      },
    ],
    proportions: [{ word: 0, shorter: [0, 2], longer: [1, 2], factor: 0.5 }],
    notes: [
      "p. 60: spelled as drawn, שבתי, three strokes; the usual spelling " +
        "is שבתאי.",
      "R7: in the figure Shin→Tau is about a third of Beth→Tau. On the " +
        "gd rose it is 0.36 of it; on Regardie's 1939 rose, which " +
        "exchanges Tau and Kaph, 0.62, so the proportion (under half) " +
        "tells the two apart where turns and crossings do not.",
    ],
  },
  {
    id: "yhvh-spelled",
    text: "יוד הא ואו הא",
    sources: [P60],
    shows: "R2 four sigils; R5's counter-examples",
    plan: [
      [v("י", 0, 0, "start"), v("ו", 0, 0), v("ד", 0, 0, "end")],
      [v("ה", 0, 0, "start"), v("א", 0, 0, "end")],
      [v("ו", 0, 0, "start"), v("א", 0, 0), v("ו", 1, 0, "end")],
      [v("ה", 0, 0, "start"), v("א", 0, 0, "end")],
    ],
    figure: [
      { turns: [null, "right", null], headings: ["N", "S"], crossings: [] },
      { turns: [null, null], headings: ["S"], crossings: [] },
      { turns: [null, null, null], headings: ["SE", "NW"], crossings: [] },
      { turns: [null, null], headings: ["S"], crossings: [] },
    ],
    notes: [
      "p. 60 (YOD HE VAU HE (45)): four sigils, drawn left to right in " +
        "the order of the words, each with a start circle.",
      "Only יוד has an end bar. Both הא (one stroke each) and ואו (which " +
        "ends at its own start, the return drawn just beside the first " +
        "stroke) have none; decision 6 draws a bar on every word, so each " +
        "plan has `end`.",
    ],
  },
  {
    id: "agiel",
    text: "אגיאל",
    sources: [P60],
    shows: "F1 later recurrence",
    plan: [
      [
        v("א", 0, 0, "start"),
        v("ג", 0, 0),
        v("י", 0, 0),
        v("א", 1, 0),
        v("ל", 0, 0, "end"),
      ],
    ],
    figure: [
      {
        turns: [null, "right", "right", "right", null],
        headings: ["SE", "SW", "N", "S"],
        crossings: [[1, 3]],
        passes: [{ stroke: 3, place: "ד" }],
      },
    ],
    notes: [
      "p. 60: the second Aleph is drawn just left of the start circle " +
        "(F1), with no mark; Aleph→Lamed crosses Gimel→Yod.",
    ],
  },
  {
    id: "zazel",
    text: "זאזל",
    sources: [P60],
    shows: "F1 wedge under the start circle",
    plan: [
      [v("ז", 0, 0, "start"), v("א", 0, 0), v("ז", 1, 0), v("ל", 0, 0, "end")],
    ],
    figure: [
      {
        turns: [null, null, "left", null],
        headings: ["E", "W", "SE"],
        crossings: [],
      },
    ],
    notes: [
      "p. 60: the return to Zayin is drawn just under the start circle " +
        "(F1), with no mark.",
    ],
  },
];

/**
 * The two kamea sigils the text works through (vol. 4, pp. 79–80,
 * leaves n73–n74), on the squares of pp. 81 and 85, as plans: traced from
 * the letters on `kameaLayout`, which reduces them by Aiq Bekar to the
 * numbers the text gives. Their returns are F1's wedges (decision 4), the
 * revisits counted in `visit`.
 */
export const KAMEA_FIXTURES: readonly KameaFixture[] = [
  {
    id: "zazel-kamea",
    planet: "saturn",
    text: "זאזל",
    numbers: [7, 1, 7, 3],
    sources: [
      { page: 79, leaf: 73 },
      { page: 80, leaf: 74 },
      { page: 81, leaf: 75 },
    ],
    plan: [
      [
        v("1,2", 0, 0, "start"),
        v("2,1", 0, 0),
        v("1,2", 1, 0),
        v("1,0", 0, 0, "end"),
      ],
    ],
    figure: [
      {
        turns: [null, null, "left", null],
        headings: ["SW", "NE", "W"],
        crossings: [],
      },
    ],
    notes: [
      "pp. 79–80: Zayin 7, Aleph 1, Zayin 7, Lamed 30 reduced to 3; " +
        "the line follows 7, 1, back to 7, then 3, with a small circle " +
        "at the first.",
      "p. 81 (Spirit: Zazel, on Saturn's square 4 9 2 / 3 5 7 / 8 1 6, " +
        "as magick-data's): the return to 7 is a narrow U beside the " +
        "first stroke, and both ends carry a circle, not a bar. The plan " +
        "follows the rose's rules (plan 093, decision 4): the return is " +
        "F1's wedge, the start a circle and the end a bar.",
    ],
  },
  {
    id: "taphthartharath-kamea",
    planet: "mercury",
    text: "תפתרתרת",
    numbers: [40, 8, 40, 20, 40, 20, 40],
    sources: [
      { page: 80, leaf: 74 },
      { page: 85, leaf: 79 },
    ],
    plan: [
      [
        v("4,0", 0, 0, "start"),
        v("0,0", 0, 0),
        v("4,0", 1, 0),
        v("5,3", 0, 0),
        v("4,0", 2, 0),
        v("5,3", 1, 0),
        v("4,0", 3, 0, "end"),
      ],
    ],
    figure: [
      {
        turns: [null, null, "left", null, null, null, null],
        headings: ["N", "S", "E", "W", "E", "W"],
        crossings: [],
      },
    ],
    notes: [
      "p. 80: Tau 400, Peh 80, Tau 400, Resh 200, Tau 400, Resh 200, Tau " +
        "400 reduce to 40, 8, 40, 20, 40, 20, 40 on Mercury's 8 × 8 " +
        "square, starting with a circle in 40.",
      "p. 85 (Spirit: Taphthartharath): drawn as nested hairpins, every " +
        "return a rounded U beside the outgoing stroke, with no start " +
        "circle or end bar visible. Its printed square differs from " +
        "Agrippa's (magick-data's) in six cells of the third and fourth " +
        "rows (45/48, 35/38 and 28/25 exchanged), none of them 8, 20 or 40.",
      "40 between 8 and 20 is about 2 cells off the 8→20 line, far " +
        "outside the noose tolerance, so it has no noose.",
    ],
  },
];
