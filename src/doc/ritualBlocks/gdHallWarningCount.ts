import type { HallNode } from "@magick-components/gd/hall/types";
import { validateHall } from "@magick-components/gd/hall/validate";
import { gdHallArt } from "@/app/gd/hall/art";

/**
 * How many findings `validateHall` has for a hall, with the app's art (so
 * the legacy items count as known): the ritual editor's warnings badge on
 * a hall outside edit mode (plan 061, Stage E notes). Loaded lazily by the
 * editor's node view only; the reader never reaches it.
 */
export function countHallWarnings(hall: HallNode): number {
  return validateHall(hall, { art: gdHallArt }).length;
}
