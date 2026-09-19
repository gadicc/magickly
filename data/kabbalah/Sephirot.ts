import rows from "../dist/kabbalah/sephirot.json";
import type { Links, Raw } from "../types";

/** A sephirah's key, Da'at included. */
type SephirahId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type Sephirah = Raw<"sephirah"> & Partial<Links<"*", "sephirah">>;

/** Every sephirah, by key. */
type Sephirot = Record<SephirahId, Sephirah>;

export type { Sephirah, SephirahId, Sephirot };
export default rows;
