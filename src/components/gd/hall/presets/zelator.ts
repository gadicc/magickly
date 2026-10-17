import type { HallNode } from "../types";
import { dais, type HallPreset, REGARDIE_1938 } from "./types";

/** The Zelator's letters above the East: Shin, Tau and Qoph. */
const LETTERS: HallNode = {
  type: "banners",
  children: [
    { type: "hebrewLetter", letter: "shin", x: 3.41 },
    { type: "hebrewLetter", letter: "tau", x: 8 },
    { type: "hebrewLetter", letter: "qoph", x: 12.66 },
  ],
};

/**
 * The Earth tablet in the North with its outer edge on the wall line, inside
 * the hall, the lamp and the salt before it, as the book draws it; the
 * drawings hang it outside the wall.
 */
const NORTH: readonly HallNode[] = [
  { type: "tablet", element: "earth", anchor: "north", x: -0.31, y: 8.3 },
  { type: "item", kind: "lantern", x: 3.3, y: 6.4 },
  { type: "item", kind: "salt", x: 3.15, y: 10.05, scale: 1.04 },
];

const BANNERS: readonly HallNode[] = [
  { type: "banner", kind: "west", x: 6.42, y: -0.84 },
  { type: "banner", kind: "east", x: 9.52, y: -0.84 },
];

const PILLARS: readonly HallNode[] = [
  { type: "pillar", kind: "black", x: 5, y: 11 },
  { type: "pillar", kind: "white", x: 11, y: 11 },
];

const SOURCES = (drawing: string) => [
  `public/pics/${drawing}.svg`,
  `${REGARDIE_1938}, p.44, leaf n38`,
];

/**
 * The Zelator hall, first part, ported from `public/pics/zelator1.svg`. As
 * the book draws it, the altar also bears the Flaming Sword with the cross
 * in the triangle at its base, and a red lamp at its East end.
 */
export const zelator1: HallPreset = {
  id: "zelator1",
  title: "Zelator Temple 1",
  grade: "1=10",
  part: 1,
  sources: SOURCES("zelator1"),
  hall: {
    type: "gdHall",
    dais: 5,
    children: [
      LETTERS,
      dais(-2.7),
      {
        type: "floor",
        children: [
          ...BANNERS,
          ...NORTH,
          { type: "officer", role: "hiereus", x: 5, y: 8, labelPos: "bottom" },
          {
            type: "altar",
            x: 8,
            y: 8,
            children: [
              { type: "item", kind: "lamp", at: "east", y: 0.33, scale: 0.33 },
              {
                type: "item",
                kind: "lightning",
                stroke: "yellow",
                y: -0.05,
                scale: 0.36,
              },
              { type: "item", kind: "triangle", y: 0.6, scale: 0.34 },
              { type: "item", kind: "cross", y: 0.67, scale: 0.13 },
            ],
          },
          { type: "officer", role: "hegemon", x: 11, y: 8, labelPos: "bottom" },
          ...PILLARS,
          {
            type: "officer",
            role: "stolistes",
            x: 5,
            y: 13,
            labelPos: "bottom",
          },
          { type: "officer", role: "keryx", x: 8, y: 13, labelPos: "bottom" },
          {
            type: "officer",
            role: "dadouchos",
            x: 11,
            y: 13,
            labelPos: "bottom",
          },
          { type: "door", x: 14, width: 2 },
        ],
      },
      { type: "caption", text: "Zelator Temple 1" },
    ],
  },
};

/**
 * The Zelator hall, second part, ported from `public/pics/zelator2.svg`:
 * the altar in the East, the Table of Shewbread in the North and the
 * candlestick in the South.
 */
export const zelator2: HallPreset = {
  id: "zelator2",
  title: "Zelator Temple 2",
  grade: "1=10",
  part: 2,
  sources: SOURCES("zelator2"),
  hall: {
    type: "gdHall",
    dais: 5,
    children: [
      LETTERS,
      dais(-2.7),
      {
        type: "floor",
        children: [
          ...BANNERS,
          ...NORTH,
          {
            type: "altar",
            x: 8,
            y: 3,
            children: [
              { type: "item", kind: "triangle", scale: 0.76 },
              { type: "item", kind: "cross", y: 0.2 },
              { type: "item", kind: "censer", at: "east", x: 0.07, y: -0.19 },
              { type: "item", kind: "chalice", x: -0.69, y: 0.45 },
              { type: "item", kind: "lantern", x: 0.69, y: 0.41, scale: 0.52 },
            ],
          },
          { type: "shewbread", x: 5, y: 7 },
          { type: "candlestick", x: 11, y: 7 },
          { type: "officer", role: "hegemon", x: 8, y: 10, labelPos: "top" },
          ...PILLARS,
          {
            type: "officer",
            role: "hiereus",
            x: 8,
            y: 11.85,
            labelPos: "bottom",
          },
          {
            type: "officer",
            role: "stolistes",
            x: 5,
            y: 13,
            labelPos: "bottom",
          },
          {
            type: "officer",
            role: "dadouchos",
            x: 11,
            y: 13,
            labelPos: "bottom",
          },
          { type: "officer", role: "keryx", x: 8, y: 14.95, labelPos: "top" },
          { type: "door", x: 14, width: 2 },
        ],
      },
      { type: "caption", text: "Zelator Temple 2" },
    ],
  },
};
