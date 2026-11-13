import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPONENT_EXAMPLES,
  componentSlug,
  EXPLORER_COMPONENTS,
  explorerComponent,
  importLine,
} from "./components";
import { PROPS } from "./props";

describe("the explorer's components", () => {
  it("are the example modules', in their order", () => {
    expect(EXPLORER_COMPONENTS.map(({ name }) => name)).toEqual(
      Object.keys(COMPONENT_EXAMPLES),
    );
    expect(Object.keys(PROPS)).toEqual(Object.keys(COMPONENT_EXAMPLES));
  });

  it("each have a page at a slug of their name", () => {
    expect(componentSlug("TreeOfLife")).toBe("tree-of-life");
    expect(componentSlug("GdHall")).toBe("gd-hall");
    expect(componentSlug("SevenBranchedCandleStick")).toBe(
      "seven-branched-candlestick",
    );
    expect(explorerComponent("gd-hall")?.name).toBe("GdHall");
    expect(explorerComponent("constructor")).toBeUndefined();
    expect(new Set(EXPLORER_COMPONENTS.map(({ slug }) => slug)).size).toBe(
      EXPLORER_COMPONENTS.length,
    );
  });

  it("name files that exist", () => {
    for (const component of EXPLORER_COMPONENTS) {
      expect(existsSync(path.resolve(component.sourceFile))).toBe(true);
      expect(existsSync(path.resolve(component.examplesFile))).toBe(true);
    }
  });

  it("import as the package will export them", () => {
    expect(importLine(explorerComponent("tree-of-life")!)).toBe(
      'import TreeOfLife from "magick-components/kabbalah/TreeOfLife";',
    );
    expect(importLine(explorerComponent("gd-hall")!)).toBe(
      'import { GdHall } from "magick-components/gd/hall/GdHall";',
    );
  });

  it("are each loaded live from the entry and export their examples name", () => {
    // live.tsx is a client module of next/dynamic thunks; read its source.
    // A default export is the module itself; a named one is picked by
    // `.then((module) => module.<name>)`.
    const source = readFileSync(path.resolve("src/explorer/live.tsx"), "utf8");
    const loaded = Object.fromEntries(
      [
        ...source.matchAll(
          /^ {2}(\w+): dynamic\(\s*\(\) =>\s*import\("([^"]+)"\)(?:\.then\(\s*\((\w+)\) => \3\.(\w+),?\s*\))?,?\s*\)/gm,
        ),
      ].map(([, name, specifier, , exported]) => [
        name,
        { specifier, exportName: exported ?? "default" },
      ]),
    );
    expect(loaded).toEqual(
      Object.fromEntries(
        EXPLORER_COMPONENTS.map((component) => [
          component.name,
          {
            specifier: component.specifier,
            exportName: component.exportName,
          },
        ]),
      ),
    );
  });
});
