import lex from "pug-lexer";
import { ritualPugSurface } from "./ritualPugSurface";

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
  const protectedLines = new Set<number>();
  class ContextLexer extends BoundedLexer {
    override callLexerFunction(func: string, ...args: unknown[]) {
      // Pug owns literal/attribute contexts: their contents never reach advance.
      // Expand a task only when the lexer is at the start of an authored line.
      if (
        func === "advance" &&
        this.colno === (this.indentStack[0] ?? 0) + 1 &&
        this.input[0] !== "\n"
      ) {
        const end = this.input.indexOf("\n");
        const line = this.input.slice(0, end < 0 ? undefined : end);
        if (/^(?:[A-Za-z][A-Za-z0-9,-]*(?:#[A-Za-z0-9-]+)?:|\* )/.test(line)) {
          const expanded = ritualPugSurface(line).source;
          this.input = expanded + (end < 0 ? "" : this.input.slice(end));
        }
      }
      return Reflect.apply(super.callLexerFunction, this, [func, ...args]);
    }
    override attrs(...args: Parameters<lex.Lexer["attrs"]>) {
      const start = this.lineno;
      const result = super.attrs(...args);
      for (let line = start + 1; line <= this.lineno; line++)
        protectedLines.add(line);
      return result;
    }
    override pipelessText(...args: Parameters<lex.Lexer["pipelessText"]>) {
      const start = this.lineno;
      const comment = this.tokens.at(-1)?.type === "comment";
      const result = super.pipelessText(...args);
      if (!comment)
        for (let line = start + 1; line <= this.lineno; line++)
          protectedLines.add(line);
      return result;
    }
  }
  const contextTokens = new ContextLexer(source).getTokens();
  if (contextTokens.length > 200_000)
    throw new Error("Ritual source is too large");
  // Adjacent pipe-text lines have reader-significant newline semantics in Pug,
  // even across blank source lines. Keep those separators in Pug's context.
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let previous = -1;
  for (let n = 0; n < lines.length; n++) {
    if (!lines[n].trim()) continue;
    if (
      previous >= 0 &&
      /^ *\|(?: |$)/.test(lines[previous]) &&
      /^ *\|(?: |$)/.test(lines[n]) &&
      lines[previous].match(/^ */)![0].length ===
        lines[n].match(/^ */)![0].length
    )
      for (let gap = previous + 1; gap < n; gap++) protectedLines.add(gap + 1);
    previous = n;
  }
  const surface = ritualPugSurface(source, protectedLines);
  let tokens: lex.Token[];
  try {
    tokens = new BoundedLexer(surface.source).getTokens();
  } catch (error) {
    if (typeof error?.line === "number")
      error.line = surface.location(error.line, 1).line;
    throw error;
  }
  for (const token of tokens) {
    token.loc.start = surface.location(
      token.loc.start.line,
      token.loc.start.column,
    );
    token.loc.end = surface.location(token.loc.end.line, token.loc.end.column);
  }
  if (tokens.length > 200_000) throw new Error("Ritual source is too large");
  return tokens;
}
