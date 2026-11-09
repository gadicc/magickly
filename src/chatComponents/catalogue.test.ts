import { describe, expect, it } from "vitest";
import { prepareHall, prepareTablet, prepareTree } from "./catalogue";
import { createChatComponentTools } from "./tools";

describe("prepared chat component capabilities", () => {
  it("produces serializable versioned data using existing component contracts", () => {
    const tree = prepareTree({ field: "archangel.name.roman" });
    expect(tree.props.field).toBe("archangel.name.roman");
    expect(tree.component).toBe("tree-of-life");
    expect(JSON.parse(JSON.stringify(tree))).toEqual(tree);
    expect(tree.href).toContain("/kabbalah/tree?");
    expect(
      prepareTablet({ element: "air", version: "dee" }).props.version,
    ).toBe("dee");
    expect(prepareHall({ hall: "neophyte" }).href).toBe("/gd/halls/neophyte");
    expect(Object.keys(createChatComponentTools())).toEqual([
      "showTreeOfLife",
      "showEnochianTablet",
      "showTempleHall",
    ]);
  });
  it("rejects unknown fields, unsupported combinations and arbitrary markup/URLs", () => {
    expect(() => prepareTree({ field: "__proto__" })).toThrow();
    expect(() => prepareTree({ colorScale: "king", showDaat: true })).toThrow();
    expect(() => prepareTree({ html: "<script>bad</script>" })).toThrow();
    expect(() => prepareTablet({ element: "union" })).toThrow();
    expect(() => prepareHall({ hall: "https://elsewhere.example" })).toThrow();
  });
});
