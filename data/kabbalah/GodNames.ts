import rows from "../dist/kabbalah/godNames.json";
import type { Links, Raw } from "../types";

/** A name's key. */
type GodNameId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type GodName = Raw<"godName"> & Partial<Links<"*", "godName">>;

/** Every god name, by key. */
type GodNames = Record<GodNameId, GodName>;

export type { GodName, GodNameId, GodNames };
export default rows;
