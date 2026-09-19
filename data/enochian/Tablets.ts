import rows from "../dist/enochian/tablets.json";
import type { Links, Raw } from "../types";

/** A tablet's key. Only the two with grid data are here. */
type EnochianTabletID = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type EnochianTablet = Raw<"enochianTablet"> &
  Partial<Links<"*", "enochianTablet">>;

/** Every tablet the data has, by key. */
type EnochianTablets = Record<EnochianTabletID, EnochianTablet>;

export type { EnochianTablet, EnochianTabletID, EnochianTablets };
export default rows;
