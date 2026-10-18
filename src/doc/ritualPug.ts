import parse from "pug-parser";
import { createRitualNodeId, isRitualNodeId } from "./ritualNodeIds";
import { lexRitualPug, RITUAL_PUG_MAX_SOURCE_LENGTH } from "./ritualPugLex";
import { canPrintRoleShortcut } from "./ritualPugSurface";
import {
  RitualSourceError,
  type RitualSourceLocation,
  semanticSourceError,
} from "./ritualSourceDiagnostics";
import {
  type JsonValue,
  type RitualSemanticDocument,
  type RitualSemanticNode,
  validateRitualSemantic,
} from "./semantic";

export const RITUAL_PUG_HEADER = "//- magickli-ritual-pug 1";

function attributeText(attrs: Record<string, JsonValue>): string {
  const text = args(attrs);
  return text ? `(${text})` : "";
}

function preflight(source: string): void {
  if (source.length > RITUAL_PUG_MAX_SOURCE_LENGTH)
    throw new Error("Ritual source is too large");
  for (const [index, line] of source.split("\n").entries()) {
    const indentation = line.match(/^[ \t]*/)![0];
    if (
      indentation.includes("\t") ||
      indentation.length % 2 ||
      indentation.length > 200
    )
      throw new RitualSourceError(
        `Line ${index + 1}: use two-space indentation, up to 100 levels`,
        index + 1,
        1,
      );
  }
}

