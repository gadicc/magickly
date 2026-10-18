import { readFileSync } from "node:fs";
import { validateHall } from "@magick-components/gd/hall";
import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import type { HallNode } from "@magick-components/gd/hall/types";
import { describe, expect, it } from "vitest";
import { gdHallArt } from "@/app/gd/hall/art";
import { gdHallRow, gdHallSource } from "./gdHallRows";
import { prepare } from "./prepare";
import { parseRitualPug, printRitualPug, RITUAL_PUG_HEADER } from "./ritualPug";
import { ritualSourceDiagnostic } from "./ritualSourceDiagnostics";
import { parseRitualText, printRitualText } from "./ritualText";
import {
  type RitualSemanticDocument,
  type RitualSemanticNode,
  semanticFromJrt,
  semanticToJrt,
  validateRitualSemantic,
} from "./semantic";
import { compileSemanticSource } from "./semanticCompile";

type Element = Extract<RitualSemanticNode, { kind: "element" }>;

/** The plan's Neophyte hall (decision 3), as `prepare.js` reads it. */
const legacyPug = readFileSync(
  new URL("./fixtures/gdHallNeophyte.pug", import.meta.url),
  "utf8",
);
const source = `${RITUAL_PUG_HEADER}\n${legacyPug}`;

const document = (...nodes: RitualSemanticNode[]): RitualSemanticDocument => ({
  format: "magickli-ritual",
  version: 1,
  nodes,
});
const walk = (
  nodes: readonly RitualSemanticNode[],
  visit: (node: RitualSemanticNode) => void,
) => {
  for (const node of nodes) {
    visit(node);
    if (node.kind === "element") walk(node.children ?? [], visit);
  }
};
const ids = (nodes: readonly RitualSemanticNode[]) => {
  const found: string[] = [];
  walk(nodes, (node) => "id" in node && found.push(node.id));
  return found;
};
const hallOf = (doc: RitualSemanticDocument) =>
  doc.nodes.find(
    (node): node is Element => node.kind === "element" && node.tag === "gdHall",
  ) as Element;
/** A row tree without `children: []`, as the presets write them. */
const bare = (row: HallNode): HallNode => {
  const { children, ...attrs } = row;
  return children?.length
    ? { ...attrs, type: row.type, children: children.map(bare) }
    : { ...attrs, type: row.type };
};
const failure = (text: string) => {
  try {
    parseRitualPug(text);
  } catch (error) {
    const { message, line, column } = ritualSourceDiagnostic(error, text);
    return { message, line, column };
  }
  return null;
};

