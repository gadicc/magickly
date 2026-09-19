import rows from "../dist/geomancy/houses.json";
import type { Links, Raw } from "../types";

/** A house of a reading, keyed by its own number rather than an index. */
type HouseId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type House = Raw<"geomanicHouse"> & Partial<Links<"*", "geomanicHouse">>;

/** Every house, by number. */
type Houses = Record<HouseId, House>;

export type { House, HouseId, Houses };
export default rows;
