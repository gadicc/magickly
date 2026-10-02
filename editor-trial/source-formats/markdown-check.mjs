import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Characterize the parser already installed in Magickli. A synthetic-only
// capture plugin inspects its tree; it neither executes HTML nor loads URLs.
function tree(source) {
  let parsed;
  renderToStaticMarkup(
    createElement(Markdown, {
      remarkPlugins: [
        remarkGfm,
        () => (root) => {
          parsed = root;
        },
      ],
      children: source,
    }),
  );
  assert.ok(parsed);
  return parsed;
}

test("Markdown parses speech as an ordinary paragraph, with no role/task semantics", () => {
  const node = tree("Hiero: Welcome.").children[0];
  assert.equal(node.type, "paragraph");
  assert.equal(node.children[0].value, "Hiero: Welcome.");
});
test("Markdown parses the IRC action shortcut as a bullet list", () => {
  const node = tree("* Keryx opens the door.").children[0];
  assert.equal(node.type, "list");
  assert.equal(node.ordered, false);
  assert.equal(node.children[0].type, "listItem");
});
test("Markdown leaves directive delimiters as paragraph text without an extension", () => {
  const node = tree(":::summary Preparation\nPrepare the space.\n:::")
    .children[0];
  assert.equal(node.type, "paragraph");
  assert.ok(node.children[0].value.includes(":::"));
});
test("HTML-like summary blocks are raw HTML nodes, not typed ritual trees", () => {
  const nodes = tree(
    '<summary title="Preparation">\nPrepare the space.\n</summary>',
  ).children;
  assert.equal(nodes[0].type, "html");
});
test("Markdown identity suffixes and variable syntax need an explicit extension", () => {
  const heading = tree("# Opening {#01995000-0000-7000-8000-000000000001}")
    .children[0];
  assert.equal(heading.type, "heading");
  assert.ok(heading.children[0].value.includes("{#"));
  assert.equal(heading.id, undefined);
  const variable = tree("Welcome, {{candidate}}.").children[0].children[0];
  assert.equal(variable.type, "text");
  assert.ok(variable.value.includes("{{candidate}}"));
});
test("ordinary rich text has useful native nodes but no stable semantic identities", () => {
  const nodes = tree(
    "**bold** and *italic*\n\n![diagram](/synthetic.png)",
  ).children;
  assert.equal(nodes[0].children[0].type, "strong");
  assert.equal(nodes[0].children[2].type, "emphasis");
  assert.equal(nodes[1].children[0].type, "image");
  assert.equal(nodes[0].children[0].id, undefined);
});
