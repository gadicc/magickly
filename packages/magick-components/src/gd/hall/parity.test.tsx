import { readFileSync } from "node:fs";
import { createElement, Fragment, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { GdHall } from "./GdHall.tsx";
import * as Entry from "./index.ts";
import { HALL_PRESETS } from "./presets/index.ts";
import { neophyte } from "./presets/neophyte.ts";
import * as Hall from "./tags.ts";
import type { HallNode } from "./types.ts";
import { hallFromTags } from "./walk.ts";

// Each preset printed as tags, as an author would write it, compiled and
// walked back: the walk must give the preset's data exactly, and GdHall
// the same SVG from the tags as from the data (plan 084, S5). The
// printer is the seed of a `hallToJsx`, which is not in scope.

/** A string the printer may write as a JSX attribute without escaping. */
const PLAIN = /^[^"&{}<>\\\n]*$/;

function attribute(value: unknown): string {
  if (typeof value === "string")
    return PLAIN.test(value)
      ? JSON.stringify(value)
      : `{${JSON.stringify(value)}}`;
  if (typeof value === "number" || typeof value === "boolean" || value === null)
    return `{${String(value)}}`;
  throw new Error(`the printer cannot write ${typeof value}`);
}

const tagName = (type: string) =>
  type === "gdHall"
    ? "GdHall"
    : `Hall.${type.charAt(0).toUpperCase()}${type.slice(1)}`;

/**
 * A hall node as TSX: the root as `<GdHall …>`, every other node as
 * `<Hall.Pascal …>`, and `children: []` as `{[]}`, so the walk gives it
 * back.
 */
function hallToTags(node: HallNode, indent = 0): string {
  const pad = "  ".repeat(indent);
  const name = tagName(node.type);
  const attributes = Object.entries(node)
    .filter(
      ([key, value]) =>
        key !== "type" && key !== "children" && value !== undefined,
    )
    .map(([key, value]) =>
      value === true ? key : `${key}=${attribute(value)}`,
    );
  const open = [name, ...attributes].join(" ");
  const { children } = node;
  if (children === undefined) return `${pad}<${open} />`;
  if (children.length === 0) return `${pad}<${open}>{[]}</${name}>`;
  return [
    `${pad}<${open}>`,
    ...children.map((child) => hallToTags(child, indent + 1)),
    `${pad}</${name}>`,
  ].join("\n");
}

/** The tags and the root an expression is compiled against. */
interface TagScope {
  GdHall: unknown;
  Hall: Record<string, unknown>;
}

/** Compiles TSX source to the element it makes, with `scope` in reach. */
function compile(source: string, scope: TagScope): ReactElement {
  const { outputText } = ts.transpileModule(`element = (${source});`, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  });
  return new Function(
    "React",
    "GdHall",
    "Hall",
    `let element;\n${outputText}\nreturn element;`,
  )({ createElement, Fragment }, scope.GdHall, scope.Hall) as ReactElement;
}

const scope: TagScope = { GdHall, Hall };

describe("each preset as tags", () => {
  it("prints as an author would write it", () => {
    const source = hallToTags({
      type: "gdHall",
      wall: "gradient",
      children: [
        {
          type: "floor",
          children: [
            { type: "pillar", kind: "black", x: 4, glow: true },
            { type: "label", text: 'A "B" {c}', children: [] },
          ],
        },
      ],
    });
    expect(source).toBe(
      [
        '<GdHall wall="gradient">',
        "  <Hall.Floor>",
        '    <Hall.Pillar kind="black" x={4} glow />',
        '    <Hall.Label text={"A \\"B\\" {c}"}>{[]}</Hall.Label>',
        "  </Hall.Floor>",
        "</GdHall>",
      ].join("\n"),
    );
  });

  it.each(HALL_PRESETS.map((preset) => [preset.id, preset] as const))(
    "%s walks back to its data",
    (_id, preset) => {
      const source = hallToTags(preset.hall);
      expect(source).toMatch(/^<GdHall/);
      const { hall, diagnostics } = hallFromTags(compile(source, scope));
      expect(diagnostics).toEqual([]);
      expect(hall).toStrictEqual(preset.hall);
      expect(JSON.stringify(hall)).toBe(JSON.stringify(preset.hall));
    },
  );

  it.each(HALL_PRESETS.map((preset) => [preset.id, preset] as const))(
    "%s draws as its data does",
    (_id, preset) => {
      const fromTags = renderToStaticMarkup(
        compile(hallToTags(preset.hall), scope),
      );
      expect(fromTags.length).toBeGreaterThan(5000);
      expect(fromTags).toBe(
        renderToStaticMarkup(<GdHall hall={preset.hall} />),
      );
    },
  );
});

describe("the README's hall written as tags", () => {
  const README = readFileSync(
    new URL("../../../README.md", import.meta.url),
    "utf8",
  );
  /** The README's TSX block that imports the tags and says `marker`. */
  const block = (marker: string) => {
    const found = [...README.matchAll(/^```tsx\n([^]*?)^```$/gm)]
      .map(([, code]) => code)
      .filter(
        (code) =>
          code.includes('from "magick-components/gd/hall/tags"') &&
          code.includes(marker),
      );
    expect(found, marker).toHaveLength(1);
    return found[0];
  };
  /** A README module's exports, its imports given the package's own. */
  const run = (source: string): Record<string, unknown> => {
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: false,
      },
    });
    const modules: Record<string, unknown> = {
      react: { createElement, Fragment },
      "magick-components/gd/hall": Entry,
      "magick-components/gd/hall/tags": Hall,
    };
    const exports: Record<string, unknown> = {};
    new Function("require", "exports", "React", outputText)(
      (name: string) => modules[name],
      exports,
      { createElement, Fragment },
    );
    return exports;
  };

  it("is the Neophyte preset", () => {
    const { Neophyte } = run(block("export const Neophyte")) as {
      Neophyte: () => ReactElement;
    };
    const { hall, diagnostics } = hallFromTags(Neophyte());
    expect(diagnostics).toEqual([]);
    expect(hall).toStrictEqual(neophyte.hall);
  });

  it("gives your own art's tags their nodes", () => {
    const { hall, diagnostics } = run(block("defineHallItem")) as {
      hall: HallNode;
      diagnostics: unknown[];
    };
    expect(diagnostics).toEqual([]);
    expect(hall.children?.[0].children).toStrictEqual([
      { type: "serpentTree", coils: 3, at: "center" },
      { type: "item", kind: "sistrum", metal: "gold", x: 4, y: 12 },
    ]);
  });
});
