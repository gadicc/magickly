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
    { title: "Adonai", props: { sigilText: "אדני" } },
    {
      title: "Eheieh, without the rose",
      props: { sigilText: "אהיה", showRose: false },
    },
    {
      title: "Agla, showing the letters' circles",
      props: { sigilText: "אגלא", debug: true },
    },
  ],
};
