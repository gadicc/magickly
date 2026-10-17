import { svgCoordinate } from "../../../svgCoordinate";

/** SVG `points` for a polygon, rounded so server and browser agree. */
export function points(list: readonly (readonly [number, number])[]): string {
  return list
    .map(([x, y]) => `${svgCoordinate(x)},${svgCoordinate(y)}`)
    .join(" ");
}

/**
 * An equilateral triangle of circumradius `r` with its centroid on the
 * origin, pointing up or down.
 */
export function triangle(r: number, dir: "up" | "down") {
  const s = dir === "up" ? -1 : 1;
  const half = r * Math.sin(Math.PI / 3);
  return points([
    [0, s * r],
    [-half, (-s * r) / 2],
    [half, (-s * r) / 2],
  ]);
}
