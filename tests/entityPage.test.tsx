import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TreeOfLife from "@/components/kabbalah/TreeOfLife";
import { expectEntityPage } from "./entityPage";

/**
 * The helper's own rules, on markup small enough to read: a link must be a
 * route of this site, and a same-page reference must name an element the
 * page has. The Tree is the page part that makes the second rule necessary:
 * it lays each sphere's labels along curves it references as `#…`.
 */
describe("expectEntityPage", () => {
  it("passes a heading and a link to a route", () => {
    expectEntityPage(
      '<h1>Keter</h1><a href="/kabbalah/tree">Tree</a>',
      "Keter",
    );
  });

  it("takes the Tree's references to its own curves for what they are", () => {
    const tree = renderToString(<TreeOfLife topText="index" flip={false} />);
    expect(tree).toContain('xlink:href="#');
    expectEntityPage(`<h1>Tree</h1>${tree}`, "Tree");
  });

  it("refuses a reference to an element the page lacks", () => {
    expect(() =>
      expectEntityPage('<h1>X</h1><use xlink:href="#missing"></use>', "X"),
    ).toThrow(/references to no element on the page/);
  });

  it("refuses a link to a route the site does not build", () => {
    expect(() =>
      expectEntityPage('<h1>X</h1><a href="/kabbalah/angel">A</a>', "X"),
    ).toThrow(/links to no route of this site/);
  });
});
