import { KameaFigure } from "../../../astrology/Kamea";
import { svgCoordinate } from "../../../svgCoordinate";
import { enumAttr } from "../attributes";
import { GD_HALL_FONT_STACKS } from "../fonts";
import { wrapText } from "../labels";
import {
  KAMEA_PLANET_IDS,
  PLANET_NAMES,
  PLANETS,
  type Planet,
} from "../planets";
import type { HallArt, HallArtProps, HallAttrSpec, HallNode } from "../types";
import { original, PALETTE, variantOf } from "./shared";

export const kameaProvenance = original(
  "A planet's magic square drawn from its numbers, which magick-data " +
    "computes (astrology/kameas): the shared Kamea component's figure, a " +
    "grid with each number in its cell.",
);
export const sealProvenance = original(
  "A placeholder for a planet's seals: a dashed ring naming the planet. " +
    "The seals themselves are to be drawn (plan 061, stage H).",
);

/** Every art module exports its provenance; these two share a module. */
export const provenance = [kameaProvenance, sealProvenance];

/** `planet`: one of the seven. */
export const PLANET_SPEC: HallAttrSpec = { kind: "enum", values: PLANETS };

const planetOf = (node: HallNode): Planet | undefined =>
  enumAttr(node, "planet", PLANETS);

/**
 * The shared `KameaFigure` in the hall's fonts and palette. Its square is
 * 96 units across, inside the art's 100 × 100 box.
 */
function Kamea({ node }: HallArtProps) {
  const planet = planetOf(node);
  return (
    <KameaFigure
      planet={planet && KAMEA_PLANET_IDS.get(planet)}
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

const SEAL_SIZE = 13;
const SEAL_WIDTH = 64;

function Seal({ node }: HallArtProps) {
  const planet = planetOf(node);
  const name = planet && PLANET_NAMES.get(planet);
  const lines = name ? wrapText(`Seals of ${name}`, SEAL_WIDTH, SEAL_SIZE) : [];
  const advance = SEAL_SIZE * 1.2;
  const first = SEAL_SIZE * 0.36 - ((lines.length - 1) * advance) / 2;
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
      <g
        fill={PALETTE.placeholder}
        fontFamily={GD_HALL_FONT_STACKS.serif}
        fontStyle="italic"
        fontSize={SEAL_SIZE}
        textAnchor="middle"
        style={{ fontVariantLigatures: "none", fontKerning: "normal" }}
      >
        {lines.map((line, index) => (
          <text
            // biome-ignore lint/suspicious/noArrayIndexKey: lines keep their order
            key={index}
            y={svgCoordinate(first + index * advance)}
          >
            {line.text}
          </text>
        ))}
      </g>
    </>
  );
}

/**
 * A planet's seals (`seal(planet="moon")`), 100 × 100. A placeholder
 * until the seals are drawn: a dashed ring with "Seals of Luna" in it.
 */
export const sealArt: HallArt = {
  Component: Seal,
  box: { width: 100, height: 100 },
  attributes: new Map([["planet", PLANET_SPEC]]),
  variant: (node) => variantOf(planetOf(node)),
  provenance: sealProvenance,
};
