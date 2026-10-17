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
import type { HallArtRegistry, HallNode } from "./types";

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

function HallObject({
  object,
  art,
  defId,
}: {
  object: ResolvedObject;
  art: HallArtRegistry;
  defId: (name: string) => string;
}): ReactNode {
  if (object.text) return null;
  const drawn = object.missing ? undefined : art.get(object.artKey);
  const transform = `translate(${u(object.cx)} ${u(object.cy)}) scale(${svgCoordinate(object.k * UNIT)})`;
  if (!drawn)
    return (
      <g transform={transform}>
        <Placeholder name={object.artKey} />
      </g>
    );
  const { Component } = drawn;
  return (
    <>
      <g transform={transform}>
        <Component node={object.node} box={object.box} defId={defId} />
      </g>
      {object.inner && <Inner label={object.inner} />}
    </>
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
  const root =
    typeof hall === "object" && hall !== null && hall.type === "gdHall"
      ? hall
      : EMPTY_HALL;
  const resolved = useMemo(() => resolveHall(root, { art }), [root, art]);
  const fontCss = useMemo(
    () =>
      fontBaseUrl === undefined ? undefined : gdHallFontFaceCss(fontBaseUrl),
    [fontBaseUrl],
  );
  const { viewBox } = resolved;
  const titleId = `${id}-title`;
  const checker = `${id}-checker`;
  const gradient = `${id}-wall`;
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={[
        u(viewBox.x0),
        u(viewBox.y0),
        u(viewBox.x1 - viewBox.x0),
        u(viewBox.y1 - viewBox.y0),
      ].join(" ")}
      role="img"
      aria-labelledby={titleId}
      className={className}
      style={style}
      width={width}
      height={height}
    >
      <title id={titleId}>{resolved.captionText ?? "Temple hall"}</title>
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
      </defs>
      <rect
        x={u(viewBox.x0)}
        y={u(viewBox.y0)}
        width={u(viewBox.x1 - viewBox.x0)}
        height={u(viewBox.y1 - viewBox.y0)}
        fill={PALETTE.paper}
      />
      <Chrome hall={resolved} checker={checker} gradient={gradient} />
      {resolved.objects.map((object) => (
        <HallObject
          key={object.path.join(".")}
          object={object}
          art={art}
          defId={(name) => `${id}-${object.path.join("-")}-${name}`}
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
