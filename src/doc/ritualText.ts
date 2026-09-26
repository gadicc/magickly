import { createUuidV7 } from "../lib/ids";
import {
  type JsonValue,
  type RitualSemanticDocument,
  type RitualSemanticNode,
  validateRitualSemantic,
} from "./semantic";

/** Readable ritual-tree projection. It is never interpreted as Markdown or HTML. */
export function printRitualText(document: RitualSemanticDocument): string {
  const errors = validateRitualSemantic(document);
  if (errors.length) throw new Error(errors[0]);
  const lines = ["ritual 1"];
  const print = (nodes: RitualSemanticNode[], depth: number) => {
    const indent = "  ".repeat(depth);
    for (const node of nodes) {
      if (node.kind === "text") {
        lines.push(`${indent}= ${JSON.stringify(node.text)}`);
        continue;
      }
      if (node.kind === "legacy") {
        lines.push(`${indent}?~${node.id} ${JSON.stringify(node.raw)}`);
        continue;
      }
      const keys = Object.keys(node.attrs);
      const singleText =
        node.children?.length === 1 && node.children[0].kind === "text";
      if (
        node.tag === "task" &&
        singleText &&
        keys.length === 2 &&
        keys.includes("role") &&
        (keys.includes("say") || keys.includes("do"))
      ) {
        const action = node.attrs.say === true ? "say" : "do";
        lines.push(
          `${indent}@${action}~${node.id} ${node.attrs.role} ${JSON.stringify((node.children![0] as { kind: "text"; text: string }).text)}`,
        );
        continue;
      }
      if (
        node.tag === "title" &&
        singleText &&
        node.attrs.text ===
          (node.children![0] as { kind: "text"; text: string }).text &&
        keys.length === 1
      ) {
        lines.push(
          `${indent}@title~${node.id} ${JSON.stringify(node.attrs.text)}`,
        );
        continue;
      }
      if (
        node.tag === "summary" &&
        keys.length === 1 &&
        typeof node.attrs.summary === "string"
      ) {
        const value = node.attrs.summary;
        lines.push(
          `${indent}@summary~${node.id} ${JSON.stringify(value)}${node.children === undefined ? "" : ":"}`,
        );
        if (node.children) print(node.children, depth + 1);
        continue;
      }
      if (
        (node.tag === "var" || node.tag === "grade") &&
        keys.length === 1 &&
        typeof node.attrs[node.tag === "var" ? "name" : "grade"] === "string"
      ) {
        const value = node.attrs[node.tag === "var" ? "name" : "grade"];
        lines.push(
          `${indent}@${node.tag}~${node.id} ${value}${node.children === undefined ? "" : ":"}`,
        );
        if (node.children) print(node.children, depth + 1);
        continue;
      }
      const attrs = keys.length ? ` ${JSON.stringify(node.attrs)}` : "";
      lines.push(
        `${indent}@${node.tag}~${node.id}${attrs}${node.children === undefined ? "" : ":"}`,
      );
      if (node.children) print(node.children, depth + 1);
    }
  };
  print(document.nodes, 0);
  return lines.join("\n") + "\n";
}

function parseJson(text: string, line: number): JsonValue {
  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    throw new Error(`Line ${line}: invalid JSON value`);
  }
}

