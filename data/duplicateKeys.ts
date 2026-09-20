/**
 * A key written twice in one JSON5 object, which nothing else can see.
 *
 * JSON5 keeps the last of a repeated key and says nothing, so the parsed
 * object is well formed and every check downstream — the schemas, the graph,
 * the types — is looking at data the source does not quite say. `amissio`
 * carried two `title` keys through a full rewrite that way, the first of them
 * dead (plan 032, step 1); it was found by hand.
 *
 * This is therefore a scan of the text rather than of the parse: strings,
 * comments and nesting are tracked well enough to know which token is a key
 * and which object it belongs to. It is not a parser and does not validate —
 * JSON5 itself does that, on the same files, in [the build](./build.mts).
 *
 * [integrity.ts](./integrity.ts) runs it over every source, so `pnpm
 * data:check` and the test suite both see a duplicate.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = fileURLToPath(new URL(".", import.meta.url));

/** One key written twice in the same object. */
export interface Duplicate {
  /** The source it is in, relative to `data/`. */
  file: string;
  /** The dotted path of the object holding it; empty at the top level. */
  path: string;
  /** The key, as written. */
  key: string;
}

type Kind = "{" | "}" | "[" | "]" | ":" | "," | "text";

interface Token {
  kind: Kind;
  text: string;
}

const PUNCT = "{}[]:,";
const SPACE = /\s/;
/** What ends an unquoted key, a number or a keyword. */
const BREAK = /[\s{}[\]:,/'"]/;

/** The source as tokens, with whitespace and comments dropped. */
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const c = source[i];
    if (SPACE.test(c)) i++;
    else if (c === "/" && source[i + 1] === "/") {
      const end = source.indexOf("\n", i);
      i = end === -1 ? source.length : end + 1;
    } else if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? source.length : end + 2;
    } else if (c === '"' || c === "'") {
      let text = "";
      i++;
      while (i < source.length && source[i] !== c) {
        // An escape is kept as written: nothing here needs the value, only
        // that two spellings of one key compare equal.
        if (source[i] === "\\") text += source[i++];
        text += source[i++];
      }
      i++;
      tokens.push({ kind: "text", text });
    } else if (PUNCT.includes(c)) {
      tokens.push({ kind: c as Kind, text: c });
      i++;
    } else {
      const start = i;
      while (i < source.length && !BREAK.test(source[i])) i++;
      // A character that begins nothing at all is stepped over.
      if (i === start) i++;
      else tokens.push({ kind: "text", text: source.slice(start, i) });
    }
  }

  return tokens;
}

/** An object or array being walked, and where it sits. */
interface Frame {
  path: string;
  /** The keys seen so far; absent where the frame is an array. */
  keys?: Set<string>;
  /** How many elements of an array have gone past, for the path. */
  index: number;
}

/** Every key repeated within one object of this JSON5 text, in source order. */
export function duplicateKeys(source: string): Array<Omit<Duplicate, "file">> {
  const found: Array<Omit<Duplicate, "file">> = [];
  const tokens = tokenize(source);
  const stack: Frame[] = [];
  /** The key the next `{` or `[` will be the value of. */
  let key = "";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const top = stack[stack.length - 1];

    if (token.kind === "{" || token.kind === "[") {
      const step = !top ? "" : top.keys ? key : String(top.index);
      stack.push({
        path: top ? [top.path, step].filter(Boolean).join(".") : "",
        keys: token.kind === "{" ? new Set() : undefined,
        index: 0,
      });
      key = "";
    } else if (token.kind === "}" || token.kind === "]") stack.pop();
    else if (token.kind === "," && top && !top.keys) top.index++;
    else if (
      token.kind === "text" &&
      tokens[i + 1]?.kind === ":" &&
      top?.keys
    ) {
      if (top.keys.has(token.text))
        found.push({ path: top.path, key: token.text });
      else top.keys.add(token.text);
      key = token.text;
      i++;
    }
  }

  return found;
}

/** Scanned once per directory: nothing rewrites a source mid-run. */
const scanned = new Map<string, Duplicate[]>();

/** Every duplicate key in every `*.json5` under `dir`, the dictionary too. */
export function duplicateKeysInSources(dir: string = DATA_DIR): Duplicate[] {
  const already = scanned.get(dir);
  if (already) return already;

  const found: Duplicate[] = [];
  const files = readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".json5"))
    .sort();
  for (const file of files)
    for (const at of duplicateKeys(readFileSync(join(dir, file), "utf8")))
      found.push({ file, ...at });

  scanned.set(dir, found);
  return found;
}
