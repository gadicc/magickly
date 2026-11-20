/**
 * The oracle's templates on the kameas (plan 093, "Oracle"): one small
 * text per case the grid makes, each with its plan written by hand from
 * plan 088's rule list, never from a planner's output, on Agrippa's
 * squares (magick-data's `kameas`) with `KAMEA_SIGIL_PROFILE` (R4 at 0.05
 * of a cell). Cells are "row,column" from the top left. Where a plan
 * turns on R4, the case says where the cell lies from its neighbours'
 * chord, worked in cells: on a grid a pass is exact or at least 0.094
 * of a cell off (the Moon's square; 0.45 on Saturn's).
 */

import type { KameaPlanetId } from "magick-data/astrology/kameas";
import type { SigilMark, SigilPlan, SigilVertex } from "../types.ts";

/** A text and the plan it must have on one square. */
export interface KameaTemplate {
  id: string;
  planet: KameaPlanetId;
  text: string;
  plan: SigilPlan;
  /** The rule it pins, and the geometry it rests on. */
  why: string;
}

function v(
  place: string,
  visit: number,
  crooks: number,
  ...marks: SigilMark[]
): SigilVertex {
  return { place, visit, crooks, marks };
}

/** The grid's templates; see the module's comment. */
export const KAMEA_TEMPLATES: readonly KameaTemplate[] = [
  {
    id: "abab-saturn",
    planet: "saturn",
    // Zayin 7 at 1,2 and Aleph 1 at 2,1, as in Zazel.
    text: "זאזא",
    plan: [
      [
        v("1,2", 0, 0, "start"),
        v("2,1", 0, 0),
        v("1,2", 1, 0),
        v("2,1", 1, 0, "end"),
      ],
    ],
    why: "A-B-A-B: two returns (F1's wedges); a vertex whose neighbours share a place is never a noose",
  },
  {
    id: "ababa-saturn",
    planet: "saturn",
    text: "זאזאז",
    plan: [
      [
        v("1,2", 0, 0, "start"),
        v("2,1", 0, 0),
        v("1,2", 1, 0),
        v("2,1", 1, 0),
        v("1,2", 2, 0, "end"),
      ],
    ],
    why: "A-B-A-B-A: three returns, the third visit to the first cell",
  },
  {
    id: "ababa-mercury",
    planet: "mercury",
    // Tau 400 as 40 at 4,0 and Resh 200 as 20 at 5,3, as in Taphthartharath.
    text: "תרתרת",
    plan: [
      [
        v("4,0", 0, 0, "start"),
        v("5,3", 0, 0),
        v("4,0", 1, 0),
        v("5,3", 1, 0),
        v("4,0", 2, 0, "end"),
      ],
    ],
    why: "A-B-A-B-A on a larger square, Taphthartharath's own return",
  },
  {
    id: "row-back-and-forth-saturn",
    planet: "saturn",
    // Saturn's top row, 4 9 2: Daleth, Teth, Beth.
    text: "דטבטד",
    plan: [
      [
        v("0,0", 0, 0, "start"),
        v("0,1", 0, 0, "noose"),
        v("0,2", 0, 0),
        v("0,1", 1, 0, "noose"),
        v("0,0", 1, 0, "end"),
      ],
    ],
    why: "A row walked out and back: 9 lies on the chord from 4 to 2 (off by 0, its foot half way), both ways, so both visits are nooses (R4); 2's neighbours share a place, so it is not",
  },
  {
    id: "luna-column-down",
    planet: "luna",
    // The Moon's fourth column, top down: 70 30 80 40.
    text: "עלפמ",
    plan: [
      [
        v("0,3", 0, 0, "start"),
        v("1,3", 0, 0, "noose"),
        v("2,3", 0, 0, "noose"),
        v("3,3", 0, 0, "end"),
      ],
    ],
    why: "A run along the Moon's column: each inner cell on its neighbours' chord, half way, so two nooses in a row",
  },
  {
    id: "luna-column-whole",
    planet: "luna",
    // Every cell of the column, top down: 70 30 80 40 9 (Tzaddi 90) 50 10 60 20.
    text: "עלפמצניסכ",
    plan: [
      [
        v("0,3", 0, 0, "start"),
        v("1,3", 0, 0, "noose"),
        v("2,3", 0, 0, "noose"),
        v("3,3", 0, 0, "noose"),
        v("4,3", 0, 0, "noose"),
        v("5,3", 0, 0, "noose"),
        v("6,3", 0, 0, "noose"),
        v("7,3", 0, 0, "noose"),
        v("8,3", 0, 0, "end"),
      ],
    ],
    why: "The whole column in order: seven nooses in a row on one chord",
  },
  {
    id: "luna-column-back",
    planet: "luna",
    // 70 at 0,3, 40 at 3,3, back up to 30 at 1,3.
    text: "עמל",
    plan: [[v("0,3", 0, 0, "start"), v("3,3", 0, 0), v("1,3", 0, 0, "end")]],
    why: "A run that turns back along the column: 3,3's foot on the chord from 0,3 to 1,3 lies beyond 1,3 (t = 3), so no noose, and the line returns over itself as a narrow turn",
  },
  {
    id: "closed-graphiel-mars",
    planet: "mars",
    // Graphiel: Gimel 3, Resh 200 as 20, Aleph 1, Peh 80 as 8, Yod 10,
    // Aleph 1, Lamed 30 as 3: it ends where it starts.
    text: "גראפיאל",
    plan: [
      [
        v("0,4", 0, 0, "start"),
        v("0,3", 0, 0),
        v("3,2", 0, 0),
        v("1,3", 0, 0),
        v("3,0", 0, 0),
        v("3,2", 1, 0),
        v("0,4", 1, 0, "end"),
      ],
    ],
    why: "A closed path, its end a revisit of its start; no pass: 0,3 lies 0.83 of a cell off the chord 0,4–3,2, 3,2 (the second time) 1.2 cells off 3,0–0,4, and the rest have their feet outside their chords",
  },
  {
    id: "doubled-first-sorath-sol",
    planet: "sol",
    // Sorath: Samekh 60 as 6 and Vav 6 on one cell, Resh 200 as 20, Tau 400 as 4.
    text: "סורת",
    plan: [
      [v("0,0", 0, 1, "start", "crook"), v("3,1", 0, 0), v("5,3", 0, 0, "end")],
    ],
    why: "Two letters reduced to one cell at the start: a crook on the first vertex (R3); 3,1 lies 0.69 of a cell off the chord 0,0–5,3, so no noose",
  },
  {
    id: "repeat-at-end-saturn",
    planet: "saturn",
    // Zayin 7, Aleph 1, Yod 10 as 1: the last two letters on one cell.
    text: "זאי",
    plan: [[v("1,2", 0, 0, "start"), v("2,1", 0, 1, "crook", "end")]],
    why: "Two letters reduced to one cell at the end: a crook on the last vertex, with the bar",
  },
];