describe("a hall in ritual Pug", () => {
  it("round-trips the Neophyte hall exactly, with its IDs and comment", () => {
    const parsed = parseRitualPug(source);
    expect(validateRitualSemantic(parsed)).toEqual([]);
    const printed = printRitualPug(parsed);
    const again = parseRitualPug(printed);
    expect(again).toEqual(parsed);
    expect(printRitualPug(again)).toBe(printed);
    expect(ids(again.nodes)).toEqual(ids(parsed.nodes));
    const hall = hallOf(parsed);
    const kinds = new Set<string>();
    walk(hall.children ?? [], (node) => kinds.add(node.kind));
    expect([...kinds].sort()).toEqual(["annotation", "element"]);
    expect(printed).toContain("    //- Pillars stand either side of Hegemon\n");
    // Bare `glow` reads as `true`; `null` stays a value.
    expect(printed).toMatch(
      /pillar#\S+\(kind="black", x=4, y=3, glow=true\)\n/,
    );
    expect(printed).toMatch(/, scale=null\)\n/);
    // One node per line, leaves bare: authors' and the printer's form.
    expect(printed).toMatch(
      /\n {6}item#[A-Za-z0-9-]+\(kind="cup", at="west"\)\n/,
    );
    expect(printed.split("\n").filter((line) => line.endsWith("/"))).toEqual(
      [],
    );
  });

  it("keeps blank lines and multi-line comments inside a hall", () => {
    const text = `${RITUAL_PUG_HEADER}\ngdHall\n  floor\n    altar\n\n    pillar(kind="white")\n    ritualComment(value="two\\nlines")/\n`;
    const parsed = parseRitualPug(text);
    const floor = hallOf(parsed).children?.[0] as Element;
    expect(floor.children?.map((node) => node.kind)).toEqual([
      "element",
      "annotation",
      "element",
      "annotation",
    ]);
    const printed = printRitualPug(parsed);
    expect(parseRitualPug(printed)).toEqual(parsed);
    expect(printRitualPug(parseRitualPug(printed))).toBe(printed);
  });

  it("compiles to the rows the hall package draws, without IDs or comments", () => {
    const parsed = parseRitualPug(source);
    const compiled = compileSemanticSource(JSON.stringify(parsed));
    expect(compiled).not.toBeNull();
    const jrt = JSON.parse(compiled?.contentJson ?? "null");
    expect(jrt).toEqual(semanticToJrt(parsed));
    const row = jrt.children[2] as HallNode;
    expect(row).toMatchObject({ type: "gdHall", dais: 4, wall: "gradient" });
    expect(JSON.stringify(row)).not.toMatch(/"id"|Pillars stand/);
    expect(validateHall(row, { art: gdHallArt })).toEqual([]);
    // Re-imported, the hall is elements again, not legacy content.
    const back = semanticFromJrt(jrt);
    expect(validateRitualSemantic(back)).toEqual([]);
    let legacy = 0;
    walk(back.nodes, (node) => node.kind === "legacy" && legacy++);
    expect(legacy).toBe(0);
    expect(semanticToJrt(back)).toEqual(jrt);
  });

  it("reads and prints in the readable text projection", () => {
    const parsed = parseRitualPug(source);
    expect(parseRitualText(printRitualText(parsed))).toEqual(parsed);
  });

  describe.each(HALL_PRESETS.map((preset) => [preset.id, preset] as const))(
    "the %s preset as ritual source",
    (_id, preset) => {
      const hall = gdHallSource(preset.hall);
      const doc = document(
        {
          kind: "element",
          id: "Ab3k9Qp7Zx2Mn5Rs",
          tag: "title",
          attrs: { text: "Hall" },
          children: [{ kind: "text", text: "Hall" }],
        },
        hall,
      );

      it("prints, parses and reprints exactly, IDs kept", () => {
        const printed = printRitualPug(doc);
        const again = parseRitualPug(printed);
        expect(again).toEqual(doc);
        expect(printRitualPug(again)).toBe(printed);
        expect(ids(again.nodes)).toEqual(ids(doc.nodes));
        // Every leaf in the bare form.
        expect(printed).not.toMatch(/\/\n/);
      });

      it("compiles to the preset's rows, which draw without diagnostics", () => {
        const row = gdHallRow(hall);
        expect(row).not.toBeNull();
        expect(bare(row as HallNode)).toEqual(preset.hall);
        expect(validateHall(row as HallNode, { art: gdHallArt })).toEqual([]);
        const compiled = compileSemanticSource(JSON.stringify(doc));
        expect(JSON.parse(compiled?.contentJson ?? "null").children[1]).toEqual(
          row,
        );
      });
    },
  );

  it("refuses rows that break the shape rule as source", () => {
    expect(() =>
      gdHallSource({
        type: "gdHall",
        children: [{ type: "text", value: "x" }],
      }),
    ).toThrow("Not a valid hall");
    expect(gdHallRow({ id: "bad", attrs: {}, children: null })).toBeNull();
  });
});

