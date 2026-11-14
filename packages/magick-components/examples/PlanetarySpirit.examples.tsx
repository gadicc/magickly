import type { ComponentProps } from "react";
import type PlanetarySpiritComponent from "../src/astrology/PlanetarySpirit.tsx";
import type { ComponentExamples } from "./types.ts";

/** The seven sigils, at a height the flex box takes from its style. */
export const PlanetarySpirit: ComponentExamples<
  ComponentProps<typeof PlanetarySpiritComponent>
> = {
  entry: "astrology/PlanetarySpirit",
  exportName: "default",
  examples: [
    {
      title: "Zazel, the spirit of Saturn",
      props: { spirit: "zazel", style: { height: 120 } },
    },
    {
      title: "Hismael, the spirit of Jupiter",
      props: { spirit: "hismael", style: { height: 120 } },
    },
    {
      title: "Bartzabel, the spirit of Mars",
      props: { spirit: "bartzabel", style: { height: 120 } },
    },
    {
      title: "Sorath, the spirit of the Sun",
      props: { spirit: "sorath", style: { height: 120 } },
    },
    {
      title: "Kedemel, the spirit of Venus",
      props: { spirit: "kedemel", style: { height: 120 } },
    },
    {
      title: "Taphthartharath, the spirit of Mercury",
      props: { spirit: "taphthartharath", style: { height: 120 } },
    },
    {
      title: "Chasmodai, the spirit of the Moon",
      props: { spirit: "chasmodai", style: { height: 120 } },
    },
  ],
};
