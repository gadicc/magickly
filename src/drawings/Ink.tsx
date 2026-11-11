import type { ReactNode } from "react";
import styles from "./ink.module.css";

/** The drawings whose black line art the dark scheme re-inks. */
export type InkDrawing =
  | "tetragram"
  | "geomancyChart"
  | "pentagram"
  | "spirit"
  | "candlestick"
  | "shewbread"
  | "roseSigil"
  | "chakras"
  | "lamen"
  | "tree";

/**
 * The class that re-inks `drawing` in the dark scheme, for an element that
 * already wraps it. It selects inside the drawing's `<svg>` by what the
 * drawing already has, so the `<svg>` itself, and with it every export and
 * server image, stays as it is (plan 076, decision 4).
 */
export function inkClass(drawing: InkDrawing): string {
  return styles[drawing];
}

/**
 * Re-inks the drawing inside it in the dark scheme. It draws no box
 * (`display: contents`), so light layout does not move; use `inkClass` on
 * an existing wrapper instead where one is there.
 */
export default function Ink({
  drawing,
  children,
}: {
  drawing: InkDrawing;
  children: ReactNode;
}) {
  return (
    <span className={`${styles.wrap} ${styles[drawing]}`}>{children}</span>
  );
}
