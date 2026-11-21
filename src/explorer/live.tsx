"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ComponentName } from "./components";

/**
 * Each component the explorer draws live, loaded on its own page only: a
 * page imports one chunk, so `astronomy-engine` loads on Mercury's page
 * and nowhere else (plan 080, the note under the stages; the sigil's
 * `nlopt-js` left with its optimiser, plan 088). Each is still rendered on the server, so the page's
 * HTML has the first example's drawing. A test holds each import to the
 * entry its example module names.
 */
// biome-ignore lint/suspicious/noExplicitAny: the explorer passes each its own props
export const LIVE: Record<ComponentName, ComponentType<any>> = {
  TreeOfLife: dynamic(() => import("magick-components/kabbalah/TreeOfLife")),
  GradeTree: dynamic(() => import("magick-components/gd/GradeTree")),
  GdHall: dynamic(() => import("magick-components/gd/hall")),
  Lamen: dynamic(() => import("magick-components/gd/Lamen")),
  RoseSigil: dynamic(() => import("magick-components/gd/RoseSigil")),
  SevenBranchedCandlestick: dynamic(
    () => import("magick-components/gd/SevenBranchedCandlestick"),
  ),
  TableOfShewbread: dynamic(
    () => import("magick-components/gd/TableOfShewbread"),
  ),
  FylfotCross: dynamic(() => import("magick-components/gd/FylfotCross")),
  Tablet: dynamic(() => import("magick-components/enochian/Tablet")),
  Kamea: dynamic(() => import("magick-components/astrology/Kamea")),
  // Placed off the main thread after each edit (LiveKameaSigil.tsx).
  KameaSigil: dynamic(() => import("./LiveKameaSigil")),
  PlanetarySeal: dynamic(
    () => import("magick-components/astrology/PlanetarySeal"),
  ),
  PlanetarySpirit: dynamic(
    () => import("magick-components/astrology/PlanetarySpirit"),
  ),
  Chakras: dynamic(() => import("magick-components/chakras/Chakras")),
  Moon: dynamic(() => import("magick-components/astrology/Moon")),
  MoonWidget: dynamic(() => import("magick-components/astrology/MoonWidget")),
  MercuryWidget: dynamic(
    () => import("magick-components/astrology/MercuryWidget"),
  ),
};
