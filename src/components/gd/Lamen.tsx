import type * as React from "react";
import { svgCoordinate } from "../svgCoordinate";
import { flipped, type Point, smoothPath } from "./hall/art/geometry";
import {
  CupOnOctagram,
  PortalHegemon,
  PortalHiereus,
  RoseCross,
  TriangleInPentagram,
} from "./lamenGlyphs";

/** The colours of a lamen with the Calvary cross of Tiphareth. */
interface CrossLamenColours {
  /** The outer ring: a colour, or `stripes` (red and white). */
  ring: string;
  /** The disc inside it. */
  disc: string;
  /** The cross; the ring's colour unless given. */
  cross?: string;
}

/**
 * Lamens bearing the Calvary cross, by officer. The Hierophant is not a
 * Temple Chief but has the Imperator's cross. Looked up in a `Map`, so an
 * officer name such as "constructor" is simply not found.
 *
 * The ring shows the officer's collar, by Gadi's own convention, so the
 * roles stay distinguishable even as 20 px ritual role icons: Imperator
 * red, Praemonstrator blue, Cancellarius yellow on a purple disc,
 * Hierophant red and white stripes, Past Hierophant white, every lamen
 * the same size. The sources differ: Regardie (*The Golden Dawn*) hangs
 * the Hierophant's lamen from a white collar, the Imperator's scarlet,
 * the Praemonstrator's blue and the Cancellarius' purple, and gives the
 * Past Hierophant only "a Jewel of that Lamen"; the Ciceros paint the
 * ring in the cross's colour and draw the Past Hierophant's lamen
 * smaller; red and white stripes are the Hierophant's nemyss in Zalewski
 * and in the Ciceros.
 *
 * Sources, by title, edition and page (plan 061, decision 9):
 * - Israel Regardie, *The Golden Dawn*, vol. 3 (Aries Press, 1939), Z.1:
 *   pp. 82–84, the Chiefs' lamens and collars and "a Jewel of that Lamen"
 *   for a Past Hierophant; pp. 88–90, the Hierophant's lamen on a white
 *   collar.
 * - Pat Zalewski, *Secret Teachings of the Golden Dawn, Book 1: The
 *   Neophyte Ritual 0=0* (Llewellyn, 1991): p. 76, the Hierophant's
 *   scarlet-and-white-striped nemyss; p. 78 (Fig. 26), the lamen drawn
 *   with an outer ring; p. 87, Whare Ra's white-field variant.
 * - Chic and Sandra Tabatha Cicero, *Secrets of a Golden Dawn Temple*
 *   (Thoth, 2004): pp. 80–81, the collars and the Past Hierophant's
 *   smaller lamen; pp. 96–97, the ring in the charge colour.
 */
const CROSS_LAMENS: ReadonlyMap<string, CrossLamenColours> = new Map([
  ["imperator", { ring: "red", disc: "green" }],
  ["praemonstrator", { ring: "#48f", disc: "orange" }],
  ["cancellarius", { ring: "yellow", disc: "#b5b" }],
  ["hierophant", { ring: "stripes", disc: "green", cross: "red" }],
  ["pastHierophant", { ring: "white", disc: "green", cross: "red" }],
]);

/** A lamen whose glyph is drawn in colour on the black disc. */
interface GlyphLamen {
  /** The collar's colour, as the ring shows it. */
  ring: string;
  /** The disc's colour; black unless given. */
  disc?: string;
  Glyph: () => React.ReactElement;
}

/**
 * The adepts' lamens, from the Portal's rubric (Regardie, *The Golden
 * Dawn*, vol. 2, Aries Press, 1938, p. 156; archive.org
 * `IsraelRegardie-TheGoldenDawn-Vol2-1938`, leaf n149): the Chief Adept's
 * Rose-Cross on a yellow collar, the Second Adept's red triangle in a
 * green pentagram on a white one, the Third Adept's blue cup on an orange
 * octagram on a blue one. The ring shows the collar, as for the Chiefs;
 * the Third Adept's blue is the Praemonstrator's. A hall of the 5=6 would
 * use the same role names, though every Adept there wears the Rose-Cross
 * (plan 061, stage H, part 2).
 */
