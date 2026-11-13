import type { MercuryWidgetProps } from "../src/astrology/Mercury.tsx";
import type { ComponentExamples } from "./types.ts";

/**
 * Mercury's retrograde dates under a picture, as on `/astrology/planets`.
 * The two images are the paths magick.ly serves them at; an app passes its
 * own.
 */
export const Mercury: ComponentExamples<MercuryWidgetProps> = {
  entry: "astrology/Mercury",
  exportName: "default",
  examples: [
    {
      title: "With a picture",
      props: { background: "/night-sky.jpg", image: "/pics/mercury.webp" },
    },
  ],
};
