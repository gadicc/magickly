import { neophyte } from "./neophyte";
import {
  philosophus1,
  philosophus2,
  philosophus3,
  philosophus4,
} from "./philosophus";
import { portal1, portal2 } from "./portal";
import { practicus1, practicus2, practicus3 } from "./practicus";
import { theoricus1, theoricus2 } from "./theoricus";
import type { HallPreset } from "./types";
import { zelator1, zelator2 } from "./zelator";

export {
  dais,
  HALL_SOURCE_WORKS,
  type HallPreset,
  type HallPresetSource,
  type HallSourceWork,
  hallSourceCitation,
  hallSourceText,
  hallSourceUrl,
} from "./types";
export {
  neophyte,
  philosophus1,
  philosophus2,
  philosophus3,
  philosophus4,
  portal1,
  portal2,
  practicus1,
  practicus2,
  practicus3,
  theoricus1,
  theoricus2,
  zelator1,
  zelator2,
};

/** Every preset, in the order of the grades. */
export const HALL_PRESETS: readonly HallPreset[] = [
  neophyte,
  zelator1,
  zelator2,
  theoricus1,
  theoricus2,
  practicus1,
  practicus2,
  practicus3,
  philosophus1,
  philosophus2,
  philosophus3,
  philosophus4,
  portal1,
  portal2,
];

/** A preset by id; `undefined` for any other string. */
export function hallPreset(id: string): HallPreset | undefined {
  return HALL_PRESETS.find((preset) => preset.id === id);
}