const GLYPH_LAMENS: ReadonlyMap<string, GlyphLamen> = new Map([
  ["chiefAdept", { ring: "yellow", Glyph: RoseCross }],
  ["secondAdept", { ring: "white", Glyph: TriangleInPentagram }],
  ["thirdAdept", { ring: "#48f", Glyph: CupOnOctagram }],
]);

/**
 * The lamens an officer wears in a particular grade instead of the Outer
 * Order's, by `grade:officer` (`lamenGrades.ts`), from the Portal's
 * rubric (Regardie 1938, vol. 2, p.156, leaf n149). The Hiereus wears a
 * white hexagram on the four colours of Malkuth; the rubric gives him a
 * black collar and then "Red Shoes and Collar", and the ring takes the
 * red, which a black ring's outline would not show. The Hegemon wears a
 * red and blue hexagram on a white ground, on a yellow collar.
 */
const GRADE_LAMENS: ReadonlyMap<string, GlyphLamen> = new Map([
  ["portal:hiereus", { ring: "red", Glyph: PortalHiereus }],
  ["portal:hegemon", { ring: "yellow", disc: "white", Glyph: PortalHegemon }],
]);

/** The officers whose lamen `Lamen` draws; any other draws the same plain one. */
export const LAMEN_OFFICERS: ReadonlySet<string> = new Set([
  ...CROSS_LAMENS.keys(),
  ...GLYPH_LAMENS.keys(),
  "hegemon",
  "hiereus",
  "stolistes",
  "dadouchos",
  "keryx",
  "sentinel",
]);

/** The ring's outer radius, inside the −50…50 viewBox; the disc's is 42. */
const RING_RADIUS = 49;
/** Height of each of the Hierophant's ring stripes, in lamen units. */
const STRIPE = 8;

/**
 * The part of the ring's disc between heights `a` and `b`, as a path: the
 * two arcs of the circle and the chords joining them.
 */
function discSlab(a: number, b: number, r = RING_RADIUS) {
  const top = Math.max(a, -r);
  const bottom = Math.min(b, r);
  const half = (y: number) => +Math.sqrt(r * r - y * y).toFixed(3);
  const [xt, xb] = [half(top), half(bottom)];
  return `M${xt} ${top}A${r} ${r} 0 0 1 ${xb} ${bottom}H${-xb}A${r} ${r} 0 0 1 ${-xt} ${top}Z`;
}

/**
 * The white stripes of the Hierophant's ring, drawn over its red fill: a
 * red stripe is centred on the horizontal diameter, so the ring is
 * symmetric top to bottom (red, then white, every 8 units outward). Plain
 * geometry under the disc rather than a `<pattern>`, so the lamen defines
 * no ids and any number of them can share a page, inside a hall's `<defs>`
 * or in renderers without hooks.
 */
const RING_STRIPES = [1, 3, 5]
  .flatMap((n) => [
    discSlab((n - 0.5) * STRIPE, (n + 0.5) * STRIPE),
    discSlab(-(n + 0.5) * STRIPE, -(n - 0.5) * STRIPE),
  ])
  .join("");

const TipharethCalvaryCross = ({
  style,
  scale = 7.5,
}: {
  style?: React.CSSProperties;
  scale?: number;
}) => (
  <path
    d="M -1.1 -4.8 v.708a3.045 3.045 0 0 0-1.842 1.806h-.64v2.02h.601a3.045 3.045 0 0 0 1.881 1.91v3.134h2.02v-3.14a3.045 3.045 0 0 0 1.867-1.904h.615v-2.02h-.653a3.045 3.045 0 0 0-1.829-1.8v-.714zm2.02 1.256a2.534 2.534 0 0 1 1.285 1.258h-1.285zm-2.02 0v1.258h-1.292a2.534 2.534 0 0 1 1.292-1.257zm-1.334 3.278h1.334v1.361a2.534 2.534 0 0 1-1.334-1.36zm3.354 0h1.329a2.534 2.534 0 0 1-1.329 1.362z"
    style={{
      fill: "red",
      stroke: "black",
      strokeWidth: 1 / scale - 0.05,
      ...style,
    }}
    transform={"scale(" + scale + ")"}
  />
);

