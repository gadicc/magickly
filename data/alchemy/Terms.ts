import rows from "../dist/alchemy/terms.json";
import type { Links, Raw } from "../types";

/** A term's key. */
type AlchemyTermID = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type AlchemyTerm = Raw<"alchemyTerm"> & Partial<Links<"*", "alchemyTerm">>;

/** Every alchemical term, by key. */
type AlchemyTerms = Record<AlchemyTermID, AlchemyTerm>;

export type { AlchemyTerm, AlchemyTermID, AlchemyTerms };
export default rows;
