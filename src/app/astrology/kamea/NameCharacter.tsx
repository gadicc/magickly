import styles from "./namePage.module.css";
import type { PlanetaryNameCharacter } from "./planetaryNames";

/**
 * Agrippa's characters redrawn from our reading of his woodcuts (plan
 * 093, K6): the strokes one reader recorded, point by point, in the
 * pixels of the figure's box on archive.org's image of the leaf, curved
 * where the reader read a curve (`via`), and the marks as the reader
 * recorded them: rings at the ends or on the line, bars and hooks where
 * the reader placed them. A drawing of the reading, not a copy of the
 * print.
 */

/** A point, `[x, y]`, in the box's pixels. */
type Point = readonly number[];

/** One point a reader recorded on a stroke. */
export interface CharacterVertex {
  /** end, corner, hairpin, cusp or curve (the data file's header). */
  kind: string;
  x: number;
  y: number;
  /** At an end only: circle, dot, bar, hook, none or other. */
  mark?: string;
  /** Points along a curve on the way here from the vertex before. */
  via?: readonly Point[];
  /** At a hooked end: each curl's course from the end to its tip. */
  hook?: readonly (readonly Point[])[];
  /** At an end with a bar: the bar's two ends. */
  bar?: readonly Point[];
}

/** One stroke, open or closed, as its vertices in order. */
export interface CharacterStroke {
  closed: boolean;
  vertices: CharacterVertex[];
  /** Rings on the line between its ends: their centres. */
  rings?: readonly Point[];
}

/** The two readers whose strokes the data keeps for Agrippa's figures. */
export type CharacterReader = "opus" | "fable";

/**
 * The reader whose strokes the pages redraw, the same on every page.
 * Fable 5.2's: it records the curves and the marks' places (the oval of
 * the spirit of spirits with the ring on it, the hooks' courses and the
 * bars' ends), and where the two differ at an end, its marks are the
 * ones the reconciled `marks` describe (Sorath's hook, Bartzabel's curl).
 */
export const CHARACTER_READER: CharacterReader = "fable";

/** Each reader as the page names them. */
export const READER_NAMES: Record<CharacterReader, string> = {
  opus: "Claude Opus 5.5",
  fable: "Claude Fable 5.2",
};

/** A character's strokes as one reader recorded them, if it has them. */
export function characterStrokes(
  character: PlanetaryNameCharacter,
  reader: CharacterReader = CHARACTER_READER,
): CharacterStroke[] | undefined {
  const readings = (
    character as { readings?: Partial<Record<CharacterReader, unknown>> }
  ).readings;
  return readings?.[reader] as CharacterStroke[] | undefined;
}

/**
 * Where a drawing goes beyond the reading, so that its caption can say
 * so: a mark drawn in a direction or with a bend the reader did not
 * record, which is ours.
 */
export interface CharacterLiberties {
  /** A bar or hook whose direction the reader did not record. */
  markDirection: boolean;
  /** A hook whose curl the reader gave only by its tip. */
  hookCurve: boolean;
}

/** A stroke's two free ends, or none for a closed one. */
const endsOf = (stroke: CharacterStroke) =>
  stroke.closed
    ? []
    : [stroke.vertices[0], stroke.vertices[stroke.vertices.length - 1]];

/** The liberties a drawing of these strokes takes. */
export function characterLiberties(
  strokes: readonly CharacterStroke[],
): CharacterLiberties {
  const ends = strokes.flatMap(endsOf);
  return {
    markDirection: ends.some(
      (end) =>
        (end.mark === "bar" && !end.bar) || (end.mark === "hook" && !end.hook),
    ),
    hookCurve: ends.some((end) => end.hook?.some((curl) => curl.length < 2)),
  };
}

/** The ink's width and the marks' sizes, in the box's pixels. */
const INK = 5;
const RING = 9;
const DOT = 5;
const BAR = 11;
const HOOK = 7;

const round = (value: number) => Math.round(value * 10) / 10;
const xy = (point: Point) => `${round(point[0])},${round(point[1])}`;
const at = (vertex: CharacterVertex): Point => [vertex.x, vertex.y];

/**
 * A smooth course through `points` (Catmull-Rom, as cubic Béziers): the
 * line a reader read as a curve, through every point it gave.
 */