const document = (nodes: RitualSemanticNode[]): RitualSemanticDocument => ({
  format: "magickli-ritual",
  version: 1,
  nodes,
});
const json = JSON.stringify;
function checked(
  doc: RitualSemanticDocument,
  locations?: WeakMap<RitualSemanticNode, RitualSourceLocation>,
) {
  const errors = validateRitualSemantic(doc);
  if (errors.length)
    throw locations
      ? semanticSourceError(doc, errors[0], locations)
      : new Error("Invalid semantic document");
  return doc;
}
const plain = (s: string) =>
  s.length > 0 && !/[\r\n\t]/.test(s) && !/[#!][{[]/.test(s);
const args = (attrs: Record<string, JsonValue>) =>
  Object.entries(attrs)
    .map(([k, v]) => `${k}=${json(v)}`)
    .join(", ");
function pugAttrs(ast, shorthandIds: ReadonlyMap<string, string>) {
  if (ast.attributeBlocks?.length)
    throw new Error("Attribute programs are unsupported");
  const attrs: Record<string, JsonValue> = {};
  for (const attr of ast.attrs ?? []) {
    if (
      Object.hasOwn(attrs, attr.name) ||
      attr.name === "__proto__" ||
      (!attr.mustEscape && !shorthandIds.has(`${attr.line}:${attr.column}`))
    )
      throw new Error("Invalid literal attribute");
    // JSON parsing only. No Pug expressions are ever evaluated.
    try {
      attrs[attr.name] =
        shorthandIds.get(`${attr.line}:${attr.column}`) ??
        (attr.val === true ? true : JSON.parse(attr.val));
    } catch {
      throw new RitualSourceError(
        `Line ${attr.line + 1}: attributes must be JSON literals`,
        attr.line + 1,
        attr.column,
      );
    }
  }
  return attrs;
}

/**
 * `0=0#ID` grades and `${name#ID}` variables in Pug text. Authors may omit the
 * IDs (as in the earlier Pug editor); the printer always writes them.
 */
// A grade with an ID never backs off it (so `0=0#ID.` keeps its ID before
// the full stop); a bare grade may not be followed by `#`, so a malformed ID
// stays literal text instead of leaking into the reader.
const textShortcut =
  /(?<![\w=.])(\d{1,2}=\d{1,2})#([A-Za-z0-9-]+)(?![A-Za-z0-9-])|(?<![\w=.])(\d{1,2}=\d{1,2})(?![\w=.#])|\$\{([A-Za-z0-9_=]+)(?:#([A-Za-z0-9-]+))?\}/g;
/** Groups of a `textShortcut` match: grade value, ID and variable name. */
const shortcutParts = (match: RegExpMatchArray) => ({
  grade: match[1] ?? match[3],
  id: match[2] ?? match[5],
  name: match[4],
});

// Where each split node starts within its Pug Text value, for diagnostics.
const textOffsets = new WeakMap<
  RitualSemanticNode,
  { offset: number; id?: number }
>();

/** Split a Pug Text value into text, grade and variable nodes. */
function textWithShortcuts(text: string): RitualSemanticNode[] {
  const nodes: RitualSemanticNode[] = [];
  let last = 0;
  const push = (node: RitualSemanticNode, offset: number, id?: number) => {
    textOffsets.set(node, { offset, ...(id === undefined ? {} : { id }) });
    nodes.push(node);
  };
  for (const match of text.matchAll(textShortcut)) {
    const { grade, id, name } = shortcutParts(match);
    // A malformed ID leaves the whole match as literal text.
    if (id !== undefined && !isRitualNodeId(id)) continue;
    if (match.index > last)
      push({ kind: "text", text: text.slice(last, match.index) }, last);
    push(
      {
        kind: "element",
        id: id ?? createRitualNodeId(),
        tag: grade ? "grade" : "var",
        attrs: grade ? { grade } : { name },
        children: [],
      },
      match.index,
      id === undefined ? undefined : match.index + match[0].indexOf("#"),
    );
    last = match.index + match[0].length;
  }
  if (!nodes.length) return [{ kind: "text", text }];
  if (last < text.length) push({ kind: "text", text: text.slice(last) }, last);
  return nodes;
}

/** Offsets of the IDs written in a text's grade and variable shortcuts. */
export function ritualPugShortcutIds(
  text: string,
): { offset: number; id: string }[] {
  const ids: { offset: number; id: string }[] = [];
  for (const match of text.matchAll(textShortcut)) {
    const { id } = shortcutParts(match);
    if (id !== undefined && isRitualNodeId(id))
      ids.push({ offset: match.index + match[0].indexOf("#"), id });
  }
  return ids;
}

/** Whether parsed text nodes equal the printed run, ignoring key order. */
function sameRun(parsed: RitualSemanticNode[], printed: RitualSemanticNode[]) {
  return (
    parsed.length === printed.length &&
    parsed.every((node, i) => {
      const other = printed[i];
      if (node.kind === "text" || other.kind === "text")
        return (
          node.kind === "text" &&
          other.kind === "text" &&
          node.text === other.text
        );
      return (
        node.kind === "element" &&
        other.kind === "element" &&
        node.id === other.id &&
        node.tag === other.tag &&
        shortcutKind(other) === node.tag &&
        node.attrs.grade === other.attrs.grade &&
        node.attrs.name === other.attrs.name
      );
    })
  );
}

/** The canonical grade or variable a text shortcut reproduces exactly. */
function shortcutKind(node: RitualSemanticNode): "grade" | "var" | null {
  if (
    node.kind !== "element" ||
    !Array.isArray(node.children) ||
    node.children.length
  )
    return null;
  const keys = Object.keys(node.attrs).join();
  if (
    node.tag === "grade" &&
    keys === "grade" &&
    /^\d{1,2}=\d{1,2}$/.test(String(node.attrs.grade))
  )
    return "grade";
  if (
    node.tag === "var" &&
    keys === "name" &&
    /^[A-Za-z0-9_=]+$/.test(String(node.attrs.name))
  )
    return "var";
  return null;
}

const inlineTags = new Set(["a", "b", "i", "var", "grade", "br", "footnote"]);
function inlineChildren(
  nodes: RitualSemanticNode[],
  budget = { remaining: 100 },
): string | null {
  if (
    nodes.length > 100 ||
    nodes.some(
      (node) =>
        node.kind !== "text" &&
        (node.kind !== "element" || !inlineTags.has(node.tag)),
    )
  )
    return null;
  const literal = (i: number) => {
    const node = nodes[i];
    return (
      node?.kind === "text" &&
      plain(node.text) &&
      !/[\[\]]/.test(node.text) &&
      !node.text.endsWith("\\") &&
      nodes[i - 1]?.kind !== "text" &&
      // Text that would read as a grade or variable shortcut stays wrapped.
      textWithShortcuts(node.text)[0]?.kind === "text" &&
      textWithShortcuts(node.text).length === 1
    );
  };
  // The first character the next node could print, for grade boundaries.
  const nextStart = (i: number) => {
    const next = nodes[i + 1];
    if (!next) return "";
    if (next.kind === "text") return literal(i + 1) ? next.text[0] : "#";
    const kind = shortcutKind(next);
    return kind === "grade" ? "0" : kind === "var" ? "$" : "#";
  };
  // Each piece remembers whether it is bare Pug text (literal text or a
  // shortcut), so runs of those can be checked against the parser.
  const pieces: { text: string; bare: boolean; node: RitualSemanticNode }[] =
    [];
  const tagged = (node: Extract<RitualSemanticNode, { kind: "element" }>) =>
    `#[${node.tag}#${node.id}${attributeText(node.attrs)}]`;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (--budget.remaining < 0) return null;
    const kind = shortcutKind(node);
    if (node.kind === "text") {
      const bare = literal(i);
      pieces.push({
        text: bare ? node.text : `#[ritualText(value=${json(node.text)})/]`,
        bare,
        node,
      });
    } else if (node.kind === "element" && kind === "var") {
      pieces.push({
        text: `\${${node.attrs.name}#${node.id}}`,
        bare: true,
        node,
      });
    } else if (
      node.kind === "element" &&
      kind === "grade" &&
      // A grade needs a boundary before it, and nothing after its ID that
      // could extend the ID; the run check below catches anything else.
      !/[\w=.]$/.test(pieces.at(-1)?.text ?? "") &&
      !/^[A-Za-z0-9-]/.test(nextStart(i))
    ) {
      pieces.push({ text: `${node.attrs.grade}#${node.id}`, bare: true, node });
    } else if (node.kind === "element") {
      const children =
        node.children === undefined
          ? null
          : inlineChildren(node.children, budget);
      if (node.children !== undefined && children === null) return null;
      pieces.push({
        text: `#[${node.tag}#${node.id}${attributeText(node.attrs)}${node.children === undefined ? "/" : children ? ` ${children}` : ""}]`,
        bare: false,
        node,
      });
    }
  }
  // Pug reads each run of bare pieces as one Text node, so a shortcut can
  // combine with its neighbours (`${` + `0=0#ID` + `}` reads as a variable).
  // Parse every run as the parser will; any difference prints its
  // shortcuts as tags instead.
  for (let start = 0; start < pieces.length; ) {
    if (!pieces[start].bare) {
      start++;
      continue;
    }
    let end = start;
    while (end < pieces.length && pieces[end].bare) end++;
    const run = pieces.slice(start, end);
    if (
      run.some((piece) => piece.node.kind === "element") &&
      !sameRun(
        textWithShortcuts(run.map((piece) => piece.text).join("")),
        run.map((piece) => piece.node),
      )
    )
      for (const piece of run)
        if (piece.node.kind === "element") {
          piece.text = tagged(piece.node);
          piece.bare = false;
        }
    start = end;
  }
  return pieces.map((piece) => piece.text).join("");
}
const capitalize = (part: string) => part[0].toUpperCase() + part.slice(1);
const lineBreak = (node: RitualSemanticNode) =>
  node.kind === "text" && node.text === "\n";