/**
 * The caduceus of the Keryx's lamen, drawn from geometry (plan 061, stage
 * H): a staff topped by a ball, two wings, and two serpents interlaced up
 * the staff, their heads facing each other below the ball. Each serpent
 * is `x = ±A·sin(2π·0.75·t)`, widening from the tail, through a smooth
 * curve: one crossing and two thick coils, which still read as a caduceus
 * at the 20 px of a role icon. Where one passes over the other it is drawn
 * again over a band of the disc's black, which makes the interlacing. One
 * colour, white on the black disc like every other lamen's glyph.
 */
const SERPENT_TURNS = 0.75;
const SERPENT_WIDTH = 9;
/** How high the serpents run: from the tail up to the necks, below the ball. */
const SERPENT_TAIL = 40;
const SERPENT_NECK = -12;
const SERPENT_SAMPLES = 16;

/** One serpent's centre line, tail (bottom) to head, `side` ±1. */
function serpentLine(side: 1 | -1): Point[] {
  const line: Point[] = [];
  for (let i = 0; i <= SERPENT_SAMPLES; i++) {
    const t = i / SERPENT_SAMPLES;
    const width = 19 * Math.min(1, 0.25 + t * 3);
    line.push([
      side * width * Math.sin(2 * Math.PI * SERPENT_TURNS * t),
      SERPENT_TAIL + (SERPENT_NECK - SERPENT_TAIL) * t,
    ]);
  }
  // The neck turns in towards the staff, the head facing the other's.
  const [x, y] = line[line.length - 1];
  line.push([x * 0.92, y - 4], [x * 0.62, y - 7]);
  return line;
}

/**
 * The stretches where a serpent passes over the other: around every other
 * crossing, which lie at t = k / (2 · turns), so the two take turns.
 */
function overStretches(side: 1 | -1): [number, number][] {
  const at = (t: number) =>
    Math.max(0, Math.min(SERPENT_SAMPLES, Math.round(t * SERPENT_SAMPLES)));
  const quarter = 1 / (4 * SERPENT_TURNS);
  const stretches: [number, number][] = [];
  for (let k = 1; k / (2 * SERPENT_TURNS) < 1; k++)
    if ((k % 2 === 1) === (side === 1)) {
      const t = k / (2 * SERPENT_TURNS);
      stretches.push([at(t - quarter), at(t + quarter)]);
    }
  return stretches;
}

const SERPENTS = ([1, -1] as const).map((side) => {
  const line = serpentLine(side);
  const [hx, hy] = line[line.length - 1];
  return {
    whole: smoothPath(line, 1),
    over: overStretches(side).map(([from, to]) => ({
      band: smoothPath(line.slice(from, to + 1), 1),
      body: smoothPath(line.slice(Math.max(0, from - 2), to + 3), 1),
    })),
    head: { cx: hx - side * 1.5, cy: hy - 0.8, angle: side * 18, hx, hy },
  };
});

/** Both serpents in one path: the over-stretches settle the crossings. */
const BOTH = SERPENTS.map(({ whole }) => whole).join("");

/** One wing (the right), from the ball out and up; flipped for the left. */
const WING =
  "M3,-37C9,-45 20,-50 33,-49C31,-46 29,-44.5 26,-43.5C28.5,-42 27,-39.5 " +
  "23,-39C24.5,-37 22.5,-35 18.5,-35C19.5,-33 16.5,-31.5 12.5,-32C10,-31 " +
  "6,-31.5 3,-33Z";
const WINGS = WING + flipped(WING);

