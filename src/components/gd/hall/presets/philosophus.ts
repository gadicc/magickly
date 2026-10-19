import type { HallNode } from "../types";
import { type HallPreset, regardie1938 } from "./types";

/**
 * The Philosophus halls (4=7), from the diagrams and rubrics of
 * Regardie's 1938 first edition (plan 061, Sources), following the text
 * where it is explicit (Where the sources disagree, 2–5). The paths'
 * halls have three officers, as the rubric of the 29th path says. The
 * Fire tablet is a marker until magick-data has it (stage G).
 */

/** The Fire tablet on the South wall, its lamp East and incense West. */
const FIRE: readonly HallNode[] = [
  { type: "marker", text: "Fire Tablet", x: 15.3, y: 7.6, scale: 0.75 },
  { type: "item", kind: "lamp", x: 14.4, y: 6.2 },
  { type: "item", kind: "censer", x: 14.4, y: 9.4 },
];

/** The altar between two candles, a trump on it. */
const altar = (trump: number): HallNode[] => [
  { type: "item", kind: "candle", x: 6.2, y: 8 },
  { type: "altar", x: 8, y: 8, children: [{ type: "tarotKey", n: trump }] },
  { type: "item", kind: "candle", x: 9.8, y: 8 },
];

/**
 * The 29th and 28th paths, which the book arranges alike: the three
 * letters across the East, its ends the corners (conflict 2); the
 * Hierophant's throne before the dais in the North-East, beside it a cup
 * of water and the Banner of the East; the Hegemon in the South-East,
 * the pillars before her; the Hiereus in the West with the Banner of the
 * West. Each officer has a cup of water.
 */
function pathHall(
  letters: readonly string[],
  trump: number,
  title: string,
): HallNode {
  return {
    type: "gdHall",
    dais: 4,
    children: [
      {
        type: "banners",
        spread: "ends",
        children: letters.map((letter) => ({ type: "hebrewLetter", letter })),
      },
      {
        type: "floor",
        children: [
          { type: "item", kind: "cup", x: 1, y: 2.6 },
          { type: "officer", role: "hierophant", x: 3, y: 1.5 },
          { type: "banner", kind: "east", x: 5.6, y: 2.2 },
          { type: "officer", role: "hegemon", x: 12.4, y: 1.5 },
          { type: "item", kind: "cup", x: 12.4, y: 3.3 },
          { type: "pillar", kind: "black", x: 11.4, y: 5 },
          { type: "pillar", kind: "white", x: 13.8, y: 5 },
          ...FIRE,
          ...altar(trump),
          { type: "banner", kind: "west", x: 5.4, y: 12.4 },
          { type: "officer", role: "hiereus", x: 8, y: 12.6 },
          { type: "item", kind: "cup", x: 9.9, y: 12.8 },
          { type: "item", kind: "lamp", x: 10.8, y: 12.8 },
        ],
      },
      { type: "caption", text: title },
    ],
  };
}

/** The 29th path of Qoph: Shin, Tau and Qoph, the Moon on the altar. */
export const philosophus1: HallPreset = {
  id: "philosophus1",
  title: "Philosophus Temple 1",
  grade: "4=7",
  part: 1,
  sources: [regardie1938(121, 115), regardie1938(122, 116, "the rubric")],
  hall: pathHall(["shin", "tau", "qoph"], 18, "Philosophus Temple 1"),
};

/**
 * The 28th path of Tzaddi: Resh, Samekh and Tzaddi, the Star on the
 * altar; no Tau in the West (conflict 3).
 */
export const philosophus2: HallPreset = {
  id: "philosophus2",
  title: "Philosophus Temple 2",
  grade: "4=7",
  part: 2,
  sources: [regardie1938(131, 125)],
  hall: pathHall(["resh", "samekh", "tzaddi"], 17, "Philosophus Temple 2"),
};

/**
 * The 27th path of Peh, as the rubric says (conflict 4): the Hierophant
 * on his throne on the dais, the Hiereus with his banner before it in the
 * North-East, the Hegemon in the South-East, each with a red lamp rather
 * than the drawing's cups; the drawing's pillars before Peh in the South
 * and its Banner of the East kept. Mem in the East, Ayin, Peh and Resh
 * beyond the South wall and Shin beyond the West wall at the
 * South-West corner, where the drawing puts it: the paths from Hod.
 */
