import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fixture } from "../../editor-trial/source-formats/fixture.mjs";
import { createUuidV7 } from "../lib/ids";
import { prepare } from "./prepare";
import { createRitualNodeId } from "./ritualNodeIds";
import { parseRitualPug, printRitualPug, RITUAL_PUG_HEADER } from "./ritualPug";
import { ritualPugIdRanges } from "./ritualPugIds";
import { restorePugDraftAnnotations } from "./ritualSource";
import { parseRitualText, printRitualText } from "./ritualText";
import {
  type RitualSemanticDocument,
  type RitualSemanticNode,
  semanticFromJrt,
  semanticToJrt,
} from "./semantic";

describe("bounded semantic Pug", () => {
  for (const name of ["0=0", "1=10", "2=9"])
    it(`preserves the complete ${name} tree and identities`, () => {
      const jrt = prepare(
        readFileSync(new URL(`./${name}.pug`, import.meta.url), "utf8"),
      );
      const document = semanticFromJrt(jrt);
      const source = printRitualPug(document);
      expect(parseRitualPug(source)).toEqual(document);
      expect(semanticToJrt(parseRitualPug(source))).toEqual(jrt);
      expect(printRitualPug(parseRitualPug(source))).toBe(source);
    });

  it("preserves existing UUIDs, mixed inline formatting, images and opaque data", () => {
    const document = fixture as RitualSemanticDocument;
    expect(parseRitualPug(printRitualPug(document))).toEqual(document);
  });

  it("supports #id and id attributes, optional new IDs and say/do aliases", () => {
    const uuid = createUuidV7();
    const document = parseRitualPug(
      `${RITUAL_PUG_HEADER}\nsay#${uuid}(role="hiero") Welcome.\ndo(id="Ab3k9Qp7Zx2Mn5Rs", role="keryx") Rise.\nnote New note\n`,
    );
    expect(document.nodes[0]).toMatchObject({
      id: uuid,
      tag: "task",
      attrs: { say: true, role: "hiero" },
    });
    expect(document.nodes[1]).toMatchObject({
      id: "Ab3k9Qp7Zx2Mn5Rs",
      attrs: { do: true, role: "keryx" },
    });
    expect(document.nodes[2]).toMatchObject({
      id: expect.stringMatching(/^[A-Za-z0-9]{16}$/),
    });
    expect(parseRitualPug(printRitualPug(document))).toEqual(document);
  });

  it.each([
    "",
    " ",
    "trailing ",
    "a\nb",
    "\t",
    "#{execute()}",
    "#[b text]",
    "\\",
    "[",
    "]",
    "שלום",
  ])("preserves awkward text %j and adjacent text boundaries", (text) => {
    const document = semanticFromJrt({
      children: [
        {
          type: "task",
          say: true,
          role: "hiero",
          children: [
            { type: "text", value: text },
            { type: "var", name: "candidate" },
            { type: "text", value: " " },
            { type: "text", value: text },
          ],
        },
        { type: "note", children: [] },
        { type: "note" },
      ],
    });
    expect(parseRitualPug(printRitualPug(document))).toEqual(document);
  });

  it.each([
    "- globalThis.executed = true",
    "note= globalThis.executed = true",
    "note #{globalThis.executed = true}",
    "note !{globalThis.executed = true}",
    "note(title=globalThis.executed = true)",
    "include private.txt",
    "mixin command()\n  note ignored",
    "script alert(1)",
    'ritualText(value="x")/\n  - globalThis.executed = true',
    'note#Ab3k9Qp7Zx2Mn5Rs(id="Other00000000001") text',
  ])("refuses unsupported constructs without executing them: %s", (body) => {
    const target = globalThis as typeof globalThis & { executed?: boolean };
    delete target.executed;
    expect(() => parseRitualPug(`${RITUAL_PUG_HEADER}\n${body}\n`)).toThrow();
    expect(target.executed).toBeUndefined();
  });

  it("sanitizes lexer diagnostics and retains author comments in the tree", () => {
    const marker = "SYNTHETIC_PRIVATE_MARKER";
    try {
      parseRitualPug(`${RITUAL_PUG_HEADER}\nnote(value="${marker}`);
    } catch (error) {
      expect((error as Error).message).not.toContain(marker);
    }
    const document = parseRitualPug(
      `${RITUAL_PUG_HEADER}\n//- Author note\nnote Content\n`,
    );
    expect(document.nodes[0]).toEqual({
      kind: "annotation",
      style: "comment",
      text: "Author note",
    });
    expect(printRitualPug(document)).toContain("//- Author note");
    expect(semanticToJrt(document)).toEqual({
      children: [
        { type: "note", children: [{ type: "text", value: "Content" }] },
      ],
    });
  });

  it("maps syntax error coordinates to shortcuts and preserves locations after comment expansion", () => {
    const source = `${RITUAL_PUG_HEADER}\n//- section\n  detail\nnote\n  hiero: hi #[b(value=someCall()) bold]\n`;
    try {
      parseRitualPug(source);
      throw new Error("Expected invalid literal");
    } catch (error) {
      expect(error).toMatchObject({ line: 5, column: 17 });
      expect((error as Error).message).not.toContain("someCall");
    }
    const body = "  hiero: hi #[b bold";
    const expanded = '  say(role="hiero") hi #[b bold';
    const failure = (line: string) => {
      try {
        parseRitualPug(`${RITUAL_PUG_HEADER}\nnote\n${line}`);
      } catch (cause) {
        return cause as { line: number; column: number };
      }
      throw new Error("Expected syntax error");
    };
    const shortcutError = failure(body);
    const explicitError = failure(expanded);
    expect(shortcutError.line).toBe(3);
    expect(shortcutError.column).toBe(
      explicitError.column - (expanded.length - body.length),
    );
  });

  it.each([
    ["note good\nnotte typo", 3, 1, "unsupported node"],
    ["note good\nimg(src=123)/", 3, undefined, "invalid attribute value"],
    ["hiero: Hello #{danger()}", 2, 14, "Template programs are unsupported"],
    ["note#bad text", 2, 5, "invalid node ID"],
    [
      "note#Ab3k9Qp7Zx2Mn5Rs first\nnote#Ab3k9Qp7Zx2Mn5Rs second",
      3,
      5,
      "duplicate id",
    ],
  ])(
    "locates ordinary semantic errors in authored source: %s",
    (body, line, column, message) => {
      try {
        parseRitualPug(`${RITUAL_PUG_HEADER}\n${body}\n`);
        throw new Error("Expected rejection");
      } catch (cause) {
        expect(cause).toMatchObject({ line, column });
        expect((cause as Error).message).toContain(message);
        expect((cause as Error).message).not.toContain("danger()");
      }
    },
  );

  it("bounds recursive inline nesting before lexing or parsing can exhaust the stack", () => {
    expect(() =>
      parseRitualPug(
        `${RITUAL_PUG_HEADER}\nnote ${"#[b ".repeat(500)}text${"]".repeat(500)}\n`,
      ),
    ).toThrow(/invalid Pug syntax/);
  });

  it("prints dense inline siblings as a bounded block projection", () => {
    const document = semanticFromJrt({
      children: [
        {
          type: "note",
          children: Array.from({ length: 600 }, () => ({
            type: "b",
            children: [{ type: "text", value: "word" }],
          })),
        },
      ],
    });
    expect(parseRitualPug(printRitualPug(document))).toEqual(document);
  });

  it("bounds the total inline descendants across nested sibling groups", () => {
    let child: { type: string; children?: unknown[] } = {
      type: "b",
      children: [{ type: "text", value: "end" }],
    };
    for (let depth = 0; depth < 8; depth++)
      child = {
        type: "b",
        children: [
          ...Array.from({ length: 99 }, () => ({ type: "br" })),
          child,
        ],
      };
    const document = semanticFromJrt({
      children: [{ type: "note", children: [child] }],
    });
    expect(parseRitualPug(printRitualPug(document))).toEqual(document);
  });

  it("allows indentation expansion of a saveable semantic tree beyond one MiB", () => {
    const element = (
      tag: string,
      children?: RitualSemanticNode[],
    ): RitualSemanticNode => ({
      kind: "element",
      tag,
      id: createRitualNodeId(),
      attrs: {},
      ...(children ? { children } : {}),
    });
    let child = element(
      "note",
      Array.from({ length: 5000 }, () => element("br")),
    );
    for (let depth = 1; depth < 100; depth++) child = element("note", [child]);
    const document: RitualSemanticDocument = {
      format: "magickli-ritual",
      version: 1,
      nodes: [child],
    };
    expect(JSON.stringify(document).length).toBeLessThan(1_048_576);
    const source = printRitualPug(document);
    expect(source.length).toBeGreaterThan(1_048_576);
    expect(parseRitualPug(source)).toEqual(document);
  });

  it("does not expose attribute values in JSON parser diagnostics", () => {
    expect(() =>
      parseRitualPug(
        `${RITUAL_PUG_HEADER}\nnote(value='SYNTHETIC_PRIVATE_MARKER')\n`,
      ),
    ).toThrow("attributes must be JSON literals");
  });
});

