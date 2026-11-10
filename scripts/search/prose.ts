import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";

/** The named references the app's JSX uses, as the browser shows them. */
const NAMED_REFERENCES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  mdash: "\u2014",
  nbsp: " ",
  ndash: "\u2013",
  quot: '"',
};

/**
 * JSX text keeps its character references (`Dee&apos;s`); the page shows
 * the characters, so the index reads those. An unknown name is kept as is.
 */
export function decodeReferences(text: string): string {
  return text.replace(
    /&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g,
    (match, reference: string) => {
      if (!reference.startsWith("#"))
        return NAMED_REFERENCES[reference] ?? match;
      const hex = reference[1] === "x" || reference[1] === "X";
      const code = Number.parseInt(reference.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : match;
    },
  );
}

/**
 * Literal, visible JSX prose only. Never evaluates a module, reads arbitrary
 * string constants, or copies source/props/code into the public search index.
 * Data-driven content is handled by explicit catalogue adapters instead.
 */
export function jsxProse(source: string): {
  text: string;
  components: Set<string>;
} {
  const file = ts.createSourceFile(
    "page.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const texts: string[] = [];
  const components = new Set<string>();
  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node)) return;
    if (
      ts.isJsxElement(node) &&
      /^(?:script|style|code|pre|JsonLd)$/i.test(
        node.openingElement.tagName.getText(file),
      )
    )
      return;
    if (ts.isJsxText(node)) texts.push(decodeReferences(node.text));
    if (
      ts.isJsxExpression(node) &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      node.expression &&
      ts.isStringLiteral(node.expression)
    )
      texts.push(node.expression.text);
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      components.add(node.tagName.getText(file));
    ts.forEachChild(node, visit);
  }
  visit(file);
  return { text: texts.join(" ").replace(/\s+/g, " ").trim(), components };
}

/** Follows only relative React components actually used by a public page. */
export function pageProse(root: string, path: string): string {
  const visited = new Set<string>();
  const texts: string[] = [];
  function read(file: string) {
    if (visited.has(file) || !existsSync(file)) return;
    visited.add(file);
    const source = readFileSync(file, "utf8");
    const prose = jsxProse(source);
    if (prose.text) texts.push(prose.text);
    const ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    for (const statement of ast.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        continue;
      const specifier = statement.moduleSpecifier.text;
      const binding = statement.importClause;
      if (!specifier.startsWith(".") || !binding || binding.isTypeOnly)
        continue;
      const names = [binding.name?.text];
      if (binding.namedBindings && ts.isNamedImports(binding.namedBindings))
        names.push(
          ...binding.namedBindings.elements.map((entry) => entry.name.text),
        );
      if (!names.some((name) => name && prose.components.has(name))) continue;
      const base = resolve(dirname(file), specifier);
      const child = [
        base + ".tsx",
        base + ".jsx",
        resolve(base, "index.tsx"),
      ].find(existsSync);
      if (child && child.startsWith(resolve(root, "src") + "/")) read(child);
    }
  }
  read(resolve(root, "src/app", path.slice(1), "page.tsx"));
  return [...new Set(texts)].join("\n\n");
}
