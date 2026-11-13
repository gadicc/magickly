"use client";
import lune from "lune";

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
        <filter id="glow">
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
        style={{ fill: "white", filter: "url(#glow)" }}
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
}: {
  moonPadding?: string;
  latitude?: number;
}) {
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
        background: "url(/night-sky.jpg)",
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
