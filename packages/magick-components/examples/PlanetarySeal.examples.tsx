import type { ComponentProps } from "react";
import type PlanetarySealComponent from "../src/astrology/PlanetarySeal.tsx";
import type { ComponentExamples } from "./types.ts";

/**
 * The seven seals after Agrippa's woodcuts (1533) on the bare page, in the
 * text's colour, and the Moon's on the temple hall's silver plate.
 */
export const PlanetarySeal: ComponentExamples<
  ComponentProps<typeof PlanetarySealComponent>
> = {
  entry: "astrology/PlanetarySeal",
  exportName: "default",
  examples: [
    { title: "The seal of Saturn", props: { planet: "saturn" } },
    { title: "The seal of Jupiter", props: { planet: "jupiter" } },
    { title: "The seal of Mars", props: { planet: "mars" } },
    {
      title: "The seal of the Sun",
      props: { planet: "sol", label: "Seal of the Sun" },
    },
    { title: "The seal of Venus", props: { planet: "venus" } },
    { title: "The seal of Mercury", props: { planet: "mercury" } },
    {
      title: "The seal of the Moon",
      props: { planet: "luna", label: "Seal of the Moon" },
    },
    {
      title: "The Moon's seal on its silver plate",
      props: { planet: "luna", look: "plate", label: "Seal of the Moon" },
    },
  ],
};
