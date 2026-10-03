import rows from "../../dist/materia/stones.js";
import type { Links, Raw } from "../types";

/** A precious stone's key, as the sephirot are given them. */
type StoneId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type Stone = Raw<"stone"> & Partial<Links<"*", "stone">>;

/** Every stone, by key. */
type Stones = Record<StoneId, Stone>;

export type { Stone, StoneId, Stones };
export default rows;
