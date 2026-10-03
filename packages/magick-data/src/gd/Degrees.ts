import rows from "../../dist/gd/degrees.js";
import type { Links, Raw } from "../types";

/** A degree's key: the three, each on a pillar of the Tree. */
type GDDegreeId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type GDDegree = Raw<"gdDegree"> & Partial<Links<"*", "gdDegree">>;

/** Every degree, by key. */
type GDDegrees = Record<GDDegreeId, GDDegree>;

export type { GDDegree, GDDegreeId, GDDegrees };
export default rows;
