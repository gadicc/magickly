import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fixture } from "../../editor-trial/source-formats/fixture.mjs";
import { createUuidV7 } from "../lib/ids";
import { prepare } from "./prepare";
import { createRitualNodeId } from "./ritualNodeIds";
import { parseRitualPug, printRitualPug, RITUAL_PUG_HEADER } from "./ritualPug";
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
        readFileSync(new URL(`./${name}.jade`, import.meta.url), "utf8"),
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

  it("sanitizes lexer diagnostics and preserves unbuffered comments only in source", () => {
    const marker = "SYNTHETIC_PRIVATE_MARKER";
    try {
      parseRitualPug(`${RITUAL_PUG_HEADER}\nnote(value="${marker}`);
    } catch (error) {
      expect((error as Error).message).not.toContain(marker);
    }
    const document = parseRitualPug(
      `${RITUAL_PUG_HEADER}\n//- Author note\nnote Content\n`,
    );
    expect(document.nodes).toHaveLength(1);
    expect(printRitualPug(document)).not.toContain("Author note");
  });

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
