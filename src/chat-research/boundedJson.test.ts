import { expect, it, vi } from "vitest";
import { parseBoundedResearchJson } from "./boundedJson";

vi.mock("server-only", () => ({}));
it("accepts the exact byte/node boundary and keeps parsing data separate from capabilities", () => {
  expect(parseBoundedResearchJson('{"x":1}', 7)).toEqual({ x: 1 });
  expect(
    parseBoundedResearchJson(
      JSON.stringify(Array(99999).fill(0)),
      2 * 1024 * 1024,
    ),
  ).toHaveLength(99999);
});
it.each([0, -1, NaN, Infinity, 2 * 1024 * 1024 + 1, "8"])(
  "refuses an invalid caller byte limit %j",
  (limit) =>
    expect(() => parseBoundedResearchJson("{}", limit as number)).toThrow(),
);
it.each([null, {}, [], 42])(
  "does not coerce or walk a caller value %j",
  (value) =>
    expect(() => parseBoundedResearchJson(value as string, 1024)).toThrow(),
);
it.each([
  '{"x":1,"x":2}',
  '{"x":1,"\\u0078":2}',
  '{"x":"\\ud800"}',
  "[1e999]",
  "[",
  "\ufeff{}",
])("rejects ambiguous or malformed bounded text %j", (text) =>
  expect(() => parseBoundedResearchJson(text, 1024)).toThrow(),
);
it("rejects excessive nodes and nesting within the byte cap", () => {
  expect(() =>
    parseBoundedResearchJson(
      JSON.stringify(Array(100000).fill(0)),
      2 * 1024 * 1024,
    ),
  ).toThrow();
  expect(() =>
    parseBoundedResearchJson("[".repeat(65) + "0" + "]".repeat(65), 1024),
  ).toThrow();
});

it("never exposes raw malformed input through a native parser error", () => {
  try {
    parseBoundedResearchJson("private unparseable phrase", 1024);
    throw Error("Expected refusal");
  } catch (error) {
    expect((error as Error).message).toBe("Bounded research JSON unavailable");
  }
});
