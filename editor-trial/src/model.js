// Trial-only semantic shape. IDs below are fixed so repeated conversions can be compared.
const text = (value) => ({ type: "text", text: value });
const para = (id, children) => ({ id, type: "paragraph", children });

export const fixture = {
  schemaVersion: 1,
  roles: ["hierophant", "hiereus", "keryx", "candidate", "member"],
  aliases: { hiero: "hierophant", phylax: "sentinel" },
  nodes: [
    { id: "h1", type: "heading", level: 1, anchor: "opening", children: [text("Opening of the Hall")] },
    { id: "d1", type: "declaration", name: "myRole", label: "My role", input: "select", default: "member", options: [{ value: "member", label: "Member" }, { value: "hierophant", label: "Hierophant" }, { value: "keryx", label: "Keryx" }] },
    { id: "d2", type: "declaration", name: "candidateName", label: "Candidate name", input: "text", default: "Candidate", options: [] },
    { id: "t1", type: "task", mode: "say", audience: { scope: "roles", roles: ["hiero", "keryx"] }, children: [
      para("p1", [text("Welcome "), { type: "variableRef", name: "candidateName" }, text(" to "), { type: "grade", value: "0=0" }, text(". שלום עולם 𐌀")]),
    ] },
    { id: "t2", type: "task", mode: "do", audience: { scope: "officers" }, children: [para("p2", [text("Rise and face east.")])] },
    { id: "t3", type: "task", mode: "do", audience: { scope: "except", roles: ["candidate"] }, children: [para("p3", [text("Make the sign.")])] },
    { id: "t4", type: "task", mode: "say", audience: { scope: "officersExcept", roles: ["keryx"] }, children: [para("p4", [text("Respond together.")])] },
    { id: "t5", type: "task", mode: "say", audience: { scope: "all" }, children: [para("p8", [text("Let all present answer.")])] },
    { id: "n1", type: "note", children: [
      para("p5", [text("Use the "), { type: "text", text: "traditional", marks: ["bold"] }, text(" pronunciation.")]),
      { id: "s1", type: "summary", label: "Pronunciation", children: [para("p6", [text("Hebrew: "), { type: "text", text: "שָׁלוֹם", dir: "rtl", lang: "he" }, text("; Enochian: "), { type: "text", text: "OL SONF", dir: "ltr", lang: "x-enochian" }])] },
    ] },
    { id: "f1", type: "footnote", children: [para("p7", [text("Synthetic reference, not a source citation.")])] },
    { id: "i1", type: "image", src: "/temple.svg", alt: "Synthetic temple diagram", width: 320 },
    { id: "h2", type: "heading", level: 2, anchor: "close", children: [text("Closing")] },
    { id: "u1", type: "legacy", source: "mystery-widget(mode='opaque') Keep this exact source" },
  ],
};

export const malformedSource = 'say(role="hierophant" Unclosed';

export function longDocument(repetitions = 200) {
  const nodes = [];
  for (let index = 0; index < repetitions; index++) {
    const clone = structuredClone(fixture.nodes);
    for (const node of clone) {
      if (index > 0 && node.type === "declaration") continue;
      const rewrite = (value) => {
        if (value && typeof value === "object") {
          if (typeof value.id === "string") value.id = `${value.id}-${index}`;
          if (typeof value.anchor === "string") value.anchor = `${value.anchor}-${index}`;
          if (Array.isArray(value.children)) value.children.forEach(rewrite);
        }
      };
      rewrite(node);
      nodes.push(node);
    }
  }
  return { ...fixture, nodes };
}

const blockTypes = new Set(["heading", "declaration", "task", "paragraph", "summary", "note", "footnote", "image", "legacy"]);
const inlineTypes = new Set(["text", "variableRef", "grade"]);

