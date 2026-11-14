import { assemble } from "magick-data/assemble";
import planetRows, { type PlanetId } from "magick-data/astrology/planets";
import hebrewLetterRows from "magick-data/hebrewLetters";
import archangelRows from "magick-data/kabbalah/archangels";
import sephirahRows from "magick-data/kabbalah/sephirot";
import React from "react";
import {
  archiveLeaf,
  type DrawingSource,
  type DrawingVersionNote,
} from "../drawingVersions.ts";
import { svgCoordinate } from "../svgCoordinate.ts";

/**
 * The planets with their archangels and letters joined, and the sephirot
 * whose archangels the 1909 figure gives: the four tables the lamps read,
 * rather than the whole barrel.
 */
const data = assemble({
  planet: planetRows,
  archangel: archangelRows,
  hebrewLetter: hebrewLetterRows,
  sephirah: sephirahRows,
});

/**
 * The versions of the candlestick: the figure of *The Equinox* I(2)
 * (1909), Diagram 17 (`equinox1909`, the default), and the arrangement
 * of recent editions of Regardie (`modern`), which this package drew
 * alone until 14 November 2026. A new version is a new id; neither of
 * these moves.
 */
export const CANDLESTICK_VERSIONS = ["equinox1909", "modern"] as const;

/** A version of the candlestick. */
export type CandlestickVersionId = (typeof CANDLESTICK_VERSIONS)[number];

/** The version the candlestick is drawn in unless another is asked for. */
export const DEFAULT_CANDLESTICK_VERSION: CandlestickVersionId = "equinox1909";

/** A version by its id, or the default for anything that is none. */
function versionOf(version: string | undefined): CandlestickVersionId {
  return (CANDLESTICK_VERSIONS as readonly string[]).includes(version ?? "")
    ? (version as CandlestickVersionId)
    : DEFAULT_CANDLESTICK_VERSION;
}

/** One version of the candlestick: its name, its note and its sources. */
export type CandlestickVersionNote = DrawingVersionNote<CandlestickVersionId>;

export type { DrawingSource };

/** Each version's note, by its id. */
export const CANDLESTICK_VERSION_NOTES: Readonly<
  Record<CandlestickVersionId, CandlestickVersionNote>
> = {
  equinox1909: {
    id: "equinox1909",
    title: "Equinox 1909",
    text:
      "This is the figure printed in The Equinox I(2) (1909), p. 265, " +
      "Diagram 17, from the Zelator ritual as Crowley received it. Each " +
      "lamp bears a double letter, the Hebrew name of its planet, the " +
      "archangel of that planet's Sephirah and one of the seven churches " +
      "of Asia, and the lines of the star pass through the planets from " +
      "Saturn down to the Moon. Taking every second lamp round the circle " +
      "gives the days of the week.",
    sources: [
      {
        text:
          "The Equinox, vol. I no. 2 (London, 1909), Diagram 17, p. 265 " +
          "(archive.org leaf n266)",
        url: archiveLeaf(
          "crowley-equinox_202110",
          266,
          "The Equinox Vol. 1, No. 2",
        ),
      },
    ],
  },
  modern: {
    id: "modern",
    title: "Modern",
    text:
      "This arrangement appears in recent editions of Regardie's The " +
      "Golden Dawn; his text of 1938 (vol. 2, p. 62) describes the lamps " +
      "but does not say which planet goes where. The planets stand in the " +
      "order of the double letters on the Rose of 22 petals, with " +
      "Agrippa's planetary angels in place of the archangels of the " +
      "Sephiroth, and the triangles point inward. Unlike the 1909 figure, " +
      "its star does not trace the days of the week, and it leaves out " +
      "the churches and the central lamp.",
    sources: [
      {
        text:
          "Israel Regardie, The Golden Dawn, vol. 2 (Aries Press, Chicago, " +
          "1938), p. 62 (archive.org leaf n56), for the lamps",
        url: archiveLeaf("IsraelRegardie-TheGoldenDawn-Vol2-1938", 56),
      },
      {
        text:
          "Israel Regardie, The Golden Dawn (Llewellyn, 2015 edition), " +
          "for the order, a fact only; nothing of it is copied",
      },
    ],
  },
};

interface Point {
  x: number;
  y: number;
}

function degreesToPointOnCircle(
  degrees: number,
  radius: number,
  center: Point = { x: 0, y: 0 },
): Point {
  const radians = (degrees * Math.PI) / 180;
  // console.log(degrees, radians);
  return {
    x: radius * Math.cos(radians) + center.x,
    y: radius * Math.sin(radians) + center.y,
  };
}