describe("Pug surface conveniences", () => {
  it("expands shortcuts, retains IDs and inline content, and prints shortcuts by default", () => {
    const source = `${RITUAL_PUG_HEADER}\nHiero#Ab3k9Qp7Zx2Mn5Rs: Hi #[b#Other00000000001 there].\n* Keryx#Third00000000001 Open the door.\n`;
    const document = parseRitualPug(source);
    expect(document.nodes[0]).toMatchObject({
      id: "Ab3k9Qp7Zx2Mn5Rs",
      attrs: { say: true, role: "hiero" },
    });
    expect(document.nodes[1]).toMatchObject({
      id: "Third00000000001",
      attrs: { do: true, role: "keryx" },
    });
    const printed = printRitualPug(document);
    expect(printed).toContain(
      "Hiero#Ab3k9Qp7Zx2Mn5Rs: Hi #[b#Other00000000001 there].",
    );
    expect(printed).toContain("* Keryx#Third00000000001 Open the door.");
    expect(parseRitualPug(printed)).toEqual(document);
    const ranges = ritualPugIdRanges(source)!;
    expect(ranges.map((range) => source.slice(range.from, range.to))).toEqual([
      "#Ab3k9Qp7Zx2Mn5Rs",
      "#Other00000000001",
      "#Third00000000001",
    ]);
  });

  it("assigns IDs to fresh tasks, supports groups and retains explicit fallbacks", () => {
    const document = parseRitualPug(
      `${RITUAL_PUG_HEADER}\nhiero:hi\n* All-officers Rise.\nHiero,Keryx: Ready.\nsay(role="Hiero") Case-sensitive role.\ndo(role="keryx")\n  note Complex content\n`,
    );
    expect(document.nodes[0]).toMatchObject({
      id: expect.stringMatching(/^[A-Za-z0-9]{16}$/),
      children: [{ text: "hi" }],
    });
    expect(document.nodes[1]).toMatchObject({
      attrs: { role: "all-officers" },
    });
    expect(document.nodes[2]).toMatchObject({ attrs: { role: "hiero,keryx" } });
    const printed = printRitualPug(document);
    expect(printed).toContain('(role="Hiero")');
    expect(printed).toContain('(role="keryx")\n');
    expect(parseRitualPug(printed)).toEqual(document);
  });

  it("prints capitalized role labels without changing reader keys or explicit spelling", () => {
    const document = parseRitualPug(
      `${RITUAL_PUG_HEADER}\nhiero#Ab3k9Qp7Zx2Mn5Rs: Hello.\n* pastHiero,keryx#Other00000000001 Rise.\nAll-officers#Third00000000001: Ready.\nsay#Fourth0000000001(role="Hiero") Exact case.\n`,
    );
    const printed = printRitualPug(document);
    expect(printed).toContain("Hiero#Ab3k9Qp7Zx2Mn5Rs: Hello.");
    expect(printed).toContain("* PastHiero,Keryx#Other00000000001 Rise.");
    expect(printed).toContain("All-officers#Third00000000001: Ready.");
    expect(printed).toContain('say#Fourth0000000001(role="Hiero") Exact case.');
    expect(parseRitualPug(printed)).toEqual(document);
    expect(parseRitualPug(printed.replace("Hiero#Ab3", "hiero#Ab3"))).toEqual(
      document,
    );
  });

  it("retains comments and section separators through both source dialects", () => {
    const document = parseRitualPug(
      `${RITUAL_PUG_HEADER}\n//- Preparation\n\nsummary(summary="Opening")\n  //- Quietly\n  hiero: Welcome.\n  \n  * keryx Open.\n\n//- Closing\nhiero: Done.\n\n`,
    );
    const printed = printRitualPug(document);
    expect(printed).toContain("//- Preparation\n\nsummary");
    expect(printed).toContain("\n\n//- Closing");
    expect(parseRitualPug(printed)).toEqual(document);
    expect(parseRitualText(printRitualText(document))).toEqual(document);
    expect(JSON.stringify(semanticToJrt(document))).not.toMatch(
      /Preparation|Quietly|Closing|annotation/,
    );
  });

  it("retains multiline comments, literal annotation payloads and correct following ID spans", () => {
    const source = `${RITUAL_PUG_HEADER}\n//- Author note\n  nested comment\n    deeper line\nhiero#Ab3k9Qp7Zx2Mn5Rs: Hi.\n`;
    const document = parseRitualPug(source);
    expect(document.nodes[0]).toEqual({
      kind: "annotation",
      style: "comment",
      text: "Author note\nnested comment\n  deeper line",
    });
    expect(parseRitualPug(printRitualPug(document))).toEqual(document);
    const range = ritualPugIdRanges(source)![0];
    expect(source.slice(range.from, range.to)).toBe("#Ab3k9Qp7Zx2Mn5Rs");
  });

  it.each([
    "hiero: #{execute()}",
    "* keryx !{execute()}",
    "hiero#bad: Hi.",
    "ritualComment(value=execute())/",
    "ritualBlank(value=1)/",
    "ritualComment(value=2)/",
  ])("rejects unsafe or malformed convenience source: %s", (line) => {
    expect(() => parseRitualPug(`${RITUAL_PUG_HEADER}\n${line}\n`)).toThrow();
  });
});

