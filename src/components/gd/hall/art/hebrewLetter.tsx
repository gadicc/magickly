import { stringAttr } from "../attributes";
import { GD_HALL_FONT_STACKS } from "../fonts";
import { hebrewLetter } from "../hebrewLetters";
import type { HallArt, HallArtProps } from "../types";
import { pennantPath, Rod } from "./banner";
import { original, PALETTE } from "./shared";

export const provenance = {
  ...original(
    "Redrawn after Gadi Cohen's letter banners in public/pics/zelator1.svg " +
      "and theoricus1.svg: a light pennant on a rod with knobs, the letter " +
      "set in Noto Serif Hebrew Bold (SIL OFL 1.1) by the browser; no glyph " +
      "outlines are copied into the code.",
  ),
  source: "public/pics/zelator1.svg",
};

const TOP = -38;

function HebrewLetter({ node, defId }: HallArtProps) {
  const name = stringAttr(node, "letter", 40);
  const letter = name === undefined ? undefined : hebrewLetter(name);
  const fill = defId("fill");
  return (
    <>
      <defs>
        <linearGradient
          id={fill}
          x1={-38}
          x2={38}
          y1={0}
          y2={0}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset={0} stopColor={PALETTE.bannerLightFrom} />
          <stop offset={1} stopColor={PALETTE.bannerLightTo} />
        </linearGradient>
      </defs>
      <Rod y={TOP} />
      <path
        d={pennantPath(TOP, 26, 45)}
        fill={`url(#${fill})`}
        stroke={PALETTE.ink}
        strokeWidth={0.8}
      />
      {letter && (
        <text
          x={0}
          y={21}
          fontSize={62}
          fontFamily={GD_HALL_FONT_STACKS.hebrew}
          fontWeight={700}
          textAnchor="middle"
          fill={PALETTE.ink}
        >
          {letter}
        </text>
      )}
    </>
  );
}

/** A Hebrew-letter banner, 100 × 92 units. */
export const hebrewLetterArt: HallArt = {
  Component: HebrewLetter,
  box: { width: 100, height: 92 },
  provenance,
};
