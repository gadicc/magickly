import rows from "../dist/kabbalah/kerubim.json";
import type { Links, Raw } from "../types";

/** A kerub's key, which is its element. */
type KerubId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type Kerub = Raw<"kerub"> & Partial<Links<"*", "kerub">>;

/** Every kerub, by key. */
type Kerubim = Record<KerubId, Kerub>;

export type { Kerub, KerubId, Kerubim };
export default rows;
