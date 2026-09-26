import { expect, it } from "vitest";
import { semanticFromJrt } from "./semantic";
import { createSemanticImportReport } from "./semanticImportReport";

it("reports exact legacy round-trip coverage without exposing opaque payloads", () => {
  const jrt = {
    children: [
      {
        type: "task",
        say: true,
        role: "hiero",
        children: [{ type: "text", value: "Welcome." }],
      },
      { type: "customLegacyNode", privatePayload: "sensitive fixture" },
    ],
  };
  const report = createSemanticImportReport(jrt, semanticFromJrt(jrt));
  expect(report).toEqual({
    lossless: true,
    elementCount: 1,
    textCount: 1,
    opaqueCount: 1,
  });
  expect(JSON.stringify(report)).not.toContain("sensitive fixture");
});

it("refuses to label a changed reader tree as lossless", () => {
  const jrt = { children: [{ type: "text", value: "Original" }] };
  const semantic = semanticFromJrt(jrt);
  semantic.nodes[0] = { kind: "text", text: "Changed" };
  expect(createSemanticImportReport(jrt, semantic).lossless).toBe(false);
});
