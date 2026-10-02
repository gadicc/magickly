import lex from "pug-lexer";

// Indentation can expand a saveable 1 MiB semantic tree by several MiB.
export const RITUAL_PUG_MAX_SOURCE_LENGTH = 8 * 1_048_576;

/** Bound Pug's recursive inline lexer before it reaches the semantic validator. */
export function lexRitualPug(source: string): lex.Token[] {
  if (source.length > RITUAL_PUG_MAX_SOURCE_LENGTH)
    throw new Error("Ritual source is too large");
  let nesting = 0;
  let textCalls = 0;
  class BoundedLexer extends lex.Lexer {
    override getTokens() {
      if (++nesting > 101)
        throw new Error("Ritual source is too deeply nested");
      try {
        return super.getTokens();
      } finally {
        nesting--;
      }
    }
    override addText(...args: Parameters<lex.Lexer["addText"]>) {
      // addText also recurses across sibling interpolations and escaped text.
      if (++textCalls > 512)
        throw new Error("Ritual source line is too complex");
      try {
        return super.addText(...args);
      } finally {
        textCalls--;
      }
    }
  }
  const tokens = new BoundedLexer(source).getTokens();
  if (tokens.length > 200_000) throw new Error("Ritual source is too large");
  return tokens;
}
