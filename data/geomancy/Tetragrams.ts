import rows from "../dist/geomancy/tetragrams.json";
import type { Links, Raw } from "../types";

/** A figure's key. */
type TetragramID = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type Tetragram = Raw<"tetragram"> & Partial<Links<"*", "tetragram">>;

/** Every figure, by key. */
type Tetragrams = Record<TetragramID, Tetragram>;

export type { Tetragram, TetragramID, Tetragrams };
export default rows;
