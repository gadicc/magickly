import rows from "../dist/alchemy/elements.json";
import type { Links, Raw } from "../types";

/** An element's key: the four, and spirit. */
type ElementId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type Element = Raw<"element"> & Partial<Links<"*", "element">>;

/** Every element, by key. */
type Elements = Record<ElementId, Element>;

export type { Element, ElementId, Elements };
export default rows;
