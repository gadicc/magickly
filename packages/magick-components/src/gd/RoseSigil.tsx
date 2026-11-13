"use client";
import React from "react";
import { RoseSigilImage } from "./RoseSigilImage.tsx";
import { type Point, sigilPoints } from "./roseSigilGeometry.ts";
import { optimizeSigilPoints } from "./roseSigilOptimizer.ts";

export interface RoseSigilProps {
  /**
   * The text to draw. Final forms are drawn as their base letters, and
   * anything not one of the 22 letters (spaces, points, Latin) is left out.
   */
  sigilText: string;
  /** Draws the rose's three rings of letters behind the sigil. */
  showRose?: boolean;
  /** Draws the connecting path on, once the layout is optimised. */
  animate?: boolean;
  /** Draws each letter's circle and the unoptimised path too. */
  debug?: boolean;
  /** The `<svg>`, for exporting the drawing. */
  ref?: React.Ref<SVGSVGElement>;
}

/**
 * The rose-cross sigil of a Hebrew text, drawn through the letters' places
 * on the rose. It renders the letter centres first, on the server too, then
 * spreads repeated and aligned letters with the optimiser once in the
 * browser, and draws the path on. A client component: the server-safe
 * drawing is `RoseSigilImage`.
 */
export default function RoseSigil({
  sigilText,
  showRose = true,
  animate = true,
  debug = false,
  ref,
}: RoseSigilProps) {
  const pathRef = React.useRef<SVGPathElement>(null);
  // useId yields ":r1:"-style ids; CSS identifiers need the colons removed.
  const animation = `rose-sigil-draw-${React.useId().replace(/[^\w-]/g, "")}`;
  const points = React.useMemo(() => sigilPoints(sigilText), [sigilText]);
  const [optimized, setOptimized] = React.useState<Point[] | null>(null);

  React.useEffect(() => {
    if (!points.length) return;
    let cancelled = false;
    optimizeSigilPoints(points).then(
      (result) => {
        if (!cancelled) setOptimized(result);
      },
      // Without the optimiser (its WASM failed to load) the sigil keeps
      // the letter centres it was first drawn with.
      (error) => console.error(error),
    );
    return () => {
      cancelled = true;
    };
  }, [points]);

  React.useEffect(() => {
    if (pathRef.current && optimized) {
      const length = pathRef.current.getTotalLength();
      pathRef.current.style.strokeDasharray = animate ? length.toString() : "";
      pathRef.current.style.strokeDashoffset = animate ? length.toString() : "";
      pathRef.current.classList.remove(animation);
      // @ts-expect-error: trick to trigger reflow
      void pathRef.current.offsetWidth;
      if (animate) pathRef.current.classList.add(animation);
    }
  }, [animate, animation, optimized]);

  return (
    <RoseSigilImage
      sigilText={sigilText}
      showRose={showRose}
      debug={debug}
      points={optimized || points}
      animation={animate ? animation : undefined}
      svgRef={ref}
      pathRef={pathRef}
    />
  );
}
