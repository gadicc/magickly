import type { ComponentExamples } from "./types.ts";

export type { ComponentExamples, Example } from "./types.ts";

import { Chakras } from "./Chakras.examples.tsx";
import { FylfotCross } from "./FylfotCross.examples.tsx";
import { GdHall } from "./GdHall.examples.tsx";
import { GradeTree } from "./GradeTree.examples.tsx";
import { Kamea } from "./Kamea.examples.tsx";
import { Lamen } from "./Lamen.examples.tsx";
import { Mercury } from "./Mercury.examples.tsx";
import { Moon } from "./Moon.examples.tsx";
import { PlanetarySpirit } from "./PlanetarySpirit.examples.tsx";
import { RoseSigil } from "./RoseSigil.examples.tsx";
import { SevenBranchedCandleStick } from "./SevenBranchedCandleStick.examples.tsx";
import { TableOfShewbread } from "./TableOfShewbread.examples.tsx";
import { Tablet } from "./Tablet.examples.tsx";
import { TreeOfLife } from "./TreeOfLife.examples.tsx";

/**
 * Every component the explorer on magick.ly shows, by name, in the order
 * its index lists them (plan 080, decision 5). The example modules are the
 * component list: a component appears when it has one, under the name its
 * module gives it, and a test holds this record to the modules in this
 * directory. They are in the repository, not in the published package.
 */
export const COMPONENT_EXAMPLES = {
  TreeOfLife,
  GradeTree,
  GdHall,
  Lamen,
  RoseSigil,
  SevenBranchedCandleStick,
  TableOfShewbread,
  FylfotCross,
  Tablet,
  Kamea,
  PlanetarySpirit,
  Chakras,
  Moon,
  Mercury,
} as const satisfies Record<string, ComponentExamples>;

/** A component's name in the explorer. */
export type ComponentName = keyof typeof COMPONENT_EXAMPLES;
