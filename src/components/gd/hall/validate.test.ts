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
import { hallArtKey, hallTagSpec, itemKindKnown } from "./spec";
import type { HallArt, HallAttrSpec, HallNode } from "./types";
import { validateHall } from "./validate";
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

  it("warns that a door is clamped to the floor's 0–16, as drawn", () => {
    const result = validateHall(
      hall(
        floor(
          { type: "door", x: 1e308, width: 20 },
          { type: "door", side: "north", y: -1 },
          { type: "door", x: 16, width: 0 },
        ),
      ),
    );
    expect(result.map((d) => [d.path, d.attribute, d.message])).toEqual([
      [[0, 0], "x", "door: x=1e+308 is outside 0–16 and is clamped"],
      [[0, 0], "width", "door: width=20 is outside 0–16 and is clamped"],
      [[0, 1], "y", "door: y=-1 is outside 0–16 and is clamped"],
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
          { type: "item", kind: "goblet" },
          { type: "marker" },
          { type: "label" },
          { type: "door" },
          { type: "door", side: "north", y: 3 },
          { type: "door", side: "south", x: 3 },
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
      [[0, 10], "y", "warning"],
      [[1], "text", "warning"],
    ]);
  });

  it("knows the art registry's tags and item kinds", () => {
    const art = new Map<string, HallArt>([
      [
        "item:goblet",
        {
          Component: () => null,
          box: { width: 1, height: 1 },
          variant: () => "",
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
          variant: () => "",
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
          variant: () => "",
          provenance: { origin: "original", author: "x", licence: "MIT" },
        },
      ],
      [
        "text",
        {
          Component: () => null,
          box: { width: 1, height: 1 },
          variant: () => "",
          provenance: { origin: "original", author: "x", licence: "MIT" },
        },
      ],
    ]);
    expect(itemKindKnown("goblet", art)).toBe(true);
    expect(itemKindKnown("goblet")).toBe(false);
    expect(itemKindKnown("cross")).toBe(true);
    expect(hallTagSpec("tablet", art)?.role).toBe("placeable");
    expect(hallTagSpec("text", art)).toBeUndefined();
    expect(hallTagSpec("tablet")).toBeUndefined();
    const result = validateHall(
      hall(
        floor(
          { type: "item", kind: "goblet" },
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

  it("adds the attributes an item's or officer's art declares", () => {
    const declares = (attributes: [string, HallAttrSpec][]): HallArt => ({
      Component: () => null,
      box: { width: 1, height: 1 },
      attributes: new Map(attributes),
      variant: () => "",
      provenance: { origin: "original", author: "x", licence: "MIT" },
    });
    const art = new Map<string, HallArt>([
      ["item:lamp", declares([["glow", { kind: "boolean" }]])],
      // The package's own spec wins a clash: fill stays a colour name.
      ["item:cup", declares([["fill", { kind: "number" }]])],
      ["lamen", declares([["ring", { kind: "enum", values: ["plain"] }]])],
    ]);
    expect(
      hallTagSpec("item", art, { type: "item", kind: "lamp" })?.attributes.get(
        "glow",
      ),
    ).toEqual({ kind: "boolean" });
    expect(hallTagSpec("item", art)?.attributes.has("glow")).toBe(false);
    expect(hallArtKey({ type: "officer", role: "keryx" })).toBe("lamen");
    expect(hallArtKey({ type: "item" })).toBe("item:");
    expect(hallArtKey({ type: "altar" })).toBe("altar");
    const result = validateHall(
      hall(
        floor(
          { type: "item", kind: "lamp", glow: true },
          { type: "item", kind: "lamp", glow: "bright" },
          { type: "item", kind: "cup", glow: true },
          { type: "item", kind: "cup", fill: "red" },
          { type: "officer", role: "keryx", ring: "plain" },
          { type: "lamen", role: "keryx", ring: "plain" },
          { type: "altar", ring: "plain" },
        ),
      ),
      { art },
    );
    expect(result.map((d) => d.message)).toEqual([
      'item: glow="bright" is not a boolean',
      "item: unknown attribute glow",
      "altar: unknown attribute ring",
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

  it("clips untrusted text in its messages", () => {
    const long = "x".repeat(10_000);
    const tag = `t${"x".repeat(10_000)}`;
    const result = validateHall(
      hall(
        floor(
          { type: "pillar", kind: long, [tag]: 1 },
          { type: "officer", role: long },
          { type: "item", kind: long },
          { type: "hebrewLetter", letter: long },
          { type: tag, children: [] },
          { type: "pillar", children: [{ type: tag }] },
        ),
      ),
    );
    expect(result).toHaveLength(10);
    for (const diagnostic of result)
      expect(diagnostic.message.length, diagnostic.message).toBeLessThan(120);
    expect(result[0].message).toBe(
      `pillar: kind="${"x".repeat(40)}…" is not one of black, white`,
    );
    expect(result[1].message).toBe(
      `pillar: unknown attribute t${"x".repeat(39)}…`,
    );
    // The attribute itself is kept whole, for an editor to find.
    expect(result[1].attribute).toBe(tag);
    expect(result[2].message).toBe(
      `officer: role="${"x".repeat(40)}…" is longer than 200 characters`,
    );
  });

  it("reports what the layout cuts", () => {
    const long = "word ".repeat(40);
    const result = validateHall({
      type: "gdHall",
      marginNorth: 0,
      margin: 0.1,
      marginSouth: 5,
      children: [
        floor(
          { type: "officer", role: "keryx", label: long },
          { type: "label", text: "Free" },
          {
            type: "officer",
            role: "keryx",
            children: [{ type: "label", text: long }],
          },
        ),
        { type: "caption", text: "1\n2\n3\n4\n5\n6\n7" },
      ],
    });
    expect(result.map((d) => [d.path, d.attribute, d.message])).toEqual([
      [
        [],
        "marginNorth",
        "gdHall: marginNorth cuts into the drawing on the North side",
      ],
      [[], "margin", "gdHall: margin cuts into the drawing on the East side"],
      [[], "margin", "gdHall: margin cuts into the drawing on the West side"],
      [
        [0, 0],
        undefined,
        "officer: text longer than 6 lines; cut with an ellipsis",
      ],
      [
        [0, 2, 0],
        undefined,
        "label: text longer than 6 lines; cut with an ellipsis",
      ],
      [
        [1],
        undefined,
        "caption: text longer than 6 lines; cut with an ellipsis",
      ],
    ]);
    const crowded = validateHall(
      hall(
        floor(
          // Six lines each: the 84th label passes the 500th line.
          ...Array.from({ length: 100 }, () => ({
            type: "label",
            text: "1\n2\n3\n4\n5\n6",
          })),
        ),
      ),
    ).filter((d) => d.message.startsWith("more than"));
    expect(crowded).toEqual([
      {
        path: [0, 83],
        severity: "warning",
        message:
          "more than 500 label lines in the hall; from here on they are not drawn",
      },
    ]);
  });

  it("warns of a dais row in a hall without a dais", () => {
    const row = { type: "dais", children: [{ type: "officer", role: "x" }] };
    const daisWarnings = (dais: unknown) =>
      validateHall({ type: "gdHall", dais, children: [row] })
        .filter((d) => d.message.startsWith("dais:"))
        .map((d) => [d.path, d.severity]);
    expect(daisWarnings(0)).toEqual([[[0], "warning"]]);
    expect(daisWarnings("-1")).toEqual([[[0], "warning"]]);
    expect(daisWarnings(4)).toEqual([]);
    expect(daisWarnings(undefined)).toEqual([]);
  });

  it("places unknown tags as placeholders and skips their children", () => {
    const result = validateHall(
      hall(
        { type: "unicorn" },
        floor(
          { type: "pillar", children: [{ type: "unicorn" }] },
          { type: "altar", children: [{ type: "unicorn" }, { type: "door" }] },
          { type: "unicorn", children: [{ type: "label", bad: 1 }] },
          { type: "item:cup" },
        ),
      ),
      {
        art: new Map([
          [
            "item:cup",
            {
              Component: () => null,
              box: { width: 1, height: 1 },
              variant: () => "",
              provenance: { origin: "original", author: "x", licence: "MIT" },
            },
          ],
        ]),
      },
    );
    expect(result.map((d) => [d.path, d.severity, d.message])).toEqual([
      [[0], "warning", "unknown tag unicorn; drawn as a placeholder"],
      [[1, 0, 0], "error", "unicorn cannot stand here; ignored"],
      [[1, 1, 0], "warning", "unknown tag unicorn; drawn as a placeholder"],
      [[1, 1, 1], "error", "door cannot stand here; ignored"],
      [[1, 2], "warning", "unknown tag unicorn; drawn as a placeholder"],
      [[1, 3], "error", "a node without a valid tag is ignored"],
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
