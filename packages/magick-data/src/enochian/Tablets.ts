import rows from "../../dist/enochian/tablets.js";
import type { Links, Raw } from "../types.ts";

/**
 * A tablet's key: the four Watchtowers by their elements (`earth`, `air`,
 * `water`, `fire`) and the Tablet of Union (`union`).
 */
type EnochianTabletID = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type EnochianTablet = Raw<"enochianTablet"> &
  Partial<Links<"*", "enochianTablet">>;

/** Every tablet the data has, by key. */
type EnochianTablets = Record<EnochianTabletID, EnochianTablet>;

/** The four Watchtowers, 13 rows of 12 letters, in the table's order. */
const WATCHTOWER_IDS: readonly ["earth", "air", "water", "fire"] =
  Object.freeze(["earth", "air", "water", "fire"] as const);

/** A Watchtower's key, its element. */
type EnochianWatchtowerID = (typeof WATCHTOWER_IDS)[number];

export type {
  EnochianTablet,
  EnochianTabletID,
  EnochianTablets,
  EnochianWatchtowerID,
};
export { WATCHTOWER_IDS };
export default rows;
