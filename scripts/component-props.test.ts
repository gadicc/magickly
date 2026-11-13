import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COMPONENT_EXAMPLES } from "../packages/magick-components/examples/index.ts";
import {
  componentProps,
  controlOf,
  defaultSource,
  PROPS_MANIFEST,
} from "./component-props.ts";

const committed = JSON.parse(
  readFileSync(path.resolve(PROPS_MANIFEST), "utf8"),
) as ReturnType<typeof componentProps>;

describe("the component props manifest (plan 080, decision 6)", () => {
  it("is what the script writes today; run pnpm components:props", () => {
    // docgen reads the whole package; a second or so here, more on CI.
    expect(componentProps()).toStrictEqual(committed);
  }, 30_000);

  it("describes every component with examples, and each of its props", () => {
    const manifest = committed;
    expect(Object.keys(manifest)).toEqual(Object.keys(COMPONENT_EXAMPLES));
    const missing = Object.entries(manifest).flatMap(([name, component]) => [
      ...(component.description ? [] : [name]),
      ...component.props
        .filter((prop) => !prop.description)
        .map((prop) => `${name}.${prop.name}`),
    ]);
    expect(missing).toEqual([]);
  });
});

describe("controlOf", () => {
  it("makes a choice of string literals and a switch of a boolean", () => {
    expect(
      controlOf({
        name: "enum",
        value: [{ value: '"king"' }, { value: '"queen"' }],
      }),
    ).toEqual({ kind: "choice", options: ["king", "queen"] });
    expect(
      controlOf({
        name: "enum",
        value: [{ value: "false" }, { value: "true" }],
      }),
    ).toEqual({ kind: "switch" });
    expect(controlOf({ name: "boolean" })).toEqual({ kind: "switch" });
  });

  it("gives fields to numbers and strings, parsed for their unions", () => {
    expect(controlOf({ name: "number" })).toEqual({ kind: "number" });
    expect(controlOf({ name: "string" })).toEqual({ kind: "text" });
    expect(controlOf({ name: "string | number" })).toEqual({ kind: "parsed" });
    expect(controlOf({ name: "string | boolean" })).toEqual({ kind: "parsed" });
  });

  it("gives none to callbacks, objects, nodes and mixed unions", () => {
    for (const name of [
      "CSSProperties",
      "ReactNode",
      "HallNode",
      "((path: TreeOfLifePathRow) => string | null)",
      "readonly string[]",
      "number | boolean",
    ])
      expect(controlOf({ name }), name).toBeUndefined();
    expect(
      controlOf({
        name: "enum",
        value: [{ value: '"a"' }, { value: "number" }],
      }),
    ).toBeUndefined();
  });
});

describe("defaultSource", () => {
  it("quotes strings docgen gives bare, and leaves other literals", () => {
    expect(defaultSource("index", { name: "string" })).toBe('"index"');
    expect(defaultSource("", { name: "string" })).toBe('""');
    expect(defaultSource("240", { name: "string" })).toBe('"240"');
    expect(defaultSource("240", { name: "string | number" })).toBe("240");
    expect(defaultSource("true", { name: "boolean" })).toBe("true");
    expect(
      defaultSource("hermetic", {
        name: "enum",
        value: [{ value: '"hebrew"' }, { value: '"hermetic"' }],
      }),
    ).toBe('"hermetic"');
    expect(defaultSource("[1, 2]", { name: "number[]" })).toBe("[1, 2]");
  });

  it("drops a default too long to be a value", () => {
    expect(defaultSource("x".repeat(81), { name: "string" })).toBeUndefined();
  });
});
