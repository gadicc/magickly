import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

const json = (value) => JSON.stringify(value);
const parseJson = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};
const data = (name) => `data-ritual-${name}`;
const id = { default: null, parseHTML: (el) => el.getAttribute(data("id")), renderHTML: (attrs) => ({ [data("id")]: attrs.id }) };

const Task = Node.create({
  name: "task", group: "block", content: "block+", defining: true, isolating: true,
  addAttributes() {
    return {
      id,
      mode: { default: "say", parseHTML: (el) => el.getAttribute(data("mode")), renderHTML: (attrs) => ({ [data("mode")]: attrs.mode }) },
      audience: { default: { scope: "all", roles: [] }, parseHTML: (el) => parseJson(el.getAttribute(data("audience")), { scope: "all", roles: [] }), renderHTML: (attrs) => ({ [data("audience")]: json(attrs.audience) }) },
    };
  },
  parseHTML() { return [{ tag: "section[data-ritual-task]" }]; },
  renderHTML({ HTMLAttributes }) { return ["section", mergeAttributes(HTMLAttributes, { "data-ritual-task": "", class: "task" }), ["div", { class: "task-label", contenteditable: "false" }, `${HTMLAttributes["data-ritual-mode"]} · ${parseJson(HTMLAttributes["data-ritual-audience"], {}).scope || "all"}`], ["div", 0]]; },
});

const Heading = Node.create({
  name: "heading", group: "block", content: "inline*", defining: true,
  addAttributes() { return {
    id,
    level: { default: 1, parseHTML: (el) => Number(el.tagName.slice(1)), renderHTML: () => ({}) },
    anchor: { default: "", parseHTML: (el) => el.id || "", renderHTML: (attrs) => ({ id: attrs.anchor }) },
  }; },
  parseHTML() { return [{ tag: "h1" }, { tag: "h2" }, { tag: "h3" }]; },
  renderHTML({ node, HTMLAttributes }) { return [`h${node.attrs.level}`, HTMLAttributes, 0]; },
});

function container(name, tag) {
  return Node.create({
    name, group: "block", content: "block+", defining: true, isolating: true,
    addAttributes() { return name === "summary" ? {
      id,
      label: { default: "Summary", parseHTML: (el) => el.getAttribute(data("label")), renderHTML: (attrs) => ({ [data("label")]: attrs.label }) },
    } : { id }; },
    parseHTML() { return [{ tag: `${tag}[${data(name)}]` }]; },
    renderHTML({ HTMLAttributes }) {
      if (name === "summary") return ["details", mergeAttributes(HTMLAttributes, { [data(name)]: "" }), ["summary", { contenteditable: "false" }, HTMLAttributes[data("label")] || "Summary"], ["div", 0]];
      return [tag, mergeAttributes(HTMLAttributes, { [data(name)]: "", class: name }), 0];
    },
  });
}

function atom(name, tag, attrs, label) {
  return Node.create({
    name, group: name === "variableRef" || name === "grade" ? "inline" : "block",
    inline: name === "variableRef" || name === "grade", atom: true, selectable: true,
    addAttributes() { return { ...(name === "variableRef" || name === "grade" ? {} : { id }), ...attrs }; },
    parseHTML() { return [{ tag: `${tag}[${data(name)}]` }]; },
    renderHTML({ node, HTMLAttributes }) {
      return [tag, mergeAttributes(HTMLAttributes, { [data(name)]: "", class: `atom ${name}` }), label(node.attrs)];
    },
  });
}

const strAttr = (name, fallback = "") => ({
  default: fallback,
  parseHTML: (el) => el.getAttribute(data(name)) || fallback,
  renderHTML: (attrs) => ({ [data(name)]: attrs[name] }),
});
const VariableRef = atom("variableRef", "span", { name: strAttr("name") }, (attrs) => `{${attrs.name}}`);
const Grade = atom("grade", "span", { value: strAttr("value") }, (attrs) => attrs.value);
const Declaration = atom("declaration", "div", {
  name: strAttr("name"), label: strAttr("label"), input: strAttr("input", "text"), default: strAttr("default"),
  options: { default: [], parseHTML: (el) => parseJson(el.getAttribute(data("options")), []), renderHTML: (attrs) => ({ [data("options")]: json(attrs.options) }) },
}, (attrs) => `Variable: ${attrs.label || attrs.name} (${attrs.input})`);
const Image = atom("image", "div", {
  src: strAttr("src"), alt: strAttr("alt"), width: { default: 320, parseHTML: (el) => Number(el.getAttribute(data("width"))) || 320, renderHTML: (attrs) => ({ [data("width")]: attrs.width }) },
}, (attrs) => `Image: ${attrs.alt} · ${attrs.src}`);
const Legacy = atom("legacy", "div", { source: strAttr("source") }, (attrs) => `Unsupported legacy source: ${attrs.source}`);

const ParagraphId = Extension.create({
  name: "paragraphId",
  addGlobalAttributes() {
    return [{ types: ["paragraph"], attributes: { id } }];
  },
});

const LanguageSpan = Mark.create({
  name: "languageSpan",
  addAttributes() { return {
    lang: { default: null, parseHTML: (el) => el.getAttribute("lang"), renderHTML: (attrs) => attrs.lang ? { lang: attrs.lang } : {} },
    dir: { default: null, parseHTML: (el) => el.getAttribute("dir"), renderHTML: (attrs) => attrs.dir ? { dir: attrs.dir } : {} },
  }; },
  parseHTML() { return [{ tag: "span[lang]" }, { tag: "span[dir]" }]; },
  renderHTML({ HTMLAttributes }) { return ["span", HTMLAttributes, 0]; },
});

export const extensions = [
  StarterKit.configure({ heading: false, trailingNode: false }),
  ParagraphId, Heading, Task,
  container("note", "aside"), container("summary", "details"), container("footnote", "aside"),
  VariableRef, Grade, Declaration, Image, Legacy, LanguageSpan,
];
