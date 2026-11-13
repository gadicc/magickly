import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  useId,
  useMemo,
} from "react";
import { svgCoordinate } from "../../svgCoordinate";
import { defaultHallArt } from "./art";
import { Placeholder } from "./art/placeholder";
import { PALETTE } from "./art/shared";
import { GD_HALL_FONT_STACKS, gdHallFontFaceCss } from "./fonts";
import {
  FLOOR_SIZE,
  FLOOR_STROKE,
  type ResolvedHall,
  type ResolvedLabel,
  type ResolvedObject,
  resolveHall,
  WALL_GAP,
  WALL_STROKE,
} from "./layout";
import type { HallArt, HallArtRegistry, HallNode } from "./types";

/** SVG user units per checker square: text stays at a large font size. */
const UNIT = 100;
const u = (squares: number) => svgCoordinate(squares * UNIT);

const EMPTY_HALL: HallNode = { type: "gdHall" };

/** Props of `GdHall`. */
export interface GdHallProps {
  /** The compiled `gdHall` node; anything else draws an empty hall. */
  hall: HallNode;
  /** Art by kind; the package's original art unless the app composes more. */
  art?: HallArtRegistry;
  /**
   * Where the hall's WOFF2 subsets are served (such as `/fonts`). When set,
   * the SVG carries its own `@font-face` rules; otherwise the page must.
   */
  fontBaseUrl?: string;
  className?: string;
  style?: CSSProperties;
  width?: number | string;
  height?: number | string;
  /** The drawn `<svg>`, for exporting it. */
  ref?: Ref<SVGSVGElement>;
}

const labelTextStyle: CSSProperties = {
  fontVariantLigatures: "none",
  fontKerning: "normal",
};

function Lines({ label }: { label: ResolvedLabel }) {
  return (
    <>
      {label.lines.map((line, index) => (
        <text
          // Lines never reorder, and a position is no unique key.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          key={index}
          x={u(line.x)}
          y={u(line.y)}
          fontSize={u(label.size)}
          textAnchor={label.anchor}
        >
          {line.text}
        </text>
      ))}
    </>
  );
}

function Chrome({
  hall,
  checker,
  gradient,
}: {
  hall: ResolvedHall;
  checker: string;
  gradient: string;
}) {
  const { outer } = hall;
  // With no dais band (dais=0) the East wall stands at the floor's edge.
  const daisBand = outer.y0 < -WALL_GAP;
  const doorBands = hall.doors.map((door) => {
    // Cover the floor outline, the gap and the wall line on that side; on
    // the East, behind a dais, only the wall line.
    const pad = WALL_STROKE;
    const across =
      door.side === "west"
        ? [FLOOR_SIZE - pad, outer.y1 + pad]
        : door.side === "east"
          ? [outer.y0 - pad, daisBand ? outer.y0 + pad : pad]
          : door.side === "north"
            ? [outer.x0 - pad, pad]
            : [FLOOR_SIZE - pad, outer.x1 + pad];
    const vertical = door.side === "north" || door.side === "south";
    return vertical
      ? { x0: across[0], x1: across[1], y0: door.from, y1: door.to }
      : { x0: door.from, x1: door.to, y0: across[0], y1: across[1] };
  });
  return (
    <g>
      <rect
        x={u(outer.x0)}
        y={u(outer.y0)}
        width={u(outer.x1 - outer.x0)}
        height={u(outer.y1 - outer.y0)}
        fill={hall.wall === "gradient" ? `url(#${gradient})` : PALETTE.paper}
        stroke={PALETTE.ink}
        strokeWidth={u(WALL_STROKE)}
      />
      <rect
        x={0}
        y={0}
        width={u(FLOOR_SIZE)}
        height={u(FLOOR_SIZE)}
        fill={`url(#${checker})`}
        stroke={PALETTE.ink}
        strokeWidth={u(FLOOR_STROKE)}
      />
      {doorBands.map((band, index) => (
        <rect
          // Two doors may share a corner; bands never reorder.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          key={index}
          x={u(band.x0)}
          y={u(band.y0)}
          width={u(band.x1 - band.x0)}
          height={u(band.y1 - band.y0)}
          fill={PALETTE.paper}
        />
      ))}
    </g>
  );
}

/** Text drawn over an object's art, in the labels' face. */
function Inner({ label }: { label: ResolvedLabel }) {
  return (
    <g
      fontFamily={GD_HALL_FONT_STACKS.serif}
      fontStyle="italic"
      fill={PALETTE.ink}
      style={labelTextStyle}
    >
      <Lines label={label} />
    </g>
  );
}

