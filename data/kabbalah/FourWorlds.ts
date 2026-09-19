import rows from "../dist/kabbalah/fourWorlds.json";
import type { Links, Raw } from "../types";

/** A world's key. */
type FourWorldId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type FourWorld = Raw<"fourWorlds"> & Partial<Links<"*", "fourWorlds">>;

/** Every world, by key. */
type FourWorlds = Record<FourWorldId, FourWorld>;

export type { FourWorld, FourWorldId, FourWorlds };
export default rows;
