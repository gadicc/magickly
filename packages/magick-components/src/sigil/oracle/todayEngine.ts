/**
 * Today's engine as the oracle sees it (plan 088, S1): the sigil drawn the
 * way `/gd/sigils` and the `rose-sigil` image draw it, COBYLA on the
 * letters' places and then `RoseSigilImage` through them, with the rose
 * hidden so the SVG holds the sigil's ink alone. It goes away in S2, with
 * the optimiser.
 *
 * `drawToday` starts from the layout's anchors (rounded to 0.001), so a
 * 1-ulp nudge of the layout reaches the optimiser; `drawTodayAsPage`
 * starts from `letterPoint`, unrounded, exactly as the page does. The two
 * can differ (יבמיה's bead is in the page's drawing only), which is the
 * instability the 1-ulp check measures.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RoseSigilImage from "../../gd/RoseSigilImage.tsx";
import { roseLetters, sigilPoints } from "../../gd/roseSigilInternals.ts";
import { optimizeSigilPoints } from "../../gd/roseSigilOptimizer.ts";
import type { SigilLayout } from "../types.ts";

/**
 * `text` drawn by today's engine on a rose `layout`, as an SVG string. As
 * today, every letter of the text is one path: spaces are dropped, so
 * words are joined.
 */
export async function drawToday(
  text: string,
  layout: SigilLayout<string>,
): Promise<string> {
  const points = roseLetters(text).map((letter) => {
    const place = layout.place(letter);
    if (place === null) throw new Error(`drawToday: ${letter} has no place`);
    return layout.anchor(place);
  });
  return render(text, await optimizeSigilPoints(points));
}

/** `text` exactly as `/gd/sigils` draws it on the rose of `version` today. */
export async function drawTodayAsPage(
  text: string,
  version?: string,
): Promise<string> {
  return render(text, await optimizeSigilPoints(sigilPoints(text, version)));
}

function render(text: string, points: { x: number; y: number }[]): string {
  return renderToStaticMarkup(
    createElement(RoseSigilImage, {
      text,
      showRose: false,
      points,
    }),
  );
}
