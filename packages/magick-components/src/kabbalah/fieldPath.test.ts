import { describe, expect, it } from "vitest";
import { readFieldPath } from "./fieldPath";

describe("field path lookup", () => {
  const record = { name: { en: "Crown", roman: "Keter" }, index: 1 };

  it("reads dotted paths and misses quietly", () => {
    expect(readFieldPath(record, "name.en")).toBe("Crown");
    expect(readFieldPath(record, "index")).toBe(1);
    expect(readFieldPath(record, "name.missing")).toBeUndefined();
    expect(readFieldPath(record, "")).toBeUndefined();
  });

  it("degrades malformed query-string paths to undefined", () => {
    for (const path of ["name[", "name[en]", "name.en]"])
      expect(readFieldPath(record, path)).toBeUndefined();
  });
});

// `*` maps the rest of a path over a list and joins what it finds (plan 039,
// decision 4). These pin what a label shows for a list: the separator, what
// is left out, and that a list with nothing in it is blank rather than "".
describe("the wildcard segment", () => {
  const sephirah = {
    stones: [{ name: { en: "pearl" } }, { name: { en: "star sapphire" } }],
    scents: [{ name: { en: "rose" } }, { name: {} }, { name: { en: "" } }],
    nothing: [{ name: {} }, { name: { en: null } }],
    empty: [] as unknown[],
    words: ["loins", "hips"],
    numbers: [0, 1],
    nested: [{ parts: [{ id: "a" }, { id: "b" }] }, { parts: [{ id: "c" }] }],
    name: { en: "Crown" },
  };

  it("joins the rest of the path over every element with '; '", () => {
    expect(readFieldPath(sephirah, "stones.*.name.en")).toBe(
      "pearl; star sapphire",
    );
    expect(readFieldPath(sephirah, "words.*")).toBe("loins; hips");
    // A number is joined as text; `0` is a value, not an empty one.
    expect(readFieldPath(sephirah, "numbers.*")).toBe("0; 1");
  });

  it("leaves out what an element does not have, and null and ''", () => {
    expect(readFieldPath(sephirah, "scents.*.name.en")).toBe("rose");
  });

  it("reads undefined, not '', where no element has anything", () => {
    expect(readFieldPath(sephirah, "nothing.*.name.en")).toBeUndefined();
    expect(readFieldPath(sephirah, "empty.*.name.en")).toBeUndefined();
    expect(readFieldPath(sephirah, "empty.*")).toBeUndefined();
  });

  it("reads undefined where the segment is not applied to a list", () => {
    expect(readFieldPath(sephirah, "name.*")).toBeUndefined();
    expect(readFieldPath(sephirah, "name.en.*")).toBeUndefined();
    expect(readFieldPath(sephirah, "missing.*.name.en")).toBeUndefined();
    expect(readFieldPath(sephirah, "*")).toBeUndefined();
    // dot-prop reads a field of a string as the string itself; an element
    // without the field is left out instead.
    expect(readFieldPath(sephirah, "words.*.name")).toBeUndefined();
  });

  it("reads a list given as the source, and a list in a list", () => {
    expect(readFieldPath(sephirah.stones, "*.name.en")).toBe(
      "pearl; star sapphire",
    );
    // An index still reads one element, inside or outside a wildcard.
    expect(readFieldPath(sephirah, "stones.1.name.en")).toBe("star sapphire");
    expect(readFieldPath(sephirah, "nested.*.parts.0.id")).toBe("a; c");
  });

  it("degrades a malformed path with a wildcard to undefined", () => {
    for (const path of ["stones.*[", "stones[*]", "stones.*.name]["])
      expect(readFieldPath(sephirah, path)).toBeUndefined();
  });

  it("keeps a * inside a longer key an ordinary key", () => {
    expect(readFieldPath({ "a*b": 1, "*": 2 }, "a*b")).toBe(1);
    // A whole `*` segment is the wildcard, so it never reads a key named `*`.
    expect(readFieldPath({ "*": 2 }, "*")).toBeUndefined();
    // An escaped one is a key named `*`, as dot-prop has always read it.
    expect(readFieldPath({ "*": { x: "lit" } }, "\\*.x")).toBe("lit");
    expect(readFieldPath({ list: [{ "*": 1 }] }, "list.*.\\*")).toBeUndefined();
    // dot-prop's backslash escapes the next character, so the path `a\\.*`
    // is the key `a\` and then a wildcard, while `a\.*` is one key, "a.*".
    expect(readFieldPath({ "a\\": [{ x: 1 }, { x: 2 }] }, "a\\\\.*.x")).toBe(
      "1; 2",
    );
    expect(readFieldPath({ "a.*": { x: 3 } }, "a\\.*.x")).toBe(3);
    // Two wildcards side by side are two.
    expect(readFieldPath({ a: [[1]] }, "a.*.*")).toBeUndefined();
  });

  it("reads one wildcard per path, and nothing for a second", () => {
    expect(readFieldPath(sephirah, "nested.*.parts.*.id")).toBeUndefined();
    // Each wildcard multiplies the work by its list's length, and through
    // links that loop a short path would read millions of rows: the Tree
    // page takes its paths from the query string. Two elements, each the
    // whole list again, twenty deep, is 2^20 reads if a second is followed.
    const loop: { list: unknown[] } = { list: [] };
    loop.list.push(loop, loop);
    const path = Array.from({ length: 20 }, () => "list.*").join(".");
    const started = performance.now();
    expect(readFieldPath(loop, path)).toBeUndefined();
    expect(performance.now() - started).toBeLessThan(50);
  });
});
