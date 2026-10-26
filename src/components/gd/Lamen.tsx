import type * as React from "react";
import { flipped, type Point } from "./hall/art/geometry";
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
 * the Third Adept's blue is the Praemonstrator's. These are the Portal's
 * lamens only: in a 5=6 hall, under the same role names, the Adepts wear
 * the Rose-Cross, the Second's and Third's by inference
 * (`lamenGrades.ts`).
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
 * white hexagram on the four colours of Malkuth. His ring is red: the
 * p.156 list gives him two collars and no cloak ("Black Collar", then
 * "Red Shoes and Collar"), and we read "Black Collar" as a misprint for
 * "Black Cloak", which keeps the Outer Order's scarlet collar (Z.1,
 * vol. 3, pp.92–93, leaves n84–85). Should Gadi choose black instead,
 * the ring becomes a dark grey (about `#333`) with the usual outline.
 * The Hegemon wears a red and blue hexagram on a white ground, on a
 * yellow collar.
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
 * The caduceus of the Keryx's lamen, drawn from geometry in lamen units
 * (plan 061, stage H, part 2, follow-ups: Gadi chose wings V1 with two
 * turns of the serpents on 26 October 2026). A pointed staff topped by a
 * ringed ball, two wings, and two serpents wound round the staff as a
 * double helix seen a little from above, their heads turned outward
 * below the wings.
 *
 * Each serpent winds `x = A(u)·sin θ` from the tail (u = 0) to the neck
 * (u = 1), with a small tilt `TILT · dy/dθ · cos θ` added to y that
 * rounds the loops. The reach `A` falls towards the tail, the turning
 * rate rises there (the coils tighten), and the body thins arc by arc.
 * The serpent is cut into half-turn arcs where it turns at a side: the
 * arcs behind (cos θ < 0) are drawn under the staff, those in front over
 * it on a band of the disc's black, so the depth settles every crossing.
 * Each arc is a few Hermite cubics through eighth-turn knots, rounded to
 * one decimal: no ids, no gradients.
 */
const TURNS = 2;
/** The body's width at the neck, and the share of it left at the tail. */
const BODY = 5;
const THIN = 0.6;
/** The black edge either side of a front arc and of the staff. */
const EDGE = 1.25;
/** The widest swing, at the neck, and the share of it left at the tail. */
const REACH = 12;
const TAPER = 0.4;
/** How much faster the coils turn at the tail than at the neck (+90%). */
const TIGHTEN = 0.9;
const TAIL = 35;
const NECK = -10;
const TILT = 0.3;
/** Knots per serpent: one every eighth of a turn. */
const KNOTS = TURNS * 8;

const r1 = (value: number) => Math.round(value * 10) / 10 + 0;
const xy = ([x, y]: Point) => `${r1(x)},${r1(y)}`;

/**
 * How far along the serpent (u, tail 0 to neck 1) it has made `share` of
 * its turns, the turning rate falling linearly from 1 + TIGHTEN at the
 * tail to 1 at the neck.
 */
const along = (share: number) =>
  (1 +
    TIGHTEN -
    Math.sqrt((1 + TIGHTEN) ** 2 - 2 * TIGHTEN * share * (1 + TIGHTEN / 2))) /
  TIGHTEN;

/** The angle at `share` of the turns: π/2 at the neck (and the tail). */
const angle = (side: 1 | -1, share: number) =>
  Math.PI / 2 + 2 * Math.PI * TURNS * (share - 1) + (side < 0 ? Math.PI : 0);

/** A serpent's centre line at `share` of its turns. */
function coil(side: 1 | -1, share: number): Point {
  const u = along(share);
  const theta = angle(side, share);
  // dy/dθ: how far the coil falls per radian here.
  const pitch =
    ((NECK - TAIL) * (1 + TIGHTEN / 2)) /
    ((1 + TIGHTEN - TIGHTEN * u) * 2 * Math.PI * TURNS);
  return [
    REACH * (TAPER + (1 - TAPER) * u) * Math.sin(theta),
    TAIL + (NECK - TAIL) * u + TILT * pitch * Math.cos(theta),
  ];
}