function curve(points: readonly Point[]): string {
  let d = "";
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const [p1, p2] = [points[i], points[i + 1]];
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${xy(c1)} ${xy(c2)} ${xy(p2)}`;
  }
  return d;
}

/** `from` moved `by` pixels towards `to`, as far as `to` at most. */
function toward(from: Point, to: Point, by: number): Point {
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  const length = Math.hypot(dx, dy);
  if (length <= by) return from;
  return [from[0] + (dx / length) * by, from[1] + (dy / length) * by];
}

/**
 * A stroke's line as an SVG path: straight between vertices, curved
 * through the points of a `via`, and leaving off at the edge of a ring
 * at either end, so that the ring stays open.
 */
export function strokePath(stroke: CharacterStroke): string {
  const { vertices, closed } = stroke;
  // Each leg's points, from one vertex to the next, its `via` between.
  const legs: Point[][] = vertices
    .slice(1)
    .map((vertex, i) => [at(vertices[i]), ...(vertex.via ?? []), at(vertex)]);
  if (closed && vertices.length > 1)
    legs.push([
      at(vertices[vertices.length - 1]),
      ...(vertices[0].via ?? []),
      at(vertices[0]),
    ]);
  if (!legs.length) return "";
  if (!closed) {
    const first = legs[0];
    const last = legs[legs.length - 1];
    if (vertices[0].mark === "circle")
      first[0] = toward(first[0], first[1], RING);
    if (vertices[vertices.length - 1].mark === "circle")
      last[last.length - 1] = toward(
        last[last.length - 1],
        last[last.length - 2],
        RING,
      );
  }
  let d = `M${xy(legs[0][0])}`;
  for (const leg of legs) d += leg.length > 2 ? curve(leg) : ` L${xy(leg[1])}`;
  return closed ? `${d} Z` : d;
}

/** The point a stroke arrives at an end from, curve points included. */
function approach(stroke: CharacterStroke, atStart: boolean): Point {
  const { vertices } = stroke;
  if (atStart) {
    const next = vertices[1];
    return next ? (next.via?.[0] ?? at(next)) : at(vertices[0]);
  }
  const last = vertices[vertices.length - 1];
  return (
    last.via?.[last.via.length - 1] ?? at(vertices[vertices.length - 2] ?? last)
  );
}

/**
 * The mark at a stroke's end, drawn at `end`, the stroke arriving from
 * `from`: a ring, a dot, a bar or hook where the reader placed it (or,
 * where it did not, across the line or turning off it, which is ours),
 * or, for a mark the reader could not name, a dashed ring.
 */
function EndMark({ end, from }: { end: CharacterVertex; from: Point }) {
  const { mark, x, y } = end;
  if (!mark || mark === "none") return null;
  if (mark === "circle")
    return <circle cx={x} cy={y} r={RING} data-mark="circle" />;
  if (mark === "dot")
    return (
      <circle
        cx={x}
        cy={y}
        r={DOT}
        fill="currentColor"
        stroke="none"
        data-mark="dot"
      />
    );
  if (mark === "other")
    return (
      <circle
        cx={x}
        cy={y}
        r={RING}
        strokeDasharray="3 4"
        strokeWidth={INK / 2}
        data-mark="other"
      />
    );
  if (mark === "bar" && end.bar)
    return (
      <path
        d={`M${xy(end.bar[0])} L${xy(end.bar[1])}`}
        data-mark="bar"
        data-placed="reader"
      />
    );
  if (mark === "hook" && end.hook)
    return (
      <g data-mark="hook" data-placed="reader">
        {end.hook.map((course, i) => {
          if (course.length > 1)
            return (
              <path
                // biome-ignore lint/suspicious/noArrayIndexKey: curls in the reader's order
                key={i}
                d={`M${xy([x, y])}${curve([[x, y], ...course])}`}
              />
            );
          // Only the tip was read: a quarter turn to it, its bend ours.
          const tip = course[0];
          const radius = round(Math.hypot(tip[0] - x, tip[1] - y) / Math.SQRT2);
          return (
            <path
              // biome-ignore lint/suspicious/noArrayIndexKey: as above
              key={i}
              d={`M${xy([x, y])} A${radius} ${radius} 0 0 ${i % 2} ${xy(tip)}`}
            />
          );
        })}
      </g>
    );
  // A bar or hook the reader did not place: its direction is ours.
  const dx = x - from[0];
  const dy = y - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const [nx, ny] = [-dy / length, dx / length];
  if (mark === "bar")
    return (
      <path
        d={`M${xy([x + nx * BAR, y + ny * BAR])} L${xy([x - nx * BAR, y - ny * BAR])}`}
        data-mark="bar"
        data-placed="ours"
      />
    );
  if (mark === "hook")
    return (
      <path
        d={`M${xy([x, y])} A${HOOK} ${HOOK} 0 0 1 ${xy([x + nx * 2 * HOOK, y + ny * 2 * HOOK])}`}
        data-mark="hook"
        data-placed="ours"
      />
    );
  return null;
}

/**
 * A character redrawn from a reading: its box's own size and proportions
 * (`region`), in the text's colour, light or dark. `labelledBy` names the
 * element whose text is its accessible name.
 */
export default function CharacterDrawing({
  character,
  labelledBy,
  reader = CHARACTER_READER,
}: {
  character: PlanetaryNameCharacter;
  labelledBy: string;
  reader?: CharacterReader;
}) {
  const strokes = characterStrokes(character, reader);
  if (!strokes) return null;
  const { width, height } = character.region;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-labelledby={labelledBy}
      className={styles.character}
      data-reader={reader}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={INK}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {strokes.map((stroke, s) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: strokes in the reader's order
          <g key={s} data-stroke={s}>
            <path d={strokePath(stroke)} data-line="" />
            {stroke.rings?.map((ring) => (
              <circle
                key={xy(ring)}
                cx={ring[0]}
                cy={ring[1]}
                r={RING}
                data-mark="ring"
              />
            ))}
            {stroke.closed ? null : (
              <>
                <EndMark
                  end={stroke.vertices[0]}
                  from={approach(stroke, true)}
                />
                {stroke.vertices.length > 1 ? (
                  <EndMark
                    end={stroke.vertices[stroke.vertices.length - 1]}
                    from={approach(stroke, false)}
                  />
                ) : null}
              </>
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}
