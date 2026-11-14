import type { ComponentProps } from "react";
import type MoonComponent from "../src/astrology/Moon.tsx";
import type { ComponentExamples } from "./types.ts";

/** The Moon in its quarters and full, from the north and from the south. */
export const Moon: ComponentExamples<ComponentProps<typeof MoonComponent>> = {
  entry: "astrology/Moon",
  exportName: "default",
  examples: [
    { title: "Waxing crescent", props: { phase: 0.15, height: 160 } },
    { title: "First quarter", props: { phase: 0.25, height: 160 } },
    { title: "Full", props: { phase: 0.5, height: 160 } },
    {
      title: "Waning gibbous, from the south",
      props: { phase: 0.65, height: 160, hemisphere: "south" },
    },
  ],
};
