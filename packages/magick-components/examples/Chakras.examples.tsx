import type { ChakrasProps } from "../src/chakras/Chakras.tsx";
import type { ComponentExamples } from "./types.ts";

/** The seven chakras on the figure, and one of them alone. */
export const Chakras: ComponentExamples<ChakrasProps> = {
  entry: "chakras/Chakras",
  exportName: "default",
  examples: [
    { title: "All seven", props: { height: 240 } },
    { title: "The heart", props: { height: 240, active: "heart" } },
    { title: "The crown", props: { height: 240, active: "crown" } },
  ],
};
