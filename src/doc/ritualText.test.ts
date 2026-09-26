import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prepare } from "./prepare";
import { parseRitualText, printRitualText } from "./ritualText";
import { semanticFromJrt } from "./semantic";

describe("ritual text projection", () => {
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
