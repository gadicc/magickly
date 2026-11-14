import type { ComponentProps } from "react";
import type MoonWidgetComponent from "../src/astrology/MoonWidget.tsx";
import type { ComponentExamples } from "./types.ts";

/**
 * Today's moon from either hemisphere, on the night sky magick.ly serves
 * at `/night-sky.jpg`, as `/astrology/planets` draws it; an app passes its
 * own picture.
 */
export const MoonWidget: ComponentExamples<
  ComponentProps<typeof MoonWidgetComponent>
> = {
  entry: "astrology/MoonWidget",
  exportName: "default",
  examples: [
    { title: "From the north", props: { background: "/night-sky.jpg" } },
    {
      title: "From Cape Town",
      props: { background: "/night-sky.jpg", latitude: -33.9 },
    },
  ],
};
