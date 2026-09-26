import { createUuidV7, isUuidV7 } from "../lib/ids";

type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };

/** Persisted content excludes editor selection, DOM refs, and reader-specific state. */
export type RitualSemanticNode =
  | { kind: "text"; text: string }
  | {
      kind: "element";
      id: string;
      tag: string;
      attrs: Record<string, JsonValue>;
      children?: RitualSemanticNode[];
    }
  | { kind: "legacy"; id: string; raw: JsonValue };

/** App-owned document contract; JRT is an output profile, not this document's schema. */
export interface RitualSemanticDocument {
  format: "magickli-ritual";
  version: 1;
  nodes: RitualSemanticNode[];
}

const knownTags = new Set([
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
]);
const attributesByTag: Record<string, ReadonlySet<string>> = {
  a: new Set(["href"]),
  b: new Set(),
  br: new Set(),
  declareVar: new Set(["name", "label", "varType", "default", "collapsable"]),
  footnote: new Set(),
  footnotes: new Set(),
  grade: new Set(["grade"]),
  i: new Set(),
  img: new Set(["src", "alt", "width", "height", "style"]),
  li: new Set(),
  note: new Set(),
  option: new Set(["value", "label"]),
  summary: new Set(["summary"]),
  task: new Set(["say", "do", "role"]),
  title: new Set(["text"]),
  todo: new Set(),
  ul: new Set(),
  ol: new Set(),
  var: new Set(["name"]),
  hr: new Set(),
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 100) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "string")
    return value.isWellFormed() && !value.includes("\0");
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value))
    return value.every((entry) => jsonValue(entry, depth + 1));
  return (
    record(value) &&
    Object.entries(value).every(
      ([key, entry]) => key !== "__proto__" && jsonValue(entry, depth + 1),
    )
  );
}

function cloneJson<T extends JsonValue>(value: T): T {
  return structuredClone(value);
}

function validImageStyle(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== "string") return false;
  try {
    const parsed: unknown = JSON.parse(value);
    return (
      record(parsed) &&
      Object.entries(parsed).every(
        ([key, entry]) =>
          key !== "__proto__" &&
          (typeof entry === "string" ||
            typeof entry === "number" ||
            entry === null),
      )
    );
  } catch {
    return false;
  }
}

/** Import compiled legacy content without dropping unknown nodes or attributes. */
export function semanticFromJrt(
  input: unknown,
  createId: () => string = createUuidV7,
): RitualSemanticDocument {
  if (!record(input) || !Array.isArray(input.children))
    throw new Error("Invalid JRT root");
  const convert = (node: unknown, depth: number): RitualSemanticNode => {
    if (depth > 100 || !jsonValue(node) || !record(node))
      throw new Error("Invalid JRT node");
    if (
      node.type === "text" &&
      typeof node.value === "string" &&
      Object.keys(node).every((key) => key === "type" || key === "value")
    )
      return { kind: "text", text: node.value };
    const id = createId();
    if (!isUuidV7(id)) throw new Error("Invalid semantic node identity");
    if (typeof node.type !== "string" || !knownTags.has(node.type))
      return { kind: "legacy", id, raw: cloneJson(node) };
    const { type, children, ...attrs } = node;
    if (children !== undefined && !Array.isArray(children))
      return { kind: "legacy", id, raw: cloneJson(node) };
    if (Object.keys(attrs).some((key) => !attributesByTag[type].has(key)))
      return { kind: "legacy", id, raw: cloneJson(node) };
    return {
      kind: "element",
      id,
      tag: type,
      attrs: cloneJson(attrs as Record<string, JsonValue>),
      ...(children === undefined
        ? {}
        : { children: children.map((child) => convert(child, depth + 1)) }),
    };
  };
  const result: RitualSemanticDocument = {
    format: "magickli-ritual",
    version: 1,
    nodes: input.children.map((node) => convert(node, 0)),
  };
  if (validateRitualSemantic(result).length)
    throw new Error("Invalid semantic import");
  return result;
}

