import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SevenBranchedCandleStick from "./SevenBranchedCandleStick";
import TableOfShewbread from "./TableOfShewbread";

const idsAndHrefs = (markup: string) => ({
  ids: [...markup.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id),
  hrefs: [...markup.matchAll(/\shref="#([^"]+)"/g)].map(([, id]) => id),
});

describe("the Shewbread and the candlestick on one page", () => {
  it("define unique text path ids, and every reference resolves", () => {
    // Both used `path-<branch>-l<line>` for their text paths, so on one
    // page the second drawing's text followed the first one's paths.
    const markup = renderToStaticMarkup(
      <div>
        <TableOfShewbread />
        <SevenBranchedCandleStick />
        <TableOfShewbread idPrefix="second-shewbread" />
        <SevenBranchedCandleStick idPrefix="second-candlestick" />
      </div>,
    );
    const { ids, hrefs } = idsAndHrefs(markup);
    expect(ids.length).toBeGreaterThan(100);
    expect(new Set(ids).size).toBe(ids.length);
    expect(hrefs.length).toBe(ids.length);
    for (const href of hrefs) expect(ids).toContain(href);
  });

  it("render without hooks, as the image routes call them", () => {
    // The /og and /api/render routes render these with a React that has
    // no hook dispatcher, so a hook such as useId breaks the build.
    for (const Diagram of [TableOfShewbread, SevenBranchedCandleStick]) {
      const render = (
        Diagram as unknown as {
          render: (props: object, ref: null) => unknown;
        }
      ).render;
      expect(() => render({}, null)).not.toThrow();
    }
  });
});
