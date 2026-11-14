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
    ],
  };
