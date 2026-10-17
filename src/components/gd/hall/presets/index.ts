import { neophyte } from "./neophyte";
import { theoricus1, theoricus2 } from "./theoricus";
import type { HallPreset } from "./types";
import { zelator1, zelator2 } from "./zelator";

export { dais, type HallPreset } from "./types";
export { neophyte, theoricus1, theoricus2, zelator1, zelator2 };

/** Every preset, in the order of the grades. */
export const HALL_PRESETS: readonly HallPreset[] = [
  neophyte,
  zelator1,
  zelator2,
  theoricus1,
  theoricus2,
];

/** A preset by id; `undefined` for any other string. */
export function hallPreset(id: string): HallPreset | undefined {
  return HALL_PRESETS.find((preset) => preset.id === id);
}
