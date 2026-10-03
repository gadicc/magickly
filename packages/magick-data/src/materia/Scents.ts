import rows from "../../dist/materia/scents.js";
import type { Links, Raw } from "../types";

/** A perfume's or incense's key, as the sephirot are given them. */
type ScentId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type Scent = Raw<"scent"> & Partial<Links<"*", "scent">>;

/** Every scent, by key. */
type Scents = Record<ScentId, Scent>;

export type { Scent, ScentId, Scents };
export default rows;
