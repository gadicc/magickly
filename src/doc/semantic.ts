import { createRitualNodeId, isRitualNodeId } from "./ritualNodeIds";

type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };

/** Persisted content excludes editor selection, DOM refs, and reader-specific state. */
export type RitualSemanticNode =
  | { kind: "text"; text: string }
  // Source annotations survive editing but are omitted from the reader profile.
  | { kind: "annotation"; style: "comment" | "blank"; text: string }
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

/**
 * A `gdHall` subtree is accepted by shape (plan 061, decision 2): elements
 * and source annotations only, identifier tags and attribute names, and
 * JSON scalar values. What its tags mean is the hall package's to check, so
 * hall vocabulary never changes this compiler.
 */
const hallName = /^[A-Za-z][A-Za-z0-9]*$/;
/**
 * `Object.prototype`'s identifier names. The reader's block registry and the
 * offline inventory look tags up in plain objects (`toString` would be taken
 * for a block class), and a compiled row should never shadow them either.
 */
const objectPrototypeNames = new Set([
  "constructor",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  "toString",
  "valueOf",
]);
/**
 * Tags that the reader, the offline inventory or the Pug codec treat
 * specially wherever they occur (`text` compiles to a text node; `say`,
 * `do` and the `ritual…` wrappers parse as something else). Pug's keywords
 * are reserved too: a printed `each#…` or `if#…` line parses as a Pug
 * statement, not a tag, so the printer could not write such a node back.
 * Pug reads any line that merely begins with `doctype` (`doctypeX`) as a
 * doctype, so that prefix is reserved as `ritual` followed by a capital is.
 * `mixin`, `block`, `append`, `prepend` and `yield` print back today but
 * are statements when typed bare, and `filter`, `script` and `style` mean
 * something to Pug or HTML: reserved now, because reserving a name after
 * halls use it would break their saved revisions.
 */
const reservedHallTags = new Set([
  "text",
  "title",
  "grade",
  "footnote",
  "footnotes",
  "task",
  "span",
  "img",
  "stylesheet",
  "cursor",
  "say",
  "do",
  "if",
  "else",
  "unless",
  "case",
  "when",
  "default",
  "each",
  "for",
  "while",
  "extends",
  "extend",
  "include",
  "doctype",
  "mixin",
  "block",
  "append",
  "prepend",
  "yield",
  "filter",
  "script",
  "style",
]);
/**
 * Where a `gdHall` may stand: at the top level, or directly inside one of
 * these block containers, which the reader and the visual editor both draw
 * as blocks. Anywhere else (inside `b`, a title, an option, a task or
 * another hall) it is refused; loosening this later changes the compiler
 * identity only, while tightening it would break saved revisions.
 */
export const HALL_PARENT_TAGS: ReadonlySet<string> = new Set([
  "note",
  "summary",
  "li",
  "todo",
]);
/**
 * `type` and `children` would overwrite the compiled row's own keys, Pug
 * reads `id` as the node identity, and the rest are the offline asset
 * inventory's style and resource fields.
 */
const reservedHallAttributes = new Set([
  "type",
  "children",
  "id",
  "style",
  "src",
  "srcSet",
  "srcset",
  "href",
  "xlinkHref",
  "poster",
  "data",
  "background",
  "dangerouslySetInnerHTML",
]);
const hallTagIssue = (tag: unknown) =>
  typeof tag !== "string" || !hallName.test(tag)
    ? "invalid hall tag"
    : reservedHallTags.has(tag) ||
        objectPrototypeNames.has(tag) ||
        /^ritual[A-Z]/.test(tag) ||
        /^doctype/.test(tag)
      ? "reserved hall tag"
      : null;
