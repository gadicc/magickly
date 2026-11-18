"use client";
import React from "react";
import { RoseSigilImage } from "./RoseSigilImage.tsx";
import type { RoseVersionId } from "./roseSigilGeometry.ts";

export interface RoseSigilProps {
  /**
   * The text to draw. Whitespace separates words, each its own sigil (R2).
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
 * on the rose by plan 088's rules, placed by rule: the server and the
 * browser draw the same figure, with nothing to wait for. In the browser
 * the path is drawn on. A client component: the server-safe drawing is
 * `RoseSigilImage`.
 */
export function RoseSigil({
  text,
  showRose = true,
  version,
  animate = true,
  ref,
}: RoseSigilProps) {
  const pathRef = React.useRef<SVGPathElement>(null);
  // useId yields ":r1:"-style ids; CSS identifiers need the colons removed.
  const animation = `rose-sigil-draw-${React.useId().replace(/[^\w-]/g, "")}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new text or rose is a new path to draw on.
  React.useEffect(() => {
    const path = pathRef.current;
    // jsdom has no path geometry; there is nothing to draw on.
    if (!path || typeof path.getTotalLength !== "function") return;
    const length = path.getTotalLength();
    path.style.strokeDasharray = animate ? length.toString() : "";
    path.style.strokeDashoffset = animate ? length.toString() : "";
    path.classList.remove(animation);
    // @ts-expect-error: trick to trigger reflow
    void path.offsetWidth;
    if (animate) path.classList.add(animation);
  }, [animate, animation, text, version]);

  return (
    <RoseSigilImage
      text={text}
      showRose={showRose}
      version={version}
      animation={animate ? animation : undefined}
      ref={ref}
      pathRef={pathRef}
    />
  );
}

export default RoseSigil;
