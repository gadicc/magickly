import type React from "react";
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
}

/**
 * A sigil drawn by rule on any layout, with no hooks, so a server renderer
 * draws it with React's server build. Its only ink is stroked paths in
 * one group, a path per subpath in drawing order, the stroke
 * `layout.unit` wide, so the figure grammar's sizes hold.
 */
export function SigilImage({
  text,
  layout,
  profile,
  stroke = "red",
  backdrop,
  children,
  ref,
  inkRef,
  figure = sigilFigure(text, layout, profile),
}: SigilImageProps) {
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
      <g stroke={stroke} strokeWidth={layout.unit} fill="none" ref={inkRef}>
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
