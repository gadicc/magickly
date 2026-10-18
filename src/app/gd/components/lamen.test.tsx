import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Lamen from "./lamen";

const render = (officer: string) =>
  renderToStaticMarkup(<Lamen officer={officer} />);

/** The fills of the ring, the disc and the cross, in drawing order. */
const fills = (markup: string) =>
  [...markup.matchAll(/fill:([^;"]+)/g)].map(([, fill]) => fill);

const OFFICERS = [
  "imperator",
  "praemonstrator",
  "cancellarius",
  "hierophant",
  "pastHierophant",
  "hiereus",
  "hegemon",
  "keryx",
  "stolistes",
  "dadouchos",
  "sentinel",
];

describe("Lamen", () => {
  it("draws the chiefs' Calvary cross in the ring's colour", () => {
    expect(fills(render("imperator"))).toEqual(["red", "green", "red"]);
    expect(fills(render("praemonstrator"))).toEqual(["#48f", "orange", "#48f"]);
    expect(fills(render("cancellarius"))).toEqual(["yellow", "#b5b", "yellow"]);
  });

  it("rings the Hierophant in red and white stripes", () => {
    const markup = render("hierophant");
    expect(fills(markup)).toEqual(["red", "green", "red"]);
    // Six white stripes over the red ring, under the disc.
    const stripes = markup.match(/<path d="([^"]+)" fill="white"/);
    expect(stripes?.[1].match(/M/g)).toHaveLength(6);
    expect(markup.indexOf('fill="white"')).toBeLessThan(
      markup.indexOf('r="42"'),
    );
  });

  it("draws the stripes symmetrically, a red stripe on the diameter", () => {
    const d = (render("hierophant").match(/<path d="([^"]+)" fill="white"/) ??
      [])[1] as string;
    const heights = [...d.matchAll(/M[-\d.]+ ([-\d.]+)A/g)].map(([, y]) =>
      Number(y),
    );
    expect(heights).toEqual([4, -12, 20, -28, 36, -44]);
  });

  it("rings the Past Hierophant in white, the Hierophant's cross and disc", () => {
    expect(fills(render("pastHierophant"))).toEqual(["white", "green", "red"]);
    expect(render("pastHierophant")).not.toContain('fill="white"');
  });

  it("draws the floor officers white on black", () => {
    for (const officer of ["hiereus", "hegemon", "stolistes", "dadouchos"])
      expect(fills(render(officer)), officer).toEqual([
        "white",
        "#000",
        "white",
      ]);
    expect(render("keryx")).toContain('<g fill="white"');
    expect(render("sentinel")).toContain('<path fill="white"');
  });

  it("falls back to the Hierophant without an officer", () => {
    expect(render("")).toBe(render("hierophant"));
  });

  it("never reads an inherited property for an untrusted officer name", () => {
    const plain = render("nobody");
    expect(fills(plain)).toEqual(["white", "#000"]);
    for (const officer of [
      "constructor",
      "toString",
      "__proto__",
      "hasOwnProperty",
      "valueOf",
    ]) {
      const markup = render(officer);
      expect(markup, officer).toBe(plain);
      expect(markup, officer).not.toMatch(/function|object Object/);
    }
  });

  it("keeps the caller's size and circle styles", () => {
    const markup = renderToStaticMarkup(
      <Lamen
        officer="hegemon"
        width={30}
        height={25}
        outerCircleStyle={{ fill: "grey" }}
        innerCircleStyle={{ stroke: "blue" }}
      />,
    );
    expect(markup).toContain('width="30" height="25"');
    expect(fills(markup)[0]).toBe("grey");
    expect(markup).toContain("stroke:blue");
  });

  it("defines no ids, so any number can share a page", () => {
    for (const officer of OFFICERS)
      expect(render(officer), officer).not.toMatch(/\sid=/);
  });
});
