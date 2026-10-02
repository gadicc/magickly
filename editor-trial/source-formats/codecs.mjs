// Research only: these codecs are not imported by the application.
import lex from "pug-lexer";
import parse from "pug-parser";
import { validateRitualSemantic } from "../../src/doc/semantic.ts";
import { parseRitualText, printRitualText } from "../../src/doc/ritualText.ts";

const document = (nodes) => ({ format: "magickli-ritual", version: 1, nodes });
const json = JSON.stringify;
function checked(doc) {
  const errors = validateRitualSemantic(doc);
  if (errors.length) throw new Error("Invalid semantic document");
  return doc;
}
const plain = (s) => s.length > 0 && !/[\r\n\t]/.test(s) && !/[#!][{[]/.test(s);
const args = (attrs) =>
  Object.entries(attrs)
    .map(([k, v]) => `${k}=${json(v)}`)
    .join(", ");
function pugAttrs(ast) {
  if (ast.attributeBlocks?.length)
    throw new Error("Attribute programs are unsupported");
  const attrs = {};
  for (const attr of ast.attrs ?? []) {
    if (
      Object.hasOwn(attrs, attr.name) ||
      attr.name === "__proto__" ||
      !attr.mustEscape
    )
      throw new Error("Invalid literal attribute");
    // JSON parsing only. No Pug expressions are ever evaluated.
    attrs[attr.name] = JSON.parse(attr.val);
  }
  return attrs;
}

const inlineTags = new Set(["a", "b", "i", "var", "grade", "br", "footnote"]);
function inlineChildren(nodes) {
  if (
    nodes.some(
      (node) =>
        node.kind !== "text" &&
        (node.kind !== "element" || !inlineTags.has(node.tag)),
    )
  )
    return null;
  const pieces = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.kind === "text") {
      const literal =
        plain(node.text) &&
        !/[\[\]]/.test(node.text) &&
        !node.text.endsWith("\\") &&
        nodes[i - 1]?.kind !== "text";
      pieces.push(
        literal ? node.text : `#[ritualText(value=${json(node.text)})/]`,
      );
    } else {
      const children =
        node.children === undefined ? null : inlineChildren(node.children);
      if (node.children !== undefined && children === null) return null;
      pieces.push(
        `#[${node.tag}(${args({ nodeId: node.id, ...node.attrs })})${node.children === undefined ? "/" : children ? ` ${children}` : ""}]`,
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
    .filter((node) => node.type !== "Text" || node.val !== "")
    .map(visit);
}

export const pug = {
  print(doc) {
    checked(doc);
    const lines = ["//- semantic-pug-trial 1"];
    const visit = (node, depth) => {
      const indent = "  ".repeat(depth);
      if (node.kind === "text") {
        // Pug inserts newlines between consecutive pipe-text lines. Literal
        // wrappers preserve text-node boundaries and all unusual whitespace.
        lines.push(`${indent}ritualText(value=${json(node.text)})/`);
        return;
      }
      if (node.kind === "legacy") {
        lines.push(
          `${indent}ritualLegacy(nodeId=${json(node.id)}, raw=${json(node.raw)})/`,
        );
        return;
      }
      const speech = safeSpeech(node);
      const tag = speech ? (node.attrs.say ? "say" : "do") : node.tag;
      const attributes = speech ? { role: node.attrs.role } : node.attrs;
      const header = `${indent}${tag}(${args({ nodeId: node.id, ...attributes })})`;
      const inline = node.children?.length
        ? inlineChildren(node.children)
        : null;
      if (inline !== null) {
        lines.push(`${header} ${inline}`);
      } else {
        lines.push(header + (node.children === undefined ? "/" : ""));
        node.children?.forEach((child) => visit(child, depth + 1));
      }
    };
    doc.nodes.forEach((node) => visit(node, 0));
    return lines.join("\n") + "\n";
  },
  parse(source) {
    const [header, ...lines] = source.split("\n");
    if (header !== "//- semantic-pug-trial 1")
      throw new Error("Invalid header");
    const ast = parse(lex(lines.join("\n")));
    const visit = (node) => {
      if (node.type === "Text") return { kind: "text", text: node.val };
      if (node.type !== "Tag")
        throw new Error("Template programs are unsupported");
      if (node.selfClosing && node.block.nodes.length)
        throw new Error("Leaf has children");
      const attrs = pugAttrs(node);
      if (node.name === "ritualText") {
        if (Object.keys(attrs).join() !== "value" || !node.selfClosing)
          throw new Error("Invalid text wrapper");
        return { kind: "text", text: attrs.value };
      }
      const { nodeId: id, ...rest } = attrs;
      if (node.name === "ritualLegacy") {
        if (Object.keys(rest).join() !== "raw" || !node.selfClosing)
          throw new Error("Invalid legacy wrapper");
        return { kind: "legacy", id, raw: rest.raw };
      }
      const speech = ["say", "do"].includes(node.name);
      if (speech && (Object.hasOwn(rest, "say") || Object.hasOwn(rest, "do")))
        throw new Error("Ambiguous task");
      const result = {
        kind: "element",
        id,
        tag: speech ? "task" : node.name,
        attrs: speech ? { [node.name]: true, ...rest } : rest,
      };
      if (!node.selfClosing) result.children = pugChildren(node.block, visit);
      else if (node.block.nodes.length) throw new Error("Leaf has children");
      return result;
    };
    return checked(document(ast.nodes.map(visit)));
  },
};

function safeSpeech(node) {
  return (
    node.tag === "task" &&
    node.children?.length === 1 &&
    node.children[0].kind === "text" &&
    plain(node.children[0].text) &&
    /^[a-z][a-z0-9,-]*$/.test(node.attrs.role) &&
    Object.keys(node.attrs).length === 2 &&
    ((node.attrs.say === true && !Object.hasOwn(node.attrs, "do")) ||
      (node.attrs.do === true && !Object.hasOwn(node.attrs, "say")))
  );
}
// Compact trial intentionally shares the proven Ritual Text parser: new surface
// forms desugar to its explicit tree grammar, which remains the exact fallback.
export const compact = {
  print(doc) {
    checked(doc);
    const lines = ["ritual compact-trial 1"];
    const visit = (node, depth) => {
      const indent = "  ".repeat(depth);
      if (node.kind === "text") {
        lines.push(
          `${indent}${plain(node.text) ? `| ${node.text}` : `= ${json(node.text)}`}`,
        );
      } else if (node.kind === "legacy") {
        lines.push(`${indent}?~${node.id} ${json(node.raw)}`);
      } else if (
        node.tag === "title" &&
        Object.keys(node.attrs).length === 1 &&
        node.children?.length === 1 &&
        node.children[0].kind === "text" &&
        node.attrs.text === node.children[0].text &&
        plain(node.attrs.text) &&
        !node.attrs.text.startsWith("{")
      ) {
        lines.push(`${indent}title~${node.id} ${node.attrs.text}`);
      } else if (
        node.tag === "summary" &&
        Object.keys(node.attrs).length === 1 &&
        typeof node.attrs.summary === "string"
      ) {
        lines.push(
          `${indent}summary~${node.id} ${json(node.attrs.summary)}${node.children === undefined ? "" : ":"}`,
        );
        node.children?.forEach((child) => visit(child, depth + 1));
      } else if (
        ["var", "grade"].includes(node.tag) &&
        Object.keys(node.attrs).length === 1 &&
        /^[A-Za-z0-9_=]+$/.test(
          node.attrs[node.tag === "var" ? "name" : "grade"],
        )
      ) {
        lines.push(
          `${indent}${node.tag}~${node.id} ${node.attrs[node.tag === "var" ? "name" : "grade"]}${node.children === undefined ? "" : ":"}`,
        );
        node.children?.forEach((child) => visit(child, depth + 1));
      } else if (safeSpeech(node)) {
        lines.push(
          `${indent}${node.attrs.say ? `${node.attrs.role}~${node.id}:` : `* ${node.attrs.role}~${node.id}`} ${node.children[0].text}`,
        );
      } else {
        // General custom tags keep a deterministic, exact fallback.
        const attrs = Object.keys(node.attrs).length
          ? ` ${json(node.attrs)}`
          : "";
        const inline =
          node.children?.length === 1 &&
          node.children[0].kind === "text" &&
          plain(node.children[0].text);
        lines.push(
          `${indent}${node.tag}~${node.id}${attrs}${inline ? ` | ${node.children[0].text}` : node.children === undefined ? "" : ":"}`,
        );
        if (!inline) node.children?.forEach((child) => visit(child, depth + 1));
      }
    };
    doc.nodes.forEach((node) => visit(node, 0));
    return lines.join("\n") + "\n";
  },
  parse(source) {
    const [header, ...lines] = source.split("\n");
    if (header !== "ritual compact-trial 1") throw new Error("Invalid header");
    const expanded = ["ritual 1"];
    for (const full of lines) {
      if (!full) continue;
      const indent = full.match(/^ */)[0];
      const line = full.slice(indent.length);
      const speech = /^([a-z][a-z0-9,-]*)~([A-Za-z0-9-]+): (.*)$/.exec(line);
      const action = /^\* ([a-z][a-z0-9,-]*)~([A-Za-z0-9-]+) (.*)$/.exec(line);
      const match = speech ?? action;
      const title = /^title~([A-Za-z0-9-]+) (?![{])(.*)$/.exec(line);
      if (title) expanded.push(`${indent}@title~${title[1]} ${json(title[2])}`);
      else if (match)
        expanded.push(
          `${indent}@${speech ? "say" : "do"}~${match[2]} ${match[1]} ${json(match[3])}`,
        );
      else if (line.startsWith("| "))
        expanded.push(`${indent}= ${json(line.slice(2))}`);
      else if (/^[=?]/.test(line)) expanded.push(full);
      else {
        // The inline delimiter is sought outside strings/containers, not in
        // attribute values such as a summary containing " | ".
        let split = -1,
          quoted = false,
          escape = false,
          nesting = 0;
        for (let n = 0; n < line.length; n++) {
          const c = line[n];
          if (quoted) {
            if (escape) escape = false;
            else if (c === "\\") escape = true;
            else if (c === '"') quoted = false;
          } else if (c === '"') quoted = true;
          else if ("[{".includes(c)) nesting++;
          else if ("]}".includes(c)) nesting--;
          else if (!nesting && line.slice(n, n + 3) === " | ") {
            split = n;
            break;
          }
        }
        if (split < 0) expanded.push(`${indent}@${line}`);
        else {
          expanded.push(`${indent}@${line.slice(0, split)}:`);
          expanded.push(`${indent}  = ${json(line.slice(split + 3))}`);
        }
      }
    }
    return parseRitualText(expanded.join("\n"));
  },
};

// This measures an explicit directive tree, NOT a complete CommonMark parser.
// Exact whitespace and inline identity still require literal/custom fallbacks.
export const directives = {
  print(doc) {
    checked(doc);
    const lines = ["<!-- ritual-directive-trial 1 -->"];
    const visit = (node, depth) => {
      const indent = "  ".repeat(depth);
      if (node.kind === "text") {
        lines.push(`${indent}= ${json(node.text)}`);
        return;
      }
      if (node.kind === "legacy") {
        lines.push(`${indent}:::legacy~${node.id} ${json(node.raw)} /`);
        return;
      }
      const attrs = Object.keys(node.attrs).length
        ? ` ${json(node.attrs)}`
        : "";
      lines.push(
        `${indent}:::${node.tag}~${node.id}${attrs}${node.children === undefined ? " /" : ""}`,
      );
      if (node.children !== undefined) {
        node.children.forEach((child) => visit(child, depth + 1));
        lines.push(`${indent}:::`);
      }
    };
    doc.nodes.forEach((node) => visit(node, 0));
    return lines.join("\n") + "\n";
  },
  parse(source) {
    const [header, ...lines] = source.split("\n");
    if (header !== "<!-- ritual-directive-trial 1 -->")
      throw new Error("Invalid header");
    const expanded = ["ritual 1"];
    const opens = [];
    for (const full of lines) {
      if (!full) continue;
      const indent = full.match(/^ */)[0];
      const line = full.slice(indent.length);
      if (
        line !== ":::" &&
        indent.length !== (opens.length ? opens.at(-1) + 2 : 0)
      )
        throw new Error("Invalid directive nesting");
      if (line === ":::") {
        if (opens.pop() !== indent.length)
          throw new Error("Mismatched directive close");
      } else if (line.startsWith(":::legacy~")) {
        if (!line.endsWith(" /")) throw new Error("Invalid legacy directive");
        expanded.push(`${indent}?~${line.slice(":::legacy~".length, -2)}`);
      } else if (line.startsWith(":::")) {
        if (opens.length && indent.length !== opens.at(-1) + 2)
          throw new Error("Invalid nesting");
        const leaf = line.endsWith(" /");
        expanded.push(
          `${indent}@${line.slice(3, leaf ? -2 : undefined)}${leaf ? "" : ":"}`,
        );
        if (!leaf) opens.push(indent.length);
      } else if (line.startsWith("= ")) expanded.push(full);
      else throw new Error("Unsupported directive content");
    }
    if (opens.length) throw new Error("Unclosed directive");
    return parseRitualText(expanded.join("\n"));
  },
};

export const candidates = {
  current: { print: printRitualText, parse: parseRitualText },
  pug,
  compact,
  directives,
};