/** The Keryx's caduceus, white on the black disc, in lamen units. */
function Caduceus() {
  const serpent = SERPENT_WIDTH;
  return (
    <g transform="translate(0 6) scale(0.66)" fill="white">
      <path d="M-3.4,-34H3.4V46A3.4,3.4 0 0 1 -3.4,46Z" />
      <path d={WINGS} transform="translate(0 -38) scale(1.3) translate(0 38)" />
      <circle cy={-38} r={7.5} />
      <g fill="none" strokeLinecap="round">
        <path d={BOTH} stroke="black" strokeWidth={serpent + 3.6} />
        <path d={BOTH} stroke="white" strokeWidth={serpent} />
        {SERPENTS.flatMap(({ over }) =>
          over.map(({ band, body }) => (
            <g key={band} strokeLinecap="butt">
              <path d={band} stroke="black" strokeWidth={serpent + 3.6} />
              <path d={body} stroke="white" strokeWidth={serpent} />
            </g>
          )),
        )}
      </g>
      {SERPENTS.map(({ head: { cx, cy, angle, hx, hy } }) => (
        <ellipse
          key={angle}
          cx={svgCoordinate(cx)}
          cy={svgCoordinate(cy)}
          rx={serpent * 0.95}
          ry={serpent * 0.7}
          transform={`rotate(${angle} ${svgCoordinate(hx)} ${svgCoordinate(hy)})`}
          stroke="black"
          strokeWidth={1.4}
        />
      ))}
    </g>
  );
}

/**
 * The Sentinel's Eye of Horus (the wedjat), drawn from a few strokes after
 * its ancient form (plan 061, stage H): the brow, the eye with its pupil,
 * the line from the outer corner, the drop and the spiral. White on the
 * black disc.
 */
function EyeOfHorus() {
  return (
    <g
      transform="translate(-2 2)"
      fill="white"
      stroke="white"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M-30,-19C-16,-28 12,-29 33,-22L33,-16C12,-23 -16,-22 -30,-14Z"
        stroke="none"
      />
      <path
        d="M-30,-3C-18,-15 10,-16 26,-5C12,3 -16,5 -30,-3Z"
        fill="none"
        strokeWidth={4.2}
      />
      <path d="M26,-5H38" strokeWidth={4.6} />
      <circle cx={-3} cy={-6.5} r={7.2} stroke="none" />
      <path d="M-11,1.5L-14,1.5L-13,28L-11.6,30Z" stroke="none" />
      <path
        d="M2,2C5,15 13,22 22,22C30,22 32,13 26,11C21.5,9.5 19,14 22.5,16"
        fill="none"
        strokeWidth={4}
      />
    </g>
  );
}

/**
 * An officer's lamen: the collar's ring, the disc and the officer's glyph,
 * in a −50…50 box. All of it is drawn for this app, the Keryx's caduceus
 * and the Sentinel's Eye of Horus from geometry since stage H of plan 061
 * (they were an SVG Repo icon and a game-icons.net path before), the
 * adepts' since its second part. Defines no ids, so any number can share
 * a page.
 */
