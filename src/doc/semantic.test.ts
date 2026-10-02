import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createUuidV7 } from "../lib/ids";
import { prepare } from "./prepare";
import { createRitualNodeId } from "./ritualNodeIds";
import {
  semanticFromJrt,
  semanticToJrt,
  validateRitualSemantic,
} from "./semantic";

describe("semantic legacy import", () => {
  for (const name of ["0=0", "1=10", "2=9"]) {
    it(`preserves every compiled node in ${name}`, () => {
      const source = readFileSync(
        new URL(`./${name}.jade`, import.meta.url),
        "utf8",
      );
      const compiled = prepare(source);
      const semantic = semanticFromJrt(compiled);
      expect(validateRitualSemantic(semantic)).toEqual([]);
      expect(semanticToJrt(semantic)).toEqual(compiled);
      expect(
        semantic.nodes.every((node) => node.kind === "text" || node.id),
      ).toBe(true);
    });
  }

  it("retains unsupported and empty legacy nodes without interpreting them", () => {
    const compiled = {
      children: [
        {
          type: "mystery-widget",
          mode: "opaque",
          children: [{ type: "text", value: "keep" }],
        },
        {},
      ],
    };
    const semantic = semanticFromJrt(compiled);
    expect(semantic.nodes.map((node) => node.kind)).toEqual([
      "legacy",
      "legacy",
    ]);
    expect(semanticToJrt(semantic)).toEqual(compiled);
  });

  it("rejects a copied block identity before serialization", () => {
    const semantic = semanticFromJrt({
      children: [{ type: "task", say: true, role: "hiero", children: [] }],
    });
    semantic.nodes.push(structuredClone(semantic.nodes[0]));
    expect(validateRitualSemantic(semantic)).toContain(
      "nodes[1]: duplicate id",
    );
    expect(() => semanticToJrt(semantic)).toThrow("duplicate id");
  });

  it("preserves existing canonical UUIDv7 identities", () => {
    const id = createUuidV7();
    const semantic = semanticFromJrt(
      {
        children: [
          { type: "note", children: [{ type: "text", value: "שלום" }] },
        ],
      },
      () => id,
    );
    expect(semantic.nodes[0]).toMatchObject({ id, kind: "element" });
  });

  it("keeps distinct case-sensitive short identities in a mixed document", () => {
    const ids = [createUuidV7(), "Ab3k9Qp7Zx2Mn5Rs", "ab3k9qp7zx2mn5rs"];
    const jrt = {
      children: [
        { type: "note", children: [] },
        { type: "var", name: "candidate" },
        { type: "unknown-widget" },
      ],
    };
    const semantic = semanticFromJrt(jrt, () => ids.shift()!);
    expect(validateRitualSemantic(semantic)).toEqual([]);
    expect(semanticToJrt(semantic)).toEqual(jrt);
    semantic.nodes.push(structuredClone(semantic.nodes[1]));
    expect(validateRitualSemantic(semantic)).toContain(
      "nodes[3]: duplicate id",
    );
  });

  it("uses short IDs for legacy imports and rejects malformed injected identities", () => {
    const jrt = { children: [{ type: "note" }] };
    const document = semanticFromJrt(jrt);
    expect(document.nodes[0]).toMatchObject({
      id: expect.stringMatching(/^[A-Za-z0-9]{16}$/),
    });
    expect(() => semanticFromJrt(jrt, () => "bad-id")).toThrow(
      "Invalid semantic node identity",
    );
    expect(semanticFromJrt(jrt, createRitualNodeId).nodes).toHaveLength(1);
  });
});
