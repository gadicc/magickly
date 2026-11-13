"use client";
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
import { cssString } from "../cssString.ts";
import useHydrated from "../hooks/useHydrated.ts";
import { moonMeanInclination, moonPath } from "./moonPath.ts";

function moonPhaseName(phase: number) {
  if (phase === 0.5) return "full-moon";

  if (phase > 0.5) {
    if (phase === 0.75) return "last-quarter";
    if (phase > 0.75) return "waning-crescent";
    return "waning-gibbous";
  } else {
    if (phase === 0) return "new-moon";
    if (phase === 0.25) return "first-quarter";
    if (phase > 0.25) return "waxing-gibbous";
    return "waxing-crescent";
  }
}

const namesLocal = {
  en: {
    "new-moon": "New Moon",
    "waxing-crescent": "Waxing Crescent",
    "first-quarter": "First Quarter",
    "waxing-gibbous": "Waxing Gibbous",
    "full-moon": "Full Moon",
    "waning-gibbous": "Waning Gibbous",
    "last-quarter": "Last Quarter",
    "waning-crescent": "Waning Crescent",
  },
};

function MoonDrawing({
  phase,
  width,
  height,
  northernHemisphere = true,
}: {
  /** Omit to draw only the unlit disc. */
  phase?: number;
  width?: string | number;
  height?: string | number;
  northernHemisphere?: boolean;
}) {
  const inclination = northernHemisphere
    ? moonMeanInclination
    : 180 - moonMeanInclination;
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
      {phase === undefined ? null : (
        <path
          className="moon"
          d={moonPath(phase)}
          style={{ fill: "#ebc815" }}
        />
      )}
    </svg>
  );
}

/** Props of the Moon widget. */
export interface MoonWidgetProps {
  /** CSS padding around the drawing, inside the night sky. */
  moonPadding?: string;
  /**
   * The viewer's latitude in degrees, south negative: south of the
   * equator, the moon is drawn turned as it is seen from there.
   */
  latitude?: number;
  /** The widget's background image, a URL, drawn to cover; none if omitted. */
  background?: string;
}

/**
 * Today's moon, drawn as it looks from the viewer's hemisphere.
 *
 * `latitude` is the viewer's, when known (the app passes the reader's place,
 * plan 072); the moon is drawn as from the north until it is known to be
 * south of the equator.
 */
function MoonWidget({
  moonPadding = "10px 0 2px 0",
  latitude,
  background,
}: MoonWidgetProps) {
  // Pages with this widget are prerendered at build time, so the server can't
  // know today's phase. Hydrate with the unlit disc, then draw the phase.
  const hydrated = useHydrated();
  const phaseValue = hydrated ? lune.phase(new Date()).phase : undefined;
  const phaseNameLocal =
    phaseValue === undefined
      ? "\u00a0" // keeps the label's line height
      : namesLocal.en[moonPhaseName(phaseValue)];

  // Northern (and the equator) unless the place is known to be south.
  const northernHemisphere = latitude === undefined || latitude >= 0;

  return (
    <div
      style={{
        textAlign: "center",
        background: background ? `url(${cssString(background)})` : undefined,
        backgroundSize: "cover",
        height: "100%",
      }}
    >
      <div style={{ padding: moonPadding }}>
        <MoonDrawing
          phase={phaseValue}
          height="85"
          northernHemisphere={northernHemisphere}
        />
      </div>
      <div style={{ color: "#cc5" }}>{phaseNameLocal}</div>
    </div>
  );
}

export default MoonWidget;
