import type { HallNode } from "../types";
import { type HallPreset, regardie1938 } from "./types";

/**
 * The Portal halls, from Regardie's 1938 first edition (plan 061,
 * Sources). The book heads each part with the other part's diagram, so
 * each preset takes the diagram its own rubric describes (Where the
 * sources disagree, 1 and 6).
 */

/** The five paths from the Portal, across the East of the floor. */
const PATHS: readonly HallNode[] = [
  ["mem", 1.1],
  ["ayin", 4.5],
  ["samekh", 8],
  ["nun", 11.4],
  ["kaph", 14.9],
].map(([letter, x]) => ({
  type: "hebrewLetter",
  letter,
  x,
  y: 0.9,
  scale: 0.75,
}));

/**
 * The East behind the veil: the Chief Adept, the small white altar
 * between the pillars, the veil across the dais.
 */
const EAST: readonly HallNode[] = [
  { type: "officer", role: "chiefAdept", x: 8, y: -3.8, labelPos: "right" },
  { type: "pillar", kind: "black", x: 5.7, y: -2 },
  { type: "altar", kind: "white", x: 8, y: -2, scale: 0.5 },
  { type: "pillar", kind: "white", x: 10.3, y: -2 },
  { type: "veil", x: 8, y: -0.3 },
];

/** The Earth tablet on the North wall, the Fire tablet on the South. */
const SIDES: readonly HallNode[] = [
  { type: "tablet", element: "earth", x: -0.31, y: 8, anchor: "north" },
  { type: "tablet", element: "fire", x: 16.31, y: 8, anchor: "south" },
];

/**
 * Part 1, from the diagram of p.175 (conflict 1), as the rubric of
 * pp.156–157 sets it: the Chief Adept behind the veil with the brazier,
 * the white lamp and the incense for the altar; the Third Adept in the
 * North-East with the cup of water, the Second Adept in the South-East
 * with the incense sticks, the Hegemon East of the altar with the rose
 * leaves, the Hiereus in the West with the salt. On the altar, the cross
 * of four triangles. Beyond the East wall, as the diagram draws them,
 * the Tablet of Union and the gong.
 */
export const portal1: HallPreset = {
  id: "portal1",
  title: "Portal Temple 1",
  grade: "Portal",
  part: 1,
  sources: [
    regardie1938(175, 168, "its diagram, which the book heads part 2"),
    regardie1938(156, 149, "the rubric of part 1, pp.156–157"),
  ],
  hall: {
    type: "gdHall",
    dais: 5,
    children: [
      {
        type: "banners",
        children: [
          { type: "tablet", element: "union", x: 8, scale: 0.9 },
          { type: "item", kind: "gong", x: 13.9 },
        ],
      },
      {
        type: "dais",
        children: [
          { type: "item", kind: "brazier", x: 1.4, y: -4 },
          { type: "item", kind: "lamp", fill: "white", x: 1.4, y: -2.4 },
          { type: "item", kind: "censer", x: 2.9, y: -3.2 },
          ...EAST,
        ],
      },
      {
        type: "floor",
        children: [
          ...PATHS,
          { type: "officer", role: "thirdAdept", x: 1.8, y: 2.8 },
          { type: "item", kind: "cup", x: 3.3, y: 3.2 },
          { type: "banner", kind: "east", x: 5, y: 3.3 },
          { type: "tablet", element: "air", x: 9.8, y: 3 },
          { type: "officer", role: "secondAdept", x: 13, y: 2.8 },
          { type: "item", kind: "censer", x: 14.6, y: 3.8 },
          { type: "officer", role: "hegemon", x: 8, y: 5.4, labelPos: "left" },
          { type: "item", kind: "rose", x: 9.5, y: 5.6, scale: 0.45 },
          ...SIDES,
          {
            type: "altar",
            x: 8,
            y: 8,
            children: [
              {
                type: "item",
                kind: "cross",
                form: "fourTriangles",
                scale: 0.45,
              },
            ],
          },
          { type: "officer", role: "hiereus", x: 8, y: 13.1, labelPos: "top" },
          { type: "item", kind: "salt", x: 9.4, y: 13.4 },
          { type: "banner", kind: "west", x: 5, y: 14.3 },
          // At scale 1, 2 squares deep: at the default it would touch the
          // Hiereus.
          {
            type: "tablet",
            element: "water",
            x: 8,
            y: 16.31,
            anchor: "west",
            scale: 1,
          },
        ],
      },
      { type: "caption", text: "Portal Temple 1" },
    ],
  },
};

/**
 * Part 2, from the diagram of p.155 (conflict 1), as the rubric of p.175
 * sets it: the Second and Third Adepts on the dais, South-East and
 * North-East (conflict 6); the altar under the hanging pentagram with
 * the four elemental emblems (rose leaves, salt, incense and the cup)
 * round the Greek cross of five squares; the Hegemon West of the altar,
 * the Hiereus in the West; Pan, the Devil, Death and Typhon by the
 * North and South walls; Tau beyond the West.
 */
export const portal2: HallPreset = {
  id: "portal2",
  title: "Portal Temple 2",
  grade: "Portal",
  part: 2,
  sources: [
    regardie1938(155, 148, "its diagram, which the book heads part 1"),
    regardie1938(175, 168, "the rubric of part 2"),
  ],
  hall: {
    type: "gdHall",
    dais: 5,
    children: [
      {
        type: "dais",
        children: [
          { type: "officer", role: "thirdAdept", x: 2.4, y: -2.6 },
          ...EAST,
          { type: "officer", role: "secondAdept", x: 13.6, y: -2.6 },
        ],
      },
      {
        type: "banners",
        side: "west",
        children: [{ type: "hebrewLetter", letter: "tau" }],
      },
      {
        type: "floor",
        children: [
          ...PATHS,
          { type: "banner", kind: "east", x: 5, y: 3.5 },
          { type: "tablet", element: "air", x: 9.8, y: 3 },
          { type: "marker", text: "Pan", x: 1.2, y: 5 },
          { type: "marker", text: "Devil", x: 1.2, y: 11.2 },
          { type: "marker", text: "Death", x: 14.8, y: 5 },
          { type: "marker", text: "Typhon", x: 14.8, y: 11.2 },
          ...SIDES,
          {
            type: "altar",
            x: 8,
            y: 8,
            children: [
              { type: "item", kind: "pentagram", y: -0.4, scale: 0.34 },
              {
                type: "item",
                kind: "cross",
                form: "greekFiveSquares",
                y: 0.3,
                scale: 0.28,
              },
              { type: "item", kind: "rose", at: "east", scale: 0.4 },
              { type: "item", kind: "salt", at: "north", x: 0.2 },
              {
                type: "item",
                kind: "censer",
                at: "south",
                x: -0.2,
                scale: 0.4,
              },
              { type: "item", kind: "cup", at: "west", scale: 0.3 },
            ],
          },
          { type: "officer", role: "hegemon", x: 8, y: 11 },
          { type: "officer", role: "hiereus", x: 8, y: 13.6 },
          { type: "banner", kind: "west", x: 5, y: 14.4 },
          {
            type: "tablet",
            element: "water",
            x: 10.8,
            y: 16.31,
            anchor: "west",
          },
        ],
      },
      { type: "caption", text: "Portal Temple 2" },
    ],
  },
};