export const philosophus3: HallPreset = {
  id: "philosophus3",
  title: "Philosophus Temple 3",
  grade: "4=7",
  part: 3,
  sources: [regardie1938(137, 131)],
  hall: {
    type: "gdHall",
    dais: 4,
    children: [
      { type: "banners", children: [{ type: "hebrewLetter", letter: "mem" }] },
      {
        type: "dais",
        children: [
          { type: "officer", role: "hierophant", x: 8 },
          { type: "item", kind: "lamp", x: 9.6 },
        ],
      },
      {
        type: "banners",
        side: "south",
        children: [
          { type: "hebrewLetter", letter: "ayin", y: 2.6 },
          { type: "hebrewLetter", letter: "peh", y: 5.8 },
          { type: "hebrewLetter", letter: "resh", y: 13.6 },
        ],
      },
      {
        type: "banners",
        side: "west",
        children: [{ type: "hebrewLetter", letter: "shin", x: 14.3 }],
      },
      {
        type: "floor",
        children: [
          { type: "banner", kind: "west", x: 0.9, y: 2.2 },
          { type: "officer", role: "hiereus", x: 2.6, y: 1.5 },
          { type: "item", kind: "lamp", x: 4.1, y: 1.8 },
          { type: "banner", kind: "east", x: 10.6, y: 2.2 },
          { type: "item", kind: "lamp", x: 12, y: 1.8 },
          { type: "officer", role: "hegemon", x: 13.5, y: 1.5 },
          { type: "pillar", kind: "white", x: 12.2, y: 6.4 },
          ...FIRE,
          { type: "pillar", kind: "black", x: 12.2, y: 10.6 },
          ...altar(16),
        ],
      },
      { type: "caption", text: "Philosophus Temple 3" },
    ],
  },
};

/**
 * The entry into Netzach (4=7). Caph in the East; Nun, Peh, Tzaddi and
 * Qoph on the North wall from the North-East to the North-West corner,
 * as the rubric lists them. On the dais the Hierophant, the Banner of
 * the East and the kamea and seals of Venus the drawing shows, with the
 * rubric's symbol of Venus on the Tree of Life as a marker (conflict 10).
 * The Fall on its stand East of the altar; on the altar the cross and
 * triangle as the symbol of Sulphur, a red lamp at each angle of the
 * triangle; the pillars North and South of the altar with the Hiereus
 * and Hegemon beside them, as the rubric says twice (conflict 5).
 */
export const philosophus4: HallPreset = {
  id: "philosophus4",
  title: "Philosophus Temple 4",
  grade: "4=7",
  part: 4,
  sources: [
    regardie1938(144, 138),
    regardie1938(145, 139, "the rubric, continued"),
  ],
  hall: {
    type: "gdHall",
    dais: 4,
    children: [
      { type: "banners", children: [{ type: "hebrewLetter", letter: "kaph" }] },
      {
        type: "dais",
        children: [
          { type: "kamea", planet: "venus", x: 2.6 },
          { type: "seal", planet: "venus", x: 4.9 },
          { type: "officer", role: "hierophant", x: 8 },
          { type: "banner", kind: "east", x: 10.6 },
          {
            type: "marker",
            text: "Venus on the Tree of Life",
            x: 13.3,
            scale: 0.9,
          },
        ],
      },
      {
        type: "banners",
        side: "north",
        children: [
          { type: "hebrewLetter", letter: "nun", y: 1.2 },
          { type: "hebrewLetter", letter: "peh", y: 5 },
          { type: "hebrewLetter", letter: "tzaddi", y: 13.2 },
        ],
      },
      {
        type: "banners",
        side: "west",
        children: [{ type: "hebrewLetter", letter: "qoph", x: 1.3 }],
      },
      {
        type: "floor",
        children: [
          { type: "board", kind: "theFall", x: 8, y: 4.8 },
          { type: "officer", role: "hiereus", x: 2.6, y: 8 },
          { type: "pillar", kind: "black", x: 5.3, y: 8 },
          {
            type: "altar",
            x: 8,
            y: 8,
            children: [
              {
                type: "item",
                kind: "triangle",
                y: -0.2,
                scale: 0.42,
              },
              {
                type: "item",
                kind: "cross",
                form: "greekFiveSquares",
                y: 0.55,
                scale: 0.2,
              },
              { type: "item", kind: "lamp", y: -0.8, scale: 0.22 },
              { type: "item", kind: "lamp", x: -0.62, y: 0.25, scale: 0.22 },
              { type: "item", kind: "lamp", x: 0.62, y: 0.25, scale: 0.22 },
            ],
          },
          { type: "pillar", kind: "white", x: 10.7, y: 8 },
          { type: "officer", role: "hegemon", x: 13, y: 8 },
          ...FIRE,
          { type: "banner", kind: "west", x: 5.7, y: 14.4 },
        ],
      },
      { type: "caption", text: "Philosophus Temple 4" },
    ],
  },
};