/** Validate source bytes and identities before a semantic revision can be saved. */
export function validateRitualSemantic(input: unknown): string[] {
  if (
    !record(input) ||
    Object.keys(input).length !== 3 ||
    input.format !== "magickli-ritual" ||
    input.version !== 1 ||
    !Array.isArray(input.nodes)
  )
    return ["Unsupported semantic document"];
  const errors: string[] = [];
  const ids = new Set<string>();
  let nodeCount = 0;
  const visit = (node: unknown, path: string, depth: number) => {
    if (++nodeCount > 20_000 || depth > 100) {
      errors.push(`${path}: document is too large or deeply nested`);
      return;
    }
    if (!record(node)) {
      errors.push(`${path}: invalid node`);
      return;
    }
    if (node.kind === "text") {
      if (
        Object.keys(node).length !== 2 ||
        typeof node.text !== "string" ||
        !node.text.isWellFormed()
      )
        errors.push(`${path}: invalid text`);
      return;
    }
    if (!isUuidV7(node.id) || node.id !== node.id.toLowerCase())
      errors.push(`${path}: invalid id`);
    else if (ids.has(node.id)) errors.push(`${path}: duplicate id`);
    else ids.add(node.id);
    if (node.kind === "legacy") {
      if (Object.keys(node).length !== 3 || !jsonValue(node.raw))
        errors.push(`${path}: invalid legacy payload`);
      return;
    }
    if (node.kind !== "element" || !knownTags.has(node.tag as string)) {
      errors.push(`${path}: unsupported node`);
      return;
    }
    if (
      Object.keys(node).some(
        (key) => !["kind", "id", "tag", "attrs", "children"].includes(key),
      ) ||
      !record(node.attrs) ||
      !jsonValue(node.attrs) ||
      Object.keys(node.attrs).some(
        (key) => !attributesByTag[node.tag as string].has(key),
      )
    )
      errors.push(`${path}: invalid attributes`);
    const attrs = record(node.attrs) ? node.attrs : {};
    const stringAttrs: Record<string, string[]> = {
      a: ["href"],
      declareVar: ["name", "label", "varType", "default"],
      grade: ["grade"],
      img: ["src", "alt", "style"],
      option: ["value", "label"],
      summary: ["summary"],
      task: ["role"],
      title: ["text"],
      var: ["name"],
    };
    if (
      (stringAttrs[node.tag as string] ?? []).some(
        (key) => attrs[key] !== undefined && typeof attrs[key] !== "string",
      ) ||
      (node.tag === "declareVar" &&
        attrs.collapsable !== undefined &&
        typeof attrs.collapsable !== "boolean") ||
      (node.tag === "img" &&
        ["width", "height"].some(
          (key) =>
            attrs[key] !== undefined &&
            !(typeof attrs[key] === "string" || typeof attrs[key] === "number"),
        )) ||
      (node.tag === "grade" &&
        (typeof attrs.grade !== "string" ||
          !/^\d{1,2}=\d{1,2}$/.test(attrs.grade))) ||
      (node.tag === "var" && !attrs.name) ||
      (node.tag === "declareVar" &&
        (!attrs.name ||
          !["text", "select"].includes(attrs.varType as string))) ||
      (node.tag === "option" && (!attrs.value || !attrs.label)) ||
      (node.tag === "title" && !attrs.text) ||
      (node.tag === "img" && (!attrs.src || !validImageStyle(attrs.style)))
    )
      errors.push(`${path}: invalid attribute value`);
    if (node.children !== undefined && !Array.isArray(node.children)) {
      errors.push(`${path}: invalid children`);
      return;
    }
    if (node.tag === "task") {
      if (
        (attrs.say !== true && attrs.do !== true) ||
        (attrs.say === true && attrs.do === true) ||
        typeof attrs.role !== "string" ||
        !/^(?:all|all-officers|(?:all|all-officers)-except-[a-zA-Z][a-zA-Z0-9]*(?:,[a-zA-Z][a-zA-Z0-9]*)*|[a-zA-Z][a-zA-Z0-9]*(?:,[a-zA-Z][a-zA-Z0-9]*)*)$/.test(
          attrs.role,
        )
      )
        errors.push(`${path}: invalid task`);
    }
    (node.children as unknown[] | undefined)?.forEach((child, index) =>
      visit(child, `${path}.children[${index}]`, depth + 1),
    );
  };
  input.nodes.forEach((node, index) => visit(node, `nodes[${index}]`, 0));
  return errors;
}

/** Compile a validated semantic document to the existing JRT reader profile. */
export function semanticToJrt(input: RitualSemanticDocument): JsonValue {
  const errors = validateRitualSemantic(input);
  if (errors.length) throw new Error(errors[0]);
  const convert = (node: RitualSemanticNode): JsonValue => {
    if (node.kind === "text") return { type: "text", value: node.text };
    if (node.kind === "legacy") return cloneJson(node.raw);
    return {
      type: node.tag,
      ...cloneJson(node.attrs),
      ...(node.children === undefined
        ? {}
        : { children: node.children.map(convert) }),
    };
  };
  return { children: input.nodes.map(convert) };
}
