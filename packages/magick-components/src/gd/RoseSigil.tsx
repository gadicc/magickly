"use client";
import React from "react";
import { RoseSigilImage } from "./RoseSigilImage.tsx";
import { type RoseVersionId, roseLetters } from "./roseSigilGeometry.ts";

export interface RoseSigilProps {
  /**
   * The text to draw. Whitespace separates words, each its own sigil.
   * Final forms are drawn as their base letters, and anything else not one
   * of the 22 letters (points, Latin) is left out.
   */
  text: string;
  /** Draws the rose's three rings of letters behind the sigil. */
  showRose?: boolean;
  /**
   * Which rose the sigil is traced on (`ROSE_VERSIONS`): the Golden
   * Dawn's (`gd`) when not given or not a version, or Regardie's of 1939
   * (`regardie1939`), which exchanges Kaph and Tau. `ROSE_VERSION_NOTES`
   * says where each comes from.
   */
  version?: RoseVersionId;
  /** Draws the sigil's path on after it renders. */
  animate?: boolean;
  /** The `<svg>`, for exporting the drawing. */
  ref?: React.Ref<SVGSVGElement>;
}

/**
 * The rose-cross sigil of a Hebrew text, drawn through the letters' places
 * on the rose by the Golden Dawn's rules (Regardie, *The Golden Dawn*,
 * vol. 4, p. 57): the server and the browser draw the same figure, and in
 * the browser the path is drawn on. A client component: the server-safe
 * drawing is `RoseSigilImage`.
 */
export function RoseSigil({
  text,
  showRose = true,
  version,
  animate = true,
  ref,
}: RoseSigilProps) {
  const inkRef = React.useRef<SVGGElement>(null);
  // useId yields ":r1:"-style ids; CSS identifiers need the colons removed.
  const animation = `rose-sigil-draw-${React.useId().replace(/[^\w-]/g, "")}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new text or rose is a new figure to draw on.
  React.useEffect(() => {
    const paths = [...(inkRef.current?.querySelectorAll("path") ?? [])];
    // jsdom has no path geometry; there is nothing to draw on.
    if (paths.some((path) => typeof path.getTotalLength !== "function")) return;
    // A browser starts a dash pattern afresh at each path, so each is drawn
    // on in its turn: its share of the whole, a quarter second a letter,
    // after the paths before it.
    const lengths = paths.map((path) => path.getTotalLength());
    const total = lengths.reduce((sum, length) => sum + length, 0) || 1;
    const seconds = roseLetters(text).length / 4;
    let before = 0;
    paths.forEach((path, i) => {
      const length = lengths[i];
      path.style.animation = "";
      path.style.strokeDasharray = animate ? `${length}` : "";
      path.style.strokeDashoffset = animate ? `${length}` : "";
      // @ts-expect-error: trick to trigger reflow
      void path.offsetWidth;
      if (animate)
        path.style.animation = `${animation} ${(seconds * length) / total}s linear ${(seconds * before) / total}s forwards`;
      before += length;
    });
  }, [animate, animation, text, version]);

  // Placing a sigil is work (tens of milliseconds for a long word): a
  // parent's re-render with the same props keeps the drawing it has.
  return React.useMemo(
    () => (
      <RoseSigilImage
        text={text}
        showRose={showRose}
        version={version}
        animation={animate ? animation : undefined}
        ref={ref}
        inkRef={inkRef}
      />
    ),
    [text, showRose, version, animate, animation, ref],
  );
}

export default RoseSigil;
