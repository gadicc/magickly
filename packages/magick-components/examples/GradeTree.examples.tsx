import type { TreeOfLifeProps } from "../src/kabbalah/TreeOfLife.tsx";
import type { ComponentExamples } from "./types.ts";

/** The Tree as the Golden Dawn's grades, as `/gd/grades` draws it. */
export const GradeTree: ComponentExamples<TreeOfLifeProps> = {
  entry: "gd/GradeTree",
  exportName: "default",
  examples: [
    { title: "The grades", props: {} },
    { title: "In the King scale", props: { colorScale: "king" } },
    { title: "The Portal's place, Da'at", props: { showDaat: true } },
  ],
};
