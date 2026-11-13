import type { ComponentProps } from "react";
import type KameaComponent from "../src/astrology/Kamea.tsx";
import type { ComponentExamples } from "./types.ts";

/** Three of the seven squares, from the smallest to the largest. */
export const Kamea: ComponentExamples<ComponentProps<typeof KameaComponent>> = {
  entry: "astrology/Kamea",
  exportName: "default",
  examples: [
    {
      title: "Saturn, three by three",
      props: { planet: "saturn", label: "Kamea of Saturn" },
    },
    {
      title: "The Sun, six by six",
      props: { planet: "sol", label: "Kamea of the Sun" },
    },
    {
      title: "The Moon, nine by nine, in gold on blue",
      props: {
        planet: "luna",
        label: "Kamea of the Moon",
        paper: "#1d2b53",
        ink: "#e8c547",
      },
    },
  ],
};
