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

// A node header line: optional `* `, a tag or role label, then its `#id`.
// Pipe text (`| …`) and inline `#[tag#id …]` never start a line this way.
const header = /^( *)(?:\* )?[A-Za-z][A-Za-z0-9,-]*#([A-Za-z0-9-]+)/;

/** The ID a source line declares as a node header, if any. */
export function ritualPugHeaderId(line: string): string | null {
  return header.exec(line)?.[2] ?? null;
}

/**
 * The ID of the node whose source encloses a 1-based line: the line's own
 * header, or the nearest header above it at a shallower indentation. A cheap
 * line scan, suitable for every caret move; null when nothing encloses it.
 */
export function ritualPugNodeIdAtLine(
  lineText: (line: number) => string,
  line: number,
): string | null {
  const at = lineText(line);
  const own = ritualPugHeaderId(at);
  if (own) return own;
  let limit = at.trim() ? at.length - at.trimStart().length : Infinity;
  for (let n = line - 1; n >= 1 && limit > 0; n--) {
    const text = lineText(n);
    if (!text.trim()) continue;
    const width = text.length - text.trimStart().length;
    if (width >= limit) continue;
    const id = ritualPugHeaderId(text);
    if (id) return id;
    limit = width;
  }
  return null;
}

/** 1-based line whose header declares `id`, or null. */
export function ritualPugLineOfId(source: string, id: string): number | null {
  const index = source
    .split("\n")
    .findIndex((line) => ritualPugHeaderId(line) === id);
  return index < 0 ? null : index + 1;
}
