import type { HallNode } from "../types";
import { dais, drawing, type HallPreset, regardie1938 } from "./types";

/**
 * The East of both parts: the Air tablet standing over the edge of the
 * dais, a lantern before it and the Pantacle, the Theoricus' badge.
 */
const AIR: readonly HallNode[] = [
  { type: "tablet", element: "air", x: 7.97, y: 0.63 },
  { type: "item", kind: "lantern", x: 7, y: 1.66 },
  { type: "item", kind: "pantacle", x: 9.07, y: 1.83 },
];

/**
 * The Theoricus hall of the 32nd path, ported from
 * `public/pics/theoricus1.svg`. The Universe, the path's trump, lies on
 * the altar.
 */
export const theoricus1: HallPreset = {
  id: "theoricus1",
  title: "Theoricus Temple 1",
  grade: "2=9",
  part: 1,
  sources: [drawing("theoricus1"), regardie1938(69, 63)],
  hall: {
    type: "gdHall",
    dais: 5,
    children: [
      {
        type: "banners",
        children: [
          { type: "hebrewLetter", letter: "shin", x: 3.41 },
          { type: "hebrewLetter", letter: "tau", x: 8 },
          { type: "hebrewLetter", letter: "qoph", x: 12.66 },
        ],
      },
      dais(),
      {
        type: "floor",
        children: [
          AIR[0],
          { type: "banner", kind: "west", x: 6.42, y: -0.84 },
          { type: "banner", kind: "east", x: 9.52, y: -0.84 },
          ...AIR.slice(1),
          { type: "pillar", kind: "black", x: 4, y: 3 },
          { type: "pillar", kind: "white", x: 12, y: 3 },
          { type: "officer", role: "keryx", x: 1.08, y: 8, labelPos: "bottom" },
          {
            type: "altar",
            x: 8,
            y: 8,
            children: [
              { type: "tarotKey", n: 21 },
              { type: "item", kind: "fan", at: "east", y: -0.26 },
              {
                type: "item",
                kind: "salt",
                at: "north",
                x: -0.07,
                scale: 0.68,
              },
              {
                type: "item",
                kind: "lantern",
                at: "south",
                x: 0.14,
                y: -0.22,
                scale: 0.87,
              },
              { type: "item", kind: "cup", at: "west", y: 0.45, scale: 0.72 },
            ],
          },
          {
            type: "officer",
            role: "hegemon",
            x: 15.04,
            y: 8,
            labelPos: "bottom",
          },
          { type: "officer", role: "hiereus", x: 8, y: 14.95, labelPos: "top" },
          { type: "door", x: 14, width: 2 },
        ],
      },
      { type: "caption", text: "Theoricus Temple 1" },
    ],
  },
};

/**
 * The Theoricus 2=9 hall, ported from `public/pics/theoricus2.svg`: Resh,
 * Samekh and Tzaddi above the East and Tau beyond the West. The kamea of
 * Luna is drawn from its numbers; the seals of Luna are a placeholder and
 * the serpent on the Tree a marker until their art is drawn (stage H).
 */
export const theoricus2: HallPreset = {
  id: "theoricus2",
  title: "Theoricus Temple 2",
  grade: "2=9",
  part: 2,
  sources: [drawing("theoricus2"), regardie1938(82, 76)],
  hall: {
    type: "gdHall",
    dais: 5,
    children: [
      {
        type: "banners",
        children: [
          { type: "hebrewLetter", letter: "resh", x: 3.41 },
          { type: "hebrewLetter", letter: "samekh", x: 8 },
          { type: "hebrewLetter", letter: "tzaddi", x: 12.66 },
        ],
      },
      dais(),
      {
        type: "banners",
        side: "west",
        children: [{ type: "hebrewLetter", letter: "tau" }],
      },
      {
        type: "floor",
        children: [
          AIR[0],
          { type: "banner", kind: "east", x: 9.46, y: -0.84 },
          { type: "kamea", planet: "moon", x: 3, y: 1.07 },
          { type: "seal", planet: "moon", x: 13.02, y: 0.97 },
          ...AIR.slice(1),
          {
            type: "marker",
            text: "Serpent on the Tree",
            x: 8,
            y: 6.13,
            scale: 0.86,
          },
          {
            type: "officer",
            role: "keryx",
            x: 1.8,
            y: 8.14,
            labelPos: "bottom",
          },
          { type: "pillar", kind: "black", x: 4.92, y: 8.05 },
          {
            type: "altar",
            x: 8,
            y: 8,
            children: [
              {
                type: "item",
                kind: "triangle",
                dir: "down",
                y: 0.06,
                scale: 0.5,
              },
              { type: "item", kind: "cross", y: -0.02, scale: 0.28 },
              { type: "item", kind: "cup", at: "north", x: -0.16, scale: 0.72 },
              {
                type: "item",
                kind: "lamp",
                at: "south",
                x: 0.09,
                y: -0.1,
                scale: 0.82,
              },
            ],
          },
          { type: "item", kind: "lightning", x: 8, y: 9.54 },
          { type: "pillar", kind: "white", x: 11.08, y: 8 },
          {
            type: "officer",
            role: "hegemon",
            x: 14.07,
            y: 7.98,
            labelPos: "bottom",
          },
          { type: "banner", kind: "west", x: 6, y: 14.91 },
          { type: "officer", role: "hiereus", x: 8, y: 14.95, labelPos: "top" },
          { type: "door", x: 14, width: 2 },
        ],
      },
      { type: "caption", text: "Theoricus Temple 2" },
    ],
  },
};
