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
    expect(prepareTablet({ tablet: "air", version: "dee" }).props.version).toBe(
      "dee",
    );
    expect(prepareTablet({ tablet: "air" }).title).toBe("Air Watchtower");
    const union = prepareTablet({ tablet: "union", version: "equinox" });
    expect(union.title).toBe("Tablet of Union");
    expect(union.props).toEqual({
      id: "union",
      font: "latin",
      version: "equinox",
    });
    expect(union.text).toBe(
      "Enochian Tablet of Union, version equinox, latin letters.",
    );
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
    // No Tablet of Union in Dee's or Raphael's versions; the old key.
    expect(() => prepareTablet({ tablet: "union", version: "dee" })).toThrow();
    expect(() =>
      prepareTablet({ tablet: "union", version: "raphael" }),
    ).toThrow();
    expect(() => prepareTablet({ element: "air" })).toThrow();
    expect(() => prepareTablet({ tablet: "spirit" })).toThrow();
    expect(() => prepareHall({ hall: "https://elsewhere.example" })).toThrow();
  });
});