it.each([
  "note.\n  hiero: literal line\n\n  //- literal comment\n  * keryx literal action",
  'say(\n  role="hiero"\n\n) Hello.',
  "note: b bold",
  "note#Ab3k9Qp7Zx2Mn5Rs: b bold",
  "note\n  | Hello\n\n  | world",
  'summary(summary="x")\n  note\n  \n    b text',
])(
  "preserves pre-existing Pug literal, attribute and expansion contexts: %s",
  (body) => {
    const document = parseRitualPug(`${RITUAL_PUG_HEADER}\n${body}\n`);
    const reference = /^note(?:#[A-Za-z0-9]+)?: b bold$/.test(body)
      ? "note\n  b bold"
      : body;
    const jrt = prepare(reference);
    const stripGeneratedEmptyText = (node) => ({
      ...node,
      ...(node.children
        ? {
            children: node.children
              .filter((child) => child.type !== "text" || child.value !== "")
              .map(stripGeneratedEmptyText),
          }
        : {}),
    });
    expect(semanticToJrt(document)).toEqual(stripGeneratedEmptyText(jrt));
    expect(parseRitualPug(printRitualPug(document))).toEqual(document);
  },
);

it("preserves comment paragraphs separated by unindented blank lines", () => {
  const document = parseRitualPug(
    `${RITUAL_PUG_HEADER}\n//- First\n  Paragraph one\n\n  Paragraph two\nnote Visible\n`,
  );
  expect(document.nodes[0]).toMatchObject({
    kind: "annotation",
    style: "comment",
    text: "First\nParagraph one\n\nParagraph two",
  });
  expect(parseRitualPug(printRitualPug(document))).toEqual(document);
});

it("keeps a comment followed by trailing blank separators as separate annotations", () => {
  const document: RitualSemanticDocument = {
    format: "magickli-ritual",
    version: 1,
    nodes: [
      { kind: "annotation", style: "comment", text: "x" },
      { kind: "annotation", style: "blank", text: "" },
      { kind: "annotation", style: "blank", text: "" },
    ],
  };
  expect(parseRitualPug(printRitualPug(document))).toEqual(document);
});

it("recovers clean older Pug draft annotations while retaining all previous identities", () => {
  const document = semanticFromJrt({
    children: [
      {
        type: "task",
        say: true,
        role: "hiero",
        children: [
          { type: "text", value: "Hi " },
          { type: "b", children: [{ type: "text", value: "there" }] },
        ],
      },
    ],
  });
  const recovered = restorePugDraftAnnotations(
    document,
    `${RITUAL_PUG_HEADER}\n//- Retain this\n\nsay(role="hiero") Hi #[b there]\n`,
  );
  expect(recovered.nodes.slice(0, 2)).toEqual([
    { kind: "annotation", style: "comment", text: "Retain this" },
    { kind: "annotation", style: "blank", text: "" },
  ]);
  expect(recovered.nodes.slice(2)).toEqual(document.nodes);
  expect(() =>
    restorePugDraftAnnotations(
      document,
      `${RITUAL_PUG_HEADER}\nhiero: Changed\n`,
    ),
  ).toThrow(/manual recovery/);
});
