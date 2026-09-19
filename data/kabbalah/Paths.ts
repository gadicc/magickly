import rows from "../dist/kabbalah/paths.json";
import type { Links, Raw } from "../types";

/** A path's key, `<from>_<to>` by the sephirot it joins. */
type PathId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type Path = Raw<"tolPath"> & Partial<Links<"*", "tolPath">>;

/** Every path, by key. */
type Paths = Record<PathId, Path>;

export type { Path, PathId, Paths };
export default rows;
