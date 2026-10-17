import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SevenBranchedCandleStick from "./SevenBranchedCandleStick";
import TableOfShewbread from "./TableOfShewbread";

/**
 * Every hook these modules can reach through "react", named or on the
 * default export, recorded as it is called and then run. react-dom's own
 * React is untouched, so the diagrams render as the image routes render
 * them, children included.
 */
const hooksCalled = vi.hoisted(() => [] as string[]);
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const original = actual.default as Record<string, unknown>;
  const guarded: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(original))
    if (/^use(?:[A-Z]|$)/.test(name) && typeof value === "function")
      guarded[name] = (...args: unknown[]) => {
        hooksCalled.push(name);
        return (value as (...a: unknown[]) => unknown)(...args);
      };
  return { ...actual, ...guarded, default: { ...original, ...guarded } };
});

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
    hooksCalled.length = 0;
    const markup = renderToStaticMarkup(
      <svg aria-hidden="true">
        <TableOfShewbread />
        <SevenBranchedCandleStick />
      </svg>,
    );
    expect(markup).toContain("<textPath");
    expect(hooksCalled).toEqual([]);
  });

  it("would see a hook if one were used", () => {
    // The guard itself: a component calling useId through "react".
    hooksCalled.length = 0;
    function WithHook() {
      return <g id={React.useId()} />;
    }
    renderToStaticMarkup(
      <svg aria-hidden="true">
        <WithHook />
      </svg>,
    );
    expect(hooksCalled).toEqual(["useId"]);
  });
});
