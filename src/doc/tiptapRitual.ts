import {
  type Editor,
  getSchema,
  type JSONContent,
  Mark,
  Node,
} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { parseRitualFileLocator } from "../files/ritualFileLocator";
import { createUuidV7, isUuidV7 } from "../lib/ids";
import {
  type JsonValue,
  type RitualSemanticDocument,
  type RitualSemanticNode,
  semanticToJrt,
  validateRitualSemantic,
} from "./semantic";
import { hasDirectNestedTask } from "./semanticEditorCompatibility";

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

// Clipboard HTML must carry the semantic identity and attributes. Without this,
// ProseMirror reparses a copied task as an untyped container and can nest it in
// the task at the paste position.
function clipboardAttrs(element: HTMLElement) {
  const value = element.getAttribute("data-ritual-meta");
  if (!value) return false;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return false;
    const meta = parsed as Record<string, unknown>;
    const tag =
      element.getAttribute("data-ritual-block") ??
      element.getAttribute("data-ritual-span") ??
      element.getAttribute("data-ritual-inline") ??
      element.getAttribute("data-ritual-atom");
    if (
      typeof meta.id !== "string" ||
      meta.tag !== tag ||
      !meta.attrs ||
      typeof meta.attrs !== "object" ||
      Array.isArray(meta.attrs)
    )
      return false;
    return meta;
  } catch {
    return false;
  }
}

function clipboardMeta(node: { attrs: Record<string, unknown> }) {
  return JSON.stringify(node.attrs);
}

function blockHTML(node: { attrs: Record<string, unknown> }) {
  const attrs = node.attrs.attrs as Record<string, JsonValue>;
  return [
    "section",
    {
      "data-ritual-block": node.attrs.tag,
      "data-ritual-meta": clipboardMeta(node),
      class: `ritual-block ritual-${node.attrs.tag}`,
    },
    [
      "div",
      { class: "ritual-label", contenteditable: "false" },
      label(String(node.attrs.tag), attrs),
    ],
    ["div", { class: "ritual-content" }, 0],
  ] as const;
}

const RitualBlock = Node.create({
  name: "ritualBlock",
  group: "block",
  content: "block*",
  defining: true,
  isolating: true,
  addAttributes: () => nodeAttrs,
  parseHTML: () => [
    {
      tag: "section[data-ritual-block]:not([data-ritual-block='task'])",
      getAttrs: clipboardAttrs,
      contentElement: ".ritual-content",
    },
  ],
  renderHTML({ node }) {
    return blockHTML(node);
  },
});

const RitualTask = Node.create({
  name: "ritualTask",
  group: "block",
  // A task can contain notes and other structural blocks, but never a task.
  // This forces whole-task paste beside the current task, not inside it.
  content: "(paragraph | ritualBlock | ritualAtom)*",
  defining: true,
  isolating: true,
  addAttributes: () => nodeAttrs,
  parseHTML: () => [
    {
      tag: "section[data-ritual-block='task']",
      getAttrs: clipboardAttrs,
      contentElement: ".ritual-content",
    },
  ],
  renderHTML({ node }) {
    return blockHTML(node);
  },
});

