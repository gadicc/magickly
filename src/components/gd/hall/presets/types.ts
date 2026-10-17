import type { HallNode } from "../types";

/**
 * A ready-made hall (plan 061, Presets): a `gdHall` row tree, copied into a
 * ritual's source when inserted, with where its layout comes from. Layouts
 * are facts, drawn with the package's art, so presets are MIT.
 */
export interface HallPreset {
  /** A stable key, such as `zelator1`. */
  id: string;
  /** Its caption, such as "Zelator Temple 1". */
  title: string;
  /** The grade, as the rituals write it (`0=0`, `1=10`, `2=9`). */
  grade: string;
  /** Which part of the grade's ritual, for grades with more than one hall. */
  part?: number;
  /**
   * Stable references to what the layout follows: the book diagram (page
   * and archive.org leaf) and, for a preset ported from one, the drawing
   * in `public/pics`. Never empty. A book reference that covers only part
   * of the layout says which in parentheses at its end.
   */
  sources: readonly string[];
  hall: HallNode;
}

/** The archive.org item of Regardie's 1938 first edition, vol. 2. */
export const REGARDIE_1938 =
  "Regardie 1938, vol. 2, archive.org IsraelRegardie-TheGoldenDawn-Vol2-1938";

/**
 * The dais of every Outer grade: the Chiefs, the Hierophant and his
 * predecessor, spread evenly. `y` puts the lamens where a drawing has them
 * rather than centring the row, labels included, in the dais.
 */
export function dais(y?: number): HallNode {
  return {
    type: "dais",
    children: [
      "imperator",
      "cancellarius",
      "hierophant",
      "pastHierophant",
      "praemonstrator",
    ].map((role) =>
      y === undefined
        ? { type: "officer", role }
        : { type: "officer", role, y },
    ),
  };
}