describe("hostile halls", () => {
  const hall = (body: string) =>
    `${RITUAL_PUG_HEADER}\ngdHall\n  floor\n${body
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n")}\n`;
  it.each([
    ['item(type="cup")', "Line 4: reserved hall attribute", undefined],
    ['item(children="x")', "Line 4: reserved hall attribute", undefined],
    ['item(style="color:red")', "Line 4: reserved hall attribute", undefined],
    ['item(src="/pics/x.svg")', "Line 4: reserved hall attribute", undefined],
    [
      'item(href="https://example.com")',
      "Line 4: reserved hall attribute",
      undefined,
    ],
    ['item(xlinkHref="#a")', "Line 4: reserved hall attribute", undefined],
    ['item(data="x")', "Line 4: reserved hall attribute", undefined],
    [
      'item(dangerouslySetInnerHTML="x")',
      "Line 4: reserved hall attribute",
      undefined,
    ],
    ['item(toString="x")', "Line 4: reserved hall attribute", undefined],
    ['item(id="x")', "Line 4: invalid node ID", 10],
    ['text(value="hi")', "Line 4: reserved hall tag", 5],
    ['title(text="x")', "Line 4: reserved hall tag", 5],
    ['img(alt="x")', "Line 4: reserved hall tag", 5],
    ["footnote", "Line 4: reserved hall tag", 5],
    ["stylesheet", "Line 4: reserved hall tag", 5],
    ["cursor", "Line 4: reserved hall tag", 5],
    ["constructor", "Line 4: reserved hall tag", 5],
    ["toString", "Line 4: reserved hall tag", 5],
    ['say(role="hiereus")', "Line 4: reserved hall tag", 5],
    ['do(role="hiereus")', "Line 4: reserved hall tag", 5],
    ["Hiereus: Speak", "Line 4: reserved hall tag", 5],
    ["ritualWidget", "Line 4: reserved hall tag", 5],
    // Pug keywords that still lex as tags in some form; the others never
    // reach the validator from Pug (see below).
    ["mixin", "Line 4: reserved hall tag", 5],
    ["append", "Line 4: reserved hall tag", 5],
    ["prepend", "Line 4: reserved hall tag", 5],
    ["block(x=1)", "Line 4: reserved hall tag", 5],
    ["yield(x=1)", "Line 4: reserved hall tag", 5],
    ["filter", "Line 4: reserved hall tag", 5],
    ["script", "Line 4: reserved hall tag", 5],
    ["style", "Line 4: reserved hall tag", 5],
    ["gdHall", "Line 4: a temple hall cannot stand here", 5],
    ['ritualText(value="a cup")/', "Line 4: text is not allowed in a hall", 5],
    ['ritualLegacy(raw={"type":"x"})/', "Line 4: unsupported hall node", 5],
    ["| a cup", "Line 4: text is not allowed in a hall", 7],
    [
      'caption(text="x") Neophyte Temple',
      "Line 4: text is not allowed in a hall",
      23,
    ],
    ['item(pos={"x":1})', "Line 4: invalid hall attributes", undefined],
    ["item(pos=[1,2])", "Line 4: invalid hall attributes", undefined],
    ["item(x=1e999)", "Line 4: invalid hall attributes", undefined],
    ['item(name="a\\u0000b")', "Line 4: invalid hall attributes", undefined],
    ['item(name="\\ud800")', "Line 4: invalid hall attributes", undefined],
    ['item(label-pos="top")', "Line 4: invalid hall attributes", undefined],
    ["my-item", "Line 4: invalid hall tag", 5],
    ["item(x=.5)", "Line 4: attributes must be JSON literals", 10],
    ["item.cup", "Invalid literal attribute", 5],
  ])("%s", (body, message, column) => {
    const result = failure(hall(body));
    expect(result?.message).toBe(message);
    if (message.startsWith("Line")) expect(result?.line).toBe(4);
    expect(result?.column).toBe(column);
  });

  it("ignores spaces after a hall's tags, and prints without them", () => {
    const withoutIds = (doc: RitualSemanticDocument) =>
      JSON.parse(
        JSON.stringify(doc, (key, value) => (key === "id" ? undefined : value)),
      );
    const plain = parseRitualPug(hall('altar(kind="x")\nitem/\npillar'));
    const spaced = parseRitualPug(
      `${RITUAL_PUG_HEADER}\ngdHall   \n  floor \n    altar(kind="x")  \n    item/  \n    pillar \n    |   \n`,
    );
    expect(withoutIds(spaced)).toEqual(withoutIds(plain));
    const printed = printRitualPug(spaced);
    expect(printed).not.toMatch(/[ \t]\n/);
    expect(parseRitualPug(printed)).toEqual(spaced);
    // Outside a hall, trailing spaces are text, as before.
    const note = parseRitualPug(`${RITUAL_PUG_HEADER}\nnote   \n`);
    expect((note.nodes[0] as Element).children).toEqual([
      { kind: "text", text: "  " },
    ]);
  });

  it("accepts any other identifier tag, nesting and scalars, and prints them back", () => {
    const text = hall(
      [
        'b(class="x")',
        'a(name="not a link")',
        'var(name="x")',
        "br",
        "note",
        'Title(text="not a title")',
        "Each(dais=0)",
        "  unicorn(horn=true, x=-0.5, kind=null)",
        'label(text="Ünïcödé “quotes” \\n and )parens(")',
      ].join("\n"),
    );
    const parsed = parseRitualPug(text);
    const printed = printRitualPug(parsed);
    expect(parseRitualPug(printed)).toEqual(parsed);
    expect(printRitualPug(parseRitualPug(printed))).toBe(printed);
    // Hall rows never take the inline, pipe or shortcut forms.
    expect(printed).toMatch(/\n {4}b#\S+\(class="x"\)\n {4}a#/);
    expect(printed).toMatch(/\n {4}var#\S+\(name="x"\)\n/);
  });

  it("applies the document's node and depth bounds inside a hall", () => {
    let nested: RitualSemanticNode = {
      kind: "element",
      id: "Ab3k9Qp7Zx2Mn5R0",
      tag: "leaf",
      attrs: {},
    };
    for (let i = 0; i < 101; i++)
      nested = {
        kind: "element",
        id: `Ab3k9Qp7Zx2M${String(i).padStart(4, "0")}`,
        tag: i === 100 ? "gdHall" : "box",
        attrs: {},
        children: [nested],
      };
    expect(validateRitualSemantic(document(nested))).toContain(
      `nodes[0]${".children[0]".repeat(101)}: document is too large or deeply nested`,
    );
  });

  it("rejects malformed hall nodes in semantic JSON", () => {
    const base = {
      kind: "element",
      id: "Ab3k9Qp7Zx2Mn5Rs",
      tag: "gdHall",
      attrs: {},
    } as const;
    const child = (node: unknown) =>
      validateRitualSemantic({
        format: "magickli-ritual",
        version: 1,
        nodes: [{ ...base, children: [node] }],
      });
    const id = "Ab3k9Qp7Zx2Mn5R1";
    expect(child({ kind: "text", text: "x" })).toEqual([
      "nodes[0].children[0]: text is not allowed in a hall",
    ]);
    expect(child({ kind: "legacy", id, raw: {} })).toEqual([
      "nodes[0].children[0]: unsupported hall node",
    ]);
    expect(
      child({ kind: "element", id, tag: "x", attrs: {}, extra: 1 }),
    ).toEqual(["nodes[0].children[0]: unsupported hall node"]);
    expect(child({ kind: "element", id, tag: "x", attrs: [] })).toEqual([
      "nodes[0].children[0]: invalid hall attributes",
    ]);
    expect(
      child({
        kind: "element",
        id,
        tag: "x",
        attrs: JSON.parse('{"__proto__":1}'),
      }),
    ).toEqual(["nodes[0].children[0]: invalid hall attributes"]);
    expect(
      child({ kind: "element", id, tag: "x", attrs: {}, children: {} }),
    ).toEqual(["nodes[0].children[0]: invalid children"]);
    expect(child({ kind: "element", id, tag: "", attrs: {} })).toEqual([
      "nodes[0].children[0]: invalid hall tag",
    ]);
    expect(
      child({ kind: "annotation", style: "comment", text: "fine" }),
    ).toEqual([]);
    // The hall element itself follows the same rules.
    expect(
      validateRitualSemantic(
        document({ ...base, attrs: { href: "https://example.com" } }),
      ),
    ).toEqual(["nodes[0]: reserved hall attribute"]);
  });
});

describe("Pug keywords in a hall", () => {
  // A printed `each#…` or `if#…` line is a Pug statement, not a tag, so
  // these could not be written back; the rest are statements when bare.
  const unprintable = [
    "if",
    "else",
    "unless",
    "case",
    "when",
    "default",
    "each",
    "for",
    "while",
    "extends",
    "extend",
    "include",
    "doctype",
    // Pug takes any line beginning with `doctype` for a doctype.
    "doctypeX",
    "doctypes",
    "doctypehtml",
  ];
  const keywords = [
    ...unprintable,
    "mixin",
    "block",
    "append",
    "prepend",
    "yield",
    "filter",
    "script",
    "style",
  ];
  const id = "Ab3k9Qp7Zx2Mn5R1";

  it.each(unprintable)("%s cannot be read back from Pug", (keyword) => {
    const result = failure(
      `${RITUAL_PUG_HEADER}\ngdHall\n  ${keyword}#${id}(kind="x")\n`,
    );
    expect(result?.message).not.toBe("Line 3: reserved hall tag");
    expect(result?.message).toMatch(/invalid Pug syntax|Template programs/);
  });

  it.each(keywords)("%s is a reserved hall tag on every path", (keyword) => {
    const node = { kind: "element", id, tag: keyword, attrs: {} };
    expect(
      validateRitualSemantic({
        format: "magickli-ritual",
        version: 1,
        nodes: [
          {
            kind: "element",
            id: "Ab3k9Qp7Zx2Mn5R0",
            tag: "gdHall",
            attrs: {},
            children: [node],
          },
        ],
      }),
    ).toEqual(["nodes[0].children[0]: reserved hall tag"]);
    // The readable text projection, as typed or pasted.
    expect(() =>
      parseRitualText(
        `ritual 1\n@gdHall~Ab3k9Qp7Zx2Mn5R0:\n  @${keyword}~${id} {"kind":"x"}:\n`,
      ),
    ).toThrow("Line 3: reserved hall tag");
    // A compiled row holding one stays opaque legacy content.
    const row = { type: "gdHall", children: [{ type: keyword }] };
    expect(semanticFromJrt({ children: [row] }).nodes[0]).toMatchObject({
      kind: "legacy",
      raw: row,
    });
  });
});

describe("where a hall may stand", () => {
  const pug = (...lines: string[]) =>
    `${RITUAL_PUG_HEADER}\n${lines.join("\n")}\n`;
  const hallAt = (indent: number) => [
    `${"  ".repeat(indent)}gdHall`,
    `${"  ".repeat(indent + 1)}floor`,
    `${"  ".repeat(indent + 2)}altar`,
  ];

  it.each([
    ["the top level", [], 0],
    ["a note", ["note"], 1],
    ["a summary", ['summary(summary="The hall")'], 1],
    ["a list item", ["ul", "  li"], 2],
    ["a todo", ["todo"], 1],
    ["a note in a task", ['task(say=true, role="hiereus")', "  note"], 2],
  ] as const)("stands in %s and round-trips", (_name, parents, indent) => {
    const text = pug(...parents, ...hallAt(indent));
    const parsed = parseRitualPug(text);
    expect(validateRitualSemantic(parsed)).toEqual([]);
    const printed = printRitualPug(parsed);
    expect(parseRitualPug(printed)).toEqual(parsed);
    expect(printRitualPug(parseRitualPug(printed))).toBe(printed);
    expect(parseRitualText(printRitualText(parsed))).toEqual(parsed);
    // Compiled and imported again, it is still a hall, not legacy content.
    const back = semanticFromJrt(semanticToJrt(parsed));
    let legacy = 0;
    walk(back.nodes, (node) => node.kind === "legacy" && legacy++);
    expect(legacy).toBe(0);
  });

  it.each([
    ["bold text", ["b"], 1],
    ["italic text", ["i"], 1],
    ["a link", ['a(href="https://example.com")'], 1],
    ["a title", ['title(text="Hall")'], 1],
    [
      "an option",
      [
        'declareVar(name="v", varType="select")',
        '  option(value="a", label="A")',
      ],
      2,
    ],
    ["a task", ['task(say=true, role="hiereus")'], 1],
    ["a list", ["ul"], 1],
    ["a footnote", ["footnote"], 1],
    ["another hall", ["gdHall"], 1],
    ["a hall's floor", ["gdHall", "  floor"], 2],
  ] as const)(
    "is refused in %s, at its line and column",
    (_name, parents, indent) => {
      const result = failure(pug(...parents, ...hallAt(indent)));
      const line = parents.length + 2;
      expect(result).toEqual({
        message: `Line ${line}: a temple hall cannot stand here`,
        line,
        column: indent * 2 + 1,
      });
    },
  );

  it("is refused in the text projection and in semantic JSON", () => {
    expect(() =>
      parseRitualText(
        "ritual 1\n@b~Ab3k9Qp7Zx2Mn5R0:\n  @gdHall~Ab3k9Qp7Zx2Mn5R1:\n",
      ),
    ).toThrow("Line 3: a temple hall cannot stand here");
    const hall = {
      kind: "element",
      id: "Ab3k9Qp7Zx2Mn5R1",
      tag: "gdHall",
      attrs: {},
    } as const;
    expect(
      validateRitualSemantic(
        document({
          kind: "element",
          id: "Ab3k9Qp7Zx2Mn5R0",
          tag: "title",
          attrs: { text: "Hall" },
          children: [hall],
        }),
      ),
    ).toEqual(["nodes[0].children[0]: a temple hall cannot stand here"]);
  });

  it("imports a compiled hall that stands where it may not as legacy content", () => {
    const hall = { type: "gdHall", children: [{ type: "floor" }] };
    const doc = semanticFromJrt({
      children: [
        { type: "b", children: [hall] },
        { type: "note", children: [hall] },
        { type: "title", text: "Hall", children: [hall] },
        { type: "gdHall", children: [hall] },
      ],
    });
    const [bold, note, title, outer] = doc.nodes as Element[];
    expect(bold.children?.[0]).toMatchObject({ kind: "legacy", raw: hall });
    expect(note.children?.[0]).toMatchObject({
      kind: "element",
      tag: "gdHall",
    });
    expect(title.children?.[0]).toMatchObject({ kind: "legacy", raw: hall });
    // A hall inside a hall keeps the outer one opaque.
    expect(outer).toMatchObject({
      kind: "legacy",
      raw: { type: "gdHall", children: [hall] },
    });
  });
});

describe("a hall imported from compiled rows", () => {
  it("imports the legacy prepare.js path, skipping compiled comments", () => {
    const jrt = prepare(legacyPug) as { children: HallNode[] };
    const row = jrt.children[2];
    const floor = row.children?.[1] as HallNode;
    // `prepare.js` turns `//-` into `{}` and numbers into strings.
    expect(floor.children?.[0]).toEqual({});
    expect(floor.children?.[1]).toMatchObject({ x: "9.4", y: "0" });
    const doc = semanticFromJrt(jrt);
    expect(validateRitualSemantic(doc)).toEqual([]);
    const hall = hallOf(doc);
    const legacyFloor = hall.children?.[1] as Element;
    expect(legacyFloor.children).toHaveLength(
      (floor.children?.length ?? 0) - 1,
    );
    expect((legacyFloor.children?.[0] as Element).attrs).toEqual({
      kind: "east",
      x: "9.4",
      y: "0",
    });
    // Numeric strings are kept as they came (parity); the hall draws them.
    expect(
      validateHall(gdHallRow(hall) as HallNode, { art: gdHallArt }),
    ).toEqual([]);
    // Only the compiled comment differs from the import's reader tree.
    const withoutComment = structuredClone(jrt);
    (withoutComment.children[2].children?.[1].children as unknown[]).shift();
    expect(semanticToJrt(doc)).toEqual(withoutComment);
    // And it prints and parses back exactly.
    const printed = printRitualPug(doc);
    expect(parseRitualPug(printed)).toEqual(doc);
    expect(printed).toContain("banner#");
    expect(printed).toMatch(/banner#\S+\(kind="east", x="9.4", y="0"\)\n/);
  });

  it("keeps a hall that breaks the shape rule as opaque legacy content", () => {
    const rows = [
      { type: "gdHall", children: [{ type: "text", value: "x" }] },
      { type: "gdHall", children: [{ type: "item", href: "/x" }] },
      { type: "gdHall", children: [{ type: "item", pos: { x: 1 } }] },
      { type: "gdHall", children: ["x"] },
      { type: "gdHall", children: [{ children: [] }] },
    ];
    for (const row of rows) {
      const doc = semanticFromJrt({ children: [row] });
      expect(doc.nodes[0]).toMatchObject({ kind: "legacy", raw: row });
    }
    // A `{}` outside a hall is unknown content, as before.
    expect(semanticFromJrt({ children: [{}] }).nodes[0]).toMatchObject({
      kind: "legacy",
      raw: {},
    });
  });
});
