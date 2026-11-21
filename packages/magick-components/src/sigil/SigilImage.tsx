import type React from "react";
import { svgCoordinate } from "../svgCoordinate.ts";
import {
  type SigilFrame,
  sigilFrame,
  sigilSubpaths,
  sigilViewBox,
} from "./ink.ts";
import { type PlacementFailure, placeSigilWords } from "./placeSigil.ts";
import { planSigil, sigilWords } from "./planSigil.ts";
import type {
  PlacedWord,
  Point,
  SigilLayout,
  SigilPlan,
  SigilProfile,
} from "./types.ts";

/** A text's sigil worked out: its plan, its placed words and their paths. */
export interface SigilFigure {
  plan: SigilPlan;
  placed: PlacedWord[];
  /**
   * Per word, what its figure still fails of placement's checks (plan
   * 088's figure grammar): empty when every mark stands clear. A word
   * placement could not clear is drawn best effort and may be hard to read.
   */
  failures: (readonly PlacementFailure[])[];
  /**
   * Path data of every word's ink, a path per subpath in drawing order
   * (`sigilSubpaths`): each word's circle, strokes and marks, then its bar.
   */
  paths: string[];
  frame: SigilFrame;
  viewBox: [number, number, number, number];
}

/**
 * `text` planned (`planSigil`), placed by rule (`placeSigil`) and drawn
 * (`sigilSubpaths`) on `layout` under `profile`. Pure and deterministic:
 * the same figure on the server and in every browser.
 */
export function sigilFigure(
  text: string,
  layout: SigilLayout<string>,
  profile: SigilProfile,
): SigilFigure {
  const plan = planSigil(sigilWords(text), layout, profile);
  const words = placeSigilWords(plan, layout, profile);
  const placed = words.map((w) => w.word);
  const frame = sigilFrame(layout);
  return {
    plan,
    placed,
    failures: words.map((w) => w.failures),
    paths: sigilSubpaths(placed, layout, profile),
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
   * The ink's width, in layout coordinates: the profile's `strokeWidth`
   * unless given, and `layout.unit` (the figure grammar's one unit) when
   * the profile has none; written to 0.001, as the coordinates are.
   */
  strokeWidth?: number;
  /**
   * Drawn under the sigil, once per word region, given that word's offset
   * (the rose behind each word, say).
   */
  backdrop?: (offset: Point, index: number) => React.ReactNode;
  /** Drawn before everything else (a `<style>`, say). */
  children?: React.ReactNode;
  /** The `<svg>`. */
  ref?: React.Ref<SVGSVGElement>;
  /**
   * The group holding the sigil's paths, in drawing order (`SigilFigure`'s
   * `paths`), for a draw-on animation.
   */
  inkRef?: React.Ref<SVGGElement>;
  /**
   * The figure already worked out by `sigilFigure` for this text, layout
   * and profile, so a caller that needs it too (or keeps it between
   * renders) does not place the sigil twice.
   */
  figure?: SigilFigure;
  /** The `<svg>`'s width (CSS pixels for a number); none unless given. */
  width?: number | string;
  /** The `<svg>`'s height (CSS pixels for a number); none unless given. */
  height?: number | string;
  /** The `<svg>`'s class. */
  className?: string;
  /** The `<svg>`'s style. */
  style?: React.CSSProperties;
  /** The `<svg>`'s role (`img` for a named drawing). */
  role?: string;
  /** The `<svg>`'s accessible name. */
  "aria-label"?: string;
  /** Hides a decorative drawing from assistive technology. */
  "aria-hidden"?: boolean;
  /**
   * Written to the `<svg>` as is: `KameaSigil` marks a figure placement
   * could not clear with `failed`.
   */
  "data-placement"?: string;
}

/**
 * A sigil drawn by rule on any layout, with no hooks, so a server renderer
 * draws it with React's server build. Its only ink is stroked paths in
 * one group, a path per subpath in drawing order, the stroke `strokeWidth`
 * wide: by default the profile's, or `layout.unit`, so the figure
 * grammar's sizes hold.
 */
export function SigilImage({
  text,
  layout,
  profile,
  stroke = "red",
  strokeWidth = profile.strokeWidth ?? layout.unit,
  backdrop,
  children,
  ref,
  inkRef,
  figure = sigilFigure(text, layout, profile),
  width,
  height,
  className,
  style,
  role,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  "data-placement": placement,
}: SigilImageProps) {
  const regions = Math.max(1, figure.plan.length);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      viewBox={figure.viewBox.join(" ")}
      ref={ref}
      width={width}
      height={height}
      className={className}
      style={style}
      role={role}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      data-placement={placement}
    >
      {children}
      {backdrop &&
        Array.from({ length: regions }, (_, i) =>
          backdrop({ x: -i * figure.frame.pitch, y: 0 }, i),
        )}
      <g
        stroke={stroke}
        strokeWidth={svgCoordinate(strokeWidth)}
        fill="none"
        ref={inkRef}
      >
        {figure.paths.map((d, i) => (
          // Paths in drawing order, which a figure's text fixes.
          // biome-ignore lint/suspicious/noArrayIndexKey: the order is the identity.
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

export default SigilImage;