export default function Lamen({
  officer,
  grade,
  width,
  height,
  outerCircleStyle,
  innerCircleStyle,
}: {
  officer: string;
  /**
   * The grade whose lamen to draw, for an officer who wears another in it
   * (`lamenGrades.ts`: the Portal's Hiereus and Hegemon); otherwise the
   * Outer Order's, as the ritual role icons always show.
   */
  grade?: string;
  width?: React.CSSProperties["width"];
  height?: React.CSSProperties["width"];
  outerCircleStyle?: React.CSSProperties;
  innerCircleStyle?: React.CSSProperties;
}) {
  if (!officer) officer = "hierophant";
  const gradeLamen =
    grade === undefined ? undefined : GRADE_LAMENS.get(`${grade}:${officer}`);
  // A grade's own lamen replaces the officer's white-on-black glyph.
  const glyph = gradeLamen ? "" : officer;
  const crossLamen = CROSS_LAMENS.get(officer);
  const glyphLamen = gradeLamen ?? GLYPH_LAMENS.get(officer);

  const _outerCircleStyle = {
    color: "#000",
    overflow: "visible",
    fill:
      crossLamen?.ring === "stripes"
        ? "red"
        : (crossLamen?.ring ?? glyphLamen?.ring ?? "white"),
    stroke: "#000",
    strokeWidth: 1,
    strokeDasharray: "none",
    paintOrder: "stroke fill markers",
    stopColor: "#000",
    ...outerCircleStyle,
  };

  const _innerCircleStyle = {
    color: "#000",
    overflow: "visible",
    fill: crossLamen?.disc ?? glyphLamen?.disc ?? "#000",
    stroke: "#000",
    strokeWidth: 1,
    paintOrder: "stroke fill markers",
    stopColor: "#000",
    ...innerCircleStyle,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlSpace="preserve"
      width={width}
      height={height}
      viewBox="-50 -50 100 100"
      // style={{ border: "1px solid blue" }}
    >
      <circle cx={0} cy={0} r={RING_RADIUS} style={_outerCircleStyle} />
      {crossLamen?.ring === "stripes" && <path d={RING_STRIPES} fill="white" />}
      <circle cx={0} cy={0} r={42} style={_innerCircleStyle} />
      {crossLamen && (
        <TipharethCalvaryCross
          style={{ fill: crossLamen.cross ?? crossLamen.ring }}
        />
      )}
      {glyph === "hegemon" && (
        <path
          d="M 0 0 h2.482v2.02h-2.482v5.043h-2.02v-5.043h-2.482v-2.02h2.481v-2.515h2.02z"
          style={{
            fill: "white",
          }}
          transform="scale(7.2) translate(1,-2.2)"
        />
      )}
      {glyph === "hiereus" && (
        <path
          d="m114.746 96.37-4.93 8.54h9.86zm0 2.13 3.087 5.346h-6.174z"
          style={{ fill: "white" }}
          transform="scale(6) translate(-114.7,-101.5)"
        />
      )}
      {glyph === "stolistes" && (
        <path
          d="M79.292 93.798H69.273l5.002-6.66zm-2.397-8.903a2.62 2.62 0 0 1-2.62 2.62 2.62 2.62 0 0 1-2.622-2.62 2.62 2.62 0 0 1 2.621-2.62 2.62 2.62 0 0 1 2.621 2.62zm-9.152-10.753H80.81c-.448 4.994-3.182 7.714-6.523 8.346-3.279-.596-6.12-3.083-6.544-8.346z"
          style={{ fill: "white" }}
          transform="scale(3.3) translate(-74.2,-83.5)"
        />
      )}
      {glyph === "dadouchos" && (
        <path
          d="M30.12 92.248V88.65h3.598v3.598zm0-3.587v-3.597h3.598v3.597zm0-3.587v-3.597h3.598v3.597zm3.587 0v-3.597h3.597v3.597zm3.587 0v-3.597h3.597v3.597zm10.767 7.174h-3.597V88.65h3.597zm-3.587 0h-3.597V88.65h3.597zm-3.587 0H37.29V88.65h3.597zm0-3.587H37.29v-3.597h3.597zm0-3.587H37.29v-3.597h3.597zM48.061 74.3v3.597h-3.597v-3.597zm0 3.587v3.597h-3.597v-3.597zm0 3.587v3.597h-3.597v-3.597zm-3.587 0v3.597h-3.597v-3.597zm-3.587 0v3.597H37.29v-3.597Zm-10.766-7.182h3.597v3.597H30.12Zm3.586 0h3.598v3.597h-3.598zm3.587 0h3.597v3.597h-3.597zm0 3.587h3.597v3.597h-3.597zm0 3.587h3.597v3.597h-3.597z"
          style={{ fill: "white" }}
          transform="scale(2.9) translate(-39,-83.5)"
        />
      )}
      {glyph === "keryx" && <Caduceus />}
      {glyph === "sentinel" && <EyeOfHorus />}
      {glyphLamen && <glyphLamen.Glyph />}
    </svg>
  );
}
