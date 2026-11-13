import type { HallNode } from "../types";
import { type HallPreset, regardie1938 } from "./types";

/**
 * The Practicus halls (3=8), from the diagrams of Regardie's 1938 first
 * edition (plan 061, Sources). The book draws only the Hierophant on the
 * dais, so the Chiefs are left out, and the candidate's places (after the
 * circumambulation) are moves within the ceremony, not part of the hall.
 * The hatched corners of the dais in the 31st path and 3=8 drawings are
 * not explained by the text and are not drawn.
 */

/**
 * The 31st and 30th paths, which the book draws alike: the path's letter
 * in the North-East, the pillars in the North-East as the text says, the
 * trump on the altar between two candles, incense in the South, and the
 * Hiereus and Hegemon in the West, each with a red lamp.
 */
function pathHall(letter: string, trump: number, title: string): HallNode {
  return {
    type: "gdHall",
    dais: 4,
    children: [
      { type: "banners", children: [{ type: "hebrewLetter", letter, x: 1.6 }] },
      {
        type: "dais",
        children: [
          { type: "item", kind: "lamp", x: 5.3 },
          { type: "officer", role: "hierophant", x: 8 },
          { type: "banner", kind: "east", x: 11.6 },
        ],
      },
      {
        type: "floor",
        children: [
          { type: "pillar", kind: "black", x: 1.7, y: 2.2 },
          { type: "pillar", kind: "white", x: 4.2, y: 2.2 },
          { type: "item", kind: "candle", x: 6.4, y: 8 },
          {
            type: "altar",
            x: 8,
            y: 8,
            children: [{ type: "tarotKey", n: trump }],
          },
          { type: "item", kind: "candle", x: 9.6, y: 8 },
          { type: "item", kind: "censer", x: 14.8, y: 8 },
          {
            type: "marker",
            text: "Seat for the Theoricus",
            x: 1.6,
            y: 12.2,
            scale: 0.8,
          },
          { type: "banner", kind: "west", x: 5.4, y: 12.8 },
          { type: "officer", role: "hiereus", x: 2.6, y: 15, labelPos: "top" },
          { type: "item", kind: "lamp", x: 4.2, y: 15.2 },
          { type: "item", kind: "cup", x: 7.4, y: 15.2 },
          { type: "officer", role: "hegemon", x: 11.6, y: 15, labelPos: "top" },
          { type: "item", kind: "lamp", x: 13.4, y: 15.2 },
        ],
      },
      { type: "caption", text: title },
    ],
  };
}

/** The 31st path of Shin, the Last Judgement on the altar. */
export const practicus1: HallPreset = {
  id: "practicus1",
  title: "Practicus Temple 1",
  grade: "3=8",
  part: 1,
  sources: [regardie1938(92, 86)],
  hall: pathHall("shin", 20, "Practicus Temple 1"),
};

/** The 30th path of Resh, the Sun on the altar. */
export const practicus2: HallPreset = {
  id: "practicus2",
  title: "Practicus Temple 2",
  grade: "3=8",
  part: 2,
  sources: [regardie1938(106, 100)],
  hall: pathHall("resh", 19, "Practicus Temple 2"),
};

/**
 * The temple in Hod: Mem in the East and Mercury on the dais East of
 * the Hierophant's throne, the
 * Garden of Eden on its stand East of the altar, the pillars either side
 * of it with the Hiereus North and the Hegemon South, and the portals of
 * the paths from Hod on the walls: Ayin and Peh in the South, Shin and
 * Resh at the West corners. The Hierophant stands at his first position
 * West of the altar, as the diagram shows him; his throne stays on the
 * dais. On the altar, the cross, the cup and the triangle of Water with
 * a lamp at each angle.
 */
export const practicus3: HallPreset = {
  id: "practicus3",
  title: "Practicus Temple 3",
  grade: "3=8",
  part: 3,
  sources: [regardie1938(112, 106)],
  hall: {
    type: "gdHall",
    dais: 4,
    children: [
      { type: "banners", children: [{ type: "hebrewLetter", letter: "mem" }] },
      {
        type: "dais",
        children: [
          // As the drawing stacks them: Mercury East of the throne.
          { type: "marker", text: "Mercury", x: 8, y: -3.3 },
          {
            type: "throne",
            x: 8,
            y: -1.3,
            label: "Hierophant’s throne",
            labelPos: "left",
          },
          { type: "banner", kind: "east", x: 11.3 },
        ],
      },
      {
        type: "banners",
        side: "south",
        children: [
          { type: "hebrewLetter", letter: "ayin", y: 4.5 },
          { type: "hebrewLetter", letter: "peh", y: 12.5 },
        ],
      },
      {
        type: "banners",
        side: "west",
        children: [
          { type: "hebrewLetter", letter: "shin", x: 3.7 },
          { type: "hebrewLetter", letter: "resh", x: 12.4 },
        ],
      },
      {
        type: "floor",
        children: [
          { type: "board", kind: "gardenOfEden", x: 8, y: 4.6 },
          { type: "officer", role: "hiereus", x: 2.6, y: 8 },
          { type: "pillar", kind: "black", x: 5.3, y: 8 },
          {
            type: "altar",
            x: 8,
            y: 8,
            children: [
              {
                type: "item",
                kind: "cross",
                form: "greek",
                y: -0.7,
                scale: 0.17,
              },
              { type: "item", kind: "cup", y: -0.25, scale: 0.28 },
              {
                type: "item",
                kind: "triangle",
                dir: "down",
                y: 0.45,
                scale: 0.36,
              },
              { type: "item", kind: "lamp", x: -0.58, y: 0.1, scale: 0.22 },
              { type: "item", kind: "lamp", x: 0.58, y: 0.1, scale: 0.22 },
              { type: "item", kind: "lamp", y: 0.88, scale: 0.22 },
            ],
          },
          { type: "pillar", kind: "white", x: 10.7, y: 8 },
          { type: "officer", role: "hegemon", x: 13.4, y: 8 },
          {
            type: "officer",
            role: "hierophant",
            x: 8,
            y: 11,
            label: "Hierophant (first position)",
          },
          { type: "banner", kind: "west", x: 5.5, y: 14 },
          { type: "item", kind: "cup", x: 7.4, y: 14.8 },
        ],
      },
      { type: "caption", text: "Practicus Temple 3" },
    ],
  },
};