/*
const branches: PlanetId[] = [
  "sol",
  "mars",
  "jupiter",
  "saturn",
  "luna",
  "mercury",
  "venus",
];
*/

/**
 * Each version's seven lamps, clockwise from the top; the image's inputs
 * name these rows.
 */
export const CANDLESTICK_PLANETS: Readonly<
  Record<CandlestickVersionId, readonly PlanetId[]>
> = {
  // Diagram 17: Saturn at the top, then Mars, Venus, the Moon, Jupiter,
  // the Sun and Mercury, so that the star, from Saturn, runs Saturn,
  // Jupiter, Mars, Sun, Venus, Mercury, Moon (the Chaldean order), and
  // every second lamp backwards from the Sun gives the week.
  equinox1909: ["saturn", "mars", "venus", "luna", "jupiter", "sol", "mercury"],
  modern: ["venus", "mercury", "sol", "mars", "jupiter", "saturn", "luna"],
};

const branches: readonly PlanetId[] = CANDLESTICK_PLANETS.modern;

function Branch({ index, idPrefix }: { index: number; idPrefix: string }) {
  const radius = 7.4; // TODO, work it out properly
  const center = degreesToPointOnCircle((index * 360) / 7 - 90, 25 + radius);

  const planetId = branches[index];
  const planet = data.planet[planetId];
  // console.log(planet);
  const texts = [
    planet.archangel?.name.he,
    planet.hebrewLetter?.letter?.he,
    planet.name.he?.he,
  ];

  // With extend radius so text is offset from the side of the triangle
  const textPaths = [
    [
      degreesToPointOnCircle(90, radius + 1, center),
      degreesToPointOnCircle(90 + 360 / 3, radius + 1, center),
    ],

    [
      // Extend the radius even further so text path (which is on the
      // bottom side of the text) still fits the top of the text below
      // the triangle.
      degreesToPointOnCircle(90 + (360 / 3) * 2, radius + 4.5, center),
      degreesToPointOnCircle(90 + 360 / 3, radius + 4.5, center),
    ],

    [
      degreesToPointOnCircle(90 + (360 / 3) * 2, radius + 1, center),
      degreesToPointOnCircle(90, radius + 1, center),
    ],
  ];
  const bottom = degreesToPointOnCircle(90, radius - 0.4, center);
  const topLeft = degreesToPointOnCircle(90 + 360 / 3, radius - 0.4, center);
  const topRight = degreesToPointOnCircle(
    90 + (360 / 3) * 2,
    radius - 0.4,
    center,
  );
  const rotation = (360 / 7) * index;

  return (
    <g transform={`rotate(${rotation} ${center.x} ${center.y})`}>
      <circle
        cx={center.x}
        cy={center.y}
        r={radius}
        fill="none"
        stroke="black"
        strokeWidth="0.5"
      />
      <path
        d={`M ${bottom.x} ${bottom.y} L ${topLeft.x} ${topLeft.y} L ${topRight.x} ${topRight.y} L ${bottom.x} ${bottom.y}`}
        fill="none"
        stroke="black"
        strokeWidth="0.5"
      />

      <text
        x={center.x}
        y={center.y}
        transform={`rotate(180 ${center.x} ${center.y})`}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="4"
        fontWeight="bold"
      >
        {planet.symbol}
      </text>

      {texts.map((text, i) => (
        <g key={i}>
          <path
            id={`${idPrefix}-path-${index}-l${i}`}
            d={`M ${textPaths[i][0].x} ${textPaths[i][0].y} L ${textPaths[i][1].x} ${textPaths[i][1].y}`}
            fill="none"
            stroke="none"
          ></path>
          <text>
            <textPath
              fontSize="3"
              href={`#${idPrefix}-path-${index}-l${i}`}
              textAnchor="middle"
              startOffset="50%"
            >
              {texts[i]}
            </textPath>
          </text>
        </g>
      ))}
    </g>
  );
}

/**
 * The seven churches of Asia (Revelation 1:11) on Diagram 17's lamps, by
 * planet, as the figure names them. magick-data has no table of them.
 */
const CHURCHES: Readonly<Record<string, string>> = {
  saturn: "Ephesus",
  mars: "Pergamos",
  venus: "Thyatira",
  luna: "Laodicea",
  jupiter: "Philadelphia",
  sol: "Smyrna",
  mercury: "Sardis",
};

