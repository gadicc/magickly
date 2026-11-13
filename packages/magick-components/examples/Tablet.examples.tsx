import type { ComponentProps } from "react";
import type TabletComponent from "../src/enochian/Tablet.tsx";
import type { ComponentExamples } from "./types.ts";

/** The Watchtowers and the Tablet of Union in their versions. */
export const Tablet: ComponentExamples<ComponentProps<typeof TabletComponent>> =
  {
    entry: "enochian/Tablet",
    exportName: "default",
    examples: [
      { title: "Earth, the Golden Dawn's", props: { id: "earth" } },
      { title: "Fire in Dee's version", props: { id: "fire", version: "dee" } },
      {
        title: "Water, with second letters",
        props: { id: "water", alt: true },
      },
      {
        title: "Air, its letters unreversed",
        props: { id: "air", reversed: false },
      },
      { title: "The Tablet of Union", props: { id: "union" } },
      {
        title: "Earth, a square outlined",
        props: {
          id: "earth",
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
