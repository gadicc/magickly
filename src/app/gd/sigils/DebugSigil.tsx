"use client";
import { RoseSigilImage } from "magick-components/gd/RoseSigilImage";
import {
  type RoseVersionId,
  type SigilPoint,
  sigilPoints,
} from "magick-components/gd/roseSigilGeometry";
import { optimizeSigilPoints } from "magick-components/gd/roseSigilOptimizer";
import React from "react";

/**
 * The sigil page's Debug view: the sigil with each letter's circle and
 * the path before optimisation drawn as well, which `RoseSigil` drew
 * with its `debug` prop until the package dropped it before its first
 * publish (plan 080). Drawn optimised once the optimiser answers, and
 * not drawn on.
 */
export default function DebugSigil({
  text,
  showRose,
  version,
  ref,
}: {
  text: string;
  showRose: boolean;
  version?: RoseVersionId;
  ref?: React.Ref<SVGSVGElement>;
}) {
  const points = React.useMemo(
    () => sigilPoints(text, version),
    [text, version],
  );
  const [optimized, setOptimized] = React.useState<{
    from: SigilPoint[];
    to: SigilPoint[];
  } | null>(null);

  React.useEffect(() => {
    if (!points.length) return;
    let cancelled = false;
    optimizeSigilPoints(points).then(
      (to) => {
        if (!cancelled) setOptimized({ from: points, to });
      },
      (error) => console.error(error),
    );
    return () => {
      cancelled = true;
    };
  }, [points]);

  return (
    <RoseSigilImage
      text={text}
      showRose={showRose}
      version={version}
      debug
      points={optimized?.from === points ? optimized.to : points}
      ref={ref}
    />
  );
}
