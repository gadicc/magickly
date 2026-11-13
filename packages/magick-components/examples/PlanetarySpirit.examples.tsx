import type { ComponentProps } from "react";
import type PlanetarySpiritComponent from "../src/astrology/planetarySpirits.tsx";
import type { ComponentExamples } from "./types.ts";

/** The seven sigils, at a height the flex box takes from its style. */
export const PlanetarySpirit: ComponentExamples<
  ComponentProps<typeof PlanetarySpiritComponent>
> = {
  entry: "astrology/planetarySpirits",
  exportName: "default",
  examples: [
    {
      title: "Zazel, the spirit of Saturn",
      props: { id: "zazel", height: 120 },
    },
    {
      title: "Hismael, the spirit of Jupiter",
      props: { id: "hismael", height: 120 },
    },
    {
      title: "Bartzabel, the spirit of Mars",
      props: { id: "bartzabel", height: 120 },
    },
    {
      title: "Sorath, the spirit of the Sun",
      props: { id: "sorath", height: 120 },
    },
    {
      title: "Kedemel, the spirit of Venus",
      props: { id: "kedemel", height: 120 },
    },
    {
      title: "Taphthartharath, the spirit of Mercury",
      props: { id: "taphthartharath", height: 120 },
    },
    {
      title: "Chasmodai, the spirit of the Moon",
      props: { id: "chasmodai", height: 120 },
    },
  ],
};
