import assert from "node:assert/strict";
import { test } from "node:test";
import { getSchema } from "@tiptap/core";
import { fixture, longDocument, validate, audienceIncludes, malformedSource, normalizeIdentity } from "../src/model.js";
import { fromSlate, fromTiptap, toSlate, toTiptap } from "../src/adapters.js";
import { extensions } from "../src/tiptap.js";

test("synthetic fixture covers the semantic contract", () => {
  assert.deepEqual(validate(fixture), []);
  assert.equal(fixture.nodes.some((node) => node.type === "legacy"), true);
  assert.equal(typeof malformedSource, "string");
  assert.equal(audienceIncludes({ scope: "roles", roles: ["hiero"] }, "hierophant", fixture.aliases), true);
  assert.equal(audienceIncludes({ scope: "officersExcept", roles: ["keryx"] }, "candidate", fixture.aliases), false);
  assert.equal(audienceIncludes({ scope: "officersExcept", roles: ["keryx"] }, "hierophant", fixture.aliases), true);
  assert.equal(audienceIncludes({ scope: "all" }, "candidate", fixture.aliases), true);
});

test("Slate adapter preserves the fixture and reaches a fixed point", () => {
  const once = fromSlate(toSlate(fixture), fixture);
  const twice = fromSlate(toSlate(once), once);
  assert.deepEqual(once, fixture);
  assert.deepEqual(twice, once);
});

test("Tiptap adapter preserves the fixture through its actual schema", () => {
  const schema = getSchema(extensions);
  const checked = schema.nodeFromJSON(toTiptap(fixture));
  checked.check();
  const once = fromTiptap(checked.toJSON(), fixture);
  const twice = fromTiptap(schema.nodeFromJSON(toTiptap(once)).toJSON(), once);
  assert.deepEqual(once, fixture);
  assert.deepEqual(twice, once);
});

test("long variant is reproducible and valid", () => {
  const document = longDocument(200);
  assert.equal(document.nodes.length, fixture.nodes.length * 200 - 2 * 199);
  assert.deepEqual(validate(document), []);
  assert.equal(JSON.stringify(longDocument(200)), JSON.stringify(document));
  assert.equal(Buffer.byteLength(JSON.stringify(document), "utf8"), 445_488);
});

test("missing references, duplicate IDs and malformed audience fail validation", () => {
  const invalid = structuredClone(fixture);
  invalid.nodes[3].audience.scope = "bogus";
  invalid.nodes[3].id = "h1";
  invalid.nodes[3].children[0].children[1].name = "missing";
  assert.equal(validate(invalid).length, 3);
});

test("adapter identity normalization stabilizes an editor split", () => {
  const split = structuredClone(fixture);
  split.nodes[4].children.push(structuredClone(split.nodes[4].children[0]));
  const once = normalizeIdentity(split, fixture);
  const twice = normalizeIdentity(split, once);
  assert.deepEqual(validate(once), []);
  assert.notEqual(once.nodes[4].children[0].id, once.nodes[4].children[1].id);
  assert.equal(twice.nodes[4].children[1].id, once.nodes[4].children[1].id);
});
