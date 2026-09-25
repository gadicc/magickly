import { type JSONContent, Mark, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { createUuidV7 } from "../lib/ids";
import {
  type JsonValue,
  type RitualSemanticDocument,
  type RitualSemanticNode,
  validateRitualSemantic,
} from "./semantic";

const inlineAtoms = new Set(["br", "grade", "var"]);
const inlineSpans = new Set(["a", "b", "i"]);
const blockAtoms = new Set(["declareVar", "img", "option", "hr"]);
const inline = (node: RitualSemanticNode) =>
  node.kind === "text" ||
  (node.kind === "element" &&
    (inlineAtoms.has(node.tag) || inlineSpans.has(node.tag)));

function label(tag: string, attrs: Record<string, JsonValue>): string {
  if (tag === "task")
    return `${attrs.say === true ? "Say" : "Do"} · ${String(attrs.role ?? "choose role")}`;
  if (tag === "summary") return `Summary · ${String(attrs.summary ?? "")}`;
  if (tag === "title") return `Title · ${String(attrs.text ?? "")}`;
  return tag;
}

const nodeAttrs = {
  id: { default: null },
  tag: { default: null },
  attrs: { default: {} },
  children: { default: null },
};

const RitualBlock = Node.create({
  name: "ritualBlock",
  group: "block",
  content: "block*",
  defining: true,
  isolating: true,
  addAttributes: () => nodeAttrs,
  parseHTML: () => [{ tag: "section[data-ritual-block]" }],
  renderHTML({ node }) {
    const attrs = node.attrs.attrs as Record<string, JsonValue>;
    return [
      "section",
      {
        "data-ritual-block": node.attrs.tag,
        class: `ritual-block ritual-${node.attrs.tag}`,
      },
      [
        "div",
        { class: "ritual-label", contenteditable: "false" },
        label(node.attrs.tag, attrs),
      ],
      ["div", { class: "ritual-content" }, 0],
    ];
  },
});

const RitualSpan = Node.create({
  name: "ritualSpan",
  group: "inline",
  inline: true,
  content: "inline*",
  addAttributes: () => nodeAttrs,
  parseHTML: () => [{ tag: "span[data-ritual-span]" }],
  renderHTML({ node }) {
    const tag = node.attrs.tag as string;
    return [
      "span",
      {
        "data-ritual-span": tag,
        class:
          tag === "b"
            ? "ritual-bold"
            : tag === "i"
              ? "ritual-italic"
              : "ritual-link",
        title: tag === "a" ? String(node.attrs.attrs?.href ?? "") : undefined,
      },
      0,
    ];
  },
});

const RitualInline = Node.create({
  name: "ritualInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => nodeAttrs,
  parseHTML: () => [{ tag: "span[data-ritual-inline]" }],
  renderHTML({ node }) {
    const tag = node.attrs.tag as string;
    const attrs = node.attrs.attrs as Record<string, JsonValue>;
    const value =
      tag === "var"
        ? `⁨${String(attrs.name ?? "")}⁩`
        : tag === "grade"
          ? String(attrs.grade ?? "")
          : "↵";
    return [
      "span",
      {
        "data-ritual-inline": tag,
        class: "ritual-inline",
        contenteditable: "false",
      },
      value,
    ];
  },
});

const RitualAtom = Node.create({
  name: "ritualAtom",
  group: "block",
  atom: true,
  selectable: true,
  isolating: true,
  addAttributes() {
    return {
      ...nodeAttrs,
      children: { default: null },
      raw: { default: null },
    };
  },
  parseHTML: () => [{ tag: "div[data-ritual-atom]" }],
  renderHTML({ node }) {
    const tag = node.attrs.tag as string;
    const attrs = node.attrs.attrs as Record<string, JsonValue>;
    const value =
      tag === "legacy"
        ? "Unsupported legacy content · preserved"
        : tag === "img"
          ? `Image · ${String(attrs.alt ?? attrs.src ?? "")}`
          : tag === "declareVar"
            ? `Variable · ${String(attrs.label ?? attrs.name ?? "")}`
            : label(tag, attrs);
    return [
      "div",
      {
        "data-ritual-atom": tag,
        class: "ritual-atom",
        contenteditable: "false",
      },
      value,
    ];
  },
});

/** Distinct original text fragments must not be coalesced by ProseMirror. */
const RitualSegment = Mark.create({
  name: "ritualSegment",
  inclusive: false,
  addAttributes: () => ({ id: { default: null } }),
  parseHTML: () => [{ tag: "span[data-ritual-segment]" }],
  renderHTML: () => ["span", { "data-ritual-segment": "" }, 0],
});

/** Editor-only schema. The saved semantic document never depends on Tiptap JSON. */
export const ritualTiptapExtensions = [
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    codeBlock: false,
    hardBreak: false,
    heading: false,
    horizontalRule: false,
    listItem: false,
    orderedList: false,
  }),
  RitualBlock,
  RitualSpan,
  RitualInline,
  RitualAtom,
  RitualSegment,
];

function toInline(node: RitualSemanticNode): JSONContent {
  if (node.kind === "text")
    return node.text
      ? {
          type: "text",
          text: node.text,
          marks: [{ type: "ritualSegment", attrs: { id: createUuidV7() } }],
        }
      : {
          type: "ritualInline",
          attrs: { id: createUuidV7(), tag: "emptyText", attrs: {} },
        };
  if (node.kind !== "element")
    throw new Error("Opaque content cannot be inline");
  const attrs = {
    id: node.id,
    tag: node.tag,
    attrs: node.attrs,
    children: node.children ?? null,
  };
  if (inlineAtoms.has(node.tag)) return { type: "ritualInline", attrs };
  if (inlineSpans.has(node.tag))
    return {
      type: "ritualSpan",
      attrs,
      content: (node.children ?? []).map(toInline),
    };
  throw new Error(`Unsupported inline node ${node.tag}`);
}

