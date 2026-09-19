import rows from "../dist/alchemy/symbols.json";
import type { Links, Raw } from "../types";

/** A symbol's key. */
type AlchemySymbolID = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type AlchemySymbol = Raw<"alchemySymbol"> &
  Partial<Links<"*", "alchemySymbol">>;

/** Every alchemical symbol, by key. */
type AlchemySymbols = Record<AlchemySymbolID, AlchemySymbol>;

export type { AlchemySymbol, AlchemySymbolID, AlchemySymbols };
export default rows;
