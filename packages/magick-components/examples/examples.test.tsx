import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { type ComponentType, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import manifest from "../package.json" with { type: "json" };
import { COMPONENT_EXAMPLES } from "./index.ts";

const directory = path.resolve("packages/magick-components/examples");

/** Every module a file imports. */
const imports = (name: string) =>
  ts
    .preProcessFile(readFileSync(path.join(directory, name), "utf8"))
    .importedFiles.map((file) => file.fileName);
const modules = readdirSync(directory).filter((name) =>
  name.endsWith(".examples.tsx"),
);

/** The component an entry exports, loaded from the source `exports` names. */
async function component(entry: string, exportName: string) {
  const target = (manifest.exports as Record<string, string>)[`./${entry}`];
  expect(target, entry).toBeDefined();
  const module = await import(
    path.resolve("packages/magick-components", target)
  );
  return module[exportName] as ComponentType<object>;
}

describe("the component examples (plan 080, decision 5)", () => {
  it("list every example module, by the name its file gives it", () => {
    expect(Object.keys(COMPONENT_EXAMPLES).sort()).toEqual(
      modules.map((name) => name.replace(/\.examples\.tsx$/, "")).sort(),
    );
  });

  it("import nothing but their component's types and the package's data", () => {
    // React's types, the examples' own modules, and files under ../src/
    // with no `..` past it.
    const allowed =
      /^(?:react|\.\/[\w.]+\.tsx?|\.\.\/src\/(?!.*\.\.)[\w./-]+\.tsx?)$/;
    for (const name of [...modules, "index.ts", "types.ts"])
      for (const specifier of imports(name))
        expect(specifier, name).toMatch(allowed);
    expect("react-dom").not.toMatch(allowed);
    expect("../src/../../app/x.ts").not.toMatch(allowed);
  });

  it("type each example by the component its entry names", () => {
    for (const [name, { entry, exportName }] of Object.entries(
      COMPONENT_EXAMPLES,
    )) {
      const source = readFileSync(
        path.join(directory, `${name}.examples.tsx`),
        "utf8",
      );
      const target = `..${(manifest.exports as Record<string, string>)[`./${entry}`].slice(1)}`;
      const binding = `${name}Component`;
      const imported =
        exportName === "default"
          ? `import type ${binding} from "${target}";`
          : `import type { ${exportName} as ${binding} } from "${target}";`;
      expect(source, name).toContain(imported);
      expect(source.replace(/\s+/g, ""), name).toContain(
        `ComponentExamples<ComponentProps<typeof${binding}>>`,
      );
    }
  });

  describe.each(Object.entries(COMPONENT_EXAMPLES))("%s", (name, entry) => {
    it("names an entry of the package and a component it exports", async () => {
      expect(typeof (await component(entry.entry, entry.exportName))).toBe(
        "function",
      );
    });

    it("has examples with distinct titles", () => {
      const titles = entry.examples.map((example) => example.title);
      expect(titles.length).toBeGreaterThan(0);
      expect(new Set(titles).size, name).toBe(titles.length);
    });

    it("renders every example", async () => {
      const Component = await component(entry.entry, entry.exportName);
      for (const example of entry.examples) {
        const html = renderToStaticMarkup(
          createElement(Component, example.props),
        );
        // Something drawn: an SVG, the fylfot's table or Mercury's picture.
        expect(html, example.title).toMatch(/<(?:svg|table|img)\b/);
      }
    });
  });
});