/**
 * One drawing in the hall's `<defs>`: the first object drawn with it, and
 * its art (none for the placeholder).
 */
export interface ArtDefinition {
  id: string;
  object: ResolvedObject;
  art?: HallArt;
}

/**
 * The hall's distinct drawings and which one each object uses. Objects
 * whose art, box and variant agree share one drawing, placed with `<use>`,
 * so a drawing's size counts once per hall however many nodes use it
 * (plan 061, decision 12). Ids follow the objects' order, so they are the
 * same on the server and the client.
 */
function artDefinitions(
  objects: readonly ResolvedObject[],
  art: HallArtRegistry,
  id: string,
) {
  const definitions = new Map<string, ArtDefinition>();
  const uses = new Map<ResolvedObject, string>();
  for (const object of objects) {
    if (object.text) continue;
    const drawn = object.missing ? undefined : art.get(object.artKey);
    const key = drawn
      ? JSON.stringify([
          "art",
          object.artKey,
          object.box.width,
          object.box.height,
          drawn.variant(object.node),
        ])
      : JSON.stringify(["placeholder", object.artKey]);
    let definition = definitions.get(key);
    if (!definition) {
      definition = { id: `${id}-art${definitions.size}`, object, art: drawn };
      definitions.set(key, definition);
    }
    uses.set(object, definition.id);
  }
  return { definitions: [...definitions.values()], uses };
}

/** A drawing in `<defs>`, centred on the origin in its art units. */
function ArtDefinitionGroup({ definition }: { definition: ArtDefinition }) {
  const { id, object, art } = definition;
  return (
    <g id={id}>
      {art ? (
        <art.Component
          node={object.node}
          box={object.box}
          defId={(name) => `${id}-${name}`}
        />
      ) : (
        <Placeholder name={object.artKey} />
      )}
    </g>
  );
}

/** An object: its drawing placed and scaled, and any text over it. */
function HallObject({
  object,
  use,
}: {
  object: ResolvedObject;
  use: string | undefined;
}): ReactNode {
  if (object.text || use === undefined) return null;
  return (
    <>
      <use
        href={`#${use}`}
        transform={`translate(${u(object.cx)} ${u(object.cy)}) scale(${svgCoordinate(object.k * UNIT)})`}
      />
      {object.inner && <Inner label={object.inner} />}
    </>
  );
}

/** The drawings of a hall, as `GdHall` memoises them. */
export interface HallDrawings {
  definitions: readonly ArtDefinition[];
  uses: ReadonlyMap<ResolvedObject, string>;
}

/**
 * The hall a node draws: itself when it is a `gdHall`, an empty hall for
 * anything else.
 */
export function hallRoot(hall: HallNode): HallNode {
  return typeof hall === "object" && hall !== null && hall.type === "gdHall"
    ? hall
    : EMPTY_HALL;
}

/** Props of `GdHallSvg`: a resolved hall, drawn without hooks. */
export interface GdHallSvgProps {
  /** The hall as `resolveHall` resolved it with `art`. */
  resolved: ResolvedHall;
  /** The art `resolved` was resolved with. */
  art: HallArtRegistry;
  /**
   * Prefixes the pattern, gradient and drawing ids, which must be unique
   * in the document: `useId`'s in `GdHall`, a fixed name in an image.
   */
  idPrefix: string;
  /** The drawings, when the caller memoises them; computed otherwise. */
  drawings?: HallDrawings;
  /** `@font-face` rules carried inside the SVG, if any. */
  fontCss?: string;
  /**
   * Draw for the server's image renderer (plan 062): the viewBox rounded
   * outward to whole units, which resvg writes back unchanged, and no
   * `<title>`, `role` or `aria-labelledby`, since outlining drops the
   * title an accessible name would point at.
   */
  image?: boolean;
  className?: string;
  style?: CSSProperties;
  width?: number | string;
  height?: number | string;
  ref?: Ref<SVGSVGElement>;
}

/** A resolved viewBox in SVG units, as `GdHallSvg` writes it. */
export function hallViewBox(
  resolved: ResolvedHall,
  image = false,
): [number, number, number, number] {
  const { viewBox } = resolved;
  if (!image)
    return [
      u(viewBox.x0),
      u(viewBox.y0),
      u(viewBox.x1 - viewBox.x0),
      u(viewBox.y1 - viewBox.y0),
    ];
  const x0 = Math.floor(u(viewBox.x0));
  const y0 = Math.floor(u(viewBox.y0));
  return [x0, y0, Math.ceil(u(viewBox.x1)) - x0, Math.ceil(u(viewBox.y1)) - y0];
}