/**
 * Print inline children as pipe lines when Pug reproduces them exactly.
 *
 * Pug inserts one `"\n"` Text between consecutive pipe lines and one more for
 * each blank `|` line, so standalone newline nodes need no wrapper. Leading or
 * trailing newlines, and segments the inline printer cannot express, keep the
 * exact wrapper projection.
 */
function pipeLines(nodes: RitualSemanticNode[]): string[] | null {
  if (!nodes.some(lineBreak)) return null;
  const lines: string[] = [];
  let segment: RitualSemanticNode[] = [];
  let breaks = 0;
  const flush = () => {
    const inline = inlineChildren(segment);
    if (!inline) return false;
    for (let i = 1; i < breaks; i++) lines.push("|");
    lines.push(`| ${inline}`);
    segment = [];
    breaks = 0;
    return true;
  };
  for (const node of nodes) {
    if (!lineBreak(node)) segment.push(node);
    else if (segment.length) {
      if (!flush()) return null;
      breaks = 1;
    } else if (lines.length) breaks++;
    else return null;
  }
  return segment.length && flush() ? lines : null;
}
function pugChildren(
  block,
  visit: (node) => RitualSemanticNode | RitualSemanticNode[],
): RitualSemanticNode[] {
  // Pug creates empty Text nodes at interpolation boundaries. Authored empty
  // nodes use the explicit literal wrapper, so those generated empties are safe
  // to omit. Nonempty and newline Text nodes are never normalized or merged.
  return block.nodes
    .filter(
      (node) =>
        (node.type !== "Text" || node.val !== "") &&
        (node.type !== "Comment" || node.buffer !== false),
    )
    .flatMap(visit);
}

