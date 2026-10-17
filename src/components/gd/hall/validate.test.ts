import { describe, expect, it } from "vitest";
import {
  booleanAttr,
  clamp,
  enumAttr,
  numberAttr,
  readAttr,
  readBoolean,
  readEnum,
  readNumber,
  readString,
  stringAttr,
} from "./attributes";
import { HEBREW_LETTER_SPELLINGS, hebrewLetter } from "./hebrewLetters";
import type { HallArt, HallNode } from "./types";
import { hallTagSpec, itemKindKnown, validateHall } from "./validate";
import {
  hallPoint,
  MAX_HALL_DEPTH,
  MAX_HALL_NODES,
  RESERVED_ATTRIBUTES,
  RESERVED_TAGS,
  roleName,
} from "./vocabulary";

const hall = (...children: unknown[]): HallNode =>
  ({ type: "gdHall", children }) as HallNode;
const floor = (...children: unknown[]) => ({ type: "floor", children });

describe("attribute readers", () => {
  it("reads numbers and numeric strings, and rejects the rest", () => {
    expect(readNumber(9.4)).toEqual({ status: "ok", value: 9.4 });
    expect(readNumber("9.4")).toEqual({ status: "ok", value: 9.4 });
    expect(readNumber("-0.5e1")).toEqual({ status: "ok", value: -5 });
    for (const absent of [undefined, null, "null"])
      expect(readNumber(absent)).toEqual({ status: "absent" });
    for (const bad of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "abc",
      "1e999",
      "",
      " 9",
      ".5",
      "0x10",
      true,
      {},
    ])
      expect(readNumber(bad), String(bad)).toEqual({ status: "invalid" });
  });

  it("reads booleans, strings and enums", () => {
    expect(readBoolean("true")).toEqual({ status: "ok", value: true });
    expect(readBoolean(false)).toEqual({ status: "ok", value: false });
    expect(readBoolean("false")).toEqual({ status: "ok", value: false });
    expect(readBoolean("null")).toEqual({ status: "absent" });
    expect(readBoolean("yes")).toEqual({ status: "invalid" });
    expect(readString(5)).toEqual({ status: "ok", value: "5" });
    expect(readString(null)).toEqual({ status: "absent" });
    expect(readString(true)).toEqual({ status: "invalid" });
    expect(readString("x".repeat(6), 5)).toEqual({ status: "invalid" });
    expect(readEnum("up", ["up", "down"])).toEqual({
      status: "ok",
      value: "up",
    });
    expect(readEnum("sideways", ["up"])).toEqual({ status: "invalid" });
    expect(readEnum(null, ["up"])).toEqual({ status: "absent" });
    expect(readAttr("true", { kind: "boolean" })).toEqual({
      status: "ok",
      value: true,
    });
  });

  it("reads only own attributes of a node", () => {
    const node = { type: "x", n: "2", s: "a", b: "true", e: "up" } as HallNode;
    expect(numberAttr(node, "n")).toBe(2);
    expect(numberAttr(node, "s")).toBeUndefined();
    expect(stringAttr(node, "s")).toBe("a");
    expect(stringAttr(node, "b", 1)).toBeUndefined();
    expect(booleanAttr(node, "b")).toBe(true);
    expect(booleanAttr(node, "s")).toBeUndefined();
    expect(enumAttr(node, "e", ["up"])).toBe("up");
    expect(enumAttr(node, "s", ["up"])).toBeUndefined();
    expect(stringAttr(node, "constructor")).toBeUndefined();
    expect(numberAttr(node, "toString")).toBeUndefined();
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

describe("vocabulary helpers", () => {
  it("names roles and normalises points", () => {
    expect(roleName("pastHierophant")).toBe("Past Hierophant");
    expect(roleName("candidateOfTheNight")).toBe("Candidate Of The Night");
    expect(roleName("constructor")).toBe("Constructor");
    expect(hallPoint("center")).toBe("centre");
    expect(hallPoint("north")).toBe("north");
    expect(hallPoint(undefined)).toBeUndefined();
  });

  it("finds Hebrew letters by name, spelling or character", () => {
    expect(hebrewLetter("shin")).toBe("ש");
    expect(hebrewLetter("Resh")).toBe("ר");
    expect(hebrewLetter("tzaddi")).toBe("צ");
    expect(hebrewLetter("tsadi")).toBe("צ");
    expect(hebrewLetter("qoph")).toBe("ק");
    expect(hebrewLetter("tau")).toBe("ת");
    expect(hebrewLetter("kaf-sofit")).toBe("ך");
    expect(hebrewLetter("א")).toBe("א");
    expect(hebrewLetter("constructor")).toBeUndefined();
    expect(hebrewLetter("x")).toBeUndefined();
    for (const spelling of HEBREW_LETTER_SPELLINGS)
      expect(hebrewLetter(spelling), spelling).toMatch(/^[\u05D0-\u05EA]$/);
  });
});

describe("validateHall", () => {
  it("accepts the plan's Neophyte hall, numbers as strings or numbers", () => {
    const neophyte = hall(
      {
        type: "dais",
        children: ["imperator", "cancellarius", "hierophant"].map((role) => ({
          type: "officer",
          role,
        })),
      },
      floor(
        { type: "banner", kind: "east", x: 9.4, y: 0 },
        { type: "pillar", kind: "black", x: "4", y: "3", glow: "true" },
        {
          type: "altar",
          at: "centre",
          children: [
            { type: "item", kind: "cross", y: -0.4 },
            { type: "item", kind: "triangle", y: "0.3" },
          ],
        },
        {
          type: "platform",
          x: 8,
          y: 14.5,
          w: 4,
          h: 3,
          children: [{ type: "officer", role: "hiereus", labelPos: "top" }],
        },
        { type: "door", x: 14, width: 2 },
        {},
      ),
      {
        type: "banners",
        side: "east",
        children: [
          { type: "hebrewLetter", letter: "shin" },
          { type: "hebrewLetter", letter: "ת" },
        ],
      },
      { type: "caption", text: "Neophyte Temple", children: [] },
    );
    expect(validateHall({ ...neophyte, dais: 4, wall: "gradient" })).toEqual(
      [],
    );
  });

  it("rejects anything that is not a hall", () => {
    for (const input of [null, "gdHall", [], { type: "floor" }])
      expect(validateHall(input)).toEqual([
        {
          path: [],
          severity: "error",
          message: "a hall must start with gdHall",
        },
      ]);
  });

  it("reports every reserved tag and attribute", () => {
    const tags = [...RESERVED_TAGS].map((type) => ({ type }));
    const diagnostics = validateHall(hall(floor(...tags)));
    expect(diagnostics.map((d) => [d.path, d.severity])).toEqual(
      tags.map((_, index) => [[0, index], "error"]),
    );
    for (const name of RESERVED_ATTRIBUTES) {
      if (name === "type" || name === "children") continue;
      const result = validateHall(hall(floor({ type: "altar", [name]: "x" })));
      expect(result, name).toEqual([
        {
          path: [0, 0],
          attribute: name,
          severity: "error",
          message: `altar: the attribute ${name} is reserved`,
        },
      ]);
    }
    expect(
      validateHall(hall(floor({ type: "altar", children: "x" }))),
    ).toMatchObject([{ attribute: "children", severity: "error" }]);
  });

  it("reports malformed numbers as errors and clamps out-of-range ones", () => {
    const result = validateHall(
      hall(
        floor(
          { type: "pillar", kind: "black", x: "abc" },
          { type: "pillar", kind: "black", x: "1e999" },
          { type: "pillar", kind: "black", x: Number.NaN },
          { type: "pillar", kind: "black", x: Number.POSITIVE_INFINITY },
          { type: "pillar", kind: "black", scale: 500 },
        ),
      ),
    );
    expect(result.map((d) => [d.path[1], d.severity, d.message])).toEqual([
      [0, "error", 'pillar: x="abc" is not a number'],
      [1, "error", 'pillar: x="1e999" is not a number'],
      [2, "error", "pillar: x=NaN is not a number"],
      [3, "error", "pillar: x=Infinity is not a number"],
      [4, "warning", "pillar: scale=500 is outside 0.05–10 and is clamped"],
    ]);
  });

  it("reports unknown tags, attributes, at values and enum values", () => {
    const result = validateHall(
      hall(
        floor(
          { type: "unicorn", horn: 1 },
          { type: "altar", at: "middle", colour: "red" },
          { type: "pillar", kind: "grey", glow: "maybe" },
        ),
      ),
    );
    expect(result.map((d) => [d.severity, d.message])).toEqual([
      ["warning", "unknown tag unicorn; drawn as a placeholder"],
      [
        "error",
        'altar: at="middle" is not one of centre, north, south, east, west, northEast, northWest, southEast, southWest, center',
      ],
      ["warning", "altar: unknown attribute colour"],
      ["error", 'pillar: kind="grey" is not one of black, white'],
      ["error", 'pillar: glow="maybe" is not a boolean'],
    ]);
  });

  it("reports bad names, non-scalar values and text", () => {
    const result = validateHall(
      hall(
        floor(
          { type: "altar", "bad-name": 1, nested: { a: 1 } },
          { type: "bad tag" },
          { type: 5 },
          "some text",
          7,
        ),
      ),
    );
    expect(result.map((d) => d.message)).toEqual([
      'altar: "bad-name" is not an attribute name',
      "altar: nested must be a number, string or boolean",
      "a node without a valid tag is ignored",
      "a node without a valid tag is ignored",
      "text is not allowed in a hall",
      "not a hall node",
    ]);
  });

  it("checks roles, letters, item kinds and required text", () => {
    const result = validateHall(
      hall(
        floor(
          { type: "officer" },
          { type: "lamen", role: "constructor" },
          { type: "hebrewLetter", letter: "omega" },
          { type: "hebrewLetter" },
          { type: "item" },
          { type: "item", kind: "cup" },
          { type: "marker" },
          { type: "label" },
          { type: "door" },
          {
            type: "officer",
            role: "hegemon",
            children: [{ type: "label", text: "Hegemon" }],
          },
        ),
        { type: "caption" },
      ),
    );
    expect(result.map((d) => [d.path, d.attribute, d.severity])).toEqual([
      [[0, 0], "role", "warning"],
      [[0, 1], "role", "warning"],
      [[0, 2], "letter", "error"],
      [[0, 3], "letter", "error"],
      [[0, 4], "kind", "error"],
      [[0, 5], "kind", "warning"],
      [[0, 6], "text", "warning"],
      [[0, 7], "text", "warning"],
      [[0, 8], "x", "warning"],
      [[1], "text", "warning"],
    ]);
  });

  it("knows the art registry's tags and item kinds", () => {
    const art = new Map<string, HallArt>([
      [
        "item:cup",
        {
          Component: () => null,
          box: { width: 1, height: 1 },
          provenance: { origin: "thirdParty", author: "?", licence: "?" },
        },
      ],
      [
        "tablet",
        {
          Component: () => null,
          box: { width: 1, height: 1 },
          attributes: new Map([
            ["element", { kind: "enum", values: ["earth"] }],
          ]),
          provenance: {
            origin: "original",
            author: "Gadi Cohen",
            licence: "MIT",
          },
        },
      ],
      [
        "veil",
        {
          Component: () => null,
          box: { width: 1, height: 1 },
          provenance: { origin: "original", author: "x", licence: "MIT" },
        },
      ],
      [
        "text",
        {
          Component: () => null,
          box: { width: 1, height: 1 },
          provenance: { origin: "original", author: "x", licence: "MIT" },
        },
      ],
    ]);
    expect(itemKindKnown("cup", art)).toBe(true);
    expect(itemKindKnown("cup")).toBe(false);
    expect(itemKindKnown("cross")).toBe(true);
    expect(hallTagSpec("tablet", art)?.role).toBe("placeable");
    expect(hallTagSpec("text", art)).toBeUndefined();
    expect(hallTagSpec("tablet")).toBeUndefined();
    const result = validateHall(
      hall(
        floor(
          { type: "item", kind: "cup" },
          { type: "tablet", element: "earth", x: 1 },
          { type: "tablet", element: "fire" },
          { type: "veil", x: 2 },
        ),
      ),
      { art },
    );
    expect(result.map((d) => d.message)).toEqual([
      'tablet: element="fire" is not one of earth',
    ]);
  });

  it("reports misplaced tags", () => {
    const result = validateHall(
      hall(
        { type: "altar" },
        { type: "gdHall" },
        floor({ type: "floor" }, { type: "caption", text: "x" }),
        { type: "dais", children: [{ type: "door", x: 1 }] },
        {
          type: "caption",
          text: "x",
          children: [{ type: "label", text: "y" }],
        },
        floor({
          type: "pillar",
          kind: "white",
          children: [{ type: "label", text: "ok" }, { type: "pillar" }],
        }),
      ),
    );
    expect(result.map((d) => [d.path, d.severity, d.message])).toEqual([
      [
        [0],
        "warning",
        "altar belongs in floor, dais or banners; drawn on the floor",
      ],
      [[1], "error", "gdHall cannot be nested"],
      [[2, 0], "error", "floor cannot stand here; ignored"],
      [[2, 1], "error", "caption cannot stand here; ignored"],
      [[3, 0], "error", "door cannot stand here; ignored"],
      [[4, 0], "error", "label cannot stand here; ignored"],
      [[5, 0, 1], "error", "pillar cannot stand here; ignored"],
    ]);
  });

  it("stops at the depth and node bounds", () => {
    let deep: HallNode = { type: "altar" };
    for (let i = 0; i < MAX_HALL_DEPTH + 2; i++)
      deep = { type: "altar", children: [deep] };
    const tooDeep = validateHall(hall(floor(deep)));
    expect(tooDeep).toHaveLength(1);
    expect(tooDeep[0].message).toBe(
      `nested deeper than ${MAX_HALL_DEPTH}; ignored`,
    );
    expect(tooDeep[0].path).toHaveLength(MAX_HALL_DEPTH + 1);

    const wide = Array.from({ length: MAX_HALL_NODES + 10 }, () => ({
      type: "altar",
    }));
    expect(validateHall(hall(floor(...wide)))).toEqual([
      {
        path: [0, MAX_HALL_NODES - 2],
        severity: "error",
        message: `more than ${MAX_HALL_NODES} nodes; the rest are ignored`,
      },
    ]);
  });
});