/**
 * The drawing of a resolved hall, without hooks, so a server route with no
 * hook dispatcher can render it (plan 062). `GdHall` draws through it.
 */
export function GdHallSvg({
  resolved,
  art,
  idPrefix: id,
  drawings,
  fontCss,
  image = false,
  className,
  style,
  width,
  height,
  ref,
}: GdHallSvgProps) {
  const { definitions, uses } =
    drawings ?? artDefinitions(resolved.objects, art, id);
  const box = hallViewBox(resolved, image);
  const titleId = `${id}-title`;
  const checker = `${id}-checker`;
  const gradient = `${id}-wall`;
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={box.join(" ")}
      role={image ? undefined : "img"}
      aria-labelledby={image ? undefined : titleId}
      className={className}
      style={style}
      width={width}
      height={height}
    >
      {!image && (
        <title id={titleId}>{resolved.captionText ?? "Temple hall"}</title>
      )}
      {fontCss && <style>{fontCss}</style>}
      <defs>
        <pattern
          id={checker}
          width={2 * UNIT}
          height={2 * UNIT}
          patternUnits="userSpaceOnUse"
        >
          <rect
            width={2 * UNIT}
            height={2 * UNIT}
            fill={PALETTE.checkerLight}
          />
          <rect width={UNIT} height={UNIT} fill={PALETTE.checkerDark} />
          <rect
            x={UNIT}
            y={UNIT}
            width={UNIT}
            height={UNIT}
            fill={PALETTE.checkerDark}
          />
        </pattern>
        {resolved.wall === "gradient" && (
          <linearGradient id={gradient} x1={0} x2={0} y1={0} y2={1}>
            <stop offset={0.13} stopColor={PALETTE.paper} />
            <stop offset={1} stopColor={PALETTE.ink} />
          </linearGradient>
        )}
        {definitions.map((definition) => (
          <ArtDefinitionGroup key={definition.id} definition={definition} />
        ))}
      </defs>
      <rect
        x={box[0]}
        y={box[1]}
        width={box[2]}
        height={box[3]}
        fill={PALETTE.paper}
      />
      <Chrome hall={resolved} checker={checker} gradient={gradient} />
      {resolved.objects.map((object) => (
        <HallObject
          key={object.path.join(".")}
          object={object}
          use={uses.get(object)}
        />
      ))}
      <g
        fontFamily={GD_HALL_FONT_STACKS.serif}
        fontStyle="italic"
        fill={PALETTE.ink}
        style={labelTextStyle}
      >
        {resolved.objects
          .filter((object) => object.text || object.labels.length > 0)
          .map((object) => (
            <g key={object.path.join(".")}>
              {object.text && <Lines label={object.text} />}
              {object.labels.map((label, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: labels keep their order
                <Lines key={index} label={label} />
              ))}
            </g>
          ))}
        {resolved.compass.map((label) => (
          <text
            key={label.text}
            x={u(label.x)}
            y={u(label.y)}
            fontSize={u(label.size)}
            fontWeight={700}
            textAnchor="middle"
            transform={
              label.rotate === 0
                ? undefined
                : `rotate(${label.rotate} ${u(label.x)} ${u(label.y)})`
            }
          >
            {label.text}
          </text>
        ))}
        {resolved.caption && <Lines label={resolved.caption} />}
      </g>
    </svg>
  );
}

/**
 * A Golden Dawn temple hall as inline SVG (plan 061). Pure and SSR-safe:
 * layout comes from `resolveHall`, text widths from the generated font
 * table, and gradient and pattern ids from `useId`, so several halls share
 * a page. Content is untrusted: strings only reach text nodes, unknown tags
 * draw as dashed placeholders, and nothing is loaded by URL except the
 * fonts the caller points at.
 */
export function GdHall({
  hall,
  art = defaultHallArt,
  fontBaseUrl,
  className,
  style,
  width,
  height,
  ref,
}: GdHallProps) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "_");
  const root = hallRoot(hall);
  const resolved = useMemo(() => resolveHall(root, { art }), [root, art]);
  const drawings = useMemo(
    () => artDefinitions(resolved.objects, art, id),
    [resolved, art, id],
  );
  const fontCss = useMemo(
    () =>
      fontBaseUrl === undefined ? undefined : gdHallFontFaceCss(fontBaseUrl),
    [fontBaseUrl],
  );
  return (
    <GdHallSvg
      resolved={resolved}
      art={art}
      idPrefix={id}
      drawings={drawings}
      fontCss={fontCss}
      className={className}
      style={style}
      width={width}
      height={height}
      ref={ref}
    />
  );
}
