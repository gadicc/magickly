import type { ComponentProps } from "react";
import type RoseSigilComponent from "../src/gd/RoseSigil.tsx";
import type { ComponentExamples } from "./types.ts";

/** Sigils of three divine names, as `/gd/sigils` draws them. */
export const RoseSigil: ComponentExamples<
  ComponentProps<typeof RoseSigilComponent>
> = {
  entry: "gd/RoseSigil",
  exportName: "default",
  examples: [
    { title: "Adonai", props: { text: "אדני" } },
    {
      title: "Eheieh, without the rose",
      props: { text: "אהיה", showRose: false },
    },
    {
      title: "Agla, drawn at once",
      props: { text: "אגלא", animate: false },
    },
  ],
};
