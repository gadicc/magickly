import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createUuidV7 } from "../lib/ids";
import { prepare } from "./prepare";
import { semanticFromJrt } from "./semantic";
import {
  compileSemanticSource,
  SEMANTIC_COMPILER_COMPONENTS,
  SEMANTIC_SOURCE_FORMAT,
} from "./semanticCompile";

const hash = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

describe("semantic compiler", () => {
  it("stores annotations in source bytes while excluding them from reader artifacts", () => {
    const document = semanticFromJrt({
      children: [
        { type: "note", children: [{ type: "text", value: "Visible" }] },
      ],
    });
    document.nodes.unshift(
      {
        kind: "annotation",
        style: "comment",
        text: "Author-only instructions",
      },
      { kind: "annotation", style: "blank", text: "" },
    );
    const compiled = compileSemanticSource(JSON.stringify(document));
    expect(JSON.parse(compiled!.contentJson)).toEqual({
      children: [
        { type: "note", children: [{ type: "text", value: "Visible" }] },
      ],
    });
    expect(compiled!.sourceSha256).toBe(hash(JSON.stringify(document)));
    expect(compiled!.contentJson).not.toContain("Author-only instructions");
    for (const bad of [
      { kind: "annotation", style: "blank", text: "x" },
      { kind: "annotation", style: "other", text: "" },
      { kind: "annotation", style: "comment", text: 12 },
    ]) {
      expect(
        compileSemanticSource(JSON.stringify({ ...document, nodes: [bad] })),
      ).toBeNull();
    }
  });
  it("accepts mixed identity generations without putting identities in reader output", () => {
    const ids = [createUuidV7(), "Ab3k9Qp7Zx2Mn5Rs"];
    const jrt = {
      children: [{ type: "note" }, { type: "unknown-widget", payload: "keep" }],
    };
    const document = semanticFromJrt(jrt, () => ids.shift()!);
    const source = JSON.stringify(document);
    const compiled = compileSemanticSource(source);
    expect(compiled?.sourceSha256).toBe(hash(source));
    expect(JSON.parse(compiled!.contentJson)).toEqual(jrt);
  });
  it("binds its identity to the reviewed model and implementation bytes", () => {
    expect(
      hash(readFileSync(new URL("./semantic.ts", import.meta.url), "utf8")),
    ).toBe(SEMANTIC_COMPILER_COMPONENTS.semanticModelSha256);
    expect(
      hash(
        readFileSync(
          new URL("./semanticCompilerImpl.ts", import.meta.url),
          "utf8",
        ),
      ),
    ).toBe(SEMANTIC_COMPILER_COMPONENTS.semanticCompilerImplSha256);
    expect(
      hash(
        readFileSync(new URL("./ritualNodeIds.ts", import.meta.url), "utf8"),
      ),
    ).toBe(SEMANTIC_COMPILER_COMPONENTS.ritualNodeIdsSha256);
  });
  for (const name of ["0=0", "1=10", "2=9"]) {
    it(`emits JRT profile 1 parity for ${name}`, () => {
      const pug = readFileSync(
        new URL(`./${name}.jade`, import.meta.url),
        "utf8",
      );
      const jrt = prepare(pug);
      const source = JSON.stringify(semanticFromJrt(jrt), null, 2);
      const result = compileSemanticSource(source);
      expect(result).not.toBeNull();
      expect(result?.sourceSha256).toBe(hash(source));
      expect(result?.sourceFormat).toBe(SEMANTIC_SOURCE_FORMAT);
      expect(result?.outputFormatVersion).toBe("1");
      expect(JSON.parse(result!.contentJson)).toEqual(jrt);
      expect(result?.contentSha256).toBe(hash(result!.contentJson));
    });
  }

  it("rejects malformed, unsupported, and duplicate-identity submissions", () => {
    expect(compileSemanticSource("{bad")).toBeNull();
    expect(
      compileSemanticSource(
        JSON.stringify({ format: "other", version: 1, nodes: [] }),
      ),
    ).toBeNull();
    const node = semanticFromJrt({
      children: [{ type: "task", say: true, role: "hiero" }],
    }).nodes[0];
    expect(
      compileSemanticSource(
        JSON.stringify({
          format: "magickli-ritual",
          version: 1,
          nodes: [node, node],
        }),
      ),
    ).toBeNull();
    const image = semanticFromJrt({
      children: [{ type: "img", src: "/pic.svg" }],
    });
    if (image.nodes[0].kind !== "element") throw new Error("Expected image");
    image.nodes[0].attrs.style = "{broken";
    expect(compileSemanticSource(JSON.stringify(image))).toBeNull();
  });
});
