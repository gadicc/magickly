"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ComponentName } from "./components";

/**
 * Each component the explorer draws live, loaded on its own page only: a
 * page imports one chunk, so `nlopt-js` loads on the sigil's page and
 * `astronomy-engine` on Mercury's, and nowhere else (plan 080, the note
 * under the stages). Each is still rendered on the server, so the page's
 * HTML has the first example's drawing. A test holds each import to the
 * entry its example module names.
 */
// biome-ignore lint/suspicious/noExplicitAny: the explorer passes each its own props
export const LIVE: Record<ComponentName, ComponentType<any>> = {
  TreeOfLife: dynamic(() => import("magick-components/kabbalah/TreeOfLife")),
  GradeTree: dynamic(() => import("magick-components/gd/GradeTree")),
  GdHall: dynamic(() =>
    import("magick-components/gd/hall/GdHall").then((module) => module.GdHall),
  ),
  Lamen: dynamic(() => import("magick-components/gd/Lamen")),
  RoseSigil: dynamic(() => import("magick-components/gd/RoseSigil")),
  SevenBranchedCandleStick: dynamic(
    () => import("magick-components/gd/SevenBranchedCandleStick"),
  ),
  TableOfShewbread: dynamic(
    () => import("magick-components/gd/TableOfShewbread"),
  ),
  FylfotCross: dynamic(
    () => import("magick-components/gd/symbols/fylfot-cross"),
  ),
  Tablet: dynamic(() => import("magick-components/enochian/Tablet")),
  Kamea: dynamic(() => import("magick-components/astrology/Kamea")),
  PlanetarySpirit: dynamic(
    () => import("magick-components/astrology/planetarySpirits"),
  ),
  Chakras: dynamic(() => import("magick-components/chakras/Chakras")),
  Moon: dynamic(() => import("magick-components/astrology/Moon")),
  Mercury: dynamic(() => import("magick-components/astrology/Mercury")),
};
