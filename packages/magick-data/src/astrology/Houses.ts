import rows from "../../dist/astrology/houses.js";
import type { Links, Raw } from "../types.ts";

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type House = Raw<"astrologicalHouse"> &
  Partial<Links<"*", "astrologicalHouse">>;

/** The twelve houses, in order. */
type Houses = readonly House[];

export type { House, Houses };
export default rows;