/** The centre line from share `a` to `b` in `pieces` Hermite cubics. */
function coilPath(side: 1 | -1, a: number, b: number, pieces: number) {
  const tangent = (share: number): Point => {
    const h = 1e-4;
    const [p, q] = [coil(side, share - h), coil(side, share + h)];
    return [(q[0] - p[0]) / (2 * h), (q[1] - p[1]) / (2 * h)];
  };
  let d = `M${xy(coil(side, a))}`;
  for (let i = 0; i < pieces; i++) {
    const [s0, s1] = [
      a + ((b - a) * i) / pieces,
      a + ((b - a) * (i + 1)) / pieces,
    ];
    const k = (s1 - s0) / 3;
    const [p0, p1, t0, t1] = [
      coil(side, s0),
      coil(side, s1),
      tangent(s0),
      tangent(s1),
    ];
    d += `C${xy([p0[0] + t0[0] * k, p0[1] + t0[1] * k])} ${xy([p1[0] - t1[0] * k, p1[1] - t1[1] * k])} ${xy(p1)}`;
  }
  return d;
}

/** A stroke of the serpents: its path, its width and whether it is a black band. */
interface CoilStroke {
  d: string;
  width: number;
  band?: true;
}

const BEHIND: CoilStroke[] = [];
const IN_FRONT: CoilStroke[] = [];
/** Each head: its centre, and the angle it leans out. */
const HEADS: { cx: number; cy: number; lean: number }[] = [];
for (const side of [1, -1] as const) {
  // Half-turn arcs, from one side turn to the next: the tail is at a side
  // too, as TURNS is whole.
  for (let i = 0; i < KNOTS; i += 4) {
    const [a, b] = [i / KNOTS, (i + 4) / KNOTS];
    const width = r1(BODY * (THIN + (1 - THIN) * along((a + b) / 2)));
    const d = coilPath(side, a, b, 4);
    if (Math.cos(angle(side, (a + b) / 2)) < 0) BEHIND.push({ d, width });
    else {
      // The black band only over the arc's middle, where it crosses the
      // staff and the other serpent, clear of the turns at the sides.
      const trim = (b - a) * 0.17;
      IN_FRONT.push(
        {
          d: coilPath(side, a + trim, b - trim, 3),
          width: width + 2 * EDGE,
          band: true,
        },
        { d, width },
      );
    }
  }
  // The neck rises and leans outward to the head.
  const [x, y] = coil(side, 1);
  const [hx, hy] = [x + side * 2.6, y - 3];
  IN_FRONT.push({
    d: `M${xy([x, y])}Q${xy([x + side * 0.3, y - 2.2])} ${xy([hx, hy])}`,
    width: BODY,
  });
  HEADS.push({ cx: r1(hx + side * 1.2), cy: r1(hy - 1), lean: -side * 35 });
}

/** The staff, pointed at the foot, its top hidden by the ball. */
const STAFF = "M-1.7,-26H1.7V36L0,38.4L-1.7,36Z";

/**
 * One wing (the right), in lamen units; flipped for the left. Design V1
 * ("Arch"): the top edge leaves the ball's side, dips under it (the notch
 * the ball's ring closes), rises to a crest beside the ball and falls to
 * a far, low tip; the underside is flat, cut into four round feathers.
 */
const WING =
  "M0,-24.5Q3.8,-20.4 6,-21C9.5,-22.5 9,-30.6 14,-31Q25.8,-25.2 35.5,-16.5C35.5,-14.4 30.9,-13.8 29.3,-16.6C29.3,-13.6 24.1,-13 22.5,-16.2C22.5,-13.2 16.7,-12.6 15.1,-15.8C15.1,-12.8 8.6,-12.2 7,-15.4Q2.4,-14.9 0,-19Z";
const WINGS = WING + flipped(WING);

/** The Keryx's caduceus, white on the black disc, in lamen units. */
function Caduceus() {
  const strokes = (list: CoilStroke[]) =>
    list.map(({ d, width, band }) =>
      band ? (
        <path
          key={`b${d}`}
          d={d}
          stroke="black"
          strokeWidth={width}
          strokeLinecap="butt"
        />
      ) : (
        <path key={d} d={d} strokeWidth={width} />
      ),
    );
  return (
    <g fill="white">
      <g fill="none" stroke="white" strokeLinecap="round">
        {strokes(BEHIND)}
        <path
          d={STAFF}
          fill="white"
          stroke="black"
          strokeWidth={2 * EDGE}
          paintOrder="stroke"
        />
        {strokes(IN_FRONT)}
      </g>
      <path d={WINGS} />
      <g stroke="black" strokeWidth={1.2}>
        {HEADS.map(({ cx, cy, lean }) => (
          <ellipse
            key={lean}
            cx={cx}
            cy={cy}
            rx={r1(BODY * 0.9)}
            ry={r1(BODY * 0.6)}
            transform={`rotate(${lean} ${cx} ${cy})`}
          />
        ))}
      </g>
      <circle cy={-27} r={4.8} stroke="black" strokeWidth={1.6} />
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
