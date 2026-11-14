import type { ComponentProps } from "react";
import type RoseSigilComponent from "../src/gd/RoseSigil.tsx";
import type { ComponentExamples } from "./types.ts";

/**
 * Sigils of three divine names, as `/gd/sigils` draws them, and one on
 * Regardie's rose of 1939.
 */
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
    {
      title: "Shabbathai, on Regardie's rose",
      props: { text: "שבתאי", version: "regardie1939" },
    },
  ],
};
