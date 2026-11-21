import type { ComponentProps } from "react";
import type KameaSigilComponent from "../src/astrology/KameaSigil.tsx";
import type { ComponentExamples } from "./types.ts";

/**
 * Names traced on their planets' squares as Agrippa (1533) spells them,
 * from the smallest square to the largest: one word, two words side by
 * side, and the Moon's square, the largest drawing.
 */
export const KameaSigil: ComponentExamples<
  ComponentProps<typeof KameaSigilComponent>
> = {
  entry: "astrology/KameaSigil",
  exportName: "default",
  examples: [
    {
      title: "Agiel, the intelligence of Saturn",
      props: { planet: "saturn", text: "אגיאל" },
    },
    {
      title: "Hismael, the spirit of Jupiter",
      props: { planet: "jupiter", text: "הסמאל" },
    },
    {
      title: "The Bne Seraphim, the intelligences of Venus",
      props: { planet: "venus", text: "בני שרפים" },
    },
    {
      title: "Chasmodai, the spirit of the Moon",
      props: { planet: "luna", text: "חשמודאי" },
    },
    {
      title: "Elim on the Moon's square, final Mem at 600",
      props: { planet: "luna", text: "אלים", finals: true },
    },
  ],
};
