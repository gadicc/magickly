import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

/** A local specifier's file: relative, `@/…` or `magick-components/…`. */
function resolveLocal(from: string, name: string): string | null {
  const stem = name.startsWith(".")
    ? resolve(dirname(from), name)
    : name.startsWith("@/")
      ? resolve("src", name.slice(2))
      : name.startsWith("magick-components/")
        ? resolve(
            "packages/magick-components/src",
            name.slice("magick-components/".length),
          )
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

const parse = (file: string) =>
  ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );

/**
 * Whether a file of magick-components does nothing but re-export, as
 * `gd/hall`'s entry does. The package declares no side effects but its
 * CSS, so a bundler takes from such a barrel only the modules whose
 * exports are imported (webpack's `sideEffects`, Turbopack's tree
 * shaking), and so does the graph below.
 */
function isBarrel(file: string, source: ts.SourceFile): boolean {
  return (
    relative(process.cwd(), file).startsWith("packages/magick-components/") &&
    source.statements.every(
      (statement) =>
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier !== undefined &&
        (statement.isTypeOnly ||
          (statement.exportClause !== undefined &&
            ts.isNamedExports(statement.exportClause))),
    )
  );
}

/**
 * The names an import takes by value, or `undefined` when it takes the
 * module whole (a default, a namespace or a bare import).
 */
function importedNames(node: ts.ImportDeclaration): string[] | undefined {
  const clause = node.importClause;
  if (!clause || clause.name) return undefined;
  const bindings = clause.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return undefined;
  return bindings.elements
    .filter((element) => !element.isTypeOnly)
    .map((element) => (element.propertyName ?? element.name).text);
}

/**
 * The reader's import graph from `blocks.jsx`: what it loads up front
 * (`static`, type-only imports aside) and what only `import()` reaches
 * (`lazy`), with every specifier its files name. Named imports from a
 * barrel of the package follow only the modules that export those names.
 */
function readerGraph() {
  const graph = { static: new Set<string>(), lazy: new Set<string>() };
  const specifiers: { file: string; name: string }[] = [];
  const inspect = (
    file: string,
    lazy: boolean,
    names: readonly string[] | undefined,
  ) => {
    const source = parse(file);
    if (names !== undefined && isBarrel(file, source)) {
      for (const statement of source.statements) {
        if (
          !ts.isExportDeclaration(statement) ||
          statement.isTypeOnly ||
          !statement.exportClause ||
          !ts.isNamedExports(statement.exportClause)
        )
          continue;
        const taken = statement.exportClause.elements
          .filter(
            (element) =>
              !element.isTypeOnly && names.includes(element.name.text),
          )
          .map((element) => (element.propertyName ?? element.name).text);
        if (taken.length === 0) continue;
        const name = (statement.moduleSpecifier as ts.StringLiteral).text;
        specifiers.push({ file, name });
        const next = resolveLocal(file, name);
        if (next) inspect(next, lazy, taken);
      }
      return;
    }
    if (graph.static.has(file) || (lazy && graph.lazy.has(file))) return;
    graph.lazy.delete(file);
    (lazy ? graph.lazy : graph.static).add(file);
    const follow = (
      name: string,
      viaImport: boolean,
      imported?: readonly string[],
    ) => {
      specifiers.push({ file, name });
      const next = resolveLocal(file, name);
      if (next) inspect(next, lazy || viaImport, imported);
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
        if (!typeOnly)
          follow(
            node.moduleSpecifier.text,
            false,
            ts.isImportDeclaration(node) ? importedNames(node) : undefined,
          );
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
  inspect(resolve("src/doc/blocks.jsx"), false, undefined);
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
  const hall =
    /^(?:packages\/magick-components\/src\/gd\/hall|src\/app\/gd\/hall)\//;
  expect(files(graph.static).filter((file) => hall.test(file))).toEqual([
    "packages/magick-components/src/gd/hall/aspect.ts",
    "packages/magick-components/src/gd/hall/attributes.ts",
    "packages/magick-components/src/gd/hall/dimensions.ts",
  ]);
  const lazy = files(graph.lazy);
  expect(lazy).toContain("src/doc/ritualBlocks/GdHallDrawing.tsx");
  expect(lazy).toContain("packages/magick-components/src/gd/hall/GdHall.tsx");
  // GdHall's walk comes with it, and the tags not at all (plan 084).
  expect(lazy).toContain("packages/magick-components/src/gd/hall/walk.ts");
  expect([...files(graph.static), ...lazy]).not.toContain(
    "packages/magick-components/src/gd/hall/tags.ts",
  );
  expect(lazy).toContain("src/app/gd/halls/art.ts");
  expect(lazy).toContain("packages/magick-components/src/gd/Lamen.tsx");
});
