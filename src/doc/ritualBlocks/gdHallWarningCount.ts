import type { HallNode } from "@magick-components/gd/hall/types";
import { validateHall } from "@magick-components/gd/hall/validate";
import { gdHallArt } from "@/app/gd/halls/art";

/**
 * How many findings `validateHall` has for a hall, with the app's art (so
 * anything the app draws counts as known): the ritual editor's warnings
 * badge on a hall outside edit mode (plan 061, Stage E notes). Loaded
 * lazily by the editor's node view only; the reader never reaches it.
 */
export function countHallWarnings(hall: HallNode): number {
  return validateHall(hall, { art: gdHallArt }).length;
}
