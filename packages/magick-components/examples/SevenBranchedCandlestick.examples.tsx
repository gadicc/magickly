import type { ComponentProps } from "react";
import type SevenBranchedCandlestickComponent from "../src/gd/SevenBranchedCandlestick.tsx";
import type { ComponentExamples } from "./types.ts";

/** The candlestick has no options of its own. */
export const SevenBranchedCandlestick: ComponentExamples<
  ComponentProps<typeof SevenBranchedCandlestickComponent>
> = {
  entry: "gd/SevenBranchedCandlestick",
  exportName: "default",
  examples: [{ title: "The candlestick", props: {} }],
};
