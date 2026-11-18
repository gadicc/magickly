import type React from "react";
import {
  type SigilFrame,
  sigilFrame,
  sigilPathData,
  sigilViewBox,
} from "./ink.ts";
import { placeSigil } from "./placeSigil.ts";
import { planSigil, sigilWords } from "./planSigil.ts";
import type {
  PlacedWord,
  Point,
  SigilLayout,
  SigilPlan,
  SigilProfile,
} from "./types.ts";

/** A text's sigil worked out: its plan, its placed words and their path. */
export interface SigilFigure {
  plan: SigilPlan;
  placed: PlacedWord[];
  /** Path data of every word's ink, in one path. */
  d: string;
  frame: SigilFrame;
  viewBox: [number, number, number, number];
}

/**
 * `text` planned (`planSigil`), placed by rule (`placeSigil`) and drawn
 * (`sigilPathData`) on `layout` under `profile`. Pure and deterministic:
 * the same figure on the server and in every browser.
 */
export function sigilFigure(
  text: string,
  layout: SigilLayout<string>,
  profile: SigilProfile,
): SigilFigure {
  const plan = planSigil(sigilWords(text), layout, profile);
  const placed = placeSigil(plan, layout, profile);
  const frame = sigilFrame(layout);
  return {
    plan,
    placed,
    d: sigilPathData(placed, layout, profile),
    frame,
    viewBox: sigilViewBox(frame, plan.length),
  };
}

export interface SigilImageProps {
  /** The text; whitespace separates words, each its own sigil (R2). */
  text: string;
  /** Where the text's tokens are drawn: the rose, or another layout. */
  layout: SigilLayout<string>;
  /** Which marks and sizes: a tradition's rules. */
  profile: SigilProfile;
  /** The ink's colour (default red, as the rose sigil has always been drawn). */
  stroke?: string;
  /**
   * Drawn under the sigil, once per word region, given that word's offset
   * (the rose behind each word, say).
   */
  backdrop?: (offset: Point, index: number) => React.ReactNode;
  /** Drawn before everything else (a `<style>`, say). */
  children?: React.ReactNode;
  /** A class on the sigil's path (a draw-on animation). */
  pathClassName?: string;
  /** The `<svg>`. */
  ref?: React.Ref<SVGSVGElement>;
  /** The sigil's one path, for a draw-on animation. */
  pathRef?: React.Ref<SVGPathElement>;
}

/**
 * A sigil drawn by rule on any layout, with no hooks, so a server renderer
 * draws it with React's server build. Its only ink is one stroked path,
 * the stroke `layout.unit` wide, so the figure grammar's sizes hold.
 */
export function SigilImage({
  text,
  layout,
  profile,
  stroke = "red",
  backdrop,
  children,
  pathClassName,
  ref,
  pathRef,
}: SigilImageProps) {
  const figure = sigilFigure(text, layout, profile);
  const regions = Math.max(1, figure.plan.length);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      viewBox={figure.viewBox.join(" ")}
      ref={ref}
    >
      {children}
      {backdrop &&
        Array.from({ length: regions }, (_, i) =>
          backdrop({ x: -i * figure.frame.pitch, y: 0 }, i),
        )}
      <path
        stroke={stroke}
        strokeWidth={layout.unit}
        fill="none"
        className={pathClassName}
        ref={pathRef}
        d={figure.d}
      />
    </svg>
  );
}

export default SigilImage;