export function validate(document) {
  const errors = [];
  if (document?.schemaVersion !== 1 || !Array.isArray(document.nodes)) return ["Unsupported document version or missing nodes"];
  const ids = new Set();
  const anchors = new Set();
  const declarations = new Set();
  const refs = [];
  function visit(node, path, inline = false) {
    if (!node || typeof node !== "object") return errors.push(`${path}: invalid node`);
    if (!(inline ? inlineTypes : blockTypes).has(node.type)) errors.push(`${path}: unknown node type ${node.type}`);
    if (!inline) {
      if (typeof node.id !== "string" || !node.id) errors.push(`${path}: missing id`);
      else if (ids.has(node.id)) errors.push(`${path}: duplicate id ${node.id}`);
      else ids.add(node.id);
    }
    if (node.type === "declaration") {
      if (declarations.has(node.name)) errors.push(`${path}: duplicate declaration ${node.name}`);
      declarations.add(node.name);
      if (node.input === "select" && !node.options?.some((o) => o.value === node.default)) errors.push(`${path}: default is not an option`);
    }
    if (node.type === "variableRef") refs.push([node.name, path]);
    if (node.type === "text" && node.marks?.some((mark) => !["bold", "italic"].includes(mark))) errors.push(`${path}: unsupported text mark`);
    if (node.type === "task") {
      if (!["say", "do"].includes(node.mode)) errors.push(`${path}: invalid task mode`);
      if (!["all", "roles", "officers", "except", "officersExcept"].includes(node.audience?.scope)) errors.push(`${path}: invalid audience`);
    }
    if (node.type === "grade" && !/^\d{1,2}=\d{1,2}$/.test(node.value)) errors.push(`${path}: invalid grade`);
    if (node.type === "heading") {
      if (!/^[a-z0-9-]+$/.test(node.anchor)) errors.push(`${path}: invalid anchor`);
      else if (anchors.has(node.anchor)) errors.push(`${path}: duplicate anchor ${node.anchor}`);
      else anchors.add(node.anchor);
    }
    if (node.type === "image" && !node.alt) errors.push(`${path}: image needs alt text`);
    if (node.type === "legacy" && !node.source) errors.push(`${path}: empty legacy source`);
    const childInline = ["heading", "paragraph"].includes(node.type);
    if (node.children) node.children.forEach((child, index) => visit(child, `${path}.children[${index}]`, childInline));
  }
  document.nodes.forEach((node, index) => visit(node, `nodes[${index}]`));
  for (const [name, path] of refs) if (!declarations.has(name)) errors.push(`${path}: missing variable ${name}`);
  return errors;
}

export function canonical(document) {
  return JSON.stringify(document);
}

/** Keep the first occurrence of an ID on split/copy; give new blocks fresh IDs. */
export function normalizeIdentity(document, previous = null) {
  const result = structuredClone(document);
  const ids = new Set();
  const anchors = new Set();
  const visit = (node, prior) => {
    if (!node || typeof node !== "object") return;
    if (node.type !== "text" && node.type !== "variableRef" && node.type !== "grade") {
      if (!node.id || ids.has(node.id)) {
        node.id = prior?.type === node.type && prior.id && !ids.has(prior.id)
          ? prior.id : globalThis.crypto.randomUUID();
      }
      ids.add(node.id);
    }
    if (node.type === "heading") {
      const root = (node.anchor || "heading").replace(/[^a-z0-9-]/g, "-") || "heading";
      let candidate = root, suffix = 2;
      while (anchors.has(candidate)) candidate = `${root}-${suffix++}`;
      node.anchor = candidate;
      anchors.add(candidate);
    }
    node.children?.forEach((child, index) => visit(child, prior?.children?.[index]));
  };
  result.nodes.forEach((node, index) => visit(node, previous?.nodes?.[index]));
  return result;
}

export function audienceIncludes(audience, role, aliases = {}) {
  const normalized = aliases[role] || role;
  const listed = (audience.roles || []).map((r) => aliases[r] || r);
  if (audience.scope === "all") return true;
  if (audience.scope === "roles") return listed.includes(normalized);
  if (audience.scope === "officers") return !["candidate", "member"].includes(normalized);
  if (audience.scope === "except") return !listed.includes(normalized);
  if (audience.scope === "officersExcept") return !["candidate", "member"].includes(normalized) && !listed.includes(normalized);
  return false;
}