/** Print an exact semantic tree as bounded Pug; IDs never become reader attributes. */
export function printRitualPug(doc: RitualSemanticDocument): string {
  checked(doc);
  const lines = [RITUAL_PUG_HEADER];
  const visit = (node: RitualSemanticNode, depth: number, hall = false) => {
    const indent = "  ".repeat(depth);
    if (node.kind === "annotation") {
      if (node.style === "blank") lines.push(indent);
      else if (!/[\r\n]/.test(node.text))
        lines.push(`${indent}//- ${node.text}`);
      else lines.push(`${indent}ritualComment(value=${json(node.text)})/`);
      return;
    }
    if (node.kind === "text") {
      // Pug inserts newlines between consecutive pipe-text lines. Literal
      // wrappers preserve text-node boundaries and all unusual whitespace.
      lines.push(`${indent}ritualText(value=${json(node.text)})/`);
      return;
    }
    if (node.kind === "legacy") {
      lines.push(`${indent}ritualLegacy#${node.id}(raw=${json(node.raw)})/`);
      return;
    }
    if (hall || node.tag === "gdHall") {
      // A hall holds no text, so every node gets its own line: no inline,
      // pipe or shortcut forms. A leaf with `children: []` prints bare and
      // one without `children` ends in `/`, as for every tag.
      lines.push(
        `${indent}${node.tag}#${node.id}${attributeText(node.attrs)}${node.children === undefined ? "/" : ""}`,
      );
      node.children?.forEach((child) => visit(child, depth + 1, true));
      return;
    }
    const speech =
      node.tag === "task" &&
      Object.keys(node.attrs).length === 2 &&
      typeof node.attrs.role === "string" &&
      (node.attrs.say === true || node.attrs.do === true);
    const tag = speech ? (node.attrs.say ? "say" : "do") : node.tag;
    const attributes = speech ? { role: node.attrs.role } : node.attrs;
    const header = `${indent}${tag}#${node.id}${attributeText(attributes)}`;
    const role = attributes.role;
    // Capitalize the source label while retaining the reader's role keys.
    const label =
      speech && typeof role === "string" && canPrintRoleShortcut(role)
        ? `${role.split(",").map(capitalize).join(",")}#${node.id}`
        : null;
    const shortcut =
      label && `${indent}${node.attrs.say ? `${label}:` : `* ${label}`}`;
    const children = node.children ?? [];
    // `Label:` with nothing after the colon contributes its own leading space.
    const shortcutLines =
      shortcut &&
      (node.attrs.say
        ? children[0]?.kind === "text" && children[0].text === " "
          ? pipeLines(children.slice(1))
          : null
        : pipeLines(children));
    const piped = shortcutLines ? null : pipeLines(children);
    const inline =
      shortcutLines || piped || !children.length
        ? null
        : inlineChildren(children);
    const pipeIndent = `${indent}  `;
    if (shortcutLines) {
      lines.push(shortcut!, ...shortcutLines.map((line) => pipeIndent + line));
    } else if (piped) {
      lines.push(header, ...piped.map((line) => pipeIndent + line));
    } else if (inline !== null) {
      lines.push(`${shortcut ?? header} ${inline}`);
    } else {
      lines.push(header + (node.children === undefined ? "/" : ""));
      node.children?.forEach((child) => visit(child, depth + 1));
    }
  };
  doc.nodes.forEach((node) => visit(node, 0));
  return lines.join("\n") + "\n";
}

/** Parse the owned Pug subset without executing templates or attribute expressions. */
export function parseRitualPug(source: string): RitualSemanticDocument {
  return parseWithLocations(source).document;
}

/** 1-based source line of each top-level node, or null when the source is invalid. */
export function ritualPugTopLevelLines(source: string): number[] | null {
  try {
    const { document, locations } = parseWithLocations(source);
    return document.nodes.map((node) => locations.get(node)?.line ?? 0);
  } catch {
    return null;
  }
}

