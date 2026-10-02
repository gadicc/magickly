import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

it("keeps Tiptap and ProseMirror outside the reader presentation import graph", () => {
  const seen = new Set<string>();
  const inspect = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) &&
        !ts.isExportDeclaration(statement)
      )
        continue;
      const specifier = statement.moduleSpecifier;
      if (!specifier || !ts.isStringLiteral(specifier)) continue;
      const name = specifier.text;
      expect(name, file).not.toMatch(/(?:@tiptap|prosemirror)/);
      const stem = name.startsWith(".")
        ? resolve(dirname(file), name)
        : name.startsWith("@/")
          ? resolve("src", name.slice(2))
          : null;
      if (!stem) continue;
      const next = [
        stem,
        ...[".ts", ".tsx", ".js", ".jsx"].map((extension) => stem + extension),
      ].find((path) => existsSync(path) && /\.[jt]sx?$/.test(path));
      if (next) inspect(next);
    }
  };
  inspect(resolve("src/doc/blocks.jsx"));
});
