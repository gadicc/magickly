// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GradeTree from "../gd/GradeTree.tsx";
import TreeOfLife from "./TreeOfLife.tsx";

/** The XML parser's complaint about `markup`, or null when it is well-formed. */
function xmlError(markup: string): string | null {
  const document = new DOMParser().parseFromString(markup, "application/xml");
  const error = document.getElementsByTagName("parsererror")[0];
  return error ? (error.textContent ?? "parsererror") : null;
}

describe("the Tree as XML", () => {
  it("is caught out by an undeclared prefix, so the checks below mean something", () => {
    expect(
      xmlError(
        '<svg xmlns="http://www.w3.org/2000/svg"><a xlink:href="#x"/></svg>',
      ),
    ).not.toBeNull();
  });

  it("parses as XML by default, with its labels' text paths", () => {
    const markup = renderToStaticMarkup(<TreeOfLife id="t" />);
    expect(markup).toContain(' xlink:href="#t-topTextPath0"');
    expect(markup).toMatch(
      /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" xmlns:xlink="http:\/\/www.w3.org\/1999\/xlink" /,
    );
    expect(xmlError(markup)).toBeNull();
  });

  it("parses as XML with links, and so does the Grade Tree", () => {
    for (const markup of [
      renderToStaticMarkup(
        <TreeOfLife
          id="t"
          sephirahHref={(sephirah) => `/s/${sephirah.id}`}
          pathHref={(path) => `/p/${path.id}`}
        />,
      ),
      renderToStaticMarkup(
        <GradeTree id="g" sephirahHref={(s) => `/g/${s.gdGradeId}`} />,
      ),
    ]) {
      expect(markup).toContain("<a ");
      expect(xmlError(markup)).toBeNull();
    }
  });
});