function toBlocks(nodes: RitualSemanticNode[]): JSONContent[] {
  const result: JSONContent[] = [];
  let run: JSONContent[] = [];
  const flush = () => {
    if (run.length) result.push({ type: "paragraph", content: run });
    run = [];
  };
  for (const node of nodes) {
    if (inline(node)) {
      run.push(toInline(node));
      continue;
    }
    flush();
    if (node.kind === "legacy") {
      result.push({
        type: "ritualAtom",
        attrs: { id: node.id, tag: "legacy", attrs: {}, raw: node.raw },
      });
      continue;
    }
    if (node.kind !== "element") throw new Error("Invalid semantic node");
    const attrs = { id: node.id, tag: node.tag, attrs: node.attrs };
    if (blockAtoms.has(node.tag))
      result.push({
        type: "ritualAtom",
        attrs: { ...attrs, children: node.children ?? null },
      });
    else
      result.push({
        type: "ritualBlock",
        attrs,
        content: toBlocks(node.children ?? []),
      });
  }
  flush();
  return result;
}

/** Adapt a validated semantic document into a ProseMirror document. */
export function semanticToTiptap(input: RitualSemanticDocument): JSONContent {
  const errors = validateRitualSemantic(input);
  if (errors.length) throw new Error(errors[0]);
  return { type: "doc", content: toBlocks(input.nodes) };
}

function fromInline(node: JSONContent): RitualSemanticNode {
  if (node.type === "text") {
    let result: RitualSemanticNode = { kind: "text", text: node.text ?? "" };
    for (const mark of node.marks ?? []) {
      if (mark.type === "ritualSegment") continue;
      if (mark.type !== "bold" && mark.type !== "italic")
        throw new Error(`Unsupported text mark ${mark.type}`);
      result = {
        kind: "element",
        id: createUuidV7(),
        tag: mark.type === "bold" ? "b" : "i",
        attrs: {},
        children: [result],
      };
    }
    return result;
  }
  if (node.type === "ritualInline") {
    if (node.attrs?.tag === "emptyText") return { kind: "text", text: "" };
    return {
      kind: "element",
      id: node.attrs?.id,
      tag: node.attrs?.tag,
      attrs: node.attrs?.attrs ?? {},
      ...(node.attrs?.children === null
        ? {}
        : { children: node.attrs?.children }),
    };
  }
  if (node.type === "ritualSpan")
    return {
      kind: "element",
      id: node.attrs?.id,
      tag: node.attrs?.tag,
      attrs: node.attrs?.attrs ?? {},
      children: (node.content ?? []).map(fromInline),
    };
  throw new Error(`Unsupported inline editor node ${node.type}`);
}

function fromBlocks(nodes: JSONContent[]): RitualSemanticNode[] {
  const result: RitualSemanticNode[] = [];
  let previousParagraph = false;
  for (const node of nodes) {
    if (node.type === "paragraph") {
      if (previousParagraph)
        result.push({
          kind: "element",
          id: createUuidV7(),
          tag: "br",
          attrs: {},
        });
      result.push(...(node.content ?? []).map(fromInline));
      previousParagraph = true;
      continue;
    }
    previousParagraph = false;
    if (node.type === "ritualAtom") {
      if (node.attrs?.tag === "legacy")
        result.push({
          kind: "legacy",
          id: node.attrs?.id,
          raw: node.attrs?.raw,
        });
      else
        result.push({
          kind: "element",
          id: node.attrs?.id,
          tag: node.attrs?.tag,
          attrs: node.attrs?.attrs ?? {},
          ...(node.attrs?.children === null
            ? {}
            : { children: node.attrs?.children }),
        });
      continue;
    }
    if (node.type === "ritualBlock") {
      const children = fromBlocks(node.content ?? []);
      const attrs = { ...(node.attrs?.attrs ?? {}) };
      if (
        node.attrs?.tag === "title" &&
        children.every((child) => child.kind === "text")
      )
        attrs.text = children
          .map((child) => (child.kind === "text" ? child.text : ""))
          .join("");
      result.push({
        kind: "element",
        id: node.attrs?.id,
        tag: node.attrs?.tag,
        attrs,
        children,
      });
      continue;
    }
    throw new Error(`Unsupported block editor node ${node.type}`);
  }
  return result;
}

/** Preserve the first copied identity and replace duplicate IDs after paste/split. */
export function semanticFromTiptap(input: JSONContent): RitualSemanticDocument {
  if (input.type !== "doc") throw new Error("Invalid editor root");
  const result: RitualSemanticDocument = {
    format: "magickli-ritual",
    version: 1,
    nodes: fromBlocks(input.content ?? []),
  };
  const ids = new Set<string>();
  const normalize = (nodes: RitualSemanticNode[]) => {
    for (const node of nodes) {
      if (node.kind === "text") continue;
      if (ids.has(node.id)) node.id = createUuidV7();
      ids.add(node.id);
      if (node.kind === "element" && node.children) normalize(node.children);
    }
  };
  normalize(result.nodes);
  const errors = validateRitualSemantic(result);
  if (errors.length) throw new Error(errors[0]);
  return result;
}
