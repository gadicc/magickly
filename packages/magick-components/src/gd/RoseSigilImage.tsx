import React from "react";
import { svgCoordinate } from "../svgCoordinate.ts";
import {
  letterIJ,
  letterPoint,
  type Point,
  pathFromPoints,
  ROSE_LETTERS,
  roseLetters,
  sigilPoints,
} from "./roseSigilGeometry.ts";

export { letterIJ, roseLetters, sigilPoints };

const roseStrokeColor = "rgba(0,0,0,.4)";

export interface RoseSigilImageProps {
  /**
   * The text to draw. Final forms are drawn as their base letters, and
   * anything not one of the 22 letters (spaces, points, Latin) is left out.
   */
  sigilText: string;
  /** Draws the rose's three rings of letters behind the sigil. */
  showRose: boolean;
  /** Draws each letter's circle and the unoptimised path too. */
  debug: boolean;
  /** Letter centres to draw through; the optimised layout when available. */
  points: Point[];
  /**
   * Draw-on animation class for the connecting path, unique per instance
   * because a `<style>` inside inline SVG is document-wide; server renders
   * never animate.
   */
  animation?: string;
  /** The `<svg>`. */
  svgRef?: React.Ref<SVGSVGElement>;
  /** The connecting path, which `RoseSigil` animates. */
  pathRef?: React.Ref<SVGPathElement>;
}

/**
 * The sigil artwork with no hooks, so the server image route can render it
 * with React's server build; the interactive component adds the optimiser
 * and animation around it.
 */
export function RoseSigilImage({
  sigilText,
  showRose,
  debug,
  points,
  animation,
  svgRef,
  pathRef,
}: RoseSigilImageProps) {
  const sigilTokens = roseLetters(sigilText);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      viewBox="-50 -50 100 100"
      ref={svgRef}
    >
      {animation && (
        <style>
          {`.${animation} { animation: ${animation} ${sigilTokens.length / 4}s linear 0s forwards 1; }
@keyframes ${animation} { to { stroke-dashoffset: 0; } }`}
        </style>
      )}
      {showRose && (
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
          {ROSE_LETTERS.map((row, i) => (
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
                const centre = letterPoint(letter);
                const x = svgCoordinate(centre.x);
                const y = svgCoordinate(centre.y);
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
      )}

      {debug && (
        <path
          // Letter centres before optimisation
          stroke="#aa0"
          fill="none"
          d={pathFromPoints({ points: sigilPoints(sigilText), sigilTokens })}
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
