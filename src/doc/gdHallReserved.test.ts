import { readFileSync } from "node:fs";
import { validateHall } from "@magick-components/gd/hall";
import {
  RESERVED_ATTRIBUTES,
  RESERVED_TAGS,
} from "@magick-components/gd/hall/vocabulary";
import { describe, expect, it } from "vitest";
import { gdHallArt } from "@/app/gd/halls/art";
import { type JsonValue, validateRitualSemantic } from "./semantic";

/**
 * The compiler (`semantic.ts`) and the hall package each keep a list of
 * names a hall may not use, since the compiler may not import the package.
 * Every name either side reserves must be refused by both.
 */
const compilerSet = (name: string) => {
  const source = readFileSync("src/doc/semantic.ts", "utf8");
  const start = source.indexOf(`const ${name} = new Set([`);
  expect(start, name).toBeGreaterThan(-1);
  const body = source.slice(start, source.indexOf("]);", start));
  return [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
};
const prototypeNames = Object.getOwnPropertyNames(Object.prototype).filter(
  (name) => /^[A-Za-z][A-Za-z0-9]*$/.test(name),
);

const compilerRefuses = (tag: string, attrs: Record<string, JsonValue>) =>
  validateRitualSemantic({
    format: "magickli-ritual",
    version: 1,
    nodes: [
      {
        kind: "element",
        id: "Ab3k9Qp7Zx2Mn5R0",
        tag: "gdHall",
        attrs: {},
        children: [
          {
            kind: "element",
            id: "Ab3k9Qp7Zx2Mn5R1",
            tag: "floor",
            attrs: {},
            children: [{ kind: "element", id: "Ab3k9Qp7Zx2Mn5R2", tag, attrs }],
          },
        ],
      },
    ],
  });
const packageRefuses = (row: Record<string, JsonValue>) =>
  validateHall(
    { type: "gdHall", children: [{ type: "floor", children: [row] }] },
    { art: gdHallArt },
  ).filter((diagnostic) => diagnostic.severity === "error");

describe("names reserved in a hall", () => {
  const tags = [
    ...new Set([
      ...compilerSet("reservedHallTags"),
      ...compilerSet("objectPrototypeNames"),
      ...RESERVED_TAGS,
      ...prototypeNames,
      "ritualComment",
      "ritualText",
      "ritualLegacy",
      "ritualWidget",
      // Pug reads a line beginning with `doctype` as a doctype; the
      // compiler's lists hold only the bare keyword.
      "doctypeX",
      "doctypes",
      "doctypehtml",
    ]),
  ];
  const attributes = [
    ...new Set([
      ...compilerSet("reservedHallAttributes"),
      ...compilerSet("objectPrototypeNames"),
      ...RESERVED_ATTRIBUTES,
      ...prototypeNames,
    ]),
  ];

  it("reads the compiler's lists", () => {
    expect(tags).toContain("each");
    expect(tags).toContain("toString");
    expect(tags).toContain("doctypeX");
    expect(attributes).toContain("xlinkHref");
  });

  it.each(tags)("refuses the tag %s in both validators", (tag) => {
    expect(compilerRefuses(tag, {})).toEqual([
      "nodes[0].children[0].children[0]: reserved hall tag",
    ]);
    expect(packageRefuses({ type: tag })).not.toEqual([]);
  });

  it.each(attributes.filter((name) => name !== "type" && name !== "children"))(
    "refuses the attribute %s in both validators",
    (name) => {
      expect(compilerRefuses("altar", { [name]: "x" })).toEqual([
        "nodes[0].children[0].children[0]: reserved hall attribute",
      ]);
      expect(packageRefuses({ type: "altar", [name]: "x" })).toEqual([
        expect.objectContaining({
          attribute: name,
          message: `altar: the attribute ${name} is reserved`,
        }),
      ]);
    },
  );

  it("refuses type and children as attributes in the compiler", () => {
    for (const name of ["type", "children"])
      expect(compilerRefuses("altar", { [name]: "x" })).toEqual([
        "nodes[0].children[0].children[0]: reserved hall attribute",
      ]);
  });
});
