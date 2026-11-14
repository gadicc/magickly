"use client";
import lune from "lune";
import { cssString } from "../cssString.ts";
import useHydrated from "../hooks/useHydrated.ts";
import { Moon } from "./Moon.tsx";

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

/** Props of the Moon widget. */
export interface MoonWidgetProps {
  /** Space around the drawing, inside the background, as CSS `padding`. */
  padding?: string;
  /**
   * The viewer's latitude in degrees, south negative: south of the
   * equator, the moon is drawn turned as it is seen from there.
   */
  latitude?: number;
  /** The widget's background image, a URL, drawn to cover; none if omitted. */
  background?: string;
}

// magick.ly passes the reader's place as `latitude` (plan 072).
/**
 * Today's moon in a tile, with its phase's name: `Moon` drawn as it looks
 * from the viewer's hemisphere, as from the north unless `latitude` puts
 * the viewer south of the equator. The phase is worked out in the
 * browser, so the server's HTML draws the unlit disc.
 */
export function MoonWidget({
  padding = "10px 0 2px 0",
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
      <div style={{ padding: padding }}>
        <Moon
          phase={phaseValue}
          height="85"
          hemisphere={northernHemisphere ? "north" : "south"}
        />
      </div>
      <div style={{ color: "#cc5" }}>{phaseNameLocal}</div>
    </div>
  );
}

export default MoonWidget;
