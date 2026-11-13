import { dais, type HallPreset, regardie1938 } from "./types";

/**
 * The Neophyte hall, after Regardie 1938, vol. 2, p.11. The Banner of the
 * West stands free on the floor North-West of the Hiereus' platform, as
 * the book draws it.
 */
export const neophyte: HallPreset = {
  id: "neophyte",
  title: "Neophyte Temple",
  grade: "0=0",
  sources: [regardie1938(11, 3)],
  hall: {
    type: "gdHall",
    wall: "gradient",
    children: [
      dais(),
      {
        type: "floor",
        children: [
          { type: "banner", kind: "east", x: 9.57, y: -0.06 },
          { type: "pillar", kind: "black", x: 4, y: 3, glow: true },
          { type: "officer", role: "hegemon", x: 8, y: 3, labelPos: "top" },
          { type: "pillar", kind: "white", x: 12, y: 3, glow: true },
          {
            type: "altar",
            at: "centre",
            children: [
              { type: "item", kind: "cross", y: -0.36 },
              { type: "item", kind: "triangle", y: 0.24 },
              { type: "item", kind: "rose", at: "east", x: 0.08 },
              { type: "item", kind: "salt", at: "north", y: -0.3 },
              { type: "item", kind: "bread", at: "north", x: 0.05, y: 0.34 },
              { type: "item", kind: "lamp", at: "south" },
              { type: "item", kind: "cup", at: "west", y: 0.1 },
            ],
          },
          {
            type: "officer",
            role: "stolistes",
            x: 1.05,
            y: 8,
            labelPos: "bottom",
          },
          {
            type: "officer",
            role: "dadouchos",
            x: 14.75,
            y: 8,
            labelPos: "bottom",
          },
          {
            type: "platform",
            x: 8,
            y: 14.5,
            w: 4,
            h: 3,
            children: [{ type: "officer", role: "hiereus", labelPos: "top" }],
          },
          { type: "banner", kind: "west", x: 4.8, y: 14.3 },
          { type: "officer", role: "keryx", x: 14, y: 15, labelPos: "top" },
          { type: "door", x: 14, width: 2 },
          {
            type: "officer",
            role: "sentinel",
            x: 14,
            y: 17.15,
            labelPos: "bottom",
          },
        ],
      },
      { type: "caption", text: "Neophyte Temple" },
    ],
  },
};
