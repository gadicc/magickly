import type { HallArtBox } from "@magick-components/gd/hall";

/** Presentation attributes of one path of a legacy drawing. */
export interface LegacyStyle {
  /** A colour, or `"glass"` for the caller to fill (the lamp's panes). */
  fill?: string;
  fillRule?: "evenodd";
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeLinejoin?: "round" | "bevel";
  strokeLinecap?: "round" | "square";
  strokeOpacity?: number;
  opacity?: number;
}

/**
 * A drawing lifted from the hall drawings in `public/pics`: flat paths
 * centred on the origin, 100 units on the longer side, with their styles
 * shared by index.
 */
export interface LegacyDrawing {
  box: HallArtBox;
  styles: readonly LegacyStyle[];
  paths: readonly (readonly [style: number, d: string])[];
}

/** Draws a legacy drawing; `glass` fills the paths styled `"glass"`. */
export function LegacyPaths({
  drawing,
  glass = "none",
}: {
  drawing: LegacyDrawing;
  glass?: string;
}) {
  return (
    <>
      {drawing.paths.map(([index, d], order) => {
        const { fill = "#000000", ...style } = drawing.styles[index];
        return (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: a static drawing, never reordered
            key={order}
            d={d}
            fill={fill === "glass" ? glass : fill}
            {...style}
          />
        );
      })}
    </>
  );
}
