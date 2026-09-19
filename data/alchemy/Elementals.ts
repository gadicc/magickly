import rows from "../dist/alchemy/elementals.json";
import type { Links, Raw } from "../types";

/** An elemental's key. */
type ElementalId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type Elemental = Raw<"elemental"> & Partial<Links<"*", "elemental">>;

/** Every elemental, by key. */
type Elementals = Record<ElementalId, Elemental>;

export type { Elemental, ElementalId, Elementals };
export default rows;
