import parse from "pug-parser";
import { createRitualNodeId, isRitualNodeId } from "./ritualNodeIds";
import { lexRitualPug, RITUAL_PUG_MAX_SOURCE_LENGTH } from "./ritualPugLex";
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
  for (const line of source.split("\n")) {
    const indentation = line.match(/^[ \t]*/)![0];
    if (
      indentation.includes("\t") ||
      indentation.length % 2 ||
      indentation.length > 200
    )
      throw new Error("Use two-space indentation, up to 100 levels");
  }
}

const document = (nodes: RitualSemanticNode[]): RitualSemanticDocument => ({
  format: "magickli-ritual",
  version: 1,
  nodes,
});
const json = JSON.stringify;
function checked(doc: RitualSemanticDocument) {
  const errors = validateRitualSemantic(doc);
  if (errors.length) throw new Error("Invalid semantic document");
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
      throw new Error(
        `Line ${attr.line + 1}: attributes must be JSON literals`,
      );
    }
  }
  return attrs;
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
  const pieces: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (--budget.remaining < 0) return null;
    if (node.kind === "text") {
      const literal =
        plain(node.text) &&
        !/[\[\]]/.test(node.text) &&
        !node.text.endsWith("\\") &&
        nodes[i - 1]?.kind !== "text";
      pieces.push(
        literal ? node.text : `#[ritualText(value=${json(node.text)})/]`,
      );
    } else if (node.kind === "element") {
      const children =
        node.children === undefined
          ? null
          : inlineChildren(node.children, budget);
      if (node.children !== undefined && children === null) return null;
      pieces.push(
        `#[${node.tag}#${node.id}${attributeText(node.attrs)}${node.children === undefined ? "/" : children ? ` ${children}` : ""}]`,
      );
    }
  }
  return pieces.join("");
}
function pugChildren(block, visit) {
  // Pug creates empty Text nodes at interpolation boundaries. Authored empty
  // nodes use the explicit literal wrapper, so those generated empties are safe
  // to omit. Nonempty and newline Text nodes are never normalized or merged.
  return block.nodes
    .filter(
      (node) =>
        (node.type !== "Text" || node.val !== "") &&
        (node.type !== "Comment" || node.buffer !== false),
    )
    .map(visit);
}

/** Print an exact semantic tree as bounded Pug; IDs never become reader attributes. */
export function printRitualPug(doc: RitualSemanticDocument): string {
  checked(doc);
  const lines = [RITUAL_PUG_HEADER];
  const visit = (node: RitualSemanticNode, depth: number) => {
    const indent = "  ".repeat(depth);
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
    const speech =
      node.tag === "task" &&
      Object.keys(node.attrs).length === 2 &&
      typeof node.attrs.role === "string" &&
      (node.attrs.say === true || node.attrs.do === true);
    const tag = speech ? (node.attrs.say ? "say" : "do") : node.tag;
    const attributes = speech ? { role: node.attrs.role } : node.attrs;
    const header = `${indent}${tag}#${node.id}${attributeText(attributes)}`;
    const inline = node.children?.length ? inlineChildren(node.children) : null;
    if (inline !== null) {
      lines.push(`${header} ${inline}`);
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
  const [header, ...lines] = source.replace(/\r\n?/g, "\n").split("\n");
  if (header !== RITUAL_PUG_HEADER)
    throw new Error(`Line 1: expected ${RITUAL_PUG_HEADER}`);
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
    throw new Error(`Line ${line}: invalid Pug syntax`);
  }
  let count = 0;
  const visit = (node, depth = 0): RitualSemanticNode => {
    if (++count > 20_000 || depth > 100)
      throw new Error("Ritual is too large or deeply nested");
    if (node.code)
      throw new Error(
        `Line ${node.line + 1}: template programs are unsupported`,
      );
    if (node.type === "Text") return { kind: "text", text: node.val };
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
    const { id: suppliedId, ...rest } = attrs;
    const id = suppliedId === undefined ? createRitualNodeId() : suppliedId;
    if (!isRitualNodeId(id))
      throw new Error(`Line ${node.line + 1}: invalid node ID`);
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
        visit(child, depth + 1),
      );
    else if (node.block.nodes.length) throw new Error("Leaf has children");
    return result;
  };
  return checked(
    document(
      ast.nodes
        .filter((node) => node.type !== "Comment" || node.buffer !== false)
        .map((node) => visit(node)),
    ),
  );
}
