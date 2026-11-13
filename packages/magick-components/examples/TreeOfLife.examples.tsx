import type { TreeOfLifeProps } from "../src/kabbalah/TreeOfLife.tsx";
import type { ComponentExamples } from "./types.ts";

/** The Tree of Life, as `/kabbalah/tree` draws it and with its options. */
export const TreeOfLife: ComponentExamples<TreeOfLifeProps> = {
  entry: "kabbalah/TreeOfLife",
  exportName: "default",
  examples: [
    { title: "The Queen scale", props: {} },
    { title: "The King scale", props: { colorScale: "king" } },
    {
      title: "Hebrew names, with Da'at",
      props: { field: "name.he", topText: "", showDaat: true },
    },
    {
      title: "Planets, and the Hebrew Tree's letters",
      props: { field: "planet.name.en.en", letterAttr: "hebrew" },
    },
    { title: "Tiferet alone", props: { active: "tiferet" } },
    { title: "The path from Tiferet to Yesod", props: { activePath: "6_9" } },
    { title: "Seen from behind", props: { flip: true } },
  ],
};
