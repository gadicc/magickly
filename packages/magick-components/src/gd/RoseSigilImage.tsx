import React from "react";
import { SigilImage, sigilFigure } from "../sigil/SigilImage.tsx";
import type { SigilLayout } from "../sigil/types.ts";
import { svgCoordinate } from "../svgCoordinate.ts";
import {
  letterPoint,
  pathFromPoints,
  type RoseVersionId,
  roseLetters,
  roseRings,
  type SigilPoint,
  sigilPoints,
} from "./roseSigilInternals.ts";
import { ROSE_SIGIL_PROFILE, roseSigilLayout } from "./roseSigilLayout.ts";

const roseStrokeColor = "rgba(0,0,0,.4)";

export interface RoseSigilImageProps {
  /**
   * The text to draw. Whitespace separates words, each its own sigil, side
   * by side from right to left (R2). Final forms are drawn as their base
   * letters, and anything else not one of the 22 letters (points, Latin)
   * is left out.
   */
  text: string;
  /** Draws the rose's three rings of letters behind the sigil (default true). */
  showRose?: boolean;
  /**
   * Which rose (`ROSE_VERSIONS`): the Golden Dawn's (`gd`) when not given
   * or not a version, or Regardie's of 1939 (`regardie1939`), which
   * exchanges Kaph and Tau.
   */
  version?: RoseVersionId;
  /**
   * Draws each letter's circle and the path through the letters' centres
   * too, as they are before placement (default false).
   */
  debug?: boolean;
  /**
   * Points to draw through, one per letter of the text with its words
   * joined, by the old path rules (beads, squiggles, one path). Without
   * them the sigil is planned and placed by rule (plan 088).
   *
   * @deprecated Placement by rule replaces the optimiser's points; leave
   * this out. It is kept so that callers drawing optimised points still
   * work.
   */
  points?: SigilPoint[];
  /**
   * Draw-on animation class for the sigil's path, unique per instance
   * because a `<style>` inside inline SVG is document-wide; server renders
   * never animate.
   */
  animation?: string;
  /** The `<svg>`, for exporting the drawing. */
  ref?: React.Ref<SVGSVGElement>;
  /** The sigil's path, which `RoseSigil` animates. */
  pathRef?: React.Ref<SVGPathElement>;
}

/** The rose's rings and letters, centred on the origin. */
function Rose({ version, debug }: { version?: RoseVersionId; debug: boolean }) {
  return (
    <>
      {" "}
      <circle
        cx={0}
        cy={0}
        r={10}
        stroke={roseStrokeColor}
        strokeWidth={0.5}
        fill="none"
      />
      {roseRings(version).map((row, i) => (
        <React.Fragment key={row.join("")}>
          <circle
            cx={0}
            cy={0}
            r={10 * (i + 2)}
            stroke={roseStrokeColor}
            strokeWidth={0.5}
            fill="none"
          />
          {row.map((letter) => {
            // Labels sit on the letter centres the path is drawn through.
            const center = letterPoint(letter, version);
            const x = svgCoordinate(center.x);
            const y = svgCoordinate(center.y);
            return (
              <React.Fragment key={letter}>
                {debug && (
                  <circle
                    cx={x}
                    cy={y}
                    r={5}
                    stroke={roseStrokeColor}
                    strokeWidth={0.5}
                    strokeDasharray={0.2}
                    fill="none"
                  />
                )}
                <text
                  x={x}
                  y={y}
                  fill={roseStrokeColor}
                  textAnchor="middle"
                  fontSize={10}
                  dominantBaseline="middle"
                >
                  {letter}
                </text>
              </React.Fragment>
            );
          })}
        </React.Fragment>
      ))}
    </>
  );
}

/** The draw-on animation's rule; it lasts a quarter second a letter. */
function AnimationStyle({ name, text }: { name: string; text: string }) {
  return (
    <style>
      {`.${name} { animation: ${name} ${roseLetters(text).length / 4}s linear 0s forwards 1; }
@keyframes ${name} { to { stroke-dashoffset: 0; } }`}
    </style>
  );
}

/** One word's letter centres, joined, as they are before placement. */
function anchorPath(
  layout: SigilLayout<string>,
  places: readonly string[],
): string {
  return places
    .map((place, i) => {
      const a = layout.anchor(place);
      return `${i ? "L" : "M"} ${svgCoordinate(a.x)},${svgCoordinate(a.y)}`;
    })
    .join(" ");
}

/**
 * The sigil's artwork with no hooks, so that a server-side renderer can
 * draw it with React's server build; `RoseSigil` adds the animation
 * around it. The sigil is planned and placed by rule on the rose
 * (`SigilImage`), each word its own sigil and the rose behind each; its
 * ink is one red path. With the deprecated `points` it is drawn through
 * them as it was before plan 088.
 */
export function RoseSigilImage({
  text,
  showRose = true,
  version,
  debug = false,
  points,
  animation,
  ref,
  pathRef,
}: RoseSigilImageProps) {
  if (points)
    return (
      <PointsImage
        text={text}
        showRose={showRose}
        version={version}
        debug={debug}
        points={points}
        animation={animation}
        ref={ref}
        pathRef={pathRef}
      />
    );
  const layout = roseSigilLayout(version);
  const plan = debug ? sigilFigure(text, layout, ROSE_SIGIL_PROFILE).plan : [];
  return (
    <SigilImage
      text={text}
      layout={layout}
      profile={ROSE_SIGIL_PROFILE}
      ref={ref}
      pathRef={pathRef}
      backdrop={
        showRose || debug
          ? (offset, index) => {
              const art = (
                <>
                  {showRose && <Rose version={version} debug={debug} />}
                  {debug && plan[index] && (
                    <path
                      stroke="#aa0"
                      fill="none"
                      d={anchorPath(
                        layout,
                        plan[index].map((v) => v.place),
                      )}
                    />
                  )}
                </>
              );
              // The first word sits on the rose's own coordinates.
              return offset.x === 0 && offset.y === 0 ? (
                <React.Fragment key={index}>{art}</React.Fragment>
              ) : (
                <g
                  key={index}
                  transform={`translate(${svgCoordinate(offset.x)} ${svgCoordinate(offset.y)})`}
                >
                  {art}
                </g>
              );
            }
          : undefined
      }
    >
      {animation && <AnimationStyle name={animation} text={text} />}
    </SigilImage>
  );
}

/** The drawing through given points, as before placement by rule. */
function PointsImage({
  text,
  showRose = true,
  version,
  debug = false,
  points,
  animation,
  ref,
  pathRef,
}: RoseSigilImageProps & { points: SigilPoint[] }) {
  const sigilTokens = roseLetters(text);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      viewBox="-50 -50 100 100"
      ref={ref}
    >
      {animation && <AnimationStyle name={animation} text={text} />}
      {showRose && <Rose version={version} debug={debug} />}

      {debug && (
        <path
          // Letter centres before optimisation
          stroke="#aa0"
          fill="none"
          d={pathFromPoints({
            points: sigilPoints(text, version),
            sigilTokens,
          })}
        />
      )}

      <path
        // Connecting path
        stroke="red"
        fill="none"
        ref={pathRef}
        d={pathFromPoints({ points, sigilTokens })}
      />
    </svg>
  );
}

export default RoseSigilImage;
