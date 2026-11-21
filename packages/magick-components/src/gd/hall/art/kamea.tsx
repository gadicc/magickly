import { KameaFigure } from "../../../astrology/Kamea.tsx";
import {
  PLANETARY_SEAL_BASIS,
  PLANETARY_SEAL_SOURCE,
  PlanetarySealFigure,
} from "../../../astrology/PlanetarySeal.tsx";
import { enumAttr } from "../attributes.ts";
import { GD_HALL_FONT_STACKS } from "../fonts.ts";
import {
  HALL_KAMEA_PLANET_IDS,
  HALL_PLANETS,
  type HallPlanet,
} from "../planets.ts";
import type {
  HallArt,
  HallArtProps,
  HallAttrSpec,
  HallNode,
} from "../types.ts";
import { original, PALETTE, publicDomain, variantOf } from "./shared.ts";

export const kameaProvenance = original(
  "A planet's magic square drawn from its numbers, which magick-data " +
    "computes (astrology/kameas): the shared Kamea component's figure, a " +
    "grid with each number in its cell.",
);

/**
 * The `seal` art's provenance: the shared PlanetarySeal component's
 * seals, drawn after Agrippa's woodcuts (1533), on the silver plate. The
 * plate is our reading of the chapter's text (leaf n162), which says each
 * planet's table, with its characters, is engraved on silver; the
 * woodcuts themselves draw the seals on the bare page.
 */
export const sealProvenance = publicDomain(
  "A planet's seal drawn from geometry after Agrippa's woodcut, the " +
    "shared PlanetarySeal component's figure, on a silver plate (plan 061, " +
    "stage H, part 2; plan 093, stage K5).",
  { source: PLANETARY_SEAL_SOURCE, basis: PLANETARY_SEAL_BASIS },
);

/** Every art module exports its provenance; these two share a module. */
export const provenance = [kameaProvenance, sealProvenance];

/** `planet`: one of the seven. */
export const PLANET_SPEC: HallAttrSpec = { kind: "enum", values: HALL_PLANETS };

const planetOf = (node: HallNode): HallPlanet | undefined =>
  enumAttr(node, "planet", HALL_PLANETS);

/**
 * The shared `KameaFigure` in the hall's fonts and palette. Its square is
 * 96 units across, inside the art's 100 × 100 box.
 */
function Kamea({ node }: HallArtProps) {
  const planet = planetOf(node);
  return (
    <KameaFigure
      planet={planet && HALL_KAMEA_PLANET_IDS.get(planet)}
      fontFamily={GD_HALL_FONT_STACKS.serif}
      paper={PALETTE.paper}
      ink={PALETTE.ink}
    />
  );
}

/**
 * A planet's kamea (`kamea(planet="moon")`), 100 × 100: the square of
 * its order, Saturn 3 × 3 to the Moon 9 × 9. Without a planet, an empty
 * frame.
 */
export const kameaArt: HallArt = {
  Component: Kamea,
  box: { width: 100, height: 100 },
  attributes: new Map([["planet", PLANET_SPEC]]),
  // One of seven squares, or the empty frame.
  variant: (node) => variantOf(planetOf(node)),
  provenance: kameaProvenance,
};

/**
 * The shared `PlanetarySealFigure` on the hall's silver plate, in its
 * palette. Without a planet, a dashed ring, as the kamea draws an empty
 * frame.
 */
function Seal({ node }: HallArtProps) {
  const planet = planetOf(node);
  if (planet)
    return (
      <PlanetarySealFigure
        planet={HALL_KAMEA_PLANET_IDS.get(planet)}
        look="plate"
        plate={PALETTE.silver}
        ink={PALETTE.ink}
      />
    );
  return (
    <>
      <circle
        r={47}
        fill={PALETTE.paper}
        stroke={PALETTE.placeholder}
        strokeWidth={2.5}
        strokeDasharray="7 5"
      />
      <circle r={39} fill="none" stroke={PALETTE.placeholder} strokeWidth={1} />
    </>
  );
}

/**
 * A planet's seals (`seal(planet="moon")`), 100 × 100: its seal after
 * Agrippa on a silver plate (`astrology/PlanetarySeal`). Without a planet,
 * a dashed ring.
 */
export const sealArt: HallArt = {
  Component: Seal,
  box: { width: 100, height: 100 },
  attributes: new Map([["planet", PLANET_SPEC]]),
  variant: (node) => variantOf(planetOf(node)),
  provenance: sealProvenance,
};
