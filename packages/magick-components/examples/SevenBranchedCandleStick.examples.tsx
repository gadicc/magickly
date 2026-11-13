import type { ComponentProps } from "react";
import type SevenBranchedCandleStickComponent from "../src/gd/SevenBranchedCandleStick.tsx";
import type { ComponentExamples } from "./types.ts";

/** The candlestick has no options of its own. */
export const SevenBranchedCandleStick: ComponentExamples<
  ComponentProps<typeof SevenBranchedCandleStickComponent>
> = {
  entry: "gd/SevenBranchedCandleStick",
  exportName: "default",
  examples: [{ title: "The candlestick", props: {} }],
};
