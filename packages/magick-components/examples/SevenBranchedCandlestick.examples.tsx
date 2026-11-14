import type { ComponentProps } from "react";
import type SevenBranchedCandlestickComponent from "../src/gd/SevenBranchedCandlestick.tsx";
import type { ComponentExamples } from "./types.ts";

/** The candlestick in its two versions. */
export const SevenBranchedCandlestick: ComponentExamples<
  ComponentProps<typeof SevenBranchedCandlestickComponent>
> = {
  entry: "gd/SevenBranchedCandlestick",
  exportName: "default",
  examples: [
    { title: "The candlestick of 1909", props: {} },
    { title: "The modern arrangement", props: { version: "modern" } },
  ],
};