const hallAttributesIssue = (attrs: unknown) => {
  if (!record(attrs)) return "invalid hall attributes";
  for (const [key, value] of Object.entries(attrs)) {
    if (
      !hallName.test(key) ||
      !jsonValue(value) ||
      (value !== null && typeof value === "object")
    )
      return "invalid hall attributes";
    if (reservedHallAttributes.has(key) || objectPrototypeNames.has(key))
      return "reserved hall attribute";
  }
  return null;
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
  createId: () => string = createRitualNodeId,
): RitualSemanticDocument {
  if (!record(input) || !Array.isArray(input.children))
    throw new Error("Invalid JRT root");
  // A hall imports as elements; a `{}` row inside it is a `//-` comment
  // that `prepare.js` compiled away. Null if any row is not a node.
  const hall = (node: unknown): RitualSemanticNode | null => {
    if (!record(node)) return null;
    const { type, children, ...attrs } = node;
    if (typeof type !== "string") return null;
    if (children !== undefined && !Array.isArray(children)) return null;
    const rows = children
      ?.filter((child) => !record(child) || Object.keys(child).length)
      .map(hall);
    if (rows?.some((row) => row === null)) return null;
    const id = createId();
    if (!isRitualNodeId(id)) throw new Error("Invalid semantic node identity");
    return {
      kind: "element",
      id,
      tag: type,
      attrs: cloneJson(attrs as Record<string, JsonValue>),
      ...(rows === undefined ? {} : { children: rows as RitualSemanticNode[] }),
    };
  };
  const convert = (
    node: unknown,
    depth: number,
    block = true,
  ): RitualSemanticNode => {
    if (depth > 100 || !jsonValue(node) || !record(node))
      throw new Error("Invalid JRT node");
    if (node.type === "gdHall" && block) {
      // A hall that breaks the shape rule stays opaque, as before, and so
      // does one standing where a hall may not (`block` is false).
      const imported = hall(node);
      if (
        imported &&
        !validateRitualSemantic({
          format: "magickli-ritual",
          version: 1,
          nodes: [imported],
        }).length
      )
        return imported;
    }
    if (
      node.type === "text" &&
      typeof node.value === "string" &&
      Object.keys(node).every((key) => key === "type" || key === "value")
    )
      return { kind: "text", text: node.value };
    const id = createId();
    if (!isRitualNodeId(id)) throw new Error("Invalid semantic node identity");
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
        : {
            children: children.map((child) =>
              convert(child, depth + 1, HALL_PARENT_TAGS.has(type)),
            ),
          }),
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
  // `within` is where the node stands: where a hall may ("block"), inside
  // a hall ("hall"), or anywhere else ("other").
  const visit = (
    node: unknown,
    path: string,
    depth: number,
    within: "block" | "hall" | "other" = "block",
  ) => {
    if (++nodeCount > 20_000 || depth > 100) {
      errors.push(`${path}: document is too large or deeply nested`);
      return;
    }
    if (!record(node)) {
      errors.push(`${path}: invalid node`);
      return;
    }
    if (node.kind === "text") {
      if (within === "hall") {
        errors.push(`${path}: text is not allowed in a hall`);
        return;
      }
      if (
        Object.keys(node).length !== 2 ||
        typeof node.text !== "string" ||
        !node.text.isWellFormed()
      )
        errors.push(`${path}: invalid text`);
      return;
    }
    if (node.kind === "annotation") {
      if (
        Object.keys(node).length !== 3 ||
        !["comment", "blank"].includes(node.style as string) ||
        typeof node.text !== "string" ||
        !node.text.isWellFormed() ||
        node.text.includes("\0") ||
        (node.style === "blank" && node.text !== "")
      )
        errors.push(`${path}: invalid source annotation`);
      return;
    }
    if (!isRitualNodeId(node.id)) errors.push(`${path}: invalid id`);
    else if (ids.has(node.id)) errors.push(`${path}: duplicate id`);
    else ids.add(node.id);
    if (
      within === "hall" ||
      (node.kind === "element" && node.tag === "gdHall")
    ) {
      if (
        node.kind !== "element" ||
        Object.keys(node).some(
          (key) => !["kind", "id", "tag", "attrs", "children"].includes(key),
        )
      ) {
        errors.push(`${path}: unsupported hall node`);
        return;
      }
      if (node.tag === "gdHall" && within !== "block")
        errors.push(`${path}: a temple hall cannot stand here`);
      const issue = hallTagIssue(node.tag) ?? hallAttributesIssue(node.attrs);
      if (issue) errors.push(`${path}: ${issue}`);
      if (node.children !== undefined && !Array.isArray(node.children))
        errors.push(`${path}: invalid children`);
      else
        node.children?.forEach((child, index) =>
          visit(child, `${path}.children[${index}]`, depth + 1, "hall"),
        );
      return;
    }
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
      visit(
        child,
        `${path}.children[${index}]`,
        depth + 1,
        HALL_PARENT_TAGS.has(node.tag as string) ? "block" : "other",
      ),
    );
  };
  input.nodes.forEach((node, index) => visit(node, `nodes[${index}]`, 0));
  return errors;
}

/** Compile a validated semantic document to the existing JRT reader profile. */
export function semanticToJrt(input: RitualSemanticDocument): JsonValue {
  const errors = validateRitualSemantic(input);
  if (errors.length) throw new Error(errors[0]);
  const children = (nodes: RitualSemanticNode[]) =>
    nodes.filter((node) => node.kind !== "annotation").map(convert);
  const convert = (node: RitualSemanticNode): JsonValue => {
    if (node.kind === "annotation")
      throw new Error("Source annotation cannot be rendered");
    if (node.kind === "text") return { type: "text", value: node.text };
    if (node.kind === "legacy") return cloneJson(node.raw);
    return {
      type: node.tag,
      ...cloneJson(node.attrs),
      ...(node.children === undefined
        ? {}
        : { children: children(node.children) }),
    };
  };
  return { children: children(input.nodes) };
}
