import { describe, expect, it } from "vitest";
import {
  defaultText,
  jsxFor,
  parseValue,
  placeholders,
  sameProps,
  switchValue,
  withProp,
} from "./controls";
import type { PropDoc } from "./props";

const prop = (fields: Partial<PropDoc>): PropDoc => ({
  name: "x",
  type: "boolean",
  required: false,
  description: "X.",
  ...fields,
});

describe("parseValue", () => {
  it("reads numbers and booleans where the type takes them", () => {
    expect(parseValue("240", "string | number")).toBe(240);
    expect(parseValue("-1.5", "string | number")).toBe(-1.5);
    expect(parseValue("100%", "string | number")).toBe("100%");
    expect(parseValue("false", "string | boolean")).toBe(false);
    expect(parseValue("false", "string | number")).toBe("false");
    expect(parseValue("240", "string | boolean")).toBe("240");
  });
});

describe("switchValue", () => {
  it("shows the prop's value, else its default, else off", () => {
    expect(switchValue(prop({}), true)).toBe(true);
    expect(switchValue(prop({ default: "true" }), undefined)).toBe(true);
    expect(switchValue(prop({ default: "true" }), false)).toBe(false);
    expect(switchValue(prop({}), undefined)).toBe(false);
  });
});

describe("withProp", () => {
  it("sets a prop, and removes it when unset", () => {
    expect(withProp({ a: 1 }, "b", "x")).toEqual({ a: 1, b: "x" });
    expect(withProp({ a: 1, b: "x" }, "b", undefined)).toEqual({ a: 1 });
    expect(withProp({ a: 1 }, "a", "")).toEqual({ a: "" });
  });
});

describe("jsxFor", () => {
  it("writes props as JSX does, on one line when it fits", () => {
    expect(jsxFor("TreeOfLife", {})).toBe("<TreeOfLife />");
    expect(
      jsxFor("TreeOfLife", {
        colorScale: "king",
        showDaat: true,
        flip: false,
        fontSize: 12,
      }),
    ).toBe(
      '<TreeOfLife colorScale="king" showDaat flip={false} fontSize={12} />',
    );
    expect(jsxFor("X", { text: 'say "hi"' })).toBe(
      '<X text={"say \\"hi\\""} />',
    );
  });

  it("breaks long JSX a prop to a line", () => {
    expect(
      jsxFor("Tablet", {
        id: "earth",
        highlights: { squares: [{ row: 0, column: 0 }] },
        version: "raphael",
      }),
    ).toBe(
      [
        "<Tablet",
        '  id="earth"',
        '  highlights={{"squares":[{"row":0,"column":0}]}}',
        '  version="raphael"',
        "/>",
      ].join("\n"),
    );
  });

  it("names data too long to show, and says which", () => {
    const hall = { type: "gdHall", children: Array(20).fill({ type: "x" }) };
    expect(jsxFor("GdHall", { hall })).toBe("<GdHall hall={hall} />");
    expect(placeholders({ hall, width: 300 })).toEqual(["hall"]);
  });
});

describe("defaultText", () => {
  it("shows a string default without its quotes, and no empty one", () => {
    expect(defaultText('"index"')).toBe("index");
    expect(defaultText('""')).toBeUndefined();
    expect(defaultText("240")).toBe("240");
    expect(defaultText(undefined)).toBeUndefined();
  });
});

describe("sameProps", () => {
  it("compares values, not the keys' order", () => {
    expect(sameProps({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true);
    expect(sameProps({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(sameProps({ a: 1 }, { a: 2 })).toBe(false);
  });
});
