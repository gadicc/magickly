import { fixture, normalizeIdentity } from "./model.js";

const copy = (value) => structuredClone(value);
const freshId = () => globalThis.crypto?.randomUUID?.() || `new-${Date.now()}-${Math.random()}`;

export function toSlate(document) {
  const convert = (node) => {
    if (node.type === "text") return { text: node.text, ...(node.marks ? { marks: copy(node.marks) } : {}), ...(node.lang ? { lang: node.lang } : {}), ...(node.dir ? { dir: node.dir } : {}) };
    const { children, ...attrs } = node;
    return { ...copy(attrs), children: children ? children.map(convert) : [{ text: "" }] };
  };
  return document.nodes.map(convert);
}

export function fromSlate(nodes, base = fixture) {
  const convert = (node) => {
    if (node.type === undefined) {
      const result = { type: "text", text: node.text || "" };
      if (node.lang) result.lang = node.lang;
      if (node.dir) result.dir = node.dir;
      if (node.marks) result.marks = copy(node.marks);
      return result;
    }
    const { children, ...attrs } = node;
    const result = copy(attrs);
    if (["heading", "task", "paragraph", "summary", "note", "footnote"].includes(node.type)) result.children = children.map(convert);
    return result;
  };
  return normalizeIdentity({ schemaVersion: 1, roles: copy(base.roles), aliases: copy(base.aliases), nodes: nodes.map(convert) }, base);
}

export function toTiptap(document) {
  const convert = (node) => {
    if (node.type === "text") {
      const result = { type: "text", text: node.text };
      const marks = [];
      if (node.marks) marks.push(...node.marks.map((type) => ({ type })));
      if (node.lang || node.dir) marks.push({ type: "languageSpan", attrs: { lang: node.lang || null, dir: node.dir || null } });
      if (marks.length) result.marks = marks;
      return result;
    }
    const { type, children, ...attrs } = node;
    if (type === "paragraph") return { type, attrs: { id: node.id }, content: children.map(convert) };
    return { type, attrs: copy(attrs), ...(children ? { content: children.map(convert) } : {}) };
  };
  return { type: "doc", content: document.nodes.map(convert) };
}

export function fromTiptap(json, base = fixture) {
  const convert = (node) => {
    if (node.type === "text") {
      const result = { type: "text", text: node.text || "" };
      const span = node.marks?.find((mark) => mark.type === "languageSpan");
      if (span?.attrs?.lang) result.lang = span.attrs.lang;
      if (span?.attrs?.dir) result.dir = span.attrs.dir;
      const marks = node.marks?.filter((mark) => ["bold", "italic"].includes(mark.type)).map((mark) => mark.type);
      if (marks?.length) result.marks = marks;
      return result;
    }
    const attrs = copy(node.attrs || {});
    const result = { ...(node.type === "variableRef" || node.type === "grade" ? {} : { id: attrs.id || freshId() }), type: node.type };
    if (node.type === "paragraph") result.children = (node.content || []).map(convert);
    else {
      delete attrs.id;
      Object.assign(result, attrs);
      if (["heading", "task", "summary", "note", "footnote"].includes(node.type)) result.children = (node.content || []).map(convert);
    }
    return result;
  };
  return normalizeIdentity({ schemaVersion: 1, roles: copy(base.roles), aliases: copy(base.aliases), nodes: (json.content || []).map(convert) }, base);
}

export const newTask = (mode = "say") => ({
  id: freshId(), type: "task", mode,
  audience: { scope: "all", roles: [] },
  children: [{ id: freshId(), type: "paragraph", children: [{ type: "text", text: "New ritual task" }] }],
});
