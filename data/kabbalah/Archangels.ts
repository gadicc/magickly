import rows from "../dist/kabbalah/archangels.json";
import type { Links, Raw } from "../types";

/** An archangel's key. */
type ArchangelId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type Archangel = Raw<"archangel"> & Partial<Links<"*", "archangel">>;

/** Every archangel, by key. */
type Archangels = Record<ArchangelId, Archangel>;

export type { Archangel, ArchangelId, Archangels };
export default rows;