/** Hebrew without its points, as the figure writes every name. */
const unpointed = (text: string | undefined) =>
  text?.replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, "");

/** "x y", each rounded as the package writes coordinates. */
const pair = (point: Point) =>
  `${svgCoordinate(point.x)} ${svgCoordinate(point.y)}`;

// Diagram 17's proportions in the 100 × 100 viewBox, kept within the
// modern drawing's outer circle (r 40), which the halls' disc fills.
/** The lamps' centres lie on this circle. */
const LAMP_RING = 29;
/** Each lamp's radius. */
const LAMP = 10.5;
/** The circle through the triangle's corners, inside its lamp. */
const TRIANGLE = LAMP - 0.8;
/** The star's points touch the lamps, as in the figure. */
const STAR = LAMP_RING - LAMP;
/** The central lamp, inside the star's innermost lines. */
const CENTRAL_LAMP = 3.4;
/** How far out along its arm each planet's symbol stands. */
const SYMBOL_AT = STAR * 0.55;

/** A lamp's direction from the centre: clockwise from the top. */
const lampAngle = (index: number) => (index * 360) / 7 - 90;

/**
 * One lamp of Diagram 17, drawn as if it stood at the top and turned to
 * its place, as the figure turns each lamp: the triangle with its apex
 * outward, the double letter inside it, the planet's Hebrew name along
 * its left side and the archangel of the planet's Sephirah along its
 * right, and the church's name under its base.
 *
 * Where the figure departs from Regardie's text of 1938 (vol. 2, p. 62),
 * which puts the archangel on the triangle's right, the sphere's name on
 * its left and the letter beneath the base, this follows the figure: the
 * letter is inside, and the church's name beneath. The figure's Mars lamp
 * has its two names the other way about, alone of the seven; it is drawn
 * here as the other six and the text have them. The names are
 * magick-data's, without points; where its spelling differs from the
 * figure's (נגה for נוגה, חמאל for כמאל, הניאל for האניאל) it is kept.
 */
function Lamp1909({ index, idPrefix }: { index: number; idPrefix: string }) {
  const planetId = CANDLESTICK_PLANETS.equinox1909[index];
  const planet = data.planet[planetId];
  const sephirah = Object.values(data.sephirah).find(
    (row) => row.planetId === planetId,
  );
  const center = degreesToPointOnCircle(lampAngle(index), LAMP_RING);
  // Corners and text lines, before the turn: up is away from the centre.
  const corner = (degrees: number, radius = TRIANGLE) =>
    degreesToPointOnCircle(degrees, radius, center);
  const apex = corner(270);
  const left = corner(150);
  const right = corner(30);
  const along = TRIANGLE + 1.6;
  const sides = [
    // The sphere's name, read up the left side; the archangel's, down
    // the right; each outside its side.
    [unpointed(planet.name.he?.he), corner(150, along), corner(270, along)],
    [
      unpointed(sephirah?.archangel?.name.he),
      corner(270, along),
      corner(30, along),
    ],
  ] as const;
  const x = svgCoordinate(center.x);
  const y = svgCoordinate(center.y);

  return (
    <g transform={`rotate(${svgCoordinate((index * 360) / 7)} ${x} ${y})`}>
      <circle
        cx={x}
        cy={y}
        r={LAMP}
        fill="none"
        stroke="black"
        strokeWidth="0.5"
      />
      <path
        d={`M ${pair(apex)} L ${pair(left)} L ${pair(right)} Z`}
        fill="none"
        stroke="black"
        strokeWidth="0.5"
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="5"
        fontWeight="bold"
      >
        {planet.hebrewLetter?.letter?.he}
      </text>
      {sides.map(([text, from, to], side) => (
        <g key={from.x}>
          <path
            id={`${idPrefix}-path-${index}-l${side}`}
            d={`M ${pair(from)} L ${pair(to)}`}
            fill="none"
            stroke="none"
          />
          <text>
            <textPath
              fontSize="3"
              href={`#${idPrefix}-path-${index}-l${side}`}
              textAnchor="middle"
              startOffset="50%"
            >
              {text}
            </textPath>
          </text>
        </g>
      ))}
      <text
        x={x}
        y={svgCoordinate(center.y + TRIANGLE / 2 + 2.6)}
        textAnchor="middle"
        fontSize="2.3"
      >
        {CHURCHES[planetId]}
      </text>
    </g>
  );
}

/**
 * Diagram 17 of *The Equinox* I(2) (1909): seven lamps about a central
 * one, joined by a heptagram whose lines run through the planets in the
 * Chaldean order, each planet's symbol on its arm.
 */
