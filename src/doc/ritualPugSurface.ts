/** Owned source conveniences, expanded before the bounded Pug lexer runs. */
export interface RitualPugSurface {
  source: string;
  /** Map expanded lexer coordinates back to the author's source. */
  location(line: number, column: number): { line: number; column: number };
}

type Edit = { from: number; to: number; value: string };
const pugTags = new Set([
  "a",
  "b",
  "br",
  "declareVar",
  "footnote",
  "footnotes",
  "grade",
  "i",
  "img",
  "li",
  "note",
  "option",
  "summary",
  "task",
  "title",
  "todo",
  "ul",
  "ol",
  "var",
  "hr",
  "say",
  "do",
  "ritualText",
  "ritualLegacy",
  "ritualComment",
  "ritualBlank",
]);
/** Known Pug tags retain their existing colon block-expansion syntax. */
export function canPrintRoleShortcut(value: string): boolean {
  return value === shortcutRole(value) && !pugTags.has(value);
}

const role = "[A-Za-z][A-Za-z0-9,-]*";
const speech = new RegExp(`^(${role})(#[A-Za-z0-9-]+)?: ?(.*)$`);
const action = new RegExp(`^\\* (${role})(#[A-Za-z0-9-]+)?(?: (.*))?$`);

/** Match the historic role shorthand without changing explicitly authored Pug roles. */
export function shortcutRole(value: string): string {
  return value
    .split(",")
    .map((part) => part[0].toLowerCase() + part.slice(1))
    .join(",");
}

/** Preserve author annotations and expand only whole-line task shortcuts. */
export function ritualPugSurface(
  source: string,
  protectedLines: ReadonlySet<number> = new Set(),
): RitualPugSurface {
  const input = source.replace(/\r\n?/g, "\n").split("\n");
  // A terminal newline is the source envelope, not an extra blank separator.
  if (input.at(-1) === "") input.pop();
  const output: string[] = [];
  const records: { line: number; edits: Edit[] }[] = [];
  const nextIndent = new Array<number>(input.length).fill(0);
  let next = 0;
  for (let i = input.length - 1; i >= 0; i--) {
    nextIndent[i] = next;
    if (input[i].trim()) next = input[i].match(/^ */)![0].length;
  }
  for (let i = 0; i < input.length; i++) {
    const originalLine = i + 1;
    const full = input[i];
    const indent = full.match(/^ */)![0].length;
    const body = full.slice(indent);
    const edits: Edit[] = [];
    if (protectedLines.has(originalLine)) {
      // Multiline attributes and pipeless text belong to Pug's own lexer.
    } else if (!body.trim()) {
      // Unindented separators follow the next block; explicitly indented ones
      // retain their parent, including separators at the end of a collection.
      edits.push({
        from: 0,
        to: full.length,
        value: `${" ".repeat(Math.max(indent, nextIndent[i]))}ritualBlank/`,
      });
    } else if (body.startsWith("//-")) {
      let text = body.slice(3).replace(/^ /, "");
      while (i + 1 < input.length) {
        const following = input[i + 1];
        const spaces = following.match(/^ */)![0].length;
        if (
          spaces <= indent &&
          (following.trim() || nextIndent[i + 1] <= indent)
        )
          break;
        text += `\n${following.slice(Math.min(spaces, indent + 2))}`;
        i++;
      }
      edits.push({
        from: indent,
        to: full.length,
        value: `ritualComment(value=${JSON.stringify(text)})/`,
      });
    } else {
      const candidate = speech.exec(body);
      const say = candidate && !pugTags.has(candidate[1]) ? candidate : null;
      const doTask = action.exec(body);
      const match = say ?? doTask;
      if (match) {
        const start = indent + (say ? 0 : 2);
        if (!say) edits.push({ from: indent, to: start, value: "" });
        edits.push({
          from: start,
          to: start + match[1].length,
          value: say ? "say" : "do",
        });
        const afterId = start + match[1].length + (match[2]?.length ?? 0);
        edits.push({
          from: afterId,
          to: afterId + (say ? (full[afterId + 1] === " " ? 2 : 1) : 0),
          value: `(role=${JSON.stringify(shortcutRole(match[1]))})${say ? " " : ""}`,
        });
      }
    }
    let expanded = "";
    let cursor = 0;
    for (const edit of edits) {
      expanded += full.slice(cursor, edit.from) + edit.value;
      cursor = edit.to;
    }
    expanded += full.slice(cursor);
    output.push(expanded);
    records.push({ line: originalLine, edits });
  }
  return {
    source: output.join("\n"),
    location(line, column) {
      const record = records[line - 1];
      if (!record) return { line: input.length + 1, column };
      const position = column - 1;
      let delta = 0;
      for (const edit of record.edits) {
        const start = edit.from + delta;
        if (position < start) break;
        if (position < start + edit.value.length)
          return { line: record.line, column: edit.from + 1 };
        delta += edit.value.length - (edit.to - edit.from);
      }
      return { line: record.line, column: position - delta + 1 };
    },
  };
}
