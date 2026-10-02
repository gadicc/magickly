import { isRitualNodeId } from "./ritualNodeIds";
import { lexRitualPug } from "./ritualPugLex";

/** Exact source span of a lexer-owned #id, excluding lookalikes in text or attributes. */
export interface RitualPugIdRange {
  from: number;
  to: number;
  id: string;
}

/** Incomplete source returns null so a source view can retain its mapped decorations. */
export function ritualPugIdRanges(source: string): RitualPugIdRange[] | null {
  try {
    const starts = [0];
    for (let n = 0; n < source.length; n++)
      if (source[n] === "\n") starts.push(n + 1);
    return lexRitualPug(source)
      .filter(
        (token): token is Extract<typeof token, { type: "id" }> =>
          token.type === "id" && isRitualNodeId(token.val),
      )
      .map((token) => {
        const from =
          starts[token.loc.start.line - 1] + token.loc.start.column - 1;
        return { from, to: from + token.val.length + 1, id: token.val };
      });
  } catch {
    return null;
  }
}
