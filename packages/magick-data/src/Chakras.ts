import rows from "../dist/chakras.js";
import type { Links, Raw } from "./types";

/** A chakra's key: the seven, root to crown. */
type ChakraId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type Chakra = Raw<"chakra"> & Partial<Links<"*", "chakra">>;

/** Every chakra, by key. */
type Chakras = Record<ChakraId, Chakra>;

export type { Chakra, ChakraId, Chakras };
export default rows;
