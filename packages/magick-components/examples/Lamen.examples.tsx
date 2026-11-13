import type { ComponentProps } from "react";
import type LamenComponent from "../src/gd/Lamen.tsx";
import type { ComponentExamples } from "./types.ts";

/** Lamens of the Outer Order's officers, a Chief's, an adept's and the Portal's. */
export const Lamen: ComponentExamples<ComponentProps<typeof LamenComponent>> = {
  entry: "gd/Lamen",
  exportName: "default",
  examples: [
    { title: "The Hierophant", props: { officer: "hierophant", width: 160 } },
    { title: "The Hiereus", props: { officer: "hiereus", width: 160 } },
    { title: "The Hegemon", props: { officer: "hegemon", width: 160 } },
    { title: "The Keryx", props: { officer: "keryx", width: 160 } },
    { title: "The Imperator", props: { officer: "imperator", width: 160 } },
    {
      title: "The Chief Adept",
      props: { officer: "chiefAdept", width: 160 },
    },
    {
      title: "The Hiereus in the Portal",
      props: { officer: "hiereus", grade: "portal", width: 160 },
    },
  ],
};