const RitualSpan = Node.create({
  name: "ritualSpan",
  group: "inline",
  inline: true,
  content: "inline*",
  addAttributes: () => nodeAttrs,
  parseHTML: () => [
    { tag: "span[data-ritual-span]", getAttrs: clipboardAttrs },
  ],
  renderHTML({ node }) {
    const tag = node.attrs.tag as string;
    return [
      "span",
      {
        "data-ritual-span": tag,
        "data-ritual-meta": clipboardMeta(node),
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
  parseHTML: () => [
    { tag: "span[data-ritual-inline]", getAttrs: clipboardAttrs },
  ],
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
        "data-ritual-meta": clipboardMeta(node),
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
  parseHTML: () => [{ tag: "div[data-ritual-atom]", getAttrs: clipboardAttrs }],
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
    if (tag === "img" && parseRitualFileLocator(attrs.src))
      return [
        "div",
        {
          "data-ritual-atom": tag,
          "data-ritual-meta": clipboardMeta(node),
          class: "ritual-atom",
          contenteditable: "false",
        },
        [
          "img",
          {
            src: String(attrs.src),
            alt: String(attrs.alt || "Attached ritual image"),
            style: "max-width:100%;max-height:360px;object-fit:contain",
          },
        ],
        ["div", {}, value],
      ];
    return [
      "div",
      {
        "data-ritual-atom": tag,
        "data-ritual-meta": clipboardMeta(node),
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
  parseHTML: () => [
    {
      tag: "span[data-ritual-segment]",
      getAttrs: (element) => ({
        id: element.getAttribute("data-ritual-segment"),
      }),
    },
  ],
  renderHTML: ({ mark }) => [
    "span",
    { "data-ritual-segment": mark.attrs.id },
    0,
  ],
});

/** Editor-only schema. The saved semantic document never depends on Tiptap JSON. */
export const ritualTiptapExtensions = [
  StarterKit.configure({
    code: false,
    link: false,
    strike: false,
    underline: false,
    blockquote: false,
    bulletList: false,
    codeBlock: false,
    hardBreak: false,
    heading: false,
    horizontalRule: false,
    listItem: false,
    orderedList: false,
    trailingNode: false,
  }),
  RitualBlock,
  RitualTask,
  RitualSpan,
  RitualInline,
  RitualAtom,
  RitualSegment,
];

const ritualSchema = getSchema(ritualTiptapExtensions);

/** Refuse visual edits when ProseMirror would alter the semantic reader tree. */
export function visualRitualState(input: RitualSemanticDocument): {
  content: JSONContent;
  issue: string | null;
} {
  try {
    const content = semanticToTiptap(input);
    const parsed = ritualSchema.nodeFromJSON(content);
    parsed.check();
    if (
      JSON.stringify(semanticToJrt(input)) !==
      JSON.stringify(semanticToJrt(semanticFromTiptap(parsed.toJSON())))
    )
      throw new Error(
        "This structure cannot round-trip through visual editing.",
      );
    return { content, issue: null };
  } catch {
    return {
      content: { type: "doc", content: [{ type: "paragraph" }] },
      issue:
        "This ritual contains structures that require source editing. Its content is preserved.",
    };
  }
}

/** Keep pasted identities stable in ProseMirror, not just in a derived snapshot. */
export function normalizeTiptapNodeIds(editor: Editor): boolean {
  const seen = new Set<string>();
  const tr = editor.state.tr;
  editor.state.doc.descendants((node, pos) => {
    if (
      ![
        "ritualBlock",
        "ritualTask",
        "ritualSpan",
        "ritualInline",
        "ritualAtom",
      ].includes(node.type.name)
    )
      return;
    const id = node.attrs.id;
    if (typeof id === "string" && isUuidV7(id) && !seen.has(id)) {
      seen.add(id);
      return;
    }
    const fresh = createUuidV7();
    seen.add(fresh);
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: fresh }, node.marks);
  });
  if (!tr.docChanged) return false;
  tr.setMeta("addToHistory", false);
  editor.view.dispatch(tr);
  return true;
}

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
        type: node.tag === "task" ? "ritualTask" : "ritualBlock",
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
  if (hasDirectNestedTask(input.nodes))
    throw new Error("Nested tasks are not supported by the visual editor");
  const content = toBlocks(input.nodes);
  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
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
      let previousSegment: string | null = null;
      for (const part of node.content ?? []) {
        const converted = fromInline(part);
        const segment = part.marks?.find(
          (mark) => mark.type === "ritualSegment",
        )?.attrs?.id;
        const last = result.at(-1);
        if (
          converted.kind === "text" &&
          converted.text !== "" &&
          last?.kind === "text" &&
          last.text !== "" &&
          (typeof segment !== "string" ||
            previousSegment === null ||
            segment === previousSegment)
        )
          last.text += converted.text;
        else result.push(converted);
        previousSegment =
          converted.kind === "text" && typeof segment === "string"
            ? segment
            : null;
      }
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
    if (node.type === "ritualBlock" || node.type === "ritualTask") {
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
