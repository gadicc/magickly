import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { roles } from "./roles";

describe("ritual role symbols", () => {
  it("draws the Past Hierophant as its own lamen, without brackets", () => {
    // The white ring tells it from the Hierophant (plan 061, decision 9).
    const past = renderToStaticMarkup(roles.pastHierophant.symbol);
    expect(past.startsWith("<svg")).toBe(true);
    expect(past).not.toMatch(/^\(|\)$|<span/);
    expect(past).not.toBe(renderToStaticMarkup(roles.hierophant.symbol));
  });
});
