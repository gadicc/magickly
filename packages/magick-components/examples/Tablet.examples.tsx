import type { ComponentProps } from "react";
import type TabletComponent from "../src/enochian/Tablet.tsx";
import type { ComponentExamples } from "./types.ts";

/** The Watchtowers and the Tablet of Union in their versions. */
export const Tablet: ComponentExamples<ComponentProps<typeof TabletComponent>> =
  {
    entry: "enochian/Tablet",
    exportName: "default",
    examples: [
      {
        title: "Earth, the Golden Dawn's",
        props: { tablet: "earth", frame: true },
      },
      {
        title: "Fire in Dee's version",
        props: { tablet: "fire", version: "dee", frame: true },
      },
      {
        title: "Water, with second letters",
        props: { tablet: "water", showSecondLetters: true, frame: true },
      },
      {
        title: "Air, its letters unreversed",
        props: { tablet: "air", mirrorReversed: false, frame: true },
      },
      { title: "The Tablet of Union", props: { tablet: "union", frame: true } },
      {
        title: "Earth, a square outlined",
        props: {
          tablet: "earth",
          frame: true,
          highlights: {
            squares: [
              { row: 0, column: 0 },
              { row: 0, column: 1 },
              { row: 0, column: 2 },
              { row: 0, column: 3 },
            ],
            selected: { row: 0, column: 0 },
          },
        },
      },
      {
        // Laidrom, row 7 read leftward from square 7.
        title: "Earth, a Senior chosen, the rest dimmed",
        props: {
          tablet: "earth",
          frame: true,
          highlights: {
            squares: [],
            name: {
              squares: [6, 5, 4, 3, 2, 1, 0].map((column) => ({
                row: 6,
                column,
              })),
              numbers: [1, 2, 3, 4, 5, 6, 7],
            },
          },
        },
      },
      {
        // Air's Kerubic name of its top left quarter, ringed.
        title: "Air, a name previewed",
        props: {
          tablet: "air",
          frame: true,
          highlights: {
            squares: [],
            preview: {
              squares: [0, 1, 3, 4].map((column) => ({ row: 0, column })),
            },
          },
        },
      },
      {
        // NANTA, Earth's line of the Union, read across.
        title: "The Tablet of Union, a line chosen",
        props: {
          tablet: "union",
          frame: true,
          highlights: {
            squares: [],
            name: {
              squares: [0, 1, 2, 3, 4].map((column) => ({ row: 2, column })),
              numbers: [1, 2, 3, 4, 5],
            },
          },
        },
      },
      {
        title: "Fire, its regions",
        props: {
          tablet: "fire",
          frame: true,
          highlights: { squares: [], regions: true },
        },
      },
    ],
  };