function Equinox1909({
  idPrefix,
  ref,
}: {
  idPrefix: string;
  ref?: React.Ref<SVGSVGElement>;
}) {
  // The star from Saturn, three lamps on each time: Saturn, Jupiter,
  // Mars, the Sun, Venus, Mercury, the Moon, and back.
  const star = [0, 4, 1, 5, 2, 6, 3]
    .map((i) => pair(degreesToPointOnCircle(lampAngle(i), STAR)))
    .join(" L ");
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      viewBox="-50 -50 100 100"
      ref={ref}
    >
      <path d={`M ${star} Z`} fill="none" stroke="black" strokeWidth=".5" />
      <circle
        cx="0"
        cy="0"
        r={CENTRAL_LAMP}
        fill="none"
        stroke="black"
        strokeWidth=".5"
      />
      {CANDLESTICK_PLANETS.equinox1909.map((planetId, i) => {
        const at = degreesToPointOnCircle(lampAngle(i), SYMBOL_AT);
        return (
          <text
            key={planetId}
            x={svgCoordinate(at.x)}
            y={svgCoordinate(at.y)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="3.5"
          >
            {data.planet[planetId].symbol}
          </text>
        );
      })}
      {CANDLESTICK_PLANETS.equinox1909.map((planetId, i) => (
        <Lamp1909 key={planetId} index={i} idPrefix={idPrefix} />
      ))}
    </svg>
  );
}

/** Props of the diagram. */
export interface SevenBranchedCandlestickProps {
  /**
   * Which candlestick (`CANDLESTICK_VERSIONS`): the figure of *The
   * Equinox* I(2) (1909), Diagram 17 (`equinox1909`), when not given or
   * not a version, or the arrangement of recent editions (`modern`).
   * `CANDLESTICK_VERSION_NOTES` says where each comes from.
   */
  version?: CandlestickVersionId;
  /**
   * Prefixes the text paths' ids, which are document-wide: two of these
   * on one page need different prefixes. No hook makes one, so that the
   * component also renders where React's hooks are not available.
   */
  idPrefix?: string;
  /** The `<svg>`, for exporting the drawing. */
  ref?: React.Ref<SVGSVGElement>;
}

/**
 * The Golden Dawn's seven-branched candlestick, in a version (`version`):
 * by default the figure of *The Equinox* I(2) (1909), seven lamps about a
 * central one, each with its double letter, the planet's Hebrew name, the
 * archangel of its Sephirah and one of the seven churches, joined by a
 * heptagram in the Chaldean order; or the modern arrangement, a branch
 * for each planet with its symbol, Hebrew name, planetary angel and
 * letter, set about a heptagram.
 */
export function SevenBranchedCandlestick({
  version,
  idPrefix = "candlestick",
  ref,
}: SevenBranchedCandlestickProps) {
  return versionOf(version) === "modern" ? (
    <Modern idPrefix={idPrefix} ref={ref} />
  ) : (
    <Equinox1909 idPrefix={idPrefix} ref={ref} />
  );
}

/**
 * The modern arrangement, as this package drew it before the versions:
 * its markup is unchanged.
 */
function Modern({
  idPrefix,
  ref,
}: {
  idPrefix: string;
  ref?: React.Ref<SVGSVGElement>;
}) {
  const indexes = [0, 1, 2, 3, 4, 5, 6];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      viewBox="-50 -50 100 100"
      ref={ref}
    >
      <circle
        cx="0"
        cy="0"
        r="40"
        fill="none"
        stroke="black"
        strokeWidth=".5"
      />
      <circle
        cx="0"
        cy="0"
        r="25"
        fill="none"
        stroke="black"
        strokeWidth=".5"
      />

      {/* Heptagram */}
      {(function () {
        // Start from bottom left corner, to top, etc.
        const orderedIndexes = [4, 0, 3, 6, 2, 5, 1, 4];
        const d =
          "M " +
          orderedIndexes
            .concat([0])
            .map((i) => {
              const p = degreesToPointOnCircle(
                (i * 360) / indexes.length - 90,
                25,
              );
              return `${p.x} ${p.y}`;
            })
            .join(" L ");
        return <path d={d} fill="none" stroke="black" strokeWidth=".5" />;
      })()}

      {indexes.map((i) => (
        <Branch key={i} index={i} idPrefix={idPrefix} />
      ))}
    </svg>
  );
}

export default SevenBranchedCandlestick;
