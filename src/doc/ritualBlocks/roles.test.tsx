import { HALL_ROLES } from "@magick-components/gd/hall/vocabulary";
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

  it("knows every officer a temple hall knows, so the two stay one set", () => {
    // Plan 061, decision 5: hall roles use the ritual role keys.
    for (const [role, name] of HALL_ROLES) {
      expect(Object.hasOwn(roles, role), role).toBe(true);
      expect(roles[role].name, role).toBe(name);
      expect(roles[role].symbol, role).toBeTruthy();
    }
  });

  it("draws the adepts as plain circles until their lamens exist", () => {
    const chief = renderToStaticMarkup(roles.chiefAdept.symbol);
    expect(chief).toContain("<circle");
    expect(renderToStaticMarkup(roles.thirdAdept.symbol)).toBe(chief);
  });
});
