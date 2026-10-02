import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createUuidV7 } from "../lib/ids";
import { prepare } from "./prepare";
import { parseRitualText, printRitualText } from "./ritualText";
import { semanticFromJrt } from "./semantic";

describe("ritual text projection", () => {
  it("preserves UUIDs and mixed-case short IDs in every source command form", () => {
    const ids = [
      createUuidV7(),
      "Ab3k9Qp7Zx2Mn5Rs",
      "ab3k9qp7zx2mn5rs",
      "Title00000000001",
      "Summary000000001",
      "Variable00000001",
      "Grade00000000001",
      "Opaque0000000001",
    ];
    const document = semanticFromJrt(
      {
        children: [
          {
            type: "task",
            say: true,
            role: "hiero",
            children: [{ type: "text", value: "Hi" }],
          },
          {
            type: "task",
            do: true,
            role: "keryx",
            children: [{ type: "text", value: "Rise" }],
          },
          { type: "note", children: [] },
          {
            type: "title",
            text: "Opening",
            children: [{ type: "text", value: "Opening" }],
          },
          { type: "summary", summary: "Preparation", children: [] },
          { type: "var", name: "candidate" },
          { type: "grade", grade: "0=0" },
          { type: "unknown-widget", payload: "keep" },
        ],
      },
      () => ids.shift()!,
    );
    const source = printRitualText(document);
    expect(parseRitualText(source)).toEqual(document);
    expect(printRitualText(parseRitualText(source))).toBe(source);
    expect(() => parseRitualText("ritual 1\n@note~bad-id\n")).toThrow();
  });
  it("uses generic attributes for imported variable names outside shortcut syntax", () => {
    const original = semanticFromJrt({
      children: [{ type: "var", name: "my name" }],
    });
    expect(parseRitualText(printRitualText(original))).toEqual(original);
  });
  for (const name of ["0=0", "1=10", "2=9"]) {
    it(`round-trips the complete ${name} semantic tree`, () => {
      const source = readFileSync(
        new URL(`./${name}.jade`, import.meta.url),
        "utf8",
      );
      const original = semanticFromJrt(prepare(source));
      const text = printRitualText(original);
      expect(parseRitualText(text)).toEqual(original);
      expect(printRitualText(parseRitualText(text))).toBe(text);
    });
  }

  it("accepts simple speech and action shortcuts as ritual commands", () => {
    const document = parseRitualText(
      "ritual 1\nHiero: Ave, candidate.\n* All-officers Rise\n",
    );
    expect(document.nodes).toMatchObject([
      {
        kind: "element",
        tag: "task",
        attrs: { say: true, role: "hiero" },
        children: [{ text: "Ave, candidate." }],
      },
      {
        kind: "element",
        tag: "task",
        attrs: { do: true, role: "all-officers" },
        children: [{ text: "Rise" }],
      },
    ]);
  });

  it("rejects invalid indentation and malformed attributes", () => {
    expect(() => parseRitualText("ritual 1\n   @note:\n")).toThrow(
      "invalid indentation",
    );
    expect(() => parseRitualText("ritual 1\n@summary {oops}:\n")).toThrow(
      "invalid JSON value",
    );
  });
});