function parseWithLocations(source: string) {
  const [header, ...lines] = source.replace(/\r\n?/g, "\n").split("\n");
  if (header !== RITUAL_PUG_HEADER)
    throw new RitualSourceError(`Line 1: expected ${RITUAL_PUG_HEADER}`, 1);
  preflight(source);
  let ast;
  const shorthandIds = new Map<string, string>();
  try {
    const tokens = lexRitualPug(lines.join("\n"));
    // Record lexer-owned #id tokens before parsing converts them to attrs.
    for (const token of tokens)
      if (token.type === "id") {
        shorthandIds.set(
          `${token.loc.start.line}:${token.loc.start.column}`,
          token.val,
        );
      }
    ast = parse(tokens);
  } catch (error) {
    const line = typeof error?.line === "number" ? error.line + 1 : 1;
    throw new RitualSourceError(
      `Line ${line}: invalid Pug syntax`,
      line,
      typeof error?.column === "number" ? error.column : undefined,
    );
  }
  let count = 0;
  const locations = new WeakMap<RitualSemanticNode, RitualSourceLocation>();
  const convert = (
    node,
    depth = 0,
    hall = false,
  ): RitualSemanticNode | RitualSemanticNode[] => {
    if (++count > 20_000 || depth > 100)
      throw new Error("Ritual is too large or deeply nested");
    // A hall holds no text, so spaces typed after a hall tag (which Pug
    // reads as text) are dropped rather than refused; the printer never
    // writes them, so the round trip stays exact.
    const inHall = hall || (node.type === "Tag" && node.name === "gdHall");
    if (inHall && node.block)
      node = {
        ...node,
        block: {
          ...node.block,
          nodes: node.block.nodes.filter(
            (child) => child.type !== "Text" || !/^\s*$/.test(child.val),
          ),
        },
      };
    if (node.code)
      throw new RitualSourceError(
        `Line ${node.line + 1}: template programs are unsupported`,
        node.line + 1,
        node.column,
      );
    if (node.type === "Text") return textWithShortcuts(node.val);
    if (node.type !== "Tag")
      throw new Error("Template programs are unsupported");
    if (node.selfClosing && node.block.nodes.length)
      throw new Error("Leaf has children");
    const attrs = pugAttrs(node, shorthandIds);
    if (node.name === "ritualText") {
      if (Object.keys(attrs).join() !== "value" || !node.selfClosing)
        throw new Error("Invalid text wrapper");
      return { kind: "text", text: attrs.value as string };
    }
    if (node.name === "ritualComment" || node.name === "ritualBlank") {
      if (
        !node.selfClosing ||
        (node.name === "ritualComment"
          ? Object.keys(attrs).join() !== "value" ||
            typeof attrs.value !== "string"
          : Object.keys(attrs).length !== 0)
      )
        throw new Error("Invalid source annotation");
      return {
        kind: "annotation",
        style: node.name === "ritualComment" ? "comment" : "blank",
        text: node.name === "ritualComment" ? (attrs.value as string) : "",
      };
    }
    const { id: suppliedId, ...rest } = attrs;
    const id = suppliedId === undefined ? createRitualNodeId() : suppliedId;
    if (!isRitualNodeId(id)) {
      const identity = node.attrs?.find((attr) => attr.name === "id") ?? node;
      throw new RitualSourceError(
        `Line ${identity.line + 1}: invalid node ID`,
        identity.line + 1,
        identity.column,
      );
    }
    if (node.name === "ritualLegacy") {
      if (Object.keys(rest).join() !== "raw" || !node.selfClosing)
        throw new Error("Invalid legacy wrapper");
      return { kind: "legacy", id, raw: rest.raw };
    }
    const speech = ["say", "do"].includes(node.name);
    if (speech && (Object.hasOwn(rest, "say") || Object.hasOwn(rest, "do")))
      throw new Error("Ambiguous task");
    const result: Extract<RitualSemanticNode, { kind: "element" }> = {
      kind: "element",
      id,
      tag: speech ? "task" : node.name,
      attrs: speech ? { [node.name]: true, ...rest } : rest,
    };
    if (!node.selfClosing)
      result.children = pugChildren(node.block, (child) =>
        visit(child, depth + 1, inHall),
      );
    else if (node.block.nodes.length) throw new Error("Leaf has children");
    return result;
  };
  const visit = (node, depth = 0, hall = false): RitualSemanticNode[] => {
    try {
      const converted = convert(node, depth, hall);
      const results = Array.isArray(converted) ? converted : [converted];
      // Shortcuts split one Text node into many; count them toward the bound.
      count += results.length - 1;
      if (count > 20_000)
        throw new Error("Ritual is too large or deeply nested");
      const identity = node.attrs?.find((attr) => attr.name === "id");
      for (const result of results) {
        const within = textOffsets.get(result);
        locations.set(result, {
          line: node.line + 1,
          column: node.column + (within?.offset ?? 0),
          ...(identity
            ? { id: { line: identity.line + 1, column: identity.column } }
            : within?.id !== undefined
              ? { id: { line: node.line + 1, column: node.column + within.id } }
              : {}),
        });
      }
      return results;
    } catch (cause) {
      if (cause instanceof RitualSourceError) throw cause;
      throw new RitualSourceError(
        cause instanceof Error ? cause.message : "Invalid ritual node",
        node.line + 1,
        node.column,
      );
    }
  };
  return {
    document: checked(
      document(
        ast.nodes
          .filter((node) => node.type !== "Comment" || node.buffer !== false)
          .flatMap((node) => visit(node)),
      ),
      locations,
    ),
    locations,
  };
}