/** Parse a complete ritual tree. Unlabelled task shortcuts receive fresh IDs. */
export function parseRitualText(source: string): RitualSemanticDocument {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  if (lines.shift() !== "ritual 1")
    throw new Error("Line 1: expected ritual 1");
  const root: RitualSemanticNode[] = [];
  const parents: Array<RitualSemanticNode[] | null> = [root];
  for (let index = 0; index < lines.length; index++) {
    const full = lines[index];
    if (full === "") continue;
    const spaces = full.match(/^ */)![0].length;
    if (spaces % 2 || spaces / 2 >= parents.length)
      throw new Error(`Line ${index + 2}: invalid indentation`);
    const depth = spaces / 2;
    const parent = parents[depth];
    if (!parent)
      throw new Error(`Line ${index + 2}: the previous node has no children`);
    const line = full.slice(spaces);
    const lineNumber = index + 2;
    let node: RitualSemanticNode;
    if (line.startsWith("= ")) {
      const value = parseJson(line.slice(2), lineNumber);
      if (typeof value !== "string")
        throw new Error(`Line ${lineNumber}: text must be a JSON string`);
      node = { kind: "text", text: value };
    } else if (line.startsWith("?~")) {
      const match = /^\?~([0-9a-f-]+) (.+)$/.exec(line);
      if (!match) throw new Error(`Line ${lineNumber}: invalid opaque node`);
      node = {
        kind: "legacy",
        id: match[1],
        raw: parseJson(match[2], lineNumber),
      };
    } else if (/^\* [A-Za-z][A-Za-z0-9,-]* /.test(line)) {
      const match = /^\* ([A-Za-z][A-Za-z0-9,-]*) (.*)$/.exec(line)!;
      node = {
        kind: "element",
        id: createUuidV7(),
        tag: "task",
        attrs: { do: true, role: match[1].toLowerCase() },
        children: [{ kind: "text", text: match[2] }],
      };
    } else if (/^[A-Za-z][A-Za-z0-9,-]*:/.test(line)) {
      const match = /^([A-Za-z][A-Za-z0-9,-]*):(?: ?)(.*)$/.exec(line)!;
      node = {
        kind: "element",
        id: createUuidV7(),
        tag: "task",
        attrs: { say: true, role: match[1].toLowerCase() },
        children: [{ kind: "text", text: match[2] }],
      };
    } else if (line.startsWith("@")) {
      const shortcut =
        /^@(say|do)(?:~([0-9a-f-]+))? ([A-Za-z][A-Za-z0-9,-]*) (".*")$/.exec(
          line,
        );
      if (shortcut) {
        const value = parseJson(shortcut[4], lineNumber);
        if (typeof value !== "string")
          throw new Error(`Line ${lineNumber}: task text must be a string`);
        node = {
          kind: "element",
          id: shortcut[2] ?? createUuidV7(),
          tag: "task",
          attrs: { [shortcut[1]]: true, role: shortcut[3] },
          children: [{ kind: "text", text: value }],
        };
      } else {
        const label = /^@(summary|title)(?:~([0-9a-f-]+))? (".*")(:?)$/.exec(
          line,
        );
        const inlineAtom =
          /^@(var|grade)(?:~([0-9a-f-]+))? ([A-Za-z0-9_=]+)(:?)$/.exec(line);
        if (label) {
          const value = parseJson(label[3], lineNumber);
          if (typeof value !== "string")
            throw new Error(`Line ${lineNumber}: label must be a string`);
          node = {
            kind: "element",
            id: label[2] ?? createUuidV7(),
            tag: label[1],
            attrs: { [label[1] === "summary" ? "summary" : "text"]: value },
            ...(label[4]
              ? { children: [] }
              : label[1] === "title"
                ? { children: [{ kind: "text", text: value }] }
                : {}),
          };
        } else if (inlineAtom) {
          node = {
            kind: "element",
            id: inlineAtom[2] ?? createUuidV7(),
            tag: inlineAtom[1],
            attrs: {
              [inlineAtom[1] === "var" ? "name" : "grade"]: inlineAtom[3],
            },
            ...(inlineAtom[4] ? { children: [] } : {}),
          };
        } else {
          const match =
            /^@([A-Za-z][A-Za-z0-9]*)(?:~([0-9a-f-]+))?(?: (\{.*\}))?(:?)$/.exec(
              line,
            );
          if (!match)
            throw new Error(`Line ${lineNumber}: invalid ritual command`);
          const attrs = match[3] ? parseJson(match[3], lineNumber) : {};
          if (
            attrs === null ||
            typeof attrs !== "object" ||
            Array.isArray(attrs)
          )
            throw new Error(`Line ${lineNumber}: attributes must be an object`);
          node = {
            kind: "element",
            id: match[2] ?? createUuidV7(),
            tag: match[1],
            attrs: attrs as Record<string, JsonValue>,
            ...(match[4] ? { children: [] } : {}),
          };
        }
      }
    } else throw new Error(`Line ${lineNumber}: unknown ritual line`);
    parent.push(node);
    parents.length = depth + 1;
    parents.push(node.kind === "element" ? (node.children ?? null) : null);
  }
  const document: RitualSemanticDocument = {
    format: "magickli-ritual",
    version: 1,
    nodes: root,
  };
  const errors = validateRitualSemantic(document);
  if (errors.length) throw new Error(errors[0]);
  return document;
}
