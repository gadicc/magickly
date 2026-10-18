import { estimateHallAspect } from "@magick-components/gd/hall/aspect";
import type { HallNode } from "@magick-components/gd/hall/types";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import styles from "./frames.module.css";

/**
 * Holds the hall's place while it loads, at the shape the frame's
 * `--gd-hall-aspect` estimates, so the text below barely moves.
 */
function HallPlaceholder() {
  return <div className={styles.hallPlaceholder} aria-hidden="true" />;
}

/**
 * The renderer, the app's art and the hall fonts load only for rituals that
 * contain a hall (plan 061, decision 1). The server draws the hall in full:
 * in the same response, after the placeholder, when the drawing exceeds
 * React's progressive chunk size (it does), swapped in by React's inline
 * script. `next/dynamic` also links the chunk's CSS (the Enochian face) and
 * preloads its script, and hydration keeps the server's drawing.
 */
const GdHallDrawing = dynamic(() => import("./GdHallDrawing"), {
  loading: HallPlaceholder,
});

/**
 * A temple hall diagram, for the reader and the editor alike. `hall` is the
 * compiled `gdHall` row; its content is untrusted and the renderer draws
 * what it can of it.
 */
export function GdHallFrame({ hall }: { hall: HallNode }) {
  // `next/dynamic` gives its placeholder no props: the shape goes by CSS.
  const style = {
    "--gd-hall-aspect": estimateHallAspect(hall).toFixed(4),
  } as CSSProperties;
  return (
    <figure data-ritual-frame="gdHall" className={styles.hall} style={style}>
      <GdHallDrawing hall={hall} />
    </figure>
  );
}
