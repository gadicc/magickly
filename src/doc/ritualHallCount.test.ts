import { readFileSync } from "node:fs";
import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import { describe, expect, it } from "vitest";
import { prepare } from "./prepare";
import {
  countHallMarkers,
  countHallRows,
  countHallRowsInJson,
  HALL_MARKER,
} from "./ritualHallCount";
import { type JsonValue, semanticFromJrt } from "./semantic";
import { compileSemanticSource } from "./semanticCompile";

/**
 * The stored `content_json`, exactly as a save writes it (sqlWrites.ts):
 * `compileSemanticSource` is `JSON.stringify(semanticToJrt(…))`.
 */
function stored(jrt: JsonValue): string {
  const compiled = compileSemanticSource(JSON.stringify(semanticFromJrt(jrt)));
  if (!compiled) throw new Error("The ritual did not compile");
  return compiled.contentJson;
}

const TRAP = `A "type":"gdHall" row, and {"type":"gdHall"}`;
const hall = (index: number, caption: string): JsonValue => {
  const row = structuredClone(HALL_PRESETS[index].hall) as unknown as {
    children: { type: string; text?: string }[];
  };
  for (const child of row.children)
    if (child.type === "caption") child.text = caption;
  return row as unknown as JsonValue;
};

describe("the catalog's hall marker", () => {
  it("is the compiler's compact form of a hall row", () => {
    const json = stored({ children: [hall(0, "Neophyte")] });
    expect(json.startsWith(`{"children":[{${HALL_MARKER},`)).toBe(true);
  });

  it("counts the built-in rituals' halls as a parse does", () => {
    const counts = ["0=0", "1=10", "2=9"].map((name) => {
      const pug = readFileSync(new URL(`./${name}.pug`, import.meta.url), {
        encoding: "utf8",
      });
      const json = stored(prepare(pug) as unknown as JsonValue);
      expect(countHallMarkers(json)).toBe(countHallRows(JSON.parse(json)));
      return countHallMarkers(json);
    });
    // The five built-in halls (plan 061): one, two and two.
    expect(counts).toEqual([1, 2, 2]);
  });

  it("does not match the marker in a caption, an attribute or text", () => {
    const json = stored({
      children: [
        { type: "title", text: TRAP },
        {
          type: "note",
          children: [
            hall(0, TRAP),
            { type: "text", value: TRAP },
            { type: "b", children: [{ type: "text", value: HALL_MARKER }] },
          ],
        },
        { type: "note", children: [hall(1, HALL_MARKER)] },
        { type: "img", src: "/x.png", alt: HALL_MARKER },
      ],
    });
    expect(json).toContain(String.raw`\"type\":\"gdHall\"`);
    expect(countHallRows(JSON.parse(json))).toBe(2);
    expect(countHallMarkers(json)).toBe(2);
  });

  it("parses a legacy archive, whose spacing is unknown", () => {
    const legacy = JSON.stringify(
      { children: [{ type: "note", children: [{ type: "gdHall" }] }] },
      null,
      2,
    );
    expect(countHallMarkers(legacy)).toBe(0);
    expect(countHallRowsInJson(`﻿${legacy}`)).toBe(1);
    expect(countHallRowsInJson("not json")).toBe(0);
  });
});
