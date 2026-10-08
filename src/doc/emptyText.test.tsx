// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Render } from "./blocks";
import DocContext from "./context";
import { prepare } from "./prepare";
import { roles } from "./ritualBlocks/roles";
import {
  type RitualSemanticDocument,
  semanticFromJrt,
  semanticToJrt,
} from "./semantic";
import { withoutEmptyText } from "./semanticNormalize";

/** The reader's full block output, with each declared variable at its default. */
function readerHtml(document: RitualSemanticDocument) {
  const doc = semanticToJrt(document) as {
    children?: { type: string; name?: string; default?: string }[];
  };
  const vars = Object.fromEntries(
    (doc.children ?? [])
      .filter((node) => node.type === "declareVar")
      .map((node) => [node.name, { value: node.default, set() {} }]),
  );
  return renderToStaticMarkup(
    <DocContext.Provider value={{ vars, roles }}>
      <Render doc={doc} onChange={undefined} />
    </DocContext.Provider>,
  );
}

describe("dropping empty text nodes", () => {
  for (const name of ["0=0", "1=10", "2=9"])
    it(`leaves the ${name} reader output unchanged`, () => {
      const document = semanticFromJrt(
        prepare(readFileSync(`${process.cwd()}/src/doc/${name}.pug`, "utf8")),
      );
      expect(JSON.stringify(document)).toContain('"text":""');
      const normalized = withoutEmptyText(document);
      expect(JSON.stringify(normalized)).not.toContain('"text":""');
      const html = readerHtml(document);
      // The whole ritual renders, including its closing lines.
      expect(html.length).toBeGreaterThan(50_000);
      // The reader wraps every text node in a span, so an empty text node
      // draws an empty span. It has no box, and no reader style selects empty
      // spans or counts their siblings; everything else must be identical.
      const empty = /<span><\/span>/g;
      const after = readerHtml(normalized);
      const dropped = JSON.stringify(document).split('"text":""').length - 1;
      // Exactly one empty span fewer per dropped node, and nothing else.
      expect(
        (html.match(empty)?.length ?? 0) - (after.match(empty)?.length ?? 0),
      ).toBe(dropped);
      expect(after.replace(empty, "")).toBe(html.replace(empty, ""));
    });
});
