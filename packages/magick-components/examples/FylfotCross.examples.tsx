import type { ComponentProps } from "react";
import type FylfotCrossComponent from "../src/gd/symbols/fylfot-cross.tsx";
import type { ComponentExamples } from "./types.ts";

/** The cross finished, uncoloured, and half filled in. */
export const FylfotCross: ComponentExamples<
  ComponentProps<typeof FylfotCrossComponent>
> = {
  entry: "gd/symbols/fylfot-cross",
  exportName: "default",
  examples: [
    { title: "The finished cross", props: {} },
    { title: "Without its colours", props: { showColors: false } },
    {
      title: "Half filled in",
      props: {
        cells: [
          ["fire", "sagittarius", "leo", null, null],
          [null, null, "aries", null, null],
          [null, null, "sol", null, null],
          [null, null, null, null, null],
          ["earth", null, null, null, null],
        ],
      },
    },
  ],
};
