import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

/** A local specifier's file: relative, `@/…` or `@magick-components/…`. */
function resolveLocal(from: string, name: string): string | null {
  const stem = name.startsWith(".")
    ? resolve(dirname(from), name)
    : name.startsWith("@/")
      ? resolve("src", name.slice(2))
      : name.startsWith("@magick-components/")
        ? resolve("src/components", name.slice("@magick-components/".length))
        : null;
  if (!stem) return null;
  const extensions = [".ts", ".tsx", ".js", ".jsx"];
  return (
    [
      stem,
      ...extensions.map((extension) => stem + extension),
      ...extensions.map((extension) => `${stem}/index${extension}`),
    ].find((path) => /\.[jt]sx?$/.test(path) && existsSync(path)) ?? null
  );
}

/**
 * The reader's import graph from `blocks.jsx`: what it loads up front
 * (`static`, type-only imports aside) and what only `import()` reaches
 * (`lazy`), with every specifier its files name.
 */
function readerGraph() {
  const graph = { static: new Set<string>(), lazy: new Set<string>() };
  const specifiers: { file: string; name: string }[] = [];
  const inspect = (file: string, lazy: boolean) => {
    if (graph.static.has(file) || (lazy && graph.lazy.has(file))) return;
    graph.lazy.delete(file);
    (lazy ? graph.lazy : graph.static).add(file);
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const follow = (name: string, viaImport: boolean) => {
      specifiers.push({ file, name });
      const next = resolveLocal(file, name);
      if (next) inspect(next, lazy || viaImport);
    };
    const visit = (node: ts.Node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const typeOnly = ts.isImportDeclaration(node)
          ? node.importClause?.isTypeOnly === true
          : node.isTypeOnly;
        if (!typeOnly) follow(node.moduleSpecifier.text, false);
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        const [argument] = node.arguments;
        expect(
          argument && ts.isStringLiteralLike(argument),
          `${file}: import() of a computed specifier`,
        ).toBe(true);
        follow((argument as ts.StringLiteralLike).text, true);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  };
  inspect(resolve("src/doc/blocks.jsx"), false);
  return { ...graph, specifiers };
}

const files = (set: Set<string>) =>
  [...set].map((file) => relative(process.cwd(), file)).sort();

it("keeps Tiptap, ProseMirror and editor code out of the reader import graph", () => {
  const graph = readerGraph();
  for (const { file, name } of graph.specifiers)
    expect(name, file).not.toMatch(/(?:@tiptap|prosemirror)/);
  const all = [...files(graph.static), ...files(graph.lazy)];
  expect(
    all.filter((file) =>
      /tiptap|ForEditing|export\/|gdHallEditor|GdHallAtomEditor|gdHallWarningCount/i.test(
        file,
      ),
    ),
  ).toEqual([]);
});

it("loads the hall renderer and its art only through import()", () => {
  // Plan 061, decision 1: a ritual without a hall does not carry them,
  // only the few kilobytes that size the placeholder while they load.
  const graph = readerGraph();
  const hall = /^src\/(?:components\/gd\/hall|app\/gd\/hall)\//;
  expect(files(graph.static).filter((file) => hall.test(file))).toEqual([
    "src/components/gd/hall/aspect.ts",
    "src/components/gd/hall/attributes.ts",
    "src/components/gd/hall/dimensions.ts",
  ]);
  const lazy = files(graph.lazy);
  expect(lazy).toContain("src/doc/ritualBlocks/GdHallDrawing.tsx");
  expect(lazy).toContain("src/components/gd/hall/GdHall.tsx");
  expect(lazy).toContain("src/app/gd/hall/art.ts");
  expect(lazy).toContain("src/app/gd/components/lamen.tsx");
});
