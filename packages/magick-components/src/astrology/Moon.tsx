/*!
 * The unlit disc's path is adapted from phase_junk() in moon-phase.js:
 * https://github.com/tingletech/moon-phase/blob/643015a83509ca6a662d1af6e1ac14661852cedb/moon-phase.js
 * Copyright (c) 2012, Regents of the University of California.
 * All rights reserved. Used under the BSD 3-Clause License, whose
 * conditions and disclaimer are in this package's LICENSE.txt; this file
 * is under that licence as well as MIT.
 */
import lune from "lune";
import { useId } from "react";
import { MOON_MEAN_INCLINATION, moonPath } from "./moonPath.ts";

/** Props of `Moon`. */
export interface MoonProps {
  /**
   * The day whose phase to draw, worked out by `lune`. `phase`, when
   * given, wins.
   */
  date?: Date;
  /**
   * The phase to draw, from 0 to 1 as `lune` gives it: 0 and 1 are new,
   * 0.5 full. With neither this nor `date`, only the unlit disc is drawn.
   */
  phase?: number;
  /** The SVG's width; from the height and the drawing's shape when not given. */
  width?: string | number;
  /** The SVG's height; from the width and the drawing's shape when not given. */
  height?: string | number;
  /**
   * The hemisphere it is seen from, which turns the Moon as it looks from
   * there: `north` by default.
   */
  hemisphere?: "north" | "south";
}

/**
 * The Moon in a phase, lit in gold on its unlit disc with a soft glow,
 * turned as it looks from either hemisphere: a phase you give, or a
 * date's. It needs no browser, so it renders on the server; today's phase
 * is a date the page knows. Its glow's id comes from `useId`, so several
 * can share a page.
 */
export function Moon({
  date,
  phase,
  width,
  height,
  hemisphere = "north",
}: MoonProps) {
  const drawn =
    phase ?? (date === undefined ? undefined : lune.phase(date).phase);
  const inclination =
    hemisphere === "south"
      ? 180 - MOON_MEAN_INCLINATION
      : MOON_MEAN_INCLINATION;
  // Its own glow filter, so that two moons on a page do not share an id.
  const glow = `moon-glow-${useId().replace(/[^A-Za-z0-9_-]/g, "_")}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      viewBox="0 0 170 162"
      width={width}
      height={height}
      transform={`rotate(${inclination})`}
    >
      <defs>
        <filter id={glow}>
          <feGaussianBlur stdDeviation="5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        className="back"
        d="m85,5 a20,20 0 1,1 0,150 a20,20 0 1,1 0,-150"
        style={{ fill: "white", filter: `url(#${glow})` }}
      />
      <path
        className="back"
        d="m85,5 a20,20 0 1,1 0,150 a20,20 0 1,1 0,-150"
        style={{ fill: "black" }}
      />
      {drawn === undefined ? null : (
        <path
          className="moon"
          d={moonPath(drawn)}
          style={{ fill: "#ebc815" }}
        />
      )}
    </svg>
  );
}

export default Moon;
