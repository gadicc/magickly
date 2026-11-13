import type { MoonWidgetProps } from "../src/astrology/Moon.tsx";
import type { ComponentExamples } from "./types.ts";

/** Today's moon from either hemisphere. */
export const Moon: ComponentExamples<MoonWidgetProps> = {
  entry: "astrology/Moon",
  exportName: "default",
  examples: [
    { title: "From the north", props: {} },
    { title: "From Cape Town", props: { latitude: -33.9 } },
  ],
};
