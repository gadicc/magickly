import { getProperty, parsePath } from "dot-prop";

/** The segment that reads every element of a list. */
const EVERY = "*";

/** What `*` joins a list's values with: the separator the data already used. */
export const FIELD_PATH_LIST_SEPARATOR = "; ";

type Segments = (string | number)[];

/**
 * How many whole, unescaped `*` segments a path has, as dot-prop splits it:
 * a backslash escapes the character after it, so the path `\*` is a key
 * named `*` and `a\.*` one key, while `a\\.*` is the key `a\` and then a
 * wildcard. Scanned rather than matched with a regular expression, which
 * would need a lookbehind, and older Safari cannot parse one.
 */
function wildcardSegments(path: string): number {
  let count = 0;
  let segment = "";
  let escaped = false;
  for (const character of path) {
    if (escaped) {
      // An escaped character is never the bare `*` a wildcard is.
      segment += `\\${character}`;
      escaped = false;
    } else if (character === "\\") escaped = true;
    else if (character === ".") {
      if (segment === EVERY) count++;
      segment = "";
    } else segment += character;
  }
  if (segment === EVERY) count++;
  return count;
}

/**
 * Reads a dotted field path such as `name.en` from a data record.
 *
 * dot-prop 10 throws on malformed bracket paths. Field paths arrive from the
 * query string, so an unusable path yields `undefined` and a blank label
 * instead of a render error.
 *
 * A `*` segment applied to a list reads the rest of the path from every
 * element and joins what it finds with "; ", so `stones.*.name.en` reads
 * "pearl; star sapphire" (plan 039, decision 4). An element the rest of the
 * path finds nothing in, or only `null` or `""`, is left out, and a list it
 * finds nothing in at all reads `undefined` rather than "", so a label is
 * blank rather than empty. `*` applied to anything but a list is `undefined`.
 * dot-prop gives `*` no meaning, so a path without one is read by dot-prop
 * alone, exactly as before.
 *
 * One `*` per path, and a second makes the path `undefined`. The data needs
 * no more, and each one multiplies the work by its list's length: through
 * links that loop back, as `pathsFrom.*.to.pathsTo.*.from` does, a short path
 * from a query string would read millions of rows and freeze the page.
 */
export function readFieldPath(
  source: Parameters<typeof getProperty>[0],
  path: string,
): unknown {
  try {
    const wildcards = wildcardSegments(path);
    // A `*` inside a longer key, or escaped, is an ordinary key; dot-prop
    // reads it as it always has.
    if (wildcards === 0) return getProperty(source, path);
    if (wildcards > 1) return undefined;
    const segments = parsePath(path);
    // An escaped `*` beside the wildcard parses to the same segment; rather
    // than guess which is which, the path reads nothing. A path with a
    // disallowed key parses to no wildcard at all.
    if (segments.filter((segment) => segment === EVERY).length !== 1)
      return undefined;
    return readSegments(source, segments);
  } catch {
    return undefined;
  }
}

/** The parsed path read from `source`, with each `*` mapped over its list. */
function readSegments(source: unknown, segments: Segments): unknown {
  if (segments.length === 0) return source;
  // dot-prop answers a path into a string or a number with the value itself;
  // inside a list that would print an element for a field it does not have.
  if (source === null || typeof source !== "object") return undefined;

  const at = segments.indexOf(EVERY);
  if (at === -1) return getProperty(source, segments);

  const list = at === 0 ? source : getProperty(source, segments.slice(0, at));
  if (!Array.isArray(list)) return undefined;

  const rest = segments.slice(at + 1);
  const values = list
    .map((element) => readSegments(element, rest))
    .filter((value) => value !== undefined && value !== null && value !== "");
  return values.length === 0
    ? undefined
    : values.join(FIELD_PATH_LIST_SEPARATOR);
}
