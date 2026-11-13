import type { ComponentProps } from "react";
import type TableOfShewbreadComponent from "../src/gd/TableOfShewbread.tsx";
import type { ComponentExamples } from "./types.ts";

/** The table has no options of its own. */
export const TableOfShewbread: ComponentExamples<
  ComponentProps<typeof TableOfShewbreadComponent>
> = {
  entry: "gd/TableOfShewbread",
  exportName: "default",
  examples: [{ title: "The table", props: {} }],
};
