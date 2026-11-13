import type { ComponentProps } from "react";
import type { GdHall as GdHallComponent } from "../src/gd/hall/GdHall.tsx";
import {
  neophyte,
  portal1,
  theoricus1,
  zelator1,
} from "../src/gd/hall/presets/index.ts";
import type { ComponentExamples } from "./types.ts";

/** Four of the package's fourteen preset halls. */
export const GdHall: ComponentExamples<ComponentProps<typeof GdHallComponent>> =
  {
    entry: "gd/hall/GdHall",
    exportName: "GdHall",
    examples: [
      { title: "The Neophyte hall", props: { hall: neophyte.hall } },
      { title: "The Zelator hall, part 1", props: { hall: zelator1.hall } },
      { title: "The Theoricus hall, part 1", props: { hall: theoricus1.hall } },
      { title: "The Portal hall, part 1", props: { hall: portal1.hall } },
    ],
  };
